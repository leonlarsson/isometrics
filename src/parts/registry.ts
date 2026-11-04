import { keepOnHotReload } from "#/lib/hot";
import { round } from "#/lib/math";
import { isPrefabKind } from "#/scene/schema";
import { variantName } from "#/scene/variants";

import { apartmentBlock01 } from "./buildings/apartment_block_01";
import { barn01 } from "./buildings/barn_01";
import { cafe01 } from "./buildings/cafe_01";
import { church01 } from "./buildings/church_01";
import { church02 } from "./buildings/church_02";
import { church03 } from "./buildings/church_03";
import { church04 } from "./buildings/church_04";
import { cityHall01 } from "./buildings/city_hall_01";
import { depot01 } from "./buildings/depot_01";
import { factory01 } from "./buildings/factory_01";
import { grandstand01 } from "./buildings/grandstand_01";
import { greenhouse01 } from "./buildings/greenhouse_01";
import { house01 } from "./buildings/house_01";
import { houseCluster01 } from "./buildings/house_cluster_01";
import { lighthouse01 } from "./buildings/lighthouse_01";
import { officeTower01 } from "./buildings/office_tower_01";
import { palace01 } from "./buildings/palace_01";
import { petrolStation01 } from "./buildings/petrol_station_01";
import { school01 } from "./buildings/school_01";
import { shedCluster01 } from "./buildings/shed_cluster_01";
import { shop01 } from "./buildings/shop_01";
import { shop02 } from "./buildings/shop_02";
import { tentCluster01 } from "./buildings/tent_cluster_01";
import { terracedRow01 } from "./buildings/terraced_row_01";
import { terracedRow02 } from "./buildings/terraced_row_02";
import { towerCluster01 } from "./buildings/tower_cluster_01";
import { warehouse01 } from "./buildings/warehouse_01";
import { bench01 } from "./furniture/bench_01";
import { bikeRack01 } from "./furniture/bike_rack_01";
import { bin01 } from "./furniture/bin_01";
import { bollard01 } from "./furniture/bollard_01";
import { busStop01 } from "./furniture/bus_stop_01";
import { cafeTable01 } from "./furniture/cafe_table_01";
import { chair01 } from "./furniture/chair_01";
import { flowerPot01 } from "./furniture/flower_pot_01";
import { fountain01 } from "./furniture/fountain_01";
import { parasol01 } from "./furniture/parasol_01";
import { phoneBox01 } from "./furniture/phone_box_01";
import { picnicTable01 } from "./furniture/picnic_table_01";
import { planter01 } from "./furniture/planter_01";
import { postBox01 } from "./furniture/post_box_01";
import { signpost01 } from "./furniture/signpost_01";
import { slide01 } from "./furniture/slide_01";
import { statue01 } from "./furniture/statue_01";
import { swings01 } from "./furniture/swings_01";
import { bollardLight01 } from "./infrastructure/bollard_light_01";
import { flagpole01 } from "./infrastructure/flagpole_01";
import { floodlight01 } from "./infrastructure/floodlight_01";
import { gantryCrane01 } from "./infrastructure/gantry_crane_01";
import { light01 } from "./infrastructure/light_01";
import { mobileCrane01 } from "./infrastructure/mobile_crane_01";
import { parcelStack01 } from "./infrastructure/parcel_stack_01";
import { powerPole01 } from "./infrastructure/power_pole_01";
import { pylon01 } from "./infrastructure/pylon_01";
import { shippingContainer01 } from "./infrastructure/shipping_container_01";
import { solarPanels01 } from "./infrastructure/solar_panels_01";
import { streetLamp01 } from "./infrastructure/street_lamp_01";
import { streetLamp02 } from "./infrastructure/street_lamp_02";
import { streetLamp03 } from "./infrastructure/street_lamp_03";
import { streetLamp04 } from "./infrastructure/street_lamp_04";
import { stringLights01 } from "./infrastructure/string_lights_01";
import { substation01 } from "./infrastructure/substation_01";
import { towerCrane01 } from "./infrastructure/tower_crane_01";
import { trafficLight01 } from "./infrastructure/traffic_light_01";
import { tunnel01 } from "./infrastructure/tunnel_01";
import { wallLantern01 } from "./infrastructure/wall_lantern_01";
import { windTurbine01 } from "./infrastructure/wind_turbine_01";
import { zone01 } from "./infrastructure/zone_01";
import { beacon01 } from "./markers/beacon_01";
import { text01 } from "./markers/text_01";
import { birch01 } from "./nature/birch_01";
import { bush01 } from "./nature/bush_01";
import { cypress01 } from "./nature/cypress_01";
import { deadTree01 } from "./nature/dead_tree_01";
import { flowerBed01 } from "./nature/flower_bed_01";
import { fruitTree01 } from "./nature/fruit_tree_01";
import { log01 } from "./nature/log_01";
import { palmTree01 } from "./nature/palm_tree_01";
import { pineTree01 } from "./nature/pine_tree_01";
import { pineTree02 } from "./nature/pine_tree_02";
import { reeds01 } from "./nature/reeds_01";
import { rocks01 } from "./nature/rocks_01";
import { roundTree01 } from "./nature/round_tree_01";
import { roundTree02 } from "./nature/round_tree_02";
import { tallGrass01 } from "./nature/tall_grass_01";
import { waterLilies01 } from "./nature/water_lilies_01";
import { arch01 } from "./shapes/arch_01";
import { ball01 } from "./shapes/ball_01";
import { box01 } from "./shapes/box_01";
import { capsule01 } from "./shapes/capsule_01";
import { cone01 } from "./shapes/cone_01";
import { cornerWedge01 } from "./shapes/corner_wedge_01";
import { cylinder01 } from "./shapes/cylinder_01";
import { dome01 } from "./shapes/dome_01";
import { panel01 } from "./shapes/panel_01";
import { pyramid01 } from "./shapes/pyramid_01";
import { stairs01 } from "./shapes/stairs_01";
import { torus01 } from "./shapes/torus_01";
import { wedge01 } from "./shapes/wedge_01";
import type { IPartDefinition, TPartCategory } from "./types";
import { ambulance01 } from "./vehicles/ambulance_01";
import { bicycle01 } from "./vehicles/bicycle_01";
import { bus01 } from "./vehicles/bus_01";
import { car01 } from "./vehicles/car_01";
import { cargoShip01 } from "./vehicles/cargo_ship_01";
import { deliveryVan01 } from "./vehicles/delivery_van_01";
import { ferry01 } from "./vehicles/ferry_01";
import { fireEngine01 } from "./vehicles/fire_engine_01";
import { forklift01 } from "./vehicles/forklift_01";
import { motorbike01 } from "./vehicles/motorbike_01";
import { raceCar01 } from "./vehicles/race_car_01";
import { sailingBoat01 } from "./vehicles/sailing_boat_01";
import { tractor01 } from "./vehicles/tractor_01";
import { tram01 } from "./vehicles/tram_01";
import { truck01 } from "./vehicles/truck_01";
import { yacht01 } from "./vehicles/yacht_01";

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registry; props are validated per part at runtime
export type TAnyPart = IPartDefinition<any>;

