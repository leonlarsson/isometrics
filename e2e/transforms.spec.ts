import type { Page } from "@playwright/test";

import {
	act,
	entity,
	expect,
	keys,
	loadWorld,
	openEditor,
	read,
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
		expect((await entity(page, "a"))?.elevation).toBe(4);
		// Each transform is one undo step.
		await keys(page, "Control+z");
		expect((await entity(page, "a"))?.elevation).toBe(0);
	});

	test("R turns by a typed angle, S resizes by a typed factor", async ({ page }) => {
		await keys(page, "r", "9", "0", "Enter");
		expect((await entity(page, "a"))?.rotation).toBe(90);
		await keys(page, "s", "1", ".", "5", "Enter");
		expect((await entity(page, "a"))?.scale).toBe(3);
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
		expect((await entity(page, "a"))?.rotation).toBe(15);
		await keys(page, "Shift+e");
		expect((await entity(page, "a"))?.rotation).toBe(285);
	});

	test("a locked object stays put", async ({ page }) => {
		await act(page, (s) => s.setItemFlag({ kind: "entity", id: "a" }, "locked", true));
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
		expect((await entity(page, "a"))?.rotation).toBe(180);

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
