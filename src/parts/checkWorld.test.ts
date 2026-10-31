import { describe, expect, it } from "vitest";

import { createEmptyScene, TEMPLATES } from "#/templates";

import { checkWorld, issuesForAi } from "./checkWorld";

describe("checking a world", () => {
	it.each(TEMPLATES.map((template) => [template.id, template.create] as const))(
		"%s checks out with no problems or warnings",
		(_, create) => {
			const check = checkWorld(JSON.parse(JSON.stringify(create())));
			expect(check.problems).toEqual([]);
			expect(check.warnings).toEqual([]);
			expect(check.isValid).toBe(true);
		},
	);

	it("says what isn't a world at all", () => {
		expect(checkWorld([]).isUnreadable).toBe(true);
		expect(checkWorld({ hello: 1 }).isUnreadable).toBe(true);
	});

	it("names problems by path and id, and what opening would repair", () => {
		const check = checkWorld({
			version: 1,
			entities: [
				{ id: "a", kind: "house_01", position: [0, 0] },
				{ id: "b", kind: "house_01", position: "here" },
				{ id: "a", kind: "house_01", position: [2, 0] },
			],
		});
		expect(check.isValid).toBe(false);
		expect(check.problems.some((issue) => issue.where.startsWith('entities[1] "b".position'))).toBe(
			true,
		);
		expect(check.problems.some((issue) => issue.what.includes('id "a" is used twice'))).toBe(true);
		expect(check.repairs).toContain("object");
	});

	it("warns of what opens but won't look as meant", () => {
		const world = {
			...createEmptyScene({ ground: { width: 20, depth: 20 } }),
			entities: [
				{ id: "x", kind: "spaceship_99", position: [0, 0] },
				{
					id: "h",
					kind: "house_01",
					position: [9.8, 0],
					props: { wings: 2 },
					dataRow: { tableKey: "nope", rowKey: "r" },
					label: { isShown: true, dataKeys: ["sales"] },
				},
			],
			camera: { openingViewpointId: "gone" },
		};
		const check = checkWorld(JSON.parse(JSON.stringify(world)));
		const said = check.warnings.map((issue) => `${issue.where}: ${issue.what}`).join("\n");
		expect(said).toContain('"spaceship_99" isn\'t a part kind');
		expect(said).toContain('no prop "wings"');
		expect(said).toContain('table "nope"');
		expect(said).toContain('shows "sales", which reads nothing');
		expect(said).toContain("over the ground's edge");
		expect(said).toContain('"gone" isn\'t one of its viewpoints');
		expect(issuesForAi(check)).toContain("send the whole world again");
	});
});
