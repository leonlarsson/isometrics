import { act, expect, menuItem, openEditor, read, test } from "./editor";

test.describe("the side panes (ADR-0055)", () => {
	test("each folds to a strip and opens again; Ctrl+Space hides both", async ({ page }) => {
		await openEditor(page);
		const parts = page.getByRole("navigation", { name: "Parts" });
		await page.getByRole("button", { name: "Hide Add to scene" }).click();
		await expect(parts).toBeHidden();
		await page.getByRole("button", { name: /Show Add to scene/ }).click();
		await expect(parts).toBeVisible();

		await page.locator("canvas").hover();
		await page.keyboard.press("Control+Space");
		await expect(parts).toBeHidden();
		await expect(page.getByRole("tab", { name: "World" })).toBeHidden();
		await page.keyboard.press("Control+Space");
		await expect(parts).toBeVisible();
	});
});

test.describe("phones (ADR-0030, ADR-0046)", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test("the panels live in a bottom sheet; selecting opens it", async ({ page }) => {
		await openEditor(page);
		await expect(page.getByRole("tab", { name: "Add to scene" })).toBeVisible();
		await page.getByRole("tab", { name: "Outliner" }).click();
		await expect(page.getByRole("searchbox", { name: "Search the world" })).toBeVisible();
		await act(page, (s) => s.select(s.scene.entities[0].id));
		await expect(page.getByRole("tab", { name: "Object" })).toBeVisible();
	});

	test("the toolbar's More menu holds what doesn't fit", async ({ page }) => {
		await openEditor(page);
		await page.getByRole("button", { name: "More", exact: true }).click();
		await menuItem(page, "Perspective").click();
		expect(await read(page, (s) => s.projection)).toBe("perspective");
	});
});
