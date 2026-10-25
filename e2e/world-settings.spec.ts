import type { Page } from "@playwright/test";

import {
	act,
	choose,
	entity,
	expect,
	labelCard,
	loadWorld,
	menuItem,
	openEditor,
	read,
	test,
} from "./editor";

const worldTab = async (page: Page, name: string) => {
	await act(page, (s) => s.clearSelection());
	await page.getByRole("tab", { name, exact: true }).click();
};
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

test.beforeEach(async ({ page }) => {
	await openEditor(page);
});

test.describe("the World tab (ADR-0049, ADR-0063)", () => {
	test("ground size and theme", async ({ page }) => {
		await worldTab(page, "World");
		await box(page, "Width").fill("80");
		await box(page, "Width").press("Enter");
		expect(await read(page, (s) => s.scene.ground.width)).toBe(80);
		await choose(page, "Theme", "Dark");
		expect(await read(page, (s) => s.scene.theme)).toBe("dark");
	});

	test("what viewers see: switching the title off hides it in View mode", async ({ page }) => {
		await worldTab(page, "World");
		await page.getByRole("switch", { name: "Title", exact: true }).click();
		expect(await read(page, (s) => s.scene.onScreen.title)).toBe(false);
		await page.getByRole("button", { name: "View", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Brightwater" })).toBeHidden();
	});
});

test.describe("Sun & sky (ADR-0052, ADR-0061)", () => {
	test("the time follows a day cycle, a preset sets a fixed time, lights can be always on", async ({
		page,
	}) => {
		await worldTab(page, "Sun & sky");
		await choose(page, "Time follows", "A day cycle");
		expect(await read(page, (s) => s.scene.lighting.timeSource)).toBe("cycle");
		await choose(page, "Time follows", "A fixed time");
		await page.getByRole("button", { name: "Preset times" }).click();
		await menuItem(page, "Dusk").click();
		expect(await read(page, (s) => s.scene.lighting.time)).toBeCloseTo(19.7, 1);
		await choose(page, "Lit windows, lamps and headlights", "Always");
		expect(await read(page, (s) => s.scene.lighting.lights)).toBe("on");
	});
});

test.describe("Traffic (ADR-0022, ADR-0042)", () => {
	test("the side vehicles drive on, keeping distance and overtaking", async ({ page }) => {
		await worldTab(page, "Traffic");
		await choose(page, "Vehicles drive on the", "Left");
		expect(await read(page, (s) => s.scene.driving)).toBe("left");
		const overtake = page.getByRole("switch", { name: "Overtake slower vehicles" });
		const before = await overtake.getAttribute("aria-checked");
		await overtake.click();
		expect(await overtake.getAttribute("aria-checked")).not.toBe(before);
	});
});

test.describe("Data (ADR-0010, ADR-0058)", () => {
	test("a value added in the Data tab shows on a label card, and follows edits", async ({
		page,
	}) => {
		await loadWorld(page, {
			entities: [{ id: "depot", kind: "warehouse_01", name: "Depot", position: [0, 0] }],
		});
		await worldTab(page, "Data");
		await page.getByRole("button", { name: "Add", exact: true }).click();
		const key = await read(page, (s) => s.scene.data.at(-1)?.key ?? "");
		await page.getByRole("textbox", { name: "Name" }).last().fill("Orders");
		await page.getByRole("textbox", { name: "Value" }).last().fill("42");
		await page.getByRole("textbox", { name: "Value" }).last().press("Tab");
		await act(
			page,
			(s, key) =>
				s.updateEntity("depot", (e) => {
					e.label = { enabled: true, title: "Depot", dataKeys: [key], offset: [0, 2, 0] };
				}),
			key,
		);
		const card = labelCard(page, /Depot/);
		await expect(card).toContainText("42");
		await page.getByRole("textbox", { name: "Value" }).last().fill("57");
		await page.getByRole("textbox", { name: "Value" }).last().press("Tab");
		await expect(card).toContainText("57");

		await page.getByRole("button", { name: "Remove value" }).last().click();
		expect((await entity(page, "depot"))?.label?.dataKeys).toEqual([]);
	});

	test("a light can follow a data value (From data)", async ({ page }) => {
		await loadWorld(page, {
			entities: [{ id: "lamp", kind: "street_lamp_01", name: "Lamp", position: [0, 0] }],
		});
		await act(page, (s) => {
			s.upsertData({ key: "alert", label: "Alert", value: 1, unit: "" });
			s.select("lamp");
		});
		await page.getByRole("tab", { name: "Lights", exact: true }).click();
		await choose(page, "When", "From data");
		const lamp = (await entity(page, "lamp"))?.lights as Record<
			string,
			{ data: Record<string, { key: string }> }
		>;
		// It starts with the world's first value, to be changed in the fields below.
		expect(lamp.lamp.data.on.key).toBe(await read(page, (s) => s.scene.data[0].key));
	});
});
