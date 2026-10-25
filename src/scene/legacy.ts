/**
 * Ids from before the numbered variants of ADR-0050, and what they are now.
 * Worlds saved before the rename get the new ids on load (ADR-0053), so their
 * objects keep their parts and their roads and areas keep their look.
 */

export const LEGACY_PART_KINDS: Readonly<Record<string, string>> = {
	warehouse: "warehouse_01",
	tower: "office_tower_01",
	house: "house_01",
	shed: "depot_01",
	grandstand: "grandstand_01",
	van: "delivery_van_01",
	truck: "truck_01",
	car: "car_01",
	raceCar: "race_car_01",
	yacht: "yacht_01",
	tree: "round_tree_01",
	pine: "pine_tree_01",
	zone: "zone_01",
	tunnel: "tunnel_01",
	lamp: "street_lamp_01",
	parcels: "parcel_stack_01",
	beacon: "beacon_01",
	text: "text_01",
};

export const LEGACY_ROAD_STYLES: Readonly<Record<string, string>> = {
	asphalt: "road_01",
	dirt: "dirt_path_01",
	hidden: "hidden_route_01",
};

export const LEGACY_AREA_TYPES: Readonly<Record<string, string>> = {
	water: "water_01",
	grass: "grass_01",
	sand: "sand_01",
	plaza: "plaza_01",
	land: "raised_land_01",
};

const LISTS = [
	{ key: "entities", field: "kind", ids: LEGACY_PART_KINDS },
	{ key: "roads", field: "style", ids: LEGACY_ROAD_STYLES },
	{ key: "areas", field: "type", ids: LEGACY_AREA_TYPES },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The same world with old ids replaced by their numbered ones. Leaves the input
 * untouched (callers keep it as a backup) and returns it as it is when there is
 * nothing to replace. Anything that doesn't look like a world passes through.
 */
/**
 * Viewpoints saved before projections were a choice said `perspective: true`
 * or `false`; they get `projection` instead.
 */
const upgradeViewpoints = (input: Record<string, unknown>): Record<string, unknown> => {
	const viewpoints = input.viewpoints;
	if (!Array.isArray(viewpoints)) {
		return input;
	}
	let changed = false;
	const next = viewpoints.map((viewpoint) => {
		if (!isRecord(viewpoint) || typeof viewpoint.perspective !== "boolean") {
			return viewpoint;
		}
		changed = true;
		const { perspective, ...rest } = viewpoint;
		return { projection: perspective ? "perspective" : "diorama", ...rest };
	});
	return changed ? { ...input, viewpoints: next } : input;
};

/** Old part kinds, road styles and area types: their current ids. */
const upgradeIds = (input: Record<string, unknown>): Record<string, unknown> => {
	let upgraded: Record<string, unknown> | null = null;
	for (const { key, field, ids } of LISTS) {
		const items = input[key];
		if (!Array.isArray(items)) {
			continue;
		}
		let changed = false;
		const next = items.map((item) => {
			const id = isRecord(item) ? item[field] : undefined;
			if (typeof id !== "string" || !Object.hasOwn(ids, id)) {
				return item;
			}
			changed = true;
			return { ...(item as Record<string, unknown>), [field]: ids[id] };
		});
		if (changed) {
			upgraded ??= { ...input };
			upgraded[key] = next;
		}
	}
	return upgraded ?? input;
};

/** A world as saved by an earlier version, with what changed name brought up to date. */
export const upgradeLegacyIds = (input: unknown): unknown =>
	isRecord(input) ? upgradeIds(upgradeViewpoints(input)) : input;
