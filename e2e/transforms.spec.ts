import type { Page } from "@playwright/test";

import {
	act,
	dragBy,
	entity,
	expect,
	gizmoSpot,
	keys,
	loadWorld,
	openEditor,
	read,
	screenOf,
	showView,
	test,
	viewCentre,
} from "./editor";

/** Two houses, the first selected, seen up close. */
const twoHouses = async (page: Page) => {
	await loadWorld(page, {
		entities: [
			{ id: "a", kind: "house_01", name: "House A", position: [0, 0], scale: 2 },
			{ id: "b", kind: "house_01", name: "House B", position: [10, 0], scale: 2 },
		],
	});
	await showView(page, [0, 0], 30);
	await act(page, (s) => s.select("a"));
	const { x, y } = await viewCentre(page);
	// Keys go to the editor while the pointer is over the view.
	await page.mouse.move(x, y + 120);
};

test.describe("keyboard transforms (ADR-0029)", () => {
	test.beforeEach(async ({ page }) => {
		await openEditor(page);
		await twoHouses(page);
	});

	test("G, a typed distance and Enter move it along X; Y locks the axis to height", async ({
		page,
	}) => {
		await keys(page, "g");
		await expect(page.getByText(/Moving House A/)).toBeVisible();
		await keys(page, "3", "Enter");
		expect((await entity(page, "a"))?.position).toEqual([3, 0]);

		await keys(page, "g", "z", "-", "2", "Enter");
		expect((await entity(page, "a"))?.position).toEqual([3, -2]);

		await keys(page, "g", "y", "4", "Enter");
		expect((await entity(page, "a"))?.altitude).toBe(4);
		// Each transform is one undo step.
		await keys(page, "Control+z");
		expect((await entity(page, "a"))?.altitude).toBe(0);
	});

	test("R turns by a typed angle, S resizes by a typed factor", async ({ page }) => {
		await keys(page, "r", "9", "0", "Enter");
		expect((await entity(page, "a"))?.rotation[1]).toBe(90);
		await keys(page, "s", "1", ".", "5", "Enter");
		expect((await entity(page, "a"))?.scale).toBe(3);
	});

	test("R then X or Z tips it around its own axes; G Y sinks it below the ground (ADR-0097)", async ({
		page,
	}) => {
		await keys(page, "r", "x");
		await expect(page.getByText(/Turning House A around its X/)).toBeVisible();
		await keys(page, "3", "0", "Enter");
		expect((await entity(page, "a"))?.rotation[0]).toBe(30);
		await keys(page, "r", "z", "-", "4", "5", "Enter");
		expect((await entity(page, "a"))?.rotation[2]).toBeCloseTo(-45, 0);
		await keys(page, "g", "y", "-", "2", "Enter");
		expect((await entity(page, "a"))?.altitude).toBe(-2);

		// The Transform panel shows the three angles, X, Y and Z.
		const x = page.getByRole("textbox", { name: "Rotation (°) X", exact: true });
		await x.fill("0");
		await x.press("Enter");
		expect((await entity(page, "a"))?.rotation[0]).toBe(0);
	});

	test("the blue arc tips it around its Z, with the mouse (ADR-0097)", async ({ page }) => {
		await showView(page, [0, 0], 14);
		// The middle of the blue arc: 47.5° up the gizmo's ring (1.35 units) at the object's side (+X).
		const up = (47.5 * Math.PI) / 180;
		const arc = await gizmoSpot(page, [0, 0, 0], [1.35 * Math.cos(up), 1.35 * Math.sin(up), 0], 14);
		await dragBy(page, arc, -50, -30);
		await expect.poll(async () => (await entity(page, "a"))?.rotation[2] ?? 0).not.toBe(0);
		expect((await entity(page, "a"))?.rotation[0]).toBe(0);
		expect(await read(page, (s) => s.dragging)).toBe(false);
	});

	test("a typed move onto raised land keeps its height: exact moves don't follow the ground (ADR-0098)", async ({
		page,
	}) => {
		await loadWorld(page, {
			entities: [{ id: "a", kind: "house_01", name: "House A", position: [0, 0], scale: 2 }],
			areas: [
				{
					id: "plateau",
					kind: "raised_land_01",
					height: 2,
					points: [
						[4, -4],
						[12, -4],
						[12, 4],
						[4, 4],
					],
				},
			],
		});
		await act(page, (s) => s.select("a"));
		await keys(page, "g", "8", "Enter");
		expect((await entity(page, "a"))?.position).toEqual([8, 0]);
		expect((await entity(page, "a"))?.altitude).toBe(0);
	});

	test("Esc cancels a transform, and nothing changes", async ({ page }) => {
		await keys(page, "g", "5");
		expect((await entity(page, "a"))?.position).toEqual([5, 0]);
		await keys(page, "Escape");
		expect((await entity(page, "a"))?.position).toEqual([0, 0]);
		expect(await read(page, (s) => s.transform)).toBeNull();
	});

	test("the mouse moves it after G, a click places it, on the grid", async ({ page }) => {
		const { x, y } = await viewCentre(page);
		await page.mouse.move(x, y + 120);
		await keys(page, "g");
		await page.mouse.move(x + 150, y + 120, { steps: 6 });
		await page.mouse.click(x + 150, y + 120);
		const [px, pz] = (await entity(page, "a"))?.position ?? [0, 0];
		expect(px).not.toBe(0);
		expect(px * 2).toBe(Math.round(px * 2));
		expect(pz * 2).toBe(Math.round(pz * 2));
	});

	test("arrow keys nudge by a grid step (Shift: five, Alt: a little); Q and E turn by 15°", async ({
		page,
	}) => {
		await keys(page, "ArrowRight");
		expect((await entity(page, "a"))?.position).toEqual([0.5, 0]);
		await keys(page, "Shift+ArrowDown");
		expect((await entity(page, "a"))?.position).toEqual([0.5, 2.5]);
		await keys(page, "Alt+ArrowLeft");
		expect((await entity(page, "a"))?.position).toEqual([0.4, 2.5]);
		await keys(page, "q");
		expect((await entity(page, "a"))?.rotation[1]).toBe(15);
		await keys(page, "Shift+e");
		expect((await entity(page, "a"))?.rotation[1]).toBe(285);
	});

	test("a locked object stays put", async ({ page }) => {
		await act(page, (s) => s.setItemFlag({ kind: "entity", id: "a" }, "isLocked", true));
		await keys(page, "ArrowRight", "g", "3", "Enter");
		expect((await entity(page, "a"))?.position).toEqual([0, 0]);
	});
});

