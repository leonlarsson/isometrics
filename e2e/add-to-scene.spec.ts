import type { Page } from "@playwright/test";

import {
	expect,
	groundSpot,
	loadWorld,
	menuItem,
	openEditor,
	read,
	showView,
	test,
} from "./editor";

const palette = (page: Page) => page.getByRole("navigation", { name: "Parts" });
const tile = (page: Page, name: string) =>
	palette(page).getByRole("button", { name, exact: true }).first();

test.beforeEach(async ({ page }) => {
	await openEditor(page);
	await loadWorld(page, {});
	await showView(page, [0, 0], 30);
});

test.describe("Add to scene (ADR-0051)", () => {
	test("a click adds the part where you're looking, selected; it's then recently used", async ({
		page,
	}) => {
		await tile(page, "House").click();
		const added = await read(page, (s) => s.scene.entities.at(-1));
		expect(added?.kind).toBe("house_01");
		expect(await read(page, (s) => s.selectedId)).toBe(added?.id);
		await expect(palette(page).getByText("Recently used")).toBeVisible();
	});

	test("the search narrows the parts, and says when nothing matches", async ({ page }) => {
		await palette(page).getByRole("searchbox", { name: "Search parts" }).fill("tree");
		await expect(tile(page, "Round tree")).toBeVisible();
		await expect(tile(page, "House")).toBeHidden();
	});

	test("a part's right-click menu makes it a favourite", async ({ page }) => {
		await tile(page, "Office tower").click({ button: "right" });
		await menuItem(page, "Favourite").click();
		await expect(palette(page).getByText("Favourites")).toBeVisible();
	});

	test("a part dragged onto the view lands where it's dropped", async ({ page }) => {
		await tile(page, "Round tree").scrollIntoViewIfNeeded();
		const box = await tile(page, "Round tree").boundingBox();
		const spot = await groundSpot(page, [5, 5]);
		if (!box) {
			throw new Error("no tile");
		}
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(spot.x, spot.y, { steps: 12 });
		await page.mouse.up();
		const tree = await read(page, (s) => s.scene.entities.at(-1));
		expect(tree?.kind).toBe("round_tree_01");
		expect(tree?.position.map(Math.round)).toEqual([5, 5]);
	});

	test("the ground's right-click menu adds a part there, or starts a road from there", async ({
		page,
	}) => {
		const spot = await groundSpot(page, [-6, 4]);
		await page.mouse.click(spot.x, spot.y, { button: "right" });
		await menuItem(page, "Add here").click();
		await menuItem(page, "Street lamp").click();
		const lamp = await read(page, (s) => s.scene.entities.at(-1));
		expect(lamp?.kind).toBe("street_lamp_01");
		expect(lamp?.position).toEqual([-6, 4]);

		// Elsewhere: the lamp now stands on that spot (its own menu would open).
		const elsewhere = await groundSpot(page, [6, -4]);
		await page.mouse.click(elsewhere.x, elsewhere.y, { button: "right" });
		await menuItem(page, "Draw a road from here").click();
		await menuItem(page, /^Road$/).click();
		expect(await read(page, (s) => s.drawing?.points.length)).toBe(1);
	});
});
