import { getPart, resolveProps } from "#/parts/registry";
import { groundHeightAt } from "#/scene/areas";
import { isHiddenRoute, pointWidth, roadCenterlineOf } from "#/scene/roads";
import type { TEntity, TEntityInput, TScene, TVec2 } from "#/scene/schema";

/**
 * Painting objects (ADR-0091): a brush scatters parts over the ground as it
 * drags, keeping clear of roads and of what's there, and standing them on
 * raised land; an eraser takes away what the brush paints. No React here.
 */

/** A brush's parts: several, picked by weight (a mixed wood), or one. */
export interface IBrushMix {
	id: string;
	name: string;
	/** Part kinds and how often each comes up, relative to the others. */
	kinds: readonly (readonly [kind: string, weight: number])[];
}

/** Ready mixes; any single part is a brush too (`part:<kind>`). */
export const BRUSH_MIXES: readonly IBrushMix[] = [
	{
		id: "mixed_wood",
		name: "Mixed wood",
		kinds: [
			["pine_tree_01", 3],
			["round_tree_01", 2],
			["birch_01", 2],
			["round_tree_02", 1],
		],
	},
	{ id: "pine_forest", name: "Pine forest", kinds: [["pine_tree_01", 1]] },
	{
		id: "park_trees",
		name: "Park trees",
		kinds: [
			["round_tree_01", 2],
			["round_tree_02", 2],
			["birch_01", 1],
		],
	},
	{ id: "orchard", name: "Orchard", kinds: [["fruit_tree_01", 1]] },
	{
		id: "coast",
		name: "Palms and cypresses",
		kinds: [
			["palm_tree_01", 2],
			["cypress_01", 1],
		],
	},
	{
		id: "undergrowth",
		name: "Bushes and grass",
		kinds: [
			["bush_01", 2],
			["tall_grass_01", 3],
			["rocks_01", 1],
		],
	},
	{ id: "rocks", name: "Rocks", kinds: [["rocks_01", 1]] },
];

export type TPaintMode = "paint" | "erase";

/** The brush's settings, remembered per browser. */
export interface IPaintBrush {
	/** A mix's id, or `part:<kind>` for a single part. */
	brushId: string;
	mode: TPaintMode;
	/** The brush's radius, in grid units. */
	size: number;
	/** About how many objects per 10 square grid units. */
	density: number;
}

export const PAINT_SIZE = { min: 0.5, max: 10 };
export const PAINT_DENSITY = { min: 0.5, max: 8 };

export const DEFAULT_BRUSH: IPaintBrush = {
	brushId: "mixed_wood",
	mode: "paint",
	size: 2.5,
	density: 3,
};

/** A brush's parts by weight, for a mix or a single part (none if the part is unknown). */
export const brushKinds = (brushId: string): IBrushMix["kinds"] => {
	if (brushId.startsWith("part:")) {
		const kind = brushId.slice("part:".length);
		return getPart(kind) ? [[kind, 1]] : [];
	}
	return BRUSH_MIXES.find((mix) => mix.id === brushId)?.kinds ?? [];
};

/** A random number generator returning [0, 1): Math.random, or a seeded one in tests. */
export type TRandom = () => number;

/** Roughly how far a part reaches from its centre on the ground, at scale 1 (half its smaller side, a little more). */
const reachOf = (entity: Pick<TEntity, "kind" | "props" | "scale">) => {
	const part = getPart(entity.kind);
	if (!part) {
		return 0.5;
	}
	const [width, depth] = part.footprint(resolveProps(part, entity.props));
	return (Math.min(width, depth) / 2) * 0.9 * entity.scale;
};

/** An object's ground outline as an axis-aligned box round its turned footprint. */
const boxOf = (entity: TEntity) => {
	const part = getPart(entity.kind);
	if (!part) {
		return null;
	}
	const [width, depth] = part.footprint(resolveProps(part, entity.props));
	const turn = (entity.rotation * Math.PI) / 180;
	const cos = Math.abs(Math.cos(turn));
	const sin = Math.abs(Math.sin(turn));
	return {
		x: entity.position[0],
		z: entity.position[1],
		halfX: ((width * cos + depth * sin) * entity.scale) / 2,
		halfZ: ((width * sin + depth * cos) * entity.scale) / 2,
	};
};

/** How far a point is from a segment, on the ground. */
const distanceToSegment = ([px, pz]: TVec2, [ax, az]: TVec2, [bx, bz]: TVec2) => {
	const dx = bx - ax;
	const dz = bz - az;
	const lengthSq = dx * dx + dz * dz;
	const t =
		lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSq));
	return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** The roads as pieces of ground to keep off: each centreline segment and its half width. */
