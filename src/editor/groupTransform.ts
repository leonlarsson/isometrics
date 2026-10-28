import { clamp, normalizeDegrees, round } from "#/lib/math";
import {
	cornerLift,
	cornerWithLift,
	groundHeightAt,
	MAX_CORNER_LIFT,
	takesCornerHeights,
} from "#/scene/areas";
import type { TArea, TAreaPoint, TRoad, TRoadPoint, TScene, TVec2 } from "#/scene/schema";

import { type ICommitOptions, useEditor } from "./store";

/** Object sizes a transform may give. */
export const MIN_SIZE = 0.1;
export const MAX_SIZE = 10;
/** The highest a road point may be lifted. */
export const MAX_POINT_HEIGHT = 50;
/** How far below the ground an object may be sunk (ADR-0097). */
export const LOWEST_ELEVATION = -30;
/** The highest an area may be raised. */
export const MAX_AREA_HEIGHT = 30;

/** A multi-selection's movable things when a group transform started (ADR-0064). */
export interface IGroupStart {
	/** What it turns and resizes around: the middle of what moves, at the lowest object's height. */
	center: [number, number, number];
	/**
	 * Objects standing on their own (not driving a road), with their transform,
	 * and how high above the ground they stood (ADR-0098).
	 */
	entities: {
		id: string;
		position: TVec2;
		elevation: number;
		aboveGround: number;
		rotation: number;
		scale: number;
	}[];
	/** Driving vehicles: they move with their road, but take a resize. */
	drivers: { id: string; scale: number }[];
	roads: { id: string; points: TRoadPoint[] }[];
	areas: { id: string; points: TAreaPoint[]; height: number }[];
	/** The ground extent of what moves, to keep a moved group on the ground. */
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * The selected things a group transform moves, as they are now (locked ones
 * stay put), or null when nothing can move.
 */
export const groupStart = (): IGroupStart | null => {
	const { scene, selectedItems } = useEditor.getState();
	return groupStartOf(scene, selectedItems);
};

/**
 * The same for a world and a selection given, for components (a gizmo
 * following what it moves): they pass what they subscribe to, since the React
 * Compiler keeps what a component works out from the store by itself (ADR-0093).
 */
export const groupStartOf = (
	scene: TScene,
	selectedItems: readonly { kind: string; id: string }[],
): IGroupStart | null => {
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
			aboveGround: elevation - groundHeightAt(scene.areas, position),
			rotation,
			scale,
		}));
	const drivers = unlocked
		.filter((entity) => entity.follow)
		.map((entity) => ({ id: entity.id, scale: entity.scale }));
	const roads = picked(scene.roads, "road").map((road) => ({ id: road.id, points: road.points }));
	const areas = picked(scene.areas, "area").map(({ id, points, height }) => ({
		id,
		points,
		height,
	}));
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
	// Areas count by how high they're raised, so the gizmo of a raised one stands on its top.
	const heights = [
		...entities.map((entity) => entity.elevation),
		...areas.map((area) => area.height),
	];
	const lowest = heights.length ? Math.min(...heights) : 0;
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
	/**
	 * Placed freely (the gizmo's square, dragging, G with no axis): objects keep
	 * their height above the ground where they land (ADR-0098); otherwise their
	 * height.
	 */
	followGround?: boolean;
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
 * and resize with every point; lifting raises objects, road points and areas
 * (their corners keep their own heights on top, ADR-0096).
 */
