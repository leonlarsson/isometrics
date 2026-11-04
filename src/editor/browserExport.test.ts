import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import {
	addToBrowser,
	BrowserExportError,
	browserExportFileName,
	collectBrowserItems,
	contentsOf,
	listBrowserBackups,
	MOST_EXPORT_CHARS,
	makeBrowserExport,
	readBrowserExport,
	replaceBrowser,
} from "./browserExport";
import {
	createWorld,
	deleteWorld,
	listSceneBackups,
	listWorlds,
	loadStoredScene,
	openWorldId,
	resetBrowserSettings,
	storageUsage,
} from "./persistence";
import { blockedStorage, limitedStorage, memoryStorage } from "./testStorage";

const scene = (title: string) => SceneSchema.parse({ version: 1, meta: { title } });

const PREFERENCES_KEY = "isometrics:preferences";
const worldText = (title: string) => JSON.stringify(scene(title));

/** This browser's entries, as a plain object to compare. */
const stored = () => Object.fromEntries(collectBrowserItems());

/** An export file holding `items`, as another browser would have made it. */
const exportOf = (items: Record<string, string>, at = Date.UTC(2026, 10, 1)) =>
	makeBrowserExport(new Map(Object.entries(items)), at);

/** Make a browser with two worlds, a backup and some settings; returns the worlds' ids. */
const fillBrowser = () => {
	const kept = createWorld(scene("Kept"));
	const doomed = createWorld(scene("Deleted"));
	deleteWorld(doomed);
	const open = createWorld(scene("Open"));
	localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme: "dark" }));
	localStorage.setItem("isometrics:panels", "{}");
	localStorage.setItem("someone-else:key", "not ours");
	return { kept, open };
};

