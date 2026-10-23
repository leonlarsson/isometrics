import { describe, expect, it } from "vitest";

import { candidateShifts, type ILabelItem, type IRect, layoutLabels } from "./labelLayout";

const card = { width: 100, height: 40 };
const chip = { width: 50, height: 20 };

const item = (id: string, x: number, y: number, extra: Partial<ILabelItem> = {}): ILabelItem => ({
	id,
	x,
	y,
	card,
	chip,
	priority: 0,
	...extra,
});

/** The box a card covers once placed. */
const boxOf = (it: ILabelItem, dx: number, dy: number, compact: boolean): IRect => {
	const size = compact ? it.chip : it.card;
	const x = it.x + dx;
	const y = it.y + dy;
	return { left: x - size.width / 2, top: y - size.height, right: x + size.width / 2, bottom: y };
};

const apart = (a: IRect, b: IRect) =>
	a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;

describe("layoutLabels", () => {
	it("leaves cards that don't touch where they are", () => {
		const result = layoutLabels([item("a", 100, 100), item("b", 400, 100)], []);
		expect(result.get("a")).toEqual({ dx: 0, dy: 0, compact: false });
		expect(result.get("b")).toEqual({ dx: 0, dy: 0, compact: false });
	});

	it("moves the later of two overlapping cards, and they end up apart", () => {
		const items = [item("a", 200, 200), item("b", 220, 210)];
		const result = layoutLabels(items, []);
		const a = result.get("a");
		const b = result.get("b");
		expect(a).toEqual({ dx: 0, dy: 0, compact: false });
		expect(b && (b.dx !== 0 || b.dy !== 0)).toBe(true);
		if (a && b) {
			expect(apart(boxOf(items[0], a.dx, a.dy, false), boxOf(items[1], b.dx, b.dy, false))).toBe(
				true,
			);
		}
	});

	it("gives the higher priority card its own spot", () => {
		const result = layoutLabels([item("a", 200, 200), item("b", 205, 200, { priority: 1 })], []);
		expect(result.get("b")).toEqual({ dx: 0, dy: 0, compact: false });
		expect(result.get("a")).not.toEqual({ dx: 0, dy: 0, compact: false });
	});

	it("prefers moving up over moving down", () => {
		const result = layoutLabels([item("a", 200, 200), item("b", 200, 200)], []);
		expect(result.get("b")?.dy).toBeLessThan(0);
	});

	it("keeps clear of obstacles", () => {
		const title: IRect = { left: 0, top: 0, right: 300, bottom: 60 };
		const it = item("a", 150, 80);
		const placed = layoutLabels([it], [title]).get("a");
		expect(placed).toBeDefined();
		if (placed) {
			expect(apart(boxOf(it, placed.dx, placed.dy, placed.compact), title)).toBe(true);
		}
	});

	it("shrinks a card to a chip when there's no room for the full card", () => {
		// A wall of obstacles with a hole just big enough for a chip.
		const around: IRect[] = [
			{ left: -1000, top: -1000, right: 1000, bottom: 170 },
			{ left: -1000, top: 210, right: 1000, bottom: 1000 },
			{ left: -1000, top: -1000, right: 160, bottom: 1000 },
			{ left: 240, top: -1000, right: 1000, bottom: 1000 },
		];
		const result = layoutLabels([item("a", 200, 200)], around, { gap: 0 });
		expect(result.get("a")?.compact).toBe(true);
	});

	it("falls back to a chip on its own spot when nothing is free", () => {
		const everything: IRect = { left: -5000, top: -5000, right: 5000, bottom: 5000 };
		expect(layoutLabels([item("a", 200, 200)], [everything]).get("a")).toEqual({
			dx: 0,
			dy: 0,
			compact: true,
		});
	});

	it("stays a chip when asked to, even with room for the card", () => {
		expect(layoutLabels([item("a", 200, 200, { chipOnly: true })], []).get("a")).toEqual({
			dx: 0,
			dy: 0,
			compact: true,
		});
	});

	it("keeps last frame's spot while it's still free, rather than jumping", () => {
		const previous = { dx: 36, dy: -60, compact: false };
		const result = layoutLabels([item("a", 200, 200), item("b", 200, 200, { previous })], []);
		expect(result.get("b")).toEqual(previous);
	});

	it("goes back to its own spot once that's free again", () => {
		const previous = { dx: 36, dy: -60, compact: false };
		expect(layoutLabels([item("b", 200, 200, { previous })], []).get("b")).toEqual({
			dx: 0,
			dy: 0,
			compact: false,
		});
	});
});

describe("candidateShifts", () => {
	it("starts at no shift and stays within reach", () => {
		const shifts = candidateShifts(120, 12);
		expect(shifts[0]).toMatchObject({ dx: 0, dy: 0 });
		expect(shifts.every((shift) => shift.cost <= 120)).toBe(true);
	});
});
