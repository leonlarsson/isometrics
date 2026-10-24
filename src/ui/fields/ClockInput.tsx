import { useEffect, useState } from "react";

import { Input } from "./Input";
import { formatClock, parseClock } from "./periods";

interface IClockInputProps {
	/** The time in hours, 0–24 (19.5 = 19:30). */
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
export const ClockInput = ({ hours, onChange, ariaLabel }: IClockInputProps) => {
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
