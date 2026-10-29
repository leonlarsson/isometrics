import { pointOnSpan, randomAt } from "./builder";
import { defineFenceStyle } from "./types";

const THICKNESS = 0.36;

export const hedge01 = defineFenceStyle({
	id: "hedge_01",
	name: "Hedge",
	description: "A clipped green hedge with a leafy top",
	keywords: ["hedge", "bush", "shrub", "garden", "park", "green", "boundary"],
	height: 0.5,
	postSpacing: 1.5,
	colors: [
		{ id: "leaves", name: "Leaves", default: "#4f8a3c" },
		{ id: "leafTops", name: "Leafy top", default: "#5f9b48" },
	],
	build: ({ layout, height, builder, colorIds }) => {
		const body = height * 0.82;
		// A block at each post fills the corners where two lengths of hedge meet.
		for (const post of layout.posts) {
			builder.post(post, { color: colorIds.leaves, width: THICKNESS, height: body, sink: 0 });
		}
		for (const span of layout.spans) {
			builder.beam(span, { color: colorIds.leaves, bottom: 0, top: body, thickness: THICKNESS });
			const count = Math.max(1, Math.round(span.length / 0.32));
			for (let i = 0; i <= count; i++) {
				const [x, base, z] = pointOnSpan(span, i / count);
				const wobble = randomAt(x, z);
				builder.lump(
					[x, base + body, z],
					[0.2 + 0.05 * wobble, height * 0.2 + 0.04 * randomAt(x, z, 2), THICKNESS * 0.54],
					{ color: colorIds.leafTops },
				);
			}
		}
	},
});
