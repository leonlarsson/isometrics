import type { Page } from "@playwright/test";

import {
	act,
	choose,
	entity,
	expect,
	labelCard,
	loadWorld,
	menuItem,
	openEditor,
	openPanel,
	read,
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
	test("a value added in the Data tab shows on a label card, and follows edits", async ({
		page,
	}) => {
		await loadWorld(page, {
			entities: [{ id: "depot", kind: "warehouse_01", name: "Depot", position: [0, 0] }],
		});
		await worldTab(page, "Data");
		await page.getByRole("button", { name: "Add", exact: true }).click();
		const key = await read(page, (s) => s.scene.data.at(-1)?.key ?? "");
		await page.getByRole("textbox", { name: "Name" }).last().fill("Orders");
		await page.getByRole("textbox", { name: "Value" }).last().fill("42");
		await page.getByRole("textbox", { name: "Value" }).last().press("Tab");
		await act(
			page,
			(s, key) =>
				s.updateEntity("depot", (e) => {
					e.label = { isShown: true, title: "Depot", dataKeys: [key], offset: [0, 2, 0] };
				}),
			key,
		);
		const card = labelCard(page, /Depot/);
		await expect(card).toContainText("42");
		await page.getByRole("textbox", { name: "Value" }).last().fill("57");
		await page.getByRole("textbox", { name: "Value" }).last().press("Tab");
		await expect(card).toContainText("57");

		await page.getByRole("button", { name: "Remove value" }).last().click();
		expect((await entity(page, "depot"))?.label?.dataKeys).toEqual([]);
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
		expect(lamp.lamp.data.on.key).toBe(await read(page, (s) => s.scene.data[0].key));
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
