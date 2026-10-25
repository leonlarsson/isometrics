import { getPart, resolveProps } from "#/parts/registry";
import { roadCenterlineOf } from "#/scene/roads";
import type { TScene, TVec3 } from "#/scene/schema";

/** A box in the world for the camera to frame: its centre and size [x, y, z]. */
export interface IFrameBox {
	center: TVec3;
	size: TVec3;
}

/** Something in the scene, by kind and id: what the outliner lists and hovers. */
export interface ISceneItem {
	kind: "entity" | "road" | "area";
	id: string;
}

/** The box around a set of [x, z, height] points, `up` taller than their highest point. */
const boxAround = (points: readonly (readonly number[])[], up: number): IFrameBox | null => {
	if (points.length === 0) {
		return null;
	}
	const xs = points.map((p) => p[0]);
	const zs = points.map((p) => p[1]);
	const top = Math.max(...points.map((p) => p[2] ?? 0)) + up;
	const [minX, maxX, minZ, maxZ] = [
		Math.min(...xs),
		Math.max(...xs),
		Math.min(...zs),
		Math.max(...zs),
	];
	return {
		center: [(minX + maxX) / 2, top / 2, (minZ + maxZ) / 2],
		size: [maxX - minX, top, maxZ - minZ],
	};
};

/**
 * The box around an item, for "frame selection". A vehicle driving a road is
 * framed with its whole route, since it moves.
 */
export const boundsOf = (scene: TScene, item: ISceneItem): IFrameBox | null => {
	if (item.kind === "road") {
		const road = scene.roads.find((r) => r.id === item.id);
		return road ? boxAround(roadCenterlineOf(road), 1) : null;
	}
	if (item.kind === "area") {
		const area = scene.areas.find((a) => a.id === item.id);
		return area
			? boxAround(
					area.points.map(([x, z]) => [x, z, area.height]),
					0.5,
				)
			: null;
	}
	const entity = scene.entities.find((e) => e.id === item.id);
	if (!entity) {
		return null;
	}
	if (entity.follow) {
		return boundsOf(scene, { kind: "road", id: entity.follow.roadId });
	}
	const part = getPart(entity.kind);
	const props = part ? resolveProps(part, entity.props) : {};
	const [width, depth] = part ? part.footprint(props) : [1, 1];
	const height = (part ? part.height(props) : 1) * entity.scale;
	// Turned parts take up their diagonal; close enough for framing.
	const reach = Math.hypot(width, depth) * entity.scale;
	return {
		center: [entity.position[0], entity.elevation + height / 2, entity.position[1]],
		size: [reach, entity.elevation + height, reach],
	};
};

/** The box around several items (a multi-selection), or null when none has one. */
export const boundsOfAll = (scene: TScene, items: readonly ISceneItem[]): IFrameBox | null => {
	const boxes = items.flatMap((item) => boundsOf(scene, item) ?? []);
	if (boxes.length === 0) {
		return null;
	}
	const low = [0, 1, 2].map((axis) =>
		Math.min(...boxes.map((box) => box.center[axis] - box.size[axis] / 2)),
	);
	const high = [0, 1, 2].map((axis) =>
		Math.max(...boxes.map((box) => box.center[axis] + box.size[axis] / 2)),
	);
	return {
		center: [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2],
		size: [high[0] - low[0], high[1] - low[1], high[2] - low[2]],
	};
};
