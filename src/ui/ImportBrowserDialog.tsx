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

import { ActionCards } from "./ActionCards";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Hint } from "./fields";
import { List, ListItem } from "./List";

/** The export being imported (null: none), and whether Replace is being confirmed. */
const useImportBrowser = create<{ contents: IBrowserContents | null; isReplacing: boolean }>(
	() => ({ contents: null, isReplacing: false }),
);

/** Import a browser's export… (the app menu): pick the file, then say what's in it and offer Add or Replace. */
export const importBrowsersExport = async () => {
	const contents = await pickBrowserExport();
	if (contents) {
		useImportBrowser.setState({ contents, isReplacing: false });
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
 * settings, when it was exported) and the two ways to bring it in. **Add to
 * this browser** puts its worlds and backups beside this browser's, at once.
 * **Replace this browser’s** asks first, with the weight of Wipe everything
 * (a countdown, and Export this browser first), because this browser's worlds
 * and settings make way, kept as one backup under File → Backups.
 */
export const ImportBrowserDialog = () => {
	const { contents, isReplacing } = useImportBrowser();
	const close = () => useImportBrowser.setState({ contents: null, isReplacing: false });
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
				closeLabel="Cancel"
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
							meta="Preferences, panels, favourites, cameras and shared links"
						/>
					</List>
				)}

				{contents && <Hint>{LINKS_STAY}</Hint>}

				{contents && contents.leftOut > 0 && (
					<Hint>
						{`${plural(contents.leftOut, "entry", "entries")} in the file are left out: not this app’s, not text, or allowed external sources.`}
					</Hint>
				)}

				{contents && (
					<ActionCards
						cards={[
							{
								title: "Add to this browser",
								about:
									contents.worlds.length + contents.backups > 0
										? "Its worlds and backups go beside yours; one with the same id as yours goes in as a copy. Your settings stay as they are."
										: "It has no worlds or backups to add, only settings: Replace this browser’s brings those in.",
								disabled: contents.worlds.length + contents.backups === 0,
								onChoose: () => {
									close();
									addBrowserExport(contents);
								},
							},
							{
								title: "Replace this browser’s",
								about:
									"Its worlds and settings take the place of yours, and its backups join yours. This browser as it is now is kept first, under File → Backups.",
								onChoose: () => useImportBrowser.setState({ isReplacing: true }),
							},
						]}
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
