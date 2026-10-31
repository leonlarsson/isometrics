import { expect, fileMenu, openEditor, read, test } from "./editor";

/** A small world, as an AI might answer: words around JSON in fences. */
const ANSWER = `Here's your world!

\`\`\`json
${JSON.stringify({
	version: 1,
	meta: { title: "Two shops" },
	ground: { width: 40, depth: 30 },
	data: {
		tables: [
			{
				key: "shops",
				name: "Shops",
				keyColumn: "shop",
				columns: [{ key: "shop" }, { key: "sales", name: "Sales" }],
				rows: [
					{ shop: "North", sales: 1200 },
					{ shop: "South", sales: 640 },
				],
			},
		],
	},
	entities: [
		{
			id: "north",
			kind: "house_cluster_01",
			name: "North",
			position: [-8, 0],
			dataRow: { tableKey: "shops", rowKey: "North" },
			label: { isShown: true, dataKeys: ["row.sales"] },
		},
		{
			id: "south",
			kind: "house_cluster_01",
			name: "South",
			position: [8, 0],
			dataRow: { tableKey: "shops", rowKey: "South" },
			label: { isShown: true, dataKeys: ["row.sales"] },
		},
	],
})}
\`\`\`

Enjoy!`;

test.describe("the welcome (ADR-0116)", () => {
	test.use({ welcomes: true });

	test("greets a new browser once; Build a city starts a world without data", async ({ page }) => {
		await openEditor(page);
		const welcome = page.getByRole("dialog", { name: /Welcome to/ });
		await expect(welcome).toBeVisible();
		await welcome.getByRole("radio", { name: /Build a city/ }).click();
		await welcome.getByRole("button", { name: "Start" }).click();

		const newWorld = page.getByRole("dialog", { name: "New world" });
		await expect(newWorld).toBeVisible();
		await expect(newWorld.getByRole("switch", { name: "Uses data" })).not.toBeChecked();
		await newWorld.getByRole("button", { name: "Create" }).click();
		expect(await read(page, (s) => s.scene.data.isOn)).toBe(false);
		await expect(page.getByRole("tab", { name: "Data", exact: true })).toHaveCount(0);

		// Seen: not again on the next visit.
		await page.reload();
		await openEditor(page);
		await expect(page.getByRole("dialog", { name: /Welcome to/ })).toHaveCount(0);
	});

	test("Explore an example opens New world on the data maps", async ({ page }) => {
		await openEditor(page);
		const welcome = page.getByRole("dialog", { name: /Welcome to/ });
		await welcome.getByRole("radio", { name: /Explore an example/ }).dblclick();
		const newWorld = page.getByRole("dialog", { name: "New world" });
		await expect(newWorld.getByRole("button", { name: /Data maps/ })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await newWorld.getByRole("button", { name: "Create" }).click();
		expect(await read(page, (s) => s.scene.data.tables.length)).toBeGreaterThan(0);
	});
});

test.describe("Build with your AI (ADR-0116)", () => {
	test("copies a prompt with the description, and opens the world pasted back", async ({
		page,
		context,
	}) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"], {
			origin: "http://localhost:3000",
		});
		await openEditor(page);
		await fileMenu(page, /Build with your AI/);
		const dialog = page.getByRole("dialog", { name: "Build with your AI" });
		const copy = dialog.getByRole("button", { name: "Copy the prompt" });
		await expect(copy).toBeDisabled();

		await dialog
			.getByRole("textbox", { name: "How it looks and what it has" })
			.fill("Two shops by a river, sized by sales");
		await dialog
			.getByRole("textbox", { name: "Data (optional)" })
			.fill("shop,sales\nNorth,1200\nSouth,640");
		await copy.click();
		await expect(dialog.getByRole("button", { name: /Copied/ })).toBeVisible();
		const prompt = await page.evaluate(() => navigator.clipboard.readText());
		expect(prompt).toContain("> Two shops by a river, sized by sales");
		expect(prompt).toContain("North,1200");

		await dialog.getByRole("textbox", { name: "The world it wrote" }).fill(ANSWER);
		await dialog.getByRole("button", { name: "Open it" }).click();
		await expect(dialog).toBeHidden();
		expect(await read(page, (s) => s.scene.meta.title)).toBe("Two shops");
		expect(await read(page, (s) => s.scene.entities.filter((e) => e.dataRow).length)).toBe(2);
	});
});
