import { z } from "zod";

import { floodlitSurface, lightEmission } from "../lights";
import { Mat, spread, type TV3 } from "../primitives";
import type { ILightSpec, IResolvedLight, TFieldSpec } from "../types";

import { Block, Prism } from "./clusterPieces";

/**
 * What the old town's churches share (church_02 to church_04): a nave with
 * tall windows under a steep roof, its tower at the front (+Z) end, and
 * floodlights at its foot that light its walls and tower after dark. Each
 * variant draws its own tower and spire on top.
 */

/** The same settings as the plain church (church_01), so a church can switch look and keep them. */
export const OldChurchSchema = z.object({
	width: z.number().min(1.2).max(6).default(2.4),
	depth: z.number().min(2).max(12).default(4.6),
	towerHeight: z.number().min(1.5).max(10).default(3.6),
});

export type TOldChurch = z.output<typeof OldChurchSchema>;

export const OLD_CHURCH_FIELDS: TFieldSpec<keyof TOldChurch>[] = [
	{ key: "width", label: "Width", type: "number", min: 1.2, max: 6, step: 0.1 },
	{ key: "depth", label: "Depth", type: "number", min: 2, max: 12, step: 0.1 },
	{ key: "towerHeight", label: "Tower height", type: "number", min: 1.5, max: 10, step: 0.1 },
];

/** The tower's side. */
export const towerSideOf = (p: TOldChurch) => Math.min(1.3, Math.max(0.8, p.width * 0.48));

/** The windows and floodlights every old church has, with the same ids as church_01's windows. */
export const oldChurchLights = (
	floodlightReach: (p: TOldChurch) => number,
): ILightSpec<TOldChurch>[] => [
	{
		id: "windows",
		name: "Windows",
		description: "Candles and lamps inside, through the tall windows.",
		shape: "glow",
		color: "#ffcf7d",
		comesOn: "gradually",
	},
	{
		id: "floodlights",
		name: "Floodlights",
		description: "Lamps at its foot lighting its walls and tower after dark.",
		shape: "glow",
		color: "#ffd9a6",
		comesOn: "gradually",
		// In front of the tower and along both sides, low, shining back at it.
		realLight: (p) => [
			{ at: [0, 0.8, p.depth / 2 + 1.4], reach: floodlightReach(p) },
			{ at: [p.width / 2 + 1.2, 0.8, -p.depth * 0.15], reach: p.depth * 0.9 },
			{ at: [-p.width / 2 - 1.2, 0.8, -p.depth * 0.15], reach: p.depth * 0.9 },
		],
	},
];

/** How brightly floodlit walls glow, as a share of the light's level. */
export const FLOODLIT = 0.6;

interface INaveProps {
	p: TOldChurch;
	wallHeight: number;
	/** Its roof's height over the walls. */
	roofHeight: number;
	walls: string;
	roof: string;
	glass: string;
	windows: IResolvedLight;
	floodlights: IResolvedLight;
	/** Buttresses between the windows (Gothic churches). */
	hasButtresses?: boolean;
}

