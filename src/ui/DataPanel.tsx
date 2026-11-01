import { useState } from "react";

import { dataGroupsOf, hasAnyData } from "#/editor/dataList";
import { LINK_FAILURES } from "#/editor/readLink";
import { keepArrivedValues, sitesOf } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { useHasArrived } from "#/editor/worldData";

import { AllowSourcesDialog } from "./AllowSourcesDialog";
import { Button, IconButton } from "./Button";
import { DataList } from "./DataList";
import { Hint, SearchField, Section } from "./fields";
import { useSourceStatuses } from "./useSourceStatuses";

import styles from "./DataPanel.module.css";

/**
 * The Data tab (ADR-0123): the world's data at a glance, as one list grouped
 * by where it came from, with what needs an answer on top (values that
 * arrived, sources waiting for a yes, sources that couldn't be read). A row
 * opens it in the Data window, where the work is done; so does Add data.
 */
export const DataPanel = () => {
	const data = useEditor((s) => s.scene.data);
	const at = useEditor((s) => s.dataWindow);
	const openDataWindow = useEditor((s) => s.openDataWindow);
	const { waiting, waitingAddresses, failures } = useSourceStatuses();
	const hasArrived = useHasArrived();
	const [query, setQuery] = useState("");
	const [isReviewingWaiting, setReviewingWaiting] = useState(false);
	const groups = dataGroupsOf(data, query);
	const isFirst = !hasAnyData(data);

	return (
		<>
			<div className={styles.bar}>
				{!isFirst && (
					<SearchField
						label="Find data"
						placeholder="Find data…"
						value={query}
						onChange={setQuery}
					/>
				)}

				<Button variant="primary" icon="plus" onClick={() => openDataWindow({ kind: "add" })}>
					Add data
				</Button>

				{!isFirst && (
					<IconButton
						icon="newTab"
						label="Open the Data window"
						onClick={() => openDataWindow({ kind: "start" })}
					/>
				)}
			</div>

			{hasArrived && (
				<Section icon="clock" title="Read since the world opened">
					<Hint>
						Links and APIs gave newer values since the world opened. They show everywhere now, but
						the world keeps what it had until you keep these (one undo step).
					</Hint>

					<Button size="sm" icon="check" onClick={keepArrivedValues}>
						Keep these values
					</Button>
				</Section>
			)}

			{waiting.length > 0 && (
				<div className={styles.notice}>
					<Hint>
						{`This world reads data from ${waiting.length === 1 ? "an external source" : `${waiting.length} external sources`} this browser hasn't read before, from ${sitesOf(waiting)}. A world can come from anyone, so nothing is read from them until you allow ${waiting.length === 1 ? "it (Allow, on its heading)" : "them (Allow, on each heading, or all at once)"}.`}
					</Hint>

					{waitingAddresses.length > 1 && (
						<Button size="sm" icon="check" onClick={() => setReviewingWaiting(true)}>
							Review and allow…
						</Button>
					)}
				</div>
			)}

			{/* Each way of failing explained once, for all the sources that failed that way. */}
			{failures.map(({ failure, failed }) => (
				<Hint key={failure}>
					<strong>
						{`${failed.length === 1 ? "A source" : `${failed.length} sources`} couldn't be read (${sitesOf(failed)}).`}
					</strong>

					{` ${LINK_FAILURES[failure].long}`}
				</Hint>
			))}

			{isFirst ? (
				<div className={styles.first}>
					<h3 className={styles.firstTitle}>Make the world show real numbers</h3>

					<Hint>
						Bring in numbers from a spreadsheet or a link, or type them. Then things in the world
						show them: a tower as tall as its sales, a card with today's visitors, a road as busy as
						this month's trips.
					</Hint>
				</div>
			) : (
				<DataList groups={groups} at={at} onOpen={openDataWindow} />
			)}

			{!isFirst && groups.length === 0 && <Hint>{`Nothing matches “${query.trim()}”.`}</Hint>}

			<AllowSourcesDialog
				open={isReviewingWaiting && waitingAddresses.length > 1}
				onOpenChange={setReviewingWaiting}
				addresses={waitingAddresses}
				later="Not now leaves them waiting: each can still be allowed on its own heading, and any you allow forgotten later (External sources this browser reads…, on a source's details)."
			/>
		</>
	);
};
