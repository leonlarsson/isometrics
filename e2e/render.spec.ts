import { choose, expect, fileMenu, loadWorld, openEditor, read, test } from "./editor";

test.describe("Render a picture (ADR-0084)", () => {
	test("pauses motion, renders the view as a PNG, then puts the view back as it was", async ({
		page,
	}) => {
		test.setTimeout(120_000);
		await openEditor(page);
		// A small world (the starter world keeps its title), so the render is quick even in software.
		await loadWorld(page, {
			entities: [
				{ id: "house", kind: "house_01", position: [0, 0] },
				{ id: "tree", kind: "round_tree_01", position: [3, 1] },
			],
		});
		const before = await page.locator("canvas").first().boundingBox();
		await fileMenu(page, /^Render a picture/);
		// Opening it pauses motion, so the moment stays put.
		expect(await read(page, (s) => s.playing)).toBe(false);
		await choose(page, "Size", "The view's size");
		await choose(page, "Smoothing", "Off");
		await page.getByRole("button", { name: "Render", exact: true }).click();
		const save = page.getByRole("button", { name: "Save the picture" });
		await expect(save).toBeVisible({ timeout: 100_000 });
		const [download] = await Promise.all([page.waitForEvent("download"), save.click()]);
		expect(download.suggestedFilename()).toMatch(/^brightwater-\d+x\d+\.png$/);
		// Back to the live view: no render running, the canvas its size again, still in Edit mode.
		expect(await read(page, (s) => [s.stillRender, s.mode])).toEqual([null, "edit"]);
		expect(await page.locator("canvas").first().boundingBox()).toEqual(before);
		// Closing it plays motion again.
		await page.getByRole("button", { name: "Close", exact: true }).click();
		expect(await read(page, (s) => s.playing)).toBe(true);
	});
});
