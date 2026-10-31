import { FENCE_STYLE_LABELS, FENCE_STYLES } from "#/fences/registry";
import { getPart, partName } from "#/parts/registry";
import { AREA_KIND_LABELS } from "#/scene/areas";
import { ROAD_KIND_LABELS } from "#/scene/roads";
import type { TColorSetting, TDataBinding, TScene } from "#/scene/schema";

import type { TInspectorTab } from "./store";

/** One thing that shows or follows a data value, and where to go to see it. */
export interface IDataUse {
	/** What follows it, named as the outliner names it ("City hall", "Weather"). */
	thing: string;
	/** Which of its settings, in words ("card", "light Lamp: on and off", "time of day"). */
	setting: string;
	/** The item to select to see it; null for the world's own settings. */
	item: { kind: "entity" | "road" | "area" | "fence"; id: string } | null;
	/** The properties tab it's on. */
	tab: TInspectorTab;
}

/** The settings a value can drive, in words, by their key in a `data` map (ADR-0058, ADR-0102). */
const SETTING_WORDS: Record<string, string> = {
	on: "on and off",
	strength: "strength",
	color: "colour",
	litPaneShare: "lit windows",
	schedule: "schedule",
	builtShare: "how much is built",
	time: "time of day",
	cloudCover: "cloud cover",
	rainAmount: "rain",
	snowAmount: "snow",
	fogDensity: "fog",
	hazeAmount: "haze",
	lightningRate: "lightning",
};

/** The settings in a `data` map that follow `key`, in words. */
const following = (data: Readonly<Record<string, TDataBinding>>, key: string) =>
	Object.entries(data)
		.filter(([, binding]) => binding.key === key)
		.map(([setting]) => SETTING_WORDS[setting] ?? setting);

/** The colours in a `colors` map that follow `key`, each named by `nameOf` its id. */
const followingColors = (
	colors: Readonly<Record<string, TColorSetting>>,
	key: string,
	nameOf: (id: string) => string,
) =>
	Object.entries(colors)
		.filter(([, color]) => color.data.color?.key === key)
		.map(([id]) => `colour ${nameOf(id)}`);

/**
 * Everything in the world that shows or follows the data value `key` (data
 * study): objects' cards, detail tiles, text and settings, fences', roads',
 * areas' and the ground's colours, the time of day, the weather, and each
 * mood's. The same places `renameDataReferences` renames.
 */
export const dataUsesOf = (scene: TScene, key: string): IDataUse[] => {
	const uses: IDataUse[] = [];
	const add = (thing: string, settings: string[], item: IDataUse["item"], tab: TInspectorTab) => {
		for (const setting of settings) {
			uses.push({ thing, setting, item, tab });
		}
	};

	for (const entity of scene.entities) {
		const part = getPart(entity.kind);
		const thing = entity.name || (part ? partName(part) : entity.kind);
		const item = { kind: "entity", id: entity.id } as const;
		add(thing, entity.label.dataKeys.includes(key) ? ["card"] : [], item, "label");
		add(thing, entity.details.dataKeys.includes(key) ? ["detail tile"] : [], item, "label");
		const fields = (part?.fields ?? []).filter(
			(field) => field.type === "dataKey" && entity.props[field.key] === key,
		);
		add(
			thing,
			fields.map((field) => field.label.toLowerCase()),
			item,
			"shape",
		);
		for (const [id, light] of Object.entries(entity.lights)) {
			const name = part?.lights?.find((spec) => spec.id === id)?.name ?? id;
			add(
				thing,
				following(light.data, key).map((setting) => `light ${name}: ${setting}`),
				item,
				"lights",
			);
		}
		add(
			thing,
			followingColors(
				entity.colors,
				key,
				(id) => part?.colors.find((spec) => spec.id === id)?.name ?? id,
			),
			item,
			"look",
		);
	}

	for (const fence of scene.fences) {
		const thing = fence.name || FENCE_STYLE_LABELS[fence.kind];
		const item = { kind: "fence", id: fence.id } as const;
		add(thing, following(fence.data, key), item, "shape");
		const style = FENCE_STYLES[fence.kind];
		add(
			thing,
			followingColors(
				fence.colors,
				key,
				(id) => style?.colors.find((spec) => spec.id === id)?.name ?? id,
			),
			item,
			"look",
		);
	}
	for (const road of scene.roads) {
		add(
			road.name || ROAD_KIND_LABELS[road.kind],
			followingColors(road.colors, key, (id) => id),
			{ kind: "road", id: road.id },
			"look",
		);
	}
	for (const area of scene.areas) {
		add(
			area.name || AREA_KIND_LABELS[area.kind],
			followingColors(area.colors, key, (id) => id),
			{ kind: "area", id: area.id },
			"look",
		);
	}

	add(
		"Ground",
		followingColors(scene.ground.colors, key, (id) => id),
		null,
		"world",
	);
	add("Time & light", following(scene.lighting.data, key), null, "light");
	add("Weather", following(scene.weather.data, key), null, "weather");
	for (const mood of scene.moods) {
		add(
			`Mood ${mood.name}`,
			[...following(mood.lighting.data, key), ...following(mood.weather.data, key)],
			null,
			"moods",
		);
	}
	return uses;
};
