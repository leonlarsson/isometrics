import { describe, expect, it } from "vitest";

import { WorldDataSchema } from "#/scene/schema";

import { arrivedDiffers, mergeArrived } from "./worldData";

const kept = WorldDataSchema.parse({
	values: [
		{ key: "users", name: "Users", value: 41000, history: [{ at: "2026-10-29", value: 40900 }] },
		{ key: "status", name: "Status", value: "ok" },
	],
	tables: [{ key: "games", columns: [{ key: "sent" }], rows: [{ sent: 1 }] }],
});

describe("the world's data now (data study)", () => {
	it("is what the world keeps while nothing has arrived", () => {
		expect(mergeArrived(kept, { values: new Map(), tables: new Map() })).toBe(kept);
	});

	it("puts what arrived on top, adding to a value's history, without changing what's kept", () => {
		const now = mergeArrived(kept, {
			values: new Map([["users", { point: { at: "2026-10-30", value: 41738 } }]]),
			tables: new Map([["games", [{ sent: 2 }, { sent: 3 }]]]),
		});
		expect(now.values[0]).toMatchObject({ value: 41738 });
		expect(now.values[0].history.map((point) => point.value)).toEqual([40900, 41738]);
		expect(now.values[1]).toBe(kept.values[1]);
		expect(now.tables[0].rows).toHaveLength(2);
		expect(kept.values[0].value).toBe(41000);
	});

	it("takes a source's whole past when it gives one", () => {
		const history = [
			{ at: "2026-10-29", value: 1 },
			{ at: "2026-10-30", value: 2 },
		];
		const now = mergeArrived(kept, {
			values: new Map([["users", { point: history[1], history }]]),
			tables: new Map(),
		});
		expect(now.values[0].history).toEqual(history);
	});

	it("has something to keep only when what arrived differs from what's kept", () => {
		const same = {
			values: new Map([
				[
					"users",
					{ point: { at: "2026-10-30", value: 41000 }, history: [...kept.values[0].history] },
				],
			]),
			tables: new Map([["games", [{ sent: 1 }]]]),
		};
		expect(arrivedDiffers(kept, same)).toBe(false);
		expect(arrivedDiffers(kept, { ...same, tables: new Map([["games", [{ sent: 2 }]]]) })).toBe(
			true,
		);
		// A new reading of the same number is kept as a new point in its past.
		expect(
			arrivedDiffers(kept, {
				values: new Map([["users", { point: { at: "2026-10-30", value: 41000 } }]]),
				tables: new Map(),
			}),
		).toBe(true);
		expect(
			arrivedDiffers(kept, {
				values: new Map([["users", { point: { at: "2026-10-30", value: 41738 }, history: [] }]]),
				tables: new Map(),
			}),
		).toBe(true);
	});
});
