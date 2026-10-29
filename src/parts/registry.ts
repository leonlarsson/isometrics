import { variantName } from "#/scene/variants";

import { apartmentBlock01 } from "./buildings/apartment_block_01";
import { barn01 } from "./buildings/barn_01";
import { cafe01 } from "./buildings/cafe_01";
import { church01 } from "./buildings/church_01";
import { depot01 } from "./buildings/depot_01";
import { factory01 } from "./buildings/factory_01";
import { grandstand01 } from "./buildings/grandstand_01";
import { greenhouse01 } from "./buildings/greenhouse_01";
import { house01 } from "./buildings/house_01";
import { lighthouse01 } from "./buildings/lighthouse_01";
import { officeTower01 } from "./buildings/office_tower_01";
import { petrolStation01 } from "./buildings/petrol_station_01";
import { school01 } from "./buildings/school_01";
import { shop01 } from "./buildings/shop_01";
import { shop02 } from "./buildings/shop_02";
import { terracedRow01 } from "./buildings/terraced_row_01";
import { warehouse01 } from "./buildings/warehouse_01";
import { bench01 } from "./furniture/bench_01";
import { bin01 } from "./furniture/bin_01";
import { cafeTable01 } from "./furniture/cafe_table_01";
import { chair01 } from "./furniture/chair_01";
import { flowerPot01 } from "./furniture/flower_pot_01";
import { parasol01 } from "./furniture/parasol_01";
import { picnicTable01 } from "./furniture/picnic_table_01";
import { planter01 } from "./furniture/planter_01";
import { bollardLight01 } from "./infrastructure/bollard_light_01";
import { floodlight01 } from "./infrastructure/floodlight_01";
import { light01 } from "./infrastructure/light_01";
import { parcelStack01 } from "./infrastructure/parcel_stack_01";
import { powerPole01 } from "./infrastructure/power_pole_01";
import { shippingContainer01 } from "./infrastructure/shipping_container_01";
import { solarPanels01 } from "./infrastructure/solar_panels_01";
import { streetLamp01 } from "./infrastructure/street_lamp_01";
import { streetLamp02 } from "./infrastructure/street_lamp_02";
import { streetLamp03 } from "./infrastructure/street_lamp_03";
import { stringLights01 } from "./infrastructure/string_lights_01";
import { towerCrane01 } from "./infrastructure/tower_crane_01";
import { trafficLight01 } from "./infrastructure/traffic_light_01";
import { tunnel01 } from "./infrastructure/tunnel_01";
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
import type { IPartDefinition, TPartCategory } from "./types";
import { bicycle01 } from "./vehicles/bicycle_01";
import { bus01 } from "./vehicles/bus_01";
import { car01 } from "./vehicles/car_01";
import { deliveryVan01 } from "./vehicles/delivery_van_01";
import { ferry01 } from "./vehicles/ferry_01";
import { forklift01 } from "./vehicles/forklift_01";
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
	shop01,
	shop02,
	cafe01,
	school01,
	church01,
	depot01,
	factory01,
	petrolStation01,
	barn01,
	greenhouse01,
	lighthouse01,
	grandstand01,
	deliveryVan01,
	truck01,
	car01,
	bus01,
	tram01,
	tractor01,
	forklift01,
	bicycle01,
	raceCar01,
	yacht01,
	sailingBoat01,
	ferry01,
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
	zone01,
	tunnel01,
	streetLamp01,
	streetLamp02,
	streetLamp03,
	bollardLight01,
	floodlight01,
	stringLights01,
	light01,
	trafficLight01,
	parcelStack01,
	shippingContainer01,
	towerCrane01,
	powerPole01,
	windTurbine01,
	solarPanels01,
	beacon01,
	text01,
];

const byKind = new Map(PARTS.map((part) => [part.kind, part]));
const KINDS = PARTS.map((part) => part.kind);

const partNames = new Map(PARTS.map((part) => [part, variantName(part.kind, part.name, KINDS)]));

/** What to call a part: "Office tower", or "Office tower 2" once its family has several variants. */
export const partName = (part: TAnyPart) =>
	partNames.get(part) ?? variantName(part.kind, part.name, KINDS);

/** The same for a kind; undefined if no part has it. */
export const partNameOf = (kind: string) => {
	const part = byKind.get(kind);
	return part ? partName(part) : undefined;
};

export const getPart = (kind: string): TAnyPart | undefined => {
	return byKind.get(kind);
};

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
