import { pointOnSpan, randomAt } from "./builder";
import { defineFenceStyle } from "./types";

/** How thick the wall is, and its top stones' share of its height. */
const THICKNESS = 0.26;
const TOP_STONES = 0.2;

export const stoneWall01 = defineFenceStyle({
	id: "stone_wall_01",
	name: "Stone wall",
	description: "A low dry-stone wall topped with a row of upright stones",
	keywords: ["wall", "stone", "rural", "dry stone", "boundary", "garden"],
	height: 0.4,
	postSpacing: 2,
	showsPosts: false,
	colors: [
		{ id: "stone", name: "Stone", default: "#a39a8c" },
		{ id: "topStones", name: "Top stones", default: "#8c8376" },
	],
	build: ({ layout, height, builder, colorIds }) => {
		const body = height * (1 - TOP_STONES);
		// A block at each post fills the corners where two lengths of wall meet.
		for (const post of layout.posts) {
			builder.post(post, { color: colorIds.stone, width: THICKNESS, height: body });
		}
		for (const span of layout.spans) {
			builder.beam(span, { color: colorIds.stone, bottom: 0, top: body, thickness: THICKNESS });
			// Upright stones along the top, each a little different.
			const count = Math.max(1, Math.round(span.length / 0.13));
			for (let i = 0; i < count; i++) {
				const t = (i + 0.5) / count;
				const [x, base, z] = pointOnSpan(span, t);
				const wobble = randomAt(x, z);
				const tall = height * TOP_STONES * (0.75 + 0.5 * wobble);
				builder.block(
					[x, base + body + tall / 2, z],
					span.direction,
					[(span.length / count) * 0.86, tall, THICKNESS * (0.92 + 0.12 * randomAt(x, z, 1))],
					{ color: colorIds.topStones },
				);
			}
		}
	},
});
