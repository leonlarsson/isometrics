export const DEG2RAD = Math.PI / 180;

export const toRadians = (degrees: number) => degrees * DEG2RAD;

export const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/** Snap a value to the nearest multiple of `step`. */
export const snap = (value: number, step: number) =>
	step > 0 ? Math.round(value / step) * step : value;

/** Wrap any angle into [0, 360). */
export const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

/** Round to a fixed number of decimals, avoiding float noise in saved JSON. */
export const round = (value: number, digits = 3) => {
	const factor = 10 ** digits;
	// "+ 0" turns -0 into 0, so a turned position doesn't come out as -0.
	return Math.round(value * factor) / factor + 0;
};
