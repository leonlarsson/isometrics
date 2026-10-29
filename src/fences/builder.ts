import * as THREE from "three";

import type { IFencePost, IFenceSpan } from "#/scene/fences";
import type { TVec2 } from "#/scene/schema";

/**
 * Builds a fence's pieces as flat-shaded triangles, merged by colour id
 * (ADR-0103): a fence draws one mesh per colour, however many posts and
 * pickets it has. Every piece is a convex solid, so each face is turned to
 * face away from the piece's middle and is lit right whichever way its corners
 * were listed.
 */

type TPoint = [number, number, number];

/** A point at a height above a spot on the ground. */
const at = (x: number, y: number, z: number): TPoint => [x, y, z];

/** Across the fence: the fence's way turned a quarter, on the ground. */
const across = ([dx, dz]: readonly number[]): [number, number] => [-dz, dx];

export interface IFenceBuilder {
	/**
	 * A post from the lower of the fence's bases there up to `height` above the
	 * higher one, square (turned with the fence) or round, with a pointed cap if
	 * `cap` is given (its height).
	 */
	post: (
		post: IFencePost,
		options: {
			color: string;
			width: number;
			/** Across the fence; `width` if left out. */
			depth?: number;
			height: number;
			round?: boolean;
			cap?: number;
			/** How far below the fence's bottom it starts (into the ground). */
			sink?: number;
		},
	) => void;
	/**
	 * A beam along a span from `bottom` to `top` above its base at both ends, so
	 * it follows the slope: rails, walls, a hedge's body, a chain-link mesh.
	 */
	beam: (
		span: IFenceSpan,
		options: {
			color: string;
			bottom: number;
			top: number;
			thickness: number;
			/** Sideways from the line (+ = to the right of the fence's way). */
			offset?: number;
			/** Longer by this much at each end (rails into posts, a wall's stones meeting at corners). */
			extend?: number;
			/** Shorter by this much at each end. */
			trim?: number;
		},
	) => void;
	/**
	 * A flat shape standing in the fence's plane at a point, `thickness` thick:
	 * `outline` is [along, up] corners of a convex shape, from the base there.
	 */
	profile: (
		point: TPoint,
		direction: readonly number[],
		outline: readonly (readonly [number, number])[],
		options: { color: string; thickness: number; offset?: number },
	) => void;
	/** A box with its middle at `center`, turned with the fence: `size` is [along, up, across]. */
	block: (
		center: TPoint,
		direction: readonly number[],
		size: readonly [number, number, number],
		options: { color: string },
	) => void;
	/** A low-poly lump (a stretched icosahedron), for a hedge's leafy top. */
	lump: (
		center: TPoint,
		radii: readonly [number, number, number],
		options: { color: string },
	) => void;
	/** The pieces so far as one geometry per colour id. */
	geometries: () => Map<string, THREE.BufferGeometry>;
}

/** A point on a span: `t` from 0 at its start to 1 at its end, at its base there. */
export const pointOnSpan = (span: IFenceSpan, t: number): TPoint => [
	span.from[0] + (span.to[0] - span.from[0]) * t,
	span.from[1] + (span.to[1] - span.from[1]) * t,
	span.from[2] + (span.to[2] - span.from[2]) * t,
];

/**
 * Evenly spaced places along a span, about `every` apart and never closer to
 * its ends than half that (pickets, balusters), as `t` from 0 to 1.
 */
export const placesAlong = (span: IFenceSpan, every: number, clearOfEnds = 0) => {
	const free = span.length - 2 * clearOfEnds;
	if (free <= 0) {
		return [];
	}
	const count = Math.max(1, Math.round(free / every));
	return Array.from(
		{ length: count },
		(_, i) => (clearOfEnds + ((i + 0.5) / count) * free) / span.length,
	);
};

/** A repeatable random number from 0 to 1 for a place, so a fence's stones don't shuffle when redrawn. */
export const randomAt = (x: number, z: number, salt = 0) => {
	const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
	return n - Math.floor(n);
};

const LUMP = new THREE.IcosahedronGeometry(1, 0).getAttribute("position");

