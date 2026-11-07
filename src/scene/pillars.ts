import { isInsidePolygon } from "./areas";
import { type INetworkJunction, type IRoadNetwork, junctionPad, roadNetworkOf } from "./junctions";
import { DECK_THICKNESS, isHiddenRoute, PILLAR_MIN, pillarSpacingOf } from "./roads";
import { centerlineOf } from "./routes";
import type { TJunction, TPillarKind, TRoad, TRoadPoint } from "./schema";

/**
 * Where a raised road's pillars stand (ADR-0148): every `pillarSpacing` along its line where it's
 * high enough, as always; then each moved along the road to stay out of the roads and junctions
 * below it and out of its own lower turns (pillars may stand in water, as bridge piers do).
 * Framework-free and tested. Where nothing is below, it places exactly what `pillarPositions` did.
 */

/** Where along a road a pillar is: its place, the deck's height there, the road's way and width. */
export interface IPillarSpot {
	x: number;
	z: number;
	/** The deck's top above the ground there (the pillar reaches to its underside). */
	height: number;
	/** The road's direction there on the ground, in radians from +x towards +z. */
	heading: number;
	/** Half the deck's width there. */
	halfWidth: number;
}

/** One pillar of a road. */
export interface IPillar extends IPillarSpot {
	/** How far along the road's drawn line it stands. */
	along: number;
}

/** What a road's pillars keep clear of: the world's roads and junctions. */
export interface IPillarWorld {
	roads: readonly TRoad[];
	junctions: readonly TJunction[];
}

/**
 * What a pillar of a kind stands on, as discs [along the road, across it (right of its way),
 * radius], for a deck `halfWidth` wide: a post's or a column's foot, a pair's two posts under the
 * deck's edges, a wall's length across.
 */
export const pillarFootprint = (
	kind: TPillarKind,
	halfWidth: number,
): [number, number, number][] => {
	switch (kind) {
		case "column_01":
			return [[0, 0, 0.3]];
		case "hammerhead_01":
			return [[0, 0, 0.36]];
		case "pair_01":
			return [
				[0, -halfWidth * 0.62, 0.24],
				[0, halfWidth * 0.62, 0.24],
			];
		case "wall_01": {
			const discs: [number, number, number][] = [];
			const reach = halfWidth * 0.8;
			const count = Math.max(2, Math.ceil((2 * reach) / 0.4));
			for (let i = 0; i <= count; i++) {
				discs.push([0, -reach + (2 * reach * i) / count, 0.2]);
			}
			return discs;
		}
		default:
			return [[0, 0, 0.32]];
	}
};

/** How far a blocked pillar moves along its road in each try (up to half the spacing either way). */
const MOVE_STEP = 0.25;
/** A road below a pillar's deck counts when its surface is this much under the deck's underside. */
const CLEARANCE = 0.05;

/** A line's points (a loop's first again at its end) with the distance to each along the ground. */
const measured = (line: readonly TRoadPoint[], closed: boolean) => {
	const pts = closed && line.length > 2 ? [...line, line[0]] : [...line];
	const along = [0];
	for (let i = 1; i < pts.length; i++) {
		along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
	}
	return { pts, along, total: along[along.length - 1] };
};

/** Where on a measured line `d` along it is. */
const spotAt = (
	{ pts, along }: ReturnType<typeof measured>,
	d: number,
	roadHalfWidth: number,
): IPillarSpot | null => {
	for (let i = 1; i < pts.length; i++) {
		if (d <= along[i] + 1e-9 && along[i] > along[i - 1]) {
			const a = pts[i - 1];
			const b = pts[i];
			const t = Math.max(0, Math.min(1, (d - along[i - 1]) / (along[i] - along[i - 1])));
			return {
				x: a[0] + (b[0] - a[0]) * t,
				z: a[1] + (b[1] - a[1]) * t,
				height: a[2] + (b[2] - a[2]) * t,
				heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
				halfWidth:
					a.length > 3 && b.length > 3
						? ((a[3] as number) + ((b[3] as number) - (a[3] as number)) * t) / 2
						: roadHalfWidth,
			};
		}
	}
	return null;
};

/** A road's line as something below a pillar: its stretches with their heights and widths. */
interface IBand {
	pts: readonly TRoadPoint[];
	along: readonly number[];
	halfWidth: number;
	/** [min x, min z, max x, max z], its widest half width round it. */
	box: [number, number, number, number];
}

const bandOf = (line: readonly TRoadPoint[], closed: boolean, halfWidth: number): IBand => {
	const { pts, along } = measured(line, closed);
	let [minX, minZ, maxX, maxZ] = [
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	];
	let widest = halfWidth;
	for (const p of pts) {
		minX = Math.min(minX, p[0]);
		minZ = Math.min(minZ, p[1]);
		maxX = Math.max(maxX, p[0]);
		maxZ = Math.max(maxZ, p[1]);
		if (p.length > 3) {
			widest = Math.max(widest, (p[3] as number) / 2);
		}
	}
	return {
		pts,
		along,
		halfWidth,
		box: [minX - widest, minZ - widest, maxX + widest, maxZ + widest],
	};
};

