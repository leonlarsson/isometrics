import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TEMPLATES } from "./index";
import { STARTER_PICTURE_SOURCES, starterPictureOf, starterPreviewOf } from "./pictures";

const PUBLIC = join(__dirname, "..", "..", "public");
const MAKE_THEM = "make them with node scripts/starter-pictures.mjs (ADR-0146)";

describe("the built-in worlds' pictures", () => {
	it.each(STARTER_PICTURE_SOURCES.map((source) => source.id))(
		"%s has a picture file for each theme",
		(id) => {
			for (const theme of ["light", "dark"] as const) {
				const file = starterPictureOf(id, theme);
				expect(file, MAKE_THEM).not.toBeNull();
				expect(existsSync(join(PUBLIC, file ?? "")), `${file}: ${MAKE_THEM}`).toBe(true);
			}
		},
	);

	it.each(TEMPLATES.map((template) => template.id))("%s has a link preview", (id) => {
		const file = starterPreviewOf(id);
		expect(existsSync(join(PUBLIC, file ?? "")), `${file}: ${MAKE_THEM}`).toBe(true);
	});

	it("has none for worlds that aren't built in", () => {
		expect(starterPictureOf("my-own-world", "light")).toBeNull();
		expect(starterPreviewOf("blank-blocks")).toBeNull();
	});
});
