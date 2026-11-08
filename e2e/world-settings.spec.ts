import type { Page } from "@playwright/test";

import {
	act,
	addData,
	choose,
	dataWindow,
	entity,
	expect,
	labelCard,
	loadWorld,
	menuItem,
	openEditor,
	openPanel,
	paletteTile,
	read,
	reopened,
	saved,
	screenOf,
	showView,
	test,
} from "./editor";

const worldTab = async (page: Page, name: string) => {
	await act(page, (s) => s.clearSelection());
	await page.getByRole("tab", { name, exact: true }).click();
};
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

test.beforeEach(async ({ page }) => {
	await openEditor(page);
});

test.describe("the World tab (ADR-0049, ADR-0063)", () => {
	test("ground size and theme", async ({ page }) => {
		await worldTab(page, "World");
		await box(page, "Width").fill("80");
		await box(page, "Width").press("Enter");
		expect(await read(page, (s) => s.scene.ground.width)).toBe(80);
		await choose(page, "Theme", "Dark");
		expect(await read(page, (s) => s.scene.theme)).toBe("dark");
	});

	test("what viewers see: switching the title off hides it in View mode", async ({ page }) => {
		await worldTab(page, "World");
		await page.getByRole("switch", { name: "Show the title", exact: true }).click();
		expect(await read(page, (s) => s.scene.onScreen.showsTitle)).toBe(false);
		await page.getByRole("button", { name: "View", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Brightwater" })).toBeHidden();
	});
});

test.describe("the ground's shape (ADR-0155)", () => {
	test("a shape in one click, and Shape the ground's handles resize and reshape it", async ({
		page,
	}) => {
		await loadWorld(page, { entities: [{ id: "house", kind: "house_01", position: [0, 0] }] });
		await act(page, (s) =>
			s.commit((scene) => {
				scene.ground.width = 40;
				scene.ground.depth = 30;
			}),
		);
		await showView(page, [0, 0], 75);
		await worldTab(page, "World");
		await page.getByRole("button", { name: "Circle", exact: true }).click();
		expect(await read(page, (s) => s.scene.ground.points?.length)).toBe(32);
		await page.getByRole("button", { name: "Rectangle", exact: true }).click();
		expect(await read(page, (s) => s.scene.ground.points)).toBeNull();

		// The rectangle's side handle resizes it, staying centred; the view stays put under the pointer.
		await page.getByRole("button", { name: "Shape the ground", exact: true }).click();
		await expect(page.getByText("Shaping the ground")).toBeVisible();
		const drag = async (from: [number, number], to: [number, number]) => {
			const start = await screenOf(page, [from[0], 0.12, from[1]]);
			const end = await screenOf(page, [to[0], 0.12, to[1]]);
			await page.mouse.move(start.x, start.y);
			await page.mouse.down();
			await page.mouse.move(end.x, end.y, { steps: 10 });
			await page.mouse.up();
		};
		// The side's size handle, a ball standing about 19 px off the side's middle, outwards.
		const sideBall = async (x: number) => {
			const side = await screenOf(page, [x, 0, 0]);
			const further = await screenOf(page, [x + 1, 0, 0]);
			const length = Math.hypot(further.x - side.x, further.y - side.y);
			const off = 15 / length;
			return { x: side.x + (further.x - side.x) * off, y: side.y + (further.y - side.y) * off };
		};
		const ball = await sideBall(20);
		const sideTo = await screenOf(page, [26, 0, 0]);
		await page.mouse.move(ball.x, ball.y);
		await page.mouse.down();
		await page.mouse.move(
			ball.x + (sideTo.x - (await screenOf(page, [20, 0, 0])).x),
			ball.y + (sideTo.y - (await screenOf(page, [20, 0, 0])).y),
			{ steps: 10 },
		);
		await page.mouse.up();
		// Measured from where the drag really started (past the drag threshold), as an object's sides.
		const resized = await read(page, (s) => s.scene.ground);
		expect(resized.width).toBeGreaterThanOrEqual(48);
		expect(resized.points).toBeNull();
		// The rest from a known size, so the corner's place is exact.
		await act(page, (s) =>
			s.commit((scene) => {
				scene.ground.width = 52;
			}),
		);

		// A corner dragged out makes it a shape, its size growing round it.
		await drag([-26, -15], [-30, -22]);
		expect(await read(page, (s) => s.scene.ground)).toMatchObject({
			points: [
				[-30, -22],
				[26, -15],
				[26, 15],
				[-26, 15],
			],
			width: 60,
			depth: 44,
		});

		// The dragged corner is selected: Delete takes it out (back to four corners: Ctrl+Z puts it back).
		await page.keyboard.press("Delete");
		expect(await read(page, (s) => s.scene.ground.points?.length)).toBe(3);
		await page.keyboard.press("Control+z");
		expect(await read(page, (s) => s.scene.ground.points?.length)).toBe(4);

		// Undone like any change; with no corner selected, Esc ends shaping.
		await page.keyboard.press("Control+z");
		expect(await read(page, (s) => s.scene.ground.points)).toBeNull();
		await page.keyboard.press("Escape");
		await expect(page.getByText("Shaping the ground")).toBeHidden();
	});
});

test.describe("on a shaped ground (ADR-0155)", () => {
	test("a part dropped past a circle's edge lands on it", async ({ page }) => {
		await loadWorld(page, { entities: [] });
		await act(page, (s) =>
			s.commit((scene) => {
				scene.ground.width = 40;
				scene.ground.depth = 40;
			}),
		);
		await showView(page, [0, 0], 75);
		await worldTab(page, "World");
		await page.getByRole("button", { name: "Circle", exact: true }).click();
		// Back to Add to scene, and a tree dragged onto the rectangle's empty corner, off the circle.
		const tree = await paletteTile(page, "Nature", "Round tree");
		await tree.scrollIntoViewIfNeeded();
		const box = await tree.boundingBox();
		const corner = await screenOf(page, [18, 0, 18]);
		if (!box) {
			throw new Error("no tile");
		}
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(corner.x, corner.y, { steps: 12 });
		await page.mouse.up();
		const [x, z] = await read(page, (s) => s.scene.entities.at(-1)?.position ?? [0, 0]);
		expect(Math.hypot(x, z)).toBeLessThanOrEqual(20.01);
		expect(Math.hypot(x, z)).toBeGreaterThan(18);
	});
});

test.describe("Time & light (ADR-0052, ADR-0061)", () => {
	test("the time follows a day cycle, a preset or a typed time sets a fixed one, lights can be always on", async ({
		page,
	}) => {
		await worldTab(page, "Time & light");
		await choose(page, "Time follows", "A day cycle");
		expect(await read(page, (s) => s.scene.lighting.timeSource)).toBe("cycle");
		await choose(page, "Time follows", "A fixed time");
		await page.getByRole("button", { name: "Preset times" }).click();
		await menuItem(page, "Dusk").click();
		expect(await read(page, (s) => s.scene.lighting.time)).toBeCloseTo(19.7, 1);
		// To the minute, typed: the slider moves in quarter hours, the box takes any time.
		const clock = page.getByRole("textbox", { name: "Time of day", exact: true });
		await clock.fill("18:18");
		await clock.press("Tab");
		expect(await read(page, (s) => s.scene.lighting.time)).toBeCloseTo(18.3, 5);
		await expect(clock).toHaveValue("18:18");
		await choose(page, "Lit windows, lamps and headlights", "Always");
		expect(await read(page, (s) => s.scene.lighting.whenLightsAreOn)).toBe("on");
	});

	test("sun and shade contrast: Brightwater's is deeper than the default, and Reset goes back to the theme's balance (ADR-0072)", async ({
		page,
	}) => {
		await worldTab(page, "Time & light");
		// The Sun panel starts folded: the time of day sets the sun until it's set by hand.
		await openPanel(page, "Sun");
		const contrast = box(page, "Sun and shade contrast");
		await expect(contrast).toHaveValue("75");
		await contrast.fill("60");
		await contrast.press("Enter");
		expect(await read(page, (s) => s.scene.lighting.sunShadeContrast)).toBe(0.6);
		// The field's own Reset, the nearest one above its input.
		await contrast
			.locator("xpath=ancestor::*[.//button[@aria-label='Reset']][1]")
			.getByRole("button", { name: "Reset" })
			.click();
		expect(await read(page, (s) => s.scene.lighting.sunShadeContrast)).toBe(0.5);
	});
});

test.describe("the sky and the backdrop (ADR-0070)", () => {
	test("the sky can be switched off and clouded over; the diorama's backdrop can be a green screen", async ({
		page,
	}) => {
		// Clouds are set in the Weather tab (ADR-0102).
		await worldTab(page, "Weather");
		// Its panels start folded, the quick picks aside.
		await openPanel(page, "Clouds");
		await box(page, "Cloud cover").fill("80");
		await box(page, "Cloud cover").press("Enter");
		expect(await read(page, (s) => s.scene.weather.cloudCover)).toBe(0.8);
		await worldTab(page, "Sky & water");
		await page.getByRole("switch", { name: "Show the sky in perspective" }).click();
		expect(await read(page, (s) => s.scene.sky.showsInPerspective)).toBe(false);

		await openPanel(page, "Backdrop");
		await choose(page, "Behind the world", "Green screen");
		expect(await read(page, (s) => s.scene.backdrop.kind)).toBe("greenScreen");
		// The stage fades to it.
		await expect
			.poll(() =>
				page.getByRole("main").evaluate((stage) => getComputedStyle(stage).backgroundColor),
			)
			.toBe("rgb(0, 255, 0)");
	});
});

test.describe("moods (ADR-0078)", () => {
	test("save the look as a mood, change it, put the mood back on; a viewpoint puts its mood on", async ({
		page,
	}) => {
		await act(page, (s) =>
			s.commit((scene) => {
				scene.lighting.time = 18.5;
				scene.lighting.timeSource = "fixed";
			}),
		);
		await worldTab(page, "Moods");
		await page.getByRole("button", { name: "Save the current look" }).click();
		// It opens for naming.
		await page.keyboard.press("Control+a");
		await page.keyboard.type("Dusk");
		await page.keyboard.press("Enter");
		const moodId = await read(page, (s) => s.scene.moods.at(-1)?.id ?? "");
		await act(page, (s) =>
			s.commit((scene) => {
				scene.lighting.time = 22;
			}),
		);
		expect(await read(page, (s) => s.scene.moods.at(-1)?.name)).toBe("Dusk");
		await page.getByRole("button", { name: /^Dusk/ }).click();
		expect(await read(page, (s) => s.scene.lighting.time)).toBe(18.5);

		// A viewpoint with the mood puts it on when gone to.
		await act(
			page,
			(s, moodId) => {
				s.commit((scene) => {
					scene.lighting.time = 22;
					scene.viewpoints[0].moodId = moodId;
				});
				s.goToViewpoint(s.scene.viewpoints[0].id);
			},
			moodId,
		);
		expect(await read(page, (s) => s.scene.lighting.time)).toBe(18.5);

		// A viewer can opt out: then viewpoints only move the camera.
		await page.getByRole("button", { name: "Viewpoints" }).click();
		await page.getByRole("menuitemcheckbox", { name: "Viewpoints put on their moods" }).click();
		await page.keyboard.press("Escape");
		await act(page, (s) => {
			s.commit((scene) => {
				scene.lighting.time = 22;
			});
			s.goToViewpoint(s.scene.viewpoints[0].id);
		});
		expect(await read(page, (s) => s.scene.lighting.time)).toBe(22);
	});
});

test.describe("water (ADR-0075)", () => {
	test("the world's ripples and reflections, and a water area's own, which follow the world until set", async ({
		page,
	}) => {
		await loadWorld(page, {
			areas: [
				{
					id: "pond",
					kind: "water_01",
					points: [
						[-4, -4],
						[4, -4],
						[4, 4],
						[-4, 4],
					],
				},
			],
		});
		await worldTab(page, "Sky & water");
		await box(page, "Ripples on the water").fill("20");
		await box(page, "Ripples on the water").press("Enter");
		expect(await read(page, (s) => s.scene.water.rippleStrength)).toBe(0.2);
		await box(page, "Reflections on the water").fill("0");
		await box(page, "Reflections on the water").press("Enter");
		expect(await read(page, (s) => s.scene.water.reflectionStrength)).toBe(0);

		await act(page, (s) => s.selectArea("pond"));
		await page.getByRole("tab", { name: "Look" }).click();
		const own = box(page, "Ripples on the water");
		await expect(own).toHaveValue("20");
		await own.fill("0");
		await own.press("Enter");
		expect(await read(page, (s) => s.scene.areas[0].water.rippleStrength)).toBe(0);
	});
});

test.describe("textured surfaces (ADR-0137)", () => {
	test("off until turned on from an area, which follows its kind until it picks its own; kept after a reload", async ({
		page,
	}) => {
		await loadWorld(page, {
			areas: [
				{
					id: "square",
					kind: "plaza_01",
					points: [
						[-4, -4],
						[4, -4],
						[4, 4],
						[-4, 4],
					],
				},
			],
		});
		await act(page, (s) => s.selectArea("square"));
		await page.getByRole("tab", { name: "Look" }).click();
		// Off: shown greyed out, following its kind (a plaza's paving), with the way to turn them on.
		const texture = page.getByRole("combobox", { name: "Texture", exact: true });
		await expect(texture).toHaveText(/Paving/);
		await expect(texture).toBeDisabled();
		await page.getByRole("button", { name: "Turn on textured surfaces" }).click();
		expect(await read(page, (s) => s.scene.surface.enabled)).toBe(true);
		await choose(page, "Texture", "Cobbles");
		expect(await read(page, (s) => s.scene.areas[0].surface.kind)).toBe("cobbles_01");

		await worldTab(page, "World");
		await choose(page, "Texture", "Gravel");
		expect(await read(page, (s) => s.scene.ground.surface.kind)).toBe("gravel_01");

		await saved(page);
		await page.reload();
		await reopened(page);
		expect(
			await read(page, (s) => [
				s.scene.surface.enabled,
				s.scene.ground.surface.kind,
				s.scene.areas[0].surface.kind,
			]),
		).toEqual([true, "gravel_01", "cobbles_01"]);
	});
});

test.describe("Traffic (ADR-0022, ADR-0042)", () => {
	test("the side vehicles drive on, keeping distance and overtaking", async ({ page }) => {
		await worldTab(page, "Traffic");
		await choose(page, "Vehicles drive on the", "Left");
		expect(await read(page, (s) => s.scene.traffic.drivingSide)).toBe("left");
		const overtake = page.getByRole("switch", { name: "Overtake slower vehicles" });
		const before = await overtake.getAttribute("aria-checked");
		await overtake.click();
		expect(await overtake.getAttribute("aria-checked")).not.toBe(before);
	});
});

test.describe("Data (ADR-0010, ADR-0058)", () => {
	test("a value typed in the Data window opens on its own page, shows on a card, says what uses it, and asks before it's removed", async ({
		page,
	}) => {
		await loadWorld(page, {
			entities: [{ id: "depot", kind: "warehouse_01", name: "Depot", position: [0, 0] }],
		});
		await worldTab(page, "Data");
		await addData(page, "Type a number");
		await expect(dataWindow(page)).toContainText("Next: show it in the world");
		// Named, the made-up key becomes the name's; typed key by key, the field keeps its focus
		// though every key press renames the value.
		await box(page, "Name").fill("");
		await box(page, "Name").pressSequentially("Orders");
		await expect(box(page, "Name")).toHaveValue("Orders");
		await expect(box(page, "Key")).toHaveValue("orders");
		await box(page, "Value").fill("42");
		await act(page, (s) =>
			s.updateEntity("depot", (e) => {
				e.label = {
					isShown: true,
					title: "Depot",
					dataKeys: ["orders"],
					offset: [0, 2, 0],
					tag: "",
					showsAsChip: false,
				};
			}),
		);
		await box(page, "Value").fill("57");

		// A tile in View mode, and taken away again from the same card.
		await dataWindow(page)
			.getByRole("button", { name: /^Add it as a tile/ })
			.click();
		expect(await read(page, (s) => s.scene.onScreen.tileKeys)).toContain("orders");
		await dataWindow(page)
			.getByRole("button", { name: /^Remove it from the tiles/ })
			.click();
		expect(await read(page, (s) => s.scene.onScreen.tileKeys)).not.toContain("orders");

		// What uses it, and a way there; the card behind the window shows what was typed.
		await expect(dataWindow(page).getByRole("button", { name: /^Depot.*card/ })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dataWindow(page)).toBeHidden();
		await expect(labelCard(page, /Depot/)).toContainText("57");
		await page
			.getByRole("tabpanel", { name: "Data" })
			.getByRole("button", { name: /^Orders/ })
			.click();
		await page.getByRole("button", { name: "Remove value (unbinds 1)" }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
		expect((await entity(page, "depot"))?.label?.dataKeys).toEqual([]);
		// Back at the window's start.
		await expect(dataWindow(page)).not.toContainText("Orders");
	});

	test("a light can follow a data value (From data)", async ({ page }) => {
		await loadWorld(page, {
			entities: [{ id: "lamp", kind: "street_lamp_01", name: "Lamp", position: [0, 0] }],
		});
		await act(page, (s) => {
			s.upsertData({ key: "alert", name: "Alert", value: 1, unit: "" });
			s.select("lamp");
		});
		await page.getByRole("tab", { name: "Lights", exact: true }).click();
		await choose(page, "When", "From data");
		const lamp = (await entity(page, "lamp"))?.lights as Record<
			string,
			{ data: Record<string, { key: string }> }
		>;
		// It starts with the world's first value, to be changed in the fields below.
		expect(lamp.lamp.data.on.key).toBe(await read(page, (s) => s.scene.data.values[0].key));
	});

	test("a spreadsheet of a date and a name on each line is read as a table over time, its past in its Past panel (ADR-0153)", async ({
		page,
	}) => {
		// A file read through its dialog, then its page: slow in the tests' software-drawn browser.
		test.setTimeout(120_000);
		await openEditor(page);
		await worldTab(page, "Data");
		const dialog = page.getByRole("dialog", { name: /^Read a spreadsheet/ });
		const chooser = page.waitForEvent("filechooser");
		await addData(page, "A spreadsheet file…");
		await (await chooser).setFiles({
			name: "boroughs.csv",
			mimeType: "text/csv",
			buffer: Buffer.from(
				"month,borough,complaints\n2026-08,Bronx,64310\n2026-08,Brooklyn,103941\n2026-09,Bronx,59213\n2026-09,Brooklyn,105707\n2026-10,Bronx,65318\n2026-10,Brooklyn,113754\n",
			),
		});
		// Guessed from its shape, and said in the dialog.
		await expect(dialog.getByRole("combobox", { name: "Read it as" })).toContainText(
			"A table over time",
		);
		await expect(dialog).toContainText(
			/Adds a table of 2 rows and 2 columns, with its past on 3 dates from Aug 2026 to Oct 2026\./,
		);
		await dialog.getByRole("button", { name: /^Add \d/ }).click();
		expect(
			await read(page, (s) => {
				const table = s.scene.data.tables.find((t) => t.key === "boroughs");
				return { rows: table?.rows, dates: table?.history.map((moment) => moment.at) };
			}),
		).toEqual({
			rows: [
				{ borough: "Bronx", complaints: 65318 },
				{ borough: "Brooklyn", complaints: 113754 },
			],
			dates: ["2026-08", "2026-09", "2026-10"],
		});
		// Its page shows its past, a date's rows at a time.
		await expect(dataWindow(page)).toContainText("Its rows on 3 dates");
		await choose(page, "Rows on", /Aug/);
		await expect(dataWindow(page)).toContainText("64,310");
	});

	test("a spreadsheet is read as values over time or as a table, and read again into the same values (data study)", async ({
		page,
	}) => {
		// Four files read, each through its dialog.
		test.setTimeout(120_000);
		await openEditor(page);
		await worldTab(page, "Data");
		// Named: the toast saying what was read is a dialog too.
		const dialog = page.getByRole("dialog", { name: /^Read a spreadsheet/ });
		const readCsv = async (click: () => Promise<void>, name: string, text: string) => {
			const chooser = page.waitForEvent("filechooser");
			await click();
			await (await chooser).setFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text) });
		};
		const fromAddData = () => addData(page, "A spreadsheet file…");

		// Dates and numbers: a value with its past values, the latest its value now.
		await readCsv(fromAddData, "sent.csv", "day,sent\n2026-10-29,5\n2026-10-30,7\n");
		await expect(dialog).toContainText("Adds 1 value with 2 past values.");
		await dialog.getByRole("button", { name: /^Add \d/ }).click();
		expect(
			await read(page, (s) => s.scene.data.values.find((v) => v.key === "sent")),
		).toMatchObject({
			value: 7,
			history: [
				{ at: "2026-10-29", value: 5 },
				{ at: "2026-10-30", value: 7 },
			],
		});

		// Read again from a newer file: the same value, now up to date.
		// The window opened at what was added: its page reads its file again.
		await expect(dataWindow(page)).toContainText("Next: show it in the world");
		await readCsv(
			() => dataWindow(page).getByRole("button", { name: "Read it again…" }).click(),
			"sent.csv",
			"day,sent\n2026-10-30,7\n2026-10-31,9\n",
		);
		await dialog.getByRole("button", { name: "Read again" }).click();
		const fromFiles = await read(page, (s) =>
			s.scene.data.values.filter((v) => v.source !== null).map((v) => [v.key, v.value]),
		);
		expect(fromFiles).toEqual([["sent", 9]]);

		// Rows of things: a table, its rows named by club, to open and look at.
		await readCsv(fromAddData, "top-clubs.csv", "club,players,best_rank\nAPES,71,43\nOG,65,67\n");
		await expect(dialog).toContainText("Adds a table of 2 rows and 3 columns.");
		await dialog.getByRole("button", { name: /^Add \d/ }).click();
		expect(await read(page, (s) => s.scene.data.tables.map((t) => [t.key, t.keyColumn]))).toEqual([
			["top_clubs", "club"],
		]);
		// The window opens at the table: its rows, and what can show them.
		await expect(dataWindow(page)).toContainText("APES");
		await expect(
			dataWindow(page).getByRole("button", { name: /^Place one for each row/ }),
		).toBeVisible();

		// Excel, read by a reader loaded only now: a sheet picked, its dates read as dates.
		const chooser = page.waitForEvent("filechooser");
		await fromAddData();
		await (await chooser).setFiles("docs/data-study/samples/stats-two-sheets.xlsx");
		await expect(dialog).toContainText("Adds a table of 20 rows and 6 columns.");
		await choose(page, "Sheet", "Monthly");
		await expect(dialog).toContainText("Adds 1 value with 46 past values.");
	});
});

