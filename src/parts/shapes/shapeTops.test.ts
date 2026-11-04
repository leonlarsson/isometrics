import { describe, expect, it } from "vitest";

import { PARTS, resolveProps } from "../registry";

import {
	ballTop,
	boxTop,
	coneTop,
	cornerWedgeTop,
	cylinderTop,
	domeTop,
	isWithinArc,
	pyramidTop,
	ringTop,
	stairsTop,
	wedgeTop,
} from "./shapeTops";

const size = { width: 2, depth: 1, height: 1.5 };

describe("the shapes' tops (ADR-0138)", () => {
	it("a box is flat over its footprint, and only its walls when it's hollow", () => {
		const box = { ...size, isHollow: false, wallThickness: 0.1 };
		expect(boxTop(box, 0, 0)).toBe(1.5);
		expect(boxTop(box, 1, 0.5)).toBe(1.5);
		expect(boxTop(box, 1.01, 0)).toBeNull();
		const hollow = { ...box, isHollow: true };
		expect(boxTop(hollow, 0, 0)).toBeNull();
		expect(boxTop(hollow, 0.95, 0)).toBe(1.5);
	});

	it("round shapes stand within their outline and their arc", () => {
		const cylinder = { ...size, isHollow: false, wallThickness: 0.1, arcAngle: 360 };
		expect(cylinderTop(cylinder, 0, 0)).toBe(1.5);
		expect(cylinderTop(cylinder, 0.9, 0)).toBe(1.5);
		// The footprint's corner is outside the oval.
		expect(cylinderTop(cylinder, 0.95, 0.45)).toBeNull();
		expect(cylinderTop({ ...cylinder, isHollow: true }, 0, 0)).toBeNull();
		expect(cylinderTop({ ...cylinder, isHollow: true }, 0.95, 0)).toBe(1.5);
		// A quarter goes from the back (−Z) round to +X.
		expect(isWithinArc(90, 0.3, -0.3)).toBe(true);
		expect(isWithinArc(90, -0.3, -0.3)).toBe(false);
		expect(isWithinArc(90, 0.3, 0.3)).toBe(false);
		expect(cylinderTop({ ...cylinder, arcAngle: 90 }, -0.3, 0.2)).toBeNull();
	});

	it("cones and pyramids rise to their point, or to their flat top", () => {
		const cone = { ...size, topWidthShare: 0, isHollow: false, arcAngle: 360 };
		expect(coneTop(cone, 0, 0)).toBe(1.5);
		expect(coneTop(cone, 0.5, 0)).toBeCloseTo(0.75);
		expect(coneTop({ ...cone, topWidthShare: 0.5 }, 0.4, 0)).toBe(1.5);
		expect(coneTop({ ...cone, topWidthShare: 0.5, isHollow: true }, 0.4, 0)).toBeNull();
		const pyramid = { ...size, topWidthShare: 0 };
		expect(pyramidTop(pyramid, 0, 0)).toBe(1.5);
		// Its corners reach the footprint's: down to the ground there.
		expect(pyramidTop(pyramid, 1, 0.5)).toBeCloseTo(0);
		expect(pyramidTop(pyramid, 0.5, 0.1)).toBeCloseTo(0.75);
	});

	it("balls, domes and rings are highest along their middles", () => {
		expect(ballTop(size, 0, 0)).toBe(1.5);
		expect(ballTop(size, 1, 0)).toBeCloseTo(0.75);
		const dome = { ...size, arcAngle: 360 };
		expect(domeTop(dome, 0, 0)).toBe(1.5);
		expect(domeTop(dome, 1, 0)).toBeCloseTo(0);
		const ring = { width: 2, depth: 2, height: 0.5, ringThickness: 0.5, arcAngle: 360 };
		// Its band's middle is a quarter in from its edge.
		expect(ringTop(ring, 0.75, 0)).toBeCloseTo(0.5);
		expect(ringTop(ring, 0, 0.75)).toBeCloseTo(0.5);
		expect(ringTop(ring, 0, 0)).toBeNull();
		expect(ringTop(ring, 0.4, 0)).toBeNull();
	});

	it("wedges slope to their ridge, corner wedges to their back left, stairs step up", () => {
		const ramp = { ...size, ridgeShare: 1 };
		expect(wedgeTop(ramp, 0, 0.5)).toBeCloseTo(0);
		expect(wedgeTop(ramp, 0, 0)).toBeCloseTo(0.75);
		expect(wedgeTop(ramp, 0, -0.5)).toBeCloseTo(1.5);
		const gable = { ...size, ridgeShare: 0.5 };
		expect(wedgeTop(gable, 0, 0)).toBeCloseTo(1.5);
		expect(wedgeTop(gable, 0, -0.25)).toBeCloseTo(0.75);
		expect(cornerWedgeTop(size, -1, -0.5)).toBeCloseTo(1.5);
		expect(cornerWedgeTop(size, 1, -0.5)).toBeCloseTo(0);
		expect(cornerWedgeTop(size, 0, 0)).toBeCloseTo(0.75);
		const stairs = { ...size, stepCount: 3 };
		expect(stairsTop(stairs, 0, 0.45)).toBeCloseTo(0.5);
		expect(stairsTop(stairs, 0, 0)).toBeCloseTo(1);
		expect(stairsTop(stairs, 0, -0.45)).toBeCloseTo(1.5);
	});

	it("never stand higher than their part's height, nor outside their footprint", () => {
		const standable = PARTS.filter((part) => part.topHeightAt);
		expect(standable.map((part) => part.kind)).toContain("box_01");
		for (const part of standable) {
			const props = resolveProps(part, {});
			const [width, depth] = part.footprint(props);
			const height = part.height(props);
			for (let i = -6; i <= 6; i++) {
				for (let j = -6; j <= 6; j++) {
					const x = (i / 5) * (width / 2);
					const z = (j / 5) * (depth / 2);
					const top = part.topHeightAt?.(props, x, z) ?? null;
					if (Math.abs(i) > 5 || Math.abs(j) > 5) {
						expect(top, `${part.kind} outside its footprint`).toBeNull();
					} else if (top !== null) {
						expect(top, part.kind).toBeGreaterThanOrEqual(0);
						expect(top, part.kind).toBeLessThanOrEqual(height + 1e-9);
					}
				}
			}
		}
	});
});
