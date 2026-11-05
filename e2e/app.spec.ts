import { expect, fileMenu, openEditor, read, reopened, saved, test } from "./editor";

/** A world's storage keys, as editor/persistence keeps them. */
const plantWorld = ([id, raw]: [string, string]) => {
	localStorage.setItem(`isometrics:world:${id}`, raw);
	localStorage.setItem(
		"isometrics:world-index",
		JSON.stringify([{ id, title: "Planted", updatedAt: Date.now() }]),
	);
	localStorage.setItem("isometrics:open-world-id", id);
};

test.describe("opening and saving (ADR-0006, ADR-0020, ADR-0026, ADR-0057)", () => {
	test("opens the starter world, drawn, with its label cards", async ({ page }) => {
		await openEditor(page);
		await expect(page.getByText("Brightwater").first()).toBeVisible();
		await expect(page.getByRole("button", { name: /Parcels today/ })).toBeVisible();
		expect(await read(page, (s) => s.scene.entities.length)).toBeGreaterThan(20);
		expect(await read(page, (s) => s.mode)).toBe("edit");
	});

	test("a change saves in the browser and is there after a reload", async ({ page }) => {
		await openEditor(page);
		await page.getByLabel("Title").first().fill("Test town");
		await saved(page);
		await page.reload();
		await reopened(page);
		expect(await read(page, (s) => s.scene.meta.title)).toBe("Test town");
		await expect(page.getByText("Test town").first()).toBeVisible();
	});

	test("a saved world this version can't read is kept as a backup, and the user is told", async ({
		page,
	}) => {
		await page.addInitScript(plantWorld, ["broken", "{ this is not a world"] as [string, string]);
		await openEditor(page);
		await expect(page.getByRole("alert")).toContainText("couldn’t be opened by this version");
		await page.getByRole("button", { name: "Dismiss" }).click();
		await fileMenu(page, /Backups/);
		await expect(page.getByRole("dialog", { name: "Backups" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Restore as a new world" })).toBeVisible();
	});

	test("a saved world with a broken field is repaired, with the original kept", async ({
		page,
	}) => {
		const world = {
			version: 1,
			meta: { title: "Half broken" },
			entities: [
				{ id: "ok", kind: "house_01", position: [0, 0] },
				{ id: "bad", kind: "house_01", position: "here" },
			],
		};
		await page.addInitScript(plantWorld, ["half", JSON.stringify(world)] as [string, string]);
		await openEditor(page);
		await expect(page.getByRole("alert")).toContainText("was repaired");
		expect(await read(page, (s) => s.scene.meta.title)).toBe("Half broken");
		// The broken field falls back to its default; the object stays.
		expect(await read(page, (s) => s.scene.entities.map((e) => [e.id, e.position]))).toEqual([
			["ok", [0, 0]],
			["bad", [0, 0]],
		]);
	});
});

test.describe("browsers that can't do everything (ADR-0145)", () => {
	test("without WebGL, a screen says how to draw 3D, never the crash screen", async ({ page }) => {
		await page.addInitScript(() => {
			const getContext = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function (
				this: HTMLCanvasElement,
				kind: string,
				...rest: unknown[]
			) {
				return kind.startsWith("webgl") || kind === "experimental-webgl"
					? null
					: (getContext as (...args: unknown[]) => unknown).call(this, kind, ...rest);
			} as typeof getContext;
		});
		await page.goto("/");
		const screen = page.getByRole("alert");
		await expect(screen).toContainText("Your browser can’t draw 3D here");
		await expect(screen).toContainText("hardware acceleration");
		await expect(screen.getByRole("link", { name: "the guide" })).toHaveAttribute("href", "/guide");
		await expect(screen.getByRole("link", { name: "the parts" })).toHaveAttribute("href", "/parts");
		await expect(page.getByText("Something went wrong")).toHaveCount(0);
		await expect(page.locator("canvas")).toHaveCount(0);
	});

	test("with site data blocked, the app opens and says nothing will be saved", async ({ page }) => {
		await page.addInitScript(() => {
			for (const name of ["localStorage", "sessionStorage"]) {
				Object.defineProperty(window, name, {
					configurable: true,
					get() {
						throw new DOMException("The operation is insecure.", "SecurityError");
					},
				});
			}
		});
		await openEditor(page);
		await expect(page.getByText("Nothing will be saved in this browser")).toBeVisible();
		await expect(page.getByText("Something went wrong")).toHaveCount(0);
		await expect(page.getByRole("button", { name: /^Not saved: more about saving/ })).toBeVisible();
	});
});

test.describe("the world format for people and AIs (ADR-0032, ADR-0034)", () => {
	test("/api/worlds/schema describes the world, with every part kind", async ({ request }) => {
		const schema = await (await request.get("/api/worlds/schema")).json();
		expect(schema.title).toBe("Isometrics world");
		const kinds = schema.properties.entities.items.properties.kind.oneOf.map(
			(option: { const: string }) => option.const,
		);
		expect(kinds).toEqual(expect.arrayContaining(["house_01", "office_tower_01", "car_01"]));
	});

	test("pages can't be framed by other sites, and answers aren't sniffed (ADR-0119)", async ({
		request,
	}) => {
		const page = await request.get("/guide");
		expect(page.headers()["x-frame-options"]).toBe("DENY");
		expect(page.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
		expect(page.headers()["x-content-type-options"]).toBe("nosniff");
		const schema = await request.get("/api/worlds/schema");
		expect(schema.headers()["x-content-type-options"]).toBe("nosniff");
	});

	test("/api/worlds/templates lists the starter worlds, each one valid to open", async ({
		request,
	}) => {
		const { templates } = await (await request.get("/api/worlds/templates")).json();
		expect(templates.length).toBeGreaterThan(1);
		const first = await (await request.get(templates[0].url)).json();
		expect(first.version).toBe(1);
		expect(first.entities.length).toBeGreaterThan(0);
	});
});
