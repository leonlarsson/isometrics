/**
 * Screen-space layout for label cards: each card wants to sit at its own spot
 * (its bottom-centre on the leader line's end), but cards mustn't cover each
 * other or the UI floating over the scene. Cards are placed one at a time in
 * priority order; one that would overlap tries nearby free spots, nearest
 * first, and if none is free within reach it shrinks to a chip. Pure maths on
 * rectangles, so it's testable without a browser. See docs/adr/0048.
 */

export interface ISize {
	width: number;
	height: number;
}

export interface IRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface ILabelPlacement {
	/** Shift from the card's own spot, in px. */
	dx: number;
	dy: number;
	/** Shown as a chip (dot and main value) because the full card didn't fit. */
	compact: boolean;
}

export interface ILabelItem {
	id: string;
	/** Where the card's bottom-centre wants to be, in px. */
	x: number;
	y: number;
	card: ISize;
	chip: ISize;
	/** Higher goes first and so keeps its spot; e.g. the selected card. */
	priority: number;
	/** Last frame's placement, kept while it's still free, so cards don't swap back and forth. */
	previous?: ILabelPlacement;
	/** Only try the chip (e.g. it only just shrank, so it doesn't flicker between the two). */
	chipOnly?: boolean;
}

export interface ILabelLayoutOptions {
	/** Empty space kept between cards, and around obstacles, in px. */
	gap?: number;
	/** How far a card may move from its own spot, in px. */
	reach?: number;
	/** Step between the spots tried, in px. */
	step?: number;
}

const overlaps = (a: IRect, b: IRect, gap: number) =>
	a.left < b.right + gap &&
	b.left < a.right + gap &&
	a.top < b.bottom + gap &&
	b.top < a.bottom + gap;

/** A card's box when its bottom-centre is at (x, y). */
const boxAt = (x: number, y: number, size: ISize): IRect => ({
	left: x - size.width / 2,
	top: y - size.height,
	right: x + size.width / 2,
	bottom: y,
});

/**
 * Shifts to try, nearest first. Up is cheapest (cards hang above their pins,
 * so moving up keeps the object in view), then sideways; down only a little,
 * since below the card is the object it labels.
 */
export const candidateShifts = (reach: number, step: number) => {
	const shifts: { dx: number; dy: number; cost: number }[] = [];
	for (let dy = -reach; dy <= step * 2; dy += step) {
		for (let dx = -reach; dx <= reach; dx += step) {
			const cost = Math.hypot(dx, dy * (dy < 0 ? 0.7 : 2));
			if (cost <= reach) {
				shifts.push({ dx, dy, cost });
			}
		}
	}
	return shifts.sort((a, b) => a.cost - b.cost);
};

const shiftCache = new Map<string, ReturnType<typeof candidateShifts>>();

const shiftsFor = (reach: number, step: number) => {
	const key = `${reach}:${step}`;
	let shifts = shiftCache.get(key);
	if (!shifts) {
		shifts = candidateShifts(reach, step);
		shiftCache.set(key, shifts);
	}
	return shifts;
};

/** Place every card; `obstacles` are boxes no card may cover (titles, bars, sheets). */
export const layoutLabels = (
	items: readonly ILabelItem[],
	obstacles: readonly IRect[],
	{ gap = 6, reach = 120, step = 12 }: ILabelLayoutOptions = {},
): Map<string, ILabelPlacement> => {
	const placed: IRect[] = [...obstacles];
	const result = new Map<string, ILabelPlacement>();
	const shifts = shiftsFor(reach, step);
	const order = [...items].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));

	const free = (box: IRect) => !placed.some((other) => overlaps(box, other, gap));

	/** Its own spot if free, else last frame's if still free (no jumping between near-equal spots), else the nearest free one. */
	const tryPlace = (item: ILabelItem, compact: boolean) => {
		const size = compact ? item.chip : item.card;
		const own = boxAt(item.x, item.y, size);
		if (free(own)) {
			return { box: own, placement: { dx: 0, dy: 0, compact } };
		}
		const previous = item.previous;
		if (previous && previous.compact === compact) {
			const box = boxAt(item.x + previous.dx, item.y + previous.dy, size);
			if (free(box)) {
				return { box, placement: { dx: previous.dx, dy: previous.dy, compact } };
			}
		}
		for (const { dx, dy } of shifts) {
			const box = boxAt(item.x + dx, item.y + dy, size);
			if (free(box)) {
				return { box, placement: { dx, dy, compact } };
			}
		}
		return null;
	};

	for (const item of order) {
		const spot = (item.chipOnly ? null : tryPlace(item, false)) ??
			tryPlace(item, true) ?? {
				// Nowhere free: a chip on its own spot, over whatever is there.
				box: boxAt(item.x, item.y, item.chip),
				placement: { dx: 0, dy: 0, compact: true },
			};
		placed.push(spot.box);
		result.set(item.id, spot.placement);
	}
	return result;
};
