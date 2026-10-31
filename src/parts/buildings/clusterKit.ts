/**
 * Building clusters: one object of many small buildings that grows with a
 * number (`builtShare`, 0–1). The layout is worked out once per cluster style,
 * width and seed, as a list of slots from the middle outwards; a share builds
 * the first slots of that list, so growing only adds buildings at the edge and
 * raises the ones already there. A building keeps its spot, turn and look at
 * any share. Pure functions, no React or three.js, so they're tested on their
 * own (`clusterKit.test.ts`).
 */

/** Repeatable random numbers in [0, 1) from a seed (mulberry32). */
export const seededRandom = (seed: number) => {
	let state = (Math.floor(seed) * 0x9e3779b1) >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** How a style of cluster lays out its buildings. */
export interface IClusterStyle {
	/** Its own name, so styles with the same numbers don't share a cached layout. */
	id: string;
	/** The most buildings it has, at a share of 1, however wide. */
	mostBuildings: number;
	/**
	 * Organic rings out from the middle (a village, a camp), or blocks on a grid
	 * of streets (a downtown, an industrial estate).
	 */
	arrangement: "spiral" | "grid";
	/** Distance between neighbours' centres in grid units when it's small; wider clusters spread out. */
	spacing: number;
	/** How much of the spacing a building's width takes, at least and at most. */
	widthShare: readonly [number, number];
	/** A building's depth over its width, at least and at most. */
	aspect: readonly [number, number];
	/** Space left between buildings, in grid units. */
	gap: number;
	/** How buildings turn: any way, a quarter turn now and then, or a little either way. */
	turns: "any" | "quarters" | "slight";
	/** A clearing in the middle kept free (a camp's fire), as a radius in grid units. */
	clearing?: number;
}

/** Where one building of a cluster stands, and its look, at full size. */
export interface IClusterSlot {
	/** Its place in the order buildings are built in, from 0. */
	rank: number;
	x: number;
	z: number;
	/** Its footprint at full size, before turning. */
	width: number;
	depth: number;
	/** Its turn about the vertical, in radians. */
	turn: number;
	/** How far out it stands: 0 in the middle, 1 at the edge. */
	outness: number;
	/** Random numbers in [0, 1) for its look (height, roof, details), fixed per building. */
	looks: readonly [number, number, number, number];
}

/** A rectangle on the ground: its centre, size and turn. */
interface IRect {
	x: number;
	z: number;
	width: number;
	depth: number;
	turn: number;
}

const cornersOf = ({ x, z, width, depth, turn }: IRect): [number, number][] => {
	const cos = Math.cos(turn);
	const sin = Math.sin(turn);
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1],
	].map(([a, b]) => {
		const u = (a * width) / 2;
		const v = (b * depth) / 2;
		// A turn about +Y (three's): x' = x cos + z sin, z' = −x sin + z cos.
		return [x + u * cos + v * sin, z - u * sin + v * cos];
	});
};

/** Whether two turned rectangles overlap, grown by `gap` / 2 each (separating axes). */
export const rectsOverlap = (a: IRect, b: IRect, gap = 0) => {
	const grown = (r: IRect) => ({ ...r, width: r.width + gap, depth: r.depth + gap });
	const ca = cornersOf(grown(a));
	const cb = cornersOf(grown(b));
	for (const turn of [a.turn, b.turn]) {
		for (const [ax, az] of [
			[Math.cos(turn), -Math.sin(turn)],
			[Math.sin(turn), Math.cos(turn)],
		]) {
			const project = (corners: [number, number][]) => corners.map(([x, z]) => x * ax + z * az);
			const pa = project(ca);
			const pb = project(cb);
			if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) {
				return false;
			}
		}
	}
	return true;
};

/** How far a rectangle's farthest corner is from the cluster's middle. */
export const reachOf = (rect: IRect) =>
	Math.max(...cornersOf(rect).map(([x, z]) => Math.hypot(x, z)));

const turnFor = (style: IClusterStyle, random: () => number) => {
	if (style.turns === "any") {
		return random() * Math.PI * 2;
	}
	if (style.turns === "quarters") {
		return random() < 0.35 ? Math.PI / 2 : 0;
	}
	return (random() - 0.5) * 0.5 + (random() < 0.4 ? Math.PI / 2 : 0);
};

