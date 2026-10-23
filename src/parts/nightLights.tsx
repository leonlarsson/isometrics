import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import type { IScenePalette } from "#/scene/theme";

import { jitter } from "./primitives";

/**
 * What parts light up after dark (ADR-0052): headlights, pools of lamplight
 * and lit windows. Each draws nothing by day (`palette.night` is 0) and grows
 * brighter as the night deepens.
 */

type TV3 = [number, number, number];

/**
 * Light painted on the ground lies this high: above roads and flat areas at
 * ground level (roads stack up to about 0.05), so it isn't cut off where it
 * reaches over one. Bridges and buildings still cover it.
 */
const GLOW_HEIGHT = 0.1;

/** One soft round glow for every pool of light: bright in the middle, fading to nothing. */
let glow: THREE.CanvasTexture | null = null;
const getGlow = () => {
	if (glow || typeof document === "undefined") {
		return glow;
	}
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return null;
	}
	// An alpha map is read from the colour, not the canvas's transparency: white = lit, black = none.
	const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, "#ffffff");
	gradient.addColorStop(0.3, "#9a9a9a");
	gradient.addColorStop(0.65, "#2e2e2e");
	gradient.addColorStop(1, "#000000");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 64, 64);
	glow = new THREE.CanvasTexture(canvas);
	return glow;
};

/** A soft glow of `color` on the ground, `radius` across, lighting what's under it. */
const GroundGlow = ({
	color,
	radius,
	strength,
	position,
}: {
	color: string;
	radius: number;
	strength: number;
	position: TV3;
}) => (
	<mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
		<planeGeometry args={[radius * 2, radius * 2]} />

		<meshBasicMaterial
			color={color}
			alphaMap={getGlow()}
			transparent
			opacity={strength}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
			toneMapped={false}
		/>
	</mesh>
);

/** How far a headlight beam reaches along the road, and how wide it gets there (ground units). */
const BEAM_LENGTH = 2.4;
const BEAM_WIDTH = 1.5;

/**
 * One beam shape for every vehicle: a fan of light along +u that starts as
 * wide as the headlights (the middle half of the texture's height) and opens
 * out to its full height, brightest at the lights and fading with distance,
 * with soft sides. Greyscale, for an alpha map (white = lit).
 */
let beam: THREE.CanvasTexture | null = null;
const getBeam = () => {
	if (beam || typeof document === "undefined") {
		return beam;
	}
	const width = 64;
	const height = 32;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return null;
	}
	const image = ctx.createImageData(width, height);
	for (let u = 0; u < width; u++) {
		const along = u / (width - 1);
		// Half as wide as the texture at the lights, the full height at the far end.
		const half = (height / 2) * (0.5 + 0.5 * along);
		// Fades in over the first few pixels (no hard edge at the bumper), then out with distance.
		const fade = Math.min(1, along * 12) * (1 - along) ** 1.6;
		for (let v = 0; v < height; v++) {
			const fromMiddle = Math.abs(v + 0.5 - height / 2);
			const side = Math.min(1, Math.max(0, (half - fromMiddle) / (half * 0.45)));
			const value = Math.round(255 * fade * side);
			const i = (v * width + u) * 4;
			image.data.set([value, value, value, 255], i);
		}
	}
	ctx.putImageData(image, 0, 0);
	beam = new THREE.CanvasTexture(canvas);
	return beam;
};

/** Two headlights at a vehicle's front (+x), `spread` apart sideways; on only while it drives. */
export const Headlights = ({
	palette,
	driving,
	position: [x, y, z],
	spread,
}: {
	palette: IScenePalette;
	driving: boolean | undefined;
	position: TV3;
	spread: number;
}) => {
	if (palette.night === 0 || !driving) {
		return null;
	}
	return (
		<group position={[x, y, z]}>
			{[spread / 2, -spread / 2].map((side) => (
				<mesh key={side} position={[0, 0, side]}>
					<boxGeometry args={[0.04, 0.07, 0.12]} />

					<meshBasicMaterial color={palette.lamplight} toneMapped={false} />
				</mesh>
			))}

			{/* The beams on the road ahead, opening out from the lights. */}
			<mesh position={[BEAM_LENGTH / 2, -y + GLOW_HEIGHT, -z]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[BEAM_LENGTH, Math.max(BEAM_WIDTH, spread * 2)]} />

				<meshBasicMaterial
					color={palette.lamplight}
					alphaMap={getBeam()}
					transparent
					opacity={0.6 * palette.night}
					blending={THREE.AdditiveBlending}
					depthWrite={false}
					toneMapped={false}
				/>
			</mesh>
		</group>
	);
};

/** A soft pool of light on the ground around a lamp. */
export const LightPool = ({ palette, radius }: { palette: IScenePalette; radius: number }) => {
	if (palette.night === 0) {
		return null;
	}
	return (
		<GroundGlow
			color={palette.lamplight}
			radius={radius}
			strength={0.8 * palette.night}
			position={[0, GLOW_HEIGHT, 0]}
		/>
	);
};

