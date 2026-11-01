import { answerLink } from "#/editor/openLink";
import { useEditor } from "#/editor/store";

import { ConfirmDialog } from "./ConfirmDialog";

import styles from "./WaitingSourcesDialog.module.css";

/** The first this many outside addresses are listed; the rest are counted. */
const ADDRESSES_SHOWN = 6;

/**
 * Before a shared world that reads from outside is built (ADR-0121): over its
 * own loading card, naming each address it reads, which nothing has asked
 * yet. Open and allow (they're read from now on), Open (they wait in the Data
 * tab under Sources), or Don't open it (the home screen). The one question
 * about them: the usual one isn't asked again once it's open.
 */
export const LinkQuestion = () => {
	const step = useEditor((s) =>
		s.whatIsOpen.kind === "link" && s.whatIsOpen.step.kind === "asking" ? s.whatIsOpen.step : null,
	);
	const addresses = step?.addresses ?? [];
	const one = addresses.length === 1;
	return (
		<ConfirmDialog
			open={step !== null}
			onOpenChange={(next) => !next && answerLink("decline")}
			title="This world reads data from outside"
			description={
				<div className={styles.body}>
					<p>
						{`“${step?.scene.meta.title ?? ""}” came from a link, and anyone can make one. It reads data from ${one ? "this address" : `these ${addresses.length} addresses`}, and nothing has been read from ${one ? "it" : "them"} yet:`}
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
			onConfirm={() => answerLink("allow")}
			extraAction={{ label: "Open", onClick: () => answerLink("open") }}
		/>
	);
};