/** Places to try, roughly from the middle outwards: a sunflower spiral, or the cells of a grid. */
const candidatesFor = (style: IClusterStyle, radius: number, spacing: number, seed: number) => {
	const random = seededRandom(seed * 7919 + 17);
	const spots: { x: number; z: number }[] = [];
	if (style.arrangement === "spiral") {
		// Vogel's spiral: each point takes the same area, about spacing² of it.
		const golden = Math.PI * (3 - Math.sqrt(5));
		const step = spacing / Math.sqrt(Math.PI);
		const start = random() * Math.PI * 2;
		for (let i = 0; step * Math.sqrt(i) < radius; i++) {
			const r = step * Math.sqrt(i + 0.5);
			const angle = start + i * golden;
			const wobble = spacing * 0.12;
			spots.push({
				x: r * Math.cos(angle) + (random() - 0.5) * wobble,
				z: r * Math.sin(angle) + (random() - 0.5) * wobble,
			});
		}
		return spots;
	}
	// A grid of blocks with a block in the middle, built in order of distance, a little shuffled.
	const cells = Math.ceil(radius / spacing);
	const scored: { x: number; z: number; score: number }[] = [];
	for (let i = -cells; i <= cells; i++) {
		for (let j = -cells; j <= cells; j++) {
			const x = i * spacing;
			const z = j * spacing;
			scored.push({ x, z, score: Math.hypot(x, z) + random() * spacing * 0.6 });
		}
	}
	return scored.sort((a, b) => a.score - b.score);
};

/**
 * The spacing for a width: the style's own, or wider when that's what it
 * takes for its most buildings to fill the circle (so a wide cluster has
 * bigger buildings, not a crowded middle and an empty edge).
 */
const spacingFor = (style: IClusterStyle, radius: number) =>
	Math.max(
		// Small clusters have smaller buildings, so a few still fit.
		style.spacing * Math.min(1, Math.max(0.65, radius / 4)),
		radius * Math.sqrt(Math.PI / (style.mostBuildings * 1.15)),
	);

/**
 * Every building a cluster can have, in the order they're built, at full
 * size: inside a circle `width` across, not overlapping (with the style's gap
 * between). The same style, width and seed always give the same slots.
 */
export const clusterSlots = (
	style: IClusterStyle,
	width: number,
	seed: number,
): readonly IClusterSlot[] => {
	const radius = width / 2;
	const spacing = spacingFor(style, radius);
	const random = seededRandom(seed);
	// A camp's clearing shrinks in a small camp, leaving room round it.
	const clearing =
		style.clearing === undefined ? undefined : Math.min(style.clearing, radius * 0.3);
	const slots: IClusterSlot[] = [];
	for (const spot of candidatesFor(style, radius, spacing, seed)) {
		if (slots.length >= style.mostBuildings) {
			break;
		}
		// Every candidate draws its numbers, used or not, so each keeps its own.
		const [w, a, t, j1, j2, l1, l2, l3, l4] = Array.from({ length: 9 }, random);
		const [least, most] = style.widthShare;
		const buildingWidth = spacing * (least + (most - least) * w);
		const aspect = style.aspect[0] + (style.aspect[1] - style.aspect[0]) * a;
		const turn = turnFor(style, seededRandom(Math.floor(t * 1e9)));
		// Room left in a grid cell: the building can sit off its middle a little.
		const room = style.arrangement === "grid" ? spacing - buildingWidth * Math.max(1, aspect) : 0;
		const rect = {
			x: spot.x + (j1 - 0.5) * Math.max(0, room) * 0.5,
			z: spot.z + (j2 - 0.5) * Math.max(0, room) * 0.5,
			width: buildingWidth,
			depth: buildingWidth * aspect,
			turn,
		};
		// One try smaller if it doesn't fit, then it's left out.
		for (const shrink of [1, 0.8]) {
			const tried = { ...rect, width: rect.width * shrink, depth: rect.depth * shrink };
			const centre = Math.hypot(tried.x, tried.z);
			const fits =
				reachOf(tried) <= radius &&
				(clearing === undefined || centre - reachOf({ ...tried, x: 0, z: 0 }) >= clearing) &&
				slots.every((slot) => !rectsOverlap(slot, tried, style.gap));
			if (fits) {
				slots.push({
					...tried,
					rank: slots.length,
					outness: Math.min(1, centre / radius),
					looks: [l1, l2, l3, l4],
				});
				break;
			}
		}
	}
	// However small, there's always one building: in the middle, as big as fits.
	if (slots.length === 0) {
		const side = Math.min(spacing * style.widthShare[0], width / Math.SQRT2 - 0.01);
		slots.push({
			rank: 0,
			x: 0,
			z: 0,
			width: side,
			depth: side,
			turn: 0,
			outness: 0,
			looks: [random(), random(), random(), random()],
		});
	}
	return slots;
};

