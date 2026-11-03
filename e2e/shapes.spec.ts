import { act, expect, loadWorld, openEditor, showView, test } from "./editor";

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
});
