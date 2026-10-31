import type { Page } from "@playwright/test";

import { act, expect, labelCard, loadWorld, openEditor, read, test } from "./editor";

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
		expect(road?.data.vehicleCountAlong?.key).toBe("row.players");
	});
});
