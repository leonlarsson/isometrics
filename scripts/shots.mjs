#!/usr/bin/env node
/**
 * Pictures of the 3D view and how long the GPU takes per frame, for judging
 * the look and cost of a change (graphics settings, ADR-0072). Opens the
 * editor on the starter world (Brightwater) in View mode, sets graphics
 * preferences and world settings, then for each view and time of day saves
 * the canvas and measures GPU time (WebGL timer queries, after a warm-up).
 *
 *   node scripts/shots.mjs <name> [options]       pictures, as shots/<name>-<view>-<hour>.png
 *   node scripts/shots.mjs sheet <out> <shot>…    a contact sheet of earlier shots, 2 per row
 *
 * Options:
 *   --graphics standard|nice|ultra   the Graphics preset (default standard)
 *   --pref key=value                 a preference, e.g. --pref ambientOcclusion=off (repeatable)
 *   --world path=value               a world setting, e.g. --world lighting.sunShadeContrast=0.75,
 *                                    --world theme=dark, --world camera.tiltShiftOn=true (repeatable)
 *   --hours 12,18.6,22               times of day (default 12,18.6,22); "world" keeps the world's own
 *                                    (or the mood's), stopped there
 *   --mood mood_golden               a mood of the world's put on first (its look: light, sky, water,
 *                                    tilt-shift; ADR-0078)
 *   --views close,view_overview      "close" (downtown in perspective), "none" (the opening view)
 *                                    or viewpoint ids (default close)
 *   --pose '{"target":[0,0],…}'       a camera of its own (a viewpoint's fields), shot as the view "pose"
 *   --size 1600x1000@1               the page's size in CSS px, @ device pixels per px
 *   --template lantern_bay           a starter world other than Brightwater (its id, from /templates.json)
 *   --mode view|edit                 the editor's mode (default view); --select <id> selects a thing
 *   --frames 120                     frames to time per shot; --no-shots to only time them
 *   --with-cards                     the stage as View mode shows it: the title and label cards over
 *                                    the view (not the viewpoint bar), not just the canvas
 *   --jpg                            JPEG pictures (quality 90) instead of PNG
 *   --out docs/gallery               the folder for the pictures (default shots/)
 *   --base http://localhost:3000     the dev server (it must be running: pnpm dev)
 *
 * The GPU: on WSL, run it with Windows' node (node.exe scripts/shots.mjs …): it uses the installed
 * Chrome, headless, on the real GPU (WebGL and WebGPU). With Linux's node it uses Playwright's
 * Chromium on SwiftShader (software): the pictures are right, the times mean nothing.
 */
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "shots");
const onWindows = process.platform === "win32";
/** Where the app keeps preferences (editor/preferences), from APP_NAME (src/lib/app.ts). */
const PREFERENCES_KEY = `${readFileSync(join(ROOT, "src/lib/app.ts"), "utf8")
	.match(/APP_NAME = "([^"]+)"/)[1]
	.toLowerCase()}:preferences`;

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

const launch = async () => {
	const { chromium } = await loadPlaywright();
	return onWindows
		? chromium.launch({
				channel: "chrome",
				args: ["--enable-unsafe-webgpu", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
			})
		: chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
};

const [command, ...rest] = process.argv.slice(2);
if (!command) {
	console.error("Usage: node scripts/shots.mjs <name> [options] | sheet <out> <shot>…");
	process.exit(1);
}

/** A contact sheet: the shots side by side, two per row, each labelled. */
const sheet = async (out, shots) => {
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 1920, height: 400 } });
	const cells = shots
		.map((shot) => {
			const data = readFileSync(join(OUT, `${shot}.png`)).toString("base64");
			return `<figure><img src="data:image/png;base64,${data}"><figcaption>${shot}</figcaption></figure>`;
		})
		.join("");
	await page.setContent(
		`<style>body{margin:0;background:#fff;font:600 20px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:4px;width:1920px}figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;left:0;top:0;background:#000c;color:#fff;padding:4px 10px}</style><main>${cells}</main>`,
	);
	await page.waitForFunction(() => [...document.images].every((image) => image.complete));
	await page.locator("main").screenshot({ path: out, type: out.endsWith(".png") ? "png" : "jpeg" });
	await browser.close();
	console.log(out);
};