/** Cells across and up the shared pattern of lit and dark windows. */
const PATTERN = 16;
/** Pixels per cell in the pattern; a lit window fills all but a hair of its cell. */
const CELL = 8;

/** One pattern of lit and dark windows for every building: warm, a few cooler or brighter. */
let windowPattern: THREE.CanvasTexture | null = null;
const getWindowPattern = () => {
	if (windowPattern || typeof document === "undefined") {
		return windowPattern;
	}
	const canvas = document.createElement("canvas");
	canvas.width = PATTERN * CELL;
	canvas.height = PATTERN * CELL;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return null;
	}
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	for (let row = 0; row < PATTERN; row++) {
		// Floors differ: some mostly lit (people working late), most only here and there.
		const busy = 0.12 + 0.6 * jitter(row + 101) ** 2;
		for (let column = 0; column < PATTERN; column++) {
			if (jitter(row * PATTERN + column + 7) > busy) {
				continue;
			}
			// Mostly warm lamplight, some cool screens, a few dimmer.
			const tone = jitter(row * PATTERN + column + 211);
			ctx.fillStyle = tone > 0.9 ? "#8fb4e0" : tone > 0.7 ? "#b9853e" : "#e3a14c";
			// The whole pane between the frame lines, a little brighter at the top (the ceiling lamp).
			ctx.fillRect(column * CELL, row * CELL, CELL, CELL);
			ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
			ctx.fillRect(column * CELL, row * CELL, CELL, 2);
		}
	}
	windowPattern = new THREE.CanvasTexture(canvas);
	windowPattern.colorSpace = THREE.SRGBColorSpace;
	windowPattern.magFilter = THREE.NearestFilter;
	windowPattern.wrapS = THREE.RepeatWrapping;
	windowPattern.wrapT = THREE.RepeatWrapping;
	return windowPattern;
};

interface ILitWindowsProps {
	palette: IScenePalette;
	/** The building's own colour: dark windows look like the wall, lit ones glow out of it. */
	color: string;
	/** The building's body: the windows sit on its four faces. */
	width: number;
	depth: number;
	height: number;
	/** How many windows across the x and z faces, and how many floors. */
	columnsX: number;
	columnsZ: number;
	floors: number;
	/** Picks a different part of the pattern, so neighbouring buildings differ. */
	seed: number;
}

/**
 * Lit windows on a building's four faces at night: a pattern of lit and dark
 * cells, one per window, just outside its walls (under its window grid).
 */
export const LitWindows = ({
	palette,
	color,
	width,
	depth,
	height,
	columnsX,
	columnsZ,
	floors,
	seed,
}: ILitWindowsProps) => {
	const pattern = getWindowPattern();
	// Each face its own copy (sharing the image), repeated to one cell per window.
	const faces = useMemo(() => {
		const face = (columns: number, offset: number) => {
			if (!pattern) {
				return null;
			}
			const texture = pattern.clone();
			texture.repeat.set(columns / PATTERN, floors / PATTERN);
			// Shifted by whole cells, so lit panes stay in line with the window grid.
			texture.offset.set(
				Math.floor(jitter(seed + offset) * PATTERN) / PATTERN,
				Math.floor(jitter(seed + offset + 3) * PATTERN) / PATTERN,
			);
			texture.needsUpdate = true;
			return texture;
		};
		return [face(columnsX, 1), face(columnsZ, 2), face(columnsX, 3), face(columnsZ, 4)];
	}, [pattern, columnsX, columnsZ, floors, seed]);
	useLayoutEffect(
		() => () => {
			for (const texture of faces) {
				texture?.dispose();
			}
		},
		[faces],
	);

	if (palette.night === 0 || !pattern) {
		return null;
	}
	const sides: { position: TV3; rotation: number; size: number }[] = [
		{ position: [0, height / 2, depth / 2 + 0.012], rotation: 0, size: width },
		{ position: [width / 2 + 0.012, height / 2, 0], rotation: Math.PI / 2, size: depth },
		{ position: [0, height / 2, -depth / 2 - 0.012], rotation: Math.PI, size: width },
		{ position: [-width / 2 - 0.012, height / 2, 0], rotation: -Math.PI / 2, size: depth },
	];
	return (
		<group>
			{sides.map((side, i) => (
				<mesh key={side.rotation} position={side.position} rotation={[0, side.rotation, 0]}>
					<planeGeometry args={[side.size, height]} />

					<meshStandardMaterial
						color={color}
						emissive="#ffffff"
						emissiveMap={faces[i]}
						emissiveIntensity={palette.night}
						roughness={0.6}
					/>
				</mesh>
			))}
		</group>
	);
};
