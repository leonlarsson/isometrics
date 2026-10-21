import { type Draft, produce } from "immer";
import { nanoid } from "nanoid";
import { create } from "zustand";

import { normalizeDegrees, round } from "#/lib/math";
import { ROAD_STYLE_LABELS, ROAD_STYLE_WIDTH } from "#/scene/roads";
import {
	EntitySchema,
	RoadSchema,
	type TDataEntry,
	type TEntity,
	type TEntityInput,
	type TRoad,
	type TRoadInput,
	type TRoadStyle,
	type TScene,
	type TVec2,
} from "#/scene/schema";
import { createWarehouseScene } from "#/templates/warehouse";

export type TEditorMode = "edit" | "view";
export type TInspectorTab = "object" | "data" | "scene";

/** Grid step for dragging and nudging, in ground units. */
export const SNAP_STEP = 0.5;

const HISTORY_LIMIT = 100;
/** Commits with the same coalesce key within this window share one undo step. */
const COALESCE_MS = 1000;

export interface ICommitOptions {
	/** false = change the scene without creating an undo step (e.g. live preview). */
	record?: boolean;
	/** Group rapid edits (typing, slider drags, entity drags) into one undo step. */
	coalesce?: string;
}

/** A road being drawn point by point. Runtime UI state; never saved in the scene. */
export interface IRoadDrawing {
	style: TRoadStyle;
	points: TVec2[];
}

export interface IEditorState {
	scene: TScene;
	past: TScene[];
	future: TScene[];
	lastCommit: { key: string; at: number } | null;

	selectedId: string | null;
	selectedRoadId: string | null;
	drawing: IRoadDrawing | null;
	mode: TEditorMode;
	tab: TInspectorTab;
	dragging: boolean;
	snapping: boolean;
	playing: boolean;
	/** Incremented to ask the viewport to re-frame the camera. */
	viewNonce: number;

	commit: (recipe: (scene: Draft<TScene>) => void, options?: ICommitOptions) => void;
	loadScene: (scene: TScene) => void;
	undo: () => void;
	redo: () => void;

	select: (id: string | null) => void;
	selectRoad: (id: string | null) => void;
	/** Deselect any entity or road. */
	clearSelection: () => void;
	setMode: (mode: TEditorMode) => void;
	setTab: (tab: TInspectorTab) => void;
	setDragging: (dragging: boolean) => void;
	toggleSnapping: () => void;
	togglePlaying: () => void;
	resetView: () => void;

	addEntity: (input: Omit<TEntityInput, "id"> & { id?: string }) => string;
	updateEntity: (
		id: string,
		recipe: (entity: Draft<TEntity>) => void,
		options?: ICommitOptions,
	) => void;
	moveEntity: (id: string, position: TVec2, options?: ICommitOptions) => void;
	rotateEntity: (id: string, deltaDegrees: number) => void;
	removeEntity: (id: string) => void;
	duplicateEntity: (id: string) => string | null;

	upsertData: (entry: TDataEntry, previousKey?: string) => void;
	removeData: (key: string) => void;

	addRoad: (input: Omit<TRoadInput, "id"> & { id?: string }) => string;
	updateRoad: (id: string, recipe: (road: Draft<TRoad>) => void, options?: ICommitOptions) => void;
	removeRoad: (id: string) => void;
	moveRoadPoint: (id: string, index: number, point: TVec2, options?: ICommitOptions) => void;
	/** Insert a point before `index`. */
	insertRoadPoint: (id: string, index: number, point: TVec2, options?: ICommitOptions) => void;
	removeRoadPoint: (id: string, index: number) => void;

	startDrawing: (style: TRoadStyle) => void;
	addDrawingPoint: (point: TVec2) => void;
	undoDrawingPoint: () => void;
	/** Create the road from the drawn points (needs at least 2). Returns its id. */
	finishDrawing: (options?: { closed?: boolean }) => string | null;
	cancelDrawing: () => void;
}

export const newId = (prefix: string) => `${prefix}_${nanoid(8)}`;

/** Replace every reference to a data key (labels and detail tiles). */
const renameDataReferences = (scene: Draft<TScene>, from: string, to: string | null) => {
	const swap = (keys: string[]) => keys.flatMap((key) => (key === from ? (to ? [to] : []) : [key]));
	for (const entity of scene.entities) {
		if (entity.label) {
			entity.label.dataKeys = swap(entity.label.dataKeys);
		}
		entity.details.dataKeys = swap(entity.details.dataKeys);
	}
};

