// Render lab screenshots (docs/rendering-study): opens the editor on the starter world in View mode,
// sets the time of day, jumps to a view, and saves the canvas with an average frame time.
//
//   node scripts/render-lab/shoot.mjs <name> "<query>" [hours…]
//   e.g. node scripts/render-lab/shoot.mjs ultra "fx=key,ao,bloom,lamps,soft,grade,tilt,smaa" 12 18.6 22
//
// Environment:
//   BASE     the dev server (default http://localhost:3000; a LAB_WEBGPU=1 server on another port)
//   VIEWS    comma-separated viewpoint ids, "close" (a close-up of downtown) or "none" (the opening
//            view); default "close"
//   WAIT     ms to let a frame settle after setting the time (default 2500; the path tracer needs more)
//   SAMPLES  with ?fx=pt: wait until the path tracer has this many samples
//   CHROME   a Chromium executable, when Playwright's own build isn't installed
//   OUT      where the pictures go (default scripts/render-lab/shots/, which git ignores)
//
// Frame times come from whatever GPU the browser has; with SwiftShader (software) only ratios mean
// anything, and only roughly.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [name, query = "", ...hourArgs] = process.argv.slice(2);
if (!name) {
	console.error('Usage: node scripts/render-lab/shoot.mjs <name> "<query>" [hours…]');
	process.exit(1);
}
const hours = hourArgs.length > 0 ? hourArgs.map(Number) : [12, 18.6, 22];
const base = process.env.BASE ?? "http://localhost:3000";
const views = (process.env.VIEWS ?? "close").split(",");
const out = process.env.OUT ?? new URL("./shots/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

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

const browser = await chromium.launch({
	executablePath: process.env.CHROME,
	args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-unsafe-webgpu"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
	if (message.type() === "error") {
		errors.push(message.text());
	}
});

await page.goto(`${base}/${query ? `?${query}` : ""}`, { timeout: 180_000 });
await page.locator("canvas").first().waitFor({ timeout: 60_000 });
await page.waitForFunction(() => Boolean(globalThis.__editorStore), null, { timeout: 60_000 });
await page.evaluate(() => globalThis.__editorStore.getState().setMode("view"));
// Only the 3D view: no title, cards or bars over it.
await page.addStyleTag({
	content: "body * { visibility: hidden !important } canvas { visibility: visible !important }",
});
// A WebGPU renderer starts asynchronously; a camera jump sent before it's ready is lost.
await page.waitForTimeout(4000);

for (const view of views) {
	if (view !== "none") {
		await page.evaluate(
			({ id, close }) => {
				const store = globalThis.__editorStore;
				const pose =
					id === "close" ? close : store.getState().scene.viewpoints.find((v) => v.id === id);
				store.setState({ flight: { pose, nonce: Date.now(), instant: true } });
			},
			{ id: view, close: CLOSE },
		);
	}
	for (const hour of hours) {
		await page.evaluate((hour) => {
			globalThis.__editorStore.getState().commit((scene) => {
				scene.lighting.time = hour;
				scene.lighting.timeSource = "fixed";
			});
		}, hour);
		await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
		if (process.env.SAMPLES) {
			await page.waitForFunction(
				(samples) => (globalThis.__ptSamples ?? 0) >= samples,
				Number(process.env.SAMPLES),
				{ timeout: 900_000, polling: 2000 },
			);
		}
		const msPerFrame = await page.evaluate(
			() =>
				new Promise((resolve) => {
					const stamps = [];
					const tick = (time) => {
						stamps.push(time);
						if (stamps.length < 20) {
							requestAnimationFrame(tick);
						} else {
							resolve((stamps.at(-1) - stamps[0]) / (stamps.length - 1));
						}
					};
					requestAnimationFrame(tick);
				}),
		);
		const samples = await page.evaluate(() => globalThis.__ptSamples);
		const file = `${out}${name}-${view.replace("view_", "")}-${hour}.png`;
		await page.locator("canvas").first().screenshot({ path: file });
		console.log(
			`${file}: ${msPerFrame.toFixed(0)} ms/frame${samples === undefined ? "" : `, ${samples.toFixed(0)} samples`}`,
		);
	}
}

if (errors.length > 0) {
	console.log(`Page errors:\n${[...new Set(errors)].slice(0, 8).join("\n")}`);
}
await browser.close();
