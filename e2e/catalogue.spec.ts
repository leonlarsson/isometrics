import { expect, openEditor, test } from "./editor";

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
		await expect(details.getByText("Screens", { exact: true })).toBeVisible();
		expect(new URL(page.url()).searchParams.get("part")).toBe("office_tower_01");
		await page.getByRole("button", { name: "Close", exact: true }).click();
		await expect(details).toBeHidden();
		expect(new URL(page.url()).searchParams.get("part")).toBeNull();

		// An address with a part opens its details straight away.
		await page.goto("/parts?part=house_01");
		await expect(page.getByRole("dialog", { name: "House" })).toBeVisible();
	});

	test("is linked from Add to scene", async ({ page }) => {
		await openEditor(page);
		await expect(page.getByRole("link", { name: "Browse all parts" })).toHaveAttribute(
			"href",
			"/parts",
		);
	});
});
