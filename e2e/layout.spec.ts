import { act, expect, menuItem, openEditor, read, test } from "./editor";

test.describe("the side panes (ADR-0055)", () => {
	test("each folds to a strip and opens again; Ctrl+Space hides both", async ({ page }) => {
		await openEditor(page);
		const parts = page.getByRole("navigation", { name: "Parts" });
		await page.getByRole("button", { name: "Hide Add to scene" }).click();
		await expect(parts).toBeHidden();
		await page.getByRole("button", { name: /Show Add to scene/ }).click();
		await expect(parts).toBeVisible();

		await page.locator("canvas").hover();
		await page.keyboard.press("Control+Space");
		await expect(parts).toBeHidden();
		await expect(page.getByRole("tab", { name: "World" })).toBeHidden();
		await page.keyboard.press("Control+Space");
		await expect(parts).toBeVisible();
	});
});

test.describe("phones (ADR-0030, ADR-0046)", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test("the panels live in a bottom sheet; selecting opens it", async ({ page }) => {
		await openEditor(page);
		await expect(page.getByRole("tab", { name: "Add to scene" })).toBeVisible();
		await page.getByRole("tab", { name: "Outliner" }).click();
		await expect(page.getByRole("searchbox", { name: "Search the world" })).toBeVisible();
		await act(page, (s) => s.select(s.scene.entities[0].id));
		await expect(page.getByRole("tab", { name: "Object" })).toBeVisible();
	});

	test("the toolbar's More menu holds what doesn't fit", async ({ page }) => {
		await openEditor(page);
		await page.getByRole("button", { name: "More", exact: true }).click();
		await menuItem(page, "Perspective").click();
		expect(await read(page, (s) => s.projection)).toBe("perspective");
	});
});

test.describe("dialogs", () => {
	test("move by their title bar, stay inside the window and open in the centre again", async ({
		page,
	}) => {
		await openEditor(page);
		const dialog = page.getByRole("dialog", { name: "Render a picture" });
		// Where its middle is: its content can still change its height, which keeps the middle put.
		const middle = async () => {
			const box = await dialog.boundingBox();
			if (!box) {
				throw new Error("the dialog isn't showing");
			}
			return { x: box.x + box.width / 2, y: box.y + box.height / 2, left: box.x };
		};
		const openDialog = async () => {
			await page.getByRole("button", { name: "Render a picture…" }).click();
			// Measured once it has finished growing in.
			await dialog.evaluate((element) =>
				Promise.all(element.getAnimations().map((animation) => animation.finished)),
			);
		};
		await openDialog();
		const centred = await middle();
		const title = await dialog.getByRole("heading", { name: "Render a picture" }).boundingBox();
		if (!title) {
			throw new Error("the dialog has no title");
		}
		// A small step down: the dialog is almost as tall as the window, which it can't leave.
		const grab = { x: title.x + 10, y: title.y + title.height / 2 };
		await page.mouse.move(grab.x, grab.y);
		await page.mouse.down();
		await page.mouse.move(grab.x - 150, grab.y + 10, { steps: 5 });
		await page.mouse.up();
		const moved = await middle();
		expect(moved.x).toBeCloseTo(centred.x - 150, 0);
		expect(moved.y).toBeCloseTo(centred.y + 10, 0);

		// Dragged far past the window's edge, it stops at it.
		await page.mouse.move(grab.x - 150, grab.y + 10);
		await page.mouse.down();
		await page.mouse.move(-500, grab.y + 10, { steps: 5 });
		await page.mouse.up();
		expect((await middle()).left).toBeCloseTo(8, 0);

		await page.getByRole("button", { name: "Close", exact: true }).click();
		await expect(dialog).toBeHidden();
		await openDialog();
		const reopened = await middle();
		expect([reopened.x, reopened.y]).toEqual([centred.x, centred.y]);
	});
});
