import { floodlitSurface } from "../lights";
import { definePart } from "../types";

import {
	Dome,
	FLOODLIT,
	FloodlightLamps,
	Nave,
	Octagon,
	OLD_CHURCH_FIELDS,
	OldChurchSchema,
	oldChurchLights,
	Spire,
	towerSideOf,
} from "./churchKit";
import { Block } from "./clusterPieces";

/**
 * A cathedral with a baroque tower (Stockholm's Storkyrkan): a broad plastered
 * hall church, its square tower at the front (+Z) with pilasters, belfry
 * openings and a balustrade, crowned by a copper cupola, a lantern and a
 * needle with an orb.
 */

const WALL_HEIGHT = 1.8;
const ROOF_HEIGHT = 1.05;
/** The cupola over the tower: its drum, dome, lantern and needle. */
const CROWN = { drum: 0.32, dome: 0.62, lantern: 0.34, cap: 0.2, needle: 0.8 };

export const church02 = definePart({
	kind: "church_02",
	name: "Church",
	category: "buildings",
	description:
		"A cathedral with a baroque tower (like Storkyrkan): a broad hall church, its square tower at the front (+Z) crowned by a copper cupola, a lantern and a needle",
	keywords: [
		"cathedral",
		"storkyrkan",
		"baroque",
		"tower",
		"cupola",
		"dome",
		"old town",
		"landmark",
		"religious",
	],
	schema: OldChurchSchema,
	fields: OLD_CHURCH_FIELDS,
	colors: [
		{ id: "walls", name: "Walls", default: "#c98d5d", legacy: "color" },
		{ id: "roof", name: "Roof", default: "#4c4744", legacy: "accent" },
		{ id: "cupola", name: "Cupola", default: "#4f6a5f" },
		{ id: "trim", name: "Pilasters and cornices", default: "#eedfc4" },
		{ id: "door", name: "Door", default: "#4a3226" },
	],
	lights: oldChurchLights((p) => p.towerHeight * 1.2),
	sizeAlong: { x: "width", z: "depth" },
	footprint: (p) => [p.width + 0.3, p.depth + 0.2],
	height: (p) => p.towerHeight + CROWN.drum + CROWN.dome + CROWN.lantern + CROWN.cap + CROWN.needle,
	Component: ({ props: p, colors, palette, lights }) => {
		const side = towerSideOf(p);
		const floodlit = (color: string) => floodlitSurface(lights.floodlights, color, FLOODLIT);
		const radius = side * 0.42;
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

				<group position={[0, 0, p.depth / 2 - side / 2]}>
					<Block
						position={[0, p.towerHeight / 2, 0]}
						size={[side, p.towerHeight, side]}
						color={colors.walls}
						{...floodlit(colors.walls)}
					/>

					{/* Pilasters up its corners, a cornice between its stages and a balustrade on top. */}
					{[
						[-1, -1],
						[-1, 1],
						[1, -1],
						[1, 1],
					].map(([sx, sz]) => (
						<Block
							key={`${sx},${sz}`}
							position={[(sx * side) / 2, p.towerHeight / 2, (sz * side) / 2]}
							size={[0.12, p.towerHeight, 0.12]}
							color={colors.trim}
							{...floodlit(colors.trim)}
						/>
					))}

					{[WALL_HEIGHT + 0.1, p.towerHeight - 0.05].map((y) => (
						<Block
							key={y}
							position={[0, y, 0]}
							size={[side + 0.1, 0.1, side + 0.1]}
							color={colors.trim}
						/>
					))}

					<Block
						position={[0, p.towerHeight + 0.09, 0]}
						size={[side - 0.04, 0.18, side - 0.04]}
						color={colors.trim}
					/>

					{/* A door at its foot, and arched belfry openings on each face. */}
					<Block
						position={[0, 0.36, side / 2 + 0.01]}
						size={[0.34, 0.72, 0.03]}
						color={colors.door}
						castShadow={false}
					/>

					{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
						<group key={turn} rotation={[0, turn, 0]}>
							<Block
								position={[0, p.towerHeight - 0.55, side / 2 + 0.01]}
								size={[0.24, 0.5, 0.02]}
								color={palette.glass}
								castShadow={false}
							/>

							{/* A round clock face under the belfry. */}
							<mesh
								position={[0, p.towerHeight - 1.15, side / 2 + 0.012]}
								rotation={[Math.PI / 2, 0, 0]}
							>
								<cylinderGeometry args={[0.13, 0.13, 0.02, 16]} />

								<meshStandardMaterial color="#f2ead8" roughness={0.7} />
							</mesh>
						</group>
					))}

					{/* The crown: a drum, the cupola, an open lantern, a cap and the needle with its orb. */}
					<group position={[0, p.towerHeight + 0.18, 0]}>
						<Octagon
							position={[0, 0, 0]}
							size={[radius, CROWN.drum, radius]}
							color={colors.cupola}
						/>

						<Dome
							position={[0, CROWN.drum, 0]}
							size={[radius * 1.02, CROWN.dome, radius * 1.02]}
							color={colors.cupola}
						/>

						<Octagon
							position={[0, CROWN.drum + CROWN.dome * 0.9, 0]}
							size={[radius * 0.36, CROWN.lantern, radius * 0.36]}
							color={colors.cupola}
						/>

						<Dome
							position={[0, CROWN.drum + CROWN.dome * 0.9 + CROWN.lantern, 0]}
							size={[radius * 0.4, CROWN.cap, radius * 0.4]}
							color={colors.cupola}
						/>

						<Spire
							position={[0, CROWN.drum + CROWN.dome * 0.9 + CROWN.lantern + CROWN.cap * 0.8, 0]}
							size={[0.045, CROWN.needle, 0.045]}
							color={colors.cupola}
						/>

						<mesh
							position={[
								0,
								CROWN.drum + CROWN.dome * 0.9 + CROWN.lantern + CROWN.cap + CROWN.needle * 0.35,
								0,
							]}
						>
							<sphereGeometry args={[0.07, 10, 8]} />

							<meshStandardMaterial color="#d8b04a" roughness={0.4} metalness={0.3} />
						</mesh>
					</group>
				</group>

				<FloodlightLamps p={p} floodlights={lights.floodlights} />
			</group>
		);
	},
});
