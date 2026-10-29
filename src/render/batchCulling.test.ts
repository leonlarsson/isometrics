import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
	canDrawInstanced,
	cullBatch,
	makeBatchCulling,
	placeBounds,
	startPlacing,
} from "./batchCulling";

/** The draw list the renderer reads from a batch. */
interface IDrawList {
	_multiDrawStarts: Int32Array;
	_multiDrawCounts: Int32Array;
	_multiDrawCount: number;
	_indirectTexture: THREE.DataTexture;
}

/** A batch of boxes, one per x along the ground, each with an original where it stands. */
const batchOfBoxes = (xs: number[]) => {
	const box = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshStandardMaterial();
	const mesh = new THREE.BatchedMesh(xs.length, 1000, 1000, material);
	mesh.perObjectFrustumCulled = true;
	const shape = mesh.addGeometry(box);
	const culling = makeBatchCulling();
	const originals = xs.map((x) => {
		const original = new THREE.Mesh(box, material);
		original.position.set(x, 0, 0);
		original.updateMatrixWorld();
		return original;
	});
	const ids = originals.map(() => mesh.addInstance(shape));
	/** Places these instances (all of them by default), as InstancedParts does before a pass. */
	const place = (which: number[] = ids, all = which === ids) => {
		startPlacing(culling, all);
		for (const i of which) {
			mesh.setMatrixAt(ids[i], originals[i].matrixWorld);
			placeBounds(culling, ids[i], originals[i]);
		}
	};
	const list = () => mesh as unknown as IDrawList;
	/** The instances a camera draws, in draw order (a draw each, unless `instanced`). */
	const drawn = (camera: THREE.Camera, instanced = false) => {
		cullBatch(mesh, culling, camera, mesh.geometry, material, instanced);
		const { _multiDrawCount, _indirectTexture } = list();
		return [...(_indirectTexture.image.data as Uint32Array).slice(0, _multiDrawCount)];
	};
	return { mesh, culling, originals, ids, place, drawn, list };
};

/** A camera looking down on the ground round x, seeing 10 units across. */
const cameraOver = (x: number) => {
	const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
	camera.position.set(x, 20, 0);
	camera.lookAt(x, 0, 0);
	camera.updateMatrixWorld();
	return camera;
};

