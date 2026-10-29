#!/usr/bin/env node
/**
 * How fast the editor runs a world, and where the time goes (ADR-0092, PERFORMANCE.md). Opens the
 * editor, loads the world, then for each run sets the mode, graphics preset and view, waits for it
 * to settle and measures 4 s of frames: frame time (median, 90th percentile), the CPU and GPU time
 * of each frame's callbacks, and draw calls per frame. The GPU's time (WebGL timer queries) says
 * whether a run waits on the GPU: then the CPU's includes that wait, inside the draws.
 *
 *   node scripts/bench.mjs <world> [runs] [options]
 *
 * <world>: a world file (.json, as File → Save to file writes it) or a template id (brightwater,
 * lantern_bay, …). [runs]: comma-separated, each a mode and words (default edit,view-ultra):
 *   edit | view            the editor's mode
 *   standard|nice|ultra    the Graphics preset (default standard)
 *   close                  a close perspective view instead of the overview
 *   drag                   the first object selected and moved a little every frame, as a drag does
 *   hover                  the mouse moved across the view and back, over the objects, no button held
 *   pan                    a left-drag across the view and back from the sky above the ground: a pan
 *   e.g. edit-drag, view-ultra-close
 *
 * Options:
 *   --profile <run>   a CPU profile of that run: self time by function, the time of the app's own
 *                     functions (src/) including what they call, and who calls jsx
 *   --react           components that rendered again, by render time, and for the top-level ones
 *                     which hooks changed (React's own timings, through a stand-in DevTools hook)
 *   --passes          one frame's draws by framebuffer, in order (shadows, reflections, the view…)
 *   --base http://localhost:3000   the dev server (it must be running: pnpm dev)
 *
 * The GPU: on WSL, run it with Windows' node (node.exe scripts/bench.mjs …): it uses the installed
 * Chrome on the real GPU, without vsync, so frames aren't capped. With Linux's node it uses
 * Playwright's Chromium on SwiftShader, whose times mean nothing. The dev server runs React's
 * development build: absolute times are higher than a production build's, so compare runs with
 * each other, before and after a change.
 *
 * Each run also says what the page's main thread did besides the frames (script, restyling, layout,
 * and how many elements the page has): pointer events and style changes run outside the frame's
 * callbacks, so a run can stutter with fast frames. The mouse runs send moves faster than a real
 * mouse does (the browser lines those up with frames), so compare them with each other.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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

const args = process.argv.slice(2);
const option = (name) => {
	const at = args.indexOf(name);
	return at >= 0 ? args.splice(at, 2)[1] : undefined;
};
const flag = (name) => {
	const at = args.indexOf(name);
	return at >= 0 ? Boolean(args.splice(at, 1)) : false;
};
const base = option("--base") ?? "http://localhost:3000";
const profileRun = option("--profile");
const countRenders = flag("--react");
const showPasses = flag("--passes");
const [world, runList = "edit,view-ultra"] = args;
if (!world) {
	console.log(
		"node scripts/bench.mjs <world.json | template id> [runs] [--profile <run>] [--react] [--passes]",
	);
	process.exit(1);
}
const worldText = world.endsWith(".json") ? readFileSync(world, "utf8") : null;
const runs = runList.split(",");

/**
 * In the page, before the app: counts draw calls per animation frame (and per framebuffer when
 * asked), and times each frame's callbacks on the CPU.
 */
