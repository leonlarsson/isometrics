import { detectPlatform, formatForDisplay, useHotkeyRegistrations } from "@tanstack/react-hotkeys";
import { useState } from "react";

import {
	type IControlGroup,
	keyCapsOf,
	keyGroupsOf,
	mouseGroupsOf,
	openControls,
	useControlsPanel,
} from "#/editor/controls";
import { usePreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Hint, Kbd, SearchField } from "./fields";

import styles from "./ControlsDialog.module.css";

/** Words between the key caps ("or", "drag", "click") read as words, not keys. */
const WORDS = new Set(["or", "to", "drag", "click", "drag it"]);

const Press = ({ press }: { press: readonly string[] }) => (
	<span className={styles.press}>
		{press.map((part, index) =>
			WORDS.has(part) ? (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, never reordered
				<span key={index} className={styles.word}>
					{part}
				</span>
			) : (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, never reordered
				<Kbd key={index}>{part}</Kbd>
			),
		)}
	</span>
);

const Groups = ({ groups }: { groups: readonly IControlGroup[] }) =>
	groups.map((group) => (
		<section key={group.title} className={styles.group} aria-label={group.title}>
			<h3 className={styles.title}>{group.title}</h3>

			<dl className={styles.rows}>
				{group.controls.map((control) => (
					<div key={control.does + control.press.join(" ")} className={styles.row}>
						<dt>
							<Press press={control.press} />
						</dt>

						<dd className={styles.does}>{control.does}</dd>
					</div>
				))}
			</dl>
		</section>
	));

/** Groups with only the rows whose keys or words match a search. */
const matching = (groups: readonly IControlGroup[], search: string) => {
	const words = search.trim().toLowerCase();
	if (!words) {
		return groups;
	}
	return groups
		.map((group) => ({
			...group,
			controls: group.controls.filter((control) =>
				`${group.title} ${control.does} ${control.press.join(" ")}`.toLowerCase().includes(words),
			),
		}))
		.filter((group) => group.controls.length > 0);
};

/**
 * Keys and mouse (ADR-0157): what every key, click and drag does, opened with
 * ? or from the app menu. The keys are the editor's registered shortcuts (so a
 * new one shows up by itself) and the mouse follows the preferences, so it
 * says what this browser does now.
 */
export const ControlsDialog = () => {
	const isOpen = useControlsPanel((s) => s.isOpen);
	return isOpen ? <ControlsDialogOpen /> : null;
};

/** Mounted only while open: the registrations re-render it on every key press. */
const ControlsDialogOpen = () => {
	const registrations = useHotkeyRegistrations();
	const preferences = usePreferences();
	const [search, setSearch] = useState("");
	const platform = detectPlatform();
	const mouse = mouseGroupsOf(preferences, platform);
	// A chord gives its key caps, a sequence one list per step.
	const keys = keyGroupsOf(registrations, (hotkey) => {
		const parts = formatForDisplay(hotkey, { platform, parts: true, useSymbols: false });
		return keyCapsOf((parts as string[] | string[][]).flat());
	});
	const shownMouse = matching(mouse, search);
	const shownKeys = matching(keys, search);

	return (
		<Dialog
			open
			onOpenChange={openControls}
			title="Keys and mouse"
			description="What every key, click and drag does. Press ? to open this again."
			wide
		>
			<SearchField value={search} onChange={setSearch} label="Search the keys and mouse" />

			<div className={styles.columns}>
				<div className={styles.column}>
					<h2 className={styles.heading}>Mouse and touch</h2>

					<Groups groups={shownMouse} />

					<Hint>
						What Shift and Alt do with a drag is yours to choose, in Preferences → Camera.
					</Hint>

					<div>
						<Button
							size="sm"
							onClick={() => {
								openControls(false);
								useEditor.getState().setPreferencesOpen(true);
							}}
						>
							Open Preferences
						</Button>
					</div>
				</div>

				<div className={styles.column}>
					<h2 className={styles.heading}>Keys</h2>

					<Groups groups={shownKeys} />

					<Hint>
						Drawing, painting and moving with G, R or S show their own keys in their bar while you
						use them.
					</Hint>
				</div>
			</div>

			{shownMouse.length + shownKeys.length === 0 && (
				<Hint>Nothing matches “{search.trim()}”.</Hint>
			)}
		</Dialog>
	);
};
