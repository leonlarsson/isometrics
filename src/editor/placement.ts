import type { TAnyPart } from "#/parts/registry";
import { getPart, resolveProps } from "#/parts/registry";
import type { TEntity, TScene, TVec2 } from "#/scene/schema";

interface IRect {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

const footprintRect = (entity: TEntity): IRect | null => {
	const part = getPart(entity.kind);
	if (!part || entity.follow) {
		return null;
	}
	const [w, d] = part.footprint(resolveProps(part, entity.props));
	// Use the rotated bounding box so placement is conservative.
	const angle = (entity.rotation * Math.PI) / 180;
	const cos = Math.abs(Math.cos(angle));
	const sin = Math.abs(Math.sin(angle));
	const halfW = ((w * cos + d * sin) * entity.scale) / 2;
	const halfD = ((w * sin + d * cos) * entity.scale) / 2;
	return {
		minX: entity.position[0] - halfW,
		maxX: entity.position[0] + halfW,
		minZ: entity.position[1] - halfD,
		maxZ: entity.position[1] + halfD,
	};
};

const overlaps = (a: IRect, b: IRect) =>
	a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

/**
 * Find a spot near `near` where a new part fits without overlapping existing
 * entities (flat zones are ignored). Searches
 * outward in rings on a 1-unit grid and stays inside the ground.
 */
export const findFreeSpot = (scene: TScene, part: TAnyPart, near: TVec2 = [0, 0]): TVec2 => {
	const [w, d] = part.footprint(part.schema.parse({}));
	const obstacles = scene.entities
		.filter((e) => !getPart(e.kind)?.flat)
		.map(footprintRect)
		.filter((r): r is IRect => r !== null);
	const halfGroundW = scene.ground.width / 2;
	const halfGroundD = scene.ground.depth / 2;
	const isFlat = part.flat === true;

	for (let radius = 0; radius < Math.max(halfGroundW, halfGroundD); radius++) {
		for (let dx = -radius; dx <= radius; dx++) {
			for (let dz = -radius; dz <= radius; dz++) {
				if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
					continue;
				}
				const x = Math.round(near[0]) + dx;
				const z = Math.round(near[1]) + dz;
				const rect: IRect = {
					minX: x - w / 2 - 0.25,
					maxX: x + w / 2 + 0.25,
					minZ: z - d / 2 - 0.25,
					maxZ: z + d / 2 + 0.25,
				};
				const inside =
					rect.minX >= -halfGroundW &&
					rect.maxX <= halfGroundW &&
					rect.minZ >= -halfGroundD &&
					rect.maxZ <= halfGroundD;
				if (!inside) {
					continue;
				}
				if (isFlat || !obstacles.some((o) => overlaps(o, rect))) {
					return [x, z];
				}
			}
		}
	}
	return near;
};
