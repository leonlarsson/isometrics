/**
 * Worlds as earlier versions saved them, brought up to date on load: old ids
 * (ADR-0050, ADR-0053), renamed fields (ADR-0071) and fields that moved
 * (ADR-0104). Framework-free; what needs the parts (old colours, one lights
 * mode for all, renamed props) is `parts/readWorld.ts`, which runs this first.
 *
 * Every entry is kept for good: saved worlds may still use it. Renamed again:
 * point every older name at the newest, oldest first (a world holding several
 * keeps the latest one's value). A value under the new name always wins.
 */

/** Ids from before the numbered variants of ADR-0050, and what they are now. */
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

export const LEGACY_ROAD_KINDS: Readonly<Record<string, string>> = {
	asphalt: "road_01",
	dirt: "dirt_path_01",
	hidden: "hidden_route_01",
};

export const LEGACY_AREA_KINDS: Readonly<Record<string, string>> = {
	water: "water_01",
	grass: "grass_01",
	sand: "sand_01",
	plaza: "plaza_01",
	land: "raised_land_01",
};

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The record under `key`, made if it isn't one (a missing group, say). */
const groupOf = (record: TRecord, key: string): TRecord => {
	const group = record[key];
	if (isRecord(group)) {
		return group;
	}
	const made: TRecord = {};
	record[key] = made;
	return made;
};

/** Each record in a list. */
const recordsIn = (list: unknown): TRecord[] => (Array.isArray(list) ? list.filter(isRecord) : []);

/** Each record among a record's values (settings by id or by setting). */
const recordValues = (record: unknown): TRecord[] =>
	isRecord(record) ? Object.values(record).filter(isRecord) : [];

/**
 * Old field names replaced by their new ones, in place. A value under the new
 * name wins; of several old names for it, the latest listed.
 */
const renameFields = (record: unknown, names: Readonly<Record<string, string>>) => {
	if (!isRecord(record)) {
		return;
	}
	const kept = new Set(
		Object.keys(names)
			.map((from) => names[from])
			.filter((to) => to in record),
	);
	for (const [from, to] of Object.entries(names)) {
		if (!Object.hasOwn(record, from)) {
			continue;
		}
		if (!kept.has(to)) {
			record[to] = record[from];
		}
		delete record[from];
	}
};

/** Fields moved from a record into one of its groups (old name → name there), in place. */
const moveInto = (record: TRecord, groupKey: string, names: Readonly<Record<string, string>>) => {
	const moving = Object.keys(names).filter((from) => Object.hasOwn(record, from));
	if (moving.length === 0) {
		return;
	}
	const group = groupOf(record, groupKey);
	const kept = new Set(moving.map((from) => names[from]).filter((to) => to in group));
	for (const from of moving) {
		if (!kept.has(names[from])) {
			group[names[from]] = record[from];
		}
		delete record[from];
	}
};

/** A colour once kept in its own field, now the colour setting under `id` in `colors`. */
const moveColor = (record: TRecord, field: string, id: string) => {
	if (!Object.hasOwn(record, field)) {
		return;
	}
	const value = record[field];
	delete record[field];
	if (typeof value !== "string") {
		return;
	}
	const colors = groupOf(record, "colors");
	const setting = groupOf(colors, id);
	setting.color ??= value;
};

/** A group once kept as a switch with its settings beside it (`turntableOn`): one record with `isOn`. */
const gatherGroup = (
	record: TRecord,
	groupKey: string,
	names: Readonly<Record<string, string>>,
) => {
	const old = record[groupKey];
	if (typeof old === "boolean") {
		// The switch's oldest name was the group's own (`turntable: true`).
		record[groupKey] = { isOn: old };
	}
	moveInto(record, groupKey, names);
};

const RENAMED_BINDING_FIELDS = {
	above: "switchesOnAbove",
	onAbove: "switchesOnAbove",
	full: "valueAtFull",
	low: "valueAtLowColor",
	high: "valueAtHighColor",
};

/** Each binding in a map of data bindings by setting, with its old field names replaced. */
const upgradeBindings = (bindings: unknown) => {
	for (const binding of recordValues(bindings)) {
		renameFields(binding, RENAMED_BINDING_FIELDS);
	}
};

/** Each colour setting's bindings in a `colors` map. */
const upgradeColors = (colors: unknown) => {
	for (const setting of recordValues(colors)) {
		upgradeBindings(setting.data);
	}
};

const RENAMED_LIGHT_FIELDS = {
	mode: "whenOn",
	litPanes: "litPaneShare",
	weight: "paneWeight",
};
const RENAMED_LIGHT_SETTINGS = { litPanes: "litPaneShare" };

