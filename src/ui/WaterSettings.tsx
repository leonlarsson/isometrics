import { useGraphics } from "#/editor/graphics";
import { useEditor } from "#/editor/store";
import { type TWater, WaterSchema } from "#/scene/schema";

import { Button } from "./Button";
import { Hint, Section, SliderField } from "./fields";

const percent = (amount: number) => `${Math.round(amount * 100)}%`;

const WATER_DEFAULTS = WaterSchema.parse({});

/**
 * Where ripples show: only where the viewer's graphics settings draw water
 * reflections (ADR-0075). Says so while they don't here, with the way there.
 */
export const RipplesNote = () => {
	const reflects = useGraphics().showWaterReflections;
	if (reflects) {
		return null;
	}
	return (
		<>
			<Hint>
				Ripples and reflections show where water reflections are on (Preferences → Graphics, Nice
				and Ultra), not here yet.
			</Hint>

			<Button size="sm" onClick={() => useEditor.getState().setPreferencesOpen(true)}>
				Preferences…
			</Button>
		</>
	);
};

/** Sky & water → Water: how rippled and how mirroring the world's water is, unless an area sets its own. */
export const WaterSection = () => {
	const water = useEditor((s) => s.scene.water);
	const commit = useEditor((s) => s.commit);
	const set = <K extends keyof TWater>(key: K, value: TWater[K], coalesce?: boolean) =>
		commit(
			(scene) => {
				scene.water[key] = value;
			},
			coalesce ? { coalesce: `water.${key}` } : undefined,
		);
	return (
		<Section
			id="sky.water"
			icon="area"
			title="Water"
			keywords="water ripples waves calm choppy mirror reflections"
		>
			<SliderField
				label="Ripples on the water"
				value={Math.round(water.rippleStrength * 100)}
				min={0}
				max={100}
				step={5}
				suffix="%"
				onChange={(value) => set("rippleStrength", value / 100, true)}
				inherit={{
					from: "default",
					inherited: water.rippleStrength === WATER_DEFAULTS.rippleStrength,
					onReset: () => set("rippleStrength", WATER_DEFAULTS.rippleStrength),
					value: percent(WATER_DEFAULTS.rippleStrength),
				}}
				hint="0% is mirror-calm, 100% choppy. A water area can set its own (its Look tab)."
			/>

			<SliderField
				label="Reflections on the water"
				value={Math.round(water.reflectionStrength * 100)}
				min={0}
				max={100}
				step={5}
				suffix="%"
				onChange={(value) => set("reflectionStrength", value / 100, true)}
				inherit={{
					from: "default",
					inherited: water.reflectionStrength === WATER_DEFAULTS.reflectionStrength,
					onReset: () => set("reflectionStrength", WATER_DEFAULTS.reflectionStrength),
					value: percent(WATER_DEFAULTS.reflectionStrength),
				}}
				hint="How strongly the water mirrors the world: 0% shows only its ripples catching the lights. A water area can set its own."
			/>

			<RipplesNote />
		</Section>
	);
};
