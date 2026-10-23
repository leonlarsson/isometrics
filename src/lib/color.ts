/** Hex colour maths ("#rrggbb"), framework-free. */

const channels = (hex: string) => {
	const value = Number.parseInt(hex.slice(1, 7), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const toHex = (rgb: number[]) =>
	`#${rgb
		.map((c) =>
			Math.round(Math.min(255, Math.max(0, c)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;

/** The colour `t` (0–1) of the way from `a` to `b`. */
export const mixColor = (a: string, b: string, t: number) => {
	const from = channels(a);
	const to = channels(b);
	return toHex(from.map((c, i) => c + (to[i] - c) * t));
};

/** `a` tinted by `b` like light through a filter: each channel multiplied, `amount` (0–1) of the way. */
export const tintColor = (a: string, b: string, amount: number) => {
	const base = channels(a);
	const filter = channels(b);
	return toHex(base.map((c, i) => c * (1 - amount + (amount * filter[i]) / 255)));
};
