import {
	act,
	buildWithAiMenu,
	expect,
	fileMenu,
	loadWorld,
	openEditor,
	read,
	test,
} from "./editor";

test.describe("worlds shared by link (ADR-0120)", () => {
	test("Share a link makes a public link only when asked, and the link opens a copy elsewhere", async ({
		page,
		browser,
	}) => {
		// Two editors load in it, one per browser.
		test.slow();
		await openEditor(page);
		await loadWorld(page, {
			entities: [{ id: "h", kind: "house_01", name: "Shared house", position: [0, 0] }],
		});
		await act(page, (s) =>
			s.commit((d) => {
				d.meta.title = "Shared world";
			}),
		);
		// The save status, where saving is managed, offers it too.
		await page.getByRole("button", { name: /^Saved: more about saving/ }).click();
		await page.getByRole("menuitem", { name: /^Share a link/ }).click();
		const dialog = page.getByRole("dialog", { name: "Share a link" });
		await expect(dialog).toContainText("anyone with the link");
		await dialog.getByRole("button", { name: "Create a public link" }).click();
		const link = (await dialog.locator("p").filter({ hasText: "/w/" }).textContent()) ?? "";
		expect(link).toMatch(/\/w\/[A-Za-z0-9_-]{22}$/);

		// Someone else opens it: a copy, next to their worlds.
		const other = await browser.newContext();
		const theirs = await other.newPage();
		await openEditor(theirs, new URL(link).pathname);
		await expect.poll(() => read(theirs, (s) => s.scene.meta.title)).toBe("Shared world");
		expect(await read(theirs, (s) => s.scene.entities.map((e) => e.name))).toContain(
			"Shared house",
		);
		expect(await theirs.evaluate(() => window.location.pathname)).toBe("/");
		await other.close();

		// Stop sharing: the link is gone.
		await dialog.getByRole("button", { name: "Stop sharing", exact: true }).click();
		const id = link.split("/w/")[1];
		await expect
			.poll(async () => (await page.request.get(`/api/user-worlds/${id}`)).status())
			.toBe(404);

		// The File menu has it too.
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await fileMenu(page, /Share a link/);
		await expect(dialog).toBeVisible();
	});

	test("a shared world that reads from outside says so before it's opened", async ({ page }) => {
		const response = await page.request.post("/api/user-worlds?expiresIn=3600", {
			data: {
				version: 1,
				meta: { title: "Reads outside" },
				data: { sources: [{ id: "s", kind: "api", url: "https://example.org/x.json" }] },
			},
		});
		expect(response.status()).toBe(201);
		const { url } = await response.json();
		await openEditor(page, new URL(url).pathname);
		const asking = page.getByRole("alertdialog", { name: "This world reads data from outside" });
		await expect(asking).toContainText("https://example.org/x.json");
		// Not loaded yet: the starter world is still open.
		expect(await read(page, (s) => s.scene.meta.title)).not.toBe("Reads outside");
		await asking.getByRole("button", { name: "Don't open it" }).click();
		expect(await read(page, (s) => s.scene.meta.title)).not.toBe("Reads outside");
	});

	test("a template opens by its address, and an AI's answer can be a link", async ({ page }) => {
		await openEditor(page, "/templates/monaco");
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toMatch(/Monaco/);

		// An AI that posted its world answers with the link; the dialog reads it from this site.
		const response = await page.request.post("/api/user-worlds", {
			data: { version: 1, meta: { title: "From an AI" } },
		});
		const { url } = await response.json();
		await buildWithAiMenu(page, /A new world/);
		const dialog = page.getByRole("dialog", { name: "Build with your AI" });
		await dialog.getByRole("textbox", { name: "Its answer" }).fill(url);
		await expect(dialog).toContainText("It opens as written");
		await dialog.getByRole("button", { name: "Open it", exact: true }).click();
		await expect.poll(() => read(page, (s) => s.scene.meta.title)).toBe("From an AI");
	});
});
