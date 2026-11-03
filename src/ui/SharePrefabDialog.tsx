import { useRef, useState } from "react";

import { notify } from "#/editor/toasts";
import {
	type ISharedPrefabLink,
	sharePrefab,
	stopSharingPrefab,
	useSharedPrefabLinks,
} from "#/editor/userPrefabs";
import { SHARE_DEFAULT_SECONDS, SHARE_EXPIRIES, ShareError } from "#/editor/userWorlds";
import { localDateTime } from "#/lib/when";
import { prefabName } from "#/parts/prefabParts";
import type { TPrefab } from "#/scene/schema";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { FieldGroup, Hint, resetToDefault, SelectField } from "./fields";
import { useCopy } from "./useCopy";

import styles from "./ShareDialog.module.css";

interface ISharePrefabDialogProps {
	/** The prefab to share; null: closed. */
	prefab: TPrefab | null;
	onClose: () => void;
}

/**
 * Share a link… for a prefab (ADR-0134), as for a world (ADR-0120): a public
 * snapshot on the site's servers for as long as picked, made only when asked
 * (Create a public link), saying plainly that anyone with the link can open it
 * and add it to their own prefabs until then. Its link opens /p/<id>.
 */
export const SharePrefabDialog = ({ prefab, onClose }: ISharePrefabDialogProps) => {
	const links = useSharedPrefabLinks((s) => s.links);
	const [seconds, setSeconds] = useState(SHARE_DEFAULT_SECONDS);
	const [made, setMade] = useState<ISharedPrefabLink | null>(null);
	const [sharing, setSharing] = useState(false);
	const { copiedKey, copy } = useCopy();
	// Bumped on closing: a share that finishes after it isn't shown as the next one's.
	const asking = useRef(0);
	const close = () => {
		asking.current += 1;
		setMade(null);
		onClose();
	};
	// The newest link this browser shared for it that hasn't expired, if any.
	const shown = made ?? links.find((link) => link.prefabId === prefab?.id) ?? null;

	const share = async () => {
		if (!prefab) {
			return;
		}
		const ask = asking.current;
		setSharing(true);
		try {
			const link = await sharePrefab(prefab, seconds);
			if (asking.current === ask) {
				setMade(link);
			}
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

	const stop = async (link: ISharedPrefabLink) => {
		try {
			await stopSharingPrefab(link);
			setMade(null);
			notify("Stopped sharing", `“${link.name}”: the link stops working within a minute.`);
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
			open={prefab !== null}
			onOpenChange={(next) => !next && close()}
			title="Share a link"
			description={
				prefab
					? `A link that shows the prefab “${prefabName(prefab)}” to anyone who has it, to add to their own prefabs, until it expires.`
					: ""
			}
			closeLabel="Close"
		>
			{shown ? (
				<FieldGroup title="Its link">
					<p className={styles.link}>{shown.url}</p>

					<Button
						variant="primary"
						icon={copiedKey === "made" ? "check" : "copy"}
						showsSuccess={copiedKey === "made"}
						onClick={() => copy(shown.url, "Link copied", { key: "made", detail: shown.url })}
					>
						Copy the link
					</Button>

					<Hint>
						{`Public until ${localDateTime(shown.expiresAt)}. It's a snapshot: later changes aren't in it, so share again to send them. A new link can take up to a minute to open everywhere.`}
					</Hint>

					<Button variant="danger" size="sm" icon="trash" onClick={() => void stop(shown)}>
						Stop sharing
					</Button>
				</FieldGroup>
			) : (
				<FieldGroup title="Make it public">
					<Hint>
						The prefab is kept on this site's servers, and <strong>anyone with the link</strong> can
						open it and add it to their own prefabs, until it expires. Links can't be guessed, but
						they can be passed on: share nothing private.
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
		</Dialog>
	);
};
