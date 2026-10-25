import {
	act,
	choose,
	expect,
	fileMenu,
	keys,
	loadWorld,
	openEditor,
	read,
	reopened,
	test,
} from "./editor";

const preferences = (page: import("@playwright/test").Page) =>
	page.getByRole("dialog", { name: "Preferences" });

test.beforeEach(async ({ page }) => {
	await openEditor(page);
});

test.describe("Preferences (ADR-0062, ADR-0068)", () => {
	test("opens from File, keeps a change after a reload, and resets", async ({ page }) => {
		await fileMenu(page, /^Preferences/);
		await choose(page, "Camera control", "Free, like Blender");
		await page.keyboard.press("Escape");
		await page.reload();
		await reopened(page);
		await fileMenu(page, /^Preferences/);
		await expect(page.getByRole("combobox", { name: "Camera control" })).toContainText("Free");
		await preferences(page).getByRole("button", { name: "Reset all preferences" }).click();
		// It asks first.
		await page.getByRole("alertdialog").getByRole("button", { name: "Reset", exact: true }).click();
		await expect(page.getByRole("combobox", { name: "Camera control" })).toContainText("Simple");
	});

	test("its search finds a setting on another page", async ({ page }) => {
		await fileMenu(page, /^Preferences/);
		await preferences(page)
			.getByRole("searchbox", { name: "Search the preferences" })
			.fill("copies");
		await expect(page.getByRole("combobox", { name: "Names of copies" })).toBeVisible();
	});

	test("Names of copies: Number them makes Ctrl+D name copies “… 2”", async ({ page }) => {
		await fileMenu(page, /^Preferences/);
		await page.getByRole("button", { name: "Editing" }).click();
		await choose(page, "Names of copies", "Number them");
		await page.keyboard.press("Escape");
		await loadWorld(page, {
			entities: [{ id: "h", kind: "house_01", name: "Bakery", position: [0, 0] }],
		});
		await act(page, (s) => s.select("h"));
		await page.locator("canvas").hover();
		await keys(page, "Control+d");
		expect(await read(page, (s) => s.scene.entities.at(-1)?.name)).toBe("Bakery 2");
	});
});

test.describe("the theme (ADR-0007)", () => {
	test("the toolbar's theme button goes light, dark, then back to matching the device", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Theme: match device" }).click();
		expect(await read(page, (s) => s.scene.theme)).toBe("light");
		await page.getByRole("button", { name: "Theme: light" }).click();
		expect(await read(page, (s) => s.scene.theme)).toBe("dark");
		await page.getByRole("button", { name: "Theme: dark" }).click();
		expect(await read(page, (s) => s.scene.theme)).toBe("system");
	});
});
