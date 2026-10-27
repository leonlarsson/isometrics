import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import {
	forgetInstancedRoot,
	INSTANCED_ORIGINALS_LAYER,
	instancing,
	isShown,
	markInstancedRoot,
	scanRoot,
} from "./instancing";

/**
 * One shared look: a batched mesh drawing every original with its key, each
 * where it is. three's BatchedMesh, not an InstancedMesh: it leaves out the
 * instances outside each pass's camera (the view, the shadows, reflections)
 * and takes its matrices after its render hooks, where they're placed.
 */
interface IBatch {
	mesh: THREE.BatchedMesh;
	geometryId: number;
	originals: THREE.Mesh[];
	/** Each original's instance, in the same order. */
	instances: number[];
	/** The frame its instances were last placed in, so each frame places them once. */
	placedIn: number;
}

/**
 * A look is drawn together once this many meshes share it; one alone is drawn
 * as it is, which costs the GPU less than a batch of one.
 */
const SHARED_BY_AT_LEAST = 2;

/** Room for this many instances (doubling), so a batch isn't resized for each object added. */
const capacityFor = (count: number) => 2 ** Math.ceil(Math.log2(Math.max(count, 8)));

const disposeBatch = (batch: IBatch) => {
	batch.mesh.dispose();
	(batch.mesh.material as THREE.Material).dispose();
};

/**
 * Marks an object's part for instancing (ADR-0086): give the group around the
 * part's component as `group`. Its meshes are looked through again after
 * every render of the object.
 */
export const useInstancedPart = (group: RefObject<THREE.Group | null>) => {
	useLayoutEffect(() => {
		if (group.current) {
			markInstancedRoot(group.current);
		}
	});
	useLayoutEffect(() => {
		const current = group.current;
		return () => {
			if (current) {
				forgetInstancedRoot(current);
			}
		};
	}, []);
};

/**
 * Draws the meshes objects share (ADR-0086): one batched mesh per look,
 * placed where the originals are before the frame's shadows and view are
 * drawn, so moving and driving objects are followed. Mount once in the canvas.
 */
export const InstancedParts = () => {
	const raycaster = useThree((s) => s.raycaster);
	const container = useMemo(() => new THREE.Group(), []);
	const batches = useMemo(() => new Map<string, IBatch>(), []);
	const frame = useMemo(() => ({ id: 0 }), []);

	// The pointer still finds the originals, which take the clicks.
	useEffect(() => {
		raycaster.layers.enable(INSTANCED_ORIGINALS_LAYER);
		return () => raycaster.layers.disable(INSTANCED_ORIGINALS_LAYER);
	}, [raycaster]);

	useEffect(
		() => () => {
			for (const batch of batches.values()) {
				disposeBatch(batch);
			}
			batches.clear();
			// Drawn on their own again if this goes away (a hot reload).
			for (const root of instancing.roots.values()) {
				root.dirty = true;
				for (const { mesh } of root.shared) {
					mesh.layers.set(0);
				}
			}
			instancing.changed = true;
		},
		[batches],
	);

	/** Each instance where its original is now (its world matrix), and hidden with it. */
	const place = (batch: IBatch) => {
		if (batch.placedIn === frame.id) {
			return;
		}
		batch.placedIn = frame.id;
		batch.originals.forEach((original, i) => {
			batch.mesh.setMatrixAt(batch.instances[i], original.matrixWorld);
			batch.mesh.setVisibleAt(batch.instances[i], isShown(original));
		});
	};

	const makeBatch = (first: THREE.Mesh, capacity: number): IBatch => {
		const geometry = first.geometry;
		const mesh = new THREE.BatchedMesh(
			capacity,
			geometry.getAttribute("position").count,
			geometry.index?.count ?? 0,
			(first.material as THREE.Material).clone(),
		);
		const geometryId = mesh.addGeometry(geometry);
		mesh.castShadow = first.castShadow;
		mesh.receiveShadow = first.receiveShadow;
		mesh.renderOrder = first.renderOrder;
		// Instances are anywhere in the world: culled one by one, not as a whole.
		mesh.frustumCulled = false;
		mesh.matrixAutoUpdate = false;
		const batch: IBatch = { mesh, geometryId, originals: [], instances: [], placedIn: -1 };
		// The world's matrices are up to date by then: placed before the shadows, else before the
		// view, then culled for that pass's camera as BatchedMesh does.
		const cullForView = mesh.onBeforeRender.bind(mesh);
		const cullForShadow = mesh.onBeforeShadow.bind(mesh);
		mesh.onBeforeRender = (...args) => {
			place(batch);
			cullForView(...args);
		};
		mesh.onBeforeShadow = (...args) => {
			place(batch);
			cullForShadow(...args);
		};
		return batch;
	};

	/** As many instances as originals: added or taken away, growing the batch as needed. */
	const fit = (batch: IBatch, originals: THREE.Mesh[]) => {
		if (originals.length > batch.mesh.maxInstanceCount) {
			batch.mesh.setInstanceCount(capacityFor(originals.length));
		}
		while (batch.instances.length < originals.length) {
			batch.instances.push(batch.mesh.addInstance(batch.geometryId));
		}
		while (batch.instances.length > originals.length) {
			batch.mesh.deleteInstance(batch.instances.pop() as number);
		}
		batch.originals = originals;
		batch.placedIn = -1;
	};

	/** Looks through changed objects, then sorts every shared mesh into the batch for its look. */
	const rebuild = () => {
		const byKey = new Map<string, THREE.Mesh[]>();
		for (const root of instancing.roots.values()) {
			if (root.dirty) {
				scanRoot(root);
			}
			for (const { mesh, key } of root.shared) {
				const list = byKey.get(key);
				if (list) {
					list.push(mesh);
				} else {
					byKey.set(key, [mesh]);
				}
			}
		}
		// A look only one mesh has is drawn as it is, on the drawn layer.
		for (const [key, originals] of byKey) {
			const together = originals.length >= SHARED_BY_AT_LEAST;
			for (const original of originals) {
				original.layers.set(together ? INSTANCED_ORIGINALS_LAYER : 0);
			}
			if (!together) {
				byKey.delete(key);
			}
		}
		for (const [key, batch] of batches) {
			if (!byKey.has(key)) {
				container.remove(batch.mesh);
				disposeBatch(batch);
				batches.delete(key);
			}
		}
		for (const [key, originals] of byKey) {
			let batch = batches.get(key);
			if (!batch) {
				batch = makeBatch(originals[0], capacityFor(originals.length));
				batches.set(key, batch);
				container.add(batch.mesh);
			}
			fit(batch, originals);
		}
		instancing.changed = false;
	};

	useFrame(() => {
		frame.id += 1;
		if (instancing.changed) {
			rebuild();
		}
	});

	return <primitive object={container} />;
};
