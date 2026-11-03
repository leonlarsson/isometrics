import { createElement, type FC } from "react";
import { z } from "zod";

import { keepOnHotReload } from "#/lib/hot";
import { turnedHalfSize } from "#/lib/math";
import { prefabUsesData } from "#/scene/dataBindings";
import type { TDataValue, TFence, TPrefab } from "#/scene/schema";
import type { ISunPosition } from "#/scene/sun";
import type { IScenePalette } from "#/scene/theme";

import { getBasePart, putWorldPrefabParts, resolveProps, type TAnyPart } from "./registry";
import { definePart } from "./types";

/**
 * Prefabs as parts (ADR-0134): a world's own designs, made of objects and
 * fences, placed as objects whose kind is the design's id. Each design is
 * turned into a part here, so everything that asks a part (selection, the
 * gizmo, placement, footprints, the outliner, label anchors) works with a
 * copy unchanged. The parts layer can't read the store, so the editor hands
 * the open world's designs over whenever they change (`setWorldPrefabs`).
 *
 * Drawing the pieces needs the fences, which sit above the parts (AGENTS:
 * dependencies point downward), so the 3D view gives the drawing to this
 * module (`drawPrefabPiecesWith`, render/PrefabPieces) rather than this
 * module reaching up for it.
 */

/** What draws a prefab's pieces, given by the 3D view (render/PrefabPieces). */
export interface IPrefabPiecesProps {
	prefab: TPrefab;
	palette: IScenePalette;
	playing: boolean;
	/** The copy's data: the world's values and its row's columns; absent in thumbnails. */
	data?: readonly TDataValue[];
	/** The world's hour, for pieces' lights on a schedule. */
	hour?: number | null;
	/** Where the sun is, for pieces that follow it. */
	sun?: ISunPosition;
	/** Called once every piece that builds asynchronously (text) is built. */
	onReady?: () => void;
}

interface IPieceDrawing {
	Pieces: FC<IPrefabPiecesProps> | null;
	/** How tall a fence is (its own height, else its kind's), once the fences are there to say. */
	fenceHeightOf: ((fence: TFence) => number) | null;
}

const drawing = keepOnHotReload(
	"prefabPieceDrawing",
	(): IPieceDrawing => ({ Pieces: null, fenceHeightOf: null }),
);

/** The 3D view's way of drawing pieces, and of measuring fences (render/PrefabPieces gives them). */
export const drawPrefabPiecesWith = (given: {
	Pieces: FC<IPrefabPiecesProps>;
	fenceHeightOf: (fence: TFence) => number;
}) => {
	drawing.Pieces = given.Pieces;
	drawing.fenceHeightOf = given.fenceHeightOf;
};

/** A fence's height while the fences can't say (on the server): about a garden fence's. */
const FENCE_HEIGHT_GUESS = 1.2;
/** How far a fence reaches either side of its line, for the footprint. */
const FENCE_HALF_THICKNESS = 0.2;
/** The smallest footprint side and height, so an empty or flat design can still be picked. */
const SMALLEST = 0.5;

/** A prefab's size: its footprint round its origin (x, z) and its height, at scale 1. */
export interface IPrefabSize {
	footprint: [number, number];
	height: number;
}

/**
 * How big a design is: the box round its pieces' turned footprints, kept centred on its origin
 * (the selection frame is drawn round the origin), and its highest piece's top. Hidden pieces
 * aren't drawn, so they don't count.
 */
export const measurePrefab = (
	prefab: Pick<TPrefab, "entities" | "fences">,
	fenceHeightOf: (fence: TFence) => number = (fence) => fence.height ?? FENCE_HEIGHT_GUESS,
): IPrefabSize => {
	let reachX = 0;
	let reachZ = 0;
	let top = 0;
	for (const piece of prefab.entities) {
		if (piece.isHidden) {
			continue;
		}
		const part = getBasePart(piece.kind);
		const props = part ? resolveProps(part, piece.props) : {};
		const [width, depth] = part ? part.footprint(props) : [1, 1];
		const [halfX, halfZ] = turnedHalfSize(width, depth, piece.rotation[1], piece.scale);
		reachX = Math.max(reachX, Math.abs(piece.position[0]) + halfX);
		reachZ = Math.max(reachZ, Math.abs(piece.position[1]) + halfZ);
		top = Math.max(top, piece.altitude + (part ? part.height(props) : 1) * piece.scale);
	}
	for (const fence of prefab.fences) {
		if (fence.isHidden) {
			continue;
		}
		const height = fenceHeightOf(fence);
		for (const [x, z, lift] of fence.points) {
			reachX = Math.max(reachX, Math.abs(x) + FENCE_HALF_THICKNESS);
			reachZ = Math.max(reachZ, Math.abs(z) + FENCE_HALF_THICKNESS);
			top = Math.max(top, lift + height);
		}
	}
	return {
		footprint: [Math.max(SMALLEST, 2 * reachX), Math.max(SMALLEST, 2 * reachZ)],
		height: Math.max(SMALLEST, top),
	};
};

