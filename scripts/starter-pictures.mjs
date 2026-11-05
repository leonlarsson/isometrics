#!/usr/bin/env node
/**
 * The built-in worlds' pictures, made ahead of time (ADR-0146): every
 * starter's and the Blank card's at each ground size, in both themes, for the
 * welcome's and File → New world's cards, and each starter's link preview
 * (`og:image` on /templates/<id>). Each is rendered from the world itself, by
 * the same code that draws a picture live (`renderScenePictures`,
 * src/render/scenePictures.tsx), and saved in public/starters/:
 *
 *   <id>-light.webp, <id>-dark.webp   a card's picture: 480 × 300 (240 × 150 at 2×), transparent
 *   <id>-preview.jpg                  a starter's link preview: 1200 × 630, on the light background
 *
 * Make them again after changing a starter (or adding one: `pnpm test` says which are missing):
 *
 *   node.exe scripts/starter-pictures.mjs    on WSL: Windows' node, so Chrome draws on the real GPU
 *   node scripts/starter-pictures.mjs        elsewhere (on WSL with Linux's node it draws on
 *                                            SwiftShader: the same pictures, only slower)
 *
 * Options:
 *   --only brightwater,blank-city   only these pictures (ids from src/templates/pictures.ts)
 *   --base http://localhost:3000    the dev server (it must be running: pnpm dev)
 *   --browser /path/to/chromium     a Chromium of its own, when Playwright's isn't installed
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "public", "starters");
const onWindows = process.platform === "win32";

/** Playwright, also from Windows' node on a WSL checkout, which can't follow pnpm's links. */
const loadPlaywright = async () => {
	try {
		return await import("playwright-core");
	} catch {
		const store = join(ROOT, "node_modules", ".pnpm");
		const dir = readdirSync(store).find((name) => name.startsWith("playwright-core@"));
		if (!dir) {
			throw new Error("playwright-core not found: pnpm install");
		}
		return import(
			pathToFileURL(join(store, dir, "node_modules", "playwright-core", "index.mjs")).href
		);
	}
};

const optionOf = (name) =>
	process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : null;
const base = optionOf("base") ?? "http://localhost:3000";
const only = optionOf("only")?.split(",") ?? null;
const executablePath = optionOf("browser") ?? undefined;

const { chromium } = await loadPlaywright();
const browser = onWindows
	? await chromium.launch({ channel: "chrome" })
	: await chromium.launch({
			executablePath,
			args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
		});
const errors = [];

/** A fresh page of the app's (the guide: it draws no world of its own), light for the previews. */
const openPage = async () => {
	const page = await browser.newPage({ colorScheme: "light" });
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(`${base}/guide`, { timeout: 120_000 });
	return page;
};

/**
 * One picture of a world, as a data URL: a card's for a theme ("light", "dark"), or a starter's
 * link preview ("preview").
 */
const pictureOf = (page, id, which) =>
	page.evaluate(
		async ({ id, which }) => {
			const { CARD_PICTURE_FORMAT, renderScenePictures } = await import(
				"/src/render/scenePictures.tsx"
			);
			const { STARTER_PICTURE_SOURCES } = await import("/src/templates/pictures.ts");
			const source = STARTER_PICTURE_SOURCES.find((each) => each.id === id);
			if (which !== "preview") {
				// The cards' size, as WebP with its transparency.
				const pictures = await renderScenePictures([source], which, {
					...CARD_PICTURE_FORMAT,
					type: "image/webp",
					quality: 0.9,
				});
				return pictures[id];
			}
			// A starter's link preview: on the light background (--bg), as most previews show on white.
			const size = { width: 1200, height: 630 };
			const previews = await renderScenePictures([source], "light", {
				size,
				dpr: 1,
				type: "image/png",
			});
			const image = new Image();
			image.src = previews[id];
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = size.width;
			canvas.height = size.height;
			const context = canvas.getContext("2d");
			const background = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
			context.fillStyle = background || "#ffffff";
			context.fillRect(0, 0, size.width, size.height);
			context.drawImage(image, 0, 0);
			return canvas.toDataURL("image/jpeg", 0.88);
		},
		{ id, which },
	);

const lister = await openPage();
const pictures = (
	await lister.evaluate(async () => {
		const { STARTER_PICTURE_SOURCES } = await import("/src/templates/pictures.ts");
		const { templateById } = await import("/src/templates/index.ts");
		return STARTER_PICTURE_SOURCES.map((each) => ({
			id: each.id,
			isStarter: Boolean(templateById(each.id)),
		}));
	})
)
	.filter(({ id }) => !only || only.includes(id))
	.flatMap(({ id, isStarter }) => [
		{ id, which: "light", name: `${id}-light.webp` },
		{ id, which: "dark", name: `${id}-dark.webp` },
		...(isStarter ? [{ id, which: "preview", name: `${id}-preview.jpg` }] : []),
	]);
await lister.close();

mkdirSync(OUT, { recursive: true });
// A page for each picture, so a big world's memory is let go before the next.
for (const { id, which, name } of pictures) {
	const page = await openPage();
	const url = await pictureOf(page, id, which);
	const bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
	writeFileSync(join(OUT, name), bytes);
	console.log(`public/starters/${name}: ${Math.round(bytes.length / 1024)} KB`);
	await page.close();
}
if (errors.length > 0) {
	console.log(`Page errors:\n${[...new Set(errors)].slice(0, 8).join("\n")}`);
}
await browser.close();
