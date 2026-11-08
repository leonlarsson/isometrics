import { clamp, round } from "#/lib/math";

import { areaTopAt, isInsidePolygon, isRaised, middleOf } from "./areas";
import { GROUND_SIZE, groundCornersOf, groundOutlineOf, rectangleCorners } from "./groundShape";
import type { TArea, TGround, TScene, TVec2 } from "./schema";
import type { ITop } from "./standing";

/**
 * A world's grounds (ADR-0155): where each is, how high its top is, and what
 * that means for everything else. Things keep their positions in the world;
 * a ground is what's under them. Every question of how high a ground is at a
 * point goes through `groundTopAt`, so terrain shaped later (heights over a
 * ground's top) changes that one answer and what stands on it follows. No
 * React, no three.
 */

/** The world's size: the rectangle centred on 0, 0 round all its grounds (`worldExtentOf`). */
export type TWorldExtent = { width: number; depth: number };

/** What the world-level questions need of a world. */
export type TGroundsWorld = { grounds: readonly TGround[]; keepsThingsOnGround: boolean };

/** A ground's name as shown: its own, else Ground, Ground 2… by its place in the list. */
export const groundName = (ground: Pick<TGround, "name">, index: number) =>
	ground.name || (index === 0 ? "Ground" : `Ground ${index + 1}`);

const outlines = new WeakMap<TGround, TVec2[]>();

/**
 * Its outline in the world as drawn, round it in order: its corners (rounded
 * if asked) moved to its position. The plain rectangle is its four corners.
 */
export const worldOutlineOf = (ground: TGround): TVec2[] => {
	let outline = outlines.get(ground);
	if (!outline) {
		const local = groundOutlineOf(ground) ?? rectangleCorners(ground.width, ground.depth);
		const [px, pz] = ground.position;
		outline = local.map(([x, z]): TVec2 => [x + px, z + pz]);
		outlines.set(ground, outline);
	}
	return outline;
};

/** Its corners in the world (not rounded): where its handles stand. */
export const worldCornersOf = (ground: TGround): TVec2[] =>
	groundCornersOf(ground).map(([x, z]): TVec2 => [x + ground.position[0], z + ground.position[1]]);

/** The box round it in the world. */
export const boxOf = (ground: Pick<TGround, "position" | "width" | "depth">) => ({
	minX: ground.position[0] - ground.width / 2,
	maxX: ground.position[0] + ground.width / 2,
	minZ: ground.position[1] - ground.depth / 2,
	maxZ: ground.position[1] + ground.depth / 2,
});

const extents = new WeakMap<readonly TGround[], TWorldExtent>();

/**
 * The world's size: the rectangle centred on 0, 0 round all its grounds,
 * hidden ones too. What the camera, the grid's reach, the sun's shadows,
 * weather and the editor's limits measure the world by; for one ground at the
 * middle it's that ground's width and depth, as worlds always had. The same
 * object for the same grounds, so it can be selected from the store.
 */
export const worldExtentOf = (grounds: readonly TGround[]) => {
	let extent = extents.get(grounds);
	if (!extent) {
		let x = 0;
		let z = 0;
		for (const ground of grounds) {
			const box = boxOf(ground);
			x = Math.max(x, Math.abs(box.minX), Math.abs(box.maxX));
			z = Math.max(z, Math.abs(box.minZ), Math.abs(box.maxZ));
		}
		extent = {
			width: Math.max(GROUND_SIZE.least, round(x * 2)),
			depth: Math.max(GROUND_SIZE.least, round(z * 2)),
		};
		extents.set(grounds, extent);
	}
	return extent;
};

/** Whether a point in the world is over a ground (inside its outline as drawn). */
export const isOverGround = (ground: TGround, point: TVec2) => {
	const box = boxOf(ground);
	return (
		point[0] >= box.minX &&
		point[0] <= box.maxX &&
		point[1] >= box.minZ &&
		point[1] <= box.maxZ &&
		isInsidePolygon(point, worldOutlineOf(ground))
	);
};