test.describe("several at once (ADR-0064)", () => {
	test("G, R and the arrows move a group around its middle, in one step each", async ({ page }) => {
		await openEditor(page);
		await twoHouses(page);
		await act(page, (s) =>
			s.selectItems([
				{ kind: "entity", id: "a" },
				{ kind: "entity", id: "b" },
			]),
		);
		await keys(page, "g", "2", "Enter");
		expect((await entity(page, "a"))?.position).toEqual([2, 0]);
		expect((await entity(page, "b"))?.position).toEqual([12, 0]);

		// Turning 180° around their middle (x 7) swaps their places.
		await keys(page, "r", "1", "8", "0", "Enter");
		expect((await entity(page, "a"))?.position.map(Math.round)).toEqual([12, 0]);
		expect((await entity(page, "b"))?.position.map(Math.round)).toEqual([2, 0]);
		expect((await entity(page, "a"))?.rotation[1]).toBe(180);

		await keys(page, "ArrowUp");
		expect((await entity(page, "b"))?.position.map((v) => Math.round(v * 2) / 2)).toEqual([
			2, -0.5,
		]);
		const steps = await read(page, (s) => s.past.length);
		await keys(page, "Control+z", "Control+z", "Control+z");
		expect((await entity(page, "a"))?.position).toEqual([0, 0]);
		expect(steps).toBe(3);
	});
});

