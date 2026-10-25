import type { Page } from "@playwright/test";

import {
	act,
	clickWith,
	expect,
	groundSpot,
	keys,
	loadWorld,
	openEditor,
	read,
	showView,
	test,
	viewCentre,
} from "./editor";

const palette = (page: Page) => page.getByRole("navigation", { name: "Parts" });

/** Screen spots across the view, left to right, to draw through and click again later. */
const spotsAcross = async (page: Page, count: number) => {
	const { x, y } = await viewCentre(page);
	return Array.from({ length: count }, (_, i) => ({
		x: x - 180 + (360 * i) / (count - 1),
		y: y + 60,
	}));
};

/** Draw a road (or area) by clicking these spots, then Enter. */
const drawThrough = async (page: Page, tile: string, spots: { x: number; y: number }[]) => {
	await palette(page).getByRole("button", { name: tile, exact: true }).click();
	for (const spot of spots) {
		await page.mouse.click(spot.x, spot.y);
	}
	await keys(page, "Enter");
};

const road = (page: Page) => read(page, (s) => s.scene.roads[0]);

test.beforeEach(async ({ page }) => {
	await openEditor(page);
	await loadWorld(page, {});
	await showView(page, [0, 0], 30);
});

test.describe("drawing roads and areas (ADR-0017, ADR-0021)", () => {
	test("a road from Add to scene: click points, Enter finishes and selects it", async ({
		page,
	}) => {
		await drawThrough(page, "Road", await spotsAcross(page, 3));
		expect((await road(page))?.points).toHaveLength(3);
		expect(await read(page, (s) => s.selectedRoadId)).toBe(
			await read(page, (s) => s.scene.roads[0].id),
		);
	});

	test("Backspace takes back the last point, Esc gives up", async ({ page }) => {
		const spots = await spotsAcross(page, 3);
		await palette(page).getByRole("button", { name: "Road", exact: true }).click();
		for (const spot of spots) {
			await page.mouse.click(spot.x, spot.y);
		}
		await keys(page, "Backspace");
		expect(await read(page, (s) => s.drawing?.points.length)).toBe(2);
		await keys(page, "Escape");
		expect(await read(page, (s) => s.scene.roads.length)).toBe(0);
	});

	test("an area: click its corners, Enter finishes", async ({ page }) => {
		const { x, y } = await viewCentre(page);
		await drawThrough(page, "Water", [
			{ x: x - 100, y: y + 20 },
			{ x: x + 100, y: y + 20 },
			{ x: x + 100, y: y + 120 },
			{ x: x - 100, y: y + 120 },
		]);
		const area = await read(page, (s) => s.scene.areas[0]);
		expect(area?.type).toBe("water_01");
		expect(area?.points).toHaveLength(4);
	});
});

test.describe("a road's points (ADR-0018, ADR-0023, ADR-0065, ADR-0066)", () => {
	test("click a point, Shift-click another; the arrows move both, Delete keeps two", async ({
		page,
	}) => {
		const spots = await spotsAcross(page, 4);
		await drawThrough(page, "Road", spots);
		await page.mouse.click(spots[1].x, spots[1].y);
		expect(await read(page, (s) => s.selectedPointIndices)).toEqual([1]);
		await clickWith(page, ["Shift"], spots[2].x, spots[2].y);
		expect(await read(page, (s) => s.selectedPointIndices)).toEqual([1, 2]);
		await expect(page.getByText("2 points selected")).toBeVisible();

		const before = (await road(page))?.points ?? [];
		await page.mouse.move(spots[0].x, spots[0].y + 150);
		await keys(page, "ArrowUp");
		const after = (await road(page))?.points ?? [];
		expect(after[1][1]).toBe(before[1][1] - 0.5);
		expect(after[2][1]).toBe(before[2][1] - 0.5);
		expect(after[0]).toEqual(before[0]);

		await keys(page, "Delete");
		expect((await road(page))?.points).toHaveLength(2);
	});

	test("a point's width and height, and Split road here", async ({ page }) => {
		const spots = await spotsAcross(page, 3);
		await drawThrough(page, "Road", spots);
		await page.mouse.click(spots[1].x, spots[1].y);
		await page.getByRole("textbox", { name: "Height", exact: true }).fill("2");
		await page.getByRole("textbox", { name: "Height", exact: true }).press("Enter");
		expect((await road(page))?.points[1][2]).toBe(2);
		await page.getByRole("textbox", { name: "Width here", exact: true }).fill("4");
		await page.getByRole("textbox", { name: "Width here", exact: true }).press("Enter");
		expect((await road(page))?.points[1][3]).toBe(4);

		await page.getByRole("button", { name: "Split road here" }).click();
		expect(await read(page, (s) => s.scene.roads.length)).toBe(2);
	});

	test("with no point selected, G moves the whole road", async ({ page }) => {
		await drawThrough(page, "Road", await spotsAcross(page, 3));
		const before = (await road(page))?.points ?? [];
		expect(await read(page, (s) => s.selectedPointIndex)).toBeNull();
		await page.mouse.move(
			...(Object.values(await viewCentre(page)).slice(0, 2) as [number, number]),
		);
		await keys(page, "g", "2", "Enter");
		const after = (await road(page))?.points ?? [];
		expect(after.map((p) => p[0])).toEqual(before.map((p) => p[0] + 2));
	});
});

test.describe("an area's corners (ADR-0021, ADR-0065)", () => {
	test("corners select like points; deleting would leave too few, so it's refused", async ({
		page,
	}) => {
		const { x, y } = await viewCentre(page);
		const corners = [
			{ x: x - 100, y: y + 20 },
			{ x: x + 100, y: y + 20 },
			{ x: x + 100, y: y + 120 },
			{ x: x - 100, y: y + 120 },
		];
		await drawThrough(page, "Grass", corners);
		// The corners as drawn (on the grid), exactly.
		const points = await read(page, (s) => s.scene.areas[0].points);
		const first = await groundSpot(page, points[0]);
		const second = await groundSpot(page, points[1]);
		await page.mouse.click(first.x, first.y);
		await clickWith(page, ["Control"], second.x, second.y);
		expect(await read(page, (s) => s.selectedPointIndices)).toEqual([0, 1]);
		await expect(page.getByText("2 corners selected")).toBeVisible();
		await keys(page, "Delete");
		await expect(page.getByText("An area needs at least three corners")).toBeVisible();
		expect(await read(page, (s) => s.scene.areas[0].points.length)).toBe(4);
	});

	test("Raised by lifts the whole area", async ({ page }) => {
		const { x, y } = await viewCentre(page);
		await drawThrough(page, "Grass", [
			{ x: x - 100, y: y + 20 },
			{ x: x + 100, y: y + 20 },
			{ x: x, y: y + 120 },
		]);
		await page.getByRole("tab", { name: "Shape", exact: true }).click();
		await page.getByRole("textbox", { name: "Raised by", exact: true }).fill("2");
		await page.getByRole("textbox", { name: "Raised by", exact: true }).press("Enter");
		expect(await read(page, (s) => s.scene.areas[0].height)).toBe(2);
		await act(page, (s) => s.clearSelection());
	});
});
