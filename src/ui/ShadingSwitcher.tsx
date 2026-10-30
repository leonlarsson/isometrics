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
		drawn: "ambient occlusion, real night lights, glow, reflections, boat wakes",
	},
	{
		preset: "ultra",
		icon: "shadeUltra",
		name: "Ultra",
		drawn: "everything, a colour grade, soft shadows and waves behind boats too",
	},
];

const WIREFRAME = { name: "Wireframe", drawn: "every surface as lines" };
const CLAY = {
	name: "Clay",
	drawn: "every surface in one matte colour: only shapes, light and shadow",
};

/** Shows the view in a preset, out of wireframe and clay. */
const pickPreset = (preset: TGraphicsPreset) => {
	setPreference("showWireframe", false);
	setPreference("showClay", false);
	setPreference("graphicsPreset", preset);
};

/** Wireframe or clay, on or off; one at a time. */
const toggleWireframe = (on: boolean) => {
	setPreference("showClay", false);
	setPreference("showWireframe", on);
};
const toggleClay = (on: boolean) => {
	setPreference("showWireframe", false);
	setPreference("showClay", on);
};

const openGraphicsSettings = () => useEditor.getState().setPreferencesOpen(true, "graphics");

const openRenderDialog = () => useEditor.getState().setRenderDialogOpen(true);

/**
 * The toolbar's shading switcher (ADR-0080), like Blender's viewport shading:
 * wireframe, clay, or a Graphics preset (ADR-0072) a click away, and the button to
 * the Graphics settings. The presets are the Graphics page's preset, so the
 * choice is this browser's, for every world.
 */
export const ShadingSwitcher = () => {
	const preferences = usePreferences();
	const wireframe = preferences.showWireframe;
	const clay = preferences.showClay && !wireframe;
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
				onClick={() => toggleWireframe(!wireframe)}
			/>

			<IconButton
				size="md"
				tooltipSide="bottom"
				icon="shadeClay"
				label={`${CLAY.name}: ${CLAY.drawn}`}
				pressed={clay}
				onClick={() => toggleClay(!clay)}
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
						pressed={!wireframe && !clay && preferences.graphicsPreset === preset}
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

			<IconButton
				size="md"
				tooltipSide="bottom"
				icon="picture"
				label="Render a picture…"
				onClick={openRenderDialog}
			/>
		</IconButtonGroup>
	);
};

/** The shading switcher on phones (ADR-0080): the same choices as a group in the toolbar's More menu. */
export const ShadingMenuGroup = () => {
	const preferences = usePreferences();
	const wireframe = preferences.showWireframe;
	const clay = preferences.showClay && !wireframe;

	return (
		<Menu.Group label="Shading">
			<Menu.CheckboxItem
				icon="shadeWire"
				label={WIREFRAME.name}
				checked={wireframe}
				onCheckedChange={() => toggleWireframe(!wireframe)}
			/>

			<Menu.CheckboxItem
				icon="shadeClay"
				label={CLAY.name}
				checked={clay}
				onCheckedChange={() => toggleClay(!clay)}
			/>

			{PRESETS.map(({ preset, icon, name }) => (
				<Menu.CheckboxItem
					key={preset}
					icon={icon}
					label={name}
					checked={!wireframe && !clay && preferences.graphicsPreset === preset}
					onCheckedChange={() => pickPreset(preset)}
				/>
			))}

			<Menu.Item icon="chevronDown" label="Graphics settings…" onClick={openGraphicsSettings} />

			<Menu.Item icon="picture" label="Render a picture…" onClick={openRenderDialog} />
		</Menu.Group>
	);
};
