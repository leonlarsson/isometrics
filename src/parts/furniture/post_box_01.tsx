import { z } from "zod";

import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const PostBoxSchema = z.object({});

const HEIGHT = 1.45;
const RADIUS = 0.26;

export const postBox01 = definePart({
	kind: "post_box_01",
	name: "Post box",
	category: "furniture",
	description: "A round pillar box with a domed cap; its slot faces +Z",
	keywords: ["mail", "letter box", "pillar box", "post", "postal", "street furniture"],
	schema: PostBoxSchema,
	fields: [],
	colors: [
		{ id: "body", name: "Body", default: "#c8202a", legacy: "color" },
		{ id: "base", name: "Base", default: "#1f2022", legacy: "accent" },
	],
	footprint: () => [metres(RADIUS * 2 + 0.06), metres(RADIUS * 2 + 0.06)],
	height: () => metres(HEIGHT + 0.12),
	Component: ({ colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<mesh position={[0, 0.06, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[RADIUS + 0.03, RADIUS + 0.03, 0.12, 16]} />

				<Mat color={colors.base} />
			</mesh>

			<mesh position={[0, HEIGHT / 2 + 0.06, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[RADIUS, RADIUS, HEIGHT - 0.12, 16]} />

				<Mat color={colors.body} roughness={0.5} />
			</mesh>

			{/* The cap: a wider rim, and a dome on it. */}
			<mesh position={[0, HEIGHT, 0]} castShadow>
				<cylinderGeometry args={[RADIUS + 0.03, RADIUS + 0.03, 0.06, 16]} />

				<Mat color={colors.body} roughness={0.5} />
			</mesh>

			<mesh position={[0, HEIGHT + 0.03, 0]} castShadow>
				<sphereGeometry args={[RADIUS, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />

				<Mat color={colors.body} roughness={0.5} />
			</mesh>

			{/* The slot, and the collection times plate under it. */}
			<Box
				size={[0.22, 0.04, 0.04]}
				position={[0, HEIGHT - 0.2, RADIUS - 0.01]}
				color={colors.base}
				castShadow={false}
			/>

			<Box
				size={[0.16, 0.12, 0.02]}
				position={[0, HEIGHT - 0.42, RADIUS - 0.002]}
				color="#f4f1ea"
				castShadow={false}
			/>
		</group>
	),
});
