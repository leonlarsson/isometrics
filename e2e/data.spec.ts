import type { Page } from "@playwright/test";

import { act, expect, fileMenu, labelCard, loadWorld, openEditor, read, test } from "./editor";

/** A small world with a table of clubs and two towers named after them. */
const clubsWorld = (page: Page) =>
	loadWorld(page, {
		data: {
			tables: [
				{
					key: "clubs",
					name: "Clubs",
					keyColumn: "club",
					columns: [
						{ key: "club", name: "Club" },
						{ key: "players", name: "Players" },
					],
					rows: [
						{ club: "APES", players: 71 },
						{ club: "CGM", players: 25 },
					],
				},
			],
		},
		entities: [
			{ id: "a", kind: "office_tower_01", name: "apes", position: [-4, 0] },
			{ id: "b", kind: "office_tower_01", name: "Nobody", position: [4, 0] },
		],
	});

test.beforeEach(async ({ page }) => {
	await openEditor(page);
});

test.describe("rows become things (ADR-0108, ADR-0109)", () => {
	test("selected objects take the rows matching their names, and say which matched none", async ({
		page,
	}) => {
		await clubsWorld(page);
		await act(page, (s) => {
			s.selectItems([
				{ kind: "entity", id: "a" },
				{ kind: "entity", id: "b" },
			]);
			s.setTab("objectData");
		});
		await page.getByRole("button", { name: "Give each the row matching its name" }).click();
		await expect(page.getByText("1 of 2 took their row")).toBeVisible();
		await expect(page.getByText(/matches “Nobody”/)).toBeVisible();
		expect(await read(page, (s) => s.scene.entities.map((e) => e.dataRow?.rowKey ?? null))).toEqual(
			["APES", null],
		);
	});

	test("an object's card and floors follow its row", async ({ page }) => {
		await clubsWorld(page);
		await act(page, (s) =>
			s.updateEntity("a", (e) => {
				e.dataRow = { tableKey: "clubs", rowKey: "APES" };
				e.label = {
					isShown: true,
					title: "",
					dataKeys: ["row.players"],
					offset: [0, 2, 0],
					tag: "",
					showsAsChip: false,
				};
			}),
		);
		await expect(labelCard(page, /apes/)).toContainText("71");
		// Its row read again: the card follows, with nothing typed.
		await act(page, (s) =>
			s.commit((scene) => {
				scene.data.tables[0].rows[0].players = 80;
			}),
		);
		await expect(labelCard(page, /apes/)).toContainText("80");
	});

	test("a table places one object for each row, already following it", async ({ page }) => {
		await clubsWorld(page);
		await act(page, (s) => s.setTab("data"));
		await page.getByRole("button", { name: /^Clubs/ }).click();
		await page.getByRole("button", { name: "Place one for each row…" }).click();
		await page.getByRole("button", { name: "Place 2 objects" }).click();
		const placed = await read(page, (s) =>
			s.scene.entities.filter((e) => e.dataRow).map((e) => [e.name, e.dataRow?.rowKey]),
		);
		expect(placed).toEqual([
			["APES", "APES"],
			["CGM", "CGM"],
		]);
		// Back in the table's viewer, which names what follows each row.
		const viewer = page.getByRole("dialog", { name: "Clubs" });
		await expect(viewer).toContainText("On the map");
		await expect(viewer.getByRole("row", { name: /CGM.*CGM/ })).toBeVisible();
	});
});

test.describe("roads that show flows (ADR-0112)", () => {
	test("a from, to, amount table draws a road for each row, with its flow", async ({ page }) => {
		await loadWorld(page, {
			data: {
				tables: [
					{
						key: "overlap",
						name: "Overlap",
						keyColumn: "pair",
						columns: [{ key: "pair" }, { key: "from" }, { key: "to" }, { key: "players" }],
						rows: [{ pair: "1", from: "Hunt", to: "Tarkov", players: 400 }],
					},
				],
			},
			entities: [
				{ id: "h", kind: "house_cluster_01", name: "Hunt", position: [-10, 0] },
				{ id: "t", kind: "tower_cluster_01", name: "Tarkov", position: [10, 0] },
			],
		});
		await act(page, (s) => s.setTab("data"));
		await page.getByRole("button", { name: /^Overlap/ }).click();
		await page.getByRole("button", { name: "Draw a road for each row…" }).click();
		await page.getByRole("button", { name: "Draw 1 roads" }).click();
		await expect(page.getByText("Drew 1 of 1 roads")).toBeVisible();
		const road = await read(page, (s) => s.scene.roads.at(-1));
		expect(road?.name).toBe("Hunt → Tarkov");
		expect(road?.flow.isOn).toBe(true);
		expect(road?.data.width?.key).toBe("row.players");

		// Opened in View mode, it shows its flow in data terms.
		await act(
			page,
			(s, id) => {
				s.setMode("view");
				s.selectRoad(id);
			},
			road?.id,
		);
		const sheet = page.getByRole("complementary", { name: "Hunt → Tarkov details" });
		await expect(sheet).toContainText("400");
		await expect(sheet).toContainText("Width: From data");
		await expect(sheet).toContainText("one way");
	});
});

