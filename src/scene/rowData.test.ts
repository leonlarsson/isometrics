import { describe, expect, it } from "vitest";

import { nameOfDataKey } from "./rowData";
import { WorldDataSchema } from "./schema";

describe("what a data key is called", () => {
	it("is a column's name for a row's key, even where the row has no such cell", () => {
		const data = WorldDataSchema.parse({
			values: [{ key: "users", name: "Registered users", value: 1 }],
			tables: [
				{
					key: "outputs",
					name: "Outputs",
					keyColumn: "id",
					columns: [{ key: "id" }, { key: "paginationpage", name: "Pagination page" }],
					rows: [{ id: "a" }],
				},
			],
		});
		const row = { tableKey: "outputs", rowKey: "a" };
		expect(nameOfDataKey(data, "row.paginationpage", row)).toBe("Pagination page");
		expect(nameOfDataKey(data, "users", row)).toBe("Registered users");
		expect(nameOfDataKey(data, "row.gone", row)).toBe("gone");
	});
});
