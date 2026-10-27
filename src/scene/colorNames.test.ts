import { describe, expect, it } from "vitest";

import { describeColor } from "./colorNames";
import { SWATCHES } from "./theme";

describe("describeColor", () => {
	it("names hues, how light they are, and greys", () => {
		expect(describeColor("#3d4fd6")).toBe("blue");
		expect(describeColor("#1b2a6b")).toBe("dark blue");
		expect(describeColor("#2f3a56")).toBe("dark blue");
		expect(describeColor("#7d8a9c")).toBe("greyish blue");
		expect(describeColor("#f2c230")).toBe("yellow");
		expect(describeColor("#7cc48a")).toBe("green");
		expect(describeColor("#d6efda")).toBe("pale green");
		expect(describeColor("#2bb58c")).toBe("teal");
		expect(describeColor("#8a5cf0")).toBe("violet");
		expect(describeColor("#e85d75")).toBe("pinkish red");
		expect(describeColor("#ff0000")).toBe("red");
		expect(describeColor("#9a9a96")).toBe("grey");
		expect(describeColor("#3a3b40")).toBe("dark grey");
		expect(describeColor("#f7f7f4")).toBe("white");
		expect(describeColor("#000000")).toBe("black");
	});

	it("tells browns, beiges and creams from oranges", () => {
		expect(describeColor("#f07b4f")).toBe("orange");
		expect(describeColor("#a07a5a")).toBe("brown");
		expect(describeColor("#5a3d2e")).toBe("dark brown");
		expect(describeColor("#e8c9a0")).toBe("beige");
		expect(describeColor("#f3e3c3")).toBe("cream");
	});

	it("says nothing for what isn't a #rrggbb colour", () => {
		expect(describeColor("red")).toBeNull();
		expect(describeColor("#abc")).toBeNull();
	});

	it("names every preset colour differently", () => {
		const names = SWATCHES.map((swatch) => swatch.name);
		expect(new Set(names).size).toBe(names.length);
	});
});
