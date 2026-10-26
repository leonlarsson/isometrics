import { changedFromPreset } from "#/editor/graphics";
import { setPreference, type TGraphicsPreset, usePreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";

import { IconButton, IconButtonGroup } from "./Button";
import type { TIconName } from "./Icon";
import { Menu } from "./Menu";

const PRESETS: { preset: TGraphicsPreset; icon: TIconName; name: string; drawn: string }[] = [
	{
		preset: "standard",
		icon: "shadeStandard",
		name: "Standard",
		drawn: "the view as it always was",
	},
	{
		preset: "nice",
		icon: "shadeNice",
		name: "Nice",
		drawn: "ambient occlusion, real night lights, glow",
	},
	{
		preset: "ultra",
		icon: "shadeUltra",
		name: "Ultra",
		drawn: "everything, reflections and soft shadows too",
	},
];

const WIREFRAME = { name: "Wireframe", drawn: "every surface as lines" };

/** Shows the view in a preset, out of wireframe. */
const pickPreset = (preset: TGraphicsPreset) => {
	setPreference("showWireframe", false);
	setPreference("graphicsPreset", preset);
};

const openGraphicsSettings = () => useEditor.getState().setPreferencesOpen(true, "graphics");

/**
 * The toolbar's shading switcher (ADR-0080), like Blender's viewport shading:
 * wireframe, or a Graphics preset (ADR-0072) a click away, and the button to
 * the Graphics settings. The presets are the Graphics page's preset, so the
 * choice is this browser's, for every world.
 */
export const ShadingSwitcher = () => {
	const preferences = usePreferences();
	const wireframe = preferences.showWireframe;
	// The tooltip says so when the current preset's settings were changed on the Graphics page.
	const changed = changedFromPreset(preferences) > 0;

	return (
		<IconButtonGroup cluster="Shading">
			<IconButton
				size="md"
				tooltipSide="bottom"
				icon="shadeWire"
				label={`${WIREFRAME.name}: ${WIREFRAME.drawn}`}
				pressed={wireframe}
				onClick={() => setPreference("showWireframe", !wireframe)}
			/>

			{PRESETS.map(({ preset, icon, name, drawn }) => {
				const label = `${name}: ${drawn}`;
				return (
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
						onClick={() => pickPreset(preset)}
					/>
				);
			})}

			<IconButton
				size="md"
				tooltipSide="bottom"
				icon="chevronDown"
				label="Graphics settings…"
				onClick={openGraphicsSettings}
			/>
		</IconButtonGroup>
	);
};

/** The shading switcher on phones (ADR-0080): the same choices as a group in the toolbar's More menu. */
export const ShadingMenuGroup = () => {
	const preferences = usePreferences();
	const wireframe = preferences.showWireframe;

	return (
		<Menu.Group label="Shading">
			<Menu.CheckboxItem
				icon="shadeWire"
				label={WIREFRAME.name}
				checked={wireframe}
				onCheckedChange={() => setPreference("showWireframe", !wireframe)}
			/>

			{PRESETS.map(({ preset, icon, name }) => (
				<Menu.CheckboxItem
					key={preset}
					icon={icon}
					label={name}
					checked={!wireframe && preferences.graphicsPreset === preset}
					onCheckedChange={() => pickPreset(preset)}
				/>
			))}

			<Menu.Item icon="chevronDown" label="Graphics settings…" onClick={openGraphicsSettings} />
		</Menu.Group>
	);
};
