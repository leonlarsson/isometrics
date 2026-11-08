import type { Draft } from "immer";
import { create } from "zustand";

import { clamp, round } from "#/lib/math";
import {
	GROUND_SHAPES,
	GROUND_SIZE,
	groundCornersOf,
	resized,
	type TGroundShapeId,
	withCorners,
} from "#/scene/groundShape";
import {
	boxOf,
	countOnGround,
	type IOnGround,
	newGroundId,
	newGroundPosition,
	thingsOnGround,
} from "#/scene/grounds";
import { GroundSchema, type TGround, type TScene, type TVec2 } from "#/scene/schema";

import type { ISceneItem } from "./framing";
import { type ICommitOptions, removeFromScene, useEditor } from "./store";

/**
 * Editing the world's grounds (ADR-0155): which one the World tab's Ground
 * panel shows (the picked ground), whether its handles show in the view
 * (moving and shaping it), and which of its corners are selected for the move
 * gizmo. Runtime UI state, never saved; what it changes goes through the
 * store's `commit`, so it can be undone.
 */
interface IGroundEditing {
	/** The picked ground's id; null (or gone) means the first. */
	pickedId: string | null;
	/** Whether its handles show in the view: moving and shaping it. */
	isOn: boolean;
	/** Its selected corners, by index (in `groundCornersOf`). */
	selected: readonly number[];
}

export const useGroundEditing = create<IGroundEditing>(() => ({
	pickedId: null,
	isOn: false,
	selected: [],
}));

/** The picked ground in a world: the one asked for, or the first. */
export const pickedGroundOf = (grounds: readonly TGround[], pickedId: string | null) =>
	grounds.find((ground) => ground.id === pickedId) ?? grounds[0];

/** The picked ground, kept up to date. */
export const usePickedGround = () => {
	const pickedId = useGroundEditing((s) => s.pickedId);
	return useEditor((s) => pickedGroundOf(s.scene.grounds, pickedId));
};

const picked = () =>
	pickedGroundOf(useEditor.getState().scene.grounds, useGroundEditing.getState().pickedId);

/** Pick which ground the Ground panel shows (and the view's handles edit, while on). */
export const pickGround = (id: string) =>
	useGroundEditing.setState((state) =>
		state.pickedId === id ? state : { pickedId: id, selected: [] },
	);

/**
 * Start or stop moving and shaping a ground in the view (the picked one, or
 * `id`). Starting leaves Edit mode's selection: the ground is what's edited.
 */
export const editGround = (isOn: boolean, id?: string) => {
	if (isOn) {
		useEditor.getState().clearSelection();
	}
	useGroundEditing.setState((state) => ({
		isOn,
		selected: [],
		pickedId: id ?? state.pickedId,
	}));
};

/** Select one corner (null: none), or with `adds` add it or take it out. */
export const selectGroundCorner = (index: number | null, adds = false) =>
	useGroundEditing.setState(({ selected }) => {
		if (index === null) {
			return { selected: [] };
		}
		if (!adds) {
			return { selected: [index] };
		}
		return {
			selected: selected.includes(index)
				? selected.filter((known) => known !== index)
				: [...selected, index],
		};
	});

/** Change one ground (by id, the picked one by default). */
export const updateGround = (
	recipe: (ground: Draft<TGround>) => void,
	options?: ICommitOptions,
	id = picked().id,
) =>
	useEditor.getState().commit((scene) => {
		const ground = scene.grounds.find((each) => each.id === id);
		if (ground) {
			recipe(ground);
		}
	}, options);

/** World corners to the picked ground's own (round its position). */
const toLocal = (ground: Pick<TGround, "position">, point: TVec2): TVec2 => [
	point[0] - ground.position[0],
	point[1] - ground.position[1],
];

/** Give the picked ground these corners (in the world): its points, and its size round them. */
export const setGroundCorners = (points: readonly TVec2[], options?: ICommitOptions) => {
	const ground = picked();
	const next = withCorners(points.map((point) => toLocal(ground, point)));
	updateGround(
		(draft) => {
			draft.points = next.points;
			draft.width = next.width;
			draft.depth = next.depth;
		},
		options,
		ground.id,
	);
};

/** Its corners in the world, as they stand. */
const worldCorners = (): TVec2[] => {
	const ground = picked();
	return groundCornersOf(ground).map(
		([x, z]): TVec2 => [x + ground.position[0], z + ground.position[1]],
	);
};

/** The picked ground's corners in the world, for drags that start from them. */
export const pickedCorners = worldCorners;

/** Move one corner (a rectangle's first move makes it a shape of four corners). */
export const moveGroundCorner = (index: number, point: TVec2, options?: ICommitOptions) => {
	const corners = worldCorners();
	if (!corners[index]) {
		return;
	}
	setGroundCorners(
		corners.map((corner, i) => (i === index ? point : corner)),
		options,
	);
};

