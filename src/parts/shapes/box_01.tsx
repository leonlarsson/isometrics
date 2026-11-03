import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { z } from "zod";

import { definePart } from "../types";

import {
	BoxMesh,
	finishField,
	type IShapeLook,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	ShapeMesh,
	SweptShape,
	shapeLights,
	sizeField,
	sizeProps,
	useShapeGeometry,
	wallsProfile,
	wallThicknessField,
	wallThicknessFor,
	wallThicknessProp,
} from "./shapeKit";

const BoxSchema = z.object({
	...lookProps,
	...sizeProps(),
	cornerRadius: z.number().min(0).max(25).default(0),
	isHollow: z.boolean().default(false),
	wallThickness: wallThicknessProp,
});

/** Round edges are drawn in this many flat facets, keeping the low-poly look. */
const ROUNDING_FACETS = 3;

/** A box with its edges rounded, up to half its smallest side. */
const RoundedBox = ({
	width,
	depth,
	height,
	radius,
	look,
}: {
	width: number;
	depth: number;
	height: number;
	radius: number;
	look: IShapeLook;
}) => {
	const round = Math.min(radius, Math.min(width, depth, height) / 2 - 0.001);
	const geometry = useShapeGeometry(`shape:roundedBox:${width},${depth},${height},${round}`, () =>
		new RoundedBoxGeometry(width, height, depth, ROUNDING_FACETS, round).translate(
			0,
			height / 2,
			0,
		),
	);
	return <ShapeMesh geometry={geometry} look={look} />;
};

export const box01 = definePart({
	kind: "box_01",
	name: "Box",
	category: "shapes",
	description:
		"A plain box of any width, depth and height: a block, a slab, a wall, a floor; its edges rounded (Rounded edges), or hollow, only its four walls",
	keywords: [
		"cube",
		"block",
		"cuboid",
		"slab",
		"brick",
		"rounded box",
		"bevel",
		"primitive",
		"shape",
		"wall",
		"floor",
	],
	schema: BoxSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		{
			key: "cornerRadius",
			label: "Rounded edges (solid only)",
			type: "number",
			min: 0,
			max: 5,
			step: 0.05,
		},
		{ key: "isHollow", label: "Hollow (only its walls)", type: "boolean" },
		wallThicknessField("wallThickness"),
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency, lights }) =>
		p.isHollow ? (
			<SweptShape
				name="box"
				options={{
					width: p.width,
					depth: p.depth,
					sideCount: 4,
					profile: wallsProfile(p.height, wallThicknessFor(p.width, p.depth, p.wallThickness)),
				}}
				look={lookOf({ props: p, colors, transparency, lights })}
			/>
		) : p.cornerRadius > 0 ? (
			<RoundedBox
				width={p.width}
				depth={p.depth}
				height={p.height}
				radius={p.cornerRadius}
				look={lookOf({ props: p, colors, transparency, lights })}
			/>
		) : (
			<BoxMesh
				size={[p.width, p.height, p.depth]}
				look={lookOf({ props: p, colors, transparency, lights })}
			/>
		),
});
