import * as THREE from "three";

import { keepOnHotReload } from "#/lib/hot";

/**
 * Leaving out a batch's instances outside a pass's camera, in place of
 * BatchedMesh's own culling (ADR-0092, PERFORMANCE.md). three works out every
 * instance's bounds from its matrix, tests them, and writes and uploads the
 * batch's draw list, for every pass (shadows, reflections, the view) of every
 * frame: in a painted world of thousands of objects that was most of the
 * frame. Here an instance's bounds are worked out when it's placed, and each
 * camera keeps the draw list it had: drawn again as it is while neither the
 * camera nor the batch changed, and when only some instances moved, only
 * those are tested again.
 *
 * And when every instance a camera draws has the same shape (grass, logs, a
 * kind of tree: a shape's own batch), the list is one draw of that shape, as
 * many times over: three draws a batch as one draw per instance (WebGL's
 * multi-draw, which browsers on Windows carry out a draw at a time), so tens
 * of thousands of them a frame in a painted world kept the GPU busy.
 */

/** BatchedMesh's own fields this reads and writes (three r186). */
interface IBatchedInternals {
	_instanceInfo: { visible: boolean; active: boolean; geometryIndex: number }[];
	_geometryInfo: { start: number; count: number }[];
	_multiDrawStarts: Int32Array;
	_multiDrawCounts: Int32Array;
	_multiDrawCount: number;
	_multiDrawBytesPerElement: number;
	_indirectTexture: THREE.DataTexture;
	_visibilityChanged: boolean;
}

/** What a batch drew for one camera: which instances, and the draw list made of them. */
interface ICameraDraws {
	/** The camera's projection and view (with the batch's own place) it was made for. */
	frustumOf: THREE.Matrix4;
	/** The batch's placing it's up to date with. */
	placing: number;
	bytesPerElement: number;
	wireframe: boolean;
	/** Per instance id: 1 if it's drawn (shown, in use and, when culled one by one, in view). */
	drawn: Uint8Array;
	starts: Int32Array;
	counts: Int32Array;
	count: number;
	/** The drawn instances' ids in draw order, for the shader. */
	ids: THREE.DataTexture;
	/** Whether it may be drawn as instances of one shape (canDrawInstanced). */
	instanced: boolean;
	/** Drawn as one shape, as many times as this holds (or as a draw per instance: null). */
	instanceCounts: Int32Array | null;
	/** When it was last drawn, so cameras no longer used are let go. */
	usedAt: number;
}

export interface IBatchCulling {
	/** Each instance's bounds in the world, by instance id: centre x, y, z and radius. */
	bounds: Float32Array;
	/** Counts the times instances were placed. */
	placing: number;
	/** The instances placed last time, or null when they all were (the batch changed). */
	placedLast: number[] | null;
	cameras: Map<THREE.Camera, ICameraDraws>;
}

/** Cameras a batch keeps draw lists for: the view (both projections), the shadows, reflections, a picture. */
const KEPT_CAMERAS = 8;

export const makeBatchCulling = (): IBatchCulling => ({
	bounds: new Float32Array(0),
	placing: 0,
	placedLast: null,
	cameras: new Map(),
});

/** Instances are about to be placed: all of them (after the batch changed), or some. */
export const startPlacing = (culling: IBatchCulling, all: boolean) => {
	culling.placing += 1;
	culling.placedLast = all ? null : [];
};

const sphere = new THREE.Sphere();

/** An instance was placed where its original is: its bounds there. */
export const placeBounds = (culling: IBatchCulling, id: number, original: THREE.Mesh) => {
	const geometry = original.geometry;
	if (!geometry.boundingSphere) {
		geometry.computeBoundingSphere();
	}
	sphere.copy(geometry.boundingSphere as THREE.Sphere).applyMatrix4(original.matrixWorld);
	if (culling.bounds.length < (id + 1) * 4) {
		const grown = new Float32Array(Math.max(64, (id + 1) * 8));
		grown.set(culling.bounds);
		culling.bounds = grown;
	}
	const at = id * 4;
	culling.bounds[at] = sphere.center.x;
	culling.bounds[at + 1] = sphere.center.y;
	culling.bounds[at + 2] = sphere.center.z;
	culling.bounds[at + 3] = sphere.radius;
	culling.placedLast?.push(id);
};

