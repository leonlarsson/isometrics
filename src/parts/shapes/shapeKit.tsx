import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";

import { lightEmission } from "../lights";
import { shareGeometryAs, type TV3 } from "../primitives";
import type {
	IColorSpec,
	ILightSpec,
	IPartRenderProps,
	IResolvedLight,
	TFieldSpec,
} from "../types";

/**
 * What every shape (the Shapes category) is built from: plain solids sized
 * freely on every axis, in grid units, flat-shaded so they keep the world's
 * low-poly look. Each stands on the ground with its footprint centred on its
 * origin and fills exactly its width (x) × depth (z) × height (y), so shapes
 * of the same sizes placed side by side or on top of each other meet.
 */

/** The smallest and largest a shape's sizes can be (from data, a file or an AI too). */
export const SIZE = { min: 0.05, max: 50 };

/**
 * Sizes set by hand go in quarters of a grid unit on the slider (from a
 * quarter up), so shapes fit the grid and each other; any size from 0.05 can
 * be typed. Thicknesses go finer.
 */
export const SIZE_STEP = 0.25;

const sizeProp = (size: number) => z.number().min(SIZE.min).max(SIZE.max).default(size);

/** A shape's width, depth and height: one grid unit each unless it says otherwise. */
export const sizeProps = ({ width = 1, depth = 1, height = 1 } = {}) => ({
	width: sizeProp(width),
	depth: sizeProp(depth),
	height: sizeProp(height),
});

export const sizeField = <K extends string>(key: K, label: string): TFieldSpec<K> => ({
	key,
	label,
	type: "number",
	min: SIZE.min,
	sliderMin: SIZE_STEP,
	max: SIZE.max,
	step: SIZE_STEP,
});

/** How many sides a round shape has: few for a faceted look, many for a smooth one. */
export const sideCountProp = (sides: number) => z.number().int().min(3).max(64).default(sides);

export const sideCountField = <K extends string>(key: K): TFieldSpec<K> => ({
	key,
	label: "Sides",
	type: "number",
	min: 3,
	max: 64,
	step: 1,
});

/** How much of the way round a round shape goes, in degrees: 360 is whole, 90 a quarter. */
export const arcAngleProp = z.number().min(1).max(360).default(360);

export const arcAngleField = <K extends string>(key: K): TFieldSpec<K> => ({
	key,
	label: "Arc (°)",
	type: "number",
	min: 1,
	max: 360,
	step: 1,
	presets: [
		{ label: "Quarter", value: 90 },
		{ label: "Half", value: 180 },
		{ label: "Three quarters", value: 270 },
		{ label: "Whole", value: 360 },
	],
});

/** Hollow shapes keep only their walls, this thick, open at their ends. */
export const wallThicknessProp = z.number().min(0.01).max(25).default(0.1);

export const wallThicknessField = <K extends string>(key: K): TFieldSpec<K> => ({
	key,
	label: "Wall thickness",
	type: "number",
	min: 0.01,
	max: 5,
	step: 0.01,
});

/**
 * Every shape's one colour: its surface. It can be made see-through like
 * glass (ADR-0090); solid, as it starts, copies of it are drawn together.
 */
export const SHAPE_COLORS = [
	{
		id: "surface",
		name: "Surface",
		// Mid grey, the colour presets' Grey.
		default: "#9a9a96",
		legacy: "color",
		seeThrough: { transparency: 0 },
	},
] as const satisfies readonly IColorSpec<"surface">[];

/** How a shape's surface takes the light: how rough or shiny, and whether it's metal. */
export const FINISHES = [
	{ value: "matte", label: "Matte" },
	{ value: "satin", label: "Satin" },
	{ value: "glossy", label: "Glossy" },
	{ value: "metal", label: "Metal" },
] as const;

export type TFinish = (typeof FINISHES)[number]["value"];

const FINISH_LOOKS: Record<TFinish, { roughness: number; metalness: number }> = {
	matte: { roughness: 0.85, metalness: 0 },
	satin: { roughness: 0.55, metalness: 0 },
	glossy: { roughness: 0.2, metalness: 0 },
	metal: { roughness: 0.35, metalness: 0.6 },
};

/** Settings every shape has besides its size: its finish. */
export const lookProps = {
	finish: z
		.enum(FINISHES.map((finish) => finish.value) as [TFinish, ...TFinish[]])
		.default("matte"),
};

