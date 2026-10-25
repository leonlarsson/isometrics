import { act, expect, labelCard, openEditor, read, test } from "./editor";

test.describe("View mode (ADR-0063)", () => {
	test.beforeEach(async ({ page }) => {
		await openEditor(page);
	});

	test("hides the editing panels, and Edit brings them back", async ({ page }) => {
		await expect(page.getByRole("navigation", { name: "Parts" })).toBeVisible();
		await page.getByRole("button", { name: "View", exact: true }).click();
		expect(await read(page, (s) => s.mode)).toBe("view");
		await expect(page.getByRole("navigation", { name: "Parts" })).toBeHidden();
		await expect(page.getByRole("tab", { name: "World" })).toBeHidden();
		await page.getByRole("button", { name: "Edit", exact: true }).click();
		await expect(page.getByRole("navigation", { name: "Parts" })).toBeVisible();
	});

	test("clicking a label card opens its details; Close shuts them", async ({ page }) => {
		await page.getByRole("button", { name: "View", exact: true }).click();
		await labelCard(page, /Parcels today/).click();
		const details = page.getByRole("complementary", { name: /details/ });
		await expect(details).toBeVisible();
		await details.getByRole("button", { name: "Close details" }).click();
		await expect(details).toBeHidden();
	});

	test("switching to View mode clears the selection and editing tools", async ({ page }) => {
		await act(page, (s) => s.select(s.scene.entities[0].id));
		await page.getByRole("button", { name: "View", exact: true }).click();
		expect(await read(page, (s) => s.selectedItems)).toEqual([]);
		await expect(page.getByRole("button", { name: /^Undo/ })).toBeHidden();
	});
});
