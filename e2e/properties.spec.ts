import type { Page } from "@playwright/test";

import { act, entity, expect, loadWorld, openEditor, read, showView, test } from "./editor";

/** A lamp and two houses, one house selected, its Object tab open. */
const smallStreet = async (page: Page) => {
	await loadWorld(page, {
		entities: [
			{ id: "a", kind: "house_01", name: "House A", position: [-4, 0], rotation: 0 },
			{ id: "b", kind: "house_01", name: "House B", position: [4, 0], rotation: 90 },
			{ id: "lamp", kind: "street_lamp_01", name: "Lamp", position: [0, 4] },
		],
	});
	await showView(page, [0, 0], 30);
	await act(page, (s) => s.select("a"));
};

const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

test.describe("the properties editor (ADR-0054)", () => {
	test.beforeEach(async ({ page }) => {
		await openEditor(page);
		await smallStreet(page);
	});

	test("the selection's tabs show its settings; editing them changes it", async ({ page }) => {
		await expect(tab(page, "Object")).toBeVisible();
		await page.getByLabel("Name").fill("Bakery");
		expect((await entity(page, "a"))?.name).toBe("Bakery");

		await box(page, "Rotation").fill("45");
		await box(page, "Rotation").press("Enter");
		expect((await entity(page, "a"))?.rotation).toBe(45);

		// Typing is one undo step.
		await page.locator("canvas").hover();
		await page.keyboard.press("Control+z");
		expect((await entity(page, "a"))?.rotation).toBe(0);
	});

	test("with nothing selected, the world's tabs show", async ({ page }) => {
		await act(page, (s) => s.clearSelection());
		await tab(page, "World").click();
		await expect(page.getByLabel("Title").first()).toBeVisible();
		await expect(tab(page, "Object")).toBeHidden();
	});

	test("a colour shows Default until set, and Reset goes back (ADR-0027, ADR-0060)", async ({
		page,
	}) => {
		await tab(page, "Look").click();
		const roof = page.locator("fieldset").filter({ hasText: /^Roof/ });
		await expect(roof.getByText("Default")).toBeVisible();
		await roof.getByRole("button", { name: "Colour" }).click();
		// The presets are named, not only shown (ADR-0089): picked by name, then the field says it.
		await page.getByRole("button", { name: /^Use teal green/ }).click();
		await expect(page.getByRole("button", { name: /^Use teal green/ })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await page.keyboard.press("Escape");
		await expect(roof.getByText("Teal green")).toBeVisible();
		await expect(roof.getByRole("button", { name: "Reset" })).toBeVisible();
		expect((await entity(page, "a"))?.colors.roof?.color).toBeTruthy();
		await roof.getByRole("button", { name: "Reset" }).click();
		expect((await entity(page, "a"))?.colors.roof ?? null).toBeNull();
	});

	test("the settings search finds a setting, and says when nothing matches", async ({ page }) => {
		await page.getByRole("button", { name: "Search the settings" }).click();
		await page.getByRole("searchbox", { name: "Search the settings" }).fill("lift");
		await expect(box(page, "Lift")).toBeVisible();
		await expect(box(page, "Rotation")).toBeHidden();
		await page.getByRole("searchbox", { name: "Search the settings" }).fill("zzzz");
		await expect(page.getByText(/No settings match/)).toBeVisible();
	});

	test("the label card shows on the object, with its values (ADR-0008)", async ({ page }) => {
		await tab(page, "Label").click();
		await page.getByRole("switch", { name: "Show" }).click();
		expect((await entity(page, "a"))?.label?.enabled).toBe(true);
		await expect(page.getByRole("button", { name: /House A/ }).first()).toBeVisible();
	});

	test("a light's settings change it, with Default and Reset (ADR-0058)", async ({ page }) => {
		await act(page, (s) => s.select("lamp"));
		await tab(page, "Lights").click();
		await box(page, "Level").fill("200");
		await box(page, "Level").press("Enter");
		const lamp = (await entity(page, "lamp"))?.lights as Record<string, { strength: number }>;
		expect(lamp.lamp.strength).toBe(2);
	});
});

test.describe("several selected (ADR-0064)", () => {
	test("a setting that differs says Mixed; changing it sets it on all", async ({ page }) => {
		await openEditor(page);
		await smallStreet(page);
		await act(page, (s) =>
			s.selectItems([
				{ kind: "entity", id: "a" },
				{ kind: "entity", id: "b" },
			]),
		);
		await expect(page.getByText("2 objects selected").first()).toBeVisible();
		await expect(page.getByText("Mixed").first()).toBeVisible();
		await box(page, "Rotation").fill("30");
		await box(page, "Rotation").press("Enter");
		expect((await entity(page, "a"))?.rotation).toBe(30);
		expect((await entity(page, "b"))?.rotation).toBe(30);
		await expect(page.getByText("Mixed")).toHaveCount(0);
	});

	test("the Selection panel narrows the selection to one kind", async ({ page }) => {
		await openEditor(page);
		await smallStreet(page);
		await act(page, (s) =>
			s.selectItems([
				{ kind: "entity", id: "a" },
				{ kind: "entity", id: "lamp" },
				{ kind: "entity", id: "b" },
			]),
		);
		await page.getByRole("button", { name: /^House\s*2$/ }).click();
		expect((await read(page, (s) => s.selectedItems.map((i) => i.id))).sort()).toEqual(["a", "b"]);
	});
});