/** Order here is the order shown in the parts palette. */
export const PARTS: TAnyPart[] = [
	warehouse01,
	officeTower01,
	apartmentBlock01,
	house01,
	terracedRow01,
	terracedRow02,
	shop01,
	shop02,
	cafe01,
	school01,
	church01,
	church02,
	church03,
	church04,
	palace01,
	cityHall01,
	depot01,
	factory01,
	petrolStation01,
	barn01,
	greenhouse01,
	lighthouse01,
	grandstand01,
	houseCluster01,
	towerCluster01,
	shedCluster01,
	tentCluster01,
	deliveryVan01,
	truck01,
	car01,
	bus01,
	fireEngine01,
	ambulance01,
	tram01,
	tractor01,
	forklift01,
	bicycle01,
	motorbike01,
	raceCar01,
	yacht01,
	sailingBoat01,
	ferry01,
	cargoShip01,
	roundTree01,
	roundTree02,
	pineTree01,
	pineTree02,
	birch01,
	cypress01,
	palmTree01,
	fruitTree01,
	deadTree01,
	bush01,
	flowerBed01,
	tallGrass01,
	reeds01,
	waterLilies01,
	rocks01,
	log01,
	bench01,
	picnicTable01,
	cafeTable01,
	chair01,
	parasol01,
	flowerPot01,
	planter01,
	bin01,
	fountain01,
	statue01,
	slide01,
	swings01,
	bikeRack01,
	bollard01,
	busStop01,
	phoneBox01,
	postBox01,
	signpost01,
	zone01,
	tunnel01,
	streetLamp01,
	streetLamp02,
	streetLamp03,
	streetLamp04,
	wallLantern01,
	flagpole01,
	bollardLight01,
	floodlight01,
	stringLights01,
	light01,
	trafficLight01,
	parcelStack01,
	shippingContainer01,
	towerCrane01,
	mobileCrane01,
	gantryCrane01,
	powerPole01,
	pylon01,
	substation01,
	windTurbine01,
	solarPanels01,
	beacon01,
	text01,
	box01,
	ball01,
	cylinder01,
	cone01,
	pyramid01,
	wedge01,
	cornerWedge01,
	dome01,
	capsule01,
	torus01,
	panel01,
	arch01,
	stairs01,
];