export const finishField = <K extends string>(key: K): TFieldSpec<K> => ({
	key,
	label: "Finish",
	type: "select",
	options: [...FINISHES],
});

/**
 * Every shape's light: the whole shape glows, off until the object says
 * when (After dark, Always, On a schedule or From data, ADR-0058), so a shape
 * can be a lamp, a sign or a status light. Lights its surroundings from its
 * middle where the graphics settings draw real lights.
 */
export const shapeLights = <P extends { width: number; height: number }>(): ILightSpec<P>[] => [
	{
		id: "glow",
		name: "Glow",
		description: "The whole shape glows in this colour.",
		shape: "glow",
		whenOn: "off",
		realLight: (p) => ({ at: [0, p.height / 2, 0], reach: Math.max(p.width, p.height) + 1 }),
	},
];

/** What a shape's surface looks like right now: its colour, see-through, finish and glow. */
export interface IShapeLook {
	color: string;
	transparency: number;
	finish: TFinish;
	glow?: IResolvedLight;
}

export const lookOf = ({
	props,
	colors,
	transparency,
	lights,
}: Pick<
	IPartRenderProps<{ finish: TFinish }, "surface">,
	"props" | "colors" | "transparency" | "lights"
>): IShapeLook => ({
	color: colors.surface,
	transparency: transparency.surface,
	finish: props.finish,
	glow: lights.glow,
});

/**
 * A shape's material: flat-shaded, in its finish, glowing while its glow is
 * on, see-through only while its transparency is above 0.
 */
export const ShapeMat = ({ look }: { look: IShapeLook }) => {
	const { color, transparency, finish, glow } = look;
	const isSeeThrough = transparency > 0;
	const { roughness, metalness } = FINISH_LOOKS[finish];
	const { emissive, emissiveIntensity } = glow
		? lightEmission(glow)
		: { emissive: undefined, emissiveIntensity: 0 };
	// A new material when it turns see-through or solid, every setting given: one kept from glass
	// would stay at its opacity (invisible after 100%) while copies of solid ones are drawn together.
	return (
		<meshStandardMaterial
			key={isSeeThrough ? "seeThrough" : "solid"}
			color={color}
			roughness={isSeeThrough ? Math.min(roughness, 0.4) : roughness}
			metalness={metalness}
			flatShading
			emissive={emissive ?? "#000000"}
			emissiveIntensity={emissiveIntensity}
			transparent={isSeeThrough}
			forceSinglePass={isSeeThrough}
			opacity={isSeeThrough ? 1 - transparency : 1}
			depthWrite={!isSeeThrough}
		/>
	);
};

/** A mesh of a shape: casts and takes shadows, in the shape's material. */
export const ShapeMesh = ({
	geometry,
	position,
	scale,
	look,
}: {
	geometry: THREE.BufferGeometry;
	position?: TV3;
	scale?: TV3;
	look: IShapeLook;
}) => (
	<mesh
		geometry={geometry}
		position={position}
		scale={scale}
		castShadow={look.transparency < 0.5}
		receiveShadow
	>
		<ShapeMat look={look} />
	</mesh>
);

/** A geometry built once per key (which must say everything it depends on), disposed when it changes. */
export const useShapeGeometry = (key: string, build: () => THREE.BufferGeometry) => {
	// The key says everything build reads.
	const geometry = useMemo(() => shareGeometryAs(build(), key), [key]);
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);
	return geometry;
};

/**
 * One point of a round shape's outline, seen from the side: how far out from
 * its middle as a share of its half width and half depth (`out`, 1 at the
 * edge), less `inset` grid units (a hollow shape's inner wall, a ring's
 * hole), and how high.
 */
export interface IProfilePoint {
	out: number;
	inset?: number;
	y: number;
}

export interface ISweepOptions {
	width: number;
	depth: number;
	/** Its outline from the side, a closed loop (the last point joins the first). */
	profile: readonly IProfilePoint[];
	sideCount: number;
	/** How far round it goes, in degrees (360 if left out): from the back (−Z), clockwise seen from above. */
	arcAngle?: number;
}

const TURN = Math.PI * 2;

