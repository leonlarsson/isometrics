import type { Page } from "@playwright/test";

import {
	act,
	entity,
	expect,
	groundSpot,
	keys,
	loadWorld,
	menuItem,
	openEditor,
	outlinerRow,
	read,
	showView,
	test,
} from "./editor";

/** A straight road and a parked car beside it, seen up close. */
const roadAndCar = async (page: Page) => {
	await loadWorld(page, {
		roads: [
			{
				id: "main",
				name: "Main street",
				style: "road_01",
				points: [
					[-12, 0, 0],
					[12, 0, 0],
				],
			},
		],
		entities: [{ id: "car", kind: "car_01", name: "Red car", position: [0, 6] }],
	});
	await showView(page, [0, 2], 34);
};

test.beforeEach(async ({ page }) => {
	await openEditor(page);
	await roadAndCar(page);
});

test.describe("vehicles on roads (ADR-0031, ADR-0040)", () => {
	test("right-click → Drive along a road makes it follow it; Park it stops", async ({ page }) => {
		await outlinerRow(page, "Red car").click({ button: "right" });
		await menuItem(page, "Drive along").click();
		await menuItem(page, "Main street").click();
		expect((await entity(page, "car"))?.follow?.roadId).toBe("main");
		await outlinerRow(page, "Red car").click({ button: "right" });
		await menuItem(page, "Drive along").click();
		await menuItem(page, "Park it").click();
		expect((await entity(page, "car"))?.follow).toBeNull();
	});

	test("moved onto a road, it's offered to drive along it", async ({ page }) => {
		await act(page, (s) => s.select("car"));
		const onRoad = await groundSpot(page, [3, 0]);
		const start = await groundSpot(page, [0, 6]);
		await page.mouse.move(start.x, start.y);
		await keys(page, "g");
		await page.mouse.move(onRoad.x, onRoad.y, { steps: 8 });
		await page.mouse.click(onRoad.x, onRoad.y);
		await expect(page.getByText("Drive along “Main street”?")).toBeVisible();
		await page.getByRole("button", { name: "Drive along", exact: true }).click();
		expect((await entity(page, "car"))?.follow?.roadId).toBe("main");
	});

	test("the Motion tab sets its speed and direction", async ({ page }) => {
		await act(page, (s) =>
			s.updateEntity("car", (e) => {
				e.follow = {
					roadId: "main",
					speed: 2,
					offset: 0,
					reverse: false,
					turnStyle: null,
					leansInTurns: null,
				};
			}),
		);
		await act(page, (s) => s.select("car"));
		await page.getByRole("tab", { name: "Motion", exact: true }).click();
		await page.getByRole("textbox", { name: "Speed", exact: true }).fill("5");
		await page.getByRole("textbox", { name: "Speed", exact: true }).press("Enter");
		await page.getByRole("switch", { name: "Drive the other way" }).click();
		const follow = (await entity(page, "car"))?.follow;
		expect(follow?.speed).toBe(5);
		expect(follow?.reverse).toBe(true);
	});

	test("the camera follows it, or rides along in perspective; Esc hands it back", async ({
		page,
	}) => {
		await act(page, (s) =>
			s.updateEntity("car", (e) => {
				e.follow = {
					roadId: "main",
					speed: 2,
					offset: 0,
					reverse: false,
					turnStyle: null,
					leansInTurns: null,
				};
			}),
		);
		await outlinerRow(page, "Red car").click({ button: "right" });
		await menuItem(page, "Follow with the camera").click();
		await expect(page.getByText("Following “Red car”")).toBeVisible();
		await keys(page, "Escape");
		expect(await read(page, (s) => s.cameraFollow)).toBeNull();

		await outlinerRow(page, "Red car").click({ button: "right" });
		await menuItem(page, "Ride along").click();
		expect(await read(page, (s) => s.projection)).toBe("perspective");
		await keys(page, "Escape");
		expect(await read(page, (s) => s.projection)).toBe("orthographic");
	});
});