const layouts = new Map<string, readonly IClusterSlot[]>();

/** `clusterSlots`, kept for the latest few layouts (worked out on every render and size check). */
export const cachedClusterSlots = (style: IClusterStyle, width: number, seed: number) => {
	const key = `${style.id}|${width}|${seed}`;
	const cached = layouts.get(key);
	if (cached) {
		return cached;
	}
	if (layouts.size > 64) {
		layouts.clear();
	}
	const slots = clusterSlots(style, width, seed);
	layouts.set(key, slots);
	return slots;
};

/** A building as it stands at a share: its slot, and how far it's grown, at its own size. */
export interface IBuiltBuilding extends IClusterSlot {
	/** How far this building has come up: from just above 0 as it appears, to 1. */
	presence: number;
	/** How much of its full size it has, across (its footprint) and up (its height). */
	widthFactor: number;
	heightFactor: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The buildings built at a share, in order: one at 0 and all of them at 1,
 * one after another between, the newest rising as the share grows towards
 * the next. Every building grows a little with the share too, so a bigger
 * number reads as more and taller buildings.
 */
export const builtBuildings = (
	slots: readonly IClusterSlot[],
	builtShare: number,
): IBuiltBuilding[] => {
	const share = Math.min(1, Math.max(0, builtShare));
	const built = 1 + share * Math.max(0, slots.length - 1);
	const grown = 0.55 + 0.45 * share;
	const out: IBuiltBuilding[] = [];
	for (const slot of slots) {
		const presence = Math.min(1, Math.max(0, built - slot.rank));
		if (presence <= 0) {
			break;
		}
		const rising = smooth(presence);
		out.push({
			...slot,
			presence,
			widthFactor: (0.88 + 0.12 * share) * (0.75 + 0.25 * rising),
			heightFactor: grown * (0.3 + 0.7 * rising),
		});
	}
	return out;
};

/** The four styles of cluster. */
export const HOUSE_CLUSTER: IClusterStyle = {
	id: "house",
	mostBuildings: 32,
	arrangement: "spiral",
	spacing: 1.45,
	widthShare: [0.5, 0.62],
	aspect: [0.8, 1.15],
	gap: 0.18,
	turns: "slight",
};

export const TOWER_CLUSTER: IClusterStyle = {
	id: "tower",
	mostBuildings: 30,
	arrangement: "grid",
	spacing: 1.45,
	widthShare: [0.6, 0.76],
	aspect: [0.8, 1.15],
	gap: 0.22,
	turns: "quarters",
};

export const SHED_CLUSTER: IClusterStyle = {
	id: "shed",
	mostBuildings: 20,
	arrangement: "grid",
	spacing: 2.1,
	widthShare: [0.5, 0.62],
	aspect: [1.25, 1.55],
	gap: 0.25,
	turns: "quarters",
};

export const TENT_CLUSTER: IClusterStyle = {
	id: "tent",
	mostBuildings: 28,
	arrangement: "spiral",
	spacing: 1.25,
	widthShare: [0.56, 0.7],
	aspect: [0.9, 1.4],
	gap: 0.14,
	turns: "any",
	clearing: 0.55,
};

export const CLUSTER_STYLES = [HOUSE_CLUSTER, TOWER_CLUSTER, SHED_CLUSTER, TENT_CLUSTER] as const;