/** The GPU's copies of the draw lists, let go of when the batch goes away. */
export const disposeBatchCulling = (culling: IBatchCulling) => {
	for (const draws of culling.cameras.values()) {
		draws.ids.dispose();
	}
	culling.cameras.clear();
};

const makeDraws = (capacity: number): ICameraDraws => {
	// Laid out as BatchedMesh lays out its own.
	const size = Math.ceil(Math.sqrt(capacity));
	return {
		frustumOf: new THREE.Matrix4(),
		placing: -1,
		bytesPerElement: 0,
		wireframe: false,
		drawn: new Uint8Array(capacity),
		starts: new Int32Array(capacity),
		counts: new Int32Array(capacity),
		count: 0,
		instanced: false,
		instanceCounts: null,
		ids: new THREE.DataTexture(
			new Uint32Array(size * size),
			size,
			size,
			THREE.RedIntegerFormat,
			THREE.UnsignedIntType,
		),
		usedAt: 0,
	};
};

/** Counts the passes culled, to tell which camera was used longest ago. */
let passes = 0;

/** The draw lists for this camera, made (or made bigger) when needed. */
const drawsFor = (culling: IBatchCulling, camera: THREE.Camera, capacity: number) => {
	passes += 1;
	let draws = culling.cameras.get(camera);
	if (draws && draws.drawn.length >= capacity) {
		draws.usedAt = passes;
		return draws;
	}
	draws?.ids.dispose();
	draws = makeDraws(capacity);
	draws.usedAt = passes;
	culling.cameras.set(camera, draws);
	if (culling.cameras.size > KEPT_CAMERAS) {
		const [unused] = [...culling.cameras].sort(([, a], [, b]) => a.usedAt - b.usedAt)[0];
		culling.cameras.get(unused)?.ids.dispose();
		culling.cameras.delete(unused);
	}
	return draws;
};

const frustum = new THREE.Frustum();
const frustumOf = new THREE.Matrix4();
/** The frustum's six planes, each a normal and a constant. */
const planes = new Float64Array(24);

const setPlanes = (camera: THREE.Camera) => {
	frustum.setFromProjectionMatrix(frustumOf, camera.coordinateSystem, camera.reversedDepth);
	frustum.planes.forEach((plane, i) => {
		planes[i * 4] = plane.normal.x;
		planes[i * 4 + 1] = plane.normal.y;
		planes[i * 4 + 2] = plane.normal.z;
		planes[i * 4 + 3] = plane.constant;
	});
};

/** Whether bounds (at `at` in the list) are at least partly inside the frustum's planes. */
const inView = (bounds: Float32Array, at: number) => {
	const x = bounds[at];
	const y = bounds[at + 1];
	const z = bounds[at + 2];
	const outside = -bounds[at + 3];
	for (let p = 0; p < 24; p += 4) {
		if (planes[p] * x + planes[p + 1] * y + planes[p + 2] * z + planes[p + 3] < outside) {
			return false;
		}
	}
	return true;
};

/**
 * three's shaders find a batched instance by the draw it's in (`gl_DrawID`). By the draw and the
 * instance within it, they find it in a list drawn as one shape many times too, and in every other
 * list as before: a draw of one instance is instance 0.
 */
const BY_DRAW = /getIndirectIndex\( gl_DrawID \)/g;
const BY_DRAW_AND_INSTANCE = "getIndirectIndex( gl_DrawID + gl_InstanceID )";
// The chunk that places a batched instance isn't in three's types.
const chunks = THREE.ShaderChunk as Record<string, string>;
for (const chunk of ["batching_vertex", "color_vertex"]) {
	chunks[chunk] = chunks[chunk].replace(BY_DRAW, BY_DRAW_AND_INSTANCE);
}

