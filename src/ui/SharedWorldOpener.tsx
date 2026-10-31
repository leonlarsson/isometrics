import { useEffect, useState } from "react";

import { startNewWorld } from "#/editor/fileActions";
import { allowLink } from "#/editor/linkTrust";
import { markAddressesAsked, outsideAddressesOf } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { fetchSharedWorld, ShareError } from "#/editor/userWorlds";
import { readWorld } from "#/parts/readWorld";
import type { TScene } from "#/scene/schema";
import { TEMPLATES } from "#/templates";

import { ConfirmDialog } from "./ConfirmDialog";

import styles from "./WaitingSourcesDialog.module.css";

/** The first this many outside addresses are listed; the rest are counted. */
const ADDRESSES_SHOWN = 6;

/**
 * What the page's address asks to open: a shared world or a template, as
 * /w/<id> and /templates/<id> redirect here (/?shared=<id>, /?template=<id>).
 */
const askedToOpen = (): { kind: "shared" | "template"; id: string } | null => {
	const search = new URLSearchParams(window.location.search);
	const shared = search.get("shared");
	if (shared && /^[A-Za-z0-9_-]{22}$/.test(shared)) {
		return { kind: "shared", id: shared };
	}
	const template = search.get("template");
	return template && /^[a-z0-9_]+$/.test(template) ? { kind: "template", id: template } : null;
};

/** The editor's address without what it was asked to open, so a reload doesn't open it again. */
const leave = () => window.history.replaceState(window.history.state, "", "/");

type TStep =
	| { kind: "idle" }
	| { kind: "asking"; scene: TScene; addresses: string[]; isShared: boolean };

/**
 * Opens what the page's address names (ADR-0120): a world someone shared, read
 * from this site (waiting out the minute a new link can take to arrive), or a
 * template. Either opens as a new world next to the others. If it reads
 * anything from outside, it says so before it's loaded, naming each address,
 * once the world open now is on screen (not over its loading screen). One
 * question, so the usual one about outside addresses (ADR-0119) isn't asked
 * again: Open and allow (they're read from then on), Open (they wait in the
 * Data tab under Sources), or Don't open it.
 */
export const SharedWorldOpener = () => {
	const [step, setStep] = useState<TStep>({ kind: "idle" });
	// Asked once the world open now is on screen, not over its loading screen.
	const isOnScreen = useEditor((s) => s.openingWorld === null);

	const open = (
		scene: TScene,
		addresses: string[],
		isShared: boolean,
		reads: "allowed" | "waiting",
	) => {
		if (reads === "allowed") {
			for (const url of addresses) {
				allowLink(url);
			}
		}
		startNewWorld(scene);
		// Asked before it loaded: the dialog for a world's outside addresses doesn't ask again.
		markAddressesAsked(addresses);
		const copy = isShared
			? "A copy of a shared world, next to your worlds: changes stay in this browser."
			: "A copy of the template, next to your worlds.";
		notify(
			`Opened “${scene.meta.title}”`,
			reads === "waiting" && addresses.length > 0
				? `${copy} Its addresses wait to be allowed in the Data tab, under Sources.`
				: copy,
		);
	};

	const consider = (scene: TScene, isShared: boolean) => {
		const addresses = outsideAddressesOf(scene);
		if (addresses.length > 0) {
			setStep({ kind: "asking", scene, addresses, isShared });
		} else {
			open(scene, [], isShared, "allowed");
			setStep({ kind: "idle" });
		}
	};

	useEffect(() => {
		const asked = askedToOpen();
		if (!asked) {
			return;
		}
		leave();
		if (asked.kind === "template") {
			const template = TEMPLATES.find((each) => each.id === asked.id);
			if (template) {
				consider(template.create(), false);
			} else {
				notify("No such template", `There's no template called “${asked.id}”.`, "error");
			}
			return;
		}
		// A link shared moments ago can take up to a minute to arrive here: said once, while it does.
		let saidWaiting = false;
		fetchSharedWorld(asked.id, {
			onWaiting: () => {
				if (!saidWaiting) {
					saidWaiting = true;
					notify(
						"The shared world is still arriving",
						"A link shared moments ago can take up to a minute to reach everywhere: trying again until then.",
					);
				}
			},
		})
			.then((text) => {
				const { scene } = readWorld(JSON.parse(text));
				consider(scene, true);
			})
			.catch((error) => {
				setStep({ kind: "idle" });
				notify(
					"That shared world can't be opened",
					error instanceof ShareError
						? error.message
						: "What the link holds isn't a world this app can read.",
					"error",
				);
			});
	}, []);

	const addresses = step.kind === "asking" ? step.addresses : [];
	const one = addresses.length === 1;
	return (
		<>
			<ConfirmDialog
				open={step.kind === "asking" && isOnScreen}
				onOpenChange={(next) => !next && setStep({ kind: "idle" })}
				title="This world reads data from outside"
				description={
					<div className={styles.body}>
						<p>
							{step.kind === "asking" && step.isShared
								? `“${step.scene.meta.title}” came from a link, and anyone can make one. It reads data from ${addresses.length === 1 ? "this address" : `these ${addresses.length} addresses`}:`
								: `“${step.kind === "asking" ? step.scene.meta.title : ""}” reads data from ${addresses.length === 1 ? "this address" : `these ${addresses.length} addresses`}:`}
						</p>

						<ul className={styles.addresses}>
							{addresses.slice(0, ADDRESSES_SHOWN).map((url) => (
								<li key={url}>{url}</li>
							))}
						</ul>

						{addresses.length > ADDRESSES_SHOWN && (
							<p>{`And ${addresses.length - ADDRESSES_SHOWN} more.`}</p>
						)}

						<p>
							{one
								? "Reading it tells it you're looking. Open and allow reads it from now on in this browser; Open leaves it waiting in the Data tab, under Sources, to allow later."
								: "Reading them tells each one you're looking. Open and allow reads them from now on in this browser; Open leaves them waiting in the Data tab, under Sources, to allow later."}
						</p>
					</div>
				}
				confirmLabel="Open and allow"
				cancelLabel="Don't open it"
				onConfirm={() => {
					if (step.kind === "asking") {
						open(step.scene, step.addresses, step.isShared, "allowed");
					}
					setStep({ kind: "idle" });
				}}
				extraAction={{
					label: "Open",
					onClick: () => {
						if (step.kind === "asking") {
							open(step.scene, step.addresses, step.isShared, "waiting");
						}
						setStep({ kind: "idle" });
					},
				}}
			/>
		</>
	);
};
