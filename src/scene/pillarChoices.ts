import type { TRoad } from "./schema";

// See docs/adr/0148-roads-for-interchanges.md.
// The choices at a road's points, kept with their points through every edit of them (as fence
// gates are, ADR-0133): each returns the choices for the road after the edit.

type TChoices = TRoad["pillarsAtPoints"];

/** After a point is put in at `index` (the points from there on move up one). */
export const choicesAfterInsert = (choices: TChoices, index: number): TChoices =>
	choices.map((choice) =>
		choice.pointIndex >= index ? { ...choice, pointIndex: choice.pointIndex + 1 } : choice,
	);

/** After the points at `removed` are taken out: theirs go, the rest move down. */
export const choicesAfterRemove = (choices: TChoices, removed: Iterable<number>): TChoices => {
	const gone = [...removed];
	return choices
		.filter((choice) => !gone.includes(choice.pointIndex))
		.map((choice) => ({
			...choice,
			pointIndex: choice.pointIndex - gone.filter((index) => index < choice.pointIndex).length,
		}));
};

/**
 * After a road of `count` points is turned round: each point's choice goes with it, and "none
 * to the next point" moves to the point that now starts that stretch.
 */
export const choicesAfterReverse = (choices: TChoices, count: number, loops: boolean): TChoices =>
	choices.map((choice) => {
		const i = choice.pointIndex;
		const stretch = choice.placement === "noneToNextPoint";
		const pointIndex = loops
			? (((stretch ? count - 1 - i : count - i) % count) + count) % count
			: stretch
				? count - 2 - i
				: count - 1 - i;
		return { ...choice, pointIndex };
	});

/** The choices of the two roads a road is split into at point `index` (kept by both). */
export const choicesAfterSplit = (choices: TChoices, index: number): [TChoices, TChoices] => [
	choices.filter(
		(choice) =>
			choice.pointIndex < index ||
			(choice.pointIndex === index && choice.placement !== "noneToNextPoint"),
	),
	choices
		.filter((choice) => choice.pointIndex >= index)
		.map((choice) => ({ ...choice, pointIndex: choice.pointIndex - index })),
];

/**
 * Where a road's choices go in a road joined from it (`joinedPoints`): its points start at
 * `offset` in the joined road, turned round first when `reversed`.
 */
export const choicesMovedInto = (
	choices: TChoices,
	count: number,
	{ reversed, offset }: { reversed: boolean; offset: number },
): TChoices =>
	(reversed ? choicesAfterReverse(choices, count, false) : choices).map((choice) => ({
		...choice,
		pointIndex: choice.pointIndex + offset,
	}));