/** Move several corners by as much, each from where it started (world corners). */
export const moveGroundCornersBy = (
	from: readonly TVec2[],
	indices: readonly number[],
	offset: TVec2,
	options?: ICommitOptions,
) =>
	setGroundCorners(
		from.map(
			(corner, i): TVec2 =>
				indices.includes(i) ? [corner[0] + offset[0], corner[1] + offset[1]] : corner,
		),
		options,
	);

/** Add a corner before `index` (at the end for the last side), selected. */
export const insertGroundCorner = (index: number, point: TVec2, options?: ICommitOptions) => {
	const corners = worldCorners();
	corners.splice(index, 0, point);
	setGroundCorners(corners, options);
	useGroundEditing.setState({ selected: [index] });
};

/** Take corners out (Delete, or a double-click on one); a ground keeps three. */
export const removeGroundCorners = (indices: readonly number[]) => {
	const corners = worldCorners();
	const kept = corners.filter((_, i) => !indices.includes(i));
	if (kept.length < 3 || kept.length === corners.length) {
		return;
	}
	setGroundCorners(kept);
	useGroundEditing.setState({ selected: [] });
};

/** Take one corner out; a ground keeps three. */
export const removeGroundCorner = (index: number) => removeGroundCorners([index]);

/** Resize the picked ground: the rectangle's sides, or its shape stretched to fill the new size. */
export const resizeGround = (width: number, depth: number, options?: ICommitOptions) => {
	const next = resized(picked(), width, depth);
	updateGround((ground) => {
		ground.width = next.width;
		ground.depth = next.depth;
		ground.points = next.points;
	}, options);
};

/** Give the picked ground one of the shapes, filling its width × depth. */
export const setGroundShape = (id: TGroundShapeId) => {
	const shape = GROUND_SHAPES.find((candidate) => candidate.id === id);
	if (!shape) {
		return;
	}
	const { width, depth } = picked();
	const next = shape.make(width, depth);
	updateGround((ground) => {
		ground.points = next.points;
		ground.cornerRadius = next.cornerRadius;
	});
	useGroundEditing.setState({ selected: [] });
};

/** Which of the shapes a ground is now, if it's one exactly as made; null once it's been reshaped. */
export const groundShapeIdOf = (
	of: Pick<TGround, "width" | "depth" | "points" | "cornerRadius">,
): TGroundShapeId | null => {
	const same = (a: TVec2[] | null, b: TVec2[] | null) =>
		a === b ||
		(a !== null &&
			b !== null &&
			a.length === b.length &&
			a.every((point, i) => point[0] === b[i][0] && point[1] === b[i][1]));
	return (
		GROUND_SHAPES.find((shape) => {
			const made = shape.make(of.width, of.depth);
			return same(made.points, of.points) && made.cornerRadius === of.cornerRadius;
		})?.id ?? null
	);
};

/** A ground on the move, and what stands on it, as they were when the move began. */
export interface IGroundMove {
	groundId: string;
	position: TVec2;
	altitude: number;
	on: IOnGround;
	before: TScene;
}

/** Start moving a ground: what stands on it now moves with it (ADR-0155). */
export const startGroundMove = (id = picked().id): IGroundMove | null => {
	const scene = useEditor.getState().scene;
	const ground = scene.grounds.find((each) => each.id === id);
	if (!ground) {
		return null;
	}
	return {
		groundId: id,
		position: ground.position,
		altitude: ground.altitude,
		on: thingsOnGround(scene, id),
		before: scene,
	};
};

/**
 * Move a ground by `offset` along the ground and `lift` up, from where it
 * was when the move began, and everything on it with it: objects, areas, road
 * and fence points (a road crossing to another ground stretches, as a bridge)
 * and the viewpoints looking at it. It stays within the largest world and
 * never goes below the base level. One undo step per drag (`options`).
 */
