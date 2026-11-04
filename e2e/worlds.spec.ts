import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

import {
	appMenu,
	expect,
	fileMenu,
	openEditor,
	openPage,
	read,
	reopened,
	saved,
	test,
} from "./editor";

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

	test("New world: a starter comes as made (Shape Castle without data), and its link copies", async ({
		page,
		context,
	}) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"], {
			origin: "http://localhost:3000",
		});
		await openEditor(page);
		await fileMenu(page, /New world/);
		const dialog = page.getByRole("dialog", { name: "New world" });
		await dialog.getByRole("radio", { name: /Shape Castle/ }).click();
		// Uses data follows the starter: Shape Castle is made without.
		await expect(dialog.getByRole("switch", { name: "Uses data" })).not.toBeChecked();
		await dialog.getByRole("button", { name: "Copy the link" }).click();
		await expect
			.poll(() => page.evaluate(() => navigator.clipboard.readText()))
			.toBe("http://localhost:3000/templates/shape-castle");
		await dialog.getByRole("button", { name: "Create" }).click();
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("Shape Castle");
		expect(await read(page, (s) => s.scene.data.enabled)).toBe(false);
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

		// Deleting never opens another world in its place: the home screen, with the rest listed (ADR-0132).
		await fileMenu(page, /Delete world/);
		await page.getByRole("button", { name: "Delete", exact: true }).click();
		await expect.poll(() => storedWorlds(page)).toBe(1);
		const home = page.getByRole("main", { name: "Home" });
		await expect(page.locator("canvas")).toHaveCount(0);
		await home.getByRole("button", { name: /^Original/ }).click();
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("Original");

		// Deleting the last one leaves no world open: the home screen (ADR-0121), on reload too.
		await fileMenu(page, /Delete world/);
		await page.getByRole("button", { name: "Delete", exact: true }).click();
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
		await appMenu(page, /Wipe everything/);
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
		await appMenu(page, /Reset this browser/);
		await page.getByRole("button", { name: "Reset settings" }).click();
		await reopened(page);
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("Kept");
	});
});

test.describe("a browser's export (ADR-0140)", () => {
	test("Export this browser downloads it, and another browser adds its worlds", async ({
		page,
		browser,
	}) => {
		await openEditor(page);
		await page.getByLabel("Title").first().fill("Moved along");
		await saved(page);
		const download = page.waitForEvent("download");
		await appMenu(page, /^Export this browser/);
		expect((await download).suggestedFilename()).toMatch(
			/^isometrics-browser-\d{4}-\d{2}-\d{2}\.json$/,
		);
		const text = readFileSync(await (await download).path(), "utf8");
		expect(JSON.parse(text)).toMatchObject({ kind: "browser", version: 1 });

		// Another browser, with a world of its own.
		const context = await browser.newContext();
		const other = await context.newPage();
		const errors: string[] = [];
		other.on("pageerror", (error) => errors.push(error.message));
		await other.addInitScript(() => localStorage.setItem("isometrics:welcome-seen", "1"));
		await openEditor(other);
		await other.getByLabel("Title").first().fill("Already here");
		await saved(other);

		const chooser = other.waitForEvent("filechooser");
		await appMenu(other, /^Import a browser/);
		await (await chooser).setFiles({
			name: "isometrics-browser.json",
			mimeType: "application/json",
			buffer: Buffer.from(text),
		});
		const dialog = other.getByRole("dialog", { name: "Import a browser’s export" });
		await expect(dialog).toContainText("Moved along");
		await dialog.getByRole("button", { name: /^Add to this browser/ }).click();

		await expect.poll(() => storedWorlds(other)).toBe(2);
		const titles = await other.evaluate(() =>
			(
				JSON.parse(localStorage.getItem("isometrics:world-index") ?? "[]") as { title: string }[]
			).map((world) => world.title),
		);
		expect(titles.sort()).toEqual(["Already here", "Moved along"]);
		// The open world stays as it was.
		expect(await read(other, (s) => s.scene.meta.title)).toBe("Already here");
		expect(errors).toEqual([]);
		await context.close();
	});
});