test.describe("duplicating (ADR-0067, ADR-0068)", () => {
	test.beforeEach(async ({ page }) => {
		await openEditor(page);
		await twoHouses(page);
	});

	test("Ctrl+D copies a step over, named “… copy”", async ({ page }) => {
		await keys(page, "Control+d");
		const copy = await read(page, (s) => s.scene.entities.at(-1));
		expect(copy?.position).toEqual([1, 1]);
		expect(copy?.name).toBe("House A copy");
		expect(await read(page, (s) => s.selectedId)).toBe(copy?.id);
	});

	test("Shift+D picks a copy up to move; Esc takes it away again", async ({ page }) => {
		await keys(page, "Shift+D");
		expect(await read(page, (s) => s.scene.entities.length)).toBe(3);
		expect(await read(page, (s) => s.transform?.mode)).toBe("grab");
		await keys(page, "Escape");
		expect(await read(page, (s) => s.scene.entities.length)).toBe(2);
		expect(await read(page, (s) => s.selectedId)).toBe("a");

		await keys(page, "Shift+D", "4", "Enter");
		expect(await read(page, (s) => s.scene.entities.at(-1)?.position)).toEqual([4, 0]);
		expect((await entity(page, "a"))?.position).toEqual([0, 0]);
	});

	test("Ctrl+drag on a selected object leaves the original and drags a copy", async ({ page }) => {
		const { x, y } = await viewCentre(page);
		// The left of the house's roof, clear of its gizmo (whose up arrow is in the middle).
		const roof = { x: x - 50, y: y - 60 };
		await page.keyboard.down("Control");
		await page.mouse.move(roof.x, roof.y);
		await page.mouse.down();
		await page.mouse.move(roof.x - 120, roof.y, { steps: 8 });
		await page.mouse.up();
		await page.keyboard.up("Control");
		expect(await read(page, (s) => s.scene.entities.length)).toBe(3);
		expect((await entity(page, "a"))?.position).toEqual([0, 0]);
		expect(await read(page, (s) => s.scene.entities.at(-1)?.position)).not.toEqual([0, 0]);
		expect(await read(page, (s) => s.past.length)).toBe(1);
	});
});

test.describe("snapping", () => {
	test("the toolbar turns snapping off; moves then land anywhere", async ({ page }) => {
		await openEditor(page);
		await twoHouses(page);
		await page.getByRole("button", { name: "Snap to grid: on" }).click();
		expect(await read(page, (s) => s.snapping)).toBe(false);
		const { x, y } = await viewCentre(page);
		await page.mouse.move(x, y + 120);
		await keys(page, "g");
		await page.mouse.move(x + 137, y + 133, { steps: 6 });
		await page.mouse.click(x + 137, y + 133);
		const [px] = (await entity(page, "a"))?.position ?? [0];
		expect(px * 2).not.toBe(Math.round(px * 2));
	});
});

test.describe("on raised land (ADR-0098)", () => {
	test("dragged onto a plateau, it stays under the pointer and stands on top", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {
			entities: [{ id: "a", kind: "house_01", name: "House A", position: [0, 0], scale: 2 }],
			areas: [
				{
					id: "plateau",
					kind: "raised_land_01",
					height: 2,
					points: [
						[3, -10],
						[16, -10],
						[16, 10],
						[3, 10],
					],
				},
			],
		});
		await showView(page, [4, 0], 30);
		await act(page, (s) => s.select("a"));
		// Grab the roof, clear of the gizmo, and move the pointer as far as 9 along and 2 up on screen:
		// the ground it points at is then the plateau's top, 9 further on.
		const house = await screenOf(page, [0, 0, 0]);
		const roof = { x: house.x - 50, y: house.y - 60 };
		const there = await screenOf(page, [9, 2, 0]);
		await page.mouse.move(roof.x, roof.y);
		await page.mouse.down();
		await page.mouse.move(roof.x + (there.x - house.x), roof.y + (there.y - house.y), {
			steps: 12,
		});
		await page.mouse.up();
		// Within a grid step (a drag measures from where it passed the threshold, a few pixels in); on a
		// flat plane at the ground it would land some 2 units short.
		const [px, pz] = (await entity(page, "a"))?.position ?? [0, 0];
		expect(Math.abs(px - 9)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(pz)).toBeLessThanOrEqual(0.5);
		expect((await entity(page, "a"))?.altitude).toBe(2);
	});
});
