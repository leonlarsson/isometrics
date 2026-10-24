import type { TEntity } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";
import { variantName } from "#/scene/variants";

import { depot01 } from "./buildings/depot_01";
import { grandstand01 } from "./buildings/grandstand_01";
import { house01 } from "./buildings/house_01";
import { officeTower01 } from "./buildings/office_tower_01";
import { warehouse01 } from "./buildings/warehouse_01";
import { parcelStack01 } from "./infrastructure/parcel_stack_01";
import { streetLamp01 } from "./infrastructure/street_lamp_01";
import { tunnel01 } from "./infrastructure/tunnel_01";
import { zone01 } from "./infrastructure/zone_01";
import { beacon01 } from "./markers/beacon_01";
import { text01 } from "./markers/text_01";
import { pineTree01 } from "./nature/pine_tree_01";
import { roundTree01 } from "./nature/round_tree_01";
import type { IPartDefinition, TColorDefault, TPartCategory } from "./types";
import { car01 } from "./vehicles/car_01";
import { deliveryVan01 } from "./vehicles/delivery_van_01";
import { raceCar01 } from "./vehicles/race_car_01";
import { truck01 } from "./vehicles/truck_01";
import { yacht01 } from "./vehicles/yacht_01";

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registry; props are validated per part at runtime
export type TAnyPart = IPartDefinition<any>;

/** Order here is the order shown in the parts palette. */
export const PARTS: TAnyPart[] = [
	warehouse01,
	officeTower01,
	house01,
	depot01,
	grandstand01,
	deliveryVan01,
	truck01,
	car01,
	raceCar01,
	yacht01,
	roundTree01,
	pineTree01,
	zone01,
	tunnel01,
	streetLamp01,
	parcelStack01,
	beacon01,
	text01,
];

const byKind = new Map(PARTS.map((part) => [part.kind, part]));
const KINDS = PARTS.map((part) => part.kind);

/** What to call a part: "Office tower", or "Office tower 2" once its family has several variants. */
export const partName = (part: TAnyPart) => variantName(part.kind, part.name, KINDS);

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

const resolveColorDefault = (value: TColorDefault, palette: IScenePalette) =>
	typeof value === "function" ? value(palette) : value;

export const resolveColors = (
	part: TAnyPart,
	entity: Pick<TEntity, "color" | "accent">,
	palette: IScenePalette,
) => {
	return {
		color: entity.color ?? resolveColorDefault(part.defaultColor, palette),
		accent: entity.accent ?? resolveColorDefault(part.defaultAccent, palette),
	};
};

/** Relative luminance check so pins and dots on white parts use the accent instead. */
const isVeryLight = (hex: string) => {
	const n = Number.parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.82;
};

/** Colour used for an entity's label pin, leader line and card dot. */
export const resolveLabelColor = (
	part: TAnyPart,
	entity: Pick<TEntity, "color" | "accent">,
	palette: IScenePalette,
) => {
	const { color, accent } = resolveColors(part, entity, palette);
	return isVeryLight(color) ? accent : color;
};
