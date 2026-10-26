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
 * Viewpoints saved before projections were a choice said `perspective: true`
 * or `false`; they get `projection` instead. Briefly the flat one was called
 * "diorama"; it's "orthographic".
 */
const upgradeViewpoints = (input: Record<string, unknown>): Record<string, unknown> => {
	const viewpoints = input.viewpoints;
	if (!Array.isArray(viewpoints)) {
		return input;
	}
	let changed = false;
	const next = viewpoints.map((viewpoint) => {
		if (isRecord(viewpoint) && viewpoint.projection === "diorama") {
			changed = true;
			return { ...viewpoint, projection: "orthographic" };
		}
		if (!isRecord(viewpoint) || typeof viewpoint.perspective !== "boolean") {
			return viewpoint;
		}
		changed = true;
		const { perspective, ...rest } = viewpoint;
		return { projection: perspective ? "perspective" : "orthographic", ...rest };
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

/**
 * Fields renamed so their names say what they hold (ADR-0071), old name → new,
 * by where they are. Never remove an entry: saved worlds may still use it.
 * Renamed again: point every older name at the newest, oldest first (a world
 * holding several keeps the latest one's value), e.g. `{ title: "x", showTitle: "x" }`.
 */
const RENAMED_WORLD_FIELDS = { driving: "drivingSide", turns: "turnStyle" };
const RENAMED_SETTINGS_FIELDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	onScreen: {
		title: "showTitle",
		subtitle: "showSubtitle",
		timeOfDay: "showTimeOfDay",
		labelCards: "showLabelCards",
		details: "showDetails",
		viewpointBar: "showViewpointBar",
	},
	lighting: { lights: "whenLightsAreOn" },
	traffic: { spacing: "keepSpacing", overtaking: "allowOvertaking" },
	camera: { turntable: "turntableOn", tiltShift: "tiltShiftOn" },
};
const RENAMED_ROAD_FIELDS = {
	closed: "loops",
	markings: "showMarkings",
	railings: "showRailings",
	lane: "drivingLane",
	turns: "turnStyle",
};
const RENAMED_FOLLOW_FIELDS = { turns: "turnStyle" };
const RENAMED_LIGHT_FIELDS = { mode: "whenOn" };
const RENAMED_BINDING_FIELDS = {
	above: "onAbove",
	full: "valueAtFull",
	low: "valueAtLowColor",
	high: "valueAtHighColor",
};

/**
 * The record with its old field names replaced, or the same record when it has
 * none. A value under the new name wins; of several old names, the latest listed.
 */
const renameFields = <T>(value: T, names: Readonly<Record<string, string>>): T => {
	if (!isRecord(value) || !Object.keys(names).some((from) => Object.hasOwn(value, from))) {
		return value;
	}
	const next: Record<string, unknown> = { ...value };
	for (const [from, to] of Object.entries(names)) {
		if (!Object.hasOwn(value, from)) {
			continue;
		}
		if (!Object.hasOwn(value, to)) {
			next[to] = value[from];
		}
		delete next[from];
	}
	return next as T;
};

/** Each entry of a record (by id or by setting) passed through `upgrade`, or the same record. */
const mapValues = (value: unknown, upgrade: (entry: unknown) => unknown): unknown => {
	if (!isRecord(value)) {
		return value;
	}
	let changed = false;
	const next = Object.fromEntries(
		Object.entries(value).map(([key, entry]) => {
			const upgraded = upgrade(entry);
			changed ||= upgraded !== entry;
			return [key, upgraded];
		}),
	);
	return changed ? next : value;
};

/** A light's or a colour's settings, with its data bindings' old field names replaced. */
const upgradeBindings = (settings: unknown): unknown => {
	if (!isRecord(settings)) {
		return settings;
	}
	const data = mapValues(settings.data, (binding) => renameFields(binding, RENAMED_BINDING_FIELDS));
	return data === settings.data ? settings : { ...settings, data };
};

const upgradeEntity = (entity: unknown): unknown => {
	if (!isRecord(entity)) {
		return entity;
	}
	const follow = renameFields(entity.follow, RENAMED_FOLLOW_FIELDS);
	const lights = mapValues(entity.lights, (light) =>
		upgradeBindings(renameFields(light, RENAMED_LIGHT_FIELDS)),
	);
	const colors = mapValues(entity.colors, upgradeBindings);
	return follow === entity.follow && lights === entity.lights && colors === entity.colors
		? entity
		: { ...entity, follow, lights, colors };
};

/** Every list item passed through `upgrade`, or the same list. */
const mapItems = (items: unknown, upgrade: (item: unknown) => unknown): unknown => {
	if (!Array.isArray(items)) {
		return items;
	}
	const next = items.map(upgrade);
	return next.some((item, i) => item !== items[i]) ? next : items;
};

/** Renamed fields (ADR-0071): their values under their new names. */
const upgradeFieldNames = (input: Record<string, unknown>): Record<string, unknown> => {
	const next = renameFields(input, RENAMED_WORLD_FIELDS);
	const changes: Record<string, unknown> = {};
	for (const [key, names] of Object.entries(RENAMED_SETTINGS_FIELDS)) {
		const upgraded = renameFields(next[key], names);
		if (upgraded !== next[key]) {
			changes[key] = upgraded;
		}
	}
	const roads = mapItems(next.roads, (road) => renameFields(road, RENAMED_ROAD_FIELDS));
	if (roads !== next.roads) {
		changes.roads = roads;
	}
	const entities = mapItems(next.entities, upgradeEntity);
	if (entities !== next.entities) {
		changes.entities = entities;
	}
	return next === input && Object.keys(changes).length === 0 ? input : { ...next, ...changes };
};

/**
 * A world as saved by an earlier version, with what changed name brought up to
 * date: old ids replaced by their numbered ones, and renamed fields. Leaves the
 * input untouched (callers keep it as a backup) and returns it as it is when
 * there is nothing to replace. Anything that doesn't look like a world passes
 * through.
 */
export const upgradeLegacyIds = (input: unknown): unknown =>
	isRecord(input) ? upgradeFieldNames(upgradeIds(upgradeViewpoints(input))) : input;
