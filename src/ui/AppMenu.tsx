import { create } from "zustand";

import { resetThisBrowsersSettings } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";
import { APP_NAME } from "#/lib/app";

import { ConfirmDialog } from "./ConfirmDialog";
import { Menu } from "./Menu";
import { openGuide } from "./Welcome";
import { WipeEverything } from "./WipeEverything";

import styles from "./AppMenu.module.css";

/** Which of the app menu's confirmations is open: the logo's menu and the phones' More menu share them. */
const useAppMenuDialogs = create<{ isWiping: boolean; isResetting: boolean }>(() => ({
	isWiping: false,
	isResetting: false,
}));

/**
 * What's about the app and this browser rather than a world: help (Welcome…,
 * Guide), Preferences…, and what resets this browser (its settings, or
 * everything). In the app menu on the logo, and in the More menu on phones.
 */
export const AppMenuItems = () => {
	const store = () => useEditor.getState();
	return (
		<>
			<Menu.Item
				icon="info"
				label="Welcome…"
				description="The ways to start: build a city, show your data, or open an example"
				onClick={() => store().setWelcomeOpen(true)}
			/>

			<Menu.Item
				icon="newTab"
				label="Guide"
				description="How a world is made, walked through with a real API"
				onClick={openGuide}
			/>

			<Menu.Separator />

			<Menu.Item
				icon="user"
				label="Preferences…"
				description="How the camera moves for you, graphics and overlays, in this browser"
				onClick={() => store().setPreferencesOpen(true)}
			/>

			<Menu.Separator />

			<Menu.Item
				icon="reset"
				label="Reset this browser’s settings…"
				description="Panels, favourites, cameras, Preferences; keeps your worlds"
				onClick={() => useAppMenuDialogs.setState({ isResetting: true })}
			/>

			<Menu.Item
				icon="trash"
				label="Wipe everything…"
				description="Every world, backup and setting in this browser"
				onClick={() => useAppMenuDialogs.setState({ isWiping: true })}
			/>
		</>
	);
};

interface IAppMenuProps {
	/**
	 * On phones the logo gives up its place in a full toolbar: with a world open, its items are in
	 * the More menu instead. On the home screen (only the logo and File) it stays.
	 */
	hidesOnPhones: boolean;
}

/**
 * The app's own menu, on its logo and name at the start of the toolbar (like a
 * desktop app's): help, Preferences and resets (AppMenuItems). The File menu
 * next to it is only about worlds. Its confirmations (Wipe everything, Reset
 * this browser's settings) live here, whichever menu asked for them.
 */
export const AppMenu = ({ hidesOnPhones }: IAppMenuProps) => {
	const { isWiping, isResetting } = useAppMenuDialogs();
	return (
		<>
			<span className={styles.menu} data-hides-on-phones={hidesOnPhones || undefined}>
				<Menu.Root>
					<Menu.Trigger label={`${APP_NAME}: help, preferences and this browser`}>
						<span className={styles.logo} aria-hidden="true" />

						<span className={styles.title}>{APP_NAME}</span>
					</Menu.Trigger>

					<Menu.Popup>
						<AppMenuItems />
					</Menu.Popup>
				</Menu.Root>
			</span>

			<WipeEverything
				open={isWiping}
				onClose={() => useAppMenuDialogs.setState({ isWiping: false })}
			/>

			<ConfirmDialog
				open={isResetting}
				onOpenChange={(open) => useAppMenuDialogs.setState({ isResetting: open })}
				title="Reset this browser’s settings?"
				description="Panel sizes and folds, Add to scene’s favourites and recently used, where the camera was in each world, and Preferences go back to their defaults. Your worlds and backups stay. The page reloads."
				confirmLabel="Reset settings"
				danger
				onConfirm={resetThisBrowsersSettings}
			/>
		</>
	);
};
