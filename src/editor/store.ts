import { type Draft, produce } from "immer";
import { nanoid } from "nanoid";
import { create } from "zustand";

import { normalizeDegrees, round } from "#/lib/math";
import {
	EntitySchema,
	type TDataEntry,
	type TEntity,
	type TEntityInput,
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

export interface IEditorState {
	scene: TScene;
	past: TScene[];
	future: TScene[];
	lastCommit: { key: string; at: number } | null;

	selectedId: string | null;
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

		loadScene: (scene) => set({ scene, past: [], future: [], lastCommit: null, selectedId: null }),

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
				};
			}),

		select: (id) =>
			set((state) => ({
				selectedId: id,
				tab: id && state.mode === "edit" ? "object" : state.tab,
			})),
		setMode: (mode) => set({ mode, selectedId: null }),
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
	}));
};

export const useEditor = createEditorStore();

export const selectSelectedEntity = (state: IEditorState) =>
	state.scene.entities.find((e) => e.id === state.selectedId) ?? null;
