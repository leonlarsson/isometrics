import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

import { expect, fileMenu, openEditor, openPage, read, reopened, saved, test } from "./editor";

/** How many worlds this browser keeps. */
const storedWorlds = (page: Page) =>
	page.evaluate(
		() => Object.keys(localStorage).filter((key) => key.startsWith("isometrics:world:")).length,
	);

test.describe("worlds in this browser (ADR-0044, ADR-0047)", () => {
	test("New world → Blank makes an empty world, and the starter is still there", async ({
		page,
	}) => {
		await openEditor(page);
		await page.getByLabel("Title").first().fill("Starter town");
		await saved(page);
		await fileMenu(page, /New world/);
		const dialog = page.getByRole("dialog", { name: "New world" });
		await dialog.getByRole("radio", { name: /^Blank/ }).click();
		await dialog.getByLabel("Name").fill("Empty plain");
		await dialog.getByRole("button", { name: "Create" }).click();
		await expect(dialog).toBeHidden();
		expect(await read(page, (s) => s.scene.entities.length)).toBe(0);
		expect(await read(page, (s) => s.scene.meta.title)).toBe("Empty plain");
		await saved(page);
		expect(await storedWorlds(page)).toBe(2);

		// Back to the first one through File → Recent worlds.
		await page.getByRole("button", { name: "File" }).click();
		await page.getByRole("menuitem", { name: "Recent worlds" }).click();
		await page.getByRole("menuitem", { name: "Starter town" }).click();
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("Starter town");
		expect(await read(page, (s) => s.scene.entities.length)).toBeGreaterThan(20);
	});

	test("New world from another starter opens it", async ({ page }) => {
		await openEditor(page);
		await fileMenu(page, /New world/);
		const dialog = page.getByRole("dialog", { name: "New world" });
		await dialog.getByRole("radio", { name: /Monaco/ }).click();
		await dialog.getByRole("button", { name: "Create" }).click();
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toMatch(/Monaco/);
	});

	test("Duplicate world keeps the original, and Delete world removes the open one", async ({
		page,
	}) => {
		await openEditor(page);
		// The starter is saved once something changes.
		await page.getByLabel("Title").first().fill("Original");
		await saved(page);
		await fileMenu(page, /Duplicate world/);
		await saved(page);
		expect(await storedWorlds(page)).toBe(2);

		await fileMenu(page, /Delete world/);
		await page.getByRole("button", { name: "Delete", exact: true }).click();
		await expect.poll(() => storedWorlds(page)).toBe(1);

		// Deleting the last one leaves no world open: the home screen (ADR-0121), on reload too.
		await fileMenu(page, /Delete world/);
		await page.getByRole("button", { name: "Delete", exact: true }).click();
		const home = page.getByRole("main", { name: "Home" });
		await expect(home).toContainText("None in this browser yet.");
		expect(await storedWorlds(page)).toBe(0);
		await openPage(page, "/");
		await expect(home).toContainText("None in this browser yet.");
	});

	test("the home screen on start, when Preferences say so, opens a world from the list", async ({
		page,
	}) => {
		await openEditor(page);
		await page.getByLabel("Title").first().fill("Mine");
		await saved(page);
		await page.evaluate(() =>
			localStorage.setItem("isometrics:preferences", JSON.stringify({ startWith: "home" })),
		);
		await openPage(page, "/");
		const home = page.getByRole("main", { name: "Home" });
		await expect(page.locator("canvas")).toHaveCount(0);
		await home.getByRole("button", { name: /^Mine/ }).click();
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("Mine");
		await expect(page.locator("canvas")).toHaveCount(1);
	});

	test("All worlds lists them, with a search", async ({ page }) => {
		await openEditor(page);
		// The starter is saved once something changes.
		await page.getByLabel("Title").first().fill("Original");
		await saved(page);
		await fileMenu(page, /Duplicate world/);
		await saved(page);
		await page.getByRole("button", { name: "File" }).click();
		await page.getByRole("menuitem", { name: "Recent worlds" }).click();
		await page.getByRole("menuitem", { name: /All worlds/ }).click();
		const dialog = page.getByRole("dialog", { name: "All worlds" });
		await expect(dialog.getByRole("button", { name: "Duplicate" })).toHaveCount(2);
		await dialog.getByLabel("Search").fill("no such world");
		await expect(dialog.getByRole("button", { name: "Duplicate" })).toHaveCount(0);
	});
});

test.describe("files (ADR-0006)", () => {
	test("Save to file downloads the world as JSON", async ({ page }) => {
		await openEditor(page);
		await page.getByLabel("Title").first().fill("Downloaded");
		const download = page.waitForEvent("download");
		await fileMenu(page, /Save to file/);
		const file = await (await download).path();
		const world = JSON.parse(readFileSync(file, "utf8"));
		expect(world.meta.title).toBe("Downloaded");
		expect(world.entities.length).toBeGreaterThan(20);
	});

	test("Open file opens a world from a JSON file, repairing what it must", async ({ page }) => {
		await openEditor(page);
		const chooser = page.waitForEvent("filechooser");
		await fileMenu(page, /Open file/);
		await (await chooser).setFiles({
			name: "small.json",
			mimeType: "application/json",
			buffer: Buffer.from(
				JSON.stringify({
					version: 1,
					meta: { title: "From a file" },
					entities: [{ id: "h", kind: "house_01", position: [1, 1] }],
				}),
			),
		});
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("From a file");
		expect(await read(page, (s) => s.scene.entities.map((e) => e.id))).toEqual(["h"]);
	});
});

test.describe("starting over (ADR-0045)", () => {
	test("Wipe everything asks twice, then starts over with nothing kept", async ({ page }) => {
		await openEditor(page);
		await page.getByLabel("Title").first().fill("Doomed");
		await saved(page);
		await fileMenu(page, /Wipe everything/);
		await page.getByRole("button", { name: "Continue" }).click();
		const wipe = page.getByRole("button", { name: "Wipe everything" });
		// It waits a few seconds before it can be pressed.
		await expect(wipe).toBeEnabled({ timeout: 6000 });
		await wipe.click();
		await page.waitForURL("/");
		await reopened(page);
		expect(await read(page, (s) => s.scene.meta.title)).not.toBe("Doomed");
	});

	test("Reset this browser’s settings keeps the worlds", async ({ page }) => {
		await openEditor(page);
		await page.getByLabel("Title").first().fill("Kept");
		await saved(page);
		await fileMenu(page, /Reset this browser/);
		await page.getByRole("button", { name: "Reset settings" }).click();
		await reopened(page);
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("Kept");
	});
});
