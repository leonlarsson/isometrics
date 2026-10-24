import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { Button, IconButton } from "../Button";

import { Field } from "./Field";
import { Input } from "./Input";
import {
	dragPeriods,
	formatClock,
	type ITimePeriod,
	parseClock,
	periodSpans,
	type TPeriodDrag,
} from "./periods";

import styles from "./Fields.module.css";

interface IPeriodsFieldProps {
	label: string;
	periods: readonly ITimePeriod[];
	onChange: (periods: ITimePeriod[]) => void;
	/** The period Add period adds. */
	newPeriod?: ITimePeriod;
	hint?: ReactNode;
}

interface IClockInputProps {
	hours: number;
	onChange: (hours: number) => void;
	ariaLabel: string;
}

/** A whole time as typed, "8:25" or "08:25", so nothing changes while it's half typed ("0", "08:2"). */
const WHOLE_TIME = /^\d{1,2}:\d{2}$/;

/**
 * A time of day typed as 24-hour "19:30". While it's being typed the text is
 * left alone: the value changes once it's a whole time, and on leaving the box
 * it also reads shortcuts ("1930", "19") and shows the value tidily again.
 */
const ClockInput = ({ hours, onChange, ariaLabel }: IClockInputProps) => {
	const [text, setText] = useState(formatClock(hours));
	// Typed in since it got focus: only then does it stop following the value.
	const [typing, setTyping] = useState(false);
	// Follow changes from elsewhere (undo, dragging on the strip), but never rewrite what's being typed.
	useEffect(() => {
		if (!typing) {
			setText(formatClock(hours));
		}
	}, [hours, typing]);
	return (
		<Input
			ariaLabel={ariaLabel}
			value={text}
			placeholder="18:00"
			onChange={(next) => {
				setTyping(true);
				setText(next);
				const parsed = WHOLE_TIME.test(next.trim()) ? parseClock(next) : null;
				if (parsed !== null && parsed !== hours) {
					onChange(parsed);
				}
			}}
			onBlur={() => {
				setTyping(false);
				const parsed = parseClock(text);
				if (parsed !== null && parsed !== hours) {
					onChange(parsed);
				}
				setText(formatClock(parsed ?? hours));
			}}
		/>
	);
};

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
