import { defineFenceStyle } from "./types";

export const railFence01 = defineFenceStyle({
	id: "rail_fence_01",
	name: "Rail fence",
	description: "A farm's wooden posts with three rails between them",
	keywords: ["farm", "field", "paddock", "ranch", "wooden", "pasture"],
	height: 0.48,
	postSpacing: 1.3,
	colors: [
		{ id: "posts", name: "Posts", default: "#7a5534" },
		{ id: "rails", name: "Rails", default: "#9c7148" },
	],
	build: ({ layout, height, builder, colorIds }) => {
		for (const post of layout.posts) {
			builder.post(post, { color: colorIds.posts, width: 0.08, height });
		}
		for (const span of layout.spans) {
			for (const at of [0.3, 0.6, 0.88]) {
				builder.beam(span, {
					color: colorIds.rails,
					bottom: height * at - 0.035,
					top: height * at,
					thickness: 0.035,
					offset: 0.045,
					extend: 0.03,
				});
			}
		}
	},
});
