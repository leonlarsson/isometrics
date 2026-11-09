#!/usr/bin/env node
/**
 * The harness's screenshots as pictures for the report: the browser's and the app's bars
 * cropped off the top, as JPEG at full width.
 *
 *   node .claude/skills/ai-loop/pictures.mjs <out-dir> <name>=<png> [<name>=<png> …]
 *
 * Writes <out-dir>/<name>.jpg for each. Uses the repo's own sharp (no install).
 */
import { mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const store = join(ROOT, "node_modules", ".pnpm");
const dir = readdirSync(store).find((name) => name.startsWith("sharp@"));
if (!dir) {
	throw new Error("sharp not found under node_modules/.pnpm: pnpm install");
}
const sharpRoot = join(store, dir, "node_modules", "sharp");
const sharp = createRequire(join(sharpRoot, "package.json"))(sharpRoot);

/** The harness's page is 1600 × 1000; the preview banner and the app's two bars take the top 121. */
const TOP_BARS = 121;

const [out, ...pairs] = process.argv.slice(2);
if (!out || pairs.length === 0) {
	console.error("usage: pictures.mjs <out-dir> <name>=<png> …");
	process.exit(1);
}
mkdirSync(out, { recursive: true });
for (const pair of pairs) {
	const [name, png] = pair.split("=");
	const { width, height } = await sharp(png).metadata();
	await sharp(png)
		.extract({ left: 0, top: TOP_BARS, width, height: height - TOP_BARS })
		.jpeg({ quality: 84, mozjpeg: true })
		.toFile(join(out, `${name}.jpg`));
}
console.log(`${pairs.length} pictures in ${out}`);
