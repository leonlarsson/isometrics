import type { IScenePalette } from "#/scene/theme";

import { lightEmission } from "../lights";
import { Box, spread } from "../primitives";
import type { ILightSpec, IResolvedLight } from "../types";

/**
 * Pieces the shops and the café share (ADR-0050's kits): a shop front with a
 * window, a door and a sign, a striped awning, and rows of windows on the
 * floors above. Each faces +Z, its front at `front` (the wall's z).
 */

/** How tall a floor is. */
export const FLOOR_HEIGHT = 0.9;

/** The awning's light stripes. */
const STRIPE = "#f4f1ea";

/** The lights a shop has: its shop window, and the windows of the flats above. */
export const shopLights = <P extends { width: number; depth: number }>(
	windowAt: (p: P) => [number, number, number],
): ILightSpec<P>[] => [
	{
		id: "shopWindow",
		name: "Shop window",
		shape: "glow",
		// In front of the shop window.
		realLight: (p) => ({ at: windowAt(p), reach: Math.max(1.6, p.width * 1.2) }),
	},
	{ id: "upstairs", name: "Upstairs windows", shape: "glow", comesOn: "gradually" },
];

interface IShopFrontProps {
	width: number;
	front: number;
	colors: { sign: string; door: string };
	palette: IScenePalette;
	light: IResolvedLight;
}

/** The ground floor's front: a wide shop window, the door beside it and a sign band above. */
export const ShopFront = ({ width, front, colors, palette, light }: IShopFrontProps) => {
	const windowWidth = Math.max(0.4, width * 0.58);
	const doorX = width / 2 - Math.min(0.32, width * 0.2);
	return (
		<group position={[0, 0, front]}>
			<Box
				size={[windowWidth, 0.48, 0.04]}
				position={[-width / 2 + 0.1 + windowWidth / 2, 0.34, 0.02]}
				color={palette.glass}
				castShadow={false}
				{...lightEmission(light, 1.3)}
			/>

			<Box
				size={[0.26, 0.6, 0.04]}
				position={[doorX, 0.3, 0.02]}
				color={colors.door}
				castShadow={false}
			/>

			<Box
				size={[width * 0.9, 0.15, 0.05]}
				position={[0, 0.79, 0.025]}
				color={colors.sign}
				castShadow={false}
			/>
		</group>
	);
};

/** How steeply an awning slopes down and out, in radians. */
export const AWNING_SLOPE = 0.38;

/** A striped awning over the shop front, sloping down and out from `top` (under the sign). */
export const Awning = ({
	width,
	front,
	color,
	depth = 0.42,
	top = 0.69,
}: {
	width: number;
	front: number;
	color: string;
	depth?: number;
	top?: number;
}) => {
	const stripes = Math.max(3, Math.round(width / 0.22));
	const stripeWidth = width / stripes;
	return (
		<group
			position={[0, top - (Math.sin(AWNING_SLOPE) * depth) / 2, front + depth / 2 - 0.02]}
			rotation={[AWNING_SLOPE, 0, 0]}
		>
			{spread(stripes, width).map((x, i) => (
				<Box
					key={x}
					size={[stripeWidth, 0.03, depth]}
					position={[x, 0, 0]}
					color={i % 2 === 0 ? color : STRIPE}
				/>
			))}
		</group>
	);
};

/** A row of windows on each floor above the ground floor, glowing when their light is on. */
export const UpperWindows = ({
	width,
	front,
	floors,
	palette,
	light,
}: {
	width: number;
	front: number;
	floors: number;
	palette: IScenePalette;
	light: IResolvedLight;
}) => {
	const columns = Math.max(1, Math.floor(width / 0.6));
	return (
		<>
			{Array.from({ length: floors - 1 }, (_, i) => (i + 1) * FLOOR_HEIGHT).map((floorY) =>
				spread(columns, width * 0.8).map((x) => (
					<Box
						key={`${floorY},${x}`}
						size={[0.3, 0.38, 0.04]}
						position={[x, floorY + 0.45, front + 0.02]}
						color={palette.glass}
						castShadow={false}
						{...lightEmission(light, 1.2)}
					/>
				)),
			)}
		</>
	);
};