/** The parts its pieces are, with their props (pieces whose part this version lacks left out). */
const piecePartsOf = (prefab: TPrefab) =>
	prefab.entities.flatMap((piece) => {
		const part = getBasePart(piece.kind);
		return part ? [{ piece, part, props: resolveProps(part, piece.props) }] : [];
	});

/** What a prefab with no name of its own is called. */
export const UNNAMED_PREFAB = "Prefab";

/** Its name, or what a prefab with none is called. */
export const prefabName = (prefab: Pick<TPrefab, "name">) => prefab.name.trim() || UNNAMED_PREFAB;

/** "A prefab of 5 pieces", for one without a description of its own. */
export const describePrefab = (prefab: Pick<TPrefab, "description" | "entities" | "fences">) => {
	if (prefab.description.trim()) {
		return prefab.description.trim();
	}
	const count = prefab.entities.length + prefab.fences.length;
	return `A prefab of ${count} ${count === 1 ? "piece" : "pieces"}`;
};

/** A part made from a design: what every copy of it is drawn and measured by. */
const makePrefabPart = (prefab: TPrefab): TAnyPart => {
	const pieces = piecePartsOf(prefab);
	// Measured exactly once the fences can say how tall they are, roughly before (the server).
	let measured: { size: IPrefabSize; isExact: boolean } | null = null;
	const size = () => {
		const isExact = drawing.fenceHeightOf !== null;
		if (!measured || (isExact && !measured.isExact)) {
			measured = {
				size: measurePrefab(prefab, drawing.fenceHeightOf ?? undefined),
				isExact,
			};
		}
		return measured.size;
	};
	const followsTheSun = pieces.some(({ part, props }) => part.followsTheSun?.(props) ?? false);
	return definePart({
		kind: prefab.id,
		name: prefabName(prefab),
		category: "prefabs",
		description: describePrefab(prefab),
		keywords: ["prefab", "my own"],
		schema: z.object({}),
		fields: [],
		colors: [],
		footprint: () => size().footprint,
		height: () => size().height,
		movesOnItsOwn: pieces.some(({ part }) => part.movesOnItsOwn),
		rendersAsync: pieces.some(({ part }) => part.rendersAsync),
		followsTheSun: () => followsTheSun,
		followsTheHour: prefab.entities.some((piece) =>
			Object.values(piece.lights).some((light) => light.whenOn === "schedule"),
		),
		readsData:
			prefabUsesData(prefab) ||
			pieces.some(({ part }) => part.fields.some((field) => field.type === "dataKey")),
		// biome-ignore lint/correctness/noComponentHookFactories: one per design, made once (prefabPartOf caches it); a changed design is meant to draw afresh
		Component: ({ palette, playing, data, hour, sun, onReady }) => {
			const Pieces = drawing.Pieces;
			return Pieces
				? createElement(Pieces, { prefab, palette, playing, data, hour, sun, onReady })
				: null;
		},
	});
};

/** Each design's part, made once per design (a changed design is a new object, and a new part). */
const partsByDesign = new WeakMap<TPrefab, TAnyPart>();

/** The part a design is drawn and measured as. */
export const prefabPartOf = (prefab: TPrefab): TAnyPart => {
	const known = partsByDesign.get(prefab);
	if (known) {
		return known;
	}
	const part = makePrefabPart(prefab);
	partsByDesign.set(prefab, part);
	return part;
};

/**
 * The part of a kind in a world with these prefabs: one of the registry's, or one of the
 * world's designs. For code that reads a world that isn't the open one (pictures, checks on the
 * server); the open world's are what `getPart` knows.
 */
export const partIn = (kind: string, prefabs: readonly TPrefab[]): TAnyPart | undefined => {
	const part = getBasePart(kind);
	if (part) {
		return part;
	}
	const prefab = prefabs.find((each) => each.id === kind);
	return prefab ? prefabPartOf(prefab) : undefined;
};

/** Make these the open world's prefabs, as `getPart` finds them (the editor calls it when they change). */
export const setWorldPrefabs = (prefabs: readonly TPrefab[]) =>
	putWorldPrefabParts(prefabs.map(prefabPartOf));
