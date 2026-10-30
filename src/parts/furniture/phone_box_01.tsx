import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const PhoneBoxSchema = z.object({});

/** The box, in metres: how wide (square), and how tall to the top of its crown. */
const SIZE = { width: 0.95, height: 2.45 };
/** Rows of small panes up each side. */
const PANE_ROWS = 6;

export const phoneBox01 = definePart({
	kind: "phone_box_01",
	name: "Phone box",
	category: "furniture",
	description:
		"A classic telephone kiosk with rows of small windows, a domed crown and a lit sign; its door faces +Z",
	keywords: ["telephone", "kiosk", "call box", "booth", "red", "street furniture"],
	schema: PhoneBoxSchema,
	fields: [],
	colors: [{ id: "body", name: "Body", default: "#c8202a", legacy: "color" }],
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			description: "The light inside, through its windows, and the sign over the door.",
			shape: "glow",
			color: "#fff1c9",
		},
	],
	footprint: () => [metres(SIZE.width), metres(SIZE.width)],
	height: () => metres(SIZE.height),
	Component: ({ colors, palette, lights }) => {
		const half = SIZE.width / 2;
		const wall = SIZE.height - 0.45;
		const paneHeight = (wall - 0.55) / PANE_ROWS;
		return (
			// Drawn in metres.
			<group scale={UNITS_PER_METRE}>
				<Box
					size={[SIZE.width, wall, SIZE.width]}
					position={[0, wall / 2, 0]}
					color={colors.body}
				/>

				{/* Rows of small panes on all four sides, glowing from inside after dark. */}
				{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
					<group key={turn} rotation={[0, turn, 0]}>
						{Array.from({ length: PANE_ROWS }, (_, row) => 0.45 + paneHeight * (row + 0.5)).flatMap(
							(y) =>
								[-0.17, 0, 0.17].map((x) => (
									<Box
										key={`${y}:${x}`}
										size={[0.14, paneHeight - 0.05, 0.02]}
										position={[x, y, half + 0.002]}
										color={palette.glass}
										castShadow={false}
										{...lightEmission(lights.lamp, 0.9)}
									/>
								)),
						)}

						{/* The sign band over the windows. */}
						<Box
							size={[0.6, 0.12, 0.02]}
							position={[0, wall - 0.12, half + 0.004]}
							color="#f4f1ea"
							castShadow={false}
							{...lightEmission(lights.lamp, 1.4)}
						/>
					</group>
				))}

				{/* The crown: a stepped top, and a shallow dome. */}
				<Box
					size={[SIZE.width + 0.06, 0.12, SIZE.width + 0.06]}
					position={[0, wall + 0.06, 0]}
					color={colors.body}
				/>

				<mesh position={[0, wall + 0.12, 0]} castShadow>
					<cylinderGeometry args={[0.3, SIZE.width / 2 + 0.02, 0.24, 4, 1, false, Math.PI / 4]} />

					<Mat color={colors.body} flat />
				</mesh>

				<mesh position={[0, wall + 0.36, 0]} castShadow>
					<sphereGeometry args={[0.24, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />

					<Mat color={colors.body} />
				</mesh>
			</group>
		);
	},
});
