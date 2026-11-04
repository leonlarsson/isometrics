import { floodlitSurface } from "../lights";
import { spread } from "../primitives";
import { definePart } from "../types";

import {
	FLOODLIT,
	FloodlightLamps,
	Nave,
	OLD_CHURCH_FIELDS,
	OldChurchSchema,
	oldChurchLights,
	Spire,
	towerSideOf,
} from "./churchKit";
import { Block, Prism } from "./clusterPieces";

/**
 * A brick church with a tall copper spire (Stockholm's Tyska kyrkan): a nave
 * with a row of gables along each side, a square red-brick tower at the front
 * (+Z) with clock faces, and on it a slender green spire with dormers at its
 * foot and a gilded ball at its tip.
 */

const WALL_HEIGHT = 1.7;
const ROOF_HEIGHT = 0.95;
/** The spire's height for the tower's. */
const SPIRE_SHARE = 1.2;

const spireHeightOf = (towerHeight: number) => towerHeight * SPIRE_SHARE;

export const church04 = definePart({
	kind: "church_04",
	name: "Church",
	category: "buildings",
	description:
		"A red-brick church with a tall, slender copper spire (like Tyska kyrkan): gables along the nave, its tower at the front (+Z) with clock faces",
	keywords: [
		"tyska kyrkan",
		"german church",
		"brick",
		"copper",
		"spire",
		"steeple",
		"clock tower",
		"old town",
		"landmark",
	],
	schema: OldChurchSchema,
	fields: OLD_CHURCH_FIELDS,
	colors: [
		{ id: "walls", name: "Brick", default: "#8f4434", legacy: "color" },
		{ id: "roof", name: "Roof", default: "#4a4a4a", legacy: "accent" },
		{ id: "spire", name: "Copper spire", default: "#6e9f89" },
		{ id: "trim", name: "Stone trim", default: "#e6dcc8" },
		{ id: "door", name: "Door", default: "#3a2a22" },
	],
	lights: oldChurchLights((p) => p.towerHeight + spireHeightOf(p.towerHeight) * 0.4),
	sizeAlong: { x: "width", z: "depth" },
	footprint: (p) => [p.width + 0.3, p.depth + 0.2],
	height: (p) => p.towerHeight + spireHeightOf(p.towerHeight) + 0.15,
	Component: ({ props: p, colors, palette, lights }) => {
		const side = towerSideOf(p);
		const floodlit = (color: string) => floodlitSurface(lights.floodlights, color, FLOODLIT);
		const spire = spireHeightOf(p.towerHeight);
		const naveLength = p.depth - side;
		const gables = Math.max(2, Math.round(naveLength / 1.1));
		return (
			<group>
				<Nave
					p={p}
					wallHeight={WALL_HEIGHT}
					roofHeight={ROOF_HEIGHT}
					walls={colors.walls}
					roof={colors.roof}
					glass={palette.glass}
					windows={lights.windows}
					floodlights={lights.floodlights}
				/>

				{/* A row of gables along each side, each with its own roof back to the ridge. */}
				{spread(gables, naveLength - 0.3).flatMap((z) =>
					[1, -1].map((sx) => (
						<group
							key={`${z},${sx}`}
							position={[(sx * p.width) / 2, WALL_HEIGHT, z - side / 2]}
							rotation={[0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
						>
							{/* The gable's wall just in front of its roof's end, so the two never share a plane. */}
							<Prism
								position={[0, 0, 0.12]}
								size={[0.04, 0.6, 0.8]}
								rotation={[0, Math.PI / 2, 0]}
								color={colors.walls}
								{...floodlit(colors.walls)}
							/>

							<Prism
								position={[0, -0.001, -0.2]}
								size={[0.6, 0.62, 0.86]}
								rotation={[0, Math.PI / 2, 0]}
								color={colors.roof}
							/>

							<Block
								position={[0, 0.22, 0.15]}
								size={[0.12, 0.22, 0.02]}
								color={colors.trim}
								castShadow={false}
							/>
						</group>
					)),
				)}

				<group position={[0, 0, p.depth / 2 - side / 2]}>
					<Block
						position={[0, p.towerHeight / 2, 0]}
						size={[side, p.towerHeight, side]}
						color={colors.walls}
						{...floodlit(colors.walls)}
					/>

					{/* Stone bands between its stages. */}
					{[WALL_HEIGHT, p.towerHeight * 0.72, p.towerHeight - 0.05].map((y) => (
						<Block
							key={y}
							position={[0, y, 0]}
							size={[side + 0.06, 0.08, side + 0.06]}
							color={colors.trim}
						/>
					))}

					<Block
						position={[0, 0.38, side / 2 + 0.01]}
						size={[0.3, 0.76, 0.03]}
						color={colors.door}
						castShadow={false}
					/>

					{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
						<group key={turn} rotation={[0, turn, 0]}>
							{/* Paired belfry openings, and a clock face under them. */}
							{[-0.14, 0.14].map((x) => (
								<Block
									key={x}
									position={[x, p.towerHeight * 0.86, side / 2 + 0.01]}
									size={[0.14, 0.42, 0.02]}
									color={palette.glass}
									castShadow={false}
								/>
							))}

							<mesh
								position={[0, p.towerHeight * 0.62, side / 2 + 0.012]}
								rotation={[Math.PI / 2, 0, 0]}
							>
								<cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />

								<meshStandardMaterial color="#e9d9a6" roughness={0.6} />
							</mesh>

							{/* A dormer at the spire's foot. */}
							<group position={[0, p.towerHeight + 0.02, side * 0.3]}>
								<Block position={[0, 0.14, 0]} size={[0.16, 0.28, 0.12]} color={colors.spire} />

								<Prism
									position={[0, 0.28, 0]}
									size={[0.14, 0.14, 0.2]}
									rotation={[0, Math.PI / 2, 0]}
									color={colors.spire}
								/>
							</group>
						</group>
					))}

					{/* The spire, its foot square to the tower, a needle and a gilded ball. */}
					<Spire
						position={[0, p.towerHeight, 0]}
						size={[side * 0.56, spire * 0.94, side * 0.56]}
						color={colors.spire}
					/>

					<Spire
						position={[0, p.towerHeight + spire * 0.9, 0]}
						size={[0.03, spire * 0.12, 0.03]}
						color={colors.spire}
					/>

					<mesh position={[0, p.towerHeight + spire * 0.86, 0]}>
						<sphereGeometry args={[0.07, 10, 8]} />

						<meshStandardMaterial color="#d8b04a" roughness={0.4} metalness={0.3} />
					</mesh>
				</group>

				<FloodlightLamps p={p} floodlights={lights.floodlights} />
			</group>
		);
	},
});