/**
 * A shape swept round its upright axis from its outline (`profile`): the
 * cylinder, cone, ball, dome, capsule, ring and pyramid. Whole, a flat side
 * faces the front (+Z) and it fills exactly `width` × `depth` whatever its
 * number of sides (four sides make a box); part of the way round, its cut
 * ends are closed. Flat-shaded, so each face reads as a facet.
 */
export const sweptGeometry = ({
	width,
	depth,
	profile,
	sideCount,
	arcAngle = 360,
}: ISweepOptions): THREE.BufferGeometry => {
	const isWhole = arcAngle >= 360;
	const arc = (Math.min(arcAngle, 360) / 360) * TURN;
	const segmentCount = isWhole ? sideCount : Math.max(1, Math.ceil((sideCount * arcAngle) / 360));
	// Angles from the back (−Z), clockwise seen from above (towards +X). Whole, a side's middle is at the front.
	const angles = isWhole
		? Array.from(
				{ length: sideCount },
				(_, i) => Math.PI + Math.PI / sideCount + (TURN * i) / sideCount,
			)
		: Array.from({ length: segmentCount + 1 }, (_, i) => (arc * i) / segmentCount);
	// Whole, stretched so its corners (or flat sides) reach exactly the footprint's edges.
	// (Odd numbers of sides reach further back than forward: centred on the footprint once built.)
	const spanOf = (values: number[]) => (Math.max(...values) - Math.min(...values)) / 2;
	const reachX = isWhole ? spanOf(angles.map(Math.sin)) : 1;
	const reachZ = isWhole ? spanOf(angles.map(Math.cos)) : 1;
	const at = (point: IProfilePoint, angle: number) => {
		const inset = point.inset ?? 0;
		const rx = (Math.max(0, point.out * (width / 2 - inset)) / reachX) * Math.sin(angle);
		const rz = (Math.max(0, point.out * (depth / 2 - inset)) / reachZ) * -Math.cos(angle);
		return new THREE.Vector3(rx, point.y, rz);
	};
	// How far from the axis each point is along an angle's direction, to find which way is out.
	const reachAlong = (point: IProfilePoint, angle: number) => {
		const p = at(point, angle);
		return Math.hypot(p.x, p.z);
	};
	const count = profile.length;
	const middleAngle = isWhole ? 0 : arc / 2;
	let area = 0;
	for (let j = 0; j < count; j++) {
		const p = profile[j];
		const q = profile[(j + 1) % count];
		area += reachAlong(p, middleAngle) * q.y - reachAlong(q, middleAngle) * p.y;
	}
	const turning = area >= 0 ? 1 : -1;

	const positions: number[] = [];
	const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3) => {
		const normal = b.clone().sub(a).cross(c.clone().sub(a));
		if (normal.lengthSq() < 1e-14) {
			return;
		}
		const [first, second] = normal.dot(out) >= 0 ? [b, c] : [c, b];
		positions.push(a.x, a.y, a.z, first.x, first.y, first.z, second.x, second.y, second.z);
	};

	const ringCount = isWhole ? sideCount : segmentCount;
	for (let i = 0; i < ringCount; i++) {
		const a0 = angles[i];
		const a1 = isWhole ? angles[(i + 1) % sideCount] : angles[i + 1];
		const middle = isWhole ? a0 + Math.PI / sideCount : (a0 + a1) / 2;
		const radial = new THREE.Vector3(Math.sin(middle), 0, -Math.cos(middle));
		for (let j = 0; j < count; j++) {
			const p = profile[j];
			const q = profile[(j + 1) % count];
			// Out from the outline's inside, in the plane through the axis.
			const ds = reachAlong(q, middle) - reachAlong(p, middle);
			const dy = q.y - p.y;
			const out = radial
				.clone()
				.multiplyScalar(turning * dy)
				.add(new THREE.Vector3(0, -turning * ds, 0));
			const v00 = at(p, a0);
			const v01 = at(q, a0);
			const v10 = at(p, a1);
			const v11 = at(q, a1);
			triangle(v00, v10, v11, out);
			triangle(v00, v11, v01, out);
		}
	}

	// Part of the way round: close each cut end with the outline.
	if (!isWhole) {
		const contour = profile.map(
			(p) => new THREE.Vector2(p.out * (width / 2 - (p.inset ?? 0)), p.y),
		);
		const faces = THREE.ShapeUtils.triangulateShape(contour, []);
		for (const [angle, facing] of [
			[0, -1],
			[arc, 1],
		] as const) {
			const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(facing);
			for (const [a, b, c] of faces) {
				triangle(at(profile[a], angle), at(profile[b], angle), at(profile[c], angle), out);
			}
		}
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	if (isWhole) {
		geometry.computeBoundingBox();
		const box = geometry.boundingBox ?? new THREE.Box3();
		geometry.translate(-(box.min.x + box.max.x) / 2, 0, -(box.min.z + box.max.z) / 2);
	}
	return geometry;
};

