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

/**
 * How built a cluster is for a value, as the binding above draws it, so the
 * stored size (pictures, Edit before data loads) matches the data.
 */
export const builtShareFor = (value: number, low: number, high: number) => {
	const position = Math.min(
		1,
		Math.max(
			0,
			(Math.log10(Math.max(value, 1)) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)),
		),
	);
	return Math.round((0.06 + position * 0.94) * 100) / 100;
};

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
	cardKeys: string[];
	tileKeys: string[];
	description?: string;
	tag?: string;
	seed?: number;
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
	cardKeys,
	tileKeys,
	description = "",
	tag = "",
	seed = 1,
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
		props: { builtShare, width: CLUSTER_WIDTH, seed },
		colors: { [mainColor]: { color } },
		dataRow: { tableKey, rowKey },
		data: size ? { builtShare: size } : {},
		label: { isShown: true, title: "", dataKeys: cardKeys, offset: [0, 1.5, 0], tag },
		details: { description, dataKeys: tileKeys },
	};
};

/** A straight road from the edge of one cluster to the edge of another, its flow following a row. */
export const flowRoad = ({
	id,
	name,
	from,
	to,
	tableKey,
	rowKey,
	vehicles,
	vehicleKind = "car_01",
}: {
	id: string;
	name: string;
	from: TVec2;
	to: TVec2;
	tableKey: string;
	rowKey: string;
	vehicles: TDataBindingInput;
	vehicleKind?: string;
}): TRoadInput => {
	const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
	const edge = CLUSTER_WIDTH / 2 + 0.6;
	const ux = (to[0] - from[0]) / distance;
	const uz = (to[1] - from[1]) / distance;
	return {
		id,
		name,
		kind: "road_01",
		points: [
			[from[0] + ux * edge, from[1] + uz * edge],
			[to[0] - ux * edge, to[1] - uz * edge],
		],
		width: 1.6,
		showsCentreLine: false,
		dataRow: { tableKey, rowKey },
		flow: { isOn: true, vehicleKind, vehicleCountAlong: 2, speed: 2.5 },
		data: { vehicleCountAlong: vehicles },
	};
};