test.describe("the dashboard (ADR-0110)", () => {
	test("cards say no data, flag a value past its line, and View mode shows the data as tables", async ({
		page,
	}) => {
		await loadWorld(page, {
			data: {
				values: [
					{
						key: "sent",
						name: "Messages sent",
						value: 1692,
						history: [
							{ at: "2026-09", value: 1840 },
							{ at: "2026-10", value: 1692 },
						],
						threshold: { line: 1700, flagsWhen: "below", word: "Watch" },
					},
				],
				tables: [
					{
						key: "games",
						name: "Games",
						keyColumn: "game",
						columns: [{ key: "game" }, { key: "players", name: "Players" }],
						rows: [{ game: "Ghost", players: null }],
					},
				],
			},
			entities: [
				{
					id: "m",
					kind: "tower_cluster_01",
					name: "Messages",
					position: [-6, 0],
					label: {
						isShown: true,
						title: "",
						dataKeys: ["sent"],
						offset: [0, 2, 0],
						tag: "home",
						showsAsChip: false,
					},
				},
				{
					id: "g",
					kind: "tent_cluster_01",
					name: "Ghost",
					position: [6, 0],
					dataRow: { tableKey: "games", rowKey: "Ghost" },
					label: {
						isShown: true,
						title: "",
						dataKeys: ["row.players"],
						offset: [0, 2, 0],
						tag: "",
						showsAsChip: false,
					},
				},
			],
		});
		const messages = labelCard(page, /Messages/);
		await expect(messages).toContainText("home");
		await expect(messages).toContainText("▼ 8% on September");
		await expect(messages).toContainText("⚠ Watch");
		await expect(labelCard(page, /Ghost/)).toContainText("no data");

		await act(page, (s) => s.setMode("view"));
		await page.getByRole("button", { name: "Data", exact: true }).click();
		const tables = page.getByRole("region", { name: "The world's data" });
		await expect(tables).toContainText("Games");
		await expect(tables).toContainText("Messages sent");
		await page.keyboard.press("Escape");
		await expect(tables).toBeHidden();
	});
});

test.describe("a world without data (ADR-0115)", () => {
	test("Uses data off hides the Data tabs and card values; on brings them back", async ({
		page,
	}) => {
		await loadWorld(page, {
			data: { values: [{ key: "sent", name: "Messages sent", value: 1692 }] },
			entities: [
				{
					id: "m",
					kind: "tower_cluster_01",
					name: "Messages",
					position: [0, 0],
					label: {
						isShown: true,
						title: "",
						dataKeys: ["sent"],
						offset: [0, 2, 0],
						tag: "",
						showsAsChip: false,
					},
				},
			],
		});
		const card = labelCard(page, /Messages/);
		const dataTab = page.getByRole("tab", { name: "Data", exact: true });
		await expect(card).toContainText("1,692");
		await expect(dataTab).toBeVisible();

		await page.getByRole("tab", { name: "World", exact: true }).click();
		await page.getByRole("switch", { name: "Uses data" }).click();
		await expect(card).not.toContainText("1,692");
		await expect(dataTab).toHaveCount(0);
		// The data is kept, and back when it's on again.
		expect(await read(page, (s) => s.scene.data.values.length)).toBe(1);

		await page.getByRole("switch", { name: "Uses data" }).click();
		await expect(card).toContainText("1,692");
		await expect(dataTab).toBeVisible();
	});
});