beforeEach(() => {
	vi.stubGlobal("localStorage", memoryStorage());
	vi.stubGlobal("sessionStorage", memoryStorage());
	vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("exporting this browser", () => {
	it("takes every entry with the app's prefix, exactly as stored, and nothing else", () => {
		fillBrowser();
		const file = JSON.parse(makeBrowserExport(collectBrowserItems(), Date.UTC(2026, 10, 4)));
		expect(file).toMatchObject({
			app: "Isometrics",
			kind: "browser",
			version: 1,
			exportedAt: "2026-11-04T00:00:00.000Z",
		});
		expect(Object.keys(file.items).every((key) => key.startsWith("isometrics:"))).toBe(true);
		expect(file.items[PREFERENCES_KEY]).toBe(localStorage.getItem(PREFERENCES_KEY));
		expect(file.items["someone-else:key"]).toBeUndefined();
		expect(browserExportFileName(Date.UTC(2026, 10, 4))).toBe("isometrics-browser-2026-11-04.json");
	});

	it("says what it holds: worlds by title, backups, settings, when and how much", () => {
		fillBrowser();
		const contents = readBrowserExport(makeBrowserExport(collectBrowserItems(), 1_000));
		expect(contents.worlds.map((world) => world.title).sort()).toEqual(["Kept", "Open"]);
		expect(contents.backups).toBe(1);
		expect(contents.settings).toBe(2);
		expect(contents.exportedAt).toBe(1_000);
		expect(contents.size).toBe(storageUsage().total - "someone-else:key".length - 8);
		expect(contents.leftOut).toBe(0);
	});
});

describe("round trip", () => {
	it("an export replacing an empty browser brings back everything, exactly", () => {
		fillBrowser();
		const text = makeBrowserExport(collectBrowserItems());
		const before = stored();
		vi.stubGlobal("localStorage", memoryStorage());

		const result = replaceBrowser(readBrowserExport(text));
		expect(result).toMatchObject({ status: "replaced", backupKey: null });
		expect(stored()).toEqual(before);
		expect(loadStoredScene()).toMatchObject({ status: "ok", scene: { meta: { title: "Open" } } });
	});

	it("an export added to an empty browser brings its worlds and backups, not its settings", () => {
		fillBrowser();
		const text = makeBrowserExport(collectBrowserItems());
		vi.stubGlobal("localStorage", memoryStorage());

		const counts = addToBrowser(readBrowserExport(text));
		expect(counts).toMatchObject({ worldsAdded: 2, worldsCopied: 0, backupsAdded: 1 });
		expect(
			listWorlds()
				.map((world) => world.title)
				.sort(),
		).toEqual(["Kept", "Open"]);
		expect(listSceneBackups()).toHaveLength(1);
		expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
	});
});

describe("adding to this browser", () => {
	it("never overwrites a world: one with a taken id goes in as a copy", () => {
		const id = createWorld(scene("Mine"));
		const mine = localStorage.getItem(`isometrics:world:${id}`);
		localStorage.setItem(PREFERENCES_KEY, "mine");
		const text = exportOf({
			[`isometrics:world:${id}`]: worldText("Theirs, same id"),
			"isometrics:world:other": worldText("Theirs"),
			"isometrics:world-index": JSON.stringify([
				{ id, title: "Theirs, same id", updatedAt: 5 },
				{ id: "other", title: "Theirs", updatedAt: 4 },
			]),
			[PREFERENCES_KEY]: "theirs",
		});

		const counts = addToBrowser(readBrowserExport(text));
		expect(counts).toMatchObject({ worldsAdded: 2, worldsCopied: 1, worldsLeftOut: 0 });
		expect(localStorage.getItem(`isometrics:world:${id}`)).toBe(mine);
		expect(localStorage.getItem("isometrics:world:other")).not.toBeNull();
		expect(
			listWorlds()
				.map((world) => world.title)
				.sort(),
		).toEqual(["Mine", "Theirs", "Theirs, same id"]);
		// Settings and the open world stay as they were.
		expect(localStorage.getItem(PREFERENCES_KEY)).toBe("mine");
		expect(openWorldId()).toBe(id);

		// Adding the same file again adds nothing twice.
		const again = addToBrowser(readBrowserExport(text));
		expect(again).toMatchObject({ worldsAdded: 0, worldsAlreadyHere: 2 });
		expect(listWorlds()).toHaveLength(3);
	});

	it("puts a backup whose key is taken beside it, and skips one it has", () => {
		createWorld(scene("Doomed"));
		deleteWorld(openWorldId() ?? "");
		const [backup] = listSceneBackups();
		const text = exportOf({
			[backup.key]: "a different backup at the same time",
			"isometrics:scene-backup:5": backup.raw,
		});

		expect(addToBrowser(readBrowserExport(text))).toMatchObject({
			backupsAdded: 1,
			backupsAlreadyHere: 1,
		});
		const raws = listSceneBackups().map((each) => each.raw);
		expect(raws.sort()).toEqual([backup.raw, "a different backup at the same time"].sort());
		expect(localStorage.getItem(backup.key)).toBe(backup.raw);
	});

	it("gives a world whose id isn't one a new id, and the old single save one too", () => {
		const text = exportOf({
			"isometrics:world:../../weird id": worldText("Odd"),
			"isometrics:scene": worldText("Older"),
		});
		expect(addToBrowser(readBrowserExport(text)).worldsAdded).toBe(2);
		const ids = listWorlds().map((world) => world.id);
		expect(ids.every((id) => /^[A-Za-z0-9_-]{10}$/.test(id))).toBe(true);
		expect(localStorage.getItem("isometrics:scene")).toBeNull();
	});

	it("says what didn't fit when storage fills partway, and lists only worlds written", () => {
		const big = (title: string) => JSON.stringify({ ...scene(title), padding: "x".repeat(3000) });
		const text = exportOf({
			"isometrics:world:a": big("A"),
			"isometrics:world:b": big("B"),
			"isometrics:world:c": big("C"),
			"isometrics:world-index": JSON.stringify(
				["a", "b", "c"].map((id, i) => ({ id, title: id.toUpperCase(), updatedAt: 3 - i })),
			),
		});
		const contents = readBrowserExport(text);
		vi.stubGlobal("localStorage", limitedStorage(big("A").length * 2 + 400));

		const counts = addToBrowser(contents);
		expect(counts).toMatchObject({ worldsAdded: 2, worldsLeftOut: 1, ranOutOfRoom: true });
		const index = JSON.parse(localStorage.getItem("isometrics:world-index") ?? "[]") as {
			id: string;
		}[];
		for (const { id } of index) {
			expect(localStorage.getItem(`isometrics:world:${id}`)).not.toBeNull();
		}
		expect(listWorlds().map((world) => world.title)).toEqual(["A", "B"]);
	});
});

describe("replacing this browser's", () => {
	it("keeps a copy of this browser first, which brings its worlds back", () => {
		const { kept, open } = fillBrowser();
		const before = stored();
		const sceneBackups = listSceneBackups();
		const text = exportOf({
			"isometrics:world:new1": worldText("New"),
			"isometrics:world-index": JSON.stringify([{ id: "new1", title: "New", updatedAt: 9 }]),
			"isometrics:open-world-id": "new1",
			[PREFERENCES_KEY]: "theirs",
			"isometrics:scene-backup:7": "their backup",
		});

		const result = replaceBrowser(readBrowserExport(text), 1234);
		expect(result).toMatchObject({
			status: "replaced",
			backupKey: "isometrics:browser-backup:1234",
		});
		expect(listWorlds().map((world) => world.title)).toEqual(["New"]);
		expect(openWorldId()).toBe("new1");
		expect(localStorage.getItem(PREFERENCES_KEY)).toBe("theirs");
		expect(localStorage.getItem("isometrics:panels")).toBeNull();
		// Its backups join this browser's, which stay; not ours stays too.
		expect(listSceneBackups().map((backup) => backup.raw)).toEqual(
			expect.arrayContaining([...sceneBackups.map((backup) => backup.raw), "their backup"]),
		);
		expect(localStorage.getItem("someone-else:key")).toBe("not ours");

		// The copy is this browser as it was (but its backups, which stayed), in the export's format.
		const [copy] = listBrowserBackups();
		const copied = readBrowserExport(copy.raw);
		const expected = Object.fromEntries(
			Object.entries(before).filter(
				([key]) => key.startsWith("isometrics:") && !key.startsWith("isometrics:scene-backup:"),
			),
		);
		expect(Object.fromEntries(copied.items)).toEqual(expected);
		// Its worlds come back, beside the new one.
		addToBrowser(copied);
		expect(
			listWorlds()
				.map((world) => world.id)
				.sort(),
		).toEqual([kept, open, "new1"].sort());
		// A settings reset keeps the copy.
		resetBrowserSettings();
		expect(listBrowserBackups()).toHaveLength(1);
	});

	it("names only worlds that are there, and drops an open id for a world it hasn't", () => {
		const text = exportOf({
			"isometrics:world:a": worldText("A"),
			"isometrics:world-index": JSON.stringify([
				{ id: "a", title: "A", updatedAt: 2 },
				{ id: "gone", title: "Gone", updatedAt: 1 },
			]),
			"isometrics:open-world-id": "gone",
		});
		replaceBrowser(readBrowserExport(text));
		expect(JSON.parse(localStorage.getItem("isometrics:world-index") ?? "")).toEqual([
			{ id: "a", title: "A", updatedAt: 2 },
		]);
		expect(localStorage.getItem("isometrics:open-world-id")).toBeNull();
	});

	it("puts this browser back as it was when the export doesn't fit", () => {
		vi.stubGlobal("localStorage", limitedStorage(20_000));
		fillBrowser();
		const before = stored();
		const text = exportOf({
			"isometrics:world:a": worldText("A"),
			"isometrics:world:b": JSON.stringify({ ...scene("B"), padding: "x".repeat(15_000) }),
		});

		const result = replaceBrowser(readBrowserExport(text));
		expect(result).toMatchObject({ status: "didNotFit", restored: true, ranOutOfRoom: true });
		expect(stored()).toEqual(before);
		expect(listBrowserBackups()).toHaveLength(0);
	});

	it("changes nothing when there's no room for the copy", () => {
		const raw = JSON.stringify({ ...scene("Big"), padding: "x".repeat(6000) });
		vi.stubGlobal("localStorage", limitedStorage(raw.length + 500));
		localStorage.setItem("isometrics:world:big", raw);
		const before = stored();

		const result = replaceBrowser(readBrowserExport(exportOf({ [PREFERENCES_KEY]: "theirs" })));
		expect(result).toEqual({ status: "noRoomForCopy" });
		expect(stored()).toEqual(before);
	});

	it("changes nothing when the browser stores nothing at all", () => {
		vi.stubGlobal("localStorage", blockedStorage());
		const result = replaceBrowser(readBrowserExport(exportOf({ [PREFERENCES_KEY]: "theirs" })));
		expect(result).toEqual({ status: "unavailable" });
	});
});

describe("a file that isn't a browser's export, or a hostile one", () => {
	const reason = (text: string) => {
		try {
			readBrowserExport(text);
			return "read";
		} catch (error) {
			expect(error).toBeInstanceOf(BrowserExportError);
			return (error as Error).message;
		}
	};

	it("says so in words", () => {
		expect(reason("not json")).toMatch(/isn’t a browser’s export from Isometrics/);
		expect(reason("[]")).toMatch(/isn’t a browser’s export/);
		expect(reason(JSON.stringify(scene("A world")))).toMatch(/It’s a world.*Open file/);
		expect(
			reason(JSON.stringify({ app: "Other", kind: "browser", version: 1, items: {} })),
		).toMatch(/isn’t a browser’s export/);
		expect(
			reason(JSON.stringify({ app: "Isometrics", kind: "browser", version: 2, items: {} })),
		).toMatch(/newer version/);
		expect(
			reason(JSON.stringify({ app: "Isometrics", kind: "browser", version: "1", items: {} })),
		).toMatch(/isn’t a browser’s export/);
		expect(reason(JSON.stringify({ app: "Isometrics", kind: "browser", version: 1 }))).toMatch(
			/missing or damaged/,
		);
		expect(
			reason(JSON.stringify({ app: "Isometrics", kind: "browser", version: 1, items: ["a"] })),
		).toMatch(/missing or damaged/);
	});

	it("refuses a huge file and one nested past any world", () => {
		expect(reason(" ".repeat(MOST_EXPORT_CHARS + 1))).toMatch(/much more than a browser keeps/);
		expect(reason(`${"[".repeat(100)}${"]".repeat(100)}`)).toMatch(/nested more than/);
	});

	it("keeps only text under the app's prefix, never a prototype key", () => {
		const text = `{
			"app": "Isometrics", "kind": "browser", "version": 1, "exportedAt": "whenever",
			"__proto__": { "polluted": true },
			"items": {
				"__proto__": { "isometrics:world:x": "{}" },
				"isometrics:preferences": "{}",
				"isometrics:world:n": 5,
				"isometrics:world:o": { "meta": {} },
				"isometrics:world:z": null,
				"other:thing": "x",
				"isometrics:world:": "{}",
				"isometricsX": "x",
				"isometrics:${"k".repeat(300)}": "x"
			}
		}`;
		const contents = readBrowserExport(text);
		expect([...contents.items.keys()]).toEqual(["isometrics:preferences"]);
		expect(contents.leftOut).toBe(7);
		expect(contents.exportedAt).toBeNull();
		expect(({} as { polluted?: boolean }).polluted).toBeUndefined();

		replaceBrowser(contents);
		expect(Object.keys(stored())).toEqual(["isometrics:preferences"]);
	});

	it("never lets a file allow external sources, by Add or Replace (ADR-0119)", () => {
		const ALLOWED = "isometrics:allowed-links";
		const mine = JSON.stringify(["https://mine.example/data.json"]);
		localStorage.setItem(ALLOWED, mine);
		createWorld(scene("Mine"));
		const text = exportOf({
			"isometrics:world:theirs": worldText("Theirs"),
			[ALLOWED]: JSON.stringify(["https://tracker.example/pixel", "http://192.168.0.1/"]),
			[PREFERENCES_KEY]: "theirs",
		});

		// Left out and counted, like other entries that aren't imported.
		const contents = readBrowserExport(text);
		expect(contents.items.has(ALLOWED)).toBe(false);
		expect(contents.leftOut).toBe(1);
		expect(contents.settings).toBe(1);

		addToBrowser(contents);
		expect(localStorage.getItem(ALLOWED)).toBe(mine);

		// Replace leaves this browser's own as they are, even given contents that hold a list.
		const forced = contentsOf(new Map([...contents.items, [ALLOWED, '["https://evil.example/"]']]));
		expect(replaceBrowser(forced)).toMatchObject({ status: "replaced" });
		expect(localStorage.getItem(ALLOWED)).toBe(mine);
		expect(localStorage.getItem(PREFERENCES_KEY)).toBe("theirs");

		// In an empty browser too: nothing is allowed.
		vi.stubGlobal("localStorage", memoryStorage());
		replaceBrowser(readBrowserExport(text));
		expect(localStorage.getItem(ALLOWED)).toBeNull();
		expect(localStorage.getItem(PREFERENCES_KEY)).toBe("theirs");
	});
});
