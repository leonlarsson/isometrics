#!/usr/bin/env node
/**
 * The README's gallery: the templates at their best (Ultra), each picture a
 * run of scripts/shots.mjs, saved as JPEGs in docs/gallery/. Retake them all
 * after a change to the look:
 *
 *   node.exe scripts/gallery.mjs     on WSL: Windows' node, so Chrome draws on the real GPU
 *   node scripts/gallery.mjs         elsewhere (on WSL with Linux's node it draws on SwiftShader:
 *                                    right, but not the GPU the pictures are meant for)
 *
 * The dev server must be running (pnpm dev); --base <url> for another. A picture's file is
 * <name>-<view>-<hour>.jpg, so the README's links stay the same while the list does.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SHOTS = fileURLToPath(new URL("./shots.mjs", import.meta.url));
const OUT = fileURLToPath(new URL("../docs/gallery", import.meta.url));

/** Each picture: a name, then shots.mjs options (a view, a time or mood, the cards). */
const PICTURES = [
	["lantern-bay", "--template", "lantern_bay", "--views", "view_bay", "--mood", "mood_golden"],
	["lantern-bay", "--template", "lantern_bay", "--views", "view_promenade", "--mood", "mood_night"],
	["lantern-bay", "--template", "lantern_bay", "--views", "view_basin", "--mood", "mood_blue"],
	["lantern-bay", "--template", "lantern_bay", "--views", "view_lighthouse", "--mood", "mood_night"],
	["lantern-bay", "--template", "lantern_bay", "--views", "view_lanes", "--mood", "mood_golden"],
	[
		"lantern-bay-cards",
		"--template",
		"lantern_bay",
		"--views",
		"view_overview",
		"--mood",
		"mood_golden",
		"--with-cards",
	],
	["brightwater-cards", "--views", "view_overview", "--hours", "world", "--with-cards"],
	["brightwater", "--views", "view_downtown", "--hours", "17.8"],
	["brightwater", "--views", "view_old_town", "--hours", "17.8"],
	["brightwater", "--views", "view_farmland", "--hours", "15"],
	// At night on the dark theme: Brightwater has no sky, and its lights glow brighter on dark.
	["brightwater-dark", "--views", "view_overview", "--hours", "22", "--world", "theme=dark"],
];

const base = process.argv.includes("--base")
	? ["--base", process.argv[process.argv.indexOf("--base") + 1]]
	: [];
for (const [name, ...options] of PICTURES) {
	// Moods bring their own time; the rest say theirs.
	const hours =
		options.includes("--hours") || !options.includes("--mood") ? [] : ["--hours", "world"];
	const run = spawnSync(
		process.execPath,
		[
			SHOTS,
			name,
			...options,
			...hours,
			...["--graphics", "ultra", "--jpg", "--out", OUT, "--frames", "10"],
			...base,
		],
		{ stdio: "inherit" },
	);
	if (run.status !== 0) {
		process.exit(run.status ?? 1);
	}
}
