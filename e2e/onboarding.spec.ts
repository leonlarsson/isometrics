import { act, buildWithAiMenu, expect, openEditor, read, test } from "./editor";

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
		await buildWithAiMenu(page, /A new world/);
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

		await dialog.getByRole("textbox", { name: "Its answer" }).fill(ANSWER);
		// Checked as it's pasted (ADR-0117).
		await expect(dialog).toContainText("It opens as written");
		await dialog.getByRole("button", { name: "Open it", exact: true }).click();
		await expect(dialog).toBeHidden();
		expect(await read(page, (s) => s.scene.meta.title)).toBe("Two shops");
		expect(await read(page, (s) => s.scene.entities.filter((e) => e.dataRow).length)).toBe(2);
	});

	test("File → Change this world opens it to change, and a broken answer lists its problems", async ({
		page,
	}) => {
		await openEditor(page);
		await buildWithAiMenu(page, /Change this world/);
		const dialog = page.getByRole("dialog", { name: "Build with your AI" });
		await expect(dialog.getByRole("radio", { name: /Change this world/ })).toBeChecked();
		await dialog
			.getByRole("textbox", { name: "Its answer" })
			.fill(
				'{"version": 1, "entities": [{"id": "x", "kind": "spaceship_99", "position": [0, 0]}]}',
			);
		await expect(dialog).toContainText("isn't a part kind");
		await expect(
			dialog.getByRole("button", { name: "Copy the problems for your AI" }),
		).toBeVisible();
	});
});

test.describe("changes as a patch (ADR-0118)", () => {
	test("a pasted patch says what it changes, goes in as one undo step, and Undo takes it back", async ({
		page,
	}) => {
		await openEditor(page);
		const target = await read(page, (s) => ({
			id: s.scene.entities[0].id,
			scale: s.scene.entities[0].scale,
			count: s.scene.entities.length,
		}));
		await buildWithAiMenu(page, /Change this world/);
		const dialog = page.getByRole("dialog", { name: "Build with your AI" });
		await dialog.getByRole("textbox", { name: "Its answer" }).fill(
			JSON.stringify({
				isPatch: true,
				lighting: { time: 19.5 },
				entities: {
					change: [{ id: target.id, scale: 1.7 }],
					add: [
						{ id: "patch_boat", kind: "sailing_boat_01", name: "Patch boat", position: [0, 0] },
					],
				},
			}),
		);
		await expect(dialog).toContainText("Checked: a patch.");
		await expect(dialog).toContainText("adds Patch boat");
		await dialog.getByRole("button", { name: "Put it in place" }).click();
		await expect(dialog).toBeHidden();
		expect(await read(page, (s) => s.scene.entities[0].scale)).toBe(1.7);
		expect(await read(page, (s) => s.scene.entities.length)).toBe(target.count + 1);
		expect(await read(page, (s) => s.scene.lighting.time)).toBe(19.5);

		await act(page, (s) => s.undo());
		expect(await read(page, (s) => s.scene.entities[0].scale)).toBe(target.scale);
		expect(await read(page, (s) => s.scene.entities.length)).toBe(target.count);
	});
});

test.describe("POST /api/worlds/validate (ADR-0117)", () => {
	test("says what's wrong in a world and where; GET says how", async ({ request }) => {
		const how = await request.get("/api/worlds/validate");
		expect(await how.json()).toHaveProperty("about");

		const answer = await request.post("/api/worlds/validate", {
			data: { version: 1, entities: [{ id: "x", kind: "spaceship_99", position: [0, 0] }] },
		});
		expect(answer.headers()["access-control-allow-origin"]).toBe("*");
		const check = await answer.json();
		expect(check.warnings[0].where).toBe('entities[0] "x".kind');

		const notJson = await request.post("/api/worlds/validate", {
			data: Buffer.from("{ nope"),
			headers: { "Content-Type": "application/json" },
		});
		expect(notJson.status()).toBe(400);

		// A patch, with the world it changes (ADR-0118), and its format.
		const patched = await (
			await request.post("/api/worlds/validate", {
				data: {
					world: { version: 1, entities: [{ id: "h", kind: "house_01", position: [0, 0] }] },
					patch: { isPatch: true, entities: { change: [{ id: "nope", scale: 2 }] } },
				},
			})
		).json();
		expect(patched.problems[0].where).toBe("patch entities.change[0]");
		const patchSchema = await (await request.get("/api/worlds/schema/patch")).json();
		expect(patchSchema.properties).toHaveProperty("entities");
	});
});

test.describe("the guide (ADR-0116)", () => {
	test("is a page for people and Markdown for AIs, with the walkthrough", async ({
		page,
		request,
	}) => {
		const text = await (await request.get("/guide.md")).text();
		expect(text).toContain("## Walkthrough: a world from the Battlefield Stats API");
		expect(text).toContain("http://localhost:3000/api/worlds/schema");

		await page.goto("/guide");
		await expect(page.getByRole("heading", { name: "1. Read the API as a table" })).toBeVisible();
	});
});
