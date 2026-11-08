import { create } from "zustand";

import {
	GROUND_SHAPES,
	groundCornersOf,
	resized,
	type TGroundShapeId,
	withCorners,
} from "#/scene/groundShape";
import type { TGround, TVec2 } from "#/scene/schema";

import { type ICommitOptions, useEditor } from "./store";

/**
 * Shaping the ground (ADR-0155): whether its handles show in the view, and
 * which of its corners are selected for the move gizmo. Runtime UI state,
 * never saved; what it changes goes through the store's `commit`, so it can
 * be undone.
 */
interface IGroundShaping {
	isOn: boolean;
	/** Its selected corners, by index (in `groundCornersOf`). */
	selected: readonly number[];
}

export const useGroundShaping = create<IGroundShaping>(() => ({ isOn: false, selected: [] }));

/** Start or stop shaping the ground. Starting leaves Edit mode's selection: the ground is what's edited. */
export const shapeGround = (isOn: boolean) => {
	if (isOn) {
		useEditor.getState().clearSelection();
	}
	useGroundShaping.setState({ isOn, selected: [] });
};

/** Select one corner (null: none), or with `adds` add it or take it out. */
export const selectGroundCorner = (index: number | null, adds = false) =>
	useGroundShaping.setState(({ selected }) => {
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

const ground = () => useEditor.getState().scene.ground;

/** Give the ground these corners: its points, and its width and depth round them. */
export const setGroundCorners = (points: readonly TVec2[], options?: ICommitOptions) => {
	const next = withCorners(points);
	useEditor.getState().commit((scene) => {
		scene.ground.points = next.points;
		scene.ground.width = next.width;
		scene.ground.depth = next.depth;
	}, options);
};

/** Move one corner (a rectangle's first move makes it a shape of four corners). */
export const moveGroundCorner = (index: number, point: TVec2, options?: ICommitOptions) => {
	const corners = groundCornersOf(ground());
	if (!corners[index]) {
		return;
	}
	setGroundCorners(
		corners.map((corner, i) => (i === index ? point : corner)),
		options,
	);
};

/** Move several corners by as much, each from where it started. */
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
	const corners = [...groundCornersOf(ground())];
	corners.splice(index, 0, point);
	setGroundCorners(corners, options);
	useGroundShaping.setState({ selected: [index] });
};

/** Take corners out (Delete, or a double-click on one); the ground keeps three. */
export const removeGroundCorners = (indices: readonly number[]) => {
	const corners = groundCornersOf(ground());
	const kept = corners.filter((_, i) => !indices.includes(i));
	if (kept.length < 3 || kept.length === corners.length) {
		return;
	}
	setGroundCorners(kept);
	useGroundShaping.setState({ selected: [] });
};

/** Take one corner out; the ground keeps three. */
export const removeGroundCorner = (index: number) => removeGroundCorners([index]);

/** Resize the ground: the rectangle's sides, or its shape stretched to fill the new size. */
export const resizeGround = (width: number, depth: number, options?: ICommitOptions) => {
	const next = resized(ground(), width, depth);
	useEditor.getState().commit((scene) => {
		scene.ground.width = next.width;
		scene.ground.depth = next.depth;
		scene.ground.points = next.points;
	}, options);
};

/** Give the ground one of the shapes, filling its width × depth. */
export const setGroundShape = (id: TGroundShapeId) => {
	const shape = GROUND_SHAPES.find((candidate) => candidate.id === id);
	if (!shape) {
		return;
	}
	const { width, depth } = ground();
	const next = shape.make(width, depth);
	useEditor.getState().commit((scene) => {
		scene.ground.points = next.points;
		scene.ground.cornerRadius = next.cornerRadius;
	});
	useGroundShaping.setState({ selected: [] });
};

/** Which of the shapes the ground is now, if it's one exactly as made; null once it's been reshaped. */
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