if (command === "sheet") {
	const [out, ...shots] = rest;
	await sheet(out, shots);
	process.exit(0);
}

/** Options that are on when given, with no value after them. */
const SWITCHES = ["no-shots", "with-cards", "jpg"];
const options = { pref: [], world: [] };
for (let i = 0; i < rest.length; i++) {
	const flag = rest[i].replace(/^--/, "");
	if (SWITCHES.includes(flag)) {
		options[flag] = true;
	} else if (flag === "pref" || flag === "world") {
		options[flag].push(rest[++i]);
	} else {
		options[flag] = rest[++i];
	}
}

/** "true", "0.75" and "null" as what they say; anything else as text. */
const parsedValue = (text) => {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};
const pairsOf = (list) =>
	list.map((pair) => {
		const at = pair.indexOf("=");
		return [pair.slice(0, at), parsedValue(pair.slice(at + 1))];
	});

const preferences = {
	graphicsPreset: options.graphics ?? "standard",
	...Object.fromEntries(pairsOf(options.pref)),
};
const world = [
	// The cards and title, without the viewpoint bar's ◀ ▶ over the world; or no cards, so their
	// pins (dots in the 3D view) go too.
	...(options["with-cards"]
		? [["onScreen.showViewpointBar", false]]
		: [["onScreen.showLabelCards", false]]),
	...pairsOf(options.world),
];
const hours =
	options.hours === "world" ? ["world"] : (options.hours ?? "12,18.6,22").split(",").map(Number);
const shotsDir = options.out ? resolve(options.out) : OUT;
const extension = options.jpg ? "jpg" : "png";
const views = options.pose ? ["pose"] : (options.views ?? "close").split(",");
const [, width, height, scale] = (options.size ?? "1600x1000@1").match(
	/^(\d+)x(\d+)(?:@([\d.]+))?$/,
);
const frames = Number(options.frames ?? 120);
const base = options.base ?? "http://localhost:3000";

/** A close-up of downtown's towers, in perspective. */
const CLOSE = {
	id: "close",
	target: [-4, -2],
	targetHeight: 0,
	azimuth: 315,
	elevation: 30,
	span: 15,
	projection: "perspective",
	fieldOfView: 35,
};

/**
 * Wraps every animation-frame callback in a GPU timer query on the view's WebGL 2 context, and adds
 * up a frame's callbacks (they share its timestamp): R3F's drawing is one of several.
 */
const timeFrames = () => {
	const timing = { on: false, gpu: [], pending: [], frames: new Map() };
	globalThis.__shotTiming = timing;
	const nextFrame = window.requestAnimationFrame.bind(window);
	let gl;
	let ext;
	/** Adds up the queries that have come back; a frame with all of its back counts. */
	const collect = () => {
		for (const entry of [...timing.pending]) {
			if (gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) {
				const ms = gl.getParameter(ext.GPU_DISJOINT_EXT)
					? Number.NaN
					: gl.getQueryParameter(entry.query, gl.QUERY_RESULT) / 1e6;
				const frame = timing.frames.get(entry.time);
				if (frame) {
					frame.ms += ms;
					frame.open -= 1;
				}
				gl.deleteQuery(entry.query);
				timing.pending.splice(timing.pending.indexOf(entry), 1);
			}
		}
		for (const [time, frame] of timing.frames) {
			if (frame.open === 0 && time < performance.now() - 100) {
				if (!Number.isNaN(frame.ms)) {
					timing.gpu.push(frame.ms);
				}
				timing.frames.delete(time);
			}
		}
	};
	window.requestAnimationFrame = (callback) =>
		nextFrame((time) => {
			gl ??= document.querySelector("main canvas")?.getContext("webgl2") ?? undefined;
			ext ??= gl?.getExtension("EXT_disjoint_timer_query_webgl2") ?? undefined;
			if (!timing.on || !ext) {
				callback(time);
				return;
			}
			collect();
			const frame = timing.frames.get(time) ?? { ms: 0, open: 0 };
			frame.open += 1;
			timing.frames.set(time, frame);
			const query = gl.createQuery();
			gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
			try {
				callback(time);
			} finally {
				gl.endQuery(ext.TIME_ELAPSED_EXT);
				timing.pending.push({ query, time });
			}
		});
};

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

