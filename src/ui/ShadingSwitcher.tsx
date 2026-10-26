import { changedFromPreset } from "#/editor/graphics";
import { setPreference, type TGraphicsPreset, usePreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";

import { IconButton, IconButtonGroup } from "./Button";
import type { TIconName } from "./Icon";

const PRESETS: { preset: TGraphicsPreset; icon: TIconName; label: string }[] = [
	{ preset: "standard", icon: "shadeStandard", label: "Standard: the view as it always was" },
	{ preset: "nice", icon: "shadeNice", label: "Nice: ambient occlusion, real night lights, glow" },
	{
		preset: "ultra",
		icon: "shadeUltra",
		label: "Ultra: everything, reflections and soft shadows too",
	},
];

/**
 * The toolbar's shading switcher (ADR-0080), like Blender's viewport shading:
 * wireframe, or a Graphics preset (ADR-0072) a click away, and the button to
 * the Graphics settings. The presets are the Graphics page's preset, so the
 * choice is this browser's, for every world.
 */
export const ShadingSwitcher = () => {
	const preferences = usePreferences();
	const wireframe = preferences.showWireframe;
	const pick = (preset: TGraphicsPreset) => {
		setPreference("showWireframe", false);
		setPreference("graphicsPreset", preset);
	};
	// The tooltip says so when the current preset's settings were changed on the Graphics page.
	const changed = changedFromPreset(preferences) > 0;

	return (
		<IconButtonGroup cluster="Shading">
			<IconButton
				size="md"
				tooltipSide="bottom"
				icon="shadeWire"
				label="Wireframe: every surface as lines"
				pressed={wireframe}
				onClick={() => setPreference("showWireframe", !wireframe)}
			/>

			{PRESETS.map(({ preset, icon, label }) => (
				<IconButton
					key={preset}
					size="md"
					tooltipSide="bottom"
					icon={icon}
					label={
						changed && preferences.graphicsPreset === preset
							? `${label} (some settings changed)`
							: label
					}
					pressed={!wireframe && preferences.graphicsPreset === preset}
					onClick={() => pick(preset)}
				/>
			))}

			<IconButton
				size="md"
				tooltipSide="bottom"
				icon="chevronDown"
				label="Graphics settings…"
				onClick={() => useEditor.getState().setPreferencesOpen(true, "graphics")}
			/>
		</IconButtonGroup>
	);
};