/** WEBGL_multi_draw's functions this uses. */
interface IMultiDraw {
	multiDrawElementsWEBGL: (
		...args: [number, Int32Array, number, number, Int32Array, number, number]
	) => void;
	multiDrawElementsInstancedWEBGL: (
		...args: [number, Int32Array, number, number, Int32Array, number, Int32Array, number, number]
	) => void;
	multiDrawArraysWEBGL: (...args: [number, Int32Array, number, Int32Array, number, number]) => void;
	multiDrawArraysInstancedWEBGL: (
		...args: [number, Int32Array, number, Int32Array, number, Int32Array, number, number]
	) => void;
}

/** The list drawn next, when it's one shape drawn many times: its counts, and how many times. */
const drawnNext = keepOnHotReload(
	"batchCulling.drawnNext",
	(): { counts: Int32Array | null; instanceCounts: Int32Array | null } => ({
		counts: null,
		instanceCounts: null,
	}),
);

/** Whether each WebGL context draws lists of one shape as instances (its multi-draws taught once). */
const drawsInstanced = keepOnHotReload(
	"batchCulling.drawsInstanced",
	() => new WeakMap<WebGL2RenderingContext, boolean>(),
);

/**
 * Whether this renderer can draw a list of one shape as instances: it draws batches with
 * WEBGL_multi_draw (without it three draws each instance on its own, and can't). The first time,
 * its multi-draws learn to: three draws a batch's list through them, right after the batch's render
 * hook has said (in `drawnNext`) that this list is one shape, drawn so many times.
 */
export const canDrawInstanced = (renderer: THREE.WebGLRenderer) => {
	const gl = renderer.getContext() as WebGL2RenderingContext;
	const known = drawsInstanced.get(gl);
	if (known !== undefined) {
		return known;
	}
	const multiDraw = gl.getExtension("WEBGL_multi_draw") as IMultiDraw | null;
	drawsInstanced.set(gl, multiDraw !== null);
	if (!multiDraw) {
		return false;
	}
	/** The instance counts for this list, if it's the one the batch said is drawn as instances. */
	const instancesFor = (counts: Int32Array) => {
		const instanceCounts = drawnNext.counts === counts ? drawnNext.instanceCounts : null;
		drawnNext.counts = null;
		drawnNext.instanceCounts = null;
		return instanceCounts;
	};
	const drawElements = multiDraw.multiDrawElementsWEBGL.bind(multiDraw);
	multiDraw.multiDrawElementsWEBGL = (mode, counts, countsAt, type, offsets, offsetsAt, draws) => {
		const instanceCounts = instancesFor(counts);
		if (instanceCounts) {
			multiDraw.multiDrawElementsInstancedWEBGL(
				mode,
				counts,
				countsAt,
				type,
				offsets,
				offsetsAt,
				instanceCounts,
				0,
				draws,
			);
		} else {
			drawElements(mode, counts, countsAt, type, offsets, offsetsAt, draws);
		}
	};
	const drawArrays = multiDraw.multiDrawArraysWEBGL.bind(multiDraw);
	multiDraw.multiDrawArraysWEBGL = (mode, firsts, firstsAt, counts, countsAt, draws) => {
		const instanceCounts = instancesFor(counts);
		if (instanceCounts) {
			multiDraw.multiDrawArraysInstancedWEBGL(
				mode,
				firsts,
				firstsAt,
				counts,
				countsAt,
				instanceCounts,
				0,
				draws,
			);
		} else {
			drawArrays(mode, firsts, firstsAt, counts, countsAt, draws);
		}
	};
	return true;
};

