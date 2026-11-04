import {
	act,
	dragBy,
	entity,
	expect,
	gizmoSpot,
	loadWorld,
	openEditor,
	paletteTile,
	read,
	screenOf,
	showView,
	test,
} from "./editor";

test.describe("shapes", () => {
	test("a shape made see-through and solid again looks as it did", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, { entities: [{ id: "box", kind: "box_01", position: [0, 0] }] });
		await showView(page, [0, 0], 8);
		const setTransparency = async (transparency: number) => {
			await act(
				page,
				(s, transparency) =>
					s.commit((scene) => {
						scene.entities[0].colors = { surface: { color: null, transparency, data: {} } };
					}),
				transparency,
			);
			await page.waitForTimeout(1000);
		};
		// The view only, from below the world's title.
		const view = () => page.screenshot({ clip: { x: 300, y: 250, width: 560, height: 500 } });

		const solid = await view();
		await setTransparency(1);
		expect((await view()).equals(solid)).toBe(false);
		await setTransparency(0);
		expect((await view()).equals(solid)).toBe(true);
	});

	test("a side's handle drags that side out, the opposite one staying; the top's grows it up", async ({
		page,
	}) => {
		await openEditor(page);
		await loadWorld(page, {
			entities: [
				{ id: "box", kind: "box_01", position: [0, 0], props: { width: 4, depth: 4, height: 2 } },
			],
		});
		const span = 14;
		await showView(page, [0, 0], span);
		await act(page, (s) => s.select("box"));

		// The +X side's handle, dragged a unit further out along X on screen (and a little more, for
		// the few pixels a drag takes to start).
		const handle = await gizmoSpot(page, [2, 1, 0], [0.3, 0, 0], span);
		const [from, to] = [await screenOf(page, [2, 1, 0]), await screenOf(page, [3.1, 1, 0])];
		await dragBy(page, handle, to.x - from.x, to.y - from.y);
		const widened = await entity(page, "box");
		expect(widened?.props.width).toBe(5);
		// Its −X side stayed where it was.
		expect((widened?.position[0] ?? 0) - 5 / 2).toBeCloseTo(-2);
		expect(widened?.props.depth).toBe(4);

		// The top's handle, dragged up a unit: taller, standing where it stood.
		const top = await gizmoSpot(page, [0.5, 2, 0], [0, 0.3, 0], span);
		const [low, high] = [await screenOf(page, [0.5, 2, 0]), await screenOf(page, [0.5, 3.1, 0])];
		await dragBy(page, top, high.x - low.x, high.y - low.y);
		const raised = await entity(page, "box");
		expect(raised?.props.height).toBe(3);
		expect(raised?.altitude).toBe(0);

		// Undone in one step each.
		await act(page, (s) => s.undo());
		expect((await entity(page, "box"))?.props.height).toBe(2);
	});

	test("a shape dropped or dragged onto another lands on its top (ADR-0138)", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {
			entities: [
				{ id: "base", kind: "box_01", position: [0, 0], props: { width: 3, depth: 3 } },
				{ id: "box", kind: "box_01", position: [5, 0] },
			],
		});
		await showView(page, [2, 0], 14);

		// Dropped from Add to scene onto the base's top, under the pointer.
		const tile = await paletteTile(page, "Shapes", "Box");
		await tile.scrollIntoViewIfNeeded();
		const from = await tile.boundingBox();
		if (!from) {
			throw new Error("no tile");
		}
		const onBase = await screenOf(page, [-1, 1, 1]);
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(onBase.x, onBase.y, { steps: 12 });
		await page.mouse.up();
		const dropped = await read(page, (s) => s.scene.entities.at(-1));
		expect(dropped?.kind).toBe("box_01");
		expect(dropped?.position.map(Math.round)).toEqual([-1, 1]);
		expect(dropped?.altitude).toBe(1);

		// The other box, dragged by its top onto the base's: on top, and off again onto the ground.
		await act(page, (s) => s.select("box"));
		const grab = await screenOf(page, [5, 1, 0]);
		const there = await screenOf(page, [1, 1, 0]);
		await dragBy(page, grab, there.x - grab.x, there.y - grab.y);
		const stacked = await entity(page, "box");
		expect(Math.abs((stacked?.position[0] ?? 9) - 1)).toBeLessThanOrEqual(0.5);
		expect(stacked?.altitude).toBe(1);
		const back = await screenOf(page, [5, 0, 0]);
		const now = await screenOf(page, [stacked?.position[0] ?? 1, 2, stacked?.position[1] ?? 0]);
		await dragBy(page, now, back.x - now.x, back.y - now.y);
		expect((await entity(page, "box"))?.altitude).toBe(0);
	});

	test("a building sized by its props has the handles too: its side's drags its width", async ({
		page,
	}) => {
		await openEditor(page);
		await loadWorld(page, {
			entities: [
				{
					id: "warehouse",
					kind: "warehouse_01",
					position: [0, 0],
					props: { width: 6, depth: 4, height: 2 },
				},
			],
		});
		const span = 16;
		await showView(page, [0, 0], span);
		await act(page, (s) => s.select("warehouse"));

		// Its +X side's handle, halfway up it (walls and roof, 2.4 high), dragged a unit further out.
		const handle = await gizmoSpot(page, [3, 1.2, 0], [0.3, 0, 0], span);
		const [from, to] = [await screenOf(page, [3, 1.2, 0]), await screenOf(page, [4.1, 1.2, 0])];
		await dragBy(page, handle, to.x - from.x, to.y - from.y);
		const widened = await entity(page, "warehouse");
		expect(widened?.props.width).toBe(7);
		// Its −X side stayed where it was.
		expect((widened?.position[0] ?? 0) - 7 / 2).toBeCloseTo(-3);
		expect(widened?.props.depth).toBe(4);
	});
});
