import { placesAlong, pointOnSpan } from "./builder";
import { defineFenceStyle } from "./types";

export const railing01 = defineFenceStyle({
	id: "railing_01",
	name: "Railing",
	description: "A dark metal railing with thin bars, along quays, bridges and steps",
	keywords: ["metal", "iron", "balustrade", "quay", "bridge", "promenade", "handrail"],
	height: 0.42,
	postSpacing: 1,
	colors: [{ id: "metal", name: "Metal", default: "#3b4248" }],
	build: ({ layout, height, builder, colorIds }) => {
		for (const post of layout.posts) {
			builder.post(post, { color: colorIds.metal, width: 0.045, height: height + 0.01 });
		}
		for (const span of layout.spans) {
			builder.beam(span, {
				color: colorIds.metal,
				bottom: height - 0.03,
				top: height,
				thickness: 0.04,
			});
			builder.beam(span, {
				color: colorIds.metal,
				bottom: 0.05,
				top: 0.075,
				thickness: 0.02,
			});
			for (const t of placesAlong(span, 0.1, 0.04)) {
				const [x, base, z] = pointOnSpan(span, t);
				builder.block(
					[x, base + (height + 0.04) / 2, z],
					span.direction,
					[0.012, height - 0.04, 0.012],
					{
						color: colorIds.metal,
					},
				);
			}
		}
	},
});
