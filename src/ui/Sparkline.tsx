import { useLayoutEffect, useRef, useState } from "react";

import { formatValue } from "#/scene/format";
import type { TDataPoint } from "#/scene/schema";

import styles from "./Sparkline.module.css";

/** A past value's date in words: "30 Oct 2026", "Oct 2026", "2019", or as written. */
export const formatWhen = (at: string): string => {
	if (/^\d{4}$/.test(at)) {
		return at;
	}
	const month = /^(\d{4})-(\d{2})$/.exec(at);
	if (month) {
		return new Date(Number(month[1]), Number(month[2]) - 1).toLocaleDateString(undefined, {
			month: "short",
			year: "numeric",
		});
	}
	const time = Date.parse(at);
	if (Number.isNaN(time)) {
		return at;
	}
	return at.length > 10
		? new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
		: new Date(time).toLocaleDateString(undefined, { dateStyle: "medium" });
};

/** The points with numbers, for drawing; text values aren't drawn. */
export const numericPoints = (points: readonly TDataPoint[]) =>
	points.filter((point): point is { at: string; value: number } => typeof point.value === "number");

/**
 * Where each point goes in a box: along by its date (by its order when some
 * date doesn't read as one), up by its value, with room for the end dot.
 */
const layout = (
	points: readonly { at: string; value: number }[],
	width: number,
	height: number,
) => {
	const pad = 4;
	const times = points.map((point) => Date.parse(point.at));
	const byTime = times.every((time) => !Number.isNaN(time)) && times.at(-1) !== times[0];
	const along = byTime ? times : points.map((_, index) => index);
	const first = along[0];
	const span = (along.at(-1) ?? first) - first || 1;
	const values = points.map((point) => point.value);
	const low = Math.min(...values);
	const high = Math.max(...values);
	const range = high - low || 1;
	return points.map((point, index) => ({
		x: pad + ((along[index] - first) / span) * (width - pad * 2),
		// A flat line sits in the middle.
		y: high === low ? height / 2 : pad + (1 - (point.value - low) / range) * (height - pad * 2),
	}));
};

interface ISparklineProps {
	points: readonly TDataPoint[];
	/** What it shows, for screen readers ("Population over time"). */
	label: string;
	/** Draws only the last this many points. */
	lastCount?: number;
}

/**
 * A value's past in a row of a list: the line in the de-emphasis ink, the
 * latest point a dot in the accent (data study). Nothing with fewer than two
 * numbers.
 */
export const Sparkline = ({ points, label, lastCount = 30 }: ISparklineProps) => {
	const drawn = numericPoints(points).slice(-lastCount);
	if (drawn.length < 2) {
		return null;
	}
	const width = 56;
	const height = 18;
	const placed = layout(drawn, width, height);
	const end = placed[placed.length - 1];
	return (
		<svg
			className={styles.inline}
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label={label}
		>
			<polyline className={styles.line} points={placed.map(({ x, y }) => `${x},${y}`).join(" ")} />

			<circle className={styles.end} cx={end.x} cy={end.y} r={2.5} />
		</svg>
	);
};

/**
 * A value's past on its own page: the whole history, a hairline following the
 * pointer, and a readout above saying the value and date under it (the
 * latest while the pointer is elsewhere).
 */
export const HistoryChart = ({
	points,
	label,
	unit,
}: {
	points: readonly TDataPoint[];
	label: string;
	unit: string;
}) => {
	const frame = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [hovered, setHovered] = useState<number | null>(null);
	useLayoutEffect(() => {
		const element = frame.current;
		if (!element) {
			return;
		}
		const observer = new ResizeObserver(() => setWidth(element.clientWidth));
		observer.observe(element);
		setWidth(element.clientWidth);
		return () => observer.disconnect();
	}, []);

	const drawn = numericPoints(points);
	const height = 72;
	const placed = width > 0 && drawn.length >= 2 ? layout(drawn, width, height) : [];
	const shownIndex = hovered ?? drawn.length - 1;
	const shown = drawn[shownIndex];
	const mark = placed[shownIndex];

	return (
		<div className={styles.chart}>
			{shown && (
				<p className={styles.readout} aria-live="polite">
					<strong>{formatValue(shown.value, unit)}</strong>

					<span>{hovered === null ? `latest, ${formatWhen(shown.at)}` : formatWhen(shown.at)}</span>
				</p>
			)}

			<div ref={frame} className={styles.plot}>
				{placed.length > 0 && (
					<svg
						width={width}
						height={height}
						role="img"
						aria-label={label}
						onPointerMove={(event) => {
							const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
							let nearest = 0;
							for (let index = 1; index < placed.length; index += 1) {
								if (Math.abs(placed[index].x - x) < Math.abs(placed[nearest].x - x)) {
									nearest = index;
								}
							}
							setHovered(nearest);
						}}
						onPointerLeave={() => setHovered(null)}
					>
						<polyline
							className={styles.line}
							points={placed.map(({ x, y }) => `${x},${y}`).join(" ")}
						/>

						{hovered !== null && mark && (
							<line className={styles.hairline} x1={mark.x} x2={mark.x} y1={0} y2={height} />
						)}

						{mark && <circle className={styles.end} cx={mark.x} cy={mark.y} r={4} />}
					</svg>
				)}
			</div>
		</div>
	);
};
