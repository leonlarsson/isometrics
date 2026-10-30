import { test as base, expect, type Page } from "@playwright/test";

import type { IEditorState, useEditor } from "#/editor/store";
import type { TArea, TEntity, TFence, TRoad, TViewPose } from "#/scene/schema";

/**
 * Shared helpers for the end-to-end tests (ADR-0069). Each test gets a fresh
 * browser context, so the app opens the starter world (Brightwater) in Edit
 * mode. The editor store is reached through `globalThis.__editorStore`, which
 * the dev server keeps there (editor/store.ts): set things up through it where
 * the UI isn't what's tested, and check results in it rather than in pixels.
 */

declare global {
	var __editorStore: typeof useEditor;
	/** Development only (render/PointerSpot): where a world point is on screen, the camera, draws. */
	var __editorView: {
		screenOf: (point: [number, number, number]) => { x: number; y: number };
		pose: () => TViewPose | null;
		/** Draw calls per frame (every render pass), averaged over `frames` frames. */
		drawCalls: (frames?: number) => Promise<number>;
	};
}

/** A test that fails when the page throws an uncaught error. */
export const test = base.extend<{ pageErrors: string[] }>({
	pageErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await use(errors);
			expect(errors, "uncaught errors in the page").toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };

/** Open the editor and wait until the world is drawn and the store is there. */
export const openEditor = async (page: Page, path = "/") => {
	await page.goto(path);
	await page.locator("canvas").waitFor();
	await page.waitForFunction(() => Boolean(globalThis.__editorStore));
	await worldShown(page);
	// The label cards are placed once the world has been drawn.
	await page.waitForTimeout(1500);
};

/** Until the loading screen has gone: the world is ready to look at (ADR-0100). */
export const worldShown = (page: Page) =>
	page.locator("[data-loading-screen]").waitFor({ state: "detached", timeout: 20_000 });

/** Read something from the editor's state. */
export const read = <T>(page: Page, pick: (state: IEditorState) => T) =>
	page.evaluate(`(${pick.toString()})(globalThis.__editorStore.getState())`) as Promise<T>;

/**
 * Run code with the editor's state (its actions), with an argument passed in.
 * The function runs in the page, so it can't use anything from the test's scope.
 */
export const act = <A>(page: Page, run: (state: IEditorState, arg: A) => void, arg?: A) =>
	page.evaluate(
		`(${run.toString()})(globalThis.__editorStore.getState(), ${JSON.stringify(arg) ?? "undefined"})`,
	);

/** One object, road or area by id. */
export const entity = (page: Page, id: string) =>
	page.evaluate(
		(id) => globalThis.__editorStore.getState().scene.entities.find((e) => e.id === id),
		id,
	);

export interface ITestWorld {
	entities?: Partial<TEntity>[];
	roads?: Partial<TRoad>[];
	areas?: Partial<TArea>[];
	fences?: Partial<TFence>[];
}

/**
 * Replace the world's objects, roads and areas with these (the ground, sky and
 * camera stay the starter's), as a freshly opened world. Missing fields get
 * their defaults through the scene schema.
 */
export const loadWorld = async (page: Page, world: ITestWorld) => {
	await page.evaluate((world) => {
		const state = globalThis.__editorStore.getState();
		const scene = structuredClone(state.scene);
		const template = { ...scene.entities[0] };
		scene.entities = (world.entities ?? []).map((e) => ({
			...template,
			name: "",
			altitude: 0,
			rotation: [0, 0, 0],
			scale: 1,
			props: {},
			colors: {},
			lights: {},
			label: { isShown: false, title: "", dataKeys: [], offset: [0, 2, 0] },
			details: { description: "", dataKeys: [] },
			follow: null,
			isHidden: false,
			isLocked: false,
			...e,
		})) as typeof scene.entities;
		const road = scene.roads[0];
		scene.roads = (world.roads ?? []).map((r) => ({
			...road,
			name: "",
			loops: false,
			colors: {},
			traffic: { drivingLane: "side", turnStyle: null, leansInTurns: null },
			isHidden: false,
			isLocked: false,
			...r,
		})) as typeof scene.roads;
		const area = scene.areas[0];
		scene.areas = (world.areas ?? []).map((a) => ({
			...area,
			name: "",
			height: 0,
			peaks: [],
			colors: {},
			water: { rippleStrength: null, reflectionStrength: null },
			isHidden: false,
			isLocked: false,
			...a,
		})) as typeof scene.areas;
		scene.fences = (world.fences ?? []).map((f) => ({
			name: "",
			kind: "picket_fence_01",
			loops: false,
			cornerRadius: 0,
			height: null,
			postSpacing: null,
			colors: {},
			builtShare: 1,
			data: {},
			isHidden: false,
			isLocked: false,
			...f,
			points: (f.points ?? []).map(([x, z, lift]) => [x, z, lift ?? 0]),
		})) as typeof scene.fences;
		state.loadScene(scene);
	}, world);
	await worldShown(page);
	await page.waitForTimeout(300);
};

/** The view's middle, on screen. */
export const viewCentre = async (page: Page) => {
	const box = await page.locator("canvas").boundingBox();
	if (!box) {
		throw new Error("no canvas");
	}
	return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};

/**
 * Where the camera is, once it has settled (moves with the keys ease out, glides take a while):
 * read from the live camera until two reads agree.
 */
export const cameraPose = async (page: Page) => {
	const readPose = () => page.evaluate(() => globalThis.__editorView.pose());
	let last = await readPose();
	for (let i = 0; i < 12; i++) {
		await page.waitForTimeout(400);
		const now = await readPose();
		if (now && JSON.stringify(now) === JSON.stringify(last)) {
			return now;
		}
		last = now;
	}
	return last;
};

/** Click with keys held (`page.mouse.click` ignores `modifiers`). */
export const clickWith = async (page: Page, keys: string[], x: number, y: number) => {
	for (const key of keys) {
		await page.keyboard.down(key);
	}
	await page.mouse.click(x, y);
	for (const key of keys.reverse()) {
		await page.keyboard.up(key);
	}
};

/**
 * Look at a spot from the default angle, `span` grid units seen top to bottom,
 * at once (like opening a world). Up close, a unit covers more pixels, so a
 * gizmo (always the same size on screen) doesn't reach the next object.
 */
export const showView = async (page: Page, target: [number, number], span: number) => {
	await page.evaluate(
		([target, span]) =>
			globalThis.__editorStore.getState().showOpeningView({
				target,
				targetAltitude: 0,
				azimuth: 315,
				elevation: 32.47,
				span,
				projection: "orthographic",
				fieldOfView: null,
			}),
		[target, span] as const,
	);
	await page.waitForTimeout(600);
};

/** Press keys one after another. */
export const keys = async (page: Page, ...presses: string[]) => {
	for (const press of presses) {
		await page.keyboard.press(press);
	}
};

/** The ids of the selected things, the active one last. */
export const selected = (page: Page) => read(page, (s) => s.selectedItems.map((item) => item.id));

/** The outliner pane, and one of its rows (buttons named after their items). */
export const outliner = (page: Page) => page.locator("[class*='outliner']").first();
export const outlinerRow = (page: Page, name: string) =>
	outliner(page).getByRole("button", { name, exact: true });

/** Pick an item from the File menu. */
export const fileMenu = async (page: Page, item: RegExp) => {
	await page.getByRole("button", { name: "File" }).click();
	await menuItem(page, item).click();
};

/** Wait until autosave has written the open world (the save status says Saved). */
export const saved = (page: Page) =>
	expect(page.getByRole("button", { name: /^Saved: more about saving/ })).toBeVisible();

/** Wait for the editor again after the page reloads. */
export const reopened = async (page: Page) => {
	await page.locator("canvas").waitFor();
	await page.waitForFunction(() => Boolean(globalThis.__editorStore));
};

/**
 * Where a point in the world ([x, height, z]) is on screen, from the camera as it is now. Use it to
 * click an object, a road point or an area corner exactly.
 */
export const screenOf = (page: Page, point: [number, number, number]) =>
	page.evaluate((point) => globalThis.__editorView.screenOf(point), point);

/** Where a ground spot ([x, z]) is on screen, a hair above the ground (handles float there). */
export const groundSpot = (page: Page, [x, z]: readonly number[], height = 0.1) =>
	screenOf(page, [x, height, z]);

/**
 * Where a transform gizmo's handle is on screen, for a gizmo at `centre` in a view of `span`
 * (showView): `offset` is in the gizmo's own units, 64 pixels each, e.g. [0, 0.8, 0] for the
 * middle of its green arrow, [0.35, 0, 0.35] for the square on the ground.
 */
export const gizmoSpot = async (
	page: Page,
	centre: [number, number, number],
	offset: [number, number, number],
	span: number,
) => {
	const box = await page.locator("canvas").boundingBox();
	const units = (64 * span) / (box?.height ?? 800);
	return screenOf(page, [
		centre[0] + offset[0] * units,
		centre[1] + offset[1] * units,
		centre[2] + offset[2] * units,
	]);
};

/** Press, drag by [dx, dy] pixels in steps, and let go. */
export const dragBy = async (
	page: Page,
	from: { x: number; y: number },
	dx: number,
	dy: number,
) => {
	await page.mouse.move(from.x, from.y, { steps: 2 });
	await page.mouse.down();
	await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 5 });
	await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 });
	await page.mouse.up();
};

