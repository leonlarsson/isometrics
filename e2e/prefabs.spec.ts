import { act, expect, loadWorld, menuItem, openEditor, paletteTile, read, test } from "./editor";

/** The prefabs in the world, by name, with how many pieces and copies each has. */
const prefabsNow = (page: Parameters<typeof read>[0]) =>
	read(page, (s) =>
		s.scene.prefabs.map((prefab) => ({
			name: prefab.name,
			pieces: prefab.entities.length + prefab.fences.length,
			copies: s.scene.entities.filter((entity) => entity.kind === prefab.id).length,
		})),
	);

const workshopBar = (page: Parameters<typeof read>[0]) =>
	page.getByRole("status").filter({ hasText: "The Workshop" });

test.describe("prefabs and the Workshop (ADR-0134)", () => {
	test("make a prefab from shapes in the Workshop, then place it", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {});
		await (await paletteTile(page, "Prefabs", "Make a prefab…")).click();
		await expect(workshopBar(page)).toContainText("a new prefab");
		// Nothing to save yet.
		await expect(page.getByRole("button", { name: "Save the prefab" })).toBeDisabled();

		await (await paletteTile(page, "Shapes", "Box")).click();
		await (await paletteTile(page, "Shapes", "Ball")).click();
		await page.getByRole("textbox", { name: "Prefab's name", exact: true }).fill("Beacon");
		await page.getByRole("button", { name: "Save the prefab" }).click();

		await expect(workshopBar(page)).toHaveCount(0);
		expect(await prefabsNow(page)).toEqual([{ name: "Beacon", pieces: 2, copies: 1 }]);
		// The new copy is selected, ready to move.
		expect(
			await read(page, (s) => s.scene.entities.find((e) => e.id === s.selectedId)?.kind),
		).toMatch(/^prefab_/);

		// Placed again from its tile, which has a picture.
		const tile = await paletteTile(page, "Prefabs", "Beacon");
		await expect(tile.locator("img")).toHaveCount(1, { timeout: 15000 });
		await tile.click();
		expect(await prefabsNow(page)).toEqual([{ name: "Beacon", pieces: 2, copies: 2 }]);
	});

	test("make a prefab from a selection, which takes the selection's place", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {
			entities: [
				{ id: "a", kind: "box_01", position: [4, 0] },
				{ id: "b", kind: "cylinder_01", position: [6, 0] },
				{ id: "keep", kind: "house_01", position: [-8, -8] },
			],
		});
		await act(page, (s) => {
			s.selectItems([
				{ kind: "entity", id: "a" },
				{ kind: "entity", id: "b" },
			]);
			s.openContextMenu({ kind: "entity", id: "a" }, { x: 500, y: 400 });
		});
		await menuItem(page, "Make a prefab from these…").click();
		await expect(workshopBar(page)).toBeVisible();
		expect(await read(page, (s) => s.scene.entities.map((e) => e.kind))).toEqual([
			"box_01",
			"cylinder_01",
		]);
		await page.getByRole("button", { name: "Save the prefab" }).click();

		const after = await read(page, (s) => ({
			kinds: s.scene.entities.map((e) => e.kind),
			copy: s.scene.entities.find((e) => e.kind.startsWith("prefab_"))?.position,
		}));
		expect(after.kinds).toHaveLength(2);
		expect(after.kinds).toContain("house_01");
		expect(after.copy).toEqual([5, 0]);
		expect((await prefabsNow(page))[0]).toMatchObject({ pieces: 2, copies: 1 });
	});

	test("My prefabs: a prefab saved in one world is placed in another", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {});
		await (await paletteTile(page, "Prefabs", "Make a prefab…")).click();
		await (await paletteTile(page, "Shapes", "Cylinder")).click();
		await page.getByRole("textbox", { name: "Prefab's name", exact: true }).fill("Silo");
		await page.getByRole("button", { name: "Save the prefab" }).click();
		await expect(workshopBar(page)).toHaveCount(0);

		// Another world, without it.
		await act(page, (s) => {
			const scene = structuredClone(s.scene);
			scene.prefabs = [];
			scene.entities = [];
			scene.meta.title = "Elsewhere";
			s.loadScene(scene);
		});
		const palette = page.getByRole("navigation", { name: "Parts" });
		await palette.getByRole("button", { name: "Prefabs", exact: true }).click();
		await palette.getByRole("button", { name: "Silo", exact: true }).click();
		expect(await prefabsNow(page)).toEqual([{ name: "Silo", pieces: 1, copies: 1 }]);

		// Taken out of My prefabs from its tile's menu: this world keeps it.
		await palette.getByRole("button", { name: "Silo", exact: true }).click({ button: "right" });
		await menuItem(page, "Remove from My prefabs").click();
		const library = await page.evaluate(() => localStorage.getItem("isometrics:prefabs"));
		expect(JSON.parse(library ?? "[]")).toEqual([]);
		expect(await prefabsNow(page)).toEqual([{ name: "Silo", pieces: 1, copies: 1 }]);
	});

	test("Edit in the Workshop changes the prefab, and every copy with it", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {
			entities: [
				{ id: "c1", kind: "prefab_kiosk", position: [0, 0] },
				{ id: "c2", kind: "prefab_kiosk", position: [6, 0] },
			],
		});
		await act(page, (s) =>
			s.commit((scene) => {
				scene.prefabs = [
					{
						id: "prefab_kiosk",
						name: "Kiosk",
						description: "",
						entities: [
							JSON.parse(JSON.stringify({ ...scene.entities[0], id: "box", kind: "box_01" })),
						],
						fences: [],
					},
				];
			}),
		);
		await act(page, (s) => s.select("c1"));
		await page.getByRole("tab", { name: "Object" }).click();
		await page.getByRole("button", { name: "Edit in the Workshop" }).click();
		await expect(workshopBar(page)).toContainText("changing Kiosk");

		await (await paletteTile(page, "Shapes", "Cone")).click();
		await page.getByRole("button", { name: "Save the prefab" }).click();
		expect(await prefabsNow(page)).toEqual([{ name: "Kiosk", pieces: 2, copies: 2 }]);
		// One undo step takes the change back.
		await act(page, (s) => s.undo());
		expect(await prefabsNow(page)).toEqual([{ name: "Kiosk", pieces: 1, copies: 2 }]);
	});
});