const instrument = () => {
	const stats = {
		draws: 0,
		frames: [],
		cpu: [],
		gpu: [],
		drawsPerFrame: [],
		passes: null,
		passList: null,
	};
	globalThis.__bench = stats;
	const proto = WebGL2RenderingContext.prototype;
	for (const name of [
		"drawArrays",
		"drawElements",
		"drawArraysInstanced",
		"drawElementsInstanced",
		"drawRangeElements",
	]) {
		const original = proto[name];
		proto[name] = function (...rest) {
			stats.draws += 1;
			return original.apply(this, rest);
		};
	}
	// BatchedMesh draws through WEBGL_multi_draw: one call, many shapes.
	const getExtension = proto.getExtension;
	proto.getExtension = function (name) {
		const extension = getExtension.call(this, name);
		if (extension && name === "WEBGL_multi_draw" && !extension.__counted) {
			extension.__counted = true;
			for (const fn of Object.keys(Object.getPrototypeOf(extension))) {
				if (fn.startsWith("multiDraw") && typeof extension[fn] === "function") {
					const original = extension[fn];
					extension[fn] = function (...rest) {
						stats.draws += 1;
						return original.apply(this, rest);
					};
				}
			}
		}
		return extension;
	};
	const bindFramebuffer = proto.bindFramebuffer;
	const framebufferIds = new Map();
	proto.bindFramebuffer = function (target, framebuffer) {
		if (
			Array.isArray(stats.passes) &&
			(target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER)
		) {
			if (framebuffer && !framebufferIds.has(framebuffer)) {
				framebufferIds.set(framebuffer, framebufferIds.size + 1);
			}
			stats.passes.push({
				fb: framebuffer ? framebufferIds.get(framebuffer) : 0,
				from: stats.draws,
			});
		}
		return bindFramebuffer.call(this, target, framebuffer);
	};
	const next = window.requestAnimationFrame.bind(window);
	let last = 0;
	const tick = (time) => {
		// "start": record the next whole frame's passes; an array: that frame is done.
		if (Array.isArray(stats.passes)) {
			const list = stats.passes;
			stats.passList = list
				.map((pass, i) => ({ fb: pass.fb, draws: (list[i + 1]?.from ?? stats.draws) - pass.from }))
				.filter((pass) => pass.draws > 0);
			stats.passes = null;
		} else if (stats.passes === "start") {
			stats.passes = [{ fb: -1, from: 0 }];
		}
		if (last) {
			stats.frames.push(time - last);
			stats.drawsPerFrame.push(stats.draws);
		}
		stats.draws = 0;
		last = time;
		next(tick);
	};
	next(tick);
	// The GPU's time for each frame's callbacks (they share its timestamp), added up as the queries
	// come back a frame or two later.
	let gl;
	let timer;
	const pending = [];
	const gpuFrames = new Map();
	const collect = () => {
		while (
			pending.length > 0 &&
			gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)
		) {
			const { query, time } = pending.shift();
			const frame = gpuFrames.get(time);
			frame.ms += gl.getParameter(timer.GPU_DISJOINT_EXT)
				? Number.NaN
				: gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
			frame.open -= 1;
			gl.deleteQuery(query);
		}
		for (const [time, frame] of gpuFrames) {
			if (frame.open === 0 && time < performance.now() - 100) {
				if (!Number.isNaN(frame.ms)) {
					stats.gpu.push(frame.ms);
				}
				gpuFrames.delete(time);
			}
		}
	};
	window.requestAnimationFrame = (callback) =>
		next((time) => {
			gl ??= document.querySelector("main canvas")?.getContext("webgl2") ?? undefined;
			timer ??= gl?.getExtension("EXT_disjoint_timer_query_webgl2") ?? undefined;
			const query = timer ? gl.createQuery() : null;
			if (query) {
				collect();
				const frame = gpuFrames.get(time) ?? { ms: 0, open: 0 };
				frame.open += 1;
				gpuFrames.set(time, frame);
				gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
			}
			const start = performance.now();
			try {
				callback(time);
			} finally {
				stats.cpu.push(performance.now() - start);
				if (query) {
					gl.endQuery(timer.TIME_ELAPSED_EXT);
					pending.push({ query, time });
				}
			}
		});
};

/**
 * In the page, before the app: a stand-in for React DevTools, so React times each component, and
 * every commit is tallied by component (what rendered again, not what mounted). For a few
 * top-level components, which hooks' state changed since their last render.
 */
