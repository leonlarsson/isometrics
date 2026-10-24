import { useEffect, useState } from "react";

import { saveWorldFile } from "#/editor/fileActions";
import { markFreshStartSeen, shouldOfferFreshStart } from "#/editor/wipeOffer";
import { APP_NAME } from "#/lib/app";

import { ConfirmDialog } from "./ConfirmDialog";
import { WipeEverything } from "./WipeEverything";

/**
 * After a big update (the fresh-start number went up, ADR-0059), offers once
 * to wipe everything and start fresh, with File → Wipe everything's two
 * confirmations, or to carry on. Either way it isn't asked again until the
 * next bump.
 */
export const FreshStartOffer = () => {
	const [offering, setOffering] = useState(false);
	const [wiping, setWiping] = useState(false);

	useEffect(() => {
		setOffering(shouldOfferFreshStart());
	}, []);

	return (
		<>
			<ConfirmDialog
				open={offering}
				onOpenChange={(open) => {
					if (!open) {
						markFreshStartSeen();
						setOffering(false);
					}
				}}
				title="A fresh start is recommended"
				description={`${APP_NAME} has changed a lot since you were last here. The developer recommends wiping everything it keeps in this browser and starting fresh, so older worlds and settings don't get in the way. Save any world you want to keep to a file first.`}
				confirmLabel="Start fresh…"
				cancelLabel="Not now"
				onConfirm={() => {
					markFreshStartSeen();
					setOffering(false);
					setWiping(true);
				}}
				extraAction={{ label: "Save to file", onClick: saveWorldFile }}
			/>

			<WipeEverything open={wiping} onClose={() => setWiping(false)} />
		</>
	);
};
