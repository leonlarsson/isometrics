import { z } from "zod";

import { LitWindows } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { WindowGrid, windowColumns } from "./windowKit";

const FLOOR_HEIGHT = 0.85;
const PARAPET = 0.1;
/** Wide classroom windows: most of their cell across, half of it up. */
const PANE: [number, number] = [0.75, 0.5];

const SchoolSchema = z.object({
	width: z.number().min(2).max(14).default(5),
	depth: z.number().min(1.5).max(8).default(2.2),
	floorCount: z.number().int().min(1).max(4).default(2),
	showsFlagpole: z.boolean().default(true),
});

export const school01 = definePart({
	kind: "school_01",
	name: "School",
	category: "buildings",
	description:
		"Long school building with wide classroom windows, an entrance porch and a flagpole; its front faces +Z",
	keywords: ["school", "college", "academy", "education", "classroom", "building"],
	schema: SchoolSchema,
	renamedProps: { showFlagpole: "showsFlagpole" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 2, max: 14, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1.5, max: 8, step: 0.1 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 1, max: 4, step: 1 },
		{ key: "showsFlagpole", label: "Show the flagpole", type: "boolean" },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#c98b5e", legacy: "color" },
		{ id: "trim", name: "Roof edge and porch", default: "#efe9dd", legacy: "accent" },
		{ id: "flag", name: "Flag", default: "#3d4fd6" },
	],
	lights: [
		{
			id: "windows",
			name: "Classroom lights",
			description: "Lights left on in the classrooms.",
			shape: "windows",
			color: "#f6f0dc",
			litPaneShare: 0.25,
			comesOn: "oneByOne",
			realLight: (p) => ({ at: [0, 1, p.depth / 2 + 1.3], reach: p.width }),
		},
	],
	footprint: (p) => [p.width + (p.showsFlagpole ? 0.8 : 0), p.depth + 0.6],
	height: (p) => p.floorCount * FLOOR_HEIGHT + PARAPET,
	Component: ({ props: p, colors, palette, lights }) => {
		const height = p.floorCount * FLOOR_HEIGHT;
		const columnsX = windowColumns(p.width, 0.8);
		const columnsZ = windowColumns(p.depth, 0.8);
		const front = p.depth / 2;
		return (
			<group>
				<Box size={[p.width, height, p.depth]} position={[0, height / 2, 0]} color={colors.walls} />

				<Box
					size={[p.width + 0.08, PARAPET, p.depth + 0.08]}
					position={[0, height + PARAPET / 2, 0]}
					color={colors.trim}
				/>

				<WindowGrid
					width={p.width}
					depth={p.depth}
					height={height}
					columnsX={columnsX}
					columnsZ={columnsZ}
					floors={p.floorCount}
					paneSize={PANE}
					color={palette.glass}
				/>

				<LitWindows
					lights={[lights.windows]}
					width={p.width}
					depth={p.depth}
					height={height}
					columnsX={columnsX}
					columnsZ={columnsZ}
					floors={p.floorCount}
					seed={Math.round(p.width * 17) + p.floorCount}
					paneSize={PANE}
				/>

				{/* The entrance: a porch roof on two posts over double doors. */}
				<Box
					size={[0.7, FLOOR_HEIGHT * 0.75, 0.05]}
					position={[0, (FLOOR_HEIGHT * 0.75) / 2, front + 0.03]}
					color={palette.glass}
					castShadow={false}
				/>

				<Box
					size={[1.2, 0.08, 0.55]}
					position={[0, FLOOR_HEIGHT * 0.85, front + 0.27]}
					color={colors.trim}
				/>

				{[0.55, -0.55].map((x) => (
					<Box
						key={x}
						size={[0.06, FLOOR_HEIGHT * 0.85, 0.06]}
						position={[x, (FLOOR_HEIGHT * 0.85) / 2, front + 0.5]}
						color={colors.trim}
					/>
				))}

				{p.showsFlagpole && (
					<group position={[p.width / 2 + 0.4, 0, front + 0.3]}>
						<mesh position={[0, 1.1, 0]} castShadow>
							<cylinderGeometry args={[0.02, 0.025, 2.2, 6]} />

							<Mat color={palette.trim} />
						</mesh>

						<Box size={[0.32, 0.2, 0.01]} position={[0.17, 2.05, 0]} color={colors.flag} />
					</group>
				)}
			</group>
		);
	},
});
