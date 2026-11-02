import { useEffect, useState } from "react";

import { useEditor } from "#/editor/store";
import { parseValue } from "#/scene/format";
import {
	changePoint,
	dateForNewEntry,
	isPastDate,
	recordPoint,
	removePoint,
} from "#/scene/pastValues";
import type { TDataPoint, TDataValue } from "#/scene/schema";

import { Button, ButtonGroup, IconButton } from "./Button";
import { Dialog } from "./Dialog";
import { Hint, Input } from "./fields";

import styles from "./PastValuesDialog.module.css";

/** The most entries listed: a past read from an API can hold thousands. */
const MOST_LISTED = 100;

/**
 * One past value: its date (saved when the field is left, so rows don't jump
 * while it's typed) and its number (saved as it's typed), and ✕ to remove it.
 */
const PastRow = ({
	point,
	name,
	onChange,
	onRemove,
}: {
	point: TDataPoint;
	name: string;
	/** Save a change; false when it isn't taken (a date another entry has). */
	onChange: (next: TDataPoint, coalesce?: string) => boolean;
	onRemove: () => void;
}) => {
	const [date, setDate] = useState(point.at);
	const [number, setNumber] = useState(String(point.value));
	const [problem, setProblem] = useState<string | null>(null);
	// What's typed follows changes made elsewhere (undo).
	useEffect(() => setDate(point.at), [point.at]);
	useEffect(() => {
		if (parseValue(number) !== point.value) {
			setNumber(String(point.value));
		}
	}, [point.value]);

	const saveDate = () => {
		const next = date.trim();
		if (next === point.at) {
			setProblem(null);
			return;
		}
		if (!isPastDate(next)) {
			setProblem("A date like 2026-10-30, 2026-10 or 2026.");
			return;
		}
		setProblem(onChange({ ...point, at: next }) ? null : "Another entry has this date.");
	};

	return (
		<li className={styles.row}>
			<Input
				ariaLabel={`Date of ${name} on ${point.at}`}
				value={date}
				onChange={setDate}
				onBlur={saveDate}
			/>

			<Input
				ariaLabel={`${name} on ${point.at}`}
				value={number}
				onChange={(raw) => {
					setNumber(raw);
					onChange({ ...point, value: parseValue(raw) }, `past:${point.at}`);
				}}
			/>

			<IconButton icon="close" label={`Remove the entry of ${point.at}`} onClick={onRemove} />

			{problem && <span className={styles.problem}>{problem}</span>}
		</li>
	);
};

/**
 * A value's past values, kept by hand (ADR-0123): every entry, newest first,
 * as a date and a number to change, ✕ to remove one, and Add an entry (the
 * day, month or year before the oldest, to fill in the past). The number it
 * shows now is its Value, on its page.
 */
export const PastValuesDialog = ({
	value,
	onClose,
}: {
	value: TDataValue;
	onClose: () => void;
}) => {
	const upsertData = useEditor((s) => s.upsertData);
	const name = value.name || value.key;
	const setHistory = (history: TDataPoint[], coalesce?: string) =>
		upsertData({ ...value, history }, undefined, coalesce);
	// Newest first, with each entry's place in the past (oldest first) to change it by.
	const listed = value.history
		.map((point, index) => ({ point, index }))
		.reverse()
		.slice(0, MOST_LISTED);
	const older = value.history.length - listed.length;

	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onClose()}
			title={`Past values of ${name}`}
			description="What it was on earlier dates, newest first: its line on cards, its trend, and what the story bar plays. The number it shows now is its Value, on its page."
			closeLabel="Done"
			initialFocus="dialog"
		>
			<ButtonGroup>
				<Button
					size="sm"
					icon="plus"
					onClick={() =>
						setHistory(
							recordPoint(value.history, {
								at: dateForNewEntry(value.history),
								value: value.history[0]?.value ?? value.value,
							}),
						)
					}
				>
					Add an entry
				</Button>
			</ButtonGroup>

			{listed.length > 0 ? (
				<>
					<div className={styles.head} aria-hidden="true">
						<span>Date</span>

						<span>{name}</span>
					</div>

					<ul className={styles.rows}>
						{listed.map(({ point, index }) => (
							<PastRow
								key={point.at}
								point={point}
								name={name}
								onChange={(next, coalesce) => {
									const history = changePoint(value.history, index, next);
									if (history) {
										setHistory(history, coalesce);
									}
									return history !== null;
								}}
								onRemove={() => setHistory(removePoint(value.history, index))}
							/>
						))}
					</ul>
				</>
			) : (
				<Hint>None yet. Add an entry, or Record today's number on its page.</Hint>
			)}

			{older > 0 && <Hint>{`And ${older.toLocaleString()} older entries, not listed here.`}</Hint>}
		</Dialog>
	);
};