/**
 * Whether a disc of radius `r` at x, z stands on a band where its surface is lower than `below`.
 * Stretches within `skip.window` of `skip.along` along it don't count: a road's own deck there.
 */
const hitsBand = (
	band: IBand,
	x: number,
	z: number,
	r: number,
	below: number,
	skip?: { along: number; window: number },
) => {
	if (x + r < band.box[0] || x - r > band.box[2] || z + r < band.box[1] || z - r > band.box[3]) {
		return false;
	}
	for (let i = 1; i < band.pts.length; i++) {
		const a = band.pts[i - 1];
		const b = band.pts[i];
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const len2 = dx * dx + dz * dz;
		const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2));
		if (skip) {
			const d = band.along[i - 1] + (band.along[i] - band.along[i - 1]) * t;
			if (Math.abs(d - skip.along) < skip.window) {
				continue;
			}
		}
		const gap = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
		const half =
			a.length > 3 && b.length > 3
				? ((a[3] as number) + ((b[3] as number) - (a[3] as number)) * t) / 2
				: band.halfWidth;
		if (gap < half + r && a[2] + (b[2] - a[2]) * t < below) {
			return true;
		}
	}
	return false;
};

/** Whether a disc touches an outline: its middle or any of eight points round its edge is inside. */
const discInPolygon = (
	{ x, z, r }: { x: number; z: number; r: number },
	outline: readonly (readonly number[])[],
) => {
	if (isInsidePolygon([x, z], outline as TRoadPoint[])) {
		return true;
	}
	for (let k = 0; k < 8; k++) {
		const angle = (k * Math.PI) / 4;
		if (
			isInsidePolygon([x + Math.cos(angle) * r, z + Math.sin(angle) * r], outline as TRoadPoint[])
		) {
			return true;
		}
	}
	return false;
};

// Worked out once per road and per network (both are replaced, never changed in place).
const bands = new WeakMap<TRoad, IBand>();
const roadBand = (road: TRoad) => {
	let band = bands.get(road);
	if (!band) {
		band = bandOf(centerlineOf(road), road.loops, road.width / 2);
		bands.set(road, band);
	}
	return band;
};
const padLists = new WeakMap<IRoadNetwork, { outline: TRoadPoint[]; height: number }[]>();
const padsOf = (network: IRoadNetwork) => {
	let pads = padLists.get(network);
	if (!pads) {
		pads = network.junctions.flatMap((junction) => {
			const pad = junctionPad(network, junction);
			return pad ? [{ outline: pad.vertices.slice(1), height: pad.vertices[0][2] }] : [];
		});
		padLists.set(network, pads);
	}
	return pads;
};

/** What a road's pillars keep clear of, worked out once per road and world. */
export interface IPillarObstacles {
	/**
	 * Whether a pillar of the road at a spot, `along` its drawn line, stands clear of other roads,
	 * junctions and its own road below.
	 */
	isClear: (spot: IPillarSpot, along: number) => boolean;
}

/** What's below a road's deck in a world, for its pillars to keep clear of (ADR-0148). */
export const pillarObstacles = (
	road: TRoad,
	line: readonly TRoadPoint[],
	world: IPillarWorld,
): IPillarObstacles => {
	const others = world.roads
		.filter((other) => other.id !== road.id && !isHiddenRoute(other.kind))
		.map(roadBand);
	const own = bandOf(line, road.loops, road.width / 2);
	const pads = padsOf(roadNetworkOf(world.roads, world.junctions));
	const discsOf = (spot: IPillarSpot) => {
		const cos = Math.cos(spot.heading);
		const sin = Math.sin(spot.heading);
		return pillarFootprint(road.pillarKind, spot.halfWidth).map(([forward, across, r]) => ({
			x: spot.x + cos * forward - sin * across,
			z: spot.z + sin * forward + cos * across,
			r,
		}));
	};
	return {
		isClear: (spot, along) => {
			const below = spot.height - DECK_THICKNESS - CLEARANCE;
			const skip = { along, window: spot.halfWidth * 2 + 2 };
			return !discsOf(spot).some(
				({ x, z, r }) =>
					others.some((band) => hitsBand(band, x, z, r, below)) ||
					hitsBand(own, x, z, r, below, skip) ||
					pads.some((pad) => pad.height < below && discInPolygon({ x, z, r }, pad.outline)),
			);
		},
	};
};

