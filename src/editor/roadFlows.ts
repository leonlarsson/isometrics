import { readSetting } from "#/parts/dataBinding";
import { valuesWithRow } from "#/scene/rowData";
import type { TDataValue, TRoad, TWorldData } from "#/scene/schema";

/**
 * Roads that show flows (ADR-0112): a road's width and how many vehicles drive
 * it each way can follow a value or a column of the row it follows (a "from,
 * to, amount" table), so the world shows where players, goods or people go.
 * Readable without colour: how many vehicles, which way they drive, how wide
 * the road is, and arrows on it. No React.
 */

/** The road settings that can follow data, with their ranges, by their key in `road.data`. */
export const ROAD_DATA_SETTINGS = {
	width: { label: "Width", min: 0.4, max: 20, step: 0.1 },
	vehicleDensity: { label: "Vehicles per 10 units", min: 0, max: 6, step: 0.1 },
	vehicleCountAlong: { label: "Vehicles along it", min: 0, max: 40, step: 1 },
	vehicleCountAgainst: { label: "Vehicles the other way", min: 0, max: 40, step: 1 },
} as const;

export type TRoadDataSetting = keyof typeof ROAD_DATA_SETTINGS;

/** What a road can read: the world's values and its row's columns (ADR-0108). */
export const valuesOfRoad = (road: Pick<TRoad, "dataRow">, data: TWorldData) =>
	valuesWithRow(data, road.dataRow);

const drawn = new WeakMap<TRoad, { data: readonly TDataValue[]; road: TRoad }>();

/** A road as drawn now: its width and flow as data sets them (the road itself when nothing follows data). */
export const roadAsDrawn = (road: TRoad, data: readonly TDataValue[]): TRoad => {
	if (Object.keys(road.data).length === 0) {
		return road;
	}
	const cached = drawn.get(road);
	if (cached?.data === data) {
		return cached.road;
	}
	const read = (setting: TRoadDataSetting) => {
		const range = ROAD_DATA_SETTINGS[setting];
		const value = readSetting(road.data[setting], data, range);
		return value === undefined ? undefined : Math.round(value / range.step) * range.step;
	};
	const width = read("width");
	const along = read("vehicleCountAlong");
	const against = read("vehicleCountAgainst");
	const density = read("vehicleDensity");
	const result: TRoad = {
		...road,
		width: width ?? road.width,
		flow: {
			...road.flow,
			vehicleCountAlong: along ?? road.flow.vehicleCountAlong,
			vehicleCountAgainst: against ?? road.flow.vehicleCountAgainst,
			vehicleDensity: density ?? road.flow.vehicleDensity,
		},
	};
	drawn.set(road, { data, road: result });
	return result;
};

/**
 * Where each vehicle of a flow starts along its stream: spread evenly, so a
 * count reads at a glance, the other way's set half a gap apart.
 */
export const flowOffsets = (count: number, length: number, shifted = false) =>
	Array.from({ length: count }, (_, index) => ((index + (shifted ? 0.5 : 0)) / count) * length);

/**
 * How many vehicles drive one way along a road of `length`: its count, or with a density, that
 * many per 10 units (at least one, or none at 0); never more than fit a vehicle and a half apart.
 */
export const vehiclesOnStream = (
	flow: Pick<TRoad["flow"], "vehicleDensity">,
	count: number,
	length: number,
	vehicleLength: number,
) => {
	// None that way, or a density of nothing (an amount of 0 from data).
	if (count === 0 || flow.vehicleDensity === 0) {
		return 0;
	}
	const wanted =
		flow.vehicleDensity === null
			? count
			: Math.max(1, Math.round((flow.vehicleDensity * length) / 10));
	return Math.min(wanted, Math.max(1, Math.floor(length / (vehicleLength * 1.6))));
};

/** Which way the bigger flow goes, for the road's arrows: 1 along its points, -1 against, 0 even. */
export const flowDirection = (
	flow: Pick<TRoad["flow"], "vehicleCountAlong" | "vehicleCountAgainst">,
) => Math.sign(flow.vehicleCountAlong - flow.vehicleCountAgainst);
