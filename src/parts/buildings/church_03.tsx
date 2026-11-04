import { floodlitSurface } from "../lights";
import { Strut, type TV3 } from "../primitives";
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
	towerSideOf,
} from "./churchKit";
import { Block, Prism } from "./clusterPieces";

/**
 * A Gothic brick church with an openwork cast-iron spire (Stockholm's
 * Riddarholmskyrkan): a buttressed nave with domed burial chapels along its
 * sides, a square brick tower at the front (+Z), and on it a tall, slender
 * spire of iron ribs, rings and braces you can see the sky through.
 */

const WALL_HEIGHT = 1.6;
const ROOF_HEIGHT = 1.15;
/** The spire's height for the tower's, its rings, and the iron's thickness. */
const SPIRE_SHARE = 1.25;
const RINGS = 9;
const IRON = 0.026;
const SIDES = 8;

const spireHeightOf = (towerHeight: number) => towerHeight * SPIRE_SHARE;

/** The lattice: eight ribs to the top, rings round them, and a brace across each face between rings. */
const Lattice = ({ radius, height, color }: { radius: number; height: number; color: string }) => {
	const at = (level: number, corner: number): TV3 => {
		const share = 1 - level / RINGS;
		const angle = ((corner % SIDES) / SIDES) * Math.PI * 2 + Math.PI / SIDES;
		return [
			Math.cos(angle) * radius * share,
			(height * level) / RINGS,
			Math.sin(angle) * radius * share,
		];
	};
	const corners = Array.from({ length: SIDES }, (_, corner) => corner);
	const levels = Array.from({ length: RINGS }, (_, level) => level);
	return (
		<>
			{corners.map((corner) => (
				<Strut
					key={`rib${corner}`}
					from={at(0, corner)}
					to={[0, height, 0]}
					color={color}
					thickness={IRON * 1.3}
				/>
			))}

			{levels.flatMap((level) =>
				corners.map((corner) => (
					<Strut
						key={`ring${level},${corner}`}
						from={at(level, corner)}
						to={at(level, corner + 1)}
						color={color}
						thickness={IRON}
						castShadow={false}
					/>
				)),
			)}

			{levels.slice(0, -1).flatMap((level) =>
				corners.map((corner) => (
					<Strut
						key={`brace${level},${corner}`}
						// Zigzagging up each face, the other way on every other level.
						from={at(level, corner + (level % 2))}
						to={at(level + 1, corner + 1 - (level % 2))}
						color={color}
						thickness={IRON * 0.8}
						castShadow={false}
					/>
				)),
			)}
		</>
	);
};

export const church03 = definePart({
	kind: "church_03",
	name: "Church",
	category: "buildings",
	description:
		"A Gothic brick church with an openwork cast-iron spire (like Riddarholmskyrkan): a buttressed nave with domed chapels along it, its tower at the front (+Z)",
	keywords: [
		"riddarholmskyrkan",
		"gothic",
		"brick",
		"cast iron",
		"lattice",
		"openwork",
		"spire",
		"burial church",
		"old town",
		"landmark",
	],
	schema: OldChurchSchema,
	fields: OLD_CHURCH_FIELDS,
	colors: [
		{ id: "walls", name: "Brick", default: "#8c4a3a", legacy: "color" },
		{ id: "roof", name: "Roof", default: "#3f3c3d", legacy: "accent" },
		{ id: "spire", name: "Iron spire", default: "#2c2f33" },
		{ id: "domes", name: "Chapel domes", default: "#6f9d86" },
		{ id: "door", name: "Door", default: "#3a2a22" },
	],
	lights: oldChurchLights((p) => p.towerHeight + spireHeightOf(p.towerHeight) * 0.5),
	sizeAlong: { x: "width", z: "depth" },
	footprint: (p) => [p.width + 1.4, p.depth + 0.2],
	height: (p) => p.towerHeight + 0.3 + spireHeightOf(p.towerHeight) + 0.3,
	Component: ({ props: p, colors, palette, lights }) => {
		const side = towerSideOf(p);
		const floodlit = (color: string) => floodlitSurface(lights.floodlights, color, FLOODLIT);
		const spire = spireHeightOf(p.towerHeight);
		const naveLength = p.depth - side;
		// Burial chapels along both sides, square with a copper dome each.
		const chapels = [-0.18, 0.18].map((share) => -side / 2 + share * naveLength);
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
					hasButtresses
				/>

				{chapels.flatMap((z) =>
					[1, -1].map((sx) => (
						<group key={`${z},${sx}`} position={[sx * (p.width / 2 + 0.34), 0, z]}>
							<Block
								position={[0, 0.5, 0]}
								size={[0.64, 1, 0.74]}
								color={colors.walls}
								{...floodlit(colors.walls)}
							/>

							<Block position={[0, 1.04, 0]} size={[0.7, 0.08, 0.8]} color={colors.roof} />

							<Dome position={[0, 1.08, 0]} size={[0.3, 0.36, 0.3]} color={colors.domes} />

							<Octagon position={[0, 1.42, 0]} size={[0.06, 0.16, 0.06]} color={colors.domes} />
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

					{/* A stepped brick crown along the tower's top, and corner pinnacles. */}
					<Block
						position={[0, p.towerHeight + 0.06, 0]}
						size={[side + 0.08, 0.12, side + 0.08]}
						color={colors.walls}
					/>

					{[
						[-1, -1],
						[-1, 1],
						[1, -1],
						[1, 1],
					].map(([sx, sz]) => (
						<Block
							key={`${sx},${sz}`}
							position={[(sx * side) / 2, p.towerHeight + 0.24, (sz * side) / 2]}
							size={[0.12, 0.36, 0.12]}
							color={colors.walls}
						/>
					))}

					{/* A pointed doorway and tall Gothic windows up the tower. */}
					<Block
						position={[0, 0.4, side / 2 + 0.01]}
						size={[0.32, 0.8, 0.03]}
						color={colors.door}
						castShadow={false}
					/>

					<Prism
						position={[0, 0.8, side / 2 + 0.01]}
						size={[0.32, 0.18, 0.03]}
						color={colors.door}
						castShadow={false}
					/>

					{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
						<group key={turn} rotation={[0, turn, 0]}>
							<Block
								position={[0, p.towerHeight * 0.62, side / 2 + 0.01]}
								size={[0.2, p.towerHeight * 0.3, 0.02]}
								color={palette.glass}
								castShadow={false}
							/>
						</group>
					))}

					{/* The iron spire on an eight-sided base. */}
					<Octagon
						position={[0, p.towerHeight + 0.12, 0]}
						size={[side * 0.38, 0.18, side * 0.38]}
						color={colors.spire}
					/>

					<group position={[0, p.towerHeight + 0.3, 0]}>
						<Lattice radius={side * 0.34} height={spire} color={colors.spire} />

						{/* A cross at the top. */}
						<Block position={[0, spire + 0.15, 0]} size={[0.03, 0.3, 0.03]} color={colors.spire} />

						<Block position={[0, spire + 0.2, 0]} size={[0.16, 0.03, 0.03]} color={colors.spire} />
					</group>
				</group>

				<FloodlightLamps p={p} floodlights={lights.floodlights} />
			</group>
		);
	},
});
