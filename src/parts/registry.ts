import type { TEntity } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { house, shed, tower, warehouse } from "./buildings";
import { beacon, lamp, parcels, road, zone } from "./infrastructure";
import { pine, tree } from "./nature";
import type { IPartDefinition, TColorDefault, TPartCategory } from "./types";
import { car, truck, van } from "./vehicles";

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registry; props are validated per part at runtime
export type TAnyPart = IPartDefinition<any>;

/** Order here is the order shown in the parts palette. */
export const PARTS: TAnyPart[] = [
	warehouse,
	tower,
	house,
	shed,
	van,
	truck,
	car,
	tree,
	pine,
	road,
	zone,
	lamp,
	parcels,
	beacon,
];

const byKind = new Map(PARTS.map((part) => [part.kind, part]));

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

/** Parse stored props with the part's schema, falling back to defaults. */
export const resolveProps = (part: TAnyPart, raw: Record<string, unknown>) => {
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
