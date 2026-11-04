import type { Page } from "@playwright/test";

import {
	act,
	expect,
	fileMenu,
	menuItem,
	openEditor,
	read,
	test,
	viewBar,
	viewCentre,
} from "./editor";

test.describe("the side panes (ADR-0055)", () => {
	test("each folds to a strip and opens again; Ctrl+Space hides both", async ({ page }) => {
		await openEditor(page);
		const parts = page.getByRole("navigation", { name: "Parts" });
		await page.getByRole("button", { name: "Hide Add to scene" }).click();
		await expect(parts).toBeHidden();
		await page.getByRole("button", { name: /Show Add to scene/ }).click();
		await expect(parts).toBeVisible();

		// Over the view (by where it is, not waiting for it to hold still: in SwiftShader its frames
		// come unevenly while the panel's part pictures render).
		const { x, y } = await viewCentre(page);
		await page.mouse.move(x, y, { steps: 4 });
		await page.keyboard.press("Control+Space");
		await expect(parts).toBeHidden();
		await expect(page.getByRole("tab", { name: "World" })).toBeHidden();
		await page.keyboard.press("Control+Space");
		await expect(parts).toBeVisible();
	});
});

test.describe("the app row and the view bar (ADR-0142)", () => {
	/** Whether what the view bar holds fits in it, nothing running past its ends. */
	const fits = (page: Page) =>
		viewBar(page).evaluate((bar) => {
			const children = [...bar.children] as HTMLElement[];
			const used = children.reduce((width, child) => width + child.scrollWidth, 0);
			return used <= bar.clientWidth;
		});

	test("the view bar spans the view, under the app row, and folds by its own width", async ({
		page,
	}) => {
		await openEditor(page);
		const bar = viewBar(page);
		// Between the side panels, which reach up to the app row; the save status is in the row above
		// the Edit/View switch, so the two never meet.
		const [barBox, parts, status, edit] = await Promise.all([
			bar.boundingBox(),
			page.getByRole("navigation", { name: "Parts" }).boundingBox(),
			page.getByRole("button", { name: /: more about saving/ }).boundingBox(),
			page.getByRole("button", { name: "Edit", exact: true }).boundingBox(),
		]);
		if (!barBox || !parts || !status || !edit) {
			throw new Error("the bars aren't showing");
		}
		expect(barBox.x).toBeGreaterThanOrEqual(parts.x + parts.width - 1);
		expect(barBox.x + barBox.width).toBeLessThan(1280);
		expect(status.y + status.height).toBeLessThanOrEqual(edit.y);

		// At 1280px the view between the panels has no room for the shading buttons: one menu.
		await expect(bar).toHaveAttribute("data-folded", /shading/);
		expect(await fits(page)).toBe(true);
		await page.getByRole("button", { name: "Shading", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Clay" }).click();
		expect(await read(page, (s) => s.mode)).toBe("edit");
		await expect(page.getByRole("button", { name: "Shading", exact: true })).toBeVisible();

		// The panels hidden, the bar takes the window's width and everything shows.
		await page.getByRole("button", { name: "Hide the side panels (Ctrl+Space)" }).click();
		await expect(bar).toHaveAttribute("data-folded", "");
		await expect(page.getByRole("button", { name: /^Clay:/ })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(await fits(page)).toBe(true);

		// A narrow window with the panels shown: the tools go into More, and it still fits.
		await page.getByRole("button", { name: "Show the side panels (Ctrl+Space)" }).click();
		await page.setViewportSize({ width: 960, height: 800 });
		await expect(bar).toHaveAttribute("data-folded", /tools/);
		expect(await fits(page)).toBe(true);
		await page.getByRole("button", { name: "More", exact: true }).click();
		await menuItem(page, "Snap to grid").click();
		expect(await read(page, (s) => s.snapping)).toBe(false);
	});

	test("the bars over the view sit under the view bar", async ({ page }) => {
		await openEditor(page);
		await page.getByRole("button", { name: "Select with a box (B)" }).click();
		const notice = page.getByRole("status").filter({ hasText: "Select with a box" });
		const [barBox, noticeBox] = await Promise.all([
			viewBar(page).boundingBox(),
			notice.boundingBox(),
		]);
		if (!barBox || !noticeBox) {
			throw new Error("the bars aren't showing");
		}
		expect(noticeBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
	});

	test("the home screen has only the app row", async ({ page }) => {
		await openEditor(page);
		await act(page, (s) => s.setWhatIsOpen({ kind: "home", why: { kind: "chosen" } }));
		await expect(page.getByRole("main", { name: "Home" })).toBeVisible();
		await expect(viewBar(page)).toHaveCount(0);
		await expect(page.getByRole("button", { name: "File" })).toBeVisible();
		await expect(page.getByRole("button", { name: /^Preferences/ })).toBeVisible();
		await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
	});
});

test.describe("phones (ADR-0030, ADR-0046)", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test("the panels live in a bottom sheet; selecting leaves it folded, its tabs open it", async ({
		page,
	}) => {
		await openEditor(page);
		const sheet = page.locator("[data-sheet]");
		await expect(page.getByRole("tab", { name: "Add to scene" })).toBeVisible();
		await page.getByRole("tab", { name: "Outliner" }).click();
		await expect(page.getByRole("searchbox", { name: "Search the world" })).toBeVisible();
		await expect(sheet).toHaveAttribute("data-sheet", "open");

		// Cleared, the selection folds it; selected again, it stays folded, the object's tabs in its bar.
		await act(page, (s) => s.select(s.scene.entities[0].id));
		await act(page, (s) => s.select(null));
		await expect(sheet).toHaveAttribute("data-sheet", "closed");
		await act(page, (s) => s.select(s.scene.entities[0].id));
		const objectTab = page.getByRole("tab", { name: "Object" });
		await expect(objectTab).toBeVisible();
		await expect(sheet).toHaveAttribute("data-sheet", "closed");
		await objectTab.click();
		await expect(sheet).toHaveAttribute("data-sheet", "open");
	});

	test("the sheet's panels scroll when they're taller than it", async ({ page }) => {
		await openEditor(page);
		// The World tab's panels are taller than the sheet.
		await act(page, (s) => s.setTab("world"));
		await page.getByRole("button", { name: "Show panel" }).click();
		const scroller = page.locator("[data-inspector-scroll]");
		await expect(scroller).toBeVisible();
		const sizes = await scroller.evaluate((element) => ({
			client: element.clientHeight,
			scroll: element.scrollHeight,
			sheet: element.closest("[data-sheet]")?.getBoundingClientRect().height ?? 0,
		}));
		// Its scrolling area fits in the sheet, and holds more than it shows.
		expect(sizes.client).toBeLessThanOrEqual(sizes.sheet);
		expect(sizes.scroll).toBeGreaterThan(sizes.client);
		// Scrolling over it scrolls it.
		const box = await scroller.boundingBox();
		if (!box) {
			throw new Error("no scrolling area");
		}
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.wheel(0, 300);
		await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	});

	test("one row for the app row and the view bar; More holds what doesn't fit", async ({
		page,
	}) => {
		await openEditor(page);
		// The view bar is in the app row (ADR-0142), after File and the save status.
		await expect(page.getByRole("banner").locator("[data-view-bar]")).toHaveCount(1);
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
			await fileMenu(page, /^Render a picture/);
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
