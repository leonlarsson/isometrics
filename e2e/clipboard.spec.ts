import type { Page } from "@playwright/test";

import {
	act,
	entity,
	expect,
	groundSpot,
	keys,
	loadWorld,
	menuItem,
	openEditor,
	outlinerRow,
	read,
	showView,
	test,
} from "./editor";

/** Two lamps (one brighter) and a house, seen up close. */
const lampsAndHouse = async (page: Page) => {
	await loadWorld(page, {
		entities: [
			{
				id: "bright",
				kind: "street_lamp_01",
				name: "Bright lamp",
				position: [-4, 0],
				lights: {
					lamp: {
						whenOn: null,
						comesOn: null,
						schedule: null,
						color: null,
						strength: 2.5,
						reach: null,
						litPanes: null,
						weight: null,
						data: {},
					},
				},
			},
			{ id: "plain", kind: "street_lamp_01", name: "Plain lamp", position: [4, 0] },
			{ id: "house", kind: "house_01", name: "House", position: [0, 6] },
		],
	});
	await showView(page, [0, 2], 30);
};

const lampStrength = async (page: Page, id: string) =>
	((await entity(page, id))?.lights as Record<string, { strength: number | null }>)?.lamp
		?.strength ?? null;

test.beforeEach(async ({ page, context, baseURL }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"], {
		origin: new URL(baseURL ?? "http://localhost:3000").origin,
	});
	await openEditor(page);
	await lampsAndHouse(page);
});

test.describe("copy and paste things (ADR-0068)", () => {
	test("Ctrl+C, then Ctrl+V pastes a copy under the mouse pointer, selected", async ({ page }) => {
		await act(page, (s) => s.select("house"));
		const spot = await groundSpot(page, [8, 8]);
		await page.mouse.move(spot.x, spot.y);
		await keys(page, "Control+c", "Control+v");
		const copy = await read(page, (s) => s.scene.entities.at(-1));
		expect(copy?.name).toBe("House copy");
		expect(copy?.position.map(Math.round)).toEqual([8, 8]);
		expect(await read(page, (s) => s.selectedId)).toBe(copy?.id);
	});

	test("Ctrl+X cuts; the ground menu's Paste here puts it back where clicked", async ({ page }) => {
		await act(page, (s) => s.select("house"));
		const centre = await groundSpot(page, [0, 0]);
		await page.mouse.move(centre.x, centre.y);
		await keys(page, "Control+x");
		expect(await read(page, (s) => s.scene.entities.some((e) => e.id === "house"))).toBe(false);
		const spot = await groundSpot(page, [-8, 8]);
		await page.mouse.click(spot.x, spot.y, { button: "right" });
		await menuItem(page, "Paste here").click();
		// The menu's Paste reads the clipboard, which takes a moment.
		await expect.poll(() => read(page, (s) => s.scene.entities.at(-1)?.name)).toBe("House");
		const pasted = await read(page, (s) => s.scene.entities.at(-1));
		expect(pasted?.position.map(Math.round)).toEqual([-8, 8]);
	});
});

test.describe("copy and paste settings (ADR-0068)", () => {
	test("a light card's Copy, then Paste onto another lamp", async ({ page }) => {
		await act(page, (s) => s.select("bright"));
		await page.getByRole("tab", { name: "Lights", exact: true }).click();
		await page.getByRole("button", { name: "Copy or paste: Lamp light" }).click();
		await menuItem(page, /^Copy/).click();
		await act(page, (s) => s.select("plain"));
		await page.getByRole("button", { name: "Copy or paste: Lamp light" }).click();
		// Not "Paste schedule only" (a menu item's text includes its description).
		await menuItem(page, /^Paste(?! schedule)/).click();
		// Paste reads the clipboard, which takes a moment.
		await expect.poll(() => lampStrength(page, "plain")).toBe(2.5);
	});

	test("Copy settings / Paste settings in the right-click menu, onto several", async ({ page }) => {
		await outlinerRow(page, "Bright lamp").click({ button: "right" });
		await menuItem(page, "Copy settings").click();
		await act(page, (s) =>
			s.selectItems([
				{ kind: "entity", id: "plain" },
				{ kind: "entity", id: "house" },
			]),
		);
		await outlinerRow(page, "Plain lamp").click({ button: "right" });
		await menuItem(page, "Paste settings").click();
		await expect.poll(() => lampStrength(page, "plain")).toBe(2.5);
		// The house isn't a lamp: it takes nothing.
		expect((await entity(page, "house"))?.lights).toEqual({});
	});
});
