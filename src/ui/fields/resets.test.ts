import { describe, expect, it, vi } from "vitest";

import { resetsAgainst, resetToDefault } from "./resets";

describe("Default / Reset (ADR-0105)", () => {
	it("says Default while a value is its default, and names the default for Reset", () => {
		const onReset = vi.fn();
		expect(resetToDefault(2.4, 2.4, onReset)).toMatchObject({ from: "default", inherited: true });
		const changed = resetToDefault([1, 2], [0, 2], onReset);
		expect(changed).toMatchObject({ inherited: false, value: "0, 2" });
		changed.onReset();
		expect(onReset).toHaveBeenCalledOnce();
		expect(resetToDefault(true, false, onReset).value).toBe("off");
		expect(resetToDefault("x", "", onReset, "the part's name").value).toBe("the part's name");
	});

	it("makes a record's Resets against its defaults, or a default it depends on", () => {
		const write = vi.fn();
		const reset = resetsAgainst({ width: 3, loops: true }, { width: 2.4, loops: false }, write);
		expect(reset("loops").inherited).toBe(false);
		reset("loops").onReset();
		expect(write).toHaveBeenCalledWith("loops", false);
		// A road's width goes back to its kind's.
		expect(reset("width", undefined, 3).inherited).toBe(true);
	});
});