mkdirSync(shotsDir, { recursive: true });
const browser = await launch();
const context = await browser.newContext({
	viewport: { width: Number(width), height: Number(height) },
	deviceScaleFactor: Number(scale ?? 1),
});
await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
	key: PREFERENCES_KEY,
	value: preferences,
});
await context.addInitScript(timeFrames);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
	if (message.type() === "error") {
		errors.push(message.text());
	}
});

const reportErrors = () => {
	if (errors.length > 0) {
		console.log(`Page errors:\n${[...new Set(errors)].slice(0, 8).join("\n")}`);
	}
};
process.on("exit", reportErrors);

await page.goto(base, { timeout: 120_000 });
await page.waitForFunction(() => Boolean(globalThis.__editorStore), null, { timeout: 60_000 });
if (options.template) {
	await page.evaluate(async (id) => {
		// Never from the browser's cache: shots are for seeing a template just changed.
		const scene = await (await fetch(`/templates/${id}.json`, { cache: "no-store" })).json();
		globalThis.__editorStore.getState().loadScene(scene);
	}, options.template);
}
await page.evaluate(
	({ world, mode, select, mood }) => {
		const store = globalThis.__editorStore.getState();
		store.setMode(mode);
		if (select) {
			store.select(select);
		}
		if (mood) {
			if (!store.scene.moods.some((m) => m.id === mood)) {
				throw new Error(`No mood ${mood} in this world`);
			}
			store.putOnMood(mood);
		}
		globalThis.__editorStore.getState().commit((scene) => {
			for (const [path, value] of world) {
				const keys = path.split(".");
				const last = keys.pop();
				keys.reduce((object, key) => object[key], scene)[last] = value;
			}
		});
	},
	{ world, mode: options.mode ?? "view", select: options.select, mood: options.mood },
);
// Only the 3D view: no title, cards or bars over it. With the cards: the stage, as View mode shows it.
if (!options["with-cards"]) {
	await page.addStyleTag({
		content: "body * { visibility: hidden !important } canvas { visibility: visible !important }",
	});
}
await page.waitForTimeout(3000);

for (const view of views) {
	if (view !== "none") {
		await page.evaluate(
			({ id, close, own }) => {
				const store = globalThis.__editorStore;
				const pose =
					id === "close"
						? close
						: id === "pose"
							? { id, targetHeight: 0, ...own }
							: store.getState().scene.viewpoints.find((v) => v.id === id);
				store.setState({ flight: { pose, nonce: Date.now(), instant: true } });
			},
			{ id: view, close: CLOSE, own: options.pose ? JSON.parse(options.pose) : null },
		);
	}
	for (const hour of hours) {
		// The world's own time ("world"), or the one asked for; either way stopped there.
		const time = await page.evaluate((hour) => {
			globalThis.__editorStore.getState().commit((scene) => {
				if (hour !== "world") {
					scene.lighting.time = hour;
				}
				scene.lighting.timeSource = "fixed";
			});
			return globalThis.__editorStore.getState().scene.lighting.time;
		}, hour);
		// Let the frame settle and the GPU clock up before timing.
		await page.waitForTimeout(2500);
		await page.evaluate(() =>
			Object.assign(globalThis.__shotTiming, { on: true, gpu: [], frames: new Map() }),
		);
		await page.waitForFunction((n) => globalThis.__shotTiming.gpu.length >= n, frames, {
			timeout: 120_000,
			polling: 200,
		});
		const gpu = await page.evaluate(() => {
			globalThis.__shotTiming.on = false;
			return globalThis.__shotTiming.gpu;
		});
		// A world without a clock (classic daylight) has no time: "daylight".
		const shot = `${command}-${view.replace("view_", "")}-${time ?? "daylight"}`;
		if (!options["no-shots"]) {
			await page
				.locator(options["with-cards"] ? "main" : "canvas")
				.first()
				.screenshot({
					path: join(shotsDir, `${shot}.${extension}`),
					...(options.jpg ? { type: "jpeg", quality: 90 } : {}),
				});
		}
		console.log(`${shot}: ${median(gpu).toFixed(2)} ms GPU per frame (median of ${gpu.length})`);
	}
}
if (!onWindows) {
	console.log("(SwiftShader: software rendering, so the times mean nothing; see the header.)");
}
await browser.close();
