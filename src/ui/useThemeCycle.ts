import { useEditor } from "#/editor/store";
import type { TThemePreference } from "#/scene/schema";

import type { TIconName } from "./Icon";

const THEME_CYCLE: Record<
	TThemePreference,
	{ next: TThemePreference; icon: TIconName; label: string; nextLabel: string }
> = {
	system: {
		next: "light",
		icon: "system",
		label: "Theme: match device",
		nextLabel: "Switch to light",
	},
	light: { next: "dark", icon: "sun", label: "Theme: light", nextLabel: "Switch to dark" },
	dark: { next: "system", icon: "moon", label: "Theme: dark", nextLabel: "Switch to match device" },
};

/**
 * The theme button's look and what it does: light, dark, then matching the device again. In the
 * app row's tray, and in the view bar's More on phones, where the tray has no room.
 */
export const useThemeCycle = () => {
	const theme = useEditor((s) => s.scene.theme);
	const commit = useEditor((s) => s.commit);
	const info = THEME_CYCLE[theme];
	const cycle = () =>
		commit((s) => {
			s.theme = info.next;
		});
	return { icon: info.icon, label: info.label, nextLabel: info.nextLabel, cycle };
};
