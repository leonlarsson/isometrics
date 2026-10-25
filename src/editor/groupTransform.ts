import { clamp, normalizeDegrees, round } from "#/lib/math";
import type { TRoadPoint, TVec2 } from "#/scene/schema";

import { type ICommitOptions, useEditor } from "./store";

/** Object sizes a transform may give. */
export const MIN_SIZE = 0.1;
export const MAX_SIZE = 10;
/** The highest a road point may be lifted. */
export const MAX_POINT_HEIGHT = 50;

/** A multi-selection's movable things when a group transform started (ADR-0064). */
export interface IGroupStart {
	/** What it turns and resizes around: the middle of what moves, at the lowest object's height. */
	center: [number, number, number];
	/** Objects standing on their own (not driving a road), with their transform. */
	entities: { id: string; position: TVec2; elevation: number; rotation: number; scale: number }[];
	/** Driving vehicles: they move with their road, but take a resize. */
	drivers: { id: string; scale: number }[];
	roads: { id: string; points: TRoadPoint[] }[];
	areas: { id: string; points: TVec2[] }[];
	/** The ground extent of what moves, to keep a moved group on the ground. */
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * The selected things a group transform moves, as they are now (locked ones
 * stay put), or null when nothing can move.
 */
export const groupStart = (): IGroupStart | null => {
	const { scene, selectedItems } = useEditor.getState();
	const picked = <T extends { id: string; locked: boolean }>(list: T[], kind: string) =>
		list.filter(
			(thing) =>
				!thing.locked && selectedItems.some((item) => item.kind === kind && item.id === thing.id),
		);
	const unlocked = picked(scene.entities, "entity");
	const entities = unlocked
		.filter((entity) => !entity.follow)
		.map(({ id, position, elevation, rotation, scale }) => ({
			id,
			position,
			elevation,
			rotation,
			scale,
		}));
	const drivers = unlocked
		.filter((entity) => entity.follow)
		.map((entity) => ({ id: entity.id, scale: entity.scale }));
	const roads = picked(scene.roads, "road").map((road) => ({ id: road.id, points: road.points }));
	const areas = picked(scene.areas, "area").map((area) => ({ id: area.id, points: area.points }));
	const spots = [
		...entities.map((entity) => entity.position),
		...roads.flatMap((road) => road.points),
		...areas.flatMap((area) => area.points),
	];
	if (spots.length === 0 && drivers.length === 0) {
		return null;
	}
	const xs = spots.map((spot) => spot[0]);
	const zs = spots.map((spot) => spot[1]);
	const bounds = spots.length
		? { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
		: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
	const lowest = entities.length ? Math.min(...entities.map((entity) => entity.elevation)) : 0;
	return {
		center: [(bounds.minX + bounds.maxX) / 2, lowest, (bounds.minZ + bounds.maxZ) / 2],
		entities,
		drivers,
		roads,
		areas,
		bounds,
	};
};

/** A change to a group, from where it started: moved, lifted, turned (degrees) or resized. */
export interface IGroupChange {
	offset?: TVec2;
	lift?: number;
	turn?: number;
	ratio?: number;
}

/** How far a group may move along one axis and stay on the ground, given its extent `low`..`high`. */
const keepOn = (move: number, low: number, high: number, half: number) =>
	high - low > half * 2 ? 0 : clamp(move, -half - low, half - high);

/**
 * Transform a group from where it started, as one commit (ADR-0064). It stays
 * on the ground as a whole when moved; turning and resizing go around its
 * centre, positions as well as headings and sizes, and keep every size within
 * the limits so the group keeps its proportions. Roads and areas move, turn
 * and resize with every point; lifting raises objects and road points.
 */
export const transformGroup = (
	from: IGroupStart,
	{ offset = [0, 0], lift = 0, turn = 0, ratio: wanted = 1 }: IGroupChange,
	options?: ICommitOptions,
) => {
	const store = useEditor.getState();
	const { ground } = store.scene;
	const [cx, , cz] = from.center;
	const { minX, maxX, minZ, maxZ } = from.bounds;
	const dx = keepOn(offset[0], minX, maxX, ground.width / 2);
	const dz = keepOn(offset[1], minZ, maxZ, ground.depth / 2);
	const sizes = [...from.entities, ...from.drivers].map((thing) => thing.scale);
	const ratio = sizes.length
		? clamp(
				wanted,
				Math.max(...sizes.map((size) => MIN_SIZE / size)),
				Math.min(...sizes.map((size) => MAX_SIZE / size)),
			)
		: wanted;
	// Counter-clockwise seen from above, as an object's own rotation turns.
	const cos = Math.cos((turn * Math.PI) / 180);
	const sin = Math.sin((turn * Math.PI) / 180);
	/** Where a ground spot goes: turned and spread around the centre, then moved. */
	const place = ([x, z]: readonly number[]): TVec2 => {
		const ox = (x - cx) * ratio;
		const oz = (z - cz) * ratio;
		return [
			round(clamp(cx + ox * cos + oz * sin + dx, -ground.width / 2, ground.width / 2)),
			round(clamp(cz - ox * sin + oz * cos + dz, -ground.depth / 2, ground.depth / 2)),
		];
	};

	store.commit((scene) => {
		for (const start of from.entities) {
			const entity = scene.entities.find((e) => e.id === start.id);
			if (!entity) {
				continue;
			}
			entity.position = place(start.position);
			entity.elevation = round(Math.max(0, start.elevation + lift));
			entity.rotation = round(normalizeDegrees(start.rotation + turn), 1);
			entity.scale = round(start.scale * ratio, 2);
		}
		for (const start of from.drivers) {
			const entity = scene.entities.find((e) => e.id === start.id);
			if (entity) {
				entity.scale = round(start.scale * ratio, 2);
			}
		}
		for (const start of from.roads) {
			const road = scene.roads.find((r) => r.id === start.id);
			if (!road) {
				continue;
			}
			road.points = start.points.map((point) => {
				const [x, z] = place(point);
				const height = round(clamp((point[2] ?? 0) + lift, 0, MAX_POINT_HEIGHT));
				const width = point[3];
				return width === undefined ? [x, z, height] : [x, z, height, width];
			});
		}
		for (const start of from.areas) {
			const area = scene.areas.find((a) => a.id === start.id);
			if (area) {
				area.points = start.points.map(place);
			}
		}
	}, options);
};

/** Move, turn or resize the selected things by an exact amount, e.g. from the keys (ADR-0064). */
export const transformSelected = (change: IGroupChange, options?: ICommitOptions) => {
	const from = groupStart();
	if (from) {
		transformGroup(from, change, options);
	}
};
