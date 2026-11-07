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
 * lantern-bay, …). [runs]: comma-separated, each a mode and words (default edit,view-ultra):
 *   edit | view            the editor's mode
 *   standard|nice|ultra    the Graphics preset (default standard)
 *   close                  a close perspective view instead of the overview
 *   drag                   the first object selected and moved a little every frame, as a drag does
 *   hover                  the mouse moved across the view and back, over the objects, no button held
 *   pan                    a left-drag across the view and back from the sky above the ground: a pan
 *   orbit                  the camera circling the view's centre steadily, as the turntable does
 *   fresh                  measured from the moment the world is loaded, not after it settled: what
 *                          opening it costs (its loading screen, then the first seconds after it)
 *   select                 another object selected every half second, as clicking round the world does
 *                          (its gizmo, the properties and the outliner follow)
 *   opening                the world's own opening viewpoint (and its mood, a running day) instead
 *                          of the overview
 *   tour                   View mode's tour through the viewpoints (and their moods), from the first
 *   e.g. edit-drag, view-ultra-close, view-opening-orbit
 *
 * Options:
 *   --profile <run>   a CPU profile of that run: self time by function, the time of the app's own
 *                     functions (src/) including what they call, and who calls jsx
 *   --react           components that rendered again, by render time, and for the top-level ones
 *                     which hooks changed (React's own timings, through a stand-in DevTools hook)
 *   --save <file>     each run's frame times (ms, in order), frame callbacks' CPU times and draws
 *                     as JSON, by run, for charts and comparing runs
 *   --why <names>     with --react: say which hooks or props changed for these components too
 *                     (comma-separated names, as the list of components shows them)
 *   --passes          one frame's draws by framebuffer, in order (shadows, reflections, the view…)
 *   --seconds <n>     how long each run measures (default 4); hitches can be seconds apart
 *   --settle <n>      seconds to wait after loading before measuring (default 8): Add to scene's
 *                     pictures are taken in the first minute or so, on the same GPU
 *   --vsync           frames at the screen's refresh rate, as people see them, instead of as fast as
 *                     they come: for hitches, where the frame rate shapes what's spread over frames
 *                     and what the GPU has queued (uncapped, every wait on it looks longer); it also
 *                     counts the frames that missed a refresh (over twice the median frame)
 *   --trace <run>     a Chrome trace of that run: every long frame's main-thread work by kind
 *                     (script, garbage collection, style, layout, compiling shaders, uploads…) and
 *                     the app's functions sampled in them; the trace is saved next to the shots
 *   --base http://localhost:3000   the dev server (it must be running: pnpm dev)
 *
 * The GPU: on WSL, run it with Windows' node (node.exe scripts/bench.mjs …): it uses the installed
 * Chrome on the real GPU, without vsync, so frames aren't capped. With Linux's node it uses
 * Playwright's Chromium on SwiftShader, whose times mean nothing. The dev server runs React's
 * development build: absolute times are higher than a production build's, so compare runs with
 * each other, before and after a change.
 *
 * Hitches: a run says its 99th percentile and worst frame, and how many frames took over 50 ms
 * (a visible stutter at any frame rate). A smooth median with hitches is what a viewer feels as
 * jank: look at them with --trace.
 *
 * Each run also says what the page's main thread did besides the frames (script, restyling, layout,
 * and how many elements the page has): pointer events and style changes run outside the frame's
 * callbacks, so a run can stutter with fast frames. The mouse runs send moves faster than a real
 * mouse does (the browser lines those up with frames), so compare them with each other.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
