import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
	forgetInstancedRoot,
	geometryKey,
	type IInstancedRoot,
	INSTANCED_ORIGINALS_LAYER,
	instancing,
	isShown,
	markInstancedRoot,
	scanRoot,
} from "./instancing";

/**
 * One shared look: a batched mesh drawing every original with its key, each
 * where it is and in its own shape (ADR-0092: one draw per look, however many
 * shapes). three's BatchedMesh, not an InstancedMesh: it holds many shapes,
 * leaves out the instances outside each pass's camera (the view, the shadows,
 * reflections) and takes its matrices after its render hooks, where they're placed.
 */
interface IBatch {
	mesh: THREE.BatchedMesh;
	/** Each shape it holds, by geometryKey: its id in the batch and how much room it takes. */
	shapes: Map<string, { id: number; vertices: number; indices: number }>;
	originals: THREE.Mesh[];
	/** Each original's object, in the same order. */
	roots: IInstancedRoot[];
	/** Each original's instance, in the same order. */
	instances: number[];
	/** Each instance's shape (its geometryKey), in the same order. */
	shapeOf: string[];
	/** The originals that may move between renders (their indices): placed every frame (ADR-0092). */
	moving: number[];
	/** Every instance has been placed since the batch last changed; then only the moving ones are. */
	settled: boolean;
	/** Originals of objects that rendered since (their indices): placed and coloured once more. */
	stale: number[];
	/** The frame its instances were last placed in, so each frame places them once. */
	placedIn: number;
}

/**
 * A look is drawn together once this many meshes share it; one alone is drawn
 * as it is, which costs the GPU less than a batch of one.
 */
const SHARED_BY_AT_LEAST = 2;

/** A shape used this many times gets a batch of its own (see rebuild). */
const OWN_BATCH_FROM = 64;

/** A batch with this many instances culls them one by one (see fit). */
const CULL_ONE_BY_ONE_FROM = 64;

/** Room for this many (doubling), so a batch isn't resized for each object or shape added. */
const capacityFor = (count: number) => 2 ** Math.ceil(Math.log2(Math.max(count, 8)));

/** How many vertices and indices a geometry takes in a batch. */
const sizeOf = (geometry: THREE.BufferGeometry) => ({
	vertices: geometry.getAttribute("position").count,
	indices: geometry.getIndex()?.count ?? 0,
});

/** A part's group drawn by the renderer again (batches no longer draw all of it). */
const showOwnGroup = (root: IInstancedRoot) => {
	if (root.batchedAway) {
		root.batchedAway = false;
		root.group.userData.batchedAway = false;
		root.group.visible = true;
	}
};

type TColoredMaterial = THREE.Material & { color: THREE.Color };

const disposeBatch = (batch: IBatch) => {
	batch.mesh.dispose();
	(batch.mesh.material as THREE.Material).dispose();
};

/**
 * Marks an object's part for instancing (ADR-0086): give the group around the
 * part's component as `group`. Its meshes are looked through again after
 * every render of the object.
 */