const RENAMED_LOCK_FIELDS = { locked: "isLocked", hidden: "isHidden" };

const RENAMED_ON_SCREEN_FIELDS = {
	title: "showsTitle",
	showTitle: "showsTitle",
	subtitle: "showsSubtitle",
	showSubtitle: "showsSubtitle",
	timeOfDay: "showsTimeOfDay",
	showTimeOfDay: "showsTimeOfDay",
	labelCards: "showsLabelCards",
	showLabelCards: "showsLabelCards",
	details: "showsDetails",
	showDetails: "showsDetails",
	viewpointBar: "showsViewpointBar",
	showViewpointBar: "showsViewpointBar",
};

const RENAMED_SKY_FIELDS = {
	showInPerspective: "showsInPerspective",
	showSun: "showsSun",
	showMoon: "showsMoon",
};
/** Clouds were the sky's before they were weather (ADR-0104). */
const CLOUD_FIELDS = {
	cloudCover: "cloudCover",
	cloudColor: "cloudColor",
	cloudSpeed: "cloudSpeed",
};

const TILT_SHIFT_FIELDS = {
	tiltShiftOn: "isOn",
	tiltShiftBlur: "blurStrength",
	tiltShiftFocus: "sharpBandHeight",
	tiltShiftPosition: "sharpBandPosition",
};

/** The time of day, its old `lights` and its one-off `timeKey`, now `data.time`. */
const upgradeLighting = (lighting: unknown) => {
	if (!isRecord(lighting)) {
		return;
	}
	renameFields(lighting, { lights: "whenLightsAreOn" });
	if (Object.hasOwn(lighting, "timeKey")) {
		const key = lighting.timeKey;
		delete lighting.timeKey;
		if (typeof key === "string" && key !== "") {
			const data = groupOf(lighting, "data");
			data.time ??= { key };
		}
	}
	upgradeBindings(lighting.data);
};

/** A world's or a mood's look: the sky's renamed fields, and its clouds moved into the weather. */
const upgradeLook = (look: TRecord) => {
	upgradeLighting(look.lighting);
	const sky = look.sky;
	if (isRecord(sky)) {
		renameFields(sky, RENAMED_SKY_FIELDS);
		const clouds = Object.keys(CLOUD_FIELDS).filter((field) => Object.hasOwn(sky, field));
		if (clouds.length > 0) {
			const weather = groupOf(look, "weather");
			for (const field of clouds) {
				if (!(field in weather)) {
					weather[field] = sky[field];
				}
				delete sky[field];
			}
		}
	}
	if (isRecord(look.weather)) {
		upgradeBindings(look.weather.data);
	}
};

const upgradeCamera = (camera: unknown) => {
	if (!isRecord(camera)) {
		return;
	}
	renameFields(camera, {
		keepOverGround: "keepsOverGround",
		steepestElevation: "highestElevation",
	});
	gatherGroup(camera, "turntable", {
		turntableOn: "isOn",
		turntableSpeed: "speed",
		turntableDelay: "delay",
	});
	gatherGroup(camera, "tiltShift", TILT_SHIFT_FIELDS);
};

const upgradeMood = (mood: TRecord) => {
	upgradeLook(mood);
	// A mood kept the camera's tilt-shift settings under their camera names.
	if (isRecord(mood.camera)) {
		const camera = mood.camera;
		delete mood.camera;
		gatherGroup(camera, "tiltShift", TILT_SHIFT_FIELDS);
		if (isRecord(camera.tiltShift) && !isRecord(mood.tiltShift)) {
			mood.tiltShift = camera.tiltShift;
		}
	}
};

/** Numbers of an object's old turn (`rotation`), `pitch` and `roll`: one rotation, [x, y, z]. */
const upgradeRotation = (entity: TRecord) => {
	const { rotation, pitch, roll } = entity;
	if (
		Array.isArray(rotation) ||
		(rotation === undefined && pitch === undefined && roll === undefined)
	) {
		delete entity.pitch;
		delete entity.roll;
		return;
	}
	const degrees = (value: unknown) => (typeof value === "number" ? value : 0);
	entity.rotation = [degrees(roll), degrees(rotation), degrees(pitch)];
	delete entity.pitch;
	delete entity.roll;
};

const upgradeEntity = (entity: TRecord) => {
	renameFields(entity, { elevation: "altitude", ...RENAMED_LOCK_FIELDS });
	upgradeRotation(entity);
	// No card was `label: null`; now the label's settings are always there (ADR-0104).
	if (entity.label === null) {
		delete entity.label;
	}
	renameFields(entity.label, { enabled: "isShown" });
	renameFields(entity.follow, {
		turns: "turnStyle",
		offset: "startDistance",
		reverse: "drivesTheOtherWay",
	});
	for (const light of recordValues(entity.lights)) {
		renameFields(light, RENAMED_LIGHT_FIELDS);
		renameFields(light.data, RENAMED_LIGHT_SETTINGS);
		upgradeBindings(light.data);
	}
	upgradeColors(entity.colors);
};

