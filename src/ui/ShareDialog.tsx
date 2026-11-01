import { useState } from "react";

import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import {
	type ISharedLink,
	SHARE_DEFAULT_SECONDS,
	SHARE_EXPIRIES,
	ShareError,
	shareWorld,
	stopSharing,
	useSharedLinks,
} from "#/editor/userWorlds";

import { Button, IconButton } from "./Button";
import { Dialog } from "./Dialog";
import { FieldGroup, Hint, resetToDefault, SelectField } from "./fields";
import { List, ListItem } from "./List";
import { useCopy } from "./useCopy";

import styles from "./ShareDialog.module.css";

const whenItGoes = (expiresAt: string) =>
	new Date(expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Share a link… (ADR-0120): a public snapshot of the world on the site's
 * servers, for as long as picked, made only when asked (Create a public link),
 * and saying plainly that anyone with the link can open it until then. Lists
 * the links this browser shared, each with Stop sharing.
 */
export const ShareDialog = () => {
	const open = useEditor((s) => s.shareOpen);
	const title = useEditor((s) => s.scene.meta.title);
	const hasData = useEditor(
		(s) =>
			s.scene.data.values.length + s.scene.data.tables.length + s.scene.data.sources.length > 0,
	);
	const links = useSharedLinks((s) => s.links);
	const [seconds, setSeconds] = useState(SHARE_DEFAULT_SECONDS);
	const [made, setMade] = useState<ISharedLink | null>(null);
	const [sharing, setSharing] = useState(false);
	const { copiedKey, copy } = useCopy();
	const copyLink = (link: ISharedLink, key: string) =>
		copy(link.url, "Link copied", { key, detail: link.url });
	const close = () => {
		useEditor.getState().setShareOpen(false);
		setMade(null);
	};

	const share = async () => {
		setSharing(true);
		try {
			setMade(await shareWorld(useEditor.getState().scene, seconds));
		} catch (error) {
			notify(
				"It couldn't be shared",
				error instanceof ShareError ? error.message : "Try again in a moment.",
				"error",
			);
		} finally {
			setSharing(false);
		}
	};

	const stop = async (link: ISharedLink) => {
		try {
			await stopSharing(link);
			if (made?.id === link.id) {
				setMade(null);
			}
			notify("Stopped sharing", `“${link.title}”: the link stops working within a minute.`);
		} catch (error) {
			notify(
				"It couldn't be stopped",
				error instanceof ShareError ? error.message : "Try again in a moment.",
				"error",
			);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !next && close()}
			title="Share a link"
			description={`A link that opens “${title}” for anyone who has it, until it expires.`}
			closeLabel="Close"
		>
			{made ? (
				<FieldGroup title="Its link">
					<p className={styles.link}>{made.url}</p>

					<Button
						variant="primary"
						icon={copiedKey === "made" ? "check" : "copy"}
						showsSuccess={copiedKey === "made"}
						onClick={() => copyLink(made, "made")}
					>
						Copy the link
					</Button>

					<Hint>
						{`Public until ${whenItGoes(made.expiresAt)}. It's a snapshot: later changes aren't in it, so share again to send them. A new link can take up to a minute to open everywhere.`}
					</Hint>

					<Button variant="danger" size="sm" icon="trash" onClick={() => void stop(made)}>
						Stop sharing
					</Button>
				</FieldGroup>
			) : (
				<FieldGroup title="Make it public">
					<Hint>
						The world is kept on this site's servers, and <strong>anyone with the link</strong> can
						open it and make a copy, until it expires. Links can't be guessed, but they can be
						passed on: share nothing private.
						{hasData &&
							" Its data goes with it: its values, tables, and the external sources it reads (whoever opens it is asked before any are read)."}
					</Hint>

					<SelectField
						label="Keep it for"
						value={String(seconds)}
						options={SHARE_EXPIRIES.map((each) => ({
							value: String(each.seconds),
							label: each.label,
						}))}
						onChange={(value) => setSeconds(Number(value))}
						inherit={resetToDefault(
							seconds,
							SHARE_DEFAULT_SECONDS,
							() => setSeconds(SHARE_DEFAULT_SECONDS),
							"7 days",
						)}
					/>

					<Button variant="primary" icon="newTab" disabled={sharing} onClick={() => void share()}>
						{sharing ? "Making it…" : "Create a public link"}
					</Button>
				</FieldGroup>
			)}

			{links.length > 0 && (
				<FieldGroup title="Shared from this browser">
					<List>
						{links.map((link) => (
							<ListItem
								key={link.id}
								label={link.title}
								meta={`${link.isHandoff ? "handed to an AI · " : ""}until ${whenItGoes(link.expiresAt)} · ${link.url}`}
								stacked
								actions={
									<>
										<IconButton
											icon={copiedKey === link.id ? "check" : "copy"}
											label={
												copiedKey === link.id
													? `Copied the link to “${link.title}”`
													: `Copy the link to “${link.title}”`
											}
											onClick={() => copyLink(link, link.id)}
										/>

										<IconButton
											icon="trash"
											label={`Stop sharing “${link.title}”`}
											onClick={() => void stop(link)}
										/>
									</>
								}
							/>
						))}
					</List>
				</FieldGroup>
			)}
		</Dialog>
	);
};
