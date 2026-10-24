import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { jitter, Mat } from "./primitives";
import type { IResolvedLight } from "./types";

/**
 * Drawing parts' lights (ADR-0052, ADR-0058): a part declares its lights,
 * `resolveLights` (lightModel.ts) works out each one's state, and these
 * helpers draw a resolved light where the part puts it: a glowing surface,
 * a lens, headlight beams, a pool on the ground, lit windows. Each draws its
 * light only while it's on, as bright as its `level`. All cheap: emissive or
 * unlit materials and additive discs, no real light sources.
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

/**
 * For a part's own glowing surfaces (cabins, doorways, a lamp's bulb): Box or
 * Mat props that make it glow in the light's colour while it's on, `intensity`
 * times as bright as its level.
 */
export const lightEmission = (light: IResolvedLight, intensity = 1) =>
	light.on
		? { emissive: light.color, emissiveIntensity: intensity * light.level }
		: { emissive: undefined, emissiveIntensity: 0 };

/**
 * A small light's lens (a rain light, a tail light): glowing in the light's
 * colour while it's on, unshaded and past tone mapping like headlights so it
 * keeps its colour; a dark lens in a shade of it while it's off.
 */
export const LightLens = ({
	light,
	size,
	position,
}: {
	light: IResolvedLight;
	size: TV3;
	position: TV3;
}) => {
	const lens = useMemo(
		() => `#${new THREE.Color(light.color).multiplyScalar(0.3).getHexString()}`,
		[light.color],
	);
	return (
		<mesh position={position}>
			<boxGeometry args={size} />

			{light.on ? (
				<meshBasicMaterial color={light.color} toneMapped={false} />
			) : (
				<Mat color={lens} roughness={0.4} />
			)}
		</mesh>
	);
};

/** How wide a headlight beam gets at its far end (ground units). Its length is the light's reach. */
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

/**
 * Two headlights at a vehicle's front (+x), `spread` apart sideways: lenses
 * that are always there (dark while off, glowing while on), and while they're
 * on, their beams on the road ahead, as far as the light's reach.
 */
export const Headlights = ({
	light,
	position: [x, y, z],
	spread,
}: {
	light: IResolvedLight;
	position: TV3;
	spread: number;
}) => {
	return (
		<group position={[x, y, z]}>
			{/* The lamps are part of the vehicle: only their glow comes and goes, never the lamps. */}
			{[spread / 2, -spread / 2].map((side) => (
				<LightLens key={side} light={light} size={[0.04, 0.07, 0.12]} position={[0, 0, side]} />
			))}

			{/* The beams on the road ahead, opening out from the lights, while they're on. */}
			{light.on && (
				<mesh position={[light.reach / 2, -y + GLOW_HEIGHT, -z]} rotation={[-Math.PI / 2, 0, 0]}>
					<planeGeometry args={[light.reach, Math.max(BEAM_WIDTH, spread * 2)]} />

					<meshBasicMaterial
						color={light.color}
						alphaMap={getBeam()}
						transparent
						opacity={0.6 * Math.min(light.level, 1.5)}
						blending={THREE.AdditiveBlending}
						depthWrite={false}
						toneMapped={false}
					/>
				</mesh>
			)}
		</group>
	);
};

/**
 * A light's pool on the ground, as wide as its reach, around a spot: a lamp's
 * light under it, a rain light's glow on the road behind a car. `at` is the
 * spot, [x, z] in the part's own units (the part's origin by default), outside
 * any scaling inside the part so it lies at the usual height above roads.
 */
export const LightPool = ({
	light,
	at: [x, z] = [0, 0],
}: {
	light: IResolvedLight;
	at?: [x: number, z: number];
}) => {
	if (!light.on) {
		return null;
	}
	return (
		<GroundGlow
			color={light.color}
			radius={light.reach}
			// Eases off as it gets stronger, so a bright light glows wider rather than blowing out to white.
			strength={1 - Math.exp(-1.1 * light.level)}
			position={[x, GLOW_HEIGHT, z]}
		/>
	);
};

/** Cells across and up the shared pattern of lit and dark windows. */
const PATTERN = 16;
/** Pixels per cell in the pattern; a lit window fills all but a hair of its cell. */
const CELL = 8;

/**
 * The shared pattern of windows, split between lights: one mask per light,
 * white where its panes are lit and black elsewhere, so each light draws its
 * own panes in exactly its colour. `weights` decide whose each pane is (relative
 * to each other: 9 and 1 give nine panes in ten to the first); each light then
 * lights `litPanes` of its own panes, on the busiest floors first, so more
 * lit panes only ever adds panes and never moves another light's.
 */