const explained = (option("--why") ?? "").split(",").filter(Boolean);
const showPasses = flag("--passes");
const seconds = Number(option("--seconds") ?? 4);
const settleSeconds = Number(option("--settle") ?? 8);
const traceRun = option("--trace");
const vsync = flag("--vsync");
const saveTo = option("--save");
const saved = {};
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
const countReactRenders = (explained) => {
	const tally = new Map();
	const why = new Map();
	globalThis.__reactTally = tally;
	globalThis.__reactWhy = why;
	const WATCHED = [
		"AppShell",
		"Viewport",
		"Toolbar",
		"Inspector",
		"Outliner",
		"Entities",
		...explained,
	];
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
								// What it holds, to tell which hook it is.
								const hint =
									value && typeof value === "object"
										? `{${Object.keys(value).slice(0, 4).join(",")}}`
										: String(value).slice(0, 24);
								changed.push(explained.includes(name) ? `hook ${i} ${hint}` : `hook ${i}`);
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

/**
 * A trace's long tasks (over 50 ms) on the page's main thread and the GPU process's: for each,
 * what kind of work it was (self time by trace event: script, garbage collection, style, layout,
 * shader compiles…) and the functions sampled in it, the app's (src/) with what they call.
 */
const summarizeTrace = (events, runStart, resolve) => {
	const threads = new Map();
	for (const event of events) {
		if (event.ph === "M" && event.name === "thread_name") {
			threads.set(`${event.pid}:${event.tid}`, event.args.name);
		}
	}
	// The page's renderer: the main thread that ran the most script.
	const scriptByThread = new Map();
	for (const event of events) {
		if (event.ph === "X" && event.name === "FunctionCall") {
			const key = `${event.pid}:${event.tid}`;
			scriptByThread.set(key, (scriptByThread.get(key) ?? 0) + (event.dur ?? 0));
		}
	}
	const main = [...scriptByThread.entries()]
		.filter(([key]) => threads.get(key) === "CrRendererMain")
		.sort((a, b) => b[1] - a[1])[0]?.[0];
	const gpuMain = [...threads.entries()].find(([, name]) => name === "CrGpuMain")?.[0];
	const onThread = (key) =>
		events
			.filter((e) => e.ph === "X" && `${e.pid}:${e.tid}` === key && e.ts >= runStart)
			.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
	// Self time by event name inside [start, end) of a thread's events, nesting by time.
	const breakdown = (list, start, end) => {
		const self = new Map();
		const stack = [];
		for (const event of list) {
			if (event.ts < start || event.ts >= end) {
				continue;
			}
			while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= event.ts) {
				stack.pop();
			}
			const parent = stack.at(-1);
			if (parent) {
				self.set(parent.name, (self.get(parent.name) ?? 0) - (event.dur ?? 0) / 1000);
			}
			self.set(event.name, (self.get(event.name) ?? 0) + (event.dur ?? 0) / 1000);
			stack.push(event);
		}
		return self;
	};
	// CPU samples on the main thread: [time, node id] with the profile's nodes.
	const nodes = new Map();
	const parentOf = new Map();
	const samples = [];
	const profiles = new Map();
	for (const event of events) {
		if (event.name === "Profile") {
			profiles.set(event.id, { time: event.args.data.startTime, key: `${event.pid}:${event.tid}` });
		}
	}
	for (const event of events) {
		if (event.name !== "ProfileChunk") {
			continue;
		}
		const profile = profiles.get(event.id);
		const data = event.args.data;
		for (const node of data.cpuProfile?.nodes ?? []) {
			nodes.set(`${event.id}:${node.id}`, node.callFrame);
			if (node.parent !== undefined) {
				parentOf.set(`${event.id}:${node.id}`, `${event.id}:${node.parent}`);
			}
		}
		const ids = data.cpuProfile?.samples ?? [];
		const deltas = data.timeDeltas ?? [];
		for (let i = 0; i < ids.length; i += 1) {
			profile.time += deltas[i] ?? 0;
			if (profile.key === main) {
				samples.push([profile.time, `${event.id}:${ids[i]}`]);
			}
		}
	}
	const where = (frame) =>
		resolve?.(frame) ??
		`${frame.functionName || "(anon)"} ${(frame.url ?? "").split("/").slice(-2).join("/").split("?")[0]}:${frame.lineNumber}`;
	const sampled = (start, end) => {
		const self = new Map();
		const inclusive = new Map();
		const between = samples.filter(([time]) => time >= start && time < end);
		const ms = between.length > 1 ? (end - start) / 1000 / between.length : 0;
		for (const [, id] of between) {
			const frame = nodes.get(id);
			if (!frame) {
				continue;
			}
			self.set(where(frame), (self.get(where(frame)) ?? 0) + ms);
			const seen = new Set();
			for (let at = id; at !== undefined; at = parentOf.get(at)) {
				const up = nodes.get(at);
				if (up?.url?.includes("/src/")) {
					const key = where(up);
					if (!seen.has(key)) {
						seen.add(key);
						inclusive.set(key, (inclusive.get(key) ?? 0) + ms);
					}
				}
			}
		}
		return { self, inclusive };
	};
	const TASKS = new Set(["ThreadControllerImpl::RunTask", "RunTask", "ThreadPool_RunTask"]);
	// Top-level tasks only: a RunTask inside another is the same work.
	const longTasks = (list) => {
		const found = [];
		let until = 0;
		for (const event of list) {
			if (TASKS.has(event.name) && event.ts >= until) {
				until = event.ts + event.dur;
				if (event.dur > 50_000) {
					found.push(event);
				}
			}
		}
		return found;
	};
	const report = (key, label) => {
		if (!key) {
			return;
		}
		const list = onThread(key);
		const tasks = longTasks(list);
		const total = new Map();
		console.log(`  ${label}: ${tasks.length} tasks over 50 ms`);
		for (const task of tasks) {
			for (const [name, ms] of breakdown(list, task.ts, task.ts + task.dur)) {
				total.set(name, (total.get(name) ?? 0) + ms);
			}
		}
		total.delete("ThreadControllerImpl::RunTask");
		total.delete("RunTask");
		if (tasks.length > 0) {
			console.log(
				`    in all, by kind:\n${top(total, 12).replaceAll("\n", "\n  ").replace(/^/, "  ")}`,
			);
		}
		for (const task of [...tasks].sort((a, b) => b.dur - a.dur).slice(0, 6)) {
			const kinds = breakdown(list, task.ts, task.ts + task.dur);
			kinds.delete("ThreadControllerImpl::RunTask");
			kinds.delete("RunTask");
			console.log(
				`    ${(task.dur / 1000).toFixed(0)} ms at ${((task.ts - runStart) / 1e6).toFixed(2)} s: ${[
					...kinds.entries(),
				]
					.filter(([, ms]) => ms >= 1)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 6)
					.map(([name, ms]) => `${name} ${ms.toFixed(0)}`)
					.join(", ")}`,
			);
			if (key === main) {
				const { self, inclusive } = sampled(task.ts, task.ts + task.dur);
				if (inclusive.size === 0 && !resolve) {
					console.log(
						"      (a production build: VITE_BENCH=1 pnpm build names the app's functions)",
					);
				}
				console.log(
					`      the app's functions:\n${top(inclusive, 10).replaceAll("    ", "        ")}`,
				);
				console.log(`      self:\n${top(self, 8).replaceAll("    ", "        ")}`);
			}
		}
	};
	report(main, "the page's main thread");
	report(gpuMain, "the GPU process");
	// Long frames: gaps over 50 ms between animation frames, with what each thread did in them
	// (a frame can wait on the GPU process, or on several shorter tasks in a row).
	const mainList = main ? onThread(main) : [];
	const gpuList = gpuMain ? onThread(gpuMain) : [];
	const frames = mainList.filter((e) => e.name === "FireAnimationFrame").map((e) => e.ts);
	const gaps = [];
	for (let i = 1; i < frames.length; i += 1) {
		if (frames[i] - frames[i - 1] > 50_000) {
			gaps.push([frames[i - 1], frames[i]]);
		}
	}
	console.log(`  long frames (over 50 ms between animation frames): ${gaps.length}`);
	const kindsIn = (list, start, end) => {
		const kinds = breakdown(list, start, end);
		for (const name of TASKS) {
			kinds.delete(name);
		}
		return [...kinds.entries()]
			.filter(([, ms]) => ms >= 2)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 7)
			.map(([name, ms]) => `${name} ${ms.toFixed(0)}`)
			.join(", ");
	};
	for (const [start, end] of [...gaps].sort((a, b) => b[1] - b[0] - (a[1] - a[0])).slice(0, 6)) {
		console.log(
			`    ${((end - start) / 1000).toFixed(0)} ms at ${((start - runStart) / 1e6).toFixed(2)} s · main: ${kindsIn(mainList, start, end)} · GPU: ${kindsIn(gpuList, start, end)}`,
		);
		const { self, inclusive } = sampled(start, end);
		if (inclusive.size > 0) {
			console.log(
				`      the app's functions:\n${top(inclusive, 8).replaceAll("    ", "        ")}`,
			);
		}
		console.log(`      self:\n${top(self, 6).replaceAll("    ", "        ")}`);
	}
};

