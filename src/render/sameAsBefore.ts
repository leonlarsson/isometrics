import type { IResolvedLight } from "#/parts/types";

/**
 * What an object's part is drawn with (its colours, transparencies and lights), the same objects
 * as last time while they're equal: they're worked out afresh at every render of the object, so its
 * part was drawn again whenever the object rendered for any other reason. A drag moves the object
 * every frame, and a palace's facades and window rows were all drawn and compared again each time
 * (PERFORMANCE.md). Kept per object while it's drawn (`forgetDrawnWith` when it goes).
 */
const drawnWith = new Map<string, { colors: unknown; transparency: unknown; lights: unknown }>();

const sameRecord = <T>(
	a: Readonly<Record<string, T>>,
	b: Readonly<Record<string, T>>,
	same: (x: T, y: T) => boolean,
) => {
	const keys = Object.keys(a);
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
	);
};

const sameValue = <T>(x: T, y: T) => x === y;

const sameLight = (x: IResolvedLight, y: IResolvedLight) =>
	x.on === y.on &&
	x.level === y.level &&
	x.color === y.color &&
	x.reach === y.reach &&
	x.litPaneShare === y.litPaneShare &&
	x.paneWeight === y.paneWeight;

/** These, or the equal ones the object was last drawn with. */
export const sameAsBefore = <
	C extends Readonly<Record<string, string>>,
	T extends Readonly<Record<string, number>>,
	L extends Readonly<Record<string, IResolvedLight>>,
>(
	id: string,
	now: { colors: C; transparency: T; lights: L },
): { colors: C; transparency: T; lights: L } => {
	const before = drawnWith.get(id) as { colors: C; transparency: T; lights: L } | undefined;
	if (!before) {
		drawnWith.set(id, now);
		return now;
	}
	const kept = {
		colors: sameRecord(now.colors, before.colors, sameValue) ? before.colors : now.colors,
		transparency: sameRecord(now.transparency, before.transparency, sameValue)
			? before.transparency
			: now.transparency,
		lights: sameRecord(now.lights, before.lights, sameLight) ? before.lights : now.lights,
	};
	drawnWith.set(id, kept);
	return kept;
};

/** An object no longer drawn. */
export const forgetDrawnWith = (id: string) => {
	drawnWith.delete(id);
};
