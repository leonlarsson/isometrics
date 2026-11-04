import type { IFenceGatePlace, IFenceSpan } from "#/scene/fences";
import type { TFenceGate, TVec2 } from "#/scene/schema";

import type { IFenceBuilder } from "./builder";

/**
 * A swinging gate's leaves (ADR-0133), one builder for every fence style: a
 * frame (top and bottom rails, a stile at each end) filled in the style's way,
 * in the style's colours, hung on the posts at the gate's sides. The posts
 * themselves are the fence's own (its layout puts one at each side of a gate).
 */

/** How a style's gates look: how their leaves are filled, in which of its colours. */
export interface IFenceGateLook<C extends string = string> {
	/**
	 * What fills the frame: boards = upright boards close together (a garden
	 * gate), bars = thin upright bars (iron), rails = a middle rail and a
	 * diagonal brace (a farm gate), mesh = a wire mesh (in a see-through colour).
	 */
	infill: "boards" | "bars" | "rails" | "mesh";
	/** The colour id of the frame. */
	frameColor: C;
	/** The colour id of what fills it. */
	infillColor: C;
	/** How far from the middle of the post at its side a leaf starts: half the post, and a little. */
	leafInset: number;
}

/** How far an open gate has swung, in degrees. */
const OPEN_ANGLE = 80;
/** A leaf's top, as a share of the fence's height, and how far its bottom stays off the ground. */
const LEAF_TOP_SHARE = 0.9;
const LEAF_CLEARANCE = 0.05;
const FRAME = 0.035;

type TGateState = Pick<TFenceGate, "opensToTheLeft" | "hasTwoLeaves"> & { isOpen: boolean };

/** A leaf as a span from its hinge to its free end, along which its pieces are built. */
const leafSpan = (
	hinge: readonly number[],
	direction: TVec2,
	length: number,
	endBase: number,
): IFenceSpan => ({
	from: [hinge[0], hinge[1], hinge[2]],
	to: [hinge[0] + direction[0] * length, endBase, hinge[2] + direction[1] * length],
	length,
	direction,
});

const buildLeaf = (
	builder: IFenceBuilder,
	leaf: IFenceSpan,
	look: IFenceGateLook,
	height: number,
) => {
	const top = Math.max(LEAF_CLEARANCE + 0.1, height * LEAF_TOP_SHARE);
	const bottom = LEAF_CLEARANCE;
	const frame = { color: look.frameColor, thickness: FRAME };
	builder.beam(leaf, { ...frame, bottom: top - FRAME, top });
	builder.beam(leaf, { ...frame, bottom, top: bottom + FRAME });
	const at = (t: number): [number, number, number] => [
		leaf.from[0] + (leaf.to[0] - leaf.from[0]) * t,
		leaf.from[1] + (leaf.to[1] - leaf.from[1]) * t,
		leaf.from[2] + (leaf.to[2] - leaf.from[2]) * t,
	];
	const upright = (t: number, width: number, depth: number, color: string, inset = 0) => {
		const [x, base, z] = at(t);
		builder.block(
			[x, base + (bottom + top) / 2, z],
			leaf.direction,
			[width, top - bottom - inset * 2, depth],
			{ color },
		);
	};
	// The stiles: one at the hinge, one at the free end.
	const stile = Math.min(0.5, FRAME / 2 / leaf.length);
	upright(stile, FRAME, FRAME, look.frameColor);
	upright(1 - stile, FRAME, FRAME, look.frameColor);
	const inner = leaf.length - 2 * FRAME;
	if (inner <= 0.02) {
		return;
	}
	const placesInside = (every: number) => {
		const count = Math.max(1, Math.round(inner / every));
		return Array.from(
			{ length: count },
			(_, i) => (FRAME + ((i + 0.5) / count) * inner) / leaf.length,
		);
	};
	if (look.infill === "boards") {
		for (const t of placesInside(0.085)) {
			upright(t, 0.06, 0.018, look.infillColor, FRAME * 0.5);
		}
	} else if (look.infill === "bars") {
		for (const t of placesInside(0.09)) {
			upright(t, 0.014, 0.014, look.infillColor, FRAME * 0.5);
		}
	} else if (look.infill === "rails") {
		const middle = (bottom + top) / 2;
		builder.beam(leaf, {
			color: look.infillColor,
			bottom: middle - FRAME / 2,
			top: middle + FRAME / 2,
			thickness: FRAME * 0.8,
		});
		// The brace, from the bottom at the hinge up to the top at the free end.
		const [start, end] = [at(0), at(1)];
		builder.beam(
			{
				...leaf,
				from: [start[0], start[1] + bottom, start[2]],
				to: [end[0], end[1] + top - FRAME * 1.5, end[2]],
			},
			{ color: look.infillColor, bottom: 0, top: FRAME, thickness: FRAME * 0.8 },
		);
	} else {
		builder.beam(leaf, {
			color: look.infillColor,
			bottom: bottom + FRAME,
			top: top - FRAME,
			thickness: 0.008,
			trim: FRAME / 2,
		});
	}
};