/** A menu item of any kind (plain, with a check, or a radio choice) by its text. */
export const menuItem = (page: Page, name: string | RegExp) =>
	page
		.locator("[role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio']")
		.filter({ hasText: name })
		.first();

/** Open a menu by its button's name and pick an item. */
export const pickFromMenu = async (page: Page, button: string, item: string | RegExp) => {
	await page.getByRole("button", { name: button, exact: true }).click();
	await menuItem(page, item).click();
};

/**
 * A tile in Add to scene, after choosing its category chip ("Roads", "Areas",
 * "Vehicles"…): the panel shows one category at a time (ADR-0088).
 */
export const paletteTile = async (page: Page, category: string, name: string) => {
	const palette = page.getByRole("navigation", { name: "Parts" });
	await palette.getByRole("button", { name: category, exact: true }).click();
	return palette.getByRole("button", { name, exact: true }).first();
};

/** Unfold a panel (a Section with an id) if it's folded. */
export const openPanel = async (page: Page, title: string | RegExp) => {
	const header = page
		.getByRole("button", { name: title })
		.and(page.locator("[aria-expanded]"))
		.first();
	if ((await header.getAttribute("aria-expanded")) === "false") {
		await header.click();
	}
};

/** Pick an option in a select field, by the field's label. */
export const choose = async (page: Page, label: string, option: string | RegExp) => {
	await page.getByRole("combobox", { name: label, exact: true }).click();
	await page.getByRole("option", { name: option }).click();
};

/** Hold a key, or a combination like "Shift+ArrowLeft", for a while (camera moves run while held). */
export const hold = async (page: Page, combo: string, ms = 500) => {
	const parts = combo.split("+");
	for (const key of parts) {
		await page.keyboard.down(key);
	}
	await page.waitForTimeout(ms);
	for (const key of parts.reverse()) {
		await page.keyboard.up(key);
	}
};

/** A label card over the world (a button in the label layer), by its title. */
export const labelCard = (page: Page, title: string | RegExp) =>
	page.locator("[data-label-layer]").getByRole("button", { name: title }).first();
