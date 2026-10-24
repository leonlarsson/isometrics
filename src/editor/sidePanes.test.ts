import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { memoryStorage } from "./testStorage";

/** Fresh copies of the modules, so nothing remembered by an earlier test is cached. */
const freshModules = async () => {
	vi.resetModules();
	return { ...(await import("./sidePanes")), ...(await import("./panelMemory")) };
};

describe("sidePanes", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.stubGlobal("window", new EventTarget());
	});
	afterEach(() => vi.unstubAllGlobals());

	it("hides both panes, or shows both once both are hidden", async () => {
		const { toggleSidePanes, setSidePaneOpen, readPanelMemory } = await freshModules();
		toggleSidePanes();
		expect(readPanelMemory()).toEqual({ "pane:left": false, "pane:right": false });

		toggleSidePanes();
		expect(readPanelMemory()).toEqual({ "pane:left": true, "pane:right": true });

		// With one pane hidden, the toggle hides the other too.
		setSidePaneOpen("left", false);
		toggleSidePanes();
		expect(readPanelMemory()).toEqual({ "pane:left": false, "pane:right": false });
	});
});
