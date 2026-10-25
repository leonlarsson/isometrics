import type { Page } from "@playwright/test";

import {
	act,
	clickWith,
	expect,
	loadWorld,
	openEditor,
	outliner,
	outlinerRow,
	read,
	selected,
	showView,
	test,
	viewCentre,
} from "./editor";

const row = outlinerRow;

/** A small world of three houses in a row, seen up close. */
const threeHouses = async (page: Page) => {
	await loadWorld(page, {
		entities: [
			{ id: "a", kind: "house_01", name: "House A", position: [-12, 0], scale: 2 },
			{ id: "b", kind: "house_01", name: "House B", position: [0, 0], scale: 2 },
			{ id: "c", kind: "house_01", name: "House C", position: [12, 0], scale: 2 },
		],
	});
	// Up close, so no gizmo reaches the next house; House B in the middle of the view.
	await showView(page, [0, 0], 30);
};

test.describe("selecting (ADR-0028, ADR-0035, ADR-0064)", () => {
	test.beforeEach(async ({ page }) => {
		await openEditor(page);
		await threeHouses(page);
	});

	test("a click in the world selects, a click on the ground deselects", async ({ page }) => {
		const { x, y, box } = await viewCentre(page);
		await page.mouse.click(x, y - 10);
		expect(await selected(page)).toEqual(["b"]);
		await page.mouse.click(box.x + 30, box.y + box.height - 30);
		expect(await selected(page)).toEqual([]);
	});

	test("Shift- and Ctrl-click in the world add and take out", async ({ page }) => {
		const { x, y } = await viewCentre(page);
		await page.mouse.click(x, y - 10);
		await act(page, (s) => s.select("a"));
		await clickWith(page, ["Shift"], x, y - 10);
		expect(await selected(page)).toEqual(["a", "b"]);
		await clickWith(page, ["Control"], x, y - 10);
		expect(await selected(page)).toEqual(["a"]);
	});

	test("the outliner selects, Ctrl-click adds, Shift-click selects the rows between", async ({
		page,
	}) => {
		await row(page, "House A").click();
		expect(await selected(page)).toEqual(["a"]);
		await row(page, "House C").click({ modifiers: ["Control"] });
		expect(await selected(page)).toEqual(["a", "c"]);
		await row(page, "House A").click();
		await row(page, "House C").click({ modifiers: ["Shift"] });
		expect(await selected(page)).toEqual(["a", "b", "c"]);
	});

	test("the outliner can show only the selection", async ({ page }) => {
		await row(page, "House A").click();
		await row(page, "House C").click({ modifiers: ["Control"] });
		await page.getByRole("button", { name: "Only the selection" }).click();
		await expect(row(page, "House B")).toBeHidden();
		await expect(row(page, "House A")).toBeVisible();
	});

	test("Esc deselects", async ({ page }) => {
		await row(page, "House A").click();
		await page.keyboard.press("Escape");
		expect(await selected(page)).toEqual([]);
	});

	test("B and a drag select what's inside the box; Shift+B takes it out", async ({ page }) => {
		const { box } = await viewCentre(page);
		await page.keyboard.press("b");
		await expect(page.getByText("Select with a box")).toBeVisible();
		// Below the world's title, which sits over the view's top-left corner.
		await page.mouse.move(box.x + 10, box.y + 120);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10, { steps: 6 });
		// While dragging, what it would select is previewed.
		expect(await read(page, (s) => s.boxDrag?.items.length)).toBe(3);
		await page.mouse.up();
		expect((await selected(page)).sort()).toEqual(["a", "b", "c"]);
		expect(await read(page, (s) => s.boxSelect)).toBeNull();

		await page.keyboard.press("Shift+B");
		await page.mouse.move(box.x + box.width / 2 - 40, box.y + 120);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height - 10, { steps: 6 });
		await page.mouse.up();
		expect((await selected(page)).sort()).toEqual(["a", "c"]);
	});

	test("Esc cancels a box before it's drawn", async ({ page }) => {
		await page.keyboard.press("b");
		await page.keyboard.press("Escape");
		expect(await read(page, (s) => s.boxSelect)).toBeNull();
	});
});

test.describe("the outliner's other powers (ADR-0035)", () => {
	test.beforeEach(async ({ page }) => {
		await openEditor(page);
		await threeHouses(page);
	});

	test("F2 renames the selection in place", async ({ page }) => {
		await row(page, "House A").click();
		await page.keyboard.press("F2");
		const field = page.getByLabel("Rename House A");
		await field.fill("Corner shop");
		await field.press("Enter");
		expect(await read(page, (s) => s.scene.entities[0].name)).toBe("Corner shop");
	});

	test("hide and lock from a row; H hides the selection, Alt+H shows everything", async ({
		page,
	}) => {
		await outliner(page).getByRole("button", { name: "Hide House A (H)" }).click();
		expect(await read(page, (s) => s.scene.entities[0].hidden)).toBe(true);
		await outliner(page).getByRole("button", { name: "Lock House B" }).click();
		expect(await read(page, (s) => s.scene.entities[1].locked)).toBe(true);

		await row(page, "House C").click();
		await page.keyboard.press("h");
		expect(await read(page, (s) => s.scene.entities[2].hidden)).toBe(true);
		await page.keyboard.press("Alt+h");
		expect(await read(page, (s) => s.scene.entities.some((e) => e.hidden))).toBe(false);
	});

	test("right-click a row: its menu acts on it; on one of several, on all of them", async ({
		page,
	}) => {
		await row(page, "House A").click({ button: "right" });
		await expect(page.getByRole("menu")).toBeVisible();
		await page.getByRole("menuitem", { name: /^Delete/ }).click();
		expect(await read(page, (s) => s.scene.entities.map((e) => e.id))).toEqual(["b", "c"]);

		await row(page, "House B").click();
		await row(page, "House C").click({ modifiers: ["Control"] });
		await row(page, "House C").click({ button: "right" });
		await expect(page.getByText("2 objects selected").first()).toBeVisible();
		await page.getByRole("menuitem", { name: /^Delete/ }).click();
		expect(await read(page, (s) => s.scene.entities.length)).toBe(0);
	});
});

test.describe("deleting and undo (ADR-0009)", () => {
	test("Delete removes the selection; Ctrl+Z brings it back, Ctrl+Shift+Z removes it again", async ({
		page,
	}) => {
		await openEditor(page);
		await threeHouses(page);
		await row(page, "House A").click();
		await row(page, "House B").click({ modifiers: ["Control"] });
		await page.locator("canvas").hover();
		await page.keyboard.press("Delete");
		expect(await read(page, (s) => s.scene.entities.map((e) => e.id))).toEqual(["c"]);
		await page.keyboard.press("Control+z");
		expect(await read(page, (s) => s.scene.entities.length)).toBe(3);
		await page.keyboard.press("Control+Shift+z");
		expect(await read(page, (s) => s.scene.entities.length)).toBe(1);
		// The toolbar's buttons do the same.
		await page.getByRole("button", { name: /^Undo/ }).click();
		expect(await read(page, (s) => s.scene.entities.length)).toBe(3);
	});
});