/**
 * For a production build that keeps its source maps (VITE_BENCH=1): a trace's sampled functions
 * named as in the source (file and line), the way the dev server's profiles are; null otherwise.
 */
const sourceMapsOf = async (events) => {
	const urls = new Set();
	for (const event of events) {
		for (const node of event.name === "ProfileChunk"
			? (event.args.data.cpuProfile?.nodes ?? [])
			: []) {
			if (node.callFrame.url?.includes("/assets/") && node.callFrame.url.endsWith(".js")) {
				urls.add(node.callFrame.url);
			}
		}
	}
	if (urls.size === 0) {
		return null;
	}
	let SourceMapConsumer;
	try {
		({ SourceMapConsumer } = await import("source-map-js"));
	} catch {
		const store = join(ROOT, "node_modules", ".pnpm");
		const dir = readdirSync(store).find((name) => name.startsWith("source-map-js@"));
		if (!dir) {
			return null;
		}
		({ SourceMapConsumer } = await import(
			pathToFileURL(join(store, dir, "node_modules", "source-map-js", "source-map.js")).href
		));
	}
	const maps = new Map();
	for (const url of urls) {
		const answer = await fetch(`${url}.map`).catch(() => null);
		if (answer?.ok) {
			maps.set(url, new SourceMapConsumer(await answer.json()));
		}
	}
	if (maps.size === 0) {
		return null;
	}
	const named = new Map();
	return (frame) => {
		const map = maps.get(frame.url);
		if (!map) {
			return undefined;
		}
		const key = `${frame.url}:${frame.lineNumber}:${frame.columnNumber}`;
		if (!named.has(key)) {
			const at = map.originalPositionFor({
				line: frame.lineNumber + 1,
				column: frame.columnNumber,
			});
			// The app's own as src/…, a package's by its name.
			const source = (at.source ?? "")
				.replace(/^.*node_modules\/\.pnpm\/([^/]+)\/.*\/([^/]+)$/, "$1/$2")
				.replace(/^(\.\.\/)+/, "");
			named.set(
				key,
				at.source ? `${at.name ?? frame.functionName ?? "(anon)"} ${source}:${at.line}` : undefined,
			);
		}
		return named.get(key);
	};
};

