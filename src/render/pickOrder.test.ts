import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { inPickOrder, PICK_ORDER, pickOrderData, pickOrderOf } from "./pickOrder";

const thing = (order?: number) => {
	const object = new THREE.Object3D();
	if (order !== undefined) {
		object.userData = pickOrderData(order);
	}
	return object;
};

describe("pick order", () => {
	it("is set on a thing or a group it's in, the nearest saying", () => {
		const group = thing(PICK_ORDER.handle);
		const disc = thing();
		const arrow = thing(PICK_ORDER.gizmo);
		group.add(disc, arrow);
		expect(pickOrderOf(disc)).toBe(PICK_ORDER.handle);
		expect(pickOrderOf(arrow)).toBe(PICK_ORDER.gizmo);
		expect(pickOrderOf(thing())).toBe(0);
	});

	it("puts handles before what's nearer, and hidden areas and the ground after what shows", () => {
		const building = thing();
		const handle = thing(PICK_ORDER.handle);
		const district = thing(PICK_ORDER.hiddenArea);
		const park = thing();
		const ground = thing(PICK_ORDER.ground);
		// Nearest first, as three gives them.
		const hits = [building, district, park, handle, ground].map((object) => ({ object }));
		expect(inPickOrder(hits).map((hit) => hit.object)).toEqual([
			handle,
			building,
			park,
			district,
			ground,
		]);
	});
});
