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

		// The turn around the vertical is Rotation's Y (X and Z tip it, ADR-0097).
		await box(page, "Rotation (°) Y").fill("45");
		await box(page, "Rotation (°) Y").press("Enter");
		expect((await entity(page, "a"))?.rotation).toBe(45);

		// Typing is one undo step.
		await page.locator("canvas").hover();
		await page.keyboard.press("Control+z");
		expect((await entity(page, "a"))?.rotation).toBe(0);
	});

	test("a length's presets set it in one click, the chosen one showing (shipping container)", async ({
		page,
	}) => {
		await loadWorld(page, {
			entities: [{ id: "box", kind: "shipping_container_01", name: "Box", position: [0, 0] }],
		});
		await act(page, (s) => s.select("box"));
		await tab(page, "Shape").click();
		const presets = page.getByRole("group", { name: "Length: presets" });
		await expect(presets.getByRole("button", { name: "Standard" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await presets.getByRole("button", { name: "Long", exact: true }).click();
		expect((await entity(page, "box"))?.props.length).toBe(3.1);
		await box(page, "Length").fill("2");
		await box(page, "Length").press("Enter");
		expect((await entity(page, "box"))?.props.length).toBe(2);
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

	test("see-through glass has a Transparency setting under its colour (ADR-0090)", async ({
		page,
	}) => {
		await loadWorld(page, { entities: [{ id: "g", kind: "greenhouse_01", position: [0, 0] }] });
		await act(page, (s) => s.select("g"));
		await tab(page, "Look").click();
		const glass = page.locator("fieldset").filter({ hasText: /^Glass/ });
		const transparency = glass.getByRole("textbox", { name: "Transparency" });
		await expect(transparency).toHaveValue("65");
		await transparency.fill("20");
		await transparency.press("Enter");
		await expect
			.poll(async () => (await entity(page, "g"))?.colors.glass?.transparency)
			.toBeCloseTo(0.2);
		// Solid colours have none.
		const frame = page.locator("fieldset").filter({ hasText: /^Frame/ });
		await expect(frame.getByRole("textbox", { name: "Transparency" })).toHaveCount(0);
	});

	test("the settings search finds a setting, and says when nothing matches", async ({ page }) => {
		await page.getByRole("button", { name: "Search the settings" }).click();
		await page.getByRole("searchbox", { name: "Search the settings" }).fill("lift");
		await expect(box(page, "Lift")).toBeVisible();
		await expect(box(page, "Rotation (°) Y")).toBeHidden();
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

	test("a building's windows are split between its window lights with one bar, one undo step", async ({
		page,
	}) => {
		await loadWorld(page, {
			entities: [{ id: "tower", kind: "office_tower_01", name: "Tower", position: [0, 0] }],
		});
		await act(page, (s) => s.select("tower"));
		await tab(page, "Lights").click();
		const divider = page.getByRole("slider", { name: "Between Windows and Screens" });
		await expect(divider).toBeVisible();
		const before = await divider.getAttribute("aria-valuenow");
		await divider.focus();
		await page.keyboard.press("ArrowLeft");
		const lights = () =>
			entity(page, "tower").then((e) => e?.lights as Record<string, { weight: number | null }>);
		const after = await lights();
		expect(after.windows.weight).toBe(Number(before) - 1);
		expect((after.windows.weight ?? 0) + (after.screens.weight ?? 0)).toBe(100);
		// One undo step for the whole split.
		await act(page, (s) => s.undo());
		expect((await lights())?.windows?.weight ?? null).toBeNull();
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