describe("culling a batch's instances (ADR-0092)", () => {
	it("draws the instances in a camera's view, and each camera has its own list", () => {
		const { ids, place, drawn } = batchOfBoxes([0, 3, 20, 40]);
		place();
		expect(drawn(cameraOver(0))).toEqual([ids[0], ids[1]]);
		expect(drawn(cameraOver(20))).toEqual([ids[2]]);
		expect(drawn(cameraOver(-50))).toEqual([]);
	});

	it("keeps a camera's list while neither it nor the batch changes, without uploading it again", () => {
		const { ids, place, drawn, list } = batchOfBoxes([0, 3, 20]);
		const view = cameraOver(0);
		const shadows = cameraOver(20);
		place();
		drawn(shadows);
		drawn(view);
		const viewList = list()._indirectTexture;
		const uploads = viewList.version;
		// The next frames: nothing placed, the same cameras.
		expect(drawn(view)).toEqual([ids[0], ids[1]]);
		expect(drawn(shadows)).toEqual([ids[2]]);
		expect(drawn(view)).toEqual([ids[0], ids[1]]);
		expect(list()._indirectTexture).toBe(viewList);
		expect(viewList.version).toBe(uploads);
	});

	it("tests again only what was placed, and changes the list when one leaves or enters the view", () => {
		const { originals, ids, place, drawn, list } = batchOfBoxes([0, 3, 20]);
		const view = cameraOver(0);
		place();
		drawn(view);
		const uploads = list()._indirectTexture.version;
		// Moving within the view: the same list.
		originals[1].position.x = 2;
		originals[1].updateMatrixWorld();
		place([1]);
		expect(drawn(view)).toEqual([ids[0], ids[1]]);
		expect(list()._indirectTexture.version).toBe(uploads);
		// Out of it, and another one in.
		originals[1].position.x = 30;
		originals[1].updateMatrixWorld();
		originals[2].position.x = -2;
		originals[2].updateMatrixWorld();
		place([1, 2]);
		expect(drawn(view)).toEqual([ids[0], ids[2]]);
		expect(list()._indirectTexture.version).toBeGreaterThan(uploads);
	});

	it("follows a camera that moves, and leaves out hidden instances", () => {
		const { mesh, ids, place, drawn } = batchOfBoxes([0, 20]);
		const camera = cameraOver(0);
		place();
		expect(drawn(camera)).toEqual([ids[0]]);
		camera.position.x = 20;
		camera.updateMatrixWorld();
		expect(drawn(camera)).toEqual([ids[1]]);
		mesh.setVisibleAt(ids[1], false);
		place([1]);
		expect(drawn(camera)).toEqual([]);
	});

	it("draws every shown instance when it isn't culling one by one", () => {
		const { mesh, ids, place, drawn } = batchOfBoxes([0, 20, 40]);
		mesh.perObjectFrustumCulled = false;
		place();
		expect(drawn(cameraOver(0))).toEqual(ids);
	});

	it("draws each instance's own shape, as three's own culling does", () => {
		const { mesh, ids, place, list, drawn } = batchOfBoxes([0, 3]);
		const plane = mesh.addGeometry(new THREE.PlaneGeometry(1, 1));
		mesh.setGeometryIdAt(ids[1], plane);
		place();
		drawn(cameraOver(0));
		const ranges = (mesh as unknown as { _geometryInfo: { start: number; count: number }[] })
			._geometryInfo;
		const bytes = mesh.geometry.getIndex()?.array.BYTES_PER_ELEMENT ?? 1;
		const { _multiDrawStarts, _multiDrawCounts } = list();
		expect([..._multiDrawStarts.slice(0, 2)]).toEqual([
			ranges[0].start * bytes,
			ranges[plane].start * bytes,
		]);
		expect([..._multiDrawCounts.slice(0, 2)]).toEqual([ranges[0].count, ranges[plane].count]);
	});

	it("draws a list of one shape as one draw of it, as many times as there are instances", () => {
		const { ids, place, drawn, list } = batchOfBoxes([0, 3, 20]);
		const camera = cameraOver(0);
		place();
		// Every instance it draws is in the list, in the one draw of their shape.
		expect(drawn(camera, true)).toEqual([ids[0]]);
		const { _indirectTexture, _multiDrawCounts } = list();
		expect([...(_indirectTexture.image.data as Uint32Array).slice(0, 2)]).toEqual([ids[0], ids[1]]);
		// A box: 36 indices.
		expect(_multiDrawCounts[0]).toBe(36);

		// The renderer's multi-draw of that list draws it as instances; other lists as they are.
		const calls: string[] = [];
		const multiDraw: Record<string, (...args: unknown[]) => void> = {
			multiDrawElementsWEBGL: () => calls.push("each"),
			multiDrawElementsInstancedWEBGL: (...args) =>
				calls.push(`instanced ${[...(args[6] as Int32Array)]}`),
			multiDrawArraysWEBGL: () => calls.push("each"),
			multiDrawArraysInstancedWEBGL: () => calls.push("instanced"),
		};
		const renderer = {
			getContext: () => ({ getExtension: () => multiDraw }),
		} as unknown as THREE.WebGLRenderer;
		expect(canDrawInstanced(renderer)).toBe(true);
		drawn(camera, true);
		const draw = (counts: Int32Array) =>
			multiDraw.multiDrawElementsWEBGL(4, counts, 0, 5123, list()._multiDrawStarts, 0, 1);
		draw(list()._multiDrawCounts);
		draw(new Int32Array(1));
		expect(calls).toEqual(["instanced 2", "each"]);
	});

	it("draws a list of several shapes a draw per instance, even when it may draw instances", () => {
		const { mesh, ids, place, drawn } = batchOfBoxes([0, 3]);
		mesh.setGeometryIdAt(ids[1], mesh.addGeometry(new THREE.PlaneGeometry(1, 1)));
		place();
		expect(drawn(cameraOver(0), true)).toEqual([ids[0], ids[1]]);
	});
});