const roadPieces = (scene: TScene) =>
	scene.roads
		.filter((road) => !road.hidden && !isHiddenRoute(road.style))
		.flatMap((road) => {
			const line = roadCenterlineOf(road);
			return line.slice(1).map((point, i) => ({
				from: [line[i][0], line[i][1]] as TVec2,
				to: [point[0], point[1]] as TVec2,
				half: (pointWidth(point) ?? road.width) / 2,
			}));
		});

/** What a stamp of the brush lands on: the scene's objects in the way, and its roads. */
const obstaclesOf = (scene: TScene) => ({
	boxes: scene.entities
		.filter((entity) => !entity.follow && !entity.hidden && !getPart(entity.kind)?.flat)
		.map(boxOf)
		.filter((box) => box !== null),
	roads: roadPieces(scene),
});

/** Round to the grid's hundredths, as worlds store positions. */
const hundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * New objects for one stamp of the brush at `center`: as many as its density
 * asks for in its circle, less those of its parts already there, each at a
 * free spot (off roads, out of other objects and each other, on the ground),
 * a little varied in size and turned any way, standing on raised land.
 */
export const paintStamp = (
	scene: TScene,
	brush: IPaintBrush,
	center: TVec2,
	random: TRandom = Math.random,
): Omit<TEntityInput, "id">[] => {
	const kinds = brushKinds(brush.brushId);
	if (kinds.length === 0) {
		return [];
	}
	const total = kinds.reduce((sum, [, weight]) => sum + weight, 0);
	const pick = () => {
		let roll = random() * total;
		for (const [kind, weight] of kinds) {
			roll -= weight;
			if (roll < 0) {
				return kind;
			}
		}
		return kinds[0][0];
	};
	const area = Math.PI * brush.size * brush.size;
	const already = scene.entities.filter(
		(entity) =>
			kinds.some(([kind]) => kind === entity.kind) &&
			Math.hypot(entity.position[0] - center[0], entity.position[1] - center[1]) <= brush.size,
	).length;
	const wanted = Math.max(0, Math.round((area * brush.density) / 10) - already);
	const { boxes, roads } = obstaclesOf(scene);
	const halfWidth = scene.ground.width / 2;
	const halfDepth = scene.ground.depth / 2;
	const placed: { point: TVec2; reach: number }[] = [];
	const added: Omit<TEntityInput, "id">[] = [];

	for (let attempt = 0; attempt < wanted * 8 && added.length < wanted; attempt++) {
		// Evenly over the circle.
		const angle = random() * Math.PI * 2;
		const distance = brush.size * Math.sqrt(random());
		const point: TVec2 = [
			hundredths(center[0] + Math.cos(angle) * distance),
			hundredths(center[1] + Math.sin(angle) * distance),
		];
		const kind = pick();
		const part = getPart(kind);
		if (!part) {
			continue;
		}
		const defaults = part.schema.parse({}) as Record<string, unknown>;
		// Sizes vary a little where the part has a size (trees, bushes).
		const props =
			typeof defaults.size === "number"
				? { size: hundredths(defaults.size * (0.8 + random() * 0.4)) }
				: {};
		const candidate = { kind, props, scale: 1 };
		const reach = reachOf(candidate);
		const free =
			Math.abs(point[0]) + reach <= halfWidth &&
			Math.abs(point[1]) + reach <= halfDepth &&
			boxes.every(
				(box) =>
					Math.max(
						Math.abs(point[0] - box.x) - box.halfX,
						Math.abs(point[1] - box.z) - box.halfZ,
					) >= reach,
			) &&
			roads.every((road) => distanceToSegment(point, road.from, road.to) >= road.half + reach) &&
			placed.every(
				(other) =>
					Math.hypot(point[0] - other.point[0], point[1] - other.point[1]) >= reach + other.reach,
			);
		if (!free) {
			continue;
		}
		placed.push({ point, reach });
		added.push({
			kind,
			name: "",
			position: point,
			elevation: groundHeightAt(scene.areas, point),
			rotation: Math.round(random() * 360) - 180,
			props,
		});
	}
	return added;
};

/** The objects one stamp of the eraser takes away: those the brush paints, in its circle, not locked. */
export const eraseStamp = (scene: TScene, brush: IPaintBrush, center: TVec2) => {
	const kinds = brushKinds(brush.brushId);
	return scene.entities
		.filter(
			(entity) =>
				!entity.locked &&
				!entity.follow &&
				kinds.some(([kind]) => kind === entity.kind) &&
				Math.hypot(entity.position[0] - center[0], entity.position[1] - center[1]) <= brush.size,
		)
		.map((entity) => entity.id);
};
