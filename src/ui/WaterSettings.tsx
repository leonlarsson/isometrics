import { useGraphics } from "#/editor/graphics";
import { useEditor } from "#/editor/store";

import { Button } from "./Button";
import { Hint, Section, SliderField } from "./fields";

const percent = (amount: number) => `${Math.round(amount * 100)}%`;

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
				Ripples show where water reflections are on (Preferences → Graphics, Ultra), not here yet.
			</Hint>

			<Button size="sm" onClick={() => useEditor.getState().setPreferencesOpen(true)}>
				Preferences…
			</Button>
		</>
	);
};

/** Sun & sky → Water: how rippled the world's water is, unless an area sets its own. */
export const WaterSection = () => {
	const rippleStrength = useEditor((s) => s.scene.water.rippleStrength);
	const commit = useEditor((s) => s.commit);
	const set = (value: number, coalesce?: string) =>
		commit(
			(scene) => {
				scene.water.rippleStrength = value;
			},
			coalesce ? { coalesce } : undefined,
		);
	return (
		<Section
			id="sky.water"
			icon="area"
			title="Water"
			keywords="water ripples waves calm choppy mirror"
		>
			<SliderField
				label="Ripples on the water"
				value={Math.round(rippleStrength * 100)}
				min={0}
				max={100}
				step={5}
				suffix="%"
				onChange={(value) => set(value / 100, "water.rippleStrength")}
				inherit={{
					from: "default",
					inherited: rippleStrength === 0.5,
					onReset: () => set(0.5),
					value: percent(0.5),
				}}
				hint="0% is mirror-calm, 100% choppy. A water area can set its own (its Look tab)."
			/>

			<RipplesNote />
		</Section>
	);
};