/** Points along a quarter or half circle, `steps` pieces from `from` to `to` (radians). */
export const arcSteps = (steps: number, from: number, to: number) =>
	Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps);

/** A key for a swept shape's geometry from everything it depends on. */
export const sweepKey = (name: string, options: ISweepOptions) =>
	`shape:${name}:${options.width},${options.depth},${options.sideCount},${options.arcAngle ?? 360}:${options.profile
		.map((p) => `${p.out.toFixed(4)}/${(p.inset ?? 0).toFixed(4)}/${p.y.toFixed(4)}`)
		.join(";")}`;

/** A swept shape as a mesh, its geometry shared by every copy of the same shape and sizes. */
export const SweptShape = ({
	name,
	options,
	look,
}: {
	name: string;
	options: ISweepOptions;
	look: IShapeLook;
}) => {
	const geometry = useShapeGeometry(sweepKey(name, options), () => sweptGeometry(options));
	return <ShapeMesh geometry={geometry} look={look} />;
};

/** A hollow shape's walls from the side: `thickness` thick, open at the bottom and top. */
export const wallsProfile = (height: number, thickness: number): IProfilePoint[] => [
	{ out: 1, y: 0 },
	{ out: 1, y: height },
	{ out: 1, inset: thickness, y: height },
	{ out: 1, inset: thickness, y: 0 },
];

/** A wall thickness that leaves a hole: less than half the narrower side. */
export const wallThicknessFor = (width: number, depth: number, thickness: number) =>
	Math.min(thickness, Math.min(width, depth) / 2 - 0.005);

/** A plain box of any size standing on the ground, from a box of one unit (shared by every size). */
export const BoxMesh = ({
	size: [x, y, z],
	position = [0, 0, 0],
	look,
}: {
	size: TV3;
	position?: TV3;
	look: IShapeLook;
}) => (
	<mesh
		position={[position[0], position[1] + y / 2, position[2]]}
		scale={[x, y, z]}
		castShadow={look.transparency < 0.5}
		receiveShadow
	>
		<boxGeometry args={[1, 1, 1]} />

		<ShapeMat look={look} />
	</mesh>
);

/**
 * A straight solid from a flat outline: `outline` is its cross-section in the
 * side view (z towards the front, y up), drawn out along X `length` long and
 * centred on the origin.
 */
export const prismGeometry = (outline: readonly [z: number, y: number][], length: number) => {
	const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(-z, y)));
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
	geometry.translate(0, 0, -length / 2);
	geometry.rotateY(Math.PI / 2);
	geometry.computeVertexNormals();
	return geometry;
};

/**
 * A solid from its corners and faces (each face its corners' indices, any
 * order round): every face is turned to point away from the middle, so a
 * convex shape comes out closed and the right way out.
 */
export const solidGeometry = (corners: readonly TV3[], faces: readonly number[][]) => {
	const points = corners.map((corner) => new THREE.Vector3(...corner));
	const middle = points
		.reduce((sum, point) => sum.add(point), new THREE.Vector3())
		.divideScalar(points.length);
	const positions: number[] = [];
	for (const face of faces) {
		const ring = face.map((index) => points[index]);
		const normal = ring[1].clone().sub(ring[0]).cross(ring[2].clone().sub(ring[0]));
		const centre = ring
			.reduce((sum, point) => sum.add(point), new THREE.Vector3())
			.divideScalar(ring.length);
		const ordered = normal.dot(centre.sub(middle)) < 0 ? [...ring].reverse() : ring;
		for (let i = 1; i < ordered.length - 1; i++) {
			for (const point of [ordered[0], ordered[i], ordered[i + 1]]) {
				positions.push(point.x, point.y, point.z);
			}
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return geometry;
};
