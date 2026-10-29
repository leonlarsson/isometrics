import { defineFenceStyle } from "./types";

export const guardRail01 = defineFenceStyle({
	id: "guard_rail_01",
	name: "Guard rail",
	description: "A roadside crash barrier: a steel beam on short posts",
	keywords: ["crash barrier", "road", "motorway", "highway", "barrier", "armco", "steel"],
	height: 0.3,
	postSpacing: 1,
	colors: [
		{ id: "beam", name: "Beam", default: "#c3c8cc" },
		{ id: "posts", name: "Posts", default: "#8b9196" },
	],
	build: ({ layout, height, builder, colorIds }) => {
		for (const post of layout.posts) {
			builder.post(post, {
				color: colorIds.posts,
				width: 0.05,
				depth: 0.07,
				height: height * 0.92,
			});
		}
		for (const span of layout.spans) {
			// Two ridges, like the W-shaped beam of a real barrier.
			for (const [bottom, top] of [
				[0.5, 0.7],
				[0.74, 0.94],
			]) {
				builder.beam(span, {
					color: colorIds.beam,
					bottom: height * bottom,
					top: height * top,
					thickness: 0.03,
					offset: -0.055,
					extend: 0.01,
				});
			}
		}
	},
});