/**
 * Before a pass draws the batch: the draw list for its camera, kept or brought up to date, put in
 * the batch's place for the renderer. Instances are culled one by one when the batch says so
 * (`perObjectFrustumCulled`); otherwise all that are shown are drawn. When `instanced`, a list of
 * one shape is drawn as instances of it (canDrawInstanced).
 */
export const cullBatch = (
	mesh: THREE.BatchedMesh,
	culling: IBatchCulling,
	camera: THREE.Camera,
	geometry: THREE.BufferGeometry,
	material: THREE.Material,
	instanced: boolean,
) => {
	const batch = mesh as unknown as IBatchedInternals;
	const instances = batch._instanceInfo;
	const draws = drawsFor(culling, camera, mesh.maxInstanceCount);
	// As three does: wireframe draws lines, twice the elements, from an index of its own.
	const wireframe = (material as THREE.MeshBasicMaterial).wireframe === true;
	const index = geometry.getIndex();
	const bytesPerElement = wireframe
		? geometry.getAttribute("position").count > 65535
			? 4
			: 2
		: index
			? index.array.BYTES_PER_ELEMENT
			: 1;
	const oneByOne = mesh.perObjectFrustumCulled && !(camera as THREE.ArrayCamera).isArrayCamera;
	frustumOf
		.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
		.multiply(mesh.matrixWorld);

	const upToDate = draws.placing === culling.placing;
	const oneBehind = draws.placing === culling.placing - 1 && culling.placedLast !== null;
	// Shapes moved within the batch, or the list is drawn differently: made again in any case.
	let changed =
		!(upToDate || oneBehind) ||
		draws.bytesPerElement !== bytesPerElement ||
		draws.wireframe !== wireframe ||
		draws.instanced !== instanced;
	const sameView = !oneByOne || draws.frustumOf.equals(frustumOf);
	const test = (id: number) => {
		const info = instances[id];
		const now =
			info.visible && info.active && (!oneByOne || inView(culling.bounds, id * 4)) ? 1 : 0;
		if (draws.drawn[id] !== now) {
			draws.drawn[id] = now;
			changed = true;
		}
	};
	if (oneByOne && (!sameView || changed || !upToDate)) {
		setPlanes(camera);
	}
	if (!sameView || changed) {
		for (let id = 0; id < instances.length; id++) {
			test(id);
		}
	} else if (!upToDate) {
		for (const id of culling.placedLast ?? []) {
			test(id);
		}
	}
	if (changed) {
		const shapes = batch._geometryInfo;
		const ids = draws.ids.image.data as Uint32Array;
		const multiplier = wireframe ? 2 : 1;
		let drawn = 0;
		let oneShape = -1;
		for (let id = 0; id < instances.length; id++) {
			if (draws.drawn[id]) {
				const shape = instances[id].geometryIndex;
				oneShape = drawn === 0 || shape === oneShape ? shape : -2;
				const range = shapes[shape];
				draws.starts[drawn] = range.start * bytesPerElement * multiplier;
				draws.counts[drawn] = range.count * multiplier;
				ids[drawn] = id;
				drawn += 1;
			}
		}
		// One shape: its range, drawn once per instance in the list (the ids stay as they are).
		draws.instanceCounts = instanced && oneShape >= 0 ? Int32Array.of(drawn) : null;
		draws.count = draws.instanceCounts ? 1 : drawn;
		draws.ids.needsUpdate = true;
	}
	if (draws.instanceCounts) {
		drawnNext.counts = draws.counts;
		drawnNext.instanceCounts = draws.instanceCounts;
	}
	draws.placing = culling.placing;
	draws.frustumOf.copy(frustumOf);
	draws.bytesPerElement = bytesPerElement;
	draws.wireframe = wireframe;
	draws.instanced = instanced;

	batch._multiDrawStarts = draws.starts;
	batch._multiDrawCounts = draws.counts;
	batch._multiDrawCount = draws.count;
	batch._multiDrawBytesPerElement = bytesPerElement;
	batch._indirectTexture = draws.ids;
	batch._visibilityChanged = false;
};