/**
 * How high a ground's top is at a point in the world, or null off it: its
 * altitude today. The one place a ground's height is asked (terrain later).
 */
export const groundTopAt = (ground: TGround, point: TVec2): number | null =>
	isOverGround(ground, point) ? ground.altitude : null;

/**
 * The ground a point is on: of the shown grounds over it, the highest whose
 * top is at or below `altitude` (what a thing that high stands on), else the
 * highest; null over empty space.
 */
export const groundAt = (
	grounds: readonly TGround[],
	point: TVec2,
	altitude = Number.POSITIVE_INFINITY,
): TGround | null => {
	let best: TGround | null = null;
	let bestTop = Number.NEGATIVE_INFINITY;
	let highest: TGround | null = null;
	let highestTop = Number.NEGATIVE_INFINITY;
	for (const ground of grounds) {
		if (ground.isHidden) {
			continue;
		}
		const top = groundTopAt(ground, point);
		if (top === null) {
			continue;
		}
		if (top > highestTop) {
			highest = ground;
			highestTop = top;
		}
		if (top <= altitude + 0.01 && top > bestTop) {
			best = ground;
			bestTop = top;
		}
	}
	return best ?? highest;
};

/** How high the ground is at a point: the top of the ground it's on, else the base level (0). */
export const groundAltitudeAt = (grounds: readonly TGround[], point: TVec2, altitude?: number) => {
	const ground = groundAt(grounds, point, altitude);
	return ground ? (groundTopAt(ground, point) ?? 0) : 0;
};

const groundTops = new WeakMap<TGround, ITop>();

/** A shown ground's top as something things stand on (`scene/standing`). */
const groundTopOf = (ground: TGround): ITop => {
	let top = groundTops.get(ground);
	if (!top) {
		const box = boxOf(ground);
		top = {
			entityId: null,
			...box,
			highestAltitude: ground.altitude,
			altitudeAt: (x, z) => groundTopAt(ground, [x, z]),
		};
		groundTops.set(ground, top);
	}
	return top;
};

const topsOfGrounds = new WeakMap<readonly TGround[], ITop[]>();

/** The tops of a world's shown grounds above the base level, to stand on. */
export const groundTopsOf = (grounds: readonly TGround[]): ITop[] => {
	let tops = topsOfGrounds.get(grounds);
	if (!tops) {
		tops = grounds.filter((ground) => !ground.isHidden && ground.altitude > 0).map(groundTopOf);
		topsOfGrounds.set(grounds, tops);
	}
	return tops;
};

/** Each area's base, kept while the area and the grounds stay the same (asked by every area's view). */
const areaBases = new WeakMap<object, { grounds: readonly TGround[]; base: number }>();

/**
 * Where an area stands: the top of the ground under its middle (0 off every
 * ground). Its own heights (raised land, corner lifts, peaks) are from there.
 */
export const areaBaseOf = (area: Pick<TArea, "points">, grounds: readonly TGround[]) => {
	const known = areaBases.get(area);
	if (known && known.grounds === grounds) {
		return known.base;
	}
	const base = area.points.length >= 3 ? groundAltitudeAt(grounds, middleOf(area.points)) : 0;
	areaBases.set(area, { grounds, base });
	return base;
};

/** What the ground at a point is made of: the grounds, and the areas on them as far as their heights go. */
export type TGroundWorld = {
	grounds: readonly TGround[];
	areas: readonly (Pick<TArea, "points" | "height" | "kind" | "isHidden"> & {
		peaks?: TArea["peaks"];
	})[];
};

/**
 * How high the ground stands at a point (ADR-0155): the top of the ground
 * it's on, raised by the areas there (raised land, slopes, ADR-0096), else
 * the base level (0). What fences and roads stand on; objects also stand on
 * the tops of shapes (`parts/standing`, ADR-0098, ADR-0138).
 */