export const useInstancedPart = (group: RefObject<THREE.Group | null>, moving: boolean) => {
	// The group it last marked: a part that goes away and comes back (a hidden object shown again)
	// has a new one, and the old one, with meshes no longer in the scene, must be forgotten.
	const marked = useRef<THREE.Group | null>(null);
	useLayoutEffect(() => {
		const current = group.current;
		if (marked.current && marked.current !== current) {
			forgetInstancedRoot(marked.current);
		}
		marked.current = current;
		if (current) {
			markInstancedRoot(current, moving);
		}
	});
	useLayoutEffect(
		() => () => {
			if (marked.current) {
				forgetInstancedRoot(marked.current);
			}
		},
		[],
	);
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
	/** Each batched original's batch. */
	const slots = useMemo(() => new Map<THREE.Mesh, IBatch>(), []);

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
				showOwnGroup(root);
			}
			instancing.changed = true;
			instancing.regrouped = true;
			slots.clear();
		},
		[batches],
	);

	/**
	 * Each instance where its original is now (its world matrix), hidden with it and in its colour:
	 * all of them once after the batch changed, then those of objects that rendered since, and every
	 * frame those that may move (ADR-0092), so a world of objects standing still costs nothing here,
	 * and uploads no matrices.
	 */
	const place = (batch: IBatch) => {
		if (batch.placedIn === frame.id) {
			return;
		}
		batch.placedIn = frame.id;
		const { mesh } = batch;
		const placeAt = (i: number) => {
			const original = batch.originals[i];
			mesh.setMatrixAt(batch.instances[i], original.matrixWorld);
			mesh.setVisibleAt(batch.instances[i], isShown(original));
		};
		const refresh = (i: number) => {
			placeAt(i);
			mesh.setColorAt(batch.instances[i], (batch.originals[i].material as TColoredMaterial).color);
		};
		const changed = !batch.settled || batch.stale.length > 0;
		if (!batch.settled) {
			batch.settled = true;
			for (let i = 0; i < batch.originals.length; i++) {
				refresh(i);
			}
		} else {
			for (const i of batch.stale) {
				refresh(i);
			}
		}
		batch.stale = [];
		for (const i of batch.moving) {
			placeAt(i);
		}
		// A small batch that stands still is culled as a whole from then on. three culls before it
		// renders, where instances are placed, so one with any that move is always drawn, and one
		// with a change waiting is drawn until it's placed (rebuild).
		if (changed && !mesh.perObjectFrustumCulled && batch.moving.length === 0) {
			mesh.computeBoundingSphere();
			mesh.frustumCulled = true;
		}
	};

	const makeBatch = (first: THREE.Mesh): IBatch => {
		const { vertices, indices } = sizeOf(first.geometry);
		// White: each instance has its own colour, which the shader multiplies it by.
		const material = (first.material as TColoredMaterial).clone();
		material.color.set(0xffffff);
		const mesh = new THREE.BatchedMesh(
			8,
			capacityFor(vertices * 2),
			capacityFor(Math.max(indices, 1) * 2),
			material,
		);
		mesh.castShadow = first.castShadow;
		mesh.receiveShadow = first.receiveShadow;
		mesh.renderOrder = first.renderOrder;
		// Instances are anywhere in the world: culled one by one, or as a whole once they stand still
		// (see fit and place).
		mesh.frustumCulled = false;
		mesh.matrixAutoUpdate = false;
		// Opaque and drawn in any order: sorting tens of thousands of instances each frame costs more
		// CPU than the overdraw it saves.
		mesh.sortObjects = false;

		const batch: IBatch = {
			mesh,
			shapes: new Map(),
			originals: [],
			roots: [],
			instances: [],
			shapeOf: [],
			moving: [],
			settled: false,
			stale: [],
			placedIn: -1,
		};
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

	/** Room for these shapes: the storage packed first, grown if that isn't enough. */
	const makeRoom = (batch: IBatch, added: THREE.BufferGeometry[]) => {
		const { mesh } = batch;
		const need = added.reduce(
			(sum, geometry) => {
				const { vertices, indices } = sizeOf(geometry);
				return { vertices: sum.vertices + vertices, indices: sum.indices + indices };
			},
			{ vertices: 0, indices: 0 },
		);
		const fits = () =>
			mesh.unusedVertexCount >= need.vertices && mesh.unusedIndexCount >= need.indices;
		if (!fits()) {
			mesh.optimize();
		}
		if (!fits()) {
			const used = [...batch.shapes.values()].reduce(
				(sum, shape) => ({
					vertices: sum.vertices + shape.vertices,
					indices: sum.indices + shape.indices,
				}),
				{ vertices: 0, indices: 0 },
			);
			mesh.setGeometrySize(
				capacityFor((used.vertices + need.vertices) * 2),
				capacityFor((used.indices + need.indices) * 2),
			);
		}
	};

	/**
	 * The batch's shapes and instances for these originals, after its members changed: shapes no
	 * longer used are let go and new ones added, and each original gets an instance in its shape,
	 * keeping the ones there were (adding and deleting instances costs far more than reshaping one).
	 */
	const fit = (batch: IBatch, originals: THREE.Mesh[], roots: IInstancedRoot[]) => {
		const { mesh } = batch;
		const shapeOf = originals.map((original) => geometryKey(original.geometry));
		const wanted = new Map<string, THREE.BufferGeometry>();
		originals.forEach((original, i) => {
			wanted.set(shapeOf[i], original.geometry);
		});
		const kept = Math.min(batch.instances.length, originals.length);
		for (const instance of batch.instances.slice(kept)) {
			mesh.deleteInstance(instance);
		}
		const instances = batch.instances.slice(0, kept);
		// Letting a shape go deletes its instances too: those get new ones below.
		const gone = new Set<number>();
		for (const [key, shape] of batch.shapes) {
			if (!wanted.has(key)) {
				mesh.deleteGeometry(shape.id);
				batch.shapes.delete(key);
				batch.shapeOf.forEach((was, i) => {
					if (was === key && i < kept) {
						gone.add(i);
					}
				});
			}
		}
		const added = [...wanted].filter(([key]) => !batch.shapes.has(key));
		if (added.length > 0) {
			makeRoom(
				batch,
				added.map(([, geometry]) => geometry),
			);
			for (const [key, geometry] of added) {
				batch.shapes.set(key, { id: mesh.addGeometry(geometry), ...sizeOf(geometry) });
			}
		}
		if (originals.length > mesh.maxInstanceCount) {
			mesh.setInstanceCount(capacityFor(originals.length));
		}
		const idOf = (i: number) => batch.shapes.get(shapeOf[i])?.id ?? 0;
		for (let i = 0; i < originals.length; i++) {
			if (i >= kept || gone.has(i)) {
				instances[i] = mesh.addInstance(idOf(i));
			} else if (batch.shapeOf[i] !== shapeOf[i]) {
				mesh.setGeometryIdAt(instances[i], idOf(i));
			}
		}
		batch.instances = instances;
		batch.shapeOf = shapeOf;
		batch.originals = originals;
		batch.roots = roots;
		batch.moving = roots.flatMap((root, i) => (root.moving ? [i] : []));
		batch.settled = false;
		batch.stale = [];
		batch.placedIn = -1;
		// Culling instances one by one rewrites the batch's draw list for every pass of every frame:
		// worth it for many instances spread over the world, not for a few.
		mesh.perObjectFrustumCulled = originals.length >= CULL_ONE_BY_ONE_FROM;
		mesh.frustumCulled = false;
	};

	/** Whether the batch holds exactly these originals, in these shapes and this order. */
	const holds = (batch: IBatch, originals: THREE.Mesh[]) =>
		batch.originals.length === originals.length &&
		originals.every(
			(original, i) =>
				original === batch.originals[i] && geometryKey(original.geometry) === batch.shapeOf[i],
		);

	/**
	 * The same members after objects rendered: their instances are placed and coloured once more,
	 * and which ones move is brought up to date.
	 */
	const touch = (batch: IBatch, rendered: ReadonlySet<IInstancedRoot>) => {
		const moving: number[] = [];
		batch.roots.forEach((root, i) => {
			if (rendered.has(root)) {
				batch.stale.push(i);
			}
			if (root.moving) {
				moving.push(i);
			}
		});
		batch.moving = moving;
		if (batch.stale.length > 0 || moving.length > 0) {
			batch.mesh.frustumCulled = false;
		}
	};

	/**
	 * Looks through objects that rendered, sorts every shared mesh into the batch for its look, and
	 * changes only the batches whose members changed (ADR-0092): moving one object in a big world
	 * touches its own instances, not every batch.
	 */
	const rebuild = () => {
		const rendered = new Set<IInstancedRoot>();
		let regrouped = instancing.regrouped;
		for (const root of instancing.roots.values()) {
			if (root.dirty) {
				const before = root.shared;
				const renderables = root.renderables;
				scanRoot(root);
				rendered.add(root);
				regrouped ||=
					root.renderables !== renderables ||
					root.shared.length !== before.length ||
					root.shared.some(
						(now, i) =>
							now.mesh !== before[i].mesh ||
							now.key !== before[i].key ||
							now.geometry !== before[i].geometry,
					);
			}
		}
		instancing.changed = false;
		instancing.regrouped = false;
		// Objects that rendered with the same meshes in the same looks and shapes (moved, recoloured,
		// selected): only their own instances change.
		if (!regrouped) {
			const touched = new Set<IBatch>();
			for (const root of rendered) {
				for (const { mesh } of root.shared) {
					const slot = slots.get(mesh);
					if (slot) {
						touched.add(slot);
					}
				}
			}
			for (const batch of touched) {
				touch(batch, rendered);
			}
			return;
		}
		const byKey = new Map<string, { originals: THREE.Mesh[]; roots: IInstancedRoot[] }>();
		for (const root of instancing.roots.values()) {
			for (const { mesh, key } of root.shared) {
				const list = byKey.get(key);
				if (list) {
					list.originals.push(mesh);
					list.roots.push(root);
				} else {
					byKey.set(key, { originals: [mesh], roots: [root] });
				}
			}
		}
		// A shape many objects share gets a batch of its own: thousands of instances of one shape
		// draw cheaply together, while mixed with others the driver pays for each one. Shapes used a
		// few times share their look's batch, so one-off shapes cost no draw of their own (ADR-0092).
		for (const [key, list] of [...byKey]) {
			const counts = new Map<string, number>();
			const shapeOf = list.originals.map((original) => geometryKey(original.geometry));
			for (const shape of shapeOf) {
				counts.set(shape, (counts.get(shape) ?? 0) + 1);
			}
			const common = new Set(
				[...counts].filter(([, n]) => n >= OWN_BATCH_FROM).map(([shape]) => shape),
			);
			if (common.size === 0) {
				continue;
			}
			byKey.delete(key);
			list.originals.forEach((original, i) => {
				const shape = shapeOf[i];
				const split = common.has(shape) ? `${key}@${shape}` : key;
				const into = byKey.get(split) ?? { originals: [], roots: [] };
				into.originals.push(original);
				into.roots.push(list.roots[i]);
				byKey.set(split, into);
			});
		}
		// A look only one mesh has is drawn as it is, on the drawn layer.
		const batched = new Set<THREE.Object3D>();
		for (const [key, { originals }] of byKey) {
			const together = originals.length >= SHARED_BY_AT_LEAST;
			for (const original of originals) {
				original.layers.set(together ? INSTANCED_ORIGINALS_LAYER : 0);
				if (together) {
					batched.add(original);
				}
			}
			if (!together) {
				byKey.delete(key);
			}
		}
		// A part whose every piece is batched hides its own group, so the renderer doesn't walk it
		// each frame for nothing (its meshes still take clicks: the raycaster doesn't look at visible).
		for (const root of instancing.roots.values()) {
			const away =
				root.renderables === root.shared.length &&
				root.shared.every(({ mesh }) => batched.has(mesh));
			if (away !== root.batchedAway) {
				root.batchedAway = away;
				root.group.userData.batchedAway = away;
				root.group.visible = !away;
			}
		}
		for (const [key, batch] of batches) {
			if (!byKey.has(key)) {
				container.remove(batch.mesh);
				disposeBatch(batch);
				batches.delete(key);
			}
		}
		for (const [key, { originals, roots }] of byKey) {
			let batch = batches.get(key);
			if (!batch) {
				batch = makeBatch(originals[0]);
				batches.set(key, batch);
				container.add(batch.mesh);
			}
			if (holds(batch, originals)) {
				batch.roots = roots;
				touch(batch, rendered);
			} else {
				fit(batch, originals, roots);
			}
		}
		slots.clear();
		for (const batch of batches.values()) {
			for (const original of batch.originals) {
				slots.set(original, batch);
			}
		}
	};

	useFrame(() => {
		frame.id += 1;
		if (instancing.changed) {
			rebuild();
		}
	});

	return <primitive object={container} />;
};
