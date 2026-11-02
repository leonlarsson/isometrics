import { suggestLegend } from "#/editor/legend";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";

import { Button, ButtonGroup } from "./Button";
import { CheckboxGroupField, FieldGroup, Hint, resetToDefault, Section, TextField } from "./fields";

/**
 * What View mode shows of the data besides cards (ADR-0110): the legend's
 * chips under the title (suggested from what follows data, then edited), and
 * tiles for the world's main values along the bottom. In the World tab, next
 * to what else View mode shows (ADR-0123).
 */
export const LegendSection = () => {
	const legend = useEditor((s) => s.scene.onScreen.legend);
	const tileKeys = useEditor((s) => s.scene.onScreen.tileKeys);
	const values = useEditor((s) => s.scene.data.values);
	const commit = useEditor((s) => s.commit);
	const setLegend = (next: typeof legend, coalesce?: string) =>
		commit(
			(scene) => {
				scene.onScreen.legend = next;
			},
			coalesce ? { coalesce: `legend:${coalesce}` } : undefined,
		);
	return (
		<Section
			id="data.dashboard"
			defaultClosed
			icon="tag"
			title="Legend and tiles"
			keywords="legend chips encoding key tiles dashboard view mode main values"
		>
			<Hint>
				Chips under the title say what sizes, roads and colours mean (Suggest chips writes one for
				each that follows data); tiles show the world's main values along the bottom, in View mode.
			</Hint>

			{legend.map((entry, index) => (
				<FieldGroup
					// biome-ignore lint/suspicious/noArrayIndexKey: chips are edited in place, by position
					key={index}
					title={`Chip ${index + 1}`}
				>
					<TextField
						label="Label"
						value={entry.label}
						onChange={(label) =>
							setLegend(
								legend.map((each, i) => (i === index ? { ...each, label } : each)),
								`${index}:label`,
							)
						}
						hasNoDefault
					/>

					<TextField
						label="Meaning"
						value={entry.meaning}
						onChange={(meaning) =>
							setLegend(
								legend.map((each, i) => (i === index ? { ...each, meaning } : each)),
								`${index}:meaning`,
							)
						}
						hasNoDefault
					/>

					<Button
						size="sm"
						icon="trash"
						onClick={() => setLegend(legend.filter((_, i) => i !== index))}
					>
						Remove chip
					</Button>
				</FieldGroup>
			))}

			<ButtonGroup>
				<Button
					size="sm"
					icon="plus"
					onClick={() => setLegend([...legend, { label: "Size", meaning: "" }])}
				>
					Add a chip
				</Button>

				<Button
					size="sm"
					icon="search"
					onClick={() => {
						// Adds the chips that are missing, keeping those edited by hand.
						const missing = suggestLegend(useEditor.getState().scene).filter(
							(chip) =>
								!legend.some((each) => each.label === chip.label && each.meaning === chip.meaning),
						);
						if (missing.length === 0) {
							notify(
								legend.length > 0 ? "No chips missing" : "Nothing follows data yet",
								legend.length > 0
									? "Every size, road and colour that follows data has a chip."
									: "Make a size, a road's flow or a colour follow data, then suggest again.",
							);
							return;
						}
						setLegend([...legend, ...missing]);
					}}
				>
					Suggest chips
				</Button>
			</ButtonGroup>

			{values.length > 0 ? (
				<CheckboxGroupField
					label="Tiles"
					options={values.map((entry) => ({ value: entry.key, label: entry.name || entry.key }))}
					value={tileKeys}
					onChange={(keys) =>
						commit((scene) => {
							scene.onScreen.tileKeys = keys;
						})
					}
					inherit={resetToDefault(
						tileKeys,
						[],
						() =>
							commit((scene) => {
								scene.onScreen.tileKeys = [];
							}),
						"none",
					)}
				/>
			) : (
				<Hint>Tiles show the world's values: add one in the Data tab first.</Hint>
			)}
		</Section>
	);
};
