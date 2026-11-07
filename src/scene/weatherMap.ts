import { isInsidePolygon } from "./areas";

/**
 * The weather map (ADR-0151): where areas with weather of their own lie, and
 * what that weather is, as a small top-down grid the view's weather shaders
 * read. Each texel holds how much of an area's own weather covers it (0 to 1,
 * fading over `EDGE` grid units at the outline) and that weather's amounts,
 * premultiplied by the coverage, so the amount at a place is
 * `world × (1 − coverage) + amount` and a texture's filtering mixes it
 * rightly. Where areas overlap, the later one lies on top. No three.js: the
 * view turns it into textures.
 */

/** What the map holds per texel, in this order. */
export const WEATHER_MAP_AMOUNTS = [
	"rain",
	"snow",
	"wetness",
	"snowCover",
	"fog",
	"haze",
	"overcast",
	"splashes",
	/** How high its clouds float, as a share of the highest (editor/weather: MOST_CLOUD_ALTITUDE). */
	"cloudAltitude",
] as const;

export type TWeatherMapAmount = (typeof WEATHER_MAP_AMOUNTS)[number];

/** How many numbers a texel holds: its amounts and the coverage. */
export const WEATHER_MAP_STRIDE = WEATHER_MAP_AMOUNTS.length + 1;

/** How far an area's own weather fades out at its outline, in grid units (half inside, half out). */
export const EDGE = 2;

/** At most this many texels a side. */
const MOST_TEXELS = 256;

/** At least this big a texel, in grid units: small areas don't need a finer grid. */
const SMALLEST_CELL = 0.25;

type TOutline = readonly (readonly number[])[];

/** An area with weather of its own, for the map: its outline and its amounts, each 0–1. */
export interface IWeatherMapArea {
	points: TOutline;
	amounts: Readonly<Record<TWeatherMapAmount, number>>;
}

/** Where the map lies: its lowest corner, the size of a texel and how many a side. */
export interface IWeatherMapGrid {
	minX: number;
	minZ: number;
	cell: number;
	width: number;
	depth: number;
}

export interface IWeatherMap extends IWeatherMapGrid {
	/** Per texel, row by row (z), `WEATHER_MAP_STRIDE` numbers: the amounts, then the coverage. */
	values: Float32Array;
}

/**
 * The grid over these outlines, with room round them for the fading edge and
 * a texel of nothing on every side (so what lies beyond the map reads as
 * uncovered).
 */
export const weatherMapGridOf = (outlines: readonly TOutline[]): IWeatherMapGrid | null => {
	let minX = Number.POSITIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	for (const points of outlines) {
		for (const [x, z] of points) {
			minX = Math.min(minX, x);
			minZ = Math.min(minZ, z);
			maxX = Math.max(maxX, x);
			maxZ = Math.max(maxZ, z);
		}
	}
	if (!Number.isFinite(minX)) {
		return null;
	}
	const span = Math.max(maxX - minX, maxZ - minZ) + EDGE;
	const cell = Math.max(SMALLEST_CELL, span / (MOST_TEXELS - 4));
	const margin = EDGE / 2 + 2 * cell;
	// On whole cells, so the grid stays put while an outline moves within it.
	const low = (value: number) => Math.floor((value - margin) / cell) * cell;
	const gridX = low(minX);
	const gridZ = low(minZ);
	return {
		minX: gridX,
		minZ: gridZ,
		cell,
		width: Math.min(MOST_TEXELS, Math.ceil((maxX + margin - gridX) / cell) + 1),
		depth: Math.min(MOST_TEXELS, Math.ceil((maxZ + margin - gridZ) / cell) + 1),
	};
};

/** How far a point is from the nearest side of an outline. */
const distanceToOutline = (x: number, z: number, points: TOutline) => {
	let nearest = Number.POSITIVE_INFINITY;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const [ax, az] = points[j];
		const [bx, bz] = points[i];
		const dx = bx - ax;
		const dz = bz - az;
		const lengthSq = dx * dx + dz * dz;
		const t =
			lengthSq > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / lengthSq)) : 0;
		const ex = x - (ax + t * dx);
		const ez = z - (az + t * dz);
		nearest = Math.min(nearest, ex * ex + ez * ez);
	}
	return Math.sqrt(nearest);
};