const { chromium } = await loadPlaywright();
const browser = onWindows
	? await chromium.launch({
			channel: "chrome",
			args: vsync ? [] : ["--disable-gpu-vsync", "--disable-frame-rate-limit"],
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
	const orbiting = words.includes("orbit");
	const selecting = words.includes("select");
	const fresh = words.includes("fresh");
	const opening = words.includes("opening");
	const touring = words.includes("tour");
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
		await context.addInitScript(countReactRenders, explained);
	}
	const page = await context.newPage();
	page.on("pageerror", (error) => console.log("  page error:", error.message.slice(0, 300)));
	await page.goto(base, { timeout: 120_000 });
	await page.waitForFunction(() => Boolean(globalThis.__editorStore), null, { timeout: 60_000 });
	await page.evaluate(
		async ({ text, template, touring }) => {
			const store = globalThis.__editorStore.getState();
			let scene;
			// The dev server serves these as modules; a build for measuring (VITE_BENCH=1) puts them
			// on globalThis once they've loaded.
			const fromPage = async (name, path, exported) => {
				try {
					return globalThis[name] ?? (await import(path))[exported];
				} catch {
					for (let i = 0; !globalThis[name] && i < 200; i++) {
						await new Promise((resolve) => setTimeout(resolve, 50));
					}
					return globalThis[name];
				}
			};
			if (text) {
				const repairWorld = await fromPage(
					"__benchRepair",
					"/src/parts/repairWorld.ts",
					"repairWorld",
				);
				scene = repairWorld(JSON.parse(text)).scene;
			} else {
				const TEMPLATES = await fromPage(
					"__benchTemplates",
					"/src/templates/index.ts",
					"TEMPLATES",
				);
				const found = TEMPLATES.find((each) => each.id === template);
				if (!found) {
					throw new Error(`No template ${template}`);
				}
				scene = found.create();
			}
			if (touring) {
				// Through the viewpoints at a second each, so a run sees several glides and moods.
				scene.camera.tour.holdSeconds = 1;
			}
			store.loadScene(scene);
		},
		{ text: worldText, template: world, touring },
	);
	await page.evaluate(
		({ mode, close, opening, touring }) => {
			const store = globalThis.__editorStore.getState();
			store.setMode(mode);
			const { scene } = store;
			const first = scene.camera.openingViewpointId ?? scene.viewpoints[0]?.id;
			if ((opening || touring) && first) {
				store.goToViewpoint(first, { instant: true });
				if (touring) {
					store.playTour();
				}
				return;
			}
			store.showOpeningView(
				close
					? {
							target: [0, 0],
							targetAltitude: 0,
							azimuth: 315,
							elevation: 22,
							span: 10,
							projection: "perspective",
							fieldOfView: 40,
						}
					: {
							target: [0, 0],
							targetAltitude: 0,
							azimuth: 315,
							elevation: 32.47,
							span: 46,
							projection: "orthographic",
							fieldOfView: null,
						},
			);
		},
		{ mode, close, opening, touring },
	);
	// Settled: shaders compiled, the parts' pictures in Add to scene made.
	if (!fresh) {
		await page.waitForTimeout(settleSeconds * 1000);
	}
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
	if (orbiting) {
		// The camera circling the view's centre, as the turntable does, at 20° a second.
		await page.evaluate(async () => {
			const { orbitStep } = globalThis.__editorView ?? {};
			if (!orbitStep) {
				throw new Error("No __editorView.orbitStep: the dev server's app is older than the bench");
			}
			const step = () => {
				orbitStep(20 / 60);
				requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		});
		await page.waitForTimeout(500);
	}
	if (selecting) {
		await page.evaluate(() => {
			const store = globalThis.__editorStore;
			const { entities } = store.getState().scene;
			let next = 0;
			setInterval(() => {
				next = (next + 97) % entities.length;
				store.getState().select(entities[next].id);
			}, 500);
		});
	}
	const tracing = run === traceRun;
	if (tracing) {
		await browser.startTracing(page, {
			// Enough to tell the kinds of work apart, small enough to read back (a frame-rate run of
			// a big world with every timeline category runs past half a gigabyte).
			categories: [
				"devtools.timeline",
				"v8.execute",
				"disabled-by-default-v8.cpu_profiler",
				"disabled-by-default-v8.gc",
				"blink.user_timing",
				"gpu",
				"toplevel",
			],
		});
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
		const until = Date.now() + seconds * 1000;
		for (let across = true; Date.now() < until; across = !across) {
			await page.mouse.move(across ? right : left, y + (across ? 60 : 0), { steps: 60 });
		}
		if (panning) {
			await page.mouse.up();
		}
	} else {
		await page.waitForTimeout(seconds * 1000);
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
	saved[run] = { frames: stats.frames, cpu: stats.cpu, draws: stats.draws, objects: stats.objects };
	const median = percentile(stats.frames, 0.5);
	const hitches = stats.frames.filter((ms) => ms > 50);
	// With vsync the median frame is the screen's refresh: a frame over two missed one at least.
	const dropped = stats.frames.filter((ms) => ms > 2 * median).length;
	console.log(
		`${run}: ${stats.objects} objects · frame ${median.toFixed(1)} ms median, ${percentile(stats.frames, 0.9).toFixed(1)} p90 (${(1000 / median).toFixed(0)} fps) · CPU in frame callbacks ${percentile(stats.cpu, 0.5).toFixed(2)} ms median, GPU ${stats.gpu.length > 0 ? `${percentile(stats.gpu, 0.5).toFixed(2)} ms` : "not timed"} · ${percentile(stats.draws, 0.5)} draws a frame`,
	);
	console.log(
		`  hitches: ${percentile(stats.frames, 0.99).toFixed(1)} ms p99, worst ${Math.max(...stats.frames).toFixed(0)} ms (CPU ${Math.max(...stats.cpu).toFixed(0)} ms) · ${hitches.length} frames over 50 ms in ${stats.frames.length}${hitches.length > 0 ? `: ${hitches.map((ms) => ms.toFixed(0)).join(", ")}` : ""}${vsync ? ` · ${dropped} missed a refresh (over ${(2 * median).toFixed(0)} ms)` : ""}`,
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
	if (tracing) {
		const buffer = await browser.stopTracing();
		const file = join(ROOT, "shots", `trace-${run}.json`);
		mkdirSync(join(ROOT, "shots"), { recursive: true });
		writeFileSync(file, buffer);
		const parsed = JSON.parse(buffer.toString());
		const events = parsed.traceEvents ?? parsed;
		// The trace's clock is the page's monotonic one (µs), as performance.now() is.
		const startUs = events.reduce(
			(least, e) => (e.ph === "X" && e.ts > 0 && e.ts < least ? e.ts : least),
			Number.POSITIVE_INFINITY,
		);
		summarizeTrace(events, Number.isFinite(startUs) ? startUs : 0, await sourceMapsOf(events));
		console.log(`  trace: ${file} (open in chrome://tracing or DevTools' Performance panel)`);
	}
	await context.close();
}
await browser.close();
if (saveTo) {
	writeFileSync(saveTo, JSON.stringify({ world, base, vsync, seconds, runs: saved }));
	console.log(`saved: ${saveTo}`);
}
