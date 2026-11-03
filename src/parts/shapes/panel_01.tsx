import * as THREE from "three";
import { z } from "zod";

import { definePart } from "../types";

import { SHAPE_COLORS, ShapeMesh, SIZE, sizeField, useShapeGeometry } from "./shapeKit";

const OPENINGS = [
	{ value: "none", label: "None" },
	{ value: "door", label: "Door" },
	{ value: "window", label: "Window" },
	{ value: "roundWindow", label: "Round window" },
	{ value: "arch", label: "Arch" },
] as const;

type TOpening = (typeof OPENINGS)[number]["value"];

const PanelSchema = z.object({
	width: z.number().min(SIZE.min).max(SIZE.max).default(1),
	height: z.number().min(SIZE.min).max(SIZE.max).default(1),
	thickness: z.number().min(0.01).max(SIZE.max).default(0.1),
	opening: z.enum(OPENINGS.map((o) => o.value) as [TOpening, ...TOpening[]]).default("none"),
	openingWidth: z.number().min(SIZE.min).max(SIZE.max).default(0.5),
	openingHeight: z.number().min(SIZE.min).max(SIZE.max).default(0.75),
});

type TPanel = z.output<typeof PanelSchema>;

/** The edge a panel keeps round an opening at least, so it holds together. */
const MARGIN = 0.05;

/** A panel's outline from the front, its opening cut out (a door or an arch from the ground up). */
const panelShape = (p: TPanel) => {
	const half = p.width / 2;
	const openWidth = Math.min(p.openingWidth, p.width - 2 * MARGIN);
	const open = openWidth / 2;
	const reachesGround = p.opening === "door" || p.opening === "arch";
	const openHeight = Math.min(p.openingHeight, p.height - (reachesGround ? MARGIN : 2 * MARGIN));
	const shape = new THREE.Shape();
	shape.moveTo(-half, 0);
	if (reachesGround) {
		shape.lineTo(-open, 0);
		if (p.opening === "arch") {
			// Straight sides up to where the round top begins (at least at the ground).
			const spring = Math.max(0, openHeight - open);
			const rise = openHeight - spring;
			shape.lineTo(-open, spring);
			shape.absellipse(0, spring, open, rise, Math.PI, 0, true, 0);
		} else {
			shape.lineTo(-open, openHeight);
			shape.lineTo(open, openHeight);
		}
		shape.lineTo(open, 0);
	}
	shape.lineTo(half, 0);
	shape.lineTo(half, p.height);
	shape.lineTo(-half, p.height);
	shape.closePath();
	// A window sits in the middle of the panel's height.
	const middle = p.height / 2;
	if (p.opening === "window") {
		const hole = new THREE.Path();
		hole.moveTo(-open, middle - openHeight / 2);
		hole.lineTo(open, middle - openHeight / 2);
		hole.lineTo(open, middle + openHeight / 2);
		hole.lineTo(-open, middle + openHeight / 2);
		hole.closePath();
		shape.holes.push(hole);
	} else if (p.opening === "roundWindow") {
		const hole = new THREE.Path();
		hole.absellipse(0, middle, open, openHeight / 2, 0, Math.PI * 2, false, 0);
		shape.holes.push(hole);
	}
	return shape;
};

export const panel01 = definePart({
	kind: "panel_01",
	name: "Panel",
	category: "shapes",
	description:
		"A flat upright panel of any width, height and thickness, facing the front (+Z): a wall, with a door, a window, a round window or an arch through it; lay it down for a floor or a roof",
	keywords: [
		"wall",
		"plane",
		"sheet",
		"plate",
		"board",
		"sign",
		"floor",
		"arch",
		"door",
		"window",
		"primitive",
		"shape",
	],
	schema: PanelSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("height", "Height"),
		{ key: "thickness", label: "Thickness", type: "number", min: 0.01, max: 5, step: 0.01 },
		{ key: "opening", label: "Opening", type: "select", options: [...OPENINGS] },
		sizeField("openingWidth", "Opening width"),
		sizeField("openingHeight", "Opening height"),
	],
	colors: SHAPE_COLORS,
	footprint: (p) => [p.width, p.thickness],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency }) => {
		const geometry = useShapeGeometry(
			`shape:panel:${p.width},${p.height},${p.thickness},${p.opening},${p.openingWidth},${p.openingHeight}`,
			() => {
				const extruded = new THREE.ExtrudeGeometry(panelShape(p), {
					depth: p.thickness,
					bevelEnabled: false,
					curveSegments: 16,
				});
				extruded.translate(0, 0, -p.thickness / 2);
				extruded.computeVertexNormals();
				return extruded;
			},
		);
		return (
			<ShapeMesh geometry={geometry} color={colors.surface} transparency={transparency.surface} />
		);
	},
});
