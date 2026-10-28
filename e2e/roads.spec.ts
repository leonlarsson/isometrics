import type { Page } from "@playwright/test";

import {
	act,
	clickWith,
	dragBy,
	expect,
	gizmoSpot,
	groundSpot,
	keys,
	loadWorld,
	menuItem,
	openEditor,
	paletteTile,
	read,
	showView,
	test,
	viewCentre,
} from "./editor";

/** Screen spots across the view, left to right, to draw through and click again later. */
const spotsAcross = async (page: Page, count: number) => {
	const { x, y } = await viewCentre(page);
	return Array.from({ length: count }, (_, i) => ({
		x: x - 180 + (360 * i) / (count - 1),
		y: y + 60,
	}));
};

/** Add to scene's tile for a road style or area type. */
const drawTile = (page: Page, tile: string) =>
	paletteTile(page, ["Road", "Dirt path", "Hidden route"].includes(tile) ? "Roads" : "Areas", tile);

/** Draw a road (or area) by clicking these spots, then Enter. */
const drawThrough = async (page: Page, tile: string, spots: { x: number; y: number }[]) => {
	await (await drawTile(page, tile)).click();
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
		await (await drawTile(page, "Road")).click();
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

	test("a corner's own height: its Height field, then G then Y (ADR-0096)", async ({ page }) => {
		await loadWorld(page, {
			areas: [
				{
					id: "hill",
					type: "grass_01",
					height: 0,
					points: [
						[-3, -2],
						[3, -2],
						[3, 2],
						[-3, 2],
					],
				},
			],
		});
		// From close up, so the whole area's gizmo doesn't cover its corners.
		await showView(page, [0, 0], 12);
		// Its corner's handle stands on the top, where it's clicked.
		await act(page, (s) => s.selectArea("hill"));
		const corner = await groundSpot(page, [3, -2], 0.12);
		await page.mouse.click(corner.x, corner.y);
		expect(await read(page, (s) => s.selectedPointIndex)).toBe(1);
		await page.getByRole("tab", { name: "Shape", exact: true }).click();
		const height = page.getByRole("textbox", { name: "Height", exact: true });
		await height.fill("3");
		await height.press("Enter");
		// A flat area turns solid where the corner rises.
		expect(await read(page, (s) => s.scene.areas[0].points[1])).toEqual([3, -2, 3]);
		await height.blur();
		await page.mouse.move(corner.x - 200, corner.y + 100, { steps: 4 });
		await keys(page, "g", "y", "1", "Enter");
		expect(await read(page, (s) => s.scene.areas[0].points[1])).toEqual([3, -2, 4]);
	});

	test("the green arrows lift a flat area's corner, and the whole area (ADR-0096)", async ({
		page,
	}) => {
		await loadWorld(page, {
			areas: [
				{
					id: "lawn",
					type: "grass_01",
					points: [
						[-4, -3],
						[4, -3],
						[4, 3],
						[-4, 3],
					],
				},
			],
		});
		await showView(page, [0, 0], 14);
		const settled = () =>
			page.evaluate(() => ({
				cursorHidden: document.documentElement.hasAttribute("data-cursor-hidden"),
				dragging: globalThis.__editorStore.getState().dragging,
			}));
		// A corner's arrow: the corner rises, and the drag ends as it should.
		await act(page, (s) => s.selectAreaPoint("lawn", 1));
		const lift = () => read(page, (s) => s.scene.areas[0].points[1][2] ?? 0);
		await dragBy(page, await gizmoSpot(page, [4, 0, -3], [0, 0.8, 0], 14), 0, -60);
		await expect.poll(lift).toBeGreaterThan(0);
		expect(await settled()).toEqual({ cursorHidden: false, dragging: false });
		// The gizmo rose with it: grabbing its arrow where it is now lifts it again.
		const first = await lift();
		await dragBy(page, await gizmoSpot(page, [4, first, -3], [0, 0.8, 0], 14), 0, -60);
		await expect.poll(lift).toBeGreaterThan(first);
		// And along the ground: twice, from where its square is after the first move.
		const corner = () => read(page, (s) => s.scene.areas[0].points[1]);
		const lifted = await lift();
		await dragBy(page, await gizmoSpot(page, [4, lifted, -3], [0.35, 0, 0.35], 14), 80, 0);
		await expect.poll(async () => (await corner())[0]).not.toBe(4);
		const [x, z] = await corner();
		await dragBy(page, await gizmoSpot(page, [x, lifted, z], [0.35, 0, 0.35], 14), 80, 0);
		await expect.poll(async () => (await corner())[0]).not.toBe(x);

		// The whole area, with no corner selected: its arrow is Raised by, and its gizmo follows a move.
		await act(page, (s) => {
			s.clearSelection();
			s.selectArea("lawn");
		});
		const height = () => read(page, (s) => s.scene.areas[0].height);
		// Where the whole area's gizmo is: the middle of its corners, on its height.
		const middle = () =>
			read(page, (s): [number, number, number] => {
				const { points, height } = s.scene.areas[0];
				const xs = points.map((p) => p[0]);
				const zs = points.map((p) => p[1]);
				return [
					(Math.min(...xs) + Math.max(...xs)) / 2,
					height,
					(Math.min(...zs) + Math.max(...zs)) / 2,
				];
			});
		await dragBy(page, await gizmoSpot(page, await middle(), [0, 0.8, 0], 14), 0, -60);
		await expect.poll(height).toBeGreaterThan(0);
		expect(await settled()).toEqual({ cursorHidden: false, dragging: false });
		const westmost = () => read(page, (s) => s.scene.areas[0].points[0][0]);
		await dragBy(page, await gizmoSpot(page, await middle(), [0.35, 0, 0.35], 14), 80, 0);
		await expect.poll(westmost).not.toBe(-4);
		const moved = await westmost();
		await dragBy(page, await gizmoSpot(page, await middle(), [0.35, 0, 0.35], 14), 80, 0);
		await expect.poll(westmost).not.toBe(moved);
	});

	test("a peak inside an area: add it, set its height, lift it, delete it (ADR-0101)", async ({
		page,
	}) => {
		await loadWorld(page, {
			areas: [
				{
					id: "meadow",
					type: "grass_01",
					points: [
						[-4, -4],
						[4, -4],
						[4, 4],
						[-4, 4],
					],
				},
			],
		});
		await showView(page, [0, 0], 16);
		await act(page, (s) => s.selectArea("meadow"));
		await page.getByRole("tab", { name: "Shape", exact: true }).click();
		await page.getByRole("button", { name: "Add a peak" }).click();
		const peak = () => read(page, (s) => s.scene.areas[0].peaks[0]);
		expect((await peak())?.slice(0, 2)).toEqual([0, 0]);
		await expect(page.getByText("Peak 1 of 1")).toBeVisible();

		const height = page.getByRole("textbox", { name: "Height", exact: true });
		await height.fill("3");
		await height.press("Enter");
		expect((await peak())?.[2]).toBe(3);
		await height.blur();

		// Its gizmo's green arrow lifts it further.
		await dragBy(page, await gizmoSpot(page, [0, 3, 0], [0, 0.8, 0], 16), 0, -50);
		await expect.poll(async () => (await peak())?.[2] ?? 0).toBeGreaterThan(3);

		await page.mouse.move(100, 500);
		await keys(page, "Delete");
		expect(await read(page, (s) => s.scene.areas[0].peaks.length)).toBe(0);
		expect(await read(page, (s) => s.scene.areas.length)).toBe(1);

		// Without the Shape tab: right-click the area, Add a peak here; or double-click it.
		const spot = await groundSpot(page, [2, 2], 0);
		await page.mouse.click(spot.x, spot.y, { button: "right" });
		await menuItem(page, /^Add a peak here/).click();
		await expect.poll(() => read(page, (s) => s.scene.areas[0].peaks.length)).toBe(1);
		const [x, z] = (await peak()) ?? [0, 0];
		expect(Math.hypot(x - 2, z - 2)).toBeLessThan(0.6);
		const other = await groundSpot(page, [-2, -2], 0);
		await page.mouse.dblclick(other.x, other.y);
		await expect.poll(() => read(page, (s) => s.scene.areas[0].peaks.length)).toBe(2);
	});

	test("a face's marker adds a peak in its middle (ADR-0101)", async ({ page }) => {
		// A triangle has one face, its marker in its middle.
		await loadWorld(page, {
			areas: [
				{
					id: "field",
					type: "grass_01",
					points: [
						[-4, -3],
						[4, -3],
						[0, 3],
					],
				},
			],
		});
		await showView(page, [0, 0], 14);
		await act(page, (s) => s.selectArea("field"));
		const marker = await groundSpot(page, [0, -1], 0.12);
		await page.mouse.click(marker.x, marker.y);
		await expect.poll(() => read(page, (s) => s.scene.areas[0].peaks.length)).toBe(1);
		expect(await read(page, (s) => s.selectedPeakIndex)).toBe(0);
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
