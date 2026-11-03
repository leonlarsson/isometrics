import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { type IProfilePoint, solidGeometry, sweptGeometry, wallsProfile } from "./shapeKit";

/** Its volume from its faces: positive only if every face points out. */
const volumeOf = (geometry: THREE.BufferGeometry) => {
	const position = geometry.getAttribute("position");
	const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
	let volume = 0;
	for (let i = 0; i < position.count; i += 3) {
		a.fromBufferAttribute(position, i);
		b.fromBufferAttribute(position, i + 1);
		c.fromBufferAttribute(position, i + 2);
		volume += a.dot(b.clone().cross(c)) / 6;
	}
	return volume;
};

const sizeOf = (geometry: THREE.BufferGeometry) => {
	geometry.computeBoundingBox();
	const box = geometry.boundingBox ?? new THREE.Box3();
	return { size: box.getSize(new THREE.Vector3()), bottom: box.min.y };
};

const solid = (height: number): IProfilePoint[] => [
	{ out: 0, y: 0 },
	{ out: 1, y: 0 },
	{ out: 1, y: height },
	{ out: 0, y: height },
];

describe("swept shapes", () => {
	it("fill exactly their width, depth and height, standing on the ground, whatever their sides", () => {
		for (const sideCount of [3, 4, 5, 6, 8, 16, 33]) {
			const { size, bottom } = sizeOf(
				sweptGeometry({ width: 2, depth: 1.5, profile: solid(0.7), sideCount }),
			);
			expect(size.x).toBeCloseTo(2);
			expect(size.z).toBeCloseTo(1.5);
			expect(size.y).toBeCloseTo(0.7);
			expect(bottom).toBeCloseTo(0);
		}
	});

	it("makes a box of four sides, its faces pointing out", () => {
		const geometry = sweptGeometry({ width: 2, depth: 3, profile: solid(0.5), sideCount: 4 });
		expect(volumeOf(geometry)).toBeCloseTo(3);
	});

	it("leaves the walls of a hollow shape only", () => {
		const geometry = sweptGeometry({
			width: 2,
			depth: 2,
			profile: wallsProfile(1, 0.25),
			sideCount: 4,
		});
		expect(volumeOf(geometry)).toBeCloseTo(4 - 1.5 * 1.5);
	});

	it("closes the cut ends of a shape part of the way round, its faces pointing out", () => {
		const whole = volumeOf(sweptGeometry({ width: 2, depth: 2, profile: solid(1), sideCount: 64 }));
		for (const arcAngle of [45, 90, 180, 270]) {
			const part = volumeOf(
				sweptGeometry({ width: 2, depth: 2, profile: solid(1), sideCount: 64, arcAngle }),
			);
			expect(part / whole).toBeCloseTo(arcAngle / 360, 2);
		}
	});

	it("turns a solid's faces out, whatever order their corners are listed in", () => {
		// The corner wedge: a pyramid with its top over a corner, a third of its box.
		const geometry = solidGeometry(
			[
				[-1, 0, -0.5],
				[1, 0, -0.5],
				[1, 0, 0.5],
				[-1, 0, 0.5],
				[-1, 3, -0.5],
			],
			[
				[0, 1, 2, 3],
				[0, 1, 4],
				[4, 3, 0],
				[1, 2, 4],
				[2, 4, 3],
			],
		);
		expect(volumeOf(geometry)).toBeCloseTo((2 * 1 * 3) / 3);
	});
});
