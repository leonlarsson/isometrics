import type { Page } from "@playwright/test";

import {
	act,
	cameraPose,
	choose,
	expect,
	hold,
	keys,
	menuItem,
	openEditor,
	openPanel,
	pickFromMenu,
	read,
	reopened,
	saved,
	test,
	viewCentre,
} from "./editor";

const overView = async (page: Page) => {
	const { x, y } = await viewCentre(page);
	await page.mouse.move(x, y + 150);
};

const cameraMenu = (page: Page, item: RegExp) => pickFromMenu(page, "Camera", item);

test.beforeEach(async ({ page }) => {
	await openEditor(page);
	await overView(page);
});

test.describe("projections and angles (ADR-0004, ADR-0038)", () => {
	test("P and the camera menu switch between the diorama and perspective", async ({ page }) => {
		expect(await read(page, (s) => s.projection)).toBe("orthographic");
		await keys(page, "p");
		expect(await read(page, (s) => s.projection)).toBe("perspective");
		await expect(page.getByText(/^Perspective/).last()).toBeVisible();
		// The menu stays open while its choices are flipped.
		await cameraMenu(page, /^Isometric diorama/);
		expect(await read(page, (s) => s.projection)).toBe("orthographic");
		await menuItem(page, /^Perspective/).click();
		expect(await read(page, (s) => s.projection)).toBe("perspective");
	});

	test("a focal length from the camera menu sets the world's lens", async ({ page }) => {
		await keys(page, "p");
		await page.getByRole("button", { name: "Camera", exact: true }).click();
		await menuItem(page, /^Focal length/).click();
		await menuItem(page, "85 mm").click();
		expect(await read(page, (s) => s.scene.camera.fieldOfView)).not.toBeNull();
	});

	test("a world that keeps the isometric angle turns a quarter at a time and doesn't tilt", async ({
		page,
	}) => {
		await act(page, (s) =>
			s.commit((scene) => {
				scene.camera.keepsIsometricAngle = true;
			}),
		);
		const start = await cameraPose(page);
		const diagonal = (azimuth: number) => (((azimuth - 45) % 90) + 90) % 90;
		expect(diagonal(start?.azimuth ?? 1)).toBeCloseTo(0, 0);
		expect(start?.elevation).toBeCloseTo(35.26, 1);

		await keys(page, "Shift+ArrowLeft");
		const turned = await cameraPose(page);
		const by = ((((turned?.azimuth ?? 0) - (start?.azimuth ?? 0)) % 360) + 360) % 360;
		expect(by).toBeCloseTo(90, 0);

		await keys(page, "Shift+ArrowUp");
		expect((await cameraPose(page))?.elevation).toBeCloseTo(35.26, 1);
	});

	test("I turns to a true isometric angle; Home goes back to the opening view", async ({
		page,
	}) => {
		await hold(page, "Shift+ArrowLeft", 400);
		// Let the turn ease out first, or it carries on over the glide.
		await cameraPose(page);
		await keys(page, "i");
		const pose = await cameraPose(page);
		expect(pose?.azimuth ? pose.azimuth % 90 : 0).toBeCloseTo(45, 0);
		await hold(page, "ArrowUp", 600);
		await keys(page, "Home");
		const home = await cameraPose(page);
		expect(Math.abs(home?.target[0] ?? 99)).toBeLessThan(1);
	});
});

test.describe("moving the camera (ADR-0028, ADR-0037, ADR-0062)", () => {
	test("with nothing selected, the arrows pan and + / − zoom", async ({ page }) => {
		const start = await cameraPose(page);
		await hold(page, "ArrowRight");
		const panned = await cameraPose(page);
		expect(panned?.target).not.toEqual(start?.target);
		await hold(page, "=");
		const zoomed = await cameraPose(page);
		expect(zoomed?.span).toBeLessThan(panned?.span ?? 0);
	});

	test("W A S D fly in View mode, and in Edit mode while the right button is held", async ({
		page,
	}) => {
		const start = await cameraPose(page);
		await hold(page, "w");
		expect((await cameraPose(page))?.target).toEqual(start?.target);

		await page.mouse.down({ button: "right" });
		await hold(page, "w");
		await page.mouse.up({ button: "right" });
		await keys(page, "Escape");
		const flown = await cameraPose(page);
		expect(flown?.target).not.toEqual(start?.target);

		await page.getByRole("button", { name: "View", exact: true }).click();
		await overView(page);
		await hold(page, "d");
		expect((await cameraPose(page))?.target).not.toEqual(flown?.target);
	});

	test("the compass turns the view to look from a side", async ({ page }) => {
		await page.getByRole("button", { name: "Look north" }).click();
		const pose = await cameraPose(page);
		// The camera goes to the opposite side to look that way: looking north it stands south (270).
		expect(pose?.azimuth).toBeCloseTo(270, 0);
		await page.getByRole("button", { name: "Look west" }).click();
		expect((await cameraPose(page))?.azimuth).toBeCloseTo(0, 0);
	});

	test("the camera is where it was after a reload", async ({ page }) => {
		await hold(page, "ArrowRight", 700);
		const moved = await cameraPose(page);
		await page.getByLabel("Title").first().fill("Remembered");
		await saved(page);
		await page.reload();
		await reopened(page);
		const after = await cameraPose(page);
		expect(after?.target[0]).toBeCloseTo(moved?.target[0] ?? 0, 0);
	});
});