/** A gate's leaf: where it hangs, the way it lies shut, how long it is, and which way it swings. */
export interface IGateLeaf {
	/** Its hinge, [x, base, z]. */
	hinge: [number, number, number];
	/** The way it runs from its hinge when shut, a unit vector on the ground. */
	shut: TVec2;
	length: number;
	/** Where its free end stands when shut: it follows the ground across. */
	shutEndBase: number;
	/**
	 * Its turn about its hinge when fully open, in radians as three.js turns a
	 * group about its y axis (ADR-0133): what a swinging gate animates.
	 */
	openTurn: number;
}

/**
 * A swinging gate's leaves across its place: one hung on the post at its side
 * nearer the fence's start, or two meeting in the middle, each swinging to the
 * right of the fence's way (to its left if it opens that way). None if the
 * opening is too narrow for one.
 */
export const gateLeavesOf = (
	place: IFenceGatePlace,
	gate: Pick<TFenceGate, "opensToTheLeft" | "hasTwoLeaves">,
	look: IFenceGateLook,
): IGateLeaf[] => {
	const free = place.length - 2 * look.leafInset;
	if (free <= 0.05) {
		return [];
	}
	const [dx, dz] = place.direction;
	// The fence's right, as the builder's offsets have it; the side it swings to.
	const side = gate.opensToTheLeft ? -1 : 1;
	const right: TVec2 = [-dz * side, dx * side];
	const pointAt = (t: number): [number, number, number] => [
		place.from[0] + (place.to[0] - place.from[0]) * t,
		place.from[1] + (place.to[1] - place.from[1]) * t,
		place.from[2] + (place.to[2] - place.from[2]) * t,
	];
	const leaves = gate.hasTwoLeaves
		? [
				{ from: look.leafInset / place.length, way: 1, length: free / 2 - 0.005 },
				{ from: 1 - look.leafInset / place.length, way: -1, length: free / 2 - 0.005 },
			]
		: [{ from: look.leafInset / place.length, way: 1, length: free }];
	const angle = (OPEN_ANGLE * Math.PI) / 180;
	return leaves.map((leaf) => {
		const shut: TVec2 = [dx * leaf.way, dz * leaf.way];
		// three turns +x towards -z about y: towards the right, a turn the other way round.
		const towardsRight = shut[0] * right[1] - shut[1] * right[0];
		return {
			hinge: pointAt(leaf.from),
			shut,
			length: leaf.length,
			shutEndBase: pointAt(leaf.from + (leaf.way * leaf.length) / place.length)[1],
			openTurn: -Math.sign(towardsRight) * angle,
		};
	});
};

/** The way a leaf runs from its hinge, turned `turn` radians from shut as three.js turns about y. */
const turned = (shut: TVec2, turn: number): TVec2 => [
	shut[0] * Math.cos(turn) + shut[1] * Math.sin(turn),
	-shut[0] * Math.sin(turn) + shut[1] * Math.cos(turn),
];

/**
 * A swinging gate's leaves across its place (`gateLeavesOf`): shut, across
 * the opening following the ground, or swung 80° and level with its hinge.
 */
export const buildGateLeaves = (
	builder: IFenceBuilder,
	place: IFenceGatePlace,
	gate: TGateState,
	look: IFenceGateLook,
	height: number,
) => {
	for (const leaf of gateLeavesOf(place, gate, look)) {
		const direction = gate.isOpen ? turned(leaf.shut, leaf.openTurn) : leaf.shut;
		const endBase = gate.isOpen ? leaf.hinge[1] : leaf.shutEndBase;
		buildLeaf(builder, leafSpan(leaf.hinge, direction, leaf.length, endBase), look, height);
	}
};

/**
 * One leaf on its own, round its hinge at the origin, shut and level with its
 * hinge: what a gate swinging open or shut draws, turned about its hinge.
 */
export const buildSwingingLeaf = (
	builder: IFenceBuilder,
	leaf: IGateLeaf,
	look: IFenceGateLook,
	height: number,
) => buildLeaf(builder, leafSpan([0, 0, 0], leaf.shut, leaf.length, 0), look, height);
