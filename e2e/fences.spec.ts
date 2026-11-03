import type { Page } from "@playwright/test";

import {
	choose,
	clickWith,
	dragBy,
	expect,
	groundSpot,
	keys,
	loadWorld,
	menuItem,
	openEditor,
	openPanel,
	outlinerRow,
	paletteTile,
	read,
	screenOf,
	showView,
	test,
	viewCentre,
} from "./editor";

const fence = (page: Page) => read(page, (s) => s.scene.fences[0]);

/** A picket fence along z = 2, from x = −4 to 4 through 0. */
const PICKETS = {
	id: "pickets",
	kind: "picket_fence_01" as const,
	points: [
		[-4, 2, 0],
		[0, 2, 0],
		[4, 2, 0],
	] as [number, number, number][],
};

test.beforeEach(async ({ page }) => {
	await openEditor(page);
	await loadWorld(page, {});
	await showView(page, [0, 0], 30);
});

test.describe("fences (ADR-0103)", () => {
	test("drawn from Add to scene: click points, Enter finishes, it's listed and selected", async ({
		page,
	}) => {
		const { x, y } = await viewCentre(page);
		await (await paletteTile(page, "Fences", "Hedge")).click();
		for (const dx of [-150, 0, 150]) {
			await page.mouse.click(x + dx, y + 60);
		}
		await keys(page, "Enter");
		const drawn = await fence(page);
		expect(drawn?.kind).toBe("hedge_01");
		expect(drawn?.points).toHaveLength(3);
		expect(await read(page, (s) => s.selectedFenceId)).toBe(drawn?.id);
		await expect(outlinerRow(page, "Hedge 1")).toBeVisible();
		await expect(page.getByRole("tab", { name: "Look" })).toBeVisible();
	});

	test("Shift+F starts drawing one, Esc gives up", async ({ page }) => {
		const { x, y } = await viewCentre(page);
		await page.mouse.move(x, y, { steps: 2 });
		await keys(page, "Shift+F");
		expect(await read(page, (s) => s.drawing?.target)).toBe("fence");
		await keys(page, "Escape");
		expect(await read(page, (s) => s.drawing)).toBeNull();
	});

	test("clicking it selects it; its points drag, and double-clicking one removes it", async ({
		page,
	}) => {
		await loadWorld(page, { fences: [PICKETS] });
		await showView(page, [0, 2], 20);
		// Between two posts, halfway up: the band that takes clicks is there, not only the pickets.
		const middle = await screenOf(page, [-2, 0.2, 2]);
		await page.mouse.click(middle.x, middle.y);
		expect(await read(page, (s) => s.selectedFenceId)).toBe("pickets");

		// The handles sit on the fence's top (0.42 for pickets).
		const end = await groundSpot(page, [4, 2], 0.54);
		await dragBy(page, end, 0, 60);
		const moved = (await fence(page))?.points[2];
		expect(moved?.[1]).toBeGreaterThan(2);
		expect(await read(page, (s) => s.selectedPointIndex)).toBe(2);

		const first = await groundSpot(page, [-4, 2], 0.54);
		await page.mouse.dblclick(first.x, first.y);
		expect((await fence(page))?.points).toHaveLength(2);
	});

	test("its style, height, and how much is built are set in the properties", async ({ page }) => {
		await loadWorld(page, { fences: [PICKETS] });
		await page.evaluate(() => globalThis.__editorStore.getState().selectFence("pickets"));
		await choose(page, "Kind", "Stone wall");
		expect((await fence(page))?.kind).toBe("stone_wall_01");

		await page.getByRole("tab", { name: "Shape" }).click();
		await page.getByRole("textbox", { name: "Height", exact: true }).fill("0.8");
		await page.getByRole("textbox", { name: "Height", exact: true }).press("Enter");
		expect((await fence(page))?.height).toBe(0.8);
		await page.getByRole("textbox", { name: "Built", exact: true }).fill("40");
		await page.getByRole("textbox", { name: "Built", exact: true }).press("Enter");
		expect((await fence(page))?.builtShare).toBeCloseTo(0.4);
	});

	test("moves with the rest of a selection, and copies, deletes and undoes like roads", async ({
		page,
	}) => {
		await loadWorld(page, {
			fences: [PICKETS],
			entities: [{ id: "tree", kind: "round_tree_01", position: [0, -3] }],
		});
		await showView(page, [0, 0], 24);
		await page.evaluate(() =>
			globalThis.__editorStore.getState().selectItems([
				{ kind: "fence", id: "pickets" },
				{ kind: "entity", id: "tree" },
			]),
		);
		const { x, y } = await viewCentre(page);
		await page.mouse.move(x, y + 200, { steps: 2 });
		await keys(page, "ArrowRight");
		expect((await fence(page))?.points[0][0]).toBe(-3.5);

		await keys(page, "Control+d");
		expect(await read(page, (s) => s.scene.fences.length)).toBe(2);
		await keys(page, "Delete");
		expect(await read(page, (s) => s.scene.fences.length)).toBe(1);
		await keys(page, "Control+z");
		expect(await read(page, (s) => s.scene.fences.length)).toBe(2);

		// One fence's points, boxed: B, then a drag over two of them.
		await page.evaluate(() => globalThis.__editorStore.getState().selectFencePoint("pickets", 0));
		const a = await groundSpot(page, [-3.5, 2]);
		const b = await groundSpot(page, [0.5, 2], 0.54);
		await keys(page, "b");
		await page.mouse.move(a.x - 30, a.y - 30, { steps: 2 });
		await page.mouse.down();
		await page.mouse.move(b.x + 30, b.y + 30, { steps: 8 });
		await page.mouse.up();
		expect(await read(page, (s) => s.selectedPointIndices)).toEqual([0, 1]);
		await clickWith(page, ["Shift"], b.x, b.y);
		expect(await read(page, (s) => s.selectedPointIndices)).toEqual([0]);
	});
});

