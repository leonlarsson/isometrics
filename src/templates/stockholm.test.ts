import { describe, expect, it } from "vitest";

import { PARTS } from "#/parts/registry";

import { createStockholmScene } from "./stockholm";

describe("the Stockholm template", () => {
	const scene = createStockholmScene();
	const ofKind = (kind: string) => scene.entities.filter((entity) => entity.kind === kind);

	it("fills Gamla stan with rows of old houses, and has its landmarks", () => {
		const rows = ofKind("terraced_row_02");
		const houses = rows.reduce((sum, row) => sum + Number(row.props.houseCount), 0);
		console.log("rows", rows.length, "houses", houses, "entities", scene.entities.length);
		expect(houses).toBeGreaterThan(300);
		for (const kind of ["palace_01", "church_02", "church_03", "church_04", "city_hall_01"]) {
			expect(ofKind(kind).length).toBeGreaterThan(0);
		}
	});

	it("uses only parts that exist, and roads that exist for its vehicles", () => {
		const kinds = new Set(PARTS.map((part) => part.kind));
		const roads = new Set(scene.roads.map((road) => road.id));
		for (const entity of scene.entities) {
			expect(kinds.has(entity.kind), entity.kind).toBe(true);
			if (entity.follow) {
				expect(roads.has(entity.follow.roadId), entity.follow.roadId).toBe(true);
			}
		}
	});
});