test.describe("viewpoints (ADR-0039)", () => {
	test("Views → Save the current view adds one; its number key goes back to it", async ({
		page,
	}) => {
		// The starter world has viewpoints of its own; the new one comes last.
		const before = await read(page, (s) => s.scene.viewpoints.length);
		await pickFromMenu(page, "Viewpoints", "Save the current view");
		expect(await read(page, (s) => s.scene.viewpoints.length)).toBe(before + 1);
		await hold(page, "ArrowRight", 700);
		await keys(page, String(before + 1));
		expect(await read(page, (s) => s.activeViewpointId)).toBe(
			await read(page, (s) => s.scene.viewpoints.at(-1)?.id),
		);
	});

	test("View mode steps through the viewpoints with its bar", async ({ page }) => {
		await act(page, (s) => {
			s.addViewpoint({
				target: [0, 0],
				targetHeight: 0,
				azimuth: 315,
				elevation: 32,
				span: 40,
				projection: "orthographic",
				fieldOfView: null,
			});
			s.addViewpoint({
				target: [10, 10],
				targetHeight: 0,
				azimuth: 45,
				elevation: 40,
				span: 30,
				projection: "orthographic",
				fieldOfView: null,
			});
		});
		await page.getByRole("button", { name: "View", exact: true }).click();
		// The bar keeps its width while stepping (as wide as the widest viewpoint's text).
		const bar = page.getByRole("status").filter({ has: page.getByLabel("Next viewpoint (→)") });
		const width = async () => (await bar.boundingBox())?.width;
		const before = await width();
		await page.getByRole("button", { name: "Next viewpoint (→)" }).click();
		const first = await read(page, (s) => s.activeViewpointId);
		expect(await width()).toBe(before);
		await page.getByRole("button", { name: "Next viewpoint (→)" }).click();
		expect(await read(page, (s) => s.activeViewpointId)).not.toBe(first);
		expect(await width()).toBe(before);
		await page.getByRole("button", { name: "Previous viewpoint (←)" }).click();
		expect(await read(page, (s) => s.activeViewpointId)).toBe(first);
	});

	test("Manage viewpoints opens the Viewpoints tab, where one can be deleted", async ({ page }) => {
		const before = await read(page, (s) => s.scene.viewpoints.length);
		await pickFromMenu(page, "Viewpoints", /Manage viewpoints/);
		await expect(page.getByRole("tab", { name: "Viewpoints", selected: true })).toBeVisible();
		await page
			.getByRole("button", { name: /^Delete “/ })
			.first()
			.click();
		expect(await read(page, (s) => s.scene.viewpoints.length)).toBe(before - 1);
	});
});

test.describe("the Camera tab (ADR-0062)", () => {
	test("Camera settings… opens it; the turntable and tilt-shift switch on", async ({ page }) => {
		await cameraMenu(page, /Camera settings/);
		await expect(page.getByRole("tab", { name: "Camera", selected: true })).toBeVisible();
		await openPanel(page, "Turntable");
		await page.getByRole("switch", { name: "Circle the view in View mode" }).click();
		expect(await read(page, (s) => s.scene.camera.turntableOn)).toBe(true);
		await openPanel(page, "Tilt-shift");
		await page.getByRole("switch", { name: "Miniature blur in View mode" }).click();
		expect(await read(page, (s) => s.scene.camera.tiltShiftOn)).toBe(true);
	});

	test("the opening projection can be perspective", async ({ page }) => {
		await cameraMenu(page, /Camera settings/);
		await choose(page, "Opening projection", "Perspective");
		expect(await read(page, (s) => s.scene.camera.openingProjection)).toBe("perspective");
	});
});