/** How much a fading edge covers at a signed distance from it (inside positive): 0 to 1, smoothly. */
const coverageAt = (signed: number) => {
	const t = Math.min(1, Math.max(0, 0.5 + signed / EDGE));
	return t * t * (3 - 2 * t);
};

/** One outline's coverage of a grid, kept per outline and grid: worked out again only when either changes. */
const coverages = new WeakMap<TOutline, { key: string; coverage: Float32Array }>();

const gridKey = (grid: IWeatherMapGrid) =>
	`${grid.minX}:${grid.minZ}:${grid.cell}:${grid.width}:${grid.depth}`;

/** How much of each texel an outline covers, with its fading edge. */
export const coverageOf = (points: TOutline, grid: IWeatherMapGrid) => {
	const key = gridKey(grid);
	const kept = coverages.get(points);
	if (kept?.key === key) {
		return kept.coverage;
	}
	const coverage = new Float32Array(grid.width * grid.depth);
	let minX = Number.POSITIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	for (const [x, z] of points) {
		minX = Math.min(minX, x);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxZ = Math.max(maxZ, z);
	}
	// Only the texels its outline and edge can reach.
	const reach = EDGE / 2;
	const fromI = Math.max(0, Math.floor((minX - reach - grid.minX) / grid.cell));
	const toI = Math.min(grid.width - 1, Math.ceil((maxX + reach - grid.minX) / grid.cell));
	const fromJ = Math.max(0, Math.floor((minZ - reach - grid.minZ) / grid.cell));
	const toJ = Math.min(grid.depth - 1, Math.ceil((maxZ + reach - grid.minZ) / grid.cell));
	for (let j = fromJ; j <= toJ; j++) {
		const z = grid.minZ + j * grid.cell;
		for (let i = fromI; i <= toI; i++) {
			const x = grid.minX + i * grid.cell;
			const inside = isInsidePolygon([x, z], points);
			const distance = distanceToOutline(x, z, points);
			if (inside || distance < reach) {
				coverage[j * grid.width + i] = coverageAt(inside ? distance : -distance);
			}
		}
	}
	coverages.set(points, { key, coverage });
	return coverage;
};

/** The map of these areas' own weathers, in order (later on top); null while there are none. */
export const weatherMapOf = (areas: readonly IWeatherMapArea[]): IWeatherMap | null => {
	const grid = weatherMapGridOf(areas.map((area) => area.points));
	if (!grid) {
		return null;
	}
	const texels = grid.width * grid.depth;
	const values = new Float32Array(texels * WEATHER_MAP_STRIDE);
	const covered = WEATHER_MAP_AMOUNTS.length;
	for (const area of areas) {
		const coverage = coverageOf(area.points, grid);
		const amounts = WEATHER_MAP_AMOUNTS.map((name) => area.amounts[name]);
		for (let t = 0; t < texels; t++) {
			const c = coverage[t];
			if (c === 0) {
				continue;
			}
			const at = t * WEATHER_MAP_STRIDE;
			// This area over what's under it: what's under shows through where it fades.
			for (let k = 0; k < covered; k++) {
				values[at + k] = values[at + k] * (1 - c) + amounts[k] * c;
			}
			values[at + covered] = values[at + covered] * (1 - c) + c;
		}
	}
	return { ...grid, values };
};

/** The weather at a point on the map, mixed with the world's where nothing covers it. */
export const weatherMapAt = (
	map: IWeatherMap,
	[x, z]: readonly number[],
	world: Readonly<Record<TWeatherMapAmount, number>>,
): Record<TWeatherMapAmount, number> => {
	const i = Math.round((x - map.minX) / map.cell);
	const j = Math.round((z - map.minZ) / map.cell);
	const inside = i >= 0 && j >= 0 && i < map.width && j < map.depth;
	const at = (j * map.width + i) * WEATHER_MAP_STRIDE;
	const coverage = inside ? map.values[at + WEATHER_MAP_AMOUNTS.length] : 0;
	return Object.fromEntries(
		WEATHER_MAP_AMOUNTS.map((name, k) => [
			name,
			world[name] * (1 - coverage) + (inside ? map.values[at + k] : 0),
		]),
	) as Record<TWeatherMapAmount, number>;
};
