import { expect, groundSpot, keys, loadWorld, openEditor, read, showView, test } from "./editor";

const PAINTED = new Set(["pine_tree_01", "round_tree_01", "birch_01", "round_tree_02"]);

test.describe("painting objects (ADR-0091)", () => {
	test("a stroke paints a wood off the road, is one undo step, and the eraser takes it away", async ({
		page,
	}) => {
		await openEditor(page);
		await loadWorld(page, {
			entities: [{ id: "house", kind: "house_01", position: [6, -6] }],
			roads: [
				{
					id: "road",
					points: [
						[-12, 0, 0],
						[12, 0, 0],
					],
				},
			],
		});
		await showView(page, [0, 0], 30);

		// N opens the paint bar, on the Mixed wood brush.
		await page.locator("canvas").hover();
		await keys(page, "n");
		const bar = page.getByRole("toolbar", { name: "Paint" });
		await expect(bar).toBeVisible();
		await expect(bar.getByRole("combobox", { name: "Brush" })).toHaveValue("Mixed wood");

		// A stroke across the road.
		const from = await groundSpot(page, [-6, -3]);
		const to = await groundSpot(page, [-6, 3]);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move(to.x, to.y, { steps: 12 });
		await page.mouse.up();

		const painted = await read(page, (s) =>
			s.scene.entities
				.filter((e) => e.id !== "house")
				.map((e) => ({ kind: e.kind, at: e.position })),
		);
		expect(painted.length).toBeGreaterThan(3);
		for (const { kind, at } of painted) {
			expect(PAINTED.has(kind)).toBe(true);
			// Off the road (2.4 wide along z = 0).
			expect(Math.abs(at[1])).toBeGreaterThan(1.2);
		}
		// One undo step takes the whole stroke away, and redo brings it back.
		await page.keyboard.press("Control+z");
		expect(await read(page, (s) => s.scene.entities.length)).toBe(1);
		await page.keyboard.press("Control+Shift+z");
		expect(await read(page, (s) => s.scene.entities.length)).toBe(painted.length + 1);

		// The eraser takes away what the brush paints, never the house.
		await bar.getByRole("button", { name: "Erase" }).click();
		const wide = await groundSpot(page, [-6, 0]);
		await page.mouse.move(wide.x, wide.y - 80);
		await page.mouse.down();
		await page.mouse.move(wide.x, wide.y + 80, { steps: 12 });
		await page.mouse.up();
		await expect
			.poll(() => read(page, (s) => s.scene.entities.length))
			.toBeLessThan(painted.length + 1);
		expect(await read(page, (s) => s.scene.entities.some((e) => e.id === "house"))).toBe(true);

		// The brush box searches every part and mix: type, pick, paint.
		await bar.getByRole("button", { name: "Paint", exact: true }).click();
		const box = bar.getByRole("combobox", { name: "Brush" });
		await box.click();
		await box.fill("birch");
		await page.getByRole("option", { name: "Birch" }).click();
		await expect(box).toHaveValue("Birch");
		const before = await read(page, (s) => s.scene.entities.length);
		const spot = await groundSpot(page, [6, 6]);
		await page.mouse.move(spot.x, spot.y);
		await page.mouse.down();
		await page.mouse.move(spot.x + 40, spot.y, { steps: 6 });
		await page.mouse.up();
		const birches = (await read(page, (s) => s.scene.entities.map((e) => e.kind))).slice(before);
		expect(birches.length).toBeGreaterThan(0);
		expect(new Set(birches)).toEqual(new Set(["birch_01"]));

		// Esc puts the brush away, and what's left of the painting is selected, the house not.
		const left = await read(page, (s) => s.scene.entities.length - 1);
		await page.keyboard.press("Escape");
		await expect(bar).toBeHidden();
		expect(await read(page, (s) => s.selectedItems.length)).toBe(left);
		expect(await read(page, (s) => s.selectedItems.some((item) => item.id === "house"))).toBe(
			false,
		);
	});
});