const upgradeRoad = (road: TRecord) => {
	renameFields(road, {
		style: "kind",
		closed: "loops",
		markings: "showsCentreLine",
		showMarkings: "showsCentreLine",
		railings: "showsRailings",
		showRailings: "showsRailings",
		supports: "heldUpBy",
		lane: "drivingLane",
		turns: "turnStyle",
		...RENAMED_LOCK_FIELDS,
	});
	moveInto(road, "traffic", {
		drivingLane: "drivingLane",
		turnStyle: "turnStyle",
		leansInTurns: "leansInTurns",
	});
	moveColor(road, "color", "surface");
	moveColor(road, "embankmentColor", "embankment");
	upgradeColors(road.colors);
	upgradeId(road, LEGACY_ROAD_KINDS);
};

const upgradeArea = (area: TRecord) => {
	renameFields(area, { type: "kind", ...RENAMED_LOCK_FIELDS });
	moveColor(area, "color", "surface");
	upgradeColors(area.colors);
	moveInto(area, "water", {
		rippleStrength: "rippleStrength",
		reflectionStrength: "reflectionStrength",
	});
	upgradeId(area, LEGACY_AREA_KINDS);
};

const upgradeFence = (fence: TRecord) => {
	renameFields(fence, { style: "kind", ...RENAMED_LOCK_FIELDS });
	upgradeColors(fence.colors);
	upgradeBindings(fence.data);
};

/** An old `kind` replaced by its numbered id. */
const upgradeId = (item: TRecord, ids: Readonly<Record<string, string>>) => {
	const kind = item.kind;
	if (typeof kind === "string" && Object.hasOwn(ids, kind)) {
		item.kind = ids[kind];
	}
};

/**
 * Viewpoints saved before projections were a choice said `perspective: true`
 * or `false`; they get `projection` instead. Briefly the flat one was called
 * "diorama"; it's "orthographic".
 */
const upgradeViewpoint = (viewpoint: TRecord) => {
	if (viewpoint.projection === "diorama") {
		viewpoint.projection = "orthographic";
	}
	if (typeof viewpoint.perspective === "boolean") {
		viewpoint.projection ??= viewpoint.perspective ? "perspective" : "orthographic";
		delete viewpoint.perspective;
	}
	renameFields(viewpoint, { targetHeight: "targetAltitude" });
};

/** The world's own settings: their renamed fields, and the vehicle settings gathered in `traffic`. */
const upgradeSettings = (world: TRecord) => {
	renameFields(world, { driving: "drivingSide", turns: "turnStyle" });
	moveInto(world, "traffic", {
		drivingSide: "drivingSide",
		turnStyle: "turnStyle",
		leansInTurns: "leansInTurns",
	});
	renameFields(world.traffic, {
		spacing: "keepsDistance",
		keepSpacing: "keepsDistance",
		overtaking: "overtakes",
		allowOvertaking: "overtakes",
	});
	renameFields(world.onScreen, RENAMED_ON_SCREEN_FIELDS);
	upgradeLook(world);
	upgradeCamera(world.camera);
	if (isRecord(world.ground)) {
		moveColor(world.ground, "color", "surface");
		upgradeColors(world.ground.colors);
	}
};

/**
 * A world as saved by an earlier version, with what changed name or place
 * brought up to date. Leaves the input untouched (callers keep it as a backup)
 * and returns a copy. Anything that doesn't look like a world passes through.
 */
export const upgradeLegacyIds = (input: unknown): unknown => {
	if (!isRecord(input)) {
		return input;
	}
	const world = structuredClone(input);
	upgradeSettings(world);
	recordsIn(world.moods).forEach(upgradeMood);
	for (const entity of recordsIn(world.entities)) {
		upgradeEntity(entity);
		upgradeId(entity, LEGACY_PART_KINDS);
	}
	recordsIn(world.roads).forEach(upgradeRoad);
	recordsIn(world.areas).forEach(upgradeArea);
	recordsIn(world.fences).forEach(upgradeFence);
	// The data was a list of values before it had tables and sources (data study).
	if (Array.isArray(world.data)) {
		world.data = { values: world.data };
	}
	if (isRecord(world.data)) {
		for (const entry of recordsIn(world.data.values)) {
			renameFields(entry, { label: "name" });
		}
	}
	recordsIn(world.viewpoints).forEach(upgradeViewpoint);
	return world;
};
