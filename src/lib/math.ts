export const DEG2RAD = Math.PI / 180;

export const toRadians = (degrees: number) => degrees * DEG2RAD;

export const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/** Snap a value to the nearest multiple of `step`. */
export const snap = (value: number, step: number) =>
	step > 0 ? Math.round(value / step) * step : value;

/** Wrap any angle into [0, 360). */
export const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

/** Degrees as −180–180 (a tilt either way). */
export const wrapDegrees = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

/** Round to a fixed number of decimals, avoiding float noise in saved JSON. */
export const round = (value: number, digits = 3) => {
	const factor = 10 ** digits;
	// "+ 0" turns -0 into 0, so a turned position doesn't come out as -0.
	return Math.round(value * factor) / factor + 0;
};

/**
 * How far a width × depth footprint reaches along x and along z (half the box
 * round it) once turned by `degrees` about its centre and scaled.
 */
export const turnedHalfSize = (
	width: number,
	depth: number,
	degrees: number,
	scale: number,
): [number, number] => {
	const turn = (degrees * Math.PI) / 180;
	const cos = Math.abs(Math.cos(turn));
	const sin = Math.abs(Math.sin(turn));
	return [((width * cos + depth * sin) * scale) / 2, ((width * sin + depth * cos) * scale) / 2];
};
