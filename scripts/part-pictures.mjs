#!/usr/bin/env node
/**
 * Add to scene's pictures, made ahead of time (ADR-0150): every part's and
 * fence style's tile, in both themes, rendered by the same code that draws
 * them live (`renderAddToScenePictures`, src/render/thumbnails.tsx) and saved
 * in public/part-pictures/:
 *
 *   <kind>-light.webp, <kind>-dark.webp                 a part's: 224 × 168 (112 × 84 at 2×), transparent
 *   fence-<style>-light.webp, fence-<style>-dark.webp   a fence style's
 *
 * and in src/render/partPictures.json, for each picture the source file it was
 * made from and that file's hash, so `pnpm test` says which part changed since
 * its pictures were made (or has none yet). Make them again after adding or
 * changing a part or a fence style:
 *
 *   node.exe scripts/part-pictures.mjs                  on WSL: Windows' node, so Chrome draws on the real GPU
 *   node.exe scripts/part-pictures.mjs --only house_01,fence:hedge_01
 *   node scripts/part-pictures.mjs                      elsewhere (on WSL with Linux's node it draws on
 *                                                       SwiftShader: the same pictures, only slower)
 *
 * Options:
 *   --only <keys>                   only these pictures: parts' kinds, fences' fence:<style>
 *   --base http://localhost:3000    the dev server (it must be running: pnpm dev)
 *   --browser /path/to/chromium     a Chromium of its own, when Playwright's isn't installed
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "public", "part-pictures");
const MANIFEST = join(ROOT, "src", "render", "partPictures.json");
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

/** Every file in a folder and the folders in it. */
const filesIn = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)],
	);

/**
 * Each picture's source file: the part file defining its kind (`definePart({ kind: "…" })`), or the
 * fence style's (`defineFenceStyle({ id: "…" })`), by picture key, as a path from the repository.
 */
const sources = new Map();
for (const file of filesIn(join(ROOT, "src", "parts")).filter((f) => f.endsWith(".tsx"))) {
	for (const [, kind] of readFileSync(file, "utf8").matchAll(/definePart\(\{\s*kind: "([^"]+)"/g)) {
		sources.set(kind, file);
	}
}
for (const file of filesIn(join(ROOT, "src", "fences")).filter((f) => f.endsWith(".ts"))) {
	for (const [, id] of readFileSync(file, "utf8").matchAll(
		/defineFenceStyle\(\{\s*id: "([^"]+)"/g,
	)) {
		sources.set(`fence:${id}`, file);
	}
}

/** A source file's hash, as src/render/partPictures.test.ts works it out (line endings aside). */
const hashOf = (file) =>
	createHash("sha256")
		.update(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))
		.digest("hex")
		.slice(0, 16);

const { chromium } = await loadPlaywright();
const browser = onWindows
	? await chromium.launch({ channel: "chrome" })
	: await chromium.launch({
			executablePath,
			args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
		});
const errors = [];
const page = await browser.newPage({ colorScheme: "light" });
page.on("pageerror", (error) => errors.push(error.message));
// The guide: a page of the app's that draws no world of its own.
await page.goto(`${base}/guide`, { timeout: 120_000 });

/**
 * Runs code in the page, again once it has loaded if it reloads meanwhile (the dev server reloads a
 * page when importing the renderer makes it prepare packages it hadn't).
 */
const inPage = async (code, arg) => {
	for (let tries = 0; ; tries++) {
		try {
			return await page.evaluate(code, arg);
		} catch (error) {
			if (tries >= 3 || !String(error).includes("context was destroyed")) {
				throw error;
			}
			await page.waitForLoadState("load");
		}
	}
};

const keys = await inPage(async () => {
	const { ADD_TO_SCENE_PICTURES } = await import("/src/render/thumbnails.tsx");
	return ADD_TO_SCENE_PICTURES;
});
const unknown = (only ?? []).filter((key) => !keys.includes(key));
if (unknown.length > 0) {
	throw new Error(`No such pictures: ${unknown.join(", ")} (parts' kinds, or fence:<style>)`);
}
const wanted = only ?? keys;
const missingSources = wanted.filter((key) => !sources.has(key));
if (missingSources.length > 0) {
	throw new Error(`No source file found for ${missingSources.join(", ")}`);
}

mkdirSync(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
for (const theme of ["light", "dark"]) {
	// Drawn as PNG, saved as WebP with its transparency (as the starters' pictures are, ADR-0146).
	const pictures = await inPage(
		async ({ theme, wanted }) => {
			const { renderAddToScenePictures } = await import("/src/render/thumbnails.tsx");
			const drawn = await renderAddToScenePictures(theme, wanted);
			const asWebp = async (url) => {
				const image = new Image();
				image.src = url;
				await image.decode();
				const canvas = document.createElement("canvas");
				canvas.width = image.naturalWidth;
				canvas.height = image.naturalHeight;
				canvas.getContext("2d").drawImage(image, 0, 0);
				return canvas.toDataURL("image/webp", 0.9);
			};
			return Object.fromEntries(
				await Promise.all(
					Object.entries(drawn).map(async ([key, url]) => [key, await asWebp(url)]),
				),
			);
		},
		{ theme, wanted },
	);
	for (const key of wanted) {
		const url = pictures[key];
		if (!url) {
			throw new Error(`${key}: no picture was drawn`);
		}
		const name = `${key.replace(":", "-")}-${theme}.webp`;
		writeFileSync(join(OUT, name), Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
	}
	console.log(`${theme}: ${wanted.length} pictures`);
}
for (const key of wanted) {
	const file = sources.get(key);
	manifest[key] = `${relative(ROOT, file).replaceAll("\\", "/")}#${hashOf(file)}`;
}
// Only what Add to scene has, in its order, one a line (as Biome formats it).
const kept = Object.fromEntries(
	keys.filter((key) => manifest[key]).map((key) => [key, manifest[key]]),
);
writeFileSync(MANIFEST, `${JSON.stringify(kept, null, "\t")}\n`);
await browser.close();
if (errors.length > 0) {
	console.log(`page errors:\n${errors.join("\n")}`);
	process.exit(1);
}
console.log(`${Object.keys(kept).length} pictures in src/render/partPictures.json`);
