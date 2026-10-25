import { describe, expect, it } from "vitest";

import { copyName, copyNamer } from "./naming";

describe("names for copies", () => {
	it("adds “copy” by default", () => {
		expect(copyName("Tower", new Set(["Tower"]), "copy")).toBe("Tower copy");
		expect(copyName("Tower copy", new Set(["Tower copy"]), "copy")).toBe("Tower copy copy");
	});

	it("numbers a taken name, counting on from a number it ends in", () => {
		expect(copyName("Tower", new Set(["Tower"]), "numbered")).toBe("Tower 2");
		expect(copyName("Tower", new Set(["Tower", "Tower 2"]), "numbered")).toBe("Tower 3");
		expect(copyName("Gate 5", new Set(["Gate 5"]), "numbered")).toBe("Gate 6");
		expect(copyName("Route 66", new Set(["Route 66", "Route 67"]), "numbered")).toBe("Route 68");
	});

	it("drops older copies' endings", () => {
		expect(copyName("Tower copy copy", new Set(["Tower copy copy"]), "numbered")).toBe("Tower 2");
		expect(copyName("Depot copy", new Set(["Depot copy", "Depot 2"]), "numbered")).toBe("Depot 3");
	});

	it("keeps a free name and an empty one", () => {
		expect(copyName("Harbour", new Set(["Bay"]), "copy")).toBe("Harbour");
		expect(copyName("", new Set([""]), "numbered")).toBe("");
	});

	it("names several copies apart", () => {
		const name = copyNamer(["Lamp", "Lamp 2"], "numbered");
		expect([name("Lamp"), name("Lamp"), name("")]).toEqual(["Lamp 3", "Lamp 4", ""]);
	});
});