/** The nave behind the tower: walls with tall windows down both sides, a steep roof along it. */
export const Nave = ({
	p,
	wallHeight,
	roofHeight,
	walls,
	roof,
	glass,
	windows,
	floodlights,
	hasButtresses = false,
}: INaveProps) => {
	const tower = towerSideOf(p);
	const length = p.depth - tower;
	const middle = -tower / 2;
	const windowCount = Math.max(2, Math.round(length / 0.62));
	const along = spread(windowCount, length - 0.4);
	return (
		<group position={[0, 0, middle]}>
			<Block
				position={[0, wallHeight / 2, 0]}
				size={[p.width, wallHeight, length]}
				color={walls}
				{...floodlitSurface(floodlights, walls, FLOODLIT)}
			/>

			{/* The roof, its ridge along the nave, a gable at the back. */}
			<Prism
				position={[0, wallHeight, -0.02]}
				size={[length + 0.14, roofHeight, p.width + 0.16]}
				rotation={[0, Math.PI / 2, 0]}
				color={roof}
			/>

			<Prism
				position={[0, wallHeight - 0.001, -length / 2 + 0.02]}
				size={[0.06, roofHeight * 0.97, p.width]}
				rotation={[0, Math.PI / 2, 0]}
				color={walls}
				castShadow={false}
			/>

			{along.flatMap((z) =>
				[1, -1].map((side) => (
					<Block
						key={`${z},${side}`}
						position={[side * (p.width / 2 + 0.01), wallHeight * 0.52, z]}
						size={[0.02, wallHeight * 0.58, 0.2]}
						color={glass}
						castShadow={false}
						{...lightEmission(windows, 1.5)}
					/>
				)),
			)}

			{hasButtresses &&
				spread(windowCount + 1, length - 0.1).flatMap((z, i) =>
					// Between the windows: the first sits under the tower, so leave it out.
					i === windowCount
						? []
						: [1, -1].map((side) => (
								<Block
									key={`b${z},${side}`}
									position={[
										side * (p.width / 2 + 0.06),
										wallHeight * 0.4,
										z - (length - 0.1) / (windowCount + 1) / 2,
									]}
									size={[0.12, wallHeight * 0.8, 0.1]}
									color={walls}
								/>
							)),
				)}
		</group>
	);
};

/** The floodlights' lamps on the ground: before the tower and along both sides. */
export const FloodlightLamps = ({
	p,
	floodlights,
}: {
	p: TOldChurch;
	floodlights: IResolvedLight;
}) => {
	const spots: { at: TV3; turn: number }[] = [
		{ at: [-0.5, 0, p.depth / 2 + 0.55], turn: 0 },
		{ at: [0.5, 0, p.depth / 2 + 0.55], turn: 0 },
		{ at: [p.width / 2 + 0.45, 0, -p.depth * 0.15], turn: Math.PI / 2 },
		{ at: [-p.width / 2 - 0.45, 0, -p.depth * 0.15], turn: -Math.PI / 2 },
	];
	return (
		<>
			{spots.map(({ at, turn }) => (
				// Each lamp faces back at the church: its lens on the side towards it.
				<group key={`${at[0]},${at[2]}`} position={at} rotation={[0, turn, 0]}>
					<Block position={[0, 0.07, 0]} size={[0.16, 0.14, 0.12]} color="#3b3d40" />

					<Block
						position={[0, 0.1, -0.065]}
						size={[0.12, 0.08, 0.01]}
						color="#f4ead2"
						castShadow={false}
						{...lightEmission(floodlights, 2.4)}
					/>
				</group>
			))}
		</>
	);
};

interface ISolidProps {
	/** Where its base's centre stands. */
	position: TV3;
	/** Its radius across (x and z) and its height. */
	size: TV3;
	color: string;
	emissive?: string;
	emissiveIntensity?: number;
}

/** A dome: half a sphere of radius 1, scaled, standing on its position (a cupola, a chapel's roof). */
export const Dome = ({ position, size, color, ...glow }: ISolidProps) => (
	<mesh position={position} scale={size} castShadow receiveShadow>
		<sphereGeometry args={[1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />

		<Mat color={color} flat {...glow} />
	</mesh>
);

/** An eight-sided spire: a cone of radius 1 and height 1, scaled, standing on its position. */
export const Spire = ({ position: [x, y, z], size, color, ...glow }: ISolidProps) => (
	<mesh position={[x, y + size[1] / 2, z]} scale={size} castShadow receiveShadow>
		<coneGeometry args={[1, 1, 8]} />

		<Mat color={color} flat {...glow} />
	</mesh>
);

/** An eight-sided drum (a lantern, a belfry), radius 1 and height 1, scaled, standing on its position. */
export const Octagon = ({ position: [x, y, z], size, color, ...glow }: ISolidProps) => (
	<mesh position={[x, y + size[1] / 2, z]} scale={size} castShadow receiveShadow>
		<cylinderGeometry args={[1, 1, 1, 8]} />

		<Mat color={color} flat {...glow} />
	</mesh>
);