test.describe("weather (ADR-0102)", () => {
	test("a quick pick sets the weather and the clouds; an amount set by hand; clear again", async ({
		page,
	}) => {
		await worldTab(page, "Weather");
		await page.getByRole("button", { name: "Storm", exact: true }).click();
		expect(await read(page, (s) => s.scene.weather)).toMatchObject({
			rainAmount: 0.95,
			lightningRate: 0.6,
		});
		expect(await read(page, (s) => s.scene.weather.cloudCover)).toBe(1);

		await openPanel(page, "Rain and snow");
		await box(page, "Snow").fill("40");
		await box(page, "Snow").press("Enter");
		expect(await read(page, (s) => s.scene.weather.snowAmount)).toBe(0.4);

		await page.getByRole("button", { name: "Clear", exact: true }).click();
		expect(await read(page, (s) => s.scene.weather)).toMatchObject({
			rainAmount: 0,
			snowAmount: 0,
			lightningRate: 0,
		});
	});
});

test.describe("weather per area (ADR-0151)", () => {
	test("a hidden area gets its own weather, a copy of the world's to change, and gives it back", async ({
		page,
	}) => {
		await loadWorld(page, {
			areas: [
				{
					id: "park",
					kind: "hidden_area_01",
					points: [
						[-6, -6],
						[6, -6],
						[6, 6],
						[-6, 6],
					],
				},
			],
		});
		await act(page, (s) => s.selectArea("park"));
		// A hidden area has no look of its own, as a hidden route has none.
		await expect(page.getByRole("tab", { name: "Look", exact: true })).toHaveCount(0);
		await page.getByRole("tab", { name: "Area weather", exact: true }).click();
		const ownWeather = page.getByRole("switch", { name: "Has its own weather" });
		await expect(ownWeather).not.toBeChecked();
		await ownWeather.click();
		expect(await read(page, (s) => s.scene.areas[0].weather?.rainAmount)).toBe(0);

		// Its quick picks and amounts are the world's, for the area alone.
		await page.getByRole("button", { name: "Storm", exact: true }).click();
		expect(await read(page, (s) => s.scene.areas[0].weather)).toMatchObject({
			rainAmount: 0.95,
			lightningRate: 0.6,
			cloudCover: 1,
		});
		expect(await read(page, (s) => s.scene.weather.rainAmount)).toBe(0);
		await openPanel(page, "Fog and haze");
		await box(page, "Fog").fill("60");
		await box(page, "Fog").press("Enter");
		expect(await read(page, (s) => s.scene.areas[0].weather?.fogDensity)).toBe(0.6);

		await ownWeather.click();
		expect(await read(page, (s) => s.scene.areas[0].weather)).toBeNull();
	});
});
