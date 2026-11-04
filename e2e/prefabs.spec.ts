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
	page.getByRole("status").filter({ hasText: "Save the prefab" });

test.describe("prefabs and the Workshop (ADR-0134)", () => {
	test("make a prefab from shapes in the Workshop, then place it", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {});
		await (await paletteTile(page, "Prefabs", "Make a prefab…")).click();
		await expect(workshopBar(page)).toBeVisible();
		// A studio: the ground is off until asked for, and the bar turns it on.
		const showsGround = () =>
			read(page, (s) =>
				s.whatIsOpen.kind === "world" ? s.whatIsOpen.workshop?.showsGround : null,
			);
		expect(await showsGround()).toBe(false);
		await workshopBar(page).getByRole("button", { name: "Show the ground" }).click();
		expect(await showsGround()).toBe(true);
		await workshopBar(page).getByRole("button", { name: "Hide the ground" }).click();
		// Nothing to save yet.
		await expect(page.getByRole("button", { name: "Save the prefab" })).toBeDisabled();
		// What acts on the open world as a world is greyed out here, saying why.
		await page.getByRole("button", { name: "File" }).click();
		await expect(menuItem(page, "Save to file (not in the Workshop)")).toBeDisabled();
		await page.keyboard.press("Escape");

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
		// Placed from the Ground menu's Add here, under My prefabs.
		await act(page, (s) => s.openGroundMenu([4, 4], { x: 500, y: 400 }));
		await menuItem(page, "Add here").hover();
		await menuItem(page, /^Silo/).click();
		expect(await prefabsNow(page)).toEqual([{ name: "Silo", pieces: 1, copies: 1 }]);

		// Taken out of My prefabs from its tile's menu: this world keeps it.
		await palette.getByRole("button", { name: "Silo", exact: true }).click({ button: "right" });
		await menuItem(page, "Remove from My prefabs").click();
		const library = await page.evaluate(() => localStorage.getItem("isometrics:prefabs"));
		expect(JSON.parse(library ?? "[]")).toEqual([]);
		expect(await prefabsNow(page)).toEqual([{ name: "Silo", pieces: 1, copies: 1 }]);
	});

	test("Edit prefab changes the prefab, and every copy with it", async ({ page }) => {
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
		// A copy's right-click says Edit prefab, as its tile's does.
		await act(page, (s) => {
			s.select("c1");
			s.openContextMenu({ kind: "entity", id: "c1" }, { x: 500, y: 400 });
		});
		await menuItem(page, /^Edit prefab/).click();
		await expect(page.getByRole("textbox", { name: "Prefab's name", exact: true })).toHaveValue(
			"Kiosk",
		);

		await (await paletteTile(page, "Shapes", "Cone")).click();
		await page.getByRole("button", { name: "Save the prefab" }).click();
		expect(await prefabsNow(page)).toEqual([{ name: "Kiosk", pieces: 2, copies: 2 }]);
		// One undo step takes the change back.
		await act(page, (s) => s.undo());
		expect(await prefabsNow(page)).toEqual([{ name: "Kiosk", pieces: 1, copies: 2 }]);

		// Taken out of this world from its tile, with its copies, asked first.
		const palette = page.getByRole("navigation", { name: "Parts" });
		await palette.getByRole("button", { name: "Prefabs", exact: true }).click();
		await palette
			.getByRole("button", { name: "Kiosk", exact: true })
			.first()
			.click({ button: "right" });
		await menuItem(page, "Remove from this world…").click();
		await page
			.getByRole("alertdialog")
			.getByRole("button", { name: "Remove from this world" })
			.click();
		expect(await prefabsNow(page)).toEqual([]);
		expect(await read(page, (s) => s.scene.entities.length)).toBe(0);
	});

	test("share a prefab by link, and add it to My prefabs from the link", async ({ page }) => {
		await openEditor(page);
		await loadWorld(page, {});
		await (await paletteTile(page, "Prefabs", "Make a prefab…")).click();
		await (await paletteTile(page, "Shapes", "Dome")).click();
		await page.getByRole("textbox", { name: "Prefab's name", exact: true }).fill("Observatory");
		await page.getByRole("button", { name: "Save the prefab" }).click();

		const palette = page.getByRole("navigation", { name: "Parts" });
		await palette
			.getByRole("button", { name: "Observatory", exact: true })
			.click({ button: "right" });
		await menuItem(page, "Share a link…").click();
		const dialog = page.getByRole("dialog", { name: "Share a link" });
		await expect(dialog).toContainText("anyone with the link");
		await dialog.getByRole("button", { name: "Create a public link" }).click();
		await expect(dialog.getByRole("button", { name: "Copy the link" })).toBeVisible();
		const url = await page.evaluate(
			() =>
				(
					JSON.parse(localStorage.getItem("isometrics:shared-prefab-links") ?? "[]") as {
						url: string;
					}[]
				)[0]?.url,
		);
		expect(url).toMatch(/\/p\/[A-Za-z0-9_-]{22}$/);

		// Opened from its link in a browser without it in My prefabs.
		await page.evaluate(() => localStorage.removeItem("isometrics:prefabs"));
		await page.goto(new URL(url).pathname);
		const bar = page.getByRole("status").filter({ hasText: "Preview of a shared prefab" });
		await expect(bar).toBeVisible({ timeout: 90_000 });
		await bar.getByRole("button", { name: "Add to My prefabs" }).click();
		const library = await page.evaluate(() => localStorage.getItem("isometrics:prefabs"));
		expect(
			(JSON.parse(library ?? "[]") as { name: string }[]).map((prefab) => prefab.name),
		).toEqual(["Observatory"]);
	});
});
