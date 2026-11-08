import { useMemo, useRef } from "react";

import { fenceHeightOf } from "#/fences/fenceModel";
import { toRadians } from "#/lib/math";
import { resolveColors, resolveTransparencies } from "#/parts/colorModel";
import { resolveLights } from "#/parts/lightModel";
import { drawPrefabPiecesWith, type IPrefabPiecesProps } from "#/parts/prefabParts";
import { entityAsDrawn } from "#/parts/propData";
import { getBasePart, resolveProps } from "#/parts/registry";
import type { TArea, TDataValue, TEntity, TGround } from "#/scene/schema";
import type { ISunPosition } from "#/scene/sun";
import type { IScenePalette } from "#/scene/theme";

import { FenceBody } from "./FenceMesh";

/**
 * A prefab's pieces, as a copy of it draws them (ADR-0134): each object where
 * it stands in the design, as world pictures draw objects (scenePictures'
 * PictureEntity), and each fence on the copy's base. The copy's own node
 * (EntityNode) places, turns and scales the whole, and its meshes are drawn
 * together with other copies' that look the same (ADR-0086). Pieces never
 * drive and have no cards of their own: the copy has those.
 */

const NO_AREAS: TArea[] = [];
/** Pieces and pictures stand on no ground of their own: the base level (ADR-0155). */
const NO_GROUNDS: readonly TGround[] = [];
const NO_DATA: TDataValue[] = [];

interface IPieceProps {
	piece: TEntity;
	palette: IScenePalette;
	playing: boolean;
	data: readonly TDataValue[] | undefined;
	hour: number | null;
	sun: ISunPosition | undefined;
	onReady: () => void;
}

const Piece = ({ piece, palette, playing, data, hour, sun, onReady }: IPieceProps) => {
	const part = getBasePart(piece.kind);
	// Its sizes and props as data sets them (ADR-0109).
	const drawn = entityAsDrawn(piece, data);
	const props = useMemo(() => (part ? resolveProps(part, drawn.props) : {}), [part, drawn.props]);
	if (!part) {
		return null;
	}
	const Component = part.Component;
	return (
		<group position={[drawn.position[0], drawn.altitude, drawn.position[1]]}>
			<group
				// Heading, then pitch, then roll, as every object (ADR-0097).
				rotation={[
					toRadians(drawn.rotation[0]),
					toRadians(drawn.rotation[1]),
					toRadians(drawn.rotation[2]),
					"YZX",
				]}
				scale={drawn.scale}
			>
				<Component
					props={props}
					colors={resolveColors(part, drawn, palette, data)}
					transparency={resolveTransparencies(part, drawn)}
					palette={palette}
					playing={playing}
					lights={resolveLights(part, drawn, { palette, driving: false, data, hour })}
					data={data}
					sun={part.followsTheSun?.(props) ? sun : undefined}
					onReady={part.rendersAsync ? onReady : undefined}
				/>
			</group>
		</group>
	);
};

export const PrefabPieces = ({
	prefab,
	palette,
	playing,
	data,
	hour = null,
	sun,
	onReady,
}: IPrefabPiecesProps) => {
	const entities = prefab.entities.filter((piece) => !piece.isHidden);
	// Every piece that builds asynchronously (text) says when it's done; the copy is ready once all are.
	const waiting = useRef<number | null>(null);
	waiting.current ??= entities.filter((piece) => getBasePart(piece.kind)?.rendersAsync).length;
	const pieceReady = () => {
		if (waiting.current === null) {
			return;
		}
		waiting.current -= 1;
		if (waiting.current <= 0) {
			onReady?.();
		}
	};
	return (
		<>
			{entities.map((piece) => (
				<Piece
					key={piece.id}
					piece={piece}
					palette={palette}
					playing={playing}
					data={data}
					hour={hour}
					sun={sun}
					onReady={pieceReady}
				/>
			))}

			{prefab.fences.map((fence) =>
				fence.isHidden ? null : (
					<FenceBody
						key={fence.id}
						fence={fence}
						palette={palette}
						areas={NO_AREAS}
						grounds={NO_GROUNDS}
						data={data ?? NO_DATA}
						selected={false}
					/>
				),
			)}
		</>
	);
};

// The parts layer draws a copy's pieces with this (parts/prefabParts), and measures its fences.
drawPrefabPiecesWith({ Pieces: PrefabPieces, fenceHeightOf });
