import { create } from "zustand";

import type { IBrowserContents } from "#/editor/browserExport";
import {
	addBrowserExport,
	exportThisBrowser,
	pickBrowserExport,
	replaceWithBrowserExport,
} from "#/editor/fileActions";
import { formatStorageSize, listWorlds } from "#/editor/persistence";
import { localDateTime } from "#/lib/when";
import { plural } from "#/scene/format";

import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Hint, RadioGroupField, resetToDefault, SwitchField } from "./fields";
import { List, ListItem } from "./List";

/** How an export is brought in; "" until the person has chosen. */
type TImportWay = "" | "add" | "replace";

interface IImportBrowserState {
	/** The export being imported (null: none). */
	contents: IBrowserContents | null;
	way: TImportWay;
	/** Add only: the file's settings take the place of this browser's too. */
	withSettings: boolean;
	/** Import was clicked with Replace chosen: its confirmation is open. */
	isReplacing: boolean;
}

const NOTHING_CHOSEN: Omit<IImportBrowserState, "contents"> = {
	way: "",
	withSettings: false,
	isReplacing: false,
};

const useImportBrowser = create<IImportBrowserState>(() => ({
	contents: null,
	...NOTHING_CHOSEN,
}));

/** Import a browser's export… (the app menu): pick the file, then say what's in it and offer Add or Replace. */
export const importBrowsersExport = async () => {
	const contents = await pickBrowserExport();
	if (contents) {
		useImportBrowser.setState({ contents, ...NOTHING_CHOSEN });
	}
};

/** How many worlds are listed by name before "and N more". */
const TITLES_SHOWN = 5;
/**
 * Said in the dialog and the Replace confirmation: a file never brings the
 * addresses this browser reads without asking (ADR-0119, ADR-0140).
 */
const LINKS_STAY =
	"Allowed external sources aren’t brought in: the ones this browser reads stay as they are, and a world from the export asks again before it reads one.";

/** "A, B and C", or "A, B, C and 4 more" past `shown`. */
const nameSome = (names: string[], shown: number) => {
	const named = names.slice(0, shown);
	const more = names.length - named.length;
	if (more > 0) {
		return `${named.join(", ")} and ${more} more`;
	}
	return named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named.at(-1)}` : named.join("");
};

const cut = (text: string, length: number) =>
	text.length > length ? `${text.slice(0, length - 1)}…` : text;

/**
 * Importing a browser's export (ADR-0140): what's in it (worlds, backups,
 * settings, when it was exported), then the person chooses how to bring it
 * in and clicks Import, which waits for a choice. **Add to this browser**
 * puts its worlds and backups beside this browser's (and, with **Also bring
 * in its settings**, its settings over this browser's) at once. **Replace
 * this browser’s** asks first, with the weight of Wipe everything (a
 * countdown, and Export this browser first), because this browser's worlds
 * and settings make way, kept as one backup under File → Backups.
 */
export const ImportBrowserDialog = () => {
	const { contents, way, withSettings, isReplacing } = useImportBrowser();
	const close = () => useImportBrowser.setState({ contents: null, ...NOTHING_CHOSEN });
	const titles = contents?.worlds.map((world) => cut(world.title, 60)) ?? [];
	const worldsHere = isReplacing ? listWorlds().length : 0;

	return (
		<>
			<Dialog
				open={contents !== null && !isReplacing}
				onOpenChange={(open) => {
					if (!open) {
						close();
					}
				}}
				title="Import a browser’s export"
				description={
					contents
						? `${contents.exportedAt ? `Exported ${localDateTime(contents.exportedAt)}` : "Exported at an unknown time"}, ${formatStorageSize(contents.size)} in all.`
						: undefined
				}
				confirm={{
					label: "Import",
					disabled: way === "",
					// Replace opens its confirmation in this dialog's place; Add closes it itself.
					keepOpen: true,
					onConfirm: () => {
						if (!contents) {
							return;
						}
						if (way === "replace") {
							useImportBrowser.setState({ isReplacing: true });
						} else if (way === "add") {
							close();
							addBrowserExport(contents, withSettings);
						}
					},
				}}
			>
				{contents && (
					<List>
						<ListItem
							stacked
							label={plural(contents.worlds.length, "world")}
							meta={titles.length > 0 ? nameSome(titles, TITLES_SHOWN) : "None"}
						/>

						<ListItem
							stacked
							label={plural(contents.backups, "backup")}
							meta="Copies of worlds kept before they were deleted or repaired"
						/>

						<ListItem
							stacked
							label={plural(contents.settings, "setting")}
							meta="Preferences (graphics too), panels, favourites, cameras and shared links"
						/>
					</List>
				)}

				{contents && contents.leftOut > 0 && (
					<Hint>
						{`${plural(contents.leftOut, "entry", "entries")} in the file are left out: not this app’s, not text, or allowed external sources.`}
					</Hint>
				)}

				<RadioGroupField<TImportWay>
					label="How to bring it in"
					value={way}
					options={[
						{
							value: "add",
							label: "Add to this browser",
							meta: "Its worlds and backups go beside yours; one with the same id as yours goes in as a copy.",
						},
						{
							value: "replace",
							label: "Replace this browser’s",
							meta: "Its worlds and settings take the place of yours, and its backups join yours. This browser as it is now is kept first, under File → Backups.",
						},
					]}
					onChange={(next) => useImportBrowser.setState({ way: next })}
					hasNoDefault
					hint={LINKS_STAY}
				/>

				{way === "add" && (
					<SwitchField
						label="Also bring in its settings"
						checked={withSettings}
						onChange={(next) => useImportBrowser.setState({ withSettings: next })}
						inherit={resetToDefault(withSettings, false, () =>
							useImportBrowser.setState({ withSettings: false }),
						)}
						hint="Its Preferences (graphics too), panels, favourites and cameras take the place of this browser’s, and the page reloads. Off: yours stay as they are."
					/>
				)}
			</Dialog>

			<ConfirmDialog
				open={contents !== null && isReplacing}
				onOpenChange={(open) => {
					if (!open) {
						close();
					}
				}}
				title="Replace this browser’s worlds and settings?"
				description={
					contents
						? `Your ${plural(worldsHere, "world")} and settings make way for the export’s ${plural(contents.worlds.length, "world")} and ${plural(contents.settings, "setting")}. This browser as it is now is kept under File → Backups first, to download or bring back. ${LINKS_STAY} The page reloads.`
						: ""
				}
				confirmLabel="Replace this browser’s"
				danger
				confirmDelaySeconds={3}
				extraAction={{ label: "Export this browser first", onClick: exportThisBrowser }}
				onConfirm={() => {
					if (contents) {
						replaceWithBrowserExport(contents);
					}
				}}
			/>
		</>
	);
};