test.describe("links and APIs (ADR-0113)", () => {
	test("an API is read into a value over time, read again into what arrived, and kept", async ({
		page,
	}) => {
		test.setTimeout(120_000);
		let sentToday = 1692;
		const json = (body: unknown) => ({
			status: 200,
			contentType: "application/json",
			headers: { "access-control-allow-origin": "*" },
			body: JSON.stringify(body),
		});
		await page.route("https://api.battlefieldstats.com/outputs/daily", (route) =>
			route.fulfill(
				json([
					{ day: "2026-10-30", sent: 1601 },
					{ day: "2026-10-31", sent: sentToday },
				]),
			),
		);
		await page.route("https://api.steampowered.com/**", (route) => route.abort("failed"));
		await loadWorld(page, {
			data: {},
			entities: [
				{
					id: "c",
					kind: "tower_cluster_01",
					name: "Messages",
					label: {
						isShown: true,
						title: "",
						dataKeys: [],
						offset: [0, 2, 0],
						tag: "",
						showsAsChip: false,
					},
				},
			],
		});
		await act(page, (s) => s.setTab("data"));
		const dialog = page.getByRole("dialog", { name: "Read a link or API" });

		// A site that doesn't let browsers read it says so, and what would fix it.
		await page.getByRole("button", { name: "Read a link or API…" }).click();
		await dialog.getByRole("textbox", { name: "Address" }).fill("https://api.steampowered.com/x");
		await dialog.getByRole("button", { name: "Read", exact: true }).click();
		await expect(dialog).toContainText("CORS");

		await dialog
			.getByRole("textbox", { name: "Address" })
			.fill("https://api.battlefieldstats.com/outputs/daily");
		await dialog.getByRole("button", { name: "Read", exact: true }).click();
		await expect(dialog).toContainText("2 entries");
		await dialog.getByRole("button", { name: "Add to the world" }).click();
		expect(
			await read(page, (s) => s.scene.data.values.map((v) => [v.key, v.value, v.history.length])),
		).toEqual([["sent", 1692, 2]]);

		// Shown on the card, then read again: the card follows what arrived, the world keeps what it had.
		await act(page, (s) =>
			s.updateEntity("c", (e) => {
				e.label.dataKeys = ["sent"];
			}),
		);
		await expect(labelCard(page, /Messages/)).toContainText("1,692");
		sentToday = 1750;
		await page.getByRole("button", { name: "Read it again now" }).click();
		await expect(labelCard(page, /Messages/)).toContainText("1,750");
		expect(await read(page, (s) => s.scene.data.values[0].value)).toBe(1692);
		await page.getByRole("button", { name: "Keep these values" }).click();
		expect(await read(page, (s) => s.scene.data.values[0].value)).toBe(1750);
	});
});

test.describe("stories (ADR-0114)", () => {
	test("the story bar shows the world's data as it was on a date, and Now brings it back", async ({
		page,
	}) => {
		await loadWorld(page, {
			data: {
				values: [
					{
						key: "sent",
						name: "Messages sent",
						value: 30,
						history: [
							{ at: "2026-01", value: 10 },
							{ at: "2026-02", value: 20 },
							{ at: "2026-03", value: 30 },
						],
					},
				],
			},
			entities: [
				{
					id: "m",
					kind: "tower_cluster_01",
					name: "Messages",
					label: {
						isShown: true,
						title: "",
						dataKeys: ["sent"],
						offset: [0, 2, 0],
						tag: "",
						showsAsChip: false,
					},
				},
			],
		});
		await act(page, (s) => s.setMode("view"));
		const story = page.getByRole("region", { name: "Story" });
		await expect(story).toBeVisible();
		await story.getByRole("slider").focus();
		await page.keyboard.press("Home");
		await expect(story).toContainText("Jan 2026");
		const card = labelCard(page, /Messages/);
		await expect(card).toContainText("10");
		await expect(card).toContainText("2026");
		await story.getByRole("button", { name: "Now" }).click();
		await expect(card).toContainText("30");
	});
});

test.describe("the example worlds (data study)", () => {
	test("Extraction shooter territory opens from its snapshot: counts, no data and tiles", async ({
		page,
	}) => {
		await fileMenu(page, /New world/);
		const dialog = page.getByRole("dialog", { name: "New world" });
		// Data maps narrow the starters to the worlds made to show data.
		await dialog.getByRole("button", { name: /^Data maps/ }).click();
		await expect(dialog.getByRole("radio", { name: /Brightwater/ })).toBeHidden();
		await dialog.getByRole("radio", { name: /Extraction shooter territory/ }).click();
		await dialog.getByRole("button", { name: "Create" }).click();
		await expect
			.poll(() => read(page, (s) => s.scene.meta.title))
			.toBe("Extraction shooter territory");
		await expect(labelCard(page, /Hunt: Showdown 1896/)).toContainText("23,046");
		await expect(labelCard(page, /Upcoming title/)).toContainText("no data");
		await act(page, (s) => {
			s.setMode("view");
			s.select("hunt");
		});
		const sheet = page.getByRole("complementary", { name: "Hunt: Showdown 1896 details" });
		await expect(sheet).toContainText("Example numbers, not from Steam");
		await expect(sheet.getByRole("link", { name: "Steam Web API" })).toBeVisible();
	});
});
