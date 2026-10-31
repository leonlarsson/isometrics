import { formatEntry } from "#/scene/format";
import type { TDataValue } from "#/scene/schema";
import { changeOf, changeWords, flagOf, thresholdWords } from "#/scene/trends";

import { Sparkline } from "./Sparkline";

import styles from "./DataReading.module.css";

/** The words for a value nothing has: shown greyed, never as a zero (ADR-0110). */
export const NO_DATA = "no data";

/** A value as shown, or "no data" when there's none. */
export const shownEntry = (entry: TDataValue | undefined) => (entry ? formatEntry(entry) : NO_DATA);

/** A value's change since its point before, with its arrow, if it has a past. */
export const TrendWords = ({ entry }: { entry: TDataValue }) => {
	const change = changeOf(entry);
	return change ? <span className={styles.trend}>{changeWords(change)}</span> : null;
};

/** The ⚠ and word of a value past its line ("⚠ Watch under 30"), the line in words. */
export const FlagBadge = ({ entry }: { entry: TDataValue }) => {
	const word = flagOf(entry);
	if (!word) {
		return null;
	}
	return (
		<span className={styles.flag}>
			<span aria-hidden="true">⚠</span>

			{` ${word} `}

			<span className={styles.line}>{thresholdWords(entry)}</span>
		</span>
	);
};

/**
 * One value read in full (ADR-0110): the value big, or "no data" greyed; what
 * it means; its past as a line with how much it moved; and its flag. Cards and
 * detail tiles show values this way.
 */
export const DataReading = ({
	entry,
	label,
	size = "big",
	showsMeaning = true,
}: {
	entry: TDataValue | undefined;
	/** What it's called, when there's no entry to say it. */
	label: string;
	size?: "big" | "huge";
	showsMeaning?: boolean;
}) => (
	<span className={styles.reading} data-no-data={entry ? undefined : ""}>
		<span className={styles.value} data-size={size}>
			{shownEntry(entry)}
		</span>

		{showsMeaning && <span className={styles.meaning}>{entry?.name || label}</span>}

		{entry && entry.history.length > 1 && (
			<span className={styles.past}>
				<Sparkline points={entry.history} label={`${entry.name || label} over time`} />

				<TrendWords entry={entry} />
			</span>
		)}

		{entry && <FlagBadge entry={entry} />}
	</span>
);