test.describe("gates, joining and the edge (ADR-0133)", () => {
	test("a gate is added in the Gates panel, opened, and turned into a gap", async ({ page }) => {
		await loadWorld(page, { fences: [PICKETS] });
		await page.evaluate(() => globalThis.__editorStore.getState().selectFence("pickets"));
		await page.getByRole("tab", { name: "Shape" }).click();
		await openPanel(page, "Gates");
		await page.getByRole("button", { name: "Add a gate", exact: true }).click();
		expect((await fence(page))?.gates).toMatchObject([
			{ kind: "swinging", spanIndex: 0, alongShare: 0.5, isOpen: false },
		]);
		await page.getByRole("switch", { name: "Open", exact: true }).click();
		expect((await fence(page))?.gates[0].isOpen).toBe(true);
		await choose(page, "On the stretch", "Points 2 to 3");
		expect((await fence(page))?.gates[0].spanIndex).toBe(1);
		await choose(page, "Kind", "Gap");
		expect((await fence(page))?.gates[0].kind).toBe("gap");
		await expect(page.getByText("A gap is always open")).toBeVisible();

		// From a selected point: a second gate on the stretch after it.
		await page.evaluate(() => globalThis.__editorStore.getState().selectFencePoint("pickets", 0));
		await page.getByRole("button", { name: "Add a gate after it", exact: true }).click();
		expect((await fence(page))?.gates.map((gate) => gate.spanIndex)).toEqual([1, 0]);
		await page.getByRole("button", { name: "Remove this gate", exact: true }).first().click();
		expect((await fence(page))?.gates.map((gate) => gate.spanIndex)).toEqual([0]);
	});

	test("dragging a fence's end onto another's offers to join them into one", async ({ page }) => {
		await loadWorld(page, {
			fences: [
				{
					id: "west",
					kind: "picket_fence_01",
					points: [
						[-6, 2, 0],
						[-1, 2, 0],
					],
				},
				{
					id: "east",
					kind: "picket_fence_01",
					points: [
						[1, 2, 0],
						[6, 2, 0],
					],
					gates: [{ spanIndex: 0, alongShare: 0.5 }],
				},
			],
		});
		await showView(page, [0, 2], 20);
		await page.evaluate(() => globalThis.__editorStore.getState().selectFence("west"));
		// The handles sit on the fence's top (0.42 for pickets), and drag at that height.
		const end = await groundSpot(page, [-1, 2], 0.54);
		const onto = await groundSpot(page, [0.8, 2], 0.42);
		await dragBy(page, end, onto.x - end.x, onto.y - end.y);
		expect((await fence(page))?.points[1]).toEqual([1, 2, 0]);
		await expect(page.getByText("These fence ends touch")).toBeVisible();
		await page.getByRole("button", { name: "Join", exact: true }).click();
		const fences = await read(page, (s) => s.scene.fences);
		expect(fences).toHaveLength(1);
		expect(fences[0].id).toBe("west");
		expect(fences[0].points).toEqual([
			[-6, 2, 0],
			[1, 2, 0],
			[6, 2, 0],
		]);
		expect(fences[0].gates).toMatchObject([{ spanIndex: 1, alongShare: 0.5 }]);
		await expect(page.getByText("These fence ends touch")).toBeHidden();
	});

	test("Fence along the edge puts a fence round an area, on its top", async ({ page }) => {
		await loadWorld(page, {
			areas: [
				{
					id: "plateau",
					kind: "raised_land_01",
					height: 1,
					points: [
						[-4, -3],
						[4, -3],
						[4, 3],
						[-4, 3],
					],
				},
			],
		});
		await page.evaluate(() => globalThis.__editorStore.getState().selectArea("plateau"));
		await page.getByRole("button", { name: "Fence along the edge" }).click();
		await menuItem(page, /^Hedge/).click();
		const made = await fence(page);
		expect(made).toMatchObject({ kind: "hedge_01", loops: true });
		expect(made?.points).toHaveLength(4);
		expect(made?.points.every(([x, z]) => Math.abs(x) < 4 && Math.abs(z) < 3)).toBe(true);
		expect(await read(page, (s) => s.selectedFenceId)).toBe(made?.id);
		await expect(outlinerRow(page, "Hedge 1")).toBeVisible();
	});
});
