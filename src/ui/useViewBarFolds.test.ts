import { describe, expect, it } from "vitest";

import { foldsAt, VIEW_BAR_FOLDS } from "./useViewBarFolds";

describe("the view bar's folds (ADR-0142)", () => {
	it("folds nothing when there's room, and everything when there's none", () => {
		expect(foldsAt(2000, "edit")).toBe(0);
		expect(foldsAt(100, "edit")).toBe(VIEW_BAR_FOLDS.length);
	});

	it("folds more, never less, as the bar narrows, in both modes", () => {
		for (const mode of ["edit", "view"] as const) {
			let last = 0;
			for (let width = 1400; width >= 100; width -= 2) {
				const count = foldsAt(width, mode);
				expect(count).toBeGreaterThanOrEqual(last);
				last = count;
			}
		}
	});

	it("needs less room in View mode, which has no history or tools", () => {
		for (let width = 1400; width >= 100; width -= 10) {
			expect(foldsAt(width, "view")).toBeLessThanOrEqual(foldsAt(width, "edit"));
		}
	});

	it("keeps the editor's words at 1280px with the side panels open", () => {
		// 1280 less Add to scene (248) and the properties (360), as a new browser has them.
		const folded = VIEW_BAR_FOLDS.slice(0, foldsAt(1280 - 248 - 360, "edit"));
		expect(folded).toEqual(["shading", "viewsLabel", "playAndRecentre"]);
	});

	it("on phones folds exactly as the phone toolbar did, whatever the width", () => {
		const phone = VIEW_BAR_FOLDS.indexOf("viewMenus") + 1;
		expect(foldsAt(2000, "edit", "viewMenus")).toBe(phone);
		expect(foldsAt(200, "edit", "viewMenus")).toBe(phone);
	});
});
