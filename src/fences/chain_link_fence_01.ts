import { defineFenceStyle } from "./types";

export const chainLinkFence01 = defineFenceStyle({
	id: "chain_link_fence_01",
	name: "Chain-link fence",
	description: "A tall wire mesh on round metal posts, round sites, depots and pitches",
	keywords: ["wire", "mesh", "security", "industrial", "site", "construction", "sports"],
	height: 0.85,
	postSpacing: 1.3,
	colors: [
		{ id: "posts", name: "Posts and top rail", default: "#8e979c" },
		{ id: "mesh", name: "Mesh", default: "#a9b3b8", seeThrough: { transparency: 0.55 } },
	],
	build: ({ layout, height, builder, colorIds }) => {
		for (const post of layout.posts) {
			builder.post(post, { color: colorIds.posts, width: 0.05, height, round: true });
		}
		for (const span of layout.spans) {
			builder.beam(span, {
				color: colorIds.posts,
				bottom: height - 0.035,
				top: height,
				thickness: 0.03,
			});
			builder.beam(span, {
				color: colorIds.mesh,
				bottom: 0.03,
				top: height - 0.035,
				thickness: 0.008,
				trim: 0.02,
			});
		}
	},
});