const byKind = new Map(PARTS.map((part) => [part.kind, part]));
const KINDS = PARTS.map((part) => part.kind);

/**
 * The open world's prefabs as parts (ADR-0134), by their ids: the parts made from its designs
 * (`parts/prefabParts`, which the editor hands them to whenever they change). Kept over a hot
 * reload, as the editor hands them over only when they change.
 */
const worldPrefabParts = keepOnHotReload("worldPrefabParts", () => new Map<string, TAnyPart>());

/** Make these the open world's prefabs (parts/prefabParts' `setWorldPrefabs` calls it). */
export const putWorldPrefabParts = (parts: readonly TAnyPart[]) => {
	worldPrefabParts.clear();
	for (const part of parts) {
		worldPrefabParts.set(part.kind, part);
	}
};

/** The open world's prefabs as parts, in the world's order. */
export const worldPrefabPartList = (): TAnyPart[] => [...worldPrefabParts.values()];

const partNames = new Map(PARTS.map((part) => [part, variantName(part.kind, part.name, KINDS)]));

/** What to call a part: "Office tower", or "Office tower 2" once its family has several variants. */
export const partName = (part: TAnyPart) =>
	partNames.get(part) ??
	(isPrefabKind(part.kind) ? part.name : variantName(part.kind, part.name, KINDS));

/** The same for a kind; undefined if no part has it. */
export const partNameOf = (kind: string) => {
	const part = getPart(kind);
	return part ? partName(part) : undefined;
};

/** The part of a kind: one of the registry's, or one of the open world's prefabs (ADR-0134). */
export const getPart = (kind: string): TAnyPart | undefined => {
	return byKind.get(kind) ?? worldPrefabParts.get(kind);
};

/** One of the registry's own parts, never a prefab: what a prefab's pieces may be. */
export const getBasePart = (kind: string): TAnyPart | undefined => byKind.get(kind);

export const partsByCategory = (): [TPartCategory, TAnyPart[]][] => {
	const groups = new Map<TPartCategory, TAnyPart[]>();
	for (const part of PARTS) {
		const list = groups.get(part.category) ?? [];
		list.push(part);
		groups.set(part.category, list);
	}
	return [...groups.entries()];
};

/** Stored props with renamed ones under their new names, unless the new name is set too. */
const withRenamedProps = (part: TAnyPart, raw: Record<string, unknown>) => {
	const renamed = Object.entries(part.renamedProps ?? {}).filter(
		([from, to]) => raw[from] !== undefined && raw[to] === undefined,
	);
	if (renamed.length === 0) {
		return raw;
	}
	const props = { ...raw };
	for (const [from, to] of renamed) {
		props[to] = raw[from];
	}
	return props;
};

/** A part's size with these props, in words to a tenth of a unit: "2 × 1.5 wide, 3 tall". */
export const sizeInWords = (part: TAnyPart, props: Record<string, unknown>) => {
	const [width, depth] = part.footprint(props);
	return `${round(width, 1)} × ${round(depth, 1)} wide, ${round(part.height(props), 1)} tall`;
};

/** A vehicle's length at a scale: vehicles face +X, so it's the footprint's X (smooth turns, leans and rides go by it). */
export const vehicleLengthOf = (part: TAnyPart, props: Record<string, unknown>, scale: number) =>
	part.footprint(props)[0] * scale;

/**
 * A part's props from what's stored: every valid prop as it is, renamed ones
 * under their new names, a missing or invalid one as its default. Props the
 * part doesn't know are left out here, but stay in the world (ADR-0056).
 */
export const resolveProps = (part: TAnyPart, stored: Record<string, unknown>) => {
	const raw = withRenamedProps(part, stored);
	const result = part.schema.safeParse(raw);
	if (result.success) {
		return result.data;
	}
	// Keep the valid keys, default the rest.
	const defaults = part.schema.parse({});
	const merged = { ...defaults };
	for (const key of Object.keys(defaults)) {
		const attempt = part.schema.safeParse({ ...defaults, [key]: raw[key] });
		if (attempt.success) {
			merged[key] = attempt.data[key];
		}
	}
	return merged;
};
