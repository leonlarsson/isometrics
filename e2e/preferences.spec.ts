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

	test("Graphics: a preset sets every setting, and a changed one stays and resets (ADR-0072)", async ({
		page,
	}) => {
		await fileMenu(page, /^Preferences/);
		await page.getByRole("button", { name: "Graphics" }).click();
		const occlusion = page.getByRole("combobox", { name: "Ambient occlusion" });
		await expect(occlusion).toContainText("Off");
		await choose(page, "Preset", "Nice");
		await expect(occlusion).toContainText("Half resolution");
		await expect(page.getByRole("combobox", { name: "Real lights at night" })).toContainText(
			"16 nearest the view",
		);
		const glow = page.getByRole("switch", { name: "Glow after dark" });
		await expect(glow).toHaveAttribute("aria-checked", "true");
		await glow.click();
		await expect(preferences(page)).toContainText("1 setting below is changed from it");
		// Another preset keeps the change.
		await choose(page, "Preset", "Ultra");
		await expect(occlusion).toContainText("Full resolution");
		await expect(glow).toHaveAttribute("aria-checked", "false");
		// The setting's own Reset, the nearest one above it.
		await glow
			.locator("xpath=ancestor::*[.//button[@aria-label='Reset']][1]")
			.getByRole("button", { name: "Reset" })
			.click();
		await expect(glow).toHaveAttribute("aria-checked", "true");
		// The view keeps drawing through the effects (a page error fails the test).
		await page.keyboard.press("Escape");
		await page.waitForTimeout(1000);
	});

	test("the toolbar's shading switcher: a preset a click away, wireframe, and the Graphics settings (ADR-0080)", async ({
		page,
	}) => {
		const ultra = page.getByRole("button", { name: /^Ultra:/ });
		await ultra.click();
		await expect(ultra).toHaveAttribute("aria-pressed", "true");
		const wireframe = page.getByRole("button", { name: /^Wireframe:/ });
		await wireframe.click();
		await expect(wireframe).toHaveAttribute("aria-pressed", "true");
		await expect(ultra).toHaveAttribute("aria-pressed", "false");
		await page.getByRole("button", { name: /^Standard:/ }).click();
		await expect(wireframe).toHaveAttribute("aria-pressed", "false");
		// The ▾ opens Preferences on the Graphics page, which shows the preset picked.
		await page.getByRole("button", { name: "Graphics settings…" }).click();
		await expect(preferences(page).getByRole("combobox", { name: "Preset" })).toContainText(
			"Standard",
		);
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
