import { answerLink } from "#/editor/openLink";
import { useEditor } from "#/editor/store";

import { ConfirmDialog } from "./ConfirmDialog";

import styles from "./WaitingSourcesDialog.module.css";

/**
 * Before a shared world that reads from outside is built (ADR-0121): over its
 * own loading card, naming each address it reads, which nothing has asked
 * yet. Open and allow (they're read from now on), Open (they wait in the Data
 * tab, Allow on its source), or Don't open it (the home screen). The one question
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
			title="This world uses external sources"
			description={
				<div className={styles.body}>
					<p>
						{`The world “${step?.scene.meta.title ?? ""}” came from a link, and anyone can make one. It reads data from ${one ? "this external source" : `these ${addresses.length} external sources`}, and nothing has been read from ${one ? "it" : "them"} yet:`}
					</p>

					<ul className={styles.addresses}>
						{addresses.map((url) => (
							<li key={url}>{url}</li>
						))}
					</ul>

					<p>
						{one
							? "Reading it lets whoever runs it see your visit (your IP address, and when). Open and allow reads it from now on in this browser; Open leaves it waiting in the Data tab, to allow later (Allow, on its source)."
							: "Reading them lets whoever runs each one see your visit (your IP address, and when). Open and allow reads them from now on in this browser; Open leaves them waiting in the Data tab, to allow later (Allow, on its source)."}
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