export const createFenceBuilder = (): IFenceBuilder => {
	const triangles = new Map<string, number[]>();

	const listFor = (color: string) => {
		let list = triangles.get(color);
		if (!list) {
			list = [];
			triangles.set(color, list);
		}
		return list;
	};

	/** A triangle, turned so its face looks away from `middle`. */
	const triangle = (list: number[], a: TPoint, b: TPoint, c: TPoint, middle: TPoint) => {
		const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const [vx, vy, vz] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		const normal = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
		const centre = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
		const out =
			normal[0] * (centre[0] - middle[0]) +
			normal[1] * (centre[1] - middle[1]) +
			normal[2] * (centre[2] - middle[2]);
		if (out >= 0) {
			list.push(...a, ...b, ...c);
		} else {
			list.push(...a, ...c, ...b);
		}
	};

	const middleOf = (points: readonly TPoint[]): TPoint => {
		const sum = points.reduce<TPoint>((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
		return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
	};

	/** A solid between two rings of the same number of corners (each a convex polygon). */
	const solid = (color: string, ringA: readonly TPoint[], ringB: readonly TPoint[]) => {
		const list = listFor(color);
		const middle = middleOf([...ringA, ...ringB]);
		const n = ringA.length;
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			triangle(list, ringA[i], ringA[j], ringB[j], middle);
			triangle(list, ringA[i], ringB[j], ringB[i], middle);
		}
		for (let i = 1; i < n - 1; i++) {
			triangle(list, ringA[0], ringA[i], ringA[i + 1], middle);
			triangle(list, ringB[0], ringB[i], ringB[i + 1], middle);
		}
	};

	/** A pointed cap: a ring rising to one point. */
	const cone = (color: string, ring: readonly TPoint[], apex: TPoint) => {
		const list = listFor(color);
		const middle = middleOf([...ring, apex]);
		for (let i = 0; i < ring.length; i++) {
			triangle(list, ring[i], ring[(i + 1) % ring.length], apex, middle);
		}
		for (let i = 1; i < ring.length - 1; i++) {
			triangle(list, ring[0], ring[i], ring[i + 1], middle);
		}
	};

	/** The corners of a post's cross-section at a height. */
	const section = (
		post: Pick<IFencePost, "x" | "z" | "direction">,
		halfAlong: number,
		halfAcross: number,
		y: number,
		round: boolean,
	): TPoint[] => {
		const [dx, dz] = post.direction;
		const [nx, nz] = across(post.direction);
		const corners: [number, number][] = round
			? Array.from({ length: 8 }, (_, i) => {
					const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
					return [Math.cos(angle), Math.sin(angle)];
				})
			: [
					[-1, -1],
					[1, -1],
					[1, 1],
					[-1, 1],
				];
		return corners.map(([u, v]) =>
			at(
				post.x + dx * u * halfAlong + nx * v * halfAcross,
				y,
				post.z + dz * u * halfAlong + nz * v * halfAcross,
			),
		);
	};

	return {
		post: (post, { color, width, depth = width, height, round = false, cap, sink = 0.05 }) => {
			const bottom = Math.min(post.baseBefore, post.baseAfter) - sink;
			const top = Math.max(post.baseBefore, post.baseAfter) + height;
			const ring = (y: number) => section(post, width / 2, depth / 2, y, round);
			solid(color, ring(bottom), ring(top));
			if (cap) {
				cone(color, ring(top), at(post.x, top + cap, post.z));
			}
		},

		beam: (span, { color, bottom, top, thickness, offset = 0, extend = 0, trim = 0 }) => {
			const [dx, dz] = span.direction;
			const [nx, nz] = across(span.direction);
			const grow = extend - trim;
			if (span.length + 2 * grow <= 1e-4) {
				return;
			}
			const end = (point: readonly number[], sign: number, side: number, y: number) =>
				at(
					point[0] + dx * grow * sign + nx * (offset + (side * thickness) / 2),
					point[1] + y,
					point[2] + dz * grow * sign + nz * (offset + (side * thickness) / 2),
				);
			// Each ring is the beam's end: its four corners.
			const ringOf = (point: readonly number[], sign: number) => [
				end(point, sign, -1, bottom),
				end(point, sign, 1, bottom),
				end(point, sign, 1, top),
				end(point, sign, -1, top),
			];
			solid(color, ringOf(span.from, -1), ringOf(span.to, 1));
		},

		profile: (point, direction, outline, { color, thickness, offset = 0 }) => {
			const [dx, dz] = direction;
			const [nx, nz] = across(direction);
			const face = (side: number) =>
				outline.map(([u, v]) =>
					at(
						point[0] + dx * u + nx * (offset + (side * thickness) / 2),
						point[1] + v,
						point[2] + dz * u + nz * (offset + (side * thickness) / 2),
					),
				);
			solid(color, face(-1), face(1));
		},

		block: (center, direction, [along, up, wide], { color }) => {
			const spot = { x: center[0], z: center[2], direction: [direction[0], direction[1]] as TVec2 };
			const ring = (y: number) => section(spot, along / 2, wide / 2, y, false);
			solid(color, ring(center[1] - up / 2), ring(center[1] + up / 2));
		},

		lump: (center, [rx, ry, rz], { color }) => {
			const list = listFor(color);
			for (let i = 0; i < LUMP.count; i += 3) {
				const corner = (k: number): TPoint =>
					at(
						center[0] + LUMP.getX(i + k) * rx,
						center[1] + LUMP.getY(i + k) * ry,
						center[2] + LUMP.getZ(i + k) * rz,
					);
				triangle(list, corner(0), corner(1), corner(2), center);
			}
		},

		geometries: () => {
			const out = new Map<string, THREE.BufferGeometry>();
			for (const [color, positions] of triangles) {
				if (positions.length === 0) {
					continue;
				}
				const geometry = new THREE.BufferGeometry();
				geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
				geometry.computeVertexNormals();
				geometry.computeBoundingSphere();
				out.set(color, geometry);
			}
			return out;
		},
	};
};