export const groundHeightAt = (world: TGroundWorld, point: TVec2) => {
	let highest = groundAltitudeAt(world.grounds, point);
	for (const area of world.areas) {
		if (area.isHidden || !isRaised(area)) {
			continue;
		}
		const top = areaTopAt(area, point);
		if (top !== null) {
			highest = Math.max(highest, areaBaseOf(area, world.grounds) + top);
		}
	}
	return round(highest);
};

/** A point kept inside the world's size (where areas, which draw their own ground, may be). */
export const keepInWorld = (world: { grounds: readonly TGround[] }, point: TVec2): TVec2 => {
	const { width, depth } = worldExtentOf(world.grounds);
	return [clamp(point[0], -width / 2, width / 2), clamp(point[1], -depth / 2, depth / 2)];
};

/** The point on a segment nearest to `p`, and how far it is. */
const nearestOnSegment = (p: TVec2, a: TVec2, b: TVec2) => {
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const length2 = dx * dx + dz * dz;
	const t =
		length2 === 0
			? 0
			: Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2));
	const point: TVec2 = [a[0] + dx * t, a[1] + dz * t];
	return { point, distance: Math.hypot(p[0] - point[0], p[1] - point[1]) };
};

/** The nearest point on an outline's edge, and how far it is. */
const nearestEdge = (outline: readonly TVec2[], p: TVec2) => {
	let best = { point: outline[0], distance: Number.POSITIVE_INFINITY };
	for (let i = 0; i < outline.length; i++) {
		const found = nearestOnSegment(p, outline[i], outline[(i + 1) % outline.length]);
		if (found.distance < best.distance) {
			best = found;
		}
	}
	return best;
};

/**
 * Whether a point is on land: over a shown ground, at least `margin` in from
 * its edge. With the world letting things go anywhere (`keepsThingsOnGround`
 * false), anywhere in the world counts.
 */
export const isOnLand = (world: TGroundsWorld, point: TVec2, margin = 0) => {
	if (!world.keepsThingsOnGround) {
		const kept = keepInWorld(world, point);
		return kept[0] === point[0] && kept[1] === point[1];
	}
	return world.grounds.some(
		(ground) =>
			!ground.isHidden &&
			isOverGround(ground, point) &&
			(margin <= 0 || nearestEdge(worldOutlineOf(ground), point).distance >= margin),
	);
};

/**
 * Where a thing put at a point lands (ADR-0155): there, when it's on a shown
 * ground; else the nearest spot just inside the nearest ground's edge, so
 * nothing is left over empty space. With the world letting things go anywhere,
 * or no ground shown, anywhere in the world.
 */
export const keepOnLand = (world: TGroundsWorld, point: TVec2): TVec2 => {
	const shown = world.grounds.filter((ground) => !ground.isHidden);
	if (!world.keepsThingsOnGround || shown.length === 0) {
		return keepInWorld(world, point);
	}
	if (shown.some((ground) => isOverGround(ground, point))) {
		return point;
	}
	let best = { point, distance: Number.POSITIVE_INFINITY, outline: [] as TVec2[] };
	for (const ground of shown) {
		const outline = worldOutlineOf(ground);
		const found = nearestEdge(outline, point);
		if (found.distance < best.distance) {
			best = { ...found, outline };
		}
	}
	// On the edge, then a hair across it to the inside, so it's on the ground for certain.
	const away = [best.point[0] - point[0], best.point[1] - point[1]];
	const length = Math.hypot(away[0], away[1]) || 1;
	const step = 0.05 / length;
	const inside: TVec2 = [best.point[0] + away[0] * step, best.point[1] + away[1] * step];
	return isInsidePolygon(inside, best.outline) ? inside : best.point;
};

/** A new ground's id, unique among these. */
export const newGroundId = (grounds: readonly TGround[]) => {
	const taken = new Set(grounds.map((ground) => ground.id));
	for (let n = grounds.length + 1; ; n++) {
		const id = `ground_${n}`;
		if (!taken.has(id)) {
			return id;
		}
	}
};

