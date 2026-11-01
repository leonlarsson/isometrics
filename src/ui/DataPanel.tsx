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
			{!isFirst && (
				<div className={styles.bar}>
					<SearchField
						label="Find data"
						placeholder="Find data…"
						value={query}
						onChange={setQuery}
					/>

					<IconButton
						icon="plus"
						label="Add data"
						size="sm"
						onClick={() => openDataWindow({ kind: "add" })}
					/>

					<IconButton
						icon="newTab"
						label="Open the Data window"
						size="sm"
						onClick={() => openDataWindow({ kind: "start" })}
					/>
				</div>
			)}

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
				<Section
					icon="lock"
					title={
						waiting.length === 1
							? "1 source waiting for your yes"
							: `${waiting.length} sources waiting for your yes`
					}
				>
					<Hint>
						{`This world reads data from ${sitesOf(waiting)}, which this browser hasn't read before. A world can come from anyone, so nothing is read until you allow ${waiting.length === 1 ? "it (Allow, on its card)" : "them (Allow, on each card, or all at once)"}.`}
					</Hint>

					{waitingAddresses.length > 1 && (
						<Button size="sm" icon="check" onClick={() => setReviewingWaiting(true)}>
							Review and allow…
						</Button>
					)}
				</Section>
			)}

			{/* Each way of failing explained once, for all the sources that failed that way. */}
			{failures.length > 0 && (
				<Section icon="alert" title="Couldn't be read">
					{failures.map(({ failure, failed }) => (
						<Hint key={failure}>
							<strong>
								{`${failed.length === 1 ? "A source" : `${failed.length} sources`} (${sitesOf(failed)}): `}
							</strong>

							{LINK_FAILURES[failure].long}
						</Hint>
					))}
				</Section>
			)}

			{isFirst ? (
				<Section icon="chart" title="Make the world show real numbers">
					<Hint>
						Bring in numbers from a spreadsheet or a link, or type them. Then things in the world
						show them: a tower as tall as its sales, a card with today's visitors, a road as busy as
						this month's trips.
					</Hint>

					<div className={styles.start}>
						<Button variant="primary" icon="plus" onClick={() => openDataWindow({ kind: "add" })}>
							Add data
						</Button>
					</div>
				</Section>
			) : (
				<DataList groups={groups} at={at} onOpen={openDataWindow} />
			)}

			{!isFirst && groups.length === 0 && (
				<p className={styles.none}>{`Nothing matches “${query.trim()}”.`}</p>
			)}

			<AllowSourcesDialog
				open={isReviewingWaiting && waitingAddresses.length > 1}
				onOpenChange={setReviewingWaiting}
				addresses={waitingAddresses}
				later="Not now leaves them waiting: each can still be allowed on its own card, and any you allow forgotten later (External sources this browser reads…, on a source's details)."
			/>
		</>
	);
};
