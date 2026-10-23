import { describe, expect, it } from "vitest";

import { familyOf, variantName, variantOf } from "./variants";

describe("variants", () => {
	it("splits an id into its family and number", () => {
		expect([familyOf("office_tower_02"), variantOf("office_tower_02")]).toEqual([
			"office_tower",
			2,
		]);
		expect([familyOf("road_01"), variantOf("road_01")]).toEqual(["road", 1]);
		expect([familyOf("custom"), variantOf("custom")]).toEqual(["custom", 1]);
	});

	it("names a variant by its family until there are several", () => {
		expect(variantName("house_01", "House", ["house_01", "car_01"])).toBe("House");
		const towers = ["office_tower_01", "office_tower_02", "house_01"];
		expect(variantName("office_tower_01", "Office tower", towers)).toBe("Office tower 1");
		expect(variantName("office_tower_02", "Office tower", towers)).toBe("Office tower 2");
	});
});