export const transformGroup = (
	from: IGroupStart,
	{ offset = [0, 0], lift = 0, turn = 0, ratio: wanted = 1, followGround = false }: IGroupChange,
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

	// The ground the objects land on: the world's areas, those that move with them where they go, as
	// high as they were (their lift counts once, below).
	const movedAreas = new Map(from.areas.map((start) => [start.id, start]));
	const groundThen = store.scene.areas.map((area) => {
		const start = movedAreas.get(area.id);
		if (!start) {
			return area;
		}
		const points = start.points.map((point) => {
			const [x, z] = place(point);
			return cornerWithLift(x, z, cornerLift(point));
		});
		return { ...area, points, height: start.height };
	});

	store.commit((scene) => {
		for (const start of from.entities) {
			const entity = scene.entities.find((e) => e.id === start.id);
			if (!entity) {
				continue;
			}
			entity.position = place(start.position);
			// Placed freely, as high above the ground there as it was (ADR-0098); lifted with the
			// rest either way. Objects may sink into the ground (ADR-0097).
			const height = followGround
				? groundHeightAt(groundThen, entity.position) + start.aboveGround
				: start.elevation;
			entity.elevation = round(Math.max(LOWEST_ELEVATION, height + lift));
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
				area.points = start.points.map((point) => {
					const [x, z] = place(point);
					return cornerWithLift(x, z, cornerLift(point));
				});
				area.height = round(clamp(start.height + lift, 0, MAX_AREA_HEIGHT));
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

/** The selected points of a road, or corners of an area, when a move started (ADR-0065). */
export interface IPointsStart {
	kind: "road" | "area";
	id: string;
	/** Each selected point by its index, as it was. */
	points: { index: number; point: readonly number[] }[];
	/** Their middle on the ground, and their average height (road points; area corners' tops). */
	center: [number, number, number];
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** The selected points or corners as they are now, or null when there are none (or it's locked). */
export const pointsStart = (): IPointsStart | null => {
	const { scene, selectedRoadId, selectedAreaId, selectedPointIndices } = useEditor.getState();
	const road = scene.roads.find((r) => r.id === selectedRoadId);
	const area = scene.areas.find((a) => a.id === selectedAreaId);
	return road
		? pointsStartOf({ road }, selectedPointIndices)
		: area
			? pointsStartOf({ area }, selectedPointIndices)
			: null;
};

/**
 * The same for a road's or an area's points given, for components (a gizmo
 * following the points it moves): they pass what they subscribe to (ADR-0093).
 */
export const pointsStartOf = (
	{ road, area }: { road?: TRoad; area?: TArea },
	selectedPointIndices: readonly number[],
): IPointsStart | null => {
	const shape = road ?? area;
	if (!shape || shape.locked || selectedPointIndices.length === 0) {
		return null;
	}
	const points = selectedPointIndices.flatMap((index) => {
		const point = shape.points[index];
		return point ? [{ index, point }] : [];
	});
	if (points.length === 0) {
		return null;
	}
	const xs = points.map(({ point }) => point[0]);
	const zs = points.map(({ point }) => point[1]);
	const bounds = {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minZ: Math.min(...zs),
		maxZ: Math.max(...zs),
	};
	const lift = points.reduce((sum, { point }) => sum + (point[2] ?? 0), 0) / points.length;
	const height = road ? lift : Math.max(0, (area?.height ?? 0) + lift);
	return {
		kind: road ? "road" : "area",
		id: shape.id,
		points,
		center: [(bounds.minX + bounds.maxX) / 2, height, (bounds.minZ + bounds.maxZ) / 2],
		bounds,
	};
};

/**
 * Move the selected points or corners from where they started, as one commit
 * (ADR-0065): all by the same distance, staying on the ground together; road
 * points and area corners can also be lifted (never below the ground, ADR-0096).
 */
export const transformPoints = (
	from: IPointsStart,
	{ offset = [0, 0], lift = 0 }: Pick<IGroupChange, "offset" | "lift">,
	options?: ICommitOptions,
) => {
	const store = useEditor.getState();
	const { ground } = store.scene;
	const { minX, maxX, minZ, maxZ } = from.bounds;
	const dx = keepOn(offset[0], minX, maxX, ground.width / 2);
	const dz = keepOn(offset[1], minZ, maxZ, ground.depth / 2);
	store.commit((scene) => {
		if (from.kind === "road") {
			const road = scene.roads.find((r) => r.id === from.id);
			for (const { index, point } of road ? from.points : []) {
				const height = round(clamp((point[2] ?? 0) + lift, 0, MAX_POINT_HEIGHT));
				const width = point[3];
				const x = round(point[0] + dx);
				const z = round(point[1] + dz);
				if (road?.points[index]) {
					road.points[index] = width === undefined ? [x, z, height] : [x, z, height, width];
				}
			}
			return;
		}
		const area = scene.areas.find((a) => a.id === from.id);
		for (const { index, point } of area ? from.points : []) {
			if (area?.points[index]) {
				// Water stays level: its corners only move along the ground.
				const raised = takesCornerHeights(area)
					? clamp(cornerLift(point) + lift, -area.height, MAX_CORNER_LIFT)
					: cornerLift(point);
				area.points[index] = cornerWithLift(point[0] + dx, point[1] + dz, raised);
			}
		}
	}, options);
};

/** Move the selected points or corners by an exact amount, e.g. from the arrow keys (ADR-0065). */
export const transformSelectedPoints = (
	change: Pick<IGroupChange, "offset" | "lift">,
	options?: ICommitOptions,
) => {
	const from = pointsStart();
	if (from) {
		transformPoints(from, change, options);
	}
};
