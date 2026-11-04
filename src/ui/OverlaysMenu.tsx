import {
	overlayPlaceWith,
	overlayShownIn,
	setPreference,
	type TOverlay,
	usePreferences,
} from "#/editor/preferences";
import { useEditor } from "#/editor/store";

import { IconButtonGroup } from "./Button";
import { Icon, type TIconName } from "./Icon";
import { Menu } from "./Menu";

/** The overlays, named as on Preferences → Overlays, in its order. */
const OVERLAYS: { key: TOverlay; label: string; icon: TIconName }[] = [
	{ key: "navigationGizmo", label: "Navigation gizmo", icon: "globe" },
	{ key: "viewLabel", label: "View label", icon: "tag" },
	{ key: "viewpointsInWorld", label: "Viewpoints in the world", icon: "camera" },
	{ key: "compositionGrid", label: "Composition grid", icon: "grid" },
	{ key: "groundGrid", label: "Ground grid", icon: "layers" },
];

const openOverlaySettings = () => useEditor.getState().setPreferencesOpen(true, "overlays");

/**
 * Each overlay, ticked while it shows in the mode you're in; ticking switches it there and
 * leaves the other mode as it was (that one is set on Preferences → Overlays, a click away).
 */
const OverlayItems = () => {
	const preferences = usePreferences();
	const mode = useEditor((s) => s.mode);

	return (
		<>
			<Menu.Group label={mode === "edit" ? "Overlays in Edit mode" : "Overlays in View mode"}>
				{OVERLAYS.map(({ key, label, icon }) => (
					<Menu.CheckboxItem
						key={key}
						icon={icon}
						label={label}
						checked={overlayShownIn(preferences[key], mode)}
						onCheckedChange={(on) =>
							setPreference(key, overlayPlaceWith(preferences[key], mode, on))
						}
						keepOpen
					/>
				))}
			</Menu.Group>

			<Menu.Separator />

			<Menu.Item
				icon="eye"
				label="Overlay settings…"
				description="Where each shows: Edit mode, View mode or both"
				onClick={openOverlaySettings}
			/>
		</>
	);
};

/**
 * The toolbar's Overlays menu (ADR-0134), beside the shading switcher, like Blender's: what's
 * drawn over the view (the compass, the view label, viewpoints, the grids), shown or hidden in a
 * click. They're this browser's preferences (ADR-0062), the same as on Preferences → Overlays.
 */
export const OverlaysMenu = () => (
	<IconButtonGroup cluster="Overlays">
		<Menu.Root>
			<Menu.Trigger label="Overlays" tooltip="Overlays">
				<Icon name="overlays" size={18} />
			</Menu.Trigger>

			<Menu.Popup>
				<OverlayItems />
			</Menu.Popup>
		</Menu.Root>
	</IconButtonGroup>
);

/** The Overlays menu folded into the toolbar's More, with the shading switcher (ADR-0080). */
export const OverlaysSubmenu = () => (
	<Menu.Submenu icon="overlays" label="Overlays">
		<OverlayItems />
	</Menu.Submenu>
);
