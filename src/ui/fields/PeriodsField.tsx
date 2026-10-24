import { type PointerEvent, type ReactNode, useRef } from "react";

import { Button, IconButton } from "../Button";

import { ClockInput } from "./ClockInput";
import { Field } from "./Field";
import { dragPeriods, type ITimePeriod, periodSpans, type TPeriodDrag } from "./periods";

import styles from "./Fields.module.css";

interface IPeriodsFieldProps {
	label: string;
	periods: readonly ITimePeriod[];
	onChange: (periods: ITimePeriod[]) => void;
	/** The period Add period adds. */
	newPeriod?: ITimePeriod;
	hint?: ReactNode;
}

/**
 * A list of periods of the day, like the on-times of a timer: a row per
 * period (from, until, remove), Add period, and a 24-hour strip showing them
 * at a glance. On the strip, drag a period's bar to move it, an end to change
 * it, or an empty part to add one (quarter hours). A period may run past
 * midnight (22:00–02:00). The time boxes are the keyboard way to do the same.
 */
export const PeriodsField = ({
	label,
	periods,
	onChange,
	newPeriod = { from: 18, until: 23 },
	hint,
}: IPeriodsFieldProps) => {
	const change = (index: number, next: Partial<ITimePeriod>) =>
		onChange(periods.map((period, i) => (i === index ? { ...period, ...next } : period)));
	const strip = useRef<HTMLDivElement>(null);
	const drag = useRef<TPeriodDrag | null>(null);
	/** The hour under the pointer on the strip, 0–24. */
	const hourAt = (event: PointerEvent) => {
		const box = strip.current?.getBoundingClientRect();
		return box ? Math.min(24, Math.max(0, ((event.clientX - box.left) / box.width) * 24)) : 0;
	};
	const startDrag = (event: PointerEvent<HTMLDivElement>) => {
		const target = event.target instanceof HTMLElement ? event.target : null;
		const part = target?.dataset.part;
		const index = Number(target?.dataset.index);
		const hour = hourAt(event);
		// No focus change or text selection from pressing the strip.
		event.preventDefault();
		drag.current =
			part === "start" || part === "end"
				? { kind: part, index }
				: part === "bar"
					? { kind: "move", index, from: hour, original: periods[index] }
					: { kind: "add", from: hour, index: null };
		event.currentTarget.setPointerCapture(event.pointerId);
	};
	const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
		const current = drag.current;
		if (!current) {
			return;
		}
		const next = dragPeriods(periods, current, hourAt(event));
		// A period being added exists from the first move that makes it long enough.
		if (current.kind === "add") {
			drag.current = {
				...current,
				index: next.length > periods.length ? next.length - 1 : current.index,
			};
		}
		onChange(next);
	};
	return (
		<Field label={label} hint={hint} stacked>
			{(id) => (
				<div className={styles.periods} id={id}>
					{periods.map((period, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: periods have no ids; rows follow their order
						<div key={index} className={styles.period}>
							<ClockInput
								ariaLabel={`Period ${index + 1} from`}
								hours={period.from}
								onChange={(from) => change(index, { from })}
							/>

							<span className={styles.periodDash}>–</span>

							<ClockInput
								ariaLabel={`Period ${index + 1} until`}
								hours={period.until}
								onChange={(until) => change(index, { until })}
							/>

							<IconButton
								icon="trash"
								label={`Remove period ${index + 1}`}
								onClick={() => onChange(periods.filter((_, i) => i !== index))}
							/>
						</div>
					))}

					{/* Pointer only; the time boxes above do the same from the keyboard. */}
					<div
						ref={strip}
						className={styles.dayStrip}
						aria-hidden
						onPointerDown={startDrag}
						onPointerMove={moveDrag}
						onPointerUp={() => {
							drag.current = null;
						}}
						onPointerCancel={() => {
							drag.current = null;
						}}
					>
						{periodSpans(periods).map((span) => (
							<span
								key={`${span.index}-${span.start}`}
								className={styles.dayStripOn}
								data-part="bar"
								data-index={span.index}
								style={{
									left: `${(span.start / 24) * 100}%`,
									width: `${((span.end - span.start) / 24) * 100}%`,
								}}
							>
								{span.startsPeriod && (
									<span className={styles.dayStripEdge} data-part="start" data-index={span.index} />
								)}

								{span.endsPeriod && (
									<span
										className={styles.dayStripEdge}
										data-part="end"
										data-index={span.index}
										data-end=""
									/>
								)}
							</span>
						))}
					</div>

					<div className={styles.dayStripHours} aria-hidden>
						<span>00</span>

						<span>06</span>

						<span>12</span>

						<span>18</span>

						<span>24</span>
					</div>

					<Button size="sm" icon="plus" onClick={() => onChange([...periods, newPeriod])}>
						Add period
					</Button>
				</div>
			)}
		</Field>
	);
};
