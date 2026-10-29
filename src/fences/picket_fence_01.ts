import { placesAlong, pointOnSpan } from "./builder";
import { defineFenceStyle } from "./types";

/** A picket's outline: a flat board with a pointed top, [along, up] as a share of its width and height. */
const PICKET = [
	[-0.5, 0],
	[0.5, 0],
	[0.5, 0.86],
	[0, 1],
	[-0.5, 0.86],
] as const;

export const picketFence01 = defineFenceStyle({
	id: "picket_fence_01",
	name: "Picket fence",
	description: "White garden pickets with pointed tops on two rails",
	keywords: ["garden", "picket", "white", "cottage", "yard"],
	height: 0.42,
	postSpacing: 0.9,
	colors: [
		{ id: "pickets", name: "Pickets", default: "#f3efe6" },
		{ id: "posts", name: "Posts and rails", default: "#ded8ca" },
	],
	build: ({ layout, height, builder, colorIds }) => {
		for (const post of layout.posts) {
			builder.post(post, {
				color: colorIds.posts,
				width: 0.07,
				height: height * 0.96,
				cap: 0.04,
			});
		}
		for (const span of layout.spans) {
			for (const bottom of [0.22, 0.68]) {
				builder.beam(span, {
					color: colorIds.posts,
					bottom: height * bottom,
					top: height * bottom + 0.035,
					thickness: 0.025,
					offset: 0.03,
				});
			}
			for (const t of placesAlong(span, 0.12, 0.05)) {
				builder.profile(
					pointOnSpan(span, t),
					span.direction,
					PICKET.map(([u, v]) => [u * 0.065, 0.02 + v * height * 0.88] as const),
					{ color: colorIds.pickets, thickness: 0.018, offset: 0.055 },
				);
			}
		}
	},
});
