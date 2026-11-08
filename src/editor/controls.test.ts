import { readFileSync } from "node:fs";
import type { HotkeyRegistrationView } from "@tanstack/react-hotkeys";
import { describe, expect, it } from "vitest";

import { KEY_GROUP, keyCapsOf, keyGroupsOf, mouseGroupsOf } from "./controls";

const registration = (hotkey: string, name?: string, group?: string) =>
	({ kind: "chord", hotkey, options: { meta: { name, group } } }) as HotkeyRegistrationView;

const caps = (hotkey: HotkeyRegistrationView["hotkey"]) => String(hotkey).split("+");

describe("Keys and mouse (ADR-0157)", () => {
	it("lists the editor's keys by group, in the groups' order, with every key that does each", () => {
		const groups = keyGroupsOf(
			[
				registration("Delete", "Delete", KEY_GROUP.selected),
				registration("Mod+Z", "Undo", KEY_GROUP.app),
				registration("Backspace", "Delete", KEY_GROUP.selected),
				// The same key registered twice (a camera key in two moods) is listed once.
				registration("=", "Zoom in", KEY_GROUP.view),
				registration("=", "Zoom in", KEY_GROUP.view),
				// A widget's own keys have no group: not the editor's.
				registration("Enter", "Rename"),
			],
			caps,
		);
		expect(groups.map((group) => group.title)).toEqual([
			KEY_GROUP.app,
			KEY_GROUP.view,
			KEY_GROUP.selected,
		]);
		expect(groups[1].controls).toEqual([{ press: ["="], does: "Zoom in" }]);
		expect(groups[2].controls).toEqual([{ press: ["Delete", "or", "Backspace"], does: "Delete" }]);
	});

	it("prints keys as they're printed on keys, and folds a run of keys into first to last", () => {
		expect(keyCapsOf(["Shift", "ArrowLeft"])).toEqual(["Shift", "←"]);
		expect(keyCapsOf(["Ctrl", "Comma"])).toEqual(["Ctrl", ","]);
		expect(keyCapsOf(["Shift", "/"])).toEqual(["?"]);
		expect(keyCapsOf(["Shift", "Equal"])).toEqual(["+"]);
		const digits = ["1", "2", "3", "4", "5"].map((digit) =>
			registration(digit, "Go to a viewpoint", KEY_GROUP.view),
		);
		expect(keyGroupsOf(digits, caps)[0].controls[0].press).toEqual(["1", "to", "5"]);
	});

	it("says what Shift does with a drag as the preferences set it, in the platform's names", () => {
		const shiftRow = (shiftDrag: "pan" | "orbit") =>
			mouseGroupsOf({ shiftDrag }, "windows")[0].controls[1];
		expect(shiftRow("pan").does).toMatch(/^Pans/);
		expect(shiftRow("orbit").does).toMatch(/^Orbits/);
		const selected = mouseGroupsOf({ shiftDrag: "pan" }, "mac")[2].controls;
		expect(selected[1].press).toEqual(["Option", "drag it"]);
		expect(selected[2].press).toEqual(["Cmd", "drag it"]);
	});

	it("has a group for every editor-wide shortcut, so none is missing from the panel", () => {
		const source = readFileSync(new URL("./useShortcuts.ts", import.meta.url), "utf8");
		const metas = source.split("\n").filter((line) => line.includes("meta: {"));
		expect(metas.length).toBeGreaterThan(40);
		expect(metas.filter((meta) => !meta.includes("group"))).toEqual([]);
	});
});