export const moveGround = (
	move: IGroundMove,
	offset: TVec2,
	lift: number,
	options?: ICommitOptions,
) => {
	const before = move.before;
	const ground = before.grounds.find((each) => each.id === move.groundId);
	if (!ground) {
		return;
	}
	// Within the largest world, its whole box.
	const half = GROUND_SIZE.most / 2;
	const box = boxOf(ground);
	const dx = clamp(offset[0], -half - box.minX, half - box.maxX);
	const dz = clamp(offset[1], -half - box.minZ, half - box.maxZ);
	const dy = Math.max(-move.altitude, lift);
	const { on } = move;
	const entityIds = new Set(on.entityIds);
	const areaIds = new Set(on.areaIds);
	const viewpointIds = new Set(on.viewpointIds);
	const roadPoints = new Map<string, Set<number>>();
	for (const { roadId, index } of on.roadPoints) {
		roadPoints.set(roadId, (roadPoints.get(roadId) ?? new Set()).add(index));
	}
	const fencePoints = new Map<string, Set<number>>();
	for (const { fenceId, index } of on.fencePoints) {
		fencePoints.set(fenceId, (fencePoints.get(fenceId) ?? new Set()).add(index));
	}
	useEditor.getState().commit((scene) => {
		const moving = scene.grounds.find((each) => each.id === move.groundId);
		if (moving) {
			moving.position = [round(ground.position[0] + dx), round(ground.position[1] + dz)];
			moving.altitude = round(ground.altitude + dy);
		}
		for (const entity of scene.entities) {
			const was = entityIds.has(entity.id) && before.entities.find((e) => e.id === entity.id);
			if (was) {
				entity.position = [round(was.position[0] + dx), round(was.position[1] + dz)];
				entity.altitude = round(was.altitude + dy);
			}
		}
		for (const area of scene.areas) {
			const was = areaIds.has(area.id) && before.areas.find((a) => a.id === area.id);
			if (was) {
				// Its heights are from the ground under it, so they rise with it by themselves.
				area.points = was.points.map(([x, z, ...lift]) => [
					round(x + dx),
					round(z + dz),
					...lift,
				]) as typeof area.points;
				area.peaks = was.peaks.map(([x, z, ...rest]) => [
					round(x + dx),
					round(z + dz),
					...rest,
				]) as typeof area.peaks;
			}
		}
		for (const road of scene.roads) {
			const indices = roadPoints.get(road.id);
			const was = indices && before.roads.find((r) => r.id === road.id);
			if (indices && was) {
				road.points = was.points.map((point, index) => {
					if (!indices.has(index)) {
						return point;
					}
					const [x, z, height = 0, ...rest] = point;
					return [round(x + dx), round(z + dz), round(height + dy), ...rest];
				}) as typeof road.points;
			}
		}
		for (const fence of scene.fences) {
			const indices = fencePoints.get(fence.id);
			const was = indices && before.fences.find((f) => f.id === fence.id);
			if (indices && was) {
				// Fences stand on the ground under them, so they rise with it by themselves.
				fence.points = was.points.map((point, index) =>
					indices.has(index)
						? [round(point[0] + dx), round(point[1] + dz), ...point.slice(2)]
						: point,
				) as typeof fence.points;
			}
		}
		for (const viewpoint of scene.viewpoints) {
			const was =
				viewpointIds.has(viewpoint.id) && before.viewpoints.find((v) => v.id === viewpoint.id);
			if (was) {
				viewpoint.target = [round(was.target[0] + dx), round(was.target[1] + dz)];
				viewpoint.targetAltitude = round(was.targetAltitude + dy);
			}
		}
	}, options);
};

/** A new ground beside the others, the size of the first, picked and named after its place. */
export const addGround = () => {
	const { grounds } = useEditor.getState().scene;
	const id = newGroundId(grounds);
	const width = 30;
	const depth = 30;
	const ground = GroundSchema.parse({
		id,
		width,
		depth,
		position: newGroundPosition(grounds, width, depth),
		colors: grounds[0]?.colors ?? {},
		surface: grounds[0]?.surface ?? undefined,
	});
	useEditor.getState().commit((scene) => {
		scene.grounds.push(ground);
	});
	useGroundEditing.setState({ pickedId: id, selected: [] });
	return id;
};

/** What goes with a ground when it's removed: what stands wholly on it (a bridge to it stays). */
export const itemsGoingWith = (scene: TScene, groundId: string): ISceneItem[] => {
	const on = thingsOnGround(scene, groundId);
	return [
		...on.entityIds.map((id) => ({ kind: "entity" as const, id })),
		...on.areaIds.map((id) => ({ kind: "area" as const, id })),
		...on.wholeRoadIds.map((id) => ({ kind: "road" as const, id })),
		...on.wholeFenceIds.map((id) => ({ kind: "fence" as const, id })),
	];
};

/** How many things go with a ground when it's removed. */
export const countGoingWith = (scene: TScene, groundId: string) =>
	countOnGround(thingsOnGround(scene, groundId));

/** Remove a ground and what stands wholly on it, in one undo step; a world keeps one ground. */
export const removeGround = (id: string) => {
	const scene = useEditor.getState().scene;
	if (scene.grounds.length <= 1) {
		return;
	}
	const items = itemsGoingWith(scene, id);
	useEditor.getState().commit((draft) => {
		removeFromScene(draft, items);
		draft.grounds = draft.grounds.filter((ground) => ground.id !== id);
	});
	useEditor.getState().clearSelection();
	useGroundEditing.setState((state) => ({
		pickedId: state.pickedId === id ? null : state.pickedId,
		isOn: state.pickedId === id ? false : state.isOn,
		selected: [],
	}));
};