/**
 * The pillars a raised junction stands on (ADR-0148), when its `standsOnPillars` is on: one under
 * its middle, in the pillar kind of its first road held up by pillars and as wide as its widest
 * road, moved out along one of its roads (within its surface) when something is below it there.
 * None for a junction on the ground, or one none of whose roads stand on pillars.
 */
export const junctionPillars = (
	network: IRoadNetwork,
	junction: INetworkJunction,
	world: IPillarWorld,
): { kind: TPillarKind; pillars: IPillar[] } | null => {
	const height = junction.place[2];
	if (!junction.standsOnPillars || height < PILLAR_MIN) {
		return null;
	}
	const roads = junction.ends.flatMap((end) => {
		const road = network.roadById(end.roadId);
		return road && road.heldUpBy === "pillars" && !isHiddenRoute(road.kind) ? [{ road, end }] : [];
	});
	const first = roads[0];
	if (!first) {
		return null;
	}
	const halfWidth = Math.max(...junction.ends.map((end) => end.halfWidth));
	const [x, z] = junction.place;
	const heading = Math.atan2(first.end.direction[1], first.end.direction[0]);
	const spot: IPillarSpot = { x, z, height, heading, halfWidth };
	const road = { ...first.road, pillarKind: first.road.pillarKind ?? "post_01" };
	const obstacles = pillarObstacles(road, [], world);
	for (let move = 0; move <= Math.max(...junction.ends.map((end) => end.drawTrim)); move += 0.25) {
		for (const end of junction.ends) {
			const moved = {
				...spot,
				x: x + end.direction[0] * move,
				z: z + end.direction[1] * move,
				heading: Math.atan2(end.direction[1], end.direction[0]),
			};
			if (obstacles.isClear(moved, Number.NaN)) {
				return { kind: road.pillarKind, pillars: [{ ...moved, along: 0 }] };
			}
			if (move === 0) {
				break;
			}
		}
	}
	return null;
};

/**
 * Where a raised road's pillars stand, along `line` (its centre line as drawn, cut back at
 * junctions), for a road held up by pillars. `world` is what they keep clear of (none without it).
 */
export const placePillars = (
	road: TRoad,
	line: readonly TRoadPoint[],
	{
		world = null,
		bareStart = false,
		bareEnd = false,
	}: {
		world?: IPillarWorld | null;
		/** No pillars within half a spacing of its first or last point: a junction there has its own. */
		bareStart?: boolean;
		bareEnd?: boolean;
	} = {},
): IPillar[] => {
	const measuredLine = measured(line, road.loops);
	const step = Math.max(0.5, pillarSpacingOf(road));
	const halfWidth = road.width / 2;
	// 1. Every spacing along it, from half a spacing in, where it's high enough (exactly as always).
	const candidates: { along: number; spot: IPillarSpot | null }[] = [];
	const pts = measuredLine.pts;
	let nextAt = step / 2;
	let travelled = 0;
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i];
		const b = pts[i + 1];
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
		while (len > 0 && nextAt <= travelled + len) {
			const t = (nextAt - travelled) / len;
			const h = a[2] + (b[2] - a[2]) * t;
			if (h >= PILLAR_MIN) {
				candidates.push({
					along: nextAt,
					spot: {
						x: a[0] + (b[0] - a[0]) * t,
						z: a[1] + (b[1] - a[1]) * t,
						height: h,
						heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
						halfWidth:
							a.length > 3 && b.length > 3
								? ((a[3] as number) + ((b[3] as number) - (a[3] as number)) * t) / 2
								: halfWidth,
					},
				});
			}
			nextAt += step;
		}
		travelled += len;
	}
	let placed = candidates;
	// Not right beside a junction that stands on its own pillars (ADR-0148).
	if (bareStart || bareEnd) {
		placed = placed.filter(
			(pillar) =>
				!(bareStart && pillar.along < step / 2) &&
				!(bareEnd && pillar.along > measuredLine.total - step / 2),
		);
	}
	// 2. Clear of what's below, moved along the road where it isn't.
	const obstacles = world ? pillarObstacles(road, line, world) : null;
	const pillars: IPillar[] = [];
	for (const { along, spot } of placed) {
		if (!spot || spot.height - DECK_THICKNESS <= CLEARANCE) {
			continue;
		}
		if (!obstacles || obstacles.isClear(spot, along)) {
			pillars.push({ ...spot, along });
			continue;
		}
		for (let move = MOVE_STEP; move <= step / 2 + 1e-9; move += MOVE_STEP) {
			const found = [along - move, along + move]
				.filter((d) => d >= 0 && d <= measuredLine.total)
				.map((d) => ({ d, moved: spotAt(measuredLine, d, halfWidth) }))
				.find(
					({ d, moved }) =>
						moved !== null && moved.height >= PILLAR_MIN && obstacles.isClear(moved, d),
				);
			if (found?.moved) {
				pillars.push({ ...found.moved, along: found.d });
				break;
			}
		}
	}
	return pillars;
};
