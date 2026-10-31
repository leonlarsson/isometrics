import { getPart } from "#/parts/registry";
import { columnOfKey, tableOfRow } from "#/scene/rowData";
import type { TDataBinding, TScene } from "#/scene/schema";

/**
 * A legend from what follows data (ADR-0110): a chip for each kind of thing
 * a value drives (sizes, roads' flows, colours), saying which value and how
 * ("Size: Players, log scale"). Suggested, then edited by hand.
 */

type TLegendEntry = TScene["onScreen"]["legend"][number];

/** What a binding's key names: a value's name, or a column's of the table the thing follows. */
const nameOfKey = (scene: TScene, key: string, dataRow: TScene["entities"][number]["dataRow"]) => {
	const column = columnOfKey(key);
	if (column !== null) {
		const table = tableOfRow(scene.data, dataRow);
		const found = table?.columns.find((each) => each.key === column);
		return found?.name || column;
	}
	const value = scene.data.values.find((each) => each.key === key);
	return value?.name || key;
};

const scaleWords = (binding: TDataBinding) => (binding.usesLogScale ? ", log scale" : "");

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
	return [...entries.values()];
};
