import { expect, groundSpot, keys, openEditor, openPanel, read, showView, test } from "./editor";

test.describe("the parts catalogue (ADR-0087)", () => {
	test("searches and filters the parts, and opens one's details by its address", async ({
		page,
	}) => {
		await page.goto("/parts");
		const cards = page.getByRole("list").getByRole("button");
		await expect(cards.filter({ hasText: "Office tower" })).toBeVisible();
		const all = await cards.count();

		// A category narrows the list; its chip says how many.
		await page.getByRole("button", { name: /^Nature \d+$/ }).click();
		await expect(cards).toHaveCount(2);
		await page.getByRole("button", { name: /^All \d+$/ }).click();
		await expect(cards).toHaveCount(all);

		// The search finds parts by their search words too.
		await page.getByRole("searchbox", { name: "Search parts" }).fill("skyscraper");
		await expect(cards).toHaveCount(1);

		// Details open from a card, with the part's address, and close again.
		await cards.first().click();
		const details = page.getByRole("dialog", { name: "Office tower" });
		await expect(details).toBeVisible();
		await expect(details.getByText("office_tower_01").first()).toBeVisible();
		await expect(details.getByRole("heading", { name: "Screens" })).toBeVisible();
		expect(new URL(page.url()).searchParams.get("part")).toBe("office_tower_01");
		await page.getByRole("button", { name: "Close", exact: true }).click();
		await expect(details).toBeHidden();
		expect(new URL(page.url()).searchParams.get("part")).toBeNull();

		// An address with a part opens its details straight away.
		await page.goto("/parts?part=house_01");
		await expect(page.getByRole("dialog", { name: "House" })).toBeVisible();
	});

	test("tries out a part's settings, kept in the address", async ({ page }) => {
		await page.goto("/parts?part=house_01");
		const details = page.getByRole("dialog", { name: "House" });
		// The details take focus themselves, so no button's tooltip pops up.
		await expect(details).toBeFocused();

		// The editor's own panels, folded at first: a setting and a colour, with their names in a file.
		const chimney = details.getByRole("switch", { name: "Show the chimney" });
		await expect(chimney).toBeHidden();
		await openPanel(page, "House shape");
		await openPanel(page, "Colours");
		await chimney.click();
		await expect(details.getByText("showChimney")).toBeVisible();
		await details.getByRole("button", { name: "Colour", exact: true }).first().click();
		await page
			.getByRole("button", { name: /^Use #/ })
			.first()
			.click();
		await page.keyboard.press("Escape");
		await expect(details).toBeVisible();
		const settings = () =>
			JSON.parse(new URL(page.url()).searchParams.get("settings") ?? "null") as {
				props: Record<string, unknown>;
				colors: Record<string, unknown>;
			} | null;
		await expect.poll(() => settings()?.props).toEqual({ showChimney: false });
		expect(Object.keys(settings()?.colors ?? {})).toEqual(["roof"]);

		// A reload keeps them, with the panels folded again; Reset all puts the part back as it comes.
		await page.reload();
		await expect(chimney).toBeHidden();
		await openPanel(page, "House shape");
		await expect(chimney).not.toBeChecked();
		await page.getByRole("button", { name: "Reset all" }).click();
		await expect(chimney).toBeChecked();
		expect(settings()).toBeNull();
	});

	test("copies a part as set up, to paste into a world", async ({ page, context, baseURL }) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"], {
			origin: new URL(baseURL ?? "http://localhost:3000").origin,
		});
		await page.goto(
			`/parts?part=house_01&settings=${encodeURIComponent(JSON.stringify({ props: { showChimney: false } }))}`,
		);
		await page.getByRole("button", { name: "Copy as JSON" }).click();
		// The button says so for a moment: a tick, outlined in green.
		await expect(page.getByRole("button", { name: "Copy as JSON" })).toHaveAttribute(
			"data-success",
		);

		await openEditor(page);
		await showView(page, [0, 0], 30);
		const spot = await groundSpot(page, [2, 2]);
		await page.mouse.move(spot.x, spot.y);
		const before = await read(page, (s) => s.scene.entities.length);
		await keys(page, "Control+v");
		await expect.poll(() => read(page, (s) => s.scene.entities.length)).toBe(before + 1);
		const pasted = await read(page, (s) => s.scene.entities.at(-1));
		expect(pasted?.kind).toBe("house_01");
		expect(pasted?.props).toEqual({ showChimney: false });
	});

	test("is linked from Add to scene", async ({ page }) => {
		await openEditor(page);
		await expect(page.getByRole("link", { name: "Browse all parts" })).toHaveAttribute(
			"href",
			"/parts",
		);
	});
});