export const createEditorStore = (initialScene: TScene = createWarehouseScene()) => {
	return create<IEditorState>()((set, get) => ({
		scene: initialScene,
		past: [],
		future: [],
		lastCommit: null,

		selectedId: null,
		selectedRoadId: null,
		drawing: null,
		mode: "edit",
		tab: "object",
		dragging: false,
		snapping: true,
		playing: true,
		viewNonce: 0,

		commit: (recipe, options = {}) =>
			set((state) => {
				const next = produce(state.scene, recipe);
				if (next === state.scene) {
					return state;
				}
				if (options.record === false) {
					return { scene: next };
				}

				const now = Date.now();
				const { coalesce } = options;
				const last = state.lastCommit;
				if (coalesce && last && last.key === coalesce && now - last.at < COALESCE_MS) {
					return { scene: next, future: [], lastCommit: { key: coalesce, at: now } };
				}
				return {
					scene: next,
					past: [...state.past, state.scene].slice(-HISTORY_LIMIT),
					future: [],
					lastCommit: coalesce ? { key: coalesce, at: now } : null,
				};
			}),

		loadScene: (scene) =>
			set({
				scene,
				past: [],
				future: [],
				lastCommit: null,
				selectedId: null,
				selectedRoadId: null,
				drawing: null,
			}),

		undo: () =>
			set((state) => {
				const previous = state.past.at(-1);
				if (!previous) {
					return state;
				}
				return {
					scene: previous,
					past: state.past.slice(0, -1),
					future: [state.scene, ...state.future],
					lastCommit: null,
					selectedId: previous.entities.some((e) => e.id === state.selectedId)
						? state.selectedId
						: null,
					selectedRoadId: previous.roads.some((r) => r.id === state.selectedRoadId)
						? state.selectedRoadId
						: null,
				};
			}),

		redo: () =>
			set((state) => {
				const [next, ...rest] = state.future;
				if (!next) {
					return state;
				}
				return {
					scene: next,
					past: [...state.past, state.scene],
					future: rest,
					lastCommit: null,
					selectedId: next.entities.some((e) => e.id === state.selectedId)
						? state.selectedId
						: null,
					selectedRoadId: next.roads.some((r) => r.id === state.selectedRoadId)
						? state.selectedRoadId
						: null,
				};
			}),

		select: (id) =>
			set((state) => ({
				selectedId: id,
				selectedRoadId: id ? null : state.selectedRoadId,
				tab: id && state.mode === "edit" ? "object" : state.tab,
			})),
		selectRoad: (id) =>
			set((state) => ({
				selectedRoadId: id,
				selectedId: id ? null : state.selectedId,
				tab: id && state.mode === "edit" ? "object" : state.tab,
			})),
		clearSelection: () => set({ selectedId: null, selectedRoadId: null }),
		setMode: (mode) => set({ mode, selectedId: null, selectedRoadId: null, drawing: null }),
		setTab: (tab) => set({ tab }),
		setDragging: (dragging) => set({ dragging }),
		toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
		togglePlaying: () => set((s) => ({ playing: !s.playing })),
		resetView: () => set((s) => ({ viewNonce: s.viewNonce + 1 })),

		addEntity: (input) => {
			const entity = EntitySchema.parse({ ...input, id: input.id ?? newId(input.kind) });
			get().commit((scene) => {
				scene.entities.push(entity);
			});
			set({ selectedId: entity.id, tab: "object" });
			return entity.id;
		},

		updateEntity: (id, recipe, options) =>
			get().commit((scene) => {
				const entity = scene.entities.find((e) => e.id === id);
				if (entity) {
					recipe(entity);
				}
			}, options),

		moveEntity: (id, position, options) =>
			get().updateEntity(
				id,
				(entity) => {
					entity.position = [round(position[0]), round(position[1])];
				},
				options,
			),

		rotateEntity: (id, delta) =>
			get().updateEntity(
				id,
				(entity) => {
					entity.rotation = normalizeDegrees(entity.rotation + delta);
				},
				{ coalesce: `rotate:${id}` },
			),

		removeEntity: (id) => {
			get().commit((scene) => {
				scene.entities = scene.entities.filter((e) => e.id !== id);
			});
			if (get().selectedId === id) {
				set({ selectedId: null });
			}
		},

		duplicateEntity: (id) => {
			const source = get().scene.entities.find((e) => e.id === id);
			if (!source) {
				return null;
			}
			const copy: TEntity = structuredClone(source);
			copy.id = newId(source.kind);
			copy.name = source.name ? `${source.name} copy` : "";
			copy.position = [source.position[0] + 1, source.position[1] + 1];
			if (copy.follow) {
				copy.follow.offset += 3;
			}
			get().commit((scene) => {
				scene.entities.push(copy);
			});
			set({ selectedId: copy.id });
			return copy.id;
		},

		upsertData: (entry, previousKey) =>
			get().commit(
				(scene) => {
					const lookup = previousKey ?? entry.key;
					const index = scene.data.findIndex((d) => d.key === lookup);
					if (index === -1) {
						scene.data.push(entry);
						return;
					}
					// Refuse to rename onto an existing key.
					if (entry.key !== lookup && scene.data.some((d) => d.key === entry.key)) {
						return;
					}
					scene.data[index] = entry;
					if (entry.key !== lookup) {
						renameDataReferences(scene, lookup, entry.key);
					}
				},
				{ coalesce: `data:${previousKey ?? entry.key}` },
			),

		removeData: (key) =>
			get().commit((scene) => {
				scene.data = scene.data.filter((d) => d.key !== key);
				renameDataReferences(scene, key, null);
			}),

		addRoad: (input) => {
			const road = RoadSchema.parse({ ...input, id: input.id ?? newId("road") });
			get().commit((scene) => {
				scene.roads.push(road);
			});
			set({ selectedRoadId: road.id, selectedId: null, tab: "object" });
			return road.id;
		},

		updateRoad: (id, recipe, options) =>
			get().commit((scene) => {
				const road = scene.roads.find((r) => r.id === id);
				if (road) {
					recipe(road);
				}
			}, options),

		removeRoad: (id) => {
			get().commit((scene) => {
				scene.roads = scene.roads.filter((r) => r.id !== id);
				// Vehicles that drove along it are parked where the road was.
				for (const entity of scene.entities) {
					if (entity.follow?.roadId === id) {
						entity.follow = null;
					}
				}
			});
			if (get().selectedRoadId === id) {
				set({ selectedRoadId: null });
			}
		},

		moveRoadPoint: (id, index, point, options) =>
			get().updateRoad(
				id,
				(road) => {
					if (road.points[index]) {
						road.points[index] = [round(point[0]), round(point[1])];
					}
				},
				options,
			),

		insertRoadPoint: (id, index, point, options) =>
			get().updateRoad(
				id,
				(road) => {
					road.points.splice(index, 0, [round(point[0]), round(point[1])]);
				},
				options,
			),

		removeRoadPoint: (id, index) =>
			get().updateRoad(id, (road) => {
				if (road.points.length > 2) {
					road.points.splice(index, 1);
				}
			}),

		startDrawing: (style) =>
			set({ drawing: { style, points: [] }, selectedId: null, selectedRoadId: null }),

		addDrawingPoint: (point) =>
			set((state) => {
				if (!state.drawing) {
					return state;
				}
				const last = state.drawing.points.at(-1);
				if (last && last[0] === point[0] && last[1] === point[1]) {
					return state;
				}
				return { drawing: { ...state.drawing, points: [...state.drawing.points, point] } };
			}),

		undoDrawingPoint: () =>
			set((state) =>
				state.drawing
					? { drawing: { ...state.drawing, points: state.drawing.points.slice(0, -1) } }
					: state,
			),

		finishDrawing: (options = {}) => {
			const { drawing, scene } = get();
			set({ drawing: null });
			if (!drawing || drawing.points.length < 2) {
				return null;
			}
			const count = scene.roads.filter((r) => r.style === drawing.style).length;
			return get().addRoad({
				name: `${ROAD_STYLE_LABELS[drawing.style]} ${count + 1}`,
				style: drawing.style,
				points: drawing.points,
				width: ROAD_STYLE_WIDTH[drawing.style],
				closed: Boolean(options.closed) && drawing.points.length > 2,
			});
		},

		cancelDrawing: () => set({ drawing: null }),
	}));
};

export const useEditor = createEditorStore();

export const selectSelectedEntity = (state: IEditorState) =>
	state.scene.entities.find((e) => e.id === state.selectedId) ?? null;

export const selectSelectedRoad = (state: IEditorState) =>
	state.scene.roads.find((r) => r.id === state.selectedRoadId) ?? null;
