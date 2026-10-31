import type { TDataBindingInput, TEntityInput, TRoadInput, TVec2 } from "#/scene/schema";

/**
 * Pieces the data templates share (the data study's examples): clusters that
 * follow a table row and grow with a column on a log scale, and roads between
 * them whose vehicles follow another table's rows (ADR-0108, ADR-0111, ADR-0112).
 */

/** A log-scale size binding: `low` and `high` values grow a cluster from a sliver to full. */
export const logSize = (key: string, low: number, high: number): TDataBindingInput => ({
	key,
	usesLogScale: true,
	valueAtLowSetting: low,
	valueAtHighSetting: high,
	lowSetting: 0.06,
	highSetting: 1,
});

/** Where a value sits between `low` and `high` on a log scale, 0 to 1. */
const logPosition = (value: number, low: number, high: number) =>
	Math.min(
		1,
		Math.max(
			0,
			(Math.log10(Math.max(value, 1)) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)),
		),
	);

/**
 * How built a cluster is for a value, as the binding above draws it, so the
 * stored size (pictures, Edit before data loads) matches the data.
 */
export const builtShareFor = (value: number, low: number, high: number) =>
	Math.round((0.06 + logPosition(value, low, high) * 0.94) * 100) / 100;

/** The sizes a cluster's footprint goes between: the smallest game's to the biggest's. */
const SMALLEST_SCALE = 0.7;
const LARGEST_SCALE = 1.75;

/**
 * A log-scale binding for a cluster's overall size, so a big number covers more ground, not only
 * a denser cluster: from SMALLEST_SCALE at `low` to LARGEST_SCALE at `high`.
 */
export const logScale = (key: string, low: number, high: number): TDataBindingInput => ({
	key,
	usesLogScale: true,
	valueAtLowSetting: low,
	valueAtHighSetting: high,
	lowSetting: SMALLEST_SCALE,
	highSetting: LARGEST_SCALE,
});

/** A cluster's size for a value, as the binding above draws it. */
export const scaleFor = (value: number, low: number, high: number) =>
	Math.round(
		(SMALLEST_SCALE + logPosition(value, low, high) * (LARGEST_SCALE - SMALLEST_SCALE)) * 100,
	) / 100;

/** How far a cluster of a size reaches from its middle: where a road to it starts. */
export const reachOf = (scale: number) => (CLUSTER_WIDTH / 2) * scale;

/** The cluster's diameter in the data templates. */
export const CLUSTER_WIDTH = 8;

interface IClusterOptions {
	id: string;
	kind: string;
	name: string;
	position: TVec2;
	color: string;
	tableKey: string;
	/** The row it follows; its name if left out. */
	rowKey?: string;
	builtShare: number;
	size?: TDataBindingInput;
	/** Its overall size, and the binding that sets it from data. */
	scale?: number;
	scaleFromData?: TDataBindingInput;
	cardKeys: string[];
	tileKeys: string[];
	description?: string;
	tag?: string;
	seed?: number;
	/** Its card shows as a chip until opened. */
	showsAsChip?: boolean;
}

/** A cluster following its row: its main colour, its size from data, a card and tiles. */
export const cluster = ({
	id,
	kind,
	name,
	position,
	color,
	tableKey,
	rowKey = name,
	builtShare,
	size,
	scale = 1,
	scaleFromData,
	cardKeys,
	tileKeys,
	description = "",
	tag = "",
	seed = 1,
	showsAsChip = false,
}: IClusterOptions): TEntityInput => {
	const mainColor =
		{
			house_cluster_01: "roofs",
			tower_cluster_01: "facades",
			shed_cluster_01: "roofs",
			tent_cluster_01: "canvas",
		}[kind] ?? "roofs";
	return {
		id,
		kind,
		name,
		position,
		scale,
		props: { builtShare, width: CLUSTER_WIDTH, seed },
		colors: { [mainColor]: { color } },
		dataRow: { tableKey, rowKey },
		data: {
			...(size ? { builtShare: size } : {}),
			...(scaleFromData ? { scale: scaleFromData } : {}),
		},
		label: { isShown: true, title: "", dataKeys: cardKeys, offset: [0, 1.5, 0], tag, showsAsChip },
		details: { description, dataKeys: tileKeys },
	};
};

/**
 * A straight road from the edge of one cluster to the edge of another, its row's amount shown by
 * its width (ADR-0112): thin for little, broad for much, never capped by how long the road is. A
 * few vehicles drive it for life and to show which way it goes; their number isn't the data.
 */
export const flowRoad = ({
	id,
	name,
	from,
	to,
	tableKey,
	rowKey,
	width,
	vehicleKind = "car_01",
	fromReach = CLUSTER_WIDTH / 2,
	toReach = CLUSTER_WIDTH / 2,
	isTwoWay = false,
}: {
	id: string;
	name: string;
	from: TVec2;
	to: TVec2;
	tableKey: string;
	rowKey: string;
	/** The binding that sets its width from its row's amount. */
	width: TDataBindingInput;
	vehicleKind?: string;
	/** How far each end's cluster reaches from its middle (its size). */
	fromReach?: number;
	toReach?: number;
	/** The flow goes both ways (a shared audience): vehicles each way, in their lanes. */
	isTwoWay?: boolean;
}): TRoadInput => {
	const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
	const start = fromReach + 0.6;
	const end = toReach + 0.6;
	const ux = (to[0] - from[0]) / distance;
	const uz = (to[1] - from[1]) / distance;
	return {
		id,
		name,
		kind: "road_01",
		points: [
			[from[0] + ux * start, from[1] + uz * start],
			[to[0] - ux * end, to[1] - uz * end],
		],
		width: 2,
		showsCentreLine: false,
		dataRow: { tableKey, rowKey },
		flow: {
			isOn: true,
			vehicleKind,
			vehicleCountAlong: 2,
			vehicleCountAgainst: isTwoWay ? 2 : 0,
			speed: 2.5,
		},
		data: { width },
	};
};