const countReactRenders = () => {
	const tally = new Map();
	const why = new Map();
	globalThis.__reactTally = tally;
	globalThis.__reactWhy = why;
	const WATCHED = ["AppShell", "Viewport", "Toolbar", "Inspector", "Outliner", "Entities"];
	let renderers = 0;
	globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
		supportsFiber: true,
		renderers: new Map(),
		inject() {
			renderers += 1;
			return renderers;
		},
		checkDCE() {},
		onScheduleFiberRoot() {},
		onCommitFiberUnmount() {},
		onPostCommitFiberRoot() {},
		onCommitFiberRoot(_, root) {
			const since = root.__lastCommit ?? 0;
			root.__lastCommit = performance.now();
			if (!globalThis.__reactCounting) {
				return;
			}
			const stack = [root.current];
			while (stack.length) {
				const fiber = stack.pop();
				// Rendered in this commit: performed work, and started since the last one (fibers in
				// subtrees React skipped keep their old flags).
				if (
					fiber.alternate &&
					fiber.flags & 1 &&
					fiber.actualStartTime > since &&
					typeof fiber.type !== "string"
				) {
					const type = fiber.type;
					const name =
						type?.displayName || type?.name || type?.render?.name || type?.type?.name || "?";
					const entry = tally.get(name) ?? { renders: 0, ms: 0 };
					entry.renders += 1;
					entry.ms += fiber.selfBaseDuration ?? 0;
					tally.set(name, entry);
					if (WATCHED.includes(name)) {
						const changed = [];
						let now = fiber.memoizedState;
						let before = fiber.alternate.memoizedState;
						let i = 0;
						while (now && before) {
							const value = now.memoizedState;
							// Effects and memos are new objects every render: only state and store values.
							const isEffect = value && typeof value === "object" && "deps" in value;
							if (value !== before.memoizedState && !isEffect && !Array.isArray(value)) {
								changed.push(`hook ${i}`);
							}
							now = now.next;
							before = before.next;
							i += 1;
						}
						if (fiber.memoizedProps !== fiber.alternate.memoizedProps) {
							changed.push("props");
						}
						const key = `${name}: ${changed.join(", ") || "its parent rendered"}`;
						why.set(key, (why.get(key) ?? 0) + 1);
					}
				}
				if (fiber.sibling) {
					stack.push(fiber.sibling);
				}
				if (fiber.child) {
					stack.push(fiber.child);
				}
			}
		},
	};
};

const percentile = (values, p) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? Number.NaN;
};

const top = (map, count, format) =>
	[...map.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, count)
		.map(([key, ms]) => `    ${ms.toFixed(0).padStart(6)} ms  ${format ? format(key) : key}`)
		.join("\n");

/** Self time by function, inclusive time of the app's own (src/), and who calls jsx. */
const summarize = (profile) => {
	const byId = new Map(profile.nodes.map((node) => [node.id, node]));
	const parent = new Map();
	for (const node of profile.nodes) {
		for (const child of node.children ?? []) {
			parent.set(child, node.id);
		}
	}
	const deltas = profile.timeDeltas ?? [];
	const where = (frame) =>
		`${frame.functionName || "(anon)"} ${frame.url.split("/").slice(-2).join("/").split("?")[0]}:${frame.lineNumber}`;
	const self = new Map();
	const inclusive = new Map();
	const jsxCallers = new Map();
	profile.samples?.forEach((id, i) => {
		const ms = (deltas[i] ?? 0) / 1000;
		const frame = byId.get(id)?.callFrame;
		if (!frame) {
			return;
		}
		self.set(where(frame), (self.get(where(frame)) ?? 0) + ms);
		const seen = new Set();
		for (let at = id; at !== undefined; at = parent.get(at)) {
			const up = byId.get(at)?.callFrame;
			if (up?.url.includes("/src/")) {
				const key = where(up);
				if (!seen.has(key)) {
					seen.add(key);
					inclusive.set(key, (inclusive.get(key) ?? 0) + ms);
				}
			}
		}
		if (frame.functionName.includes("jsx")) {
			for (let at = parent.get(id); at !== undefined; at = parent.get(at)) {
				const up = byId.get(at)?.callFrame;
				if (
					up &&
					!/jsx|react_jsx|react-[A-Za-z0-9]+\.js|client-/.test(`${up.functionName} ${up.url}`)
				) {
					jsxCallers.set(where(up), (jsxCallers.get(where(up)) ?? 0) + ms);
					break;
				}
			}
		}
	});
	const total = [...self.values()].reduce((a, b) => a + b, 0);
	console.log(`  profile (${(total / 1000).toFixed(1)} s sampled), self time:\n${top(self, 20)}`);
	console.log(`  the app's functions, with what they call:\n${top(inclusive, 20)}`);
	console.log(`  who makes elements (jsx):\n${top(jsxCallers, 12)}`);
};