/** How far apart a new ground stands from the others. */
const NEW_GROUND_GAP = 6;

/**
 * Where a new ground of this size goes: beside the others (east of them, its
 * middle level with the world's), kept within the largest world; at the middle
 * when it doesn't fit beside them.
 */
export const newGroundPosition = (
	grounds: readonly TGround[],
	width: number,
	depth: number,
): TVec2 => {
	let maxX = Number.NEGATIVE_INFINITY;
	for (const ground of grounds) {
		maxX = Math.max(maxX, boxOf(ground).maxX);
	}
	const x = round(maxX + NEW_GROUND_GAP + width / 2);
	const half = GROUND_SIZE.most / 2;
	return x + width / 2 <= half && depth / 2 <= half ? [x, 0] : [0, 0];
};

/** What stands on a ground (ADR-0155): what moves with it, and goes with it when it's removed. */
export interface IOnGround {
	/** Objects standing on it (not ones driving along a road: they go where their road goes). */
	entityIds: string[];
	/** Areas lying on it (the ground under their middle). */
	areaIds: string[];
	/** Road points on it, and roads wholly on it. */
	roadPoints: { roadId: string; index: number }[];
	wholeRoadIds: string[];
	/** Fence points on it, and fences wholly on it. */
	fencePoints: { fenceId: string; index: number }[];
	wholeFenceIds: string[];
	/** Viewpoints looking at a spot on it. */
	viewpointIds: string[];
}

/**
 * What stands on a ground: each thing on whichever ground it's on (the one
 * under it, at or below its height, `groundAt`), so a thing on an island over
 * another ground is the island's, and a road crossing between two grounds has
 * points on each (a bridge stretches when one of them moves).
 */
export const thingsOnGround = (
	scene: Pick<TScene, "grounds" | "entities" | "areas" | "roads" | "fences" | "viewpoints">,
	groundId: string,
): IOnGround => {
	const isOn = (point: TVec2, altitude?: number) =>
		groundAt(scene.grounds, point, altitude)?.id === groundId;
	const roadPoints: IOnGround["roadPoints"] = [];
	const wholeRoadIds: string[] = [];
	for (const road of scene.roads) {
		let all = road.points.length > 0;
		road.points.forEach((point, index) => {
			if (isOn([point[0], point[1]], point[2] ?? 0)) {
				roadPoints.push({ roadId: road.id, index });
			} else {
				all = false;
			}
		});
		if (all) {
			wholeRoadIds.push(road.id);
		}
	}
	const fencePoints: IOnGround["fencePoints"] = [];
	const wholeFenceIds: string[] = [];
	for (const fence of scene.fences) {
		let all = fence.points.length > 0;
		fence.points.forEach((point, index) => {
			if (isOn([point[0], point[1]])) {
				fencePoints.push({ fenceId: fence.id, index });
			} else {
				all = false;
			}
		});
		if (all) {
			wholeFenceIds.push(fence.id);
		}
	}
	return {
		entityIds: scene.entities
			.filter((entity) => !entity.follow && isOn(entity.position, entity.altitude))
			.map((entity) => entity.id),
		areaIds: scene.areas
			.filter((area) => area.points.length >= 3 && isOn(middleOf(area.points)))
			.map((area) => area.id),
		roadPoints,
		wholeRoadIds,
		fencePoints,
		wholeFenceIds,
		viewpointIds: scene.viewpoints
			.filter((viewpoint) => isOn(viewpoint.target))
			.map((viewpoint) => viewpoint.id),
	};
};

/** How many things stand on a ground, as a person counts them (objects, areas, whole roads and fences). */
export const countOnGround = (on: IOnGround) =>
	on.entityIds.length + on.areaIds.length + on.wholeRoadIds.length + on.wholeFenceIds.length;
