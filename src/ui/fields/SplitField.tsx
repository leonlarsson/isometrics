import { Slider } from "@base-ui/react/slider";
import type { CSSProperties, ReactNode } from "react";

import { Hint } from "./Hint";
import { type IInherit, InheritAction } from "./InheritAction";
import { LabelRow } from "./LabelRow";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

/** One part of a split: what it's called, and the colour its segment is drawn in. */
export interface ISplitPart {
	id: string;
	label: string;
	color: string;
}

interface ISplitFieldProps {
	label: string;
	parts: readonly ISplitPart[];
	/** Each part's share, in the same order; relative numbers (they needn't add up to anything). */
	weights: readonly number[];
	/** Each part's share as a percentage, adding up to 100. */
	onChange: (percentages: number[]) => void;
	inherit?: IInherit;
	hint?: ReactNode;
}

/** Shares of a whole as percentages adding up to 100 (an even split when they're all 0). */
export const toPercentages = (weights: readonly number[]) => {
	const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
	return weights.map((weight) =>
		total > 0 ? (Math.max(0, weight) / total) * 100 : 100 / weights.length,
	);
};

/** Where the dividers are, as running totals of the percentages (one fewer than the parts). */
export const dividersOf = (percentages: readonly number[]) =>
	percentages.slice(0, -1).map((_, i) => percentages.slice(0, i + 1).reduce((a, b) => a + b, 0));

/** The percentages a set of dividers leaves between them, each rounded to a whole one. */
export const percentagesFrom = (dividers: readonly number[]) => {
	const edges = [0, ...[...dividers].sort((a, b) => a - b), 100].map((edge) => Math.round(edge));
	return edges.slice(1).map((edge, i) => edge - edges[i]);
};

/**
 * One bar shared out between a few parts, a segment each, with a divider to drag
 * between neighbours (a Base UI slider with a thumb per divider, so the arrow keys
 * move them too). However they're dragged, the parts always fill the whole bar.
 * Each segment says its name and share under the bar, never by colour alone
 * (ADR-0089).
 */
export const SplitField = ({
	label,
	parts,
	weights,
	onChange,
	inherit,
	hint,
}: ISplitFieldProps) => {
	const percentages = toPercentages(weights);
	const dividers = dividersOf(percentages);
	return (
		<div className={styles.field} data-search-match={useSearchMatch(label)}>
			<LabelRow label={label} action={inherit && <InheritAction inherit={inherit} />} />

			<Slider.Root
				className={styles.split}
				value={dividers}
				min={0}
				max={100}
				step={1}
				thumbAlignment="edge"
				onValueChange={(next) => onChange(percentagesFrom(Array.isArray(next) ? next : [next]))}
			>
				<Slider.Control className={styles.sliderControl}>
					<Slider.Track className={styles.splitTrack}>
						{parts.map((part, i) => (
							<span
								key={part.id}
								className={styles.splitSegment}
								style={
									{
										"--split-start": `${i === 0 ? 0 : dividers[i - 1]}%`,
										"--split-width": `${percentages[i]}%`,
										background: part.color,
									} as CSSProperties
								}
							/>
						))}

						{dividers.map((_, i) => (
							<Slider.Thumb
								key={parts[i].id}
								index={i}
								className={styles.sliderThumb}
								aria-label={`Between ${parts[i].label} and ${parts[i + 1].label}`}
							/>
						))}
					</Slider.Track>
				</Slider.Control>
			</Slider.Root>

			<ul className={styles.splitLegend}>
				{parts.map((part, i) => (
					<li key={part.id}>
						<span className={styles.splitSwatch} style={{ background: part.color }} />

						<span>{part.label}</span>

						<strong>{Math.round(percentages[i])}%</strong>
					</li>
				))}
			</ul>

			{hint && <Hint>{hint}</Hint>}
		</div>
	);
};
