import interUrl from "@fontsource/inter/files/inter-latin-600-normal.woff?url";
import { Text } from "@react-three/drei";
import { Suspense, useState } from "react";
import { z } from "zod";

import { formatEntry } from "#/scene/format";
import type { TDataEntry } from "#/scene/schema";

import { Box } from "../primitives";
import { definePart, type IPartRenderProps } from "../types";

// See docs/adr/0041-text-part-and-bundled-font.md.

const TextSchema = z.object({
	text: z.string().max(200).default("Text").describe("The words shown."),
	size: z.number().min(0.2).max(10).default(1).describe("Letter height in grid units."),
	layout: z
		.enum(["flat", "standing"])
		.default("flat")
		.describe(
			"flat = lying on the ground, read from the front (+z); standing = upright like a sign, facing +z and readable from both sides.",
		),
	dataKey: z
		.string()
		.default("")
		.describe("A data key whose value is shown after the text; empty = none."),
	plate: z.boolean().default(false).describe("A plate behind the text, in the accent colour."),
});

type TTextProps = z.output<typeof TextSchema>;

/** Average glyph width of Inter as a share of the letter height, for estimating the text's size. */
const GLYPH_WIDTH = 0.6;
/** Flat text and its plate sit this far above the ground, so they don't flicker against it. */
const LIFT = 0.02;
const PLATE_THICKNESS = 0.08;

/** What the part shows: its text, then the formatted value of its data key if it has one. */
const shownText = (p: TTextProps, data: TDataEntry[] | undefined) => {
	const value = p.dataKey ? formatEntry(data?.find((d) => d.key === p.dataKey)) : "";
	return [p.text.trim(), value].filter(Boolean).join(" ");
};

/** Space around the text on its plate. */
const platePadding = (p: TTextProps) => (p.plate ? p.size * 0.3 : 0);

/** Estimated width of the text (the real one is only known once troika has laid it out). */
const estimatedWidth = (p: TTextProps) =>
	Math.max(1, (p.text.trim().length + (p.dataKey ? 4 : 0)) * GLYPH_WIDTH) * p.size +
	platePadding(p) * 2;

const TextModel = ({ props: p, color, accent, data, onReady }: IPartRenderProps<TTextProps>) => {
	// The laid-out text's width and height, for sizing the plate.
	const [bounds, setBounds] = useState<[number, number]>([p.size, p.size]);
	const shown = shownText(p, data) || " ";
	const pad = platePadding(p);
	const [width, height] = bounds;

	const glyphs = (side: "front" | "back") => (
		<Text
			font={interUrl}
			fontSize={p.size}
			anchorX="center"
			anchorY={p.layout === "standing" ? "bottom" : "middle"}
			onSync={(mesh) => {
				if (side !== "front") {
					return;
				}
				const box = mesh.textRenderInfo?.blockBounds;
				if (box) {
					const next: [number, number] = [box[2] - box[0], box[3] - box[1]];
					// drei syncs on every render: only a real change may re-render, or it never stops.
					setBounds((prev) => (prev[0] === next[0] && prev[1] === next[1] ? prev : next));
				}
				onReady?.();
			}}
		>
			{shown}

			<meshStandardMaterial color={color} roughness={0.8} />
		</Text>
	);

	if (p.layout === "standing") {
		// Upright, facing +z, with a mirrored copy on the back so it reads from both sides.
		const face = p.plate ? PLATE_THICKNESS / 2 + 0.005 : 0.005;
		return (
			<group>
				{p.plate && (
					<Box
						size={[width + pad * 2, height + pad * 2, PLATE_THICKNESS]}
						position={[0, (height + pad * 2) / 2, 0]}
						color={accent}
					/>
				)}

				<group position={[0, pad, face]}>{glyphs("front")}</group>

				<group position={[0, pad, -face]} rotation={[0, Math.PI, 0]}>
					{glyphs("back")}
				</group>
			</group>
		);
	}

	// Lying on the ground, read from the front: the text's top points away from +z.
	const top = p.plate ? LIFT + PLATE_THICKNESS : LIFT;
	return (
		<group>
			{p.plate && (
				<Box
					size={[width + pad * 2, PLATE_THICKNESS, height + pad * 2]}
					position={[0, LIFT + PLATE_THICKNESS / 2, 0]}
					color={accent}
					castShadow={false}
				/>
			)}

			<group position={[0, top + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				{glyphs("front")}
			</group>
		</group>
	);
};

export const text = definePart({
	kind: "text",
	name: "Text",
	category: "markers",
	description:
		"Words in the world: a title or street name lying on the ground, or a sign standing up; can show a data value",
	keywords: ["label", "title", "sign", "words", "street name", "value", "number"],
	schema: TextSchema,
	fields: [
		{ key: "text", label: "Text", type: "text", placeholder: "Words to show" },
		{ key: "dataKey", label: "Value", type: "dataKey" },
		{ key: "size", label: "Size", type: "number", min: 0.2, max: 10, step: 0.1 },
		{
			key: "layout",
			label: "Layout",
			type: "select",
			options: [
				{ value: "flat", label: "Flat on the ground" },
				{ value: "standing", label: "Standing up" },
			],
		},
		{ key: "plate", label: "Show a plate", type: "boolean" },
	],
	defaultColor: (p) => p.text,
	defaultAccent: (p) => p.wall,
	colorLabel: "Letters",
	accentLabel: "Plate",
	footprint: (p) =>
		p.layout === "standing"
			? [estimatedWidth(p), p.plate ? PLATE_THICKNESS + 0.1 : 0.3]
			: [estimatedWidth(p), p.size * 1.2 + platePadding(p) * 2],
	height: (p) => (p.layout === "standing" ? p.size * 1.25 + platePadding(p) * 2 : 0.2),
	rendersAsync: true,
	Component: (props) => (
		<Suspense fallback={null}>
			<TextModel {...props} />
		</Suspense>
	),
});