const windowMasks = new Map<string, THREE.CanvasTexture[]>();
const getWindowMasks = (weights: readonly number[], litPanes: readonly number[]) => {
	const cacheKey = `${weights.join(",")}|${litPanes.map((part) => part.toFixed(3)).join(",")}`;
	const cached = windowMasks.get(cacheKey);
	if (cached || typeof document === "undefined") {
		return cached ?? null;
	}
	// Panes by light, with when each comes on: a lower score is earlier, sooner on busy floors.
	const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
	const panes: { cell: number; score: number }[][] = weights.map(() => []);
	for (let row = 0; row < PATTERN; row++) {
		// Floors differ: some mostly lit (people working late), most only here and there.
		const busy = 0.12 + 0.6 * jitter(row + 101) ** 2;
		for (let column = 0; column < PATTERN; column++) {
			const cell = row * PATTERN + column;
			// Whose pane it is: the weights laid end to end.
			const pick = jitter(cell + 211) * total;
			let owner = 0;
			for (let sum = weights[0]; owner < weights.length - 1 && pick >= sum; sum += weights[owner]) {
				owner++;
			}
			panes[owner].push({ cell, score: jitter(cell + 7) / busy });
		}
	}
	const masks = panes.map((own, index) => {
		const canvas = document.createElement("canvas");
		canvas.width = PATTERN * CELL;
		canvas.height = PATTERN * CELL;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			// Fully lit, so the pane is exactly its light's colour (variety is more lights, not shading).
			ctx.fillStyle = "#ffffff";
			const lit = [...own].sort((a, b) => a.score - b.score);
			for (const { cell } of lit.slice(0, Math.round((litPanes[index] ?? 1) * own.length))) {
				ctx.fillRect((cell % PATTERN) * CELL, Math.floor(cell / PATTERN) * CELL, CELL, CELL);
			}
		}
		const mask = new THREE.CanvasTexture(canvas);
		mask.colorSpace = THREE.SRGBColorSpace;
		mask.magFilter = THREE.NearestFilter;
		mask.wrapS = THREE.RepeatWrapping;
		mask.wrapT = THREE.RepeatWrapping;
		return mask;
	});
	// Lit panes can follow data, so keep only the latest few splits.
	if (windowMasks.size > 32) {
		windowMasks.clear();
	}
	windowMasks.set(cacheKey, masks);
	return masks;
};

interface ILitWindowsProps {
	/**
	 * Its window lights (ADR-0058), each lighting its own panes in exactly its
	 * colour, e.g. warm room lights and cool screens. Each light's `weight` says
	 * how many panes are its and `litPanes` how many of those are lit. Keep the
	 * order and weights fixed: changing them moves which panes are whose.
	 */
	lights: readonly IResolvedLight[];
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
 * Lit windows on a building's four faces: a pattern of lit and dark panes, one
 * per window, just outside its walls (under its window grid). Each light adds
 * its own panes' glow, so dark panes show the wall, and the lights turn on,
 * dim and change colour independently.
 */
export const LitWindows = ({
	lights,
	width,
	depth,
	height,
	columnsX,
	columnsZ,
	floors,
	seed,
}: ILitWindowsProps) => {
	const masks = getWindowMasks(
		lights.map((light) => light.weight),
		lights.map((light) => light.litPanes),
	);
	// Each face of each light its own copy (sharing the image), repeated to one cell per window.
	const faces = useMemo(() => {
		const face = (mask: THREE.CanvasTexture, columns: number, offset: number) => {
			const texture = mask.clone();
			texture.repeat.set(columns / PATTERN, floors / PATTERN);
			// Shifted by whole cells, so lit panes stay in line with the window grid.
			texture.offset.set(
				Math.floor(jitter(seed + offset) * PATTERN) / PATTERN,
				Math.floor(jitter(seed + offset + 3) * PATTERN) / PATTERN,
			);
			texture.needsUpdate = true;
			return texture;
		};
		return (masks ?? []).map((mask) => [
			face(mask, columnsX, 1),
			face(mask, columnsZ, 2),
			face(mask, columnsX, 3),
			face(mask, columnsZ, 4),
		]);
	}, [masks, columnsX, columnsZ, floors, seed]);
	useLayoutEffect(
		() => () => {
			for (const texture of faces.flat()) {
				texture.dispose();
			}
		},
		[faces],
	);

	const sides: { position: TV3; rotation: number; size: number }[] = [
		{ position: [0, height / 2, depth / 2 + 0.012], rotation: 0, size: width },
		{ position: [width / 2 + 0.012, height / 2, 0], rotation: Math.PI / 2, size: depth },
		{ position: [0, height / 2, -depth / 2 - 0.012], rotation: Math.PI, size: width },
		{ position: [-width / 2 - 0.012, height / 2, 0], rotation: -Math.PI / 2, size: depth },
	];
	return (
		<group>
			{lights.map((light, index) =>
				light.on && faces[index] ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: a part's window lights are fixed, in order
					<group key={index}>
						{sides.map((side, i) => (
							<mesh key={side.rotation} position={side.position} rotation={[0, side.rotation, 0]}>
								<planeGeometry args={[side.size, height]} />

								<meshBasicMaterial
									color={new THREE.Color(light.color).multiplyScalar(light.level)}
									map={faces[index][i]}
									transparent
									blending={THREE.AdditiveBlending}
									depthWrite={false}
								/>
							</mesh>
						))}
					</group>
				) : null,
			)}
		</group>
	);
};
