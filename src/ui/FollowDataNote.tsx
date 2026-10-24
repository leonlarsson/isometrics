import type { ReactNode } from "react";

import { useEditor } from "#/editor/store";

import { Button } from "./Button";
import { Hint, Section } from "./fields";

interface IFollowDataNoteProps {
	/** What can follow data, e.g. "Lights can follow data". */
	title: string;
	/** What following data does here, with an example. */
	children: ReactNode;
}

/**
 * While the world has no data values: a note at the top of a tab saying what
 * its settings can do with data, why their From data options are greyed out,
 * and a button to the Data tab (ADR-0058, ADR-0060). Shows nothing once the
 * world has values.
 */
export const FollowDataNote = ({ title, children }: IFollowDataNoteProps) => {
	const hasData = useEditor((s) => s.scene.data.length > 0);
	const setTab = useEditor((s) => s.setTab);
	if (hasData) {
		return null;
	}
	return (
		<Section icon="chart" title={title}>
			<Hint>
				{children} This world has no values yet, so those options are greyed out: add one, then pick
				From data.
			</Hint>

			<Button size="sm" icon="chart" onClick={() => setTab("data")}>
				Open the Data tab
			</Button>
		</Section>
	);
};
