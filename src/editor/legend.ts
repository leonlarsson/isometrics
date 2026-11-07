import { getPart } from "#/parts/registry";
import { nameOfDataKey } from "#/scene/rowData";
import type { TDataBinding, TScene } from "#/scene/schema";

/**
 * A legend from what follows data (ADR-0110): a chip for each kind of thing
 * a value drives (sizes, roads' flows, colours), saying which value and how
 * ("Size: Players, log scale"). Suggested, then edited by hand.
 */

type TLegendEntry = TScene["onScreen"]["legend"][number];

/** What a binding's key names: a value's name, or a column's of the table the thing follows. */
const nameOfKey = (scene: TScene, key: string, dataRow: TScene["entities"][number]["dataRow"]) =>
	nameOfDataKey(scene.data, key, dataRow);

const scaleWords = (binding: TDataBinding) => (binding.usesLogScale ? ", log scale" : "");

/** What a weather setting that follows data brings more of, for its legend chip. */
const WEATHER_WORDS: Readonly<Record<string, string>> = {
	cloudCover: "cloud",
	rainAmount: "rain",
	snowAmount: "snow",
	fogDensity: "fog",
	hazeAmount: "haze",
	lightningRate: "lightning",
};

/** The legend chips the world's bindings suggest, each once. */
export const suggestLegend = (scene: TScene): TLegendEntry[] => {
	const entries = new Map<string, TLegendEntry>();
	const add = (label: string, meaning: string) => {
		if (!entries.has(`${label}:${meaning}`)) {
			entries.set(`${label}:${meaning}`, { label, meaning });
		}
	};
	for (const entity of scene.entities) {
		const part = getPart(entity.kind);
		for (const [setting, binding] of Object.entries(entity.data)) {
			const label =
				setting === "scale" ||
				part?.fields.find((field) => field.key === setting)?.type === "number"
					? "Size"
					: (part?.fields.find((field) => field.key === setting)?.label ?? setting);
			add(label, `${nameOfKey(scene, binding.key, entity.dataRow)}${scaleWords(binding)}`);
		}
		for (const color of Object.values(entity.colors)) {
			if (color.data.color) {
				add("Colour", nameOfKey(scene, color.data.color.key, entity.dataRow));
			}
		}
	}
	for (const road of scene.roads) {
		for (const [setting, binding] of Object.entries(road.data)) {
			const what = nameOfKey(scene, binding.key, road.dataRow);
			add(
				"Roads",
				setting === "width"
					? `${what}: wider, more${scaleWords(binding)}`
					: `${what}: more vehicles, more${scaleWords(binding)}`,
			);
		}
	}
	// Areas' weather and colours (ADR-0151, ADR-0152).
	for (const area of scene.areas) {
		for (const [setting, binding] of Object.entries(area.weather?.data ?? {})) {
			const what = nameOfKey(scene, binding.key, area.dataRow);
			add("Weather", `${what}: more ${WEATHER_WORDS[setting] ?? setting}`);
		}
		for (const color of Object.values(area.colors)) {
			if (color.data.color) {
				add("Colour", nameOfKey(scene, color.data.color.key, area.dataRow));
			}
		}
	}
	return [...entries.values()];
};