const { chromium } = await loadPlaywright();
const browser = onWindows
	? await chromium.launch({
			channel: "chrome",
			args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"],
		})
	: await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

for (const run of runs) {
	const words = run.split("-");
	const mode = words[0];
	const preset = words.find((word) => ["standard", "nice", "ultra"].includes(word)) ?? "standard";
	const close = words.includes("close");
	const dragging = words.includes("drag");
	const hovering = words.includes("hover");
	const panning = words.includes("pan");
	const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
	await context.addInitScript(
		({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
		{
			key: PREFERENCES_KEY,
			value: { graphicsPreset: preset },
		},
	);
	await context.addInitScript(instrument);
	if (countRenders) {
		await context.addInitScript(countReactRenders);
	}
	const page = await context.newPage();
	page.on("pageerror", (error) => console.log("  page error:", error.message.slice(0, 300)));
	await page.goto(base, { timeout: 120_000 });
	await page.waitForFunction(() => Boolean(globalThis.__editorStore), null, { timeout: 60_000 });
	await page.evaluate(
		async ({ text, template }) => {
			const store = globalThis.__editorStore.getState();
			if (text) {
				const { parseOrRepairScene } = await import("/src/scene/repair.ts");
				store.loadScene(parseOrRepairScene(JSON.parse(text)).scene);
				return;
			}
			const { TEMPLATES } = await import("/src/templates/index.ts");
			const found = TEMPLATES.find((each) => each.id === template);
			if (!found) {
				throw new Error(`No template ${template}`);
			}
			store.loadScene(found.create());
		},
		{ text: worldText, template: world },
	);
	await page.evaluate(
		({ mode, close }) => {
			const store = globalThis.__editorStore.getState();
			store.setMode(mode);
			store.showOpeningView(
				close
					? {
							target: [0, 0],
							targetHeight: 0,
							azimuth: 315,
							elevation: 22,
							span: 10,
							projection: "perspective",
							fieldOfView: 40,
						}
					: {
							target: [0, 0],
							targetHeight: 0,
							azimuth: 315,
							elevation: 32.47,
							span: 46,
							projection: "orthographic",
							fieldOfView: null,
						},
			);
		},
		{ mode, close },
	);
	// Settled: shaders compiled, the parts' pictures in Add to scene made.
	await page.waitForTimeout(8000);
	if (dragging) {
		await page.evaluate(() => {
			const store = globalThis.__editorStore;
			const first = store.getState().scene.entities[0];
			store.getState().select(first.id);
			const [x, z] = first.position;
			let t = 0;
			const step = () => {
				t += 1;
				store.getState().moveEntity(first.id, [x + Math.sin(t / 20), z], { coalesce: "bench" });
				requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		});
		await page.waitForTimeout(1000);
	}
	const cdp = run === profileRun ? await context.newCDPSession(page) : null;
	if (cdp) {
		await cdp.send("Profiler.enable");
		await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
		await cdp.send("Profiler.start");
	}
	await page.evaluate(() => {
		globalThis.__bench.frames.length = 0;
		globalThis.__bench.cpu.length = 0;
		globalThis.__bench.gpu.length = 0;
		globalThis.__bench.drawsPerFrame.length = 0;
		globalThis.__reactCounting = true;
	});
	const metrics = await context.newCDPSession(page);
	await metrics.send("Performance.enable");
	const mainThread = async () =>
		Object.fromEntries(
			(await metrics.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]),
		);
	const before = await mainThread();
	if (hovering || panning) {
		// Across the view and back for the whole run: over the objects, or (a pan) from the sky above
		// the ground, where a press grabs no object.
		const box = await page.locator("main canvas").first().boundingBox();
		const y = panning ? box.y + 140 : box.y + box.height * 0.55;
		const [left, right] = [box.x + box.width * 0.3, box.x + box.width * 0.7];
		await page.mouse.move(left, y);
		if (panning) {
			await page.mouse.down();
		}
		const until = Date.now() + 4000;
		for (let across = true; Date.now() < until; across = !across) {
			await page.mouse.move(across ? right : left, y + (across ? 60 : 0), { steps: 60 });
		}
		if (panning) {
			await page.mouse.up();
		}
	} else {
		await page.waitForTimeout(4000);
	}
	const after = await mainThread();
	const spent = (name) => `${((after[name] - before[name]) * 1000).toFixed(0)} ms`;
	const profile = cdp ? (await cdp.send("Profiler.stop")).profile : null;
	const stats = await page.evaluate(() => ({
		frames: globalThis.__bench.frames,
		cpu: globalThis.__bench.cpu,
		gpu: globalThis.__bench.gpu,
		draws: globalThis.__bench.drawsPerFrame,
		objects: globalThis.__editorStore.getState().scene.entities.length,
	}));
	const median = percentile(stats.frames, 0.5);
	console.log(
		`${run}: ${stats.objects} objects · frame ${median.toFixed(1)} ms median, ${percentile(stats.frames, 0.9).toFixed(1)} p90 (${(1000 / median).toFixed(0)} fps) · CPU in frame callbacks ${percentile(stats.cpu, 0.5).toFixed(2)} ms median, GPU ${stats.gpu.length > 0 ? `${percentile(stats.gpu, 0.5).toFixed(2)} ms` : "not timed"} · ${percentile(stats.draws, 0.5)} draws a frame`,
	);
	console.log(
		`  main thread in all: script ${spent("ScriptDuration")}, restyling ${spent("RecalcStyleDuration")} (${after.RecalcStyleCount - before.RecalcStyleCount}×), layout ${spent("LayoutDuration")} · ${after.Nodes} elements`,
	);
	if (countRenders) {
		const { tally, why } = await page.evaluate(() => ({
			tally: [...globalThis.__reactTally.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 25),
			why: [...globalThis.__reactWhy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
		}));
		console.log(
			`  components rendered again (4 s):\n${tally.map(([name, { renders, ms }]) => `    ${ms.toFixed(0).padStart(6)} ms ${String(renders).padStart(7)}×  ${name}`).join("\n")}`,
		);
		console.log(
			`  why:\n${why.map(([reason, n]) => `    ${String(n).padStart(6)}×  ${reason}`).join("\n")}`,
		);
	}
	if (showPasses) {
		await page.evaluate(() => {
			globalThis.__bench.passes = "start";
		});
		await page.waitForTimeout(500);
		const list = await page.evaluate(() => globalThis.__bench.passList);
		console.log(
			`  one frame's draws by framebuffer: ${(list ?? []).map((pass) => `#${pass.fb} ${pass.draws}`).join(" · ")}`,
		);
	}
	if (profile) {
		summarize(profile);
	}
	await context.close();
}
await browser.close();
