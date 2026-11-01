import { forgetLink, useAllowedLinks } from "#/editor/linkTrust";

import { IconButton } from "./Button";
import { Dialog } from "./Dialog";
import { Hint } from "./fields";
import { List, ListItem } from "./List";

/**
 * The addresses this browser has agreed to read (ADR-0119), each with Forget:
 * worlds that name a forgotten address wait for a yes again.
 */
export const AllowedLinksDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
	const links = [...useAllowedLinks((s) => s.links)].sort();
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !next && onClose()}
			title="External sources this browser reads"
			description="Links and APIs you've allowed: any world that names one reads it without asking. Forget one, and worlds wait for your yes again."
			closeLabel="Close"
		>
			{links.length > 0 ? (
				<List>
					{links.map((url) => (
						<ListItem
							key={url}
							label={url}
							actions={
								<IconButton icon="trash" label={`Forget ${url}`} onClick={() => forgetLink(url)} />
							}
						/>
					))}
				</List>
			) : (
				<Hint>
					None yet. An address is allowed when you read it, or click Allow on a world's source.
				</Hint>
			)}
		</Dialog>
	);
};
