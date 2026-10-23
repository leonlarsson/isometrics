import { type Draft, produce } from "immer";
import { nanoid } from "nanoid";
import { create } from "zustand";

import { normalizeDegrees, round } from "#/lib/math";
import { getPart } from "#/parts/registry";
import { AREA_TYPE_HEIGHT, AREA_TYPE_LABELS } from "#/scene/areas";
import {
	joinedPoints,
	pointWidth,
	ROAD_STYLE_LABELS,
	ROAD_STYLE_WIDTH,
	type TRoadEnd,
} from "#/scene/roads";
import {
	AreaSchema,
	EntitySchema,
	FollowSchema,
	RoadSchema,
	type TArea,
	type TAreaInput,
	type TAreaType,
	type TDataEntry,
	type TEntity,
	type TEntityInput,
	type TRoad,
	type TRoadInput,
	type TRoadPoint,
	type TRoadStyle,
	type TScene,
	type TVec2,
	type TViewPose,
	type TViewpoint,
	ViewpointSchema,
} from "#/scene/schema";
import { createBrightwaterScene } from "#/templates/brightwater";

import { boundsOf, type IFrameBox, type ISceneItem } from "./framing";

export type TEditorMode = "edit" | "view";
/**
 * Inspector tabs. "add" (the Add to scene panel) and "outliner" only exist in the narrow
 * layout; the wide layout has them in the left column.
 */
export type TInspectorTab = "add" | "outliner" | "object" | "data" | "scene";

/** Road widths a point may have (the schema's limits). */
const clampRoadWidth = (width: number) => round(Math.min(20, Math.max(0.4, width)));

/**
 * A copy of a road point with some parts changed, keeping the rest (notably
 * its own width). `width: null` drops the point's width so it uses the road's.
 */
const withPoint = (
	point: readonly number[],
	change: { x?: number; z?: number; height?: number; width?: number | null },
): TRoadPoint => {
	const x = round(change.x ?? point[0]);
	const z = round(change.z ?? point[1]);
	const height = round(change.height ?? point[2] ?? 0);
	const width = change.width === undefined ? pointWidth(point) : change.width;
	return width === null || width === undefined ? [x, z, height] : [x, z, height, width];
};

/** Grid step for dragging and nudging, in ground units. */
export const SNAP_STEP = 0.5;
/** Alt+arrow nudges by this much instead of a grid step, for lining things up by eye. */
export const FINE_NUDGE_STEP = 0.1;

const HISTORY_LIMIT = 100;
/** Commits with the same coalesce key within this window share one undo step. */
const COALESCE_MS = 1000;

export interface ICommitOptions {
	/** false = change the scene without creating an undo step (e.g. live preview). */
	record?: boolean;
	/** Group rapid edits (typing, slider drags, entity drags) into one undo step. */
	coalesce?: string;
	/**
	 * With `coalesce`: the edits are one gesture (a drag with a unique key), so they merge
	 * however long the pointer pauses, not just within the usual second.
	 */
	gesture?: boolean;
}

/** A road or area being drawn point by point. Runtime UI state; never saved in the scene. */
export interface IRoadDrawing {
	/** What the points will become. */
	target: "road" | "area";
	/** Road style (roads only). */
	style: TRoadStyle;
	/** Area type (areas only). */
	areaType: TAreaType;
	points: TRoadPoint[];
	/** When continuing an existing road: its id. Finishing replaces that road's points. */
	roadId?: string;
}

export type TTransformMode = "grab" | "rotate" | "scale";
export type TTransformAxis = "x" | "y" | "z";

/** A keyboard transform (G / R / S) in progress. Runtime UI state; never saved in the scene. */
export interface ITransformSession {
	mode: TTransformMode;
	/** Axis the move is locked to (X / Y / Z keys), or null for free movement on the ground. */
	axis: TTransformAxis | null;
	/** Number typed for an exact value, as typed (e.g. "-2.5"). Empty: follow the mouse. */
	typed: string;
}

/** Two road ends that touch after a drag; the UI offers to join them. */
export interface IJoinOffer {
	aId: string;
	aEnd: TRoadEnd;
	bId: string;
	bEnd: TRoadEnd;
}

/** Where a vehicle being dragged would join a road if dropped now, for the route preview. */
export interface IRoutePreview {
	roadId: string;
	reverse: boolean;
}

/** A vehicle that was just dropped onto a road; the UI asks whether it should drive along it. */
export interface IFollowOffer extends IRoutePreview {
	entityId: string;
	/** Distance along the road where it would start (FollowSchema `offset`). */
	offset: number;
	/** Where it was dropped; the offer lapses once it has moved. */
	position: TVec2;
}

export interface IEditorState {
	scene: TScene;
	past: TScene[];
	future: TScene[];
	lastCommit: { key: string; at: number } | null;

	selectedId: string | null;
	selectedRoadId: string | null;
	selectedAreaId: string | null;
	/** Selected control point of the selected road or area. */
	selectedPointIndex: number | null;
	drawing: IRoadDrawing | null;
	/** Part kind being dragged from the palette onto the scene. Runtime UI state. */
	placingKind: string | null;
	transform: ITransformSession | null;
	/** Pixels at the bottom of the viewport covered by UI (the narrow layout's sheet). */
	viewInset: number;
	joinOffer: IJoinOffer | null;
	routePreview: IRoutePreview | null;
	/** A driving vehicle is being dragged: dropped off a road, it parks. */
	rerouting: boolean;
	followOffer: IFollowOffer | null;
	mode: TEditorMode;
	tab: TInspectorTab;
	dragging: boolean;
	snapping: boolean;
	playing: boolean;
	/** Perspective camera instead of the orthographic diorama view. Runtime UI state. */
	perspective: boolean;
	/** Incremented to ask the viewport to re-frame the camera. */
	viewNonce: number;
	/** What the next re-frame shows: a box (frame selection), or null for the whole ground. */
	frameBox: IFrameBox | null;
	/** The item under the pointer in a list (outliner, Scene tab), highlighted in the world. */
	hovered: ISceneItem | null;
	/** Where the camera is gliding to (a viewpoint), picked up by render/CameraFlight. */
	flight: { pose: TViewPose; nonce: number } | null;
	/** The viewpoint last gone to (the one View mode's ◀ ▶ steps from). Runtime UI state. */
	activeViewpointId: string | null;
	/**
	 * The camera follows a vehicle (render/CameraFollow): keeping its angle, or riding along
	 * behind it in perspective. Runtime UI state.
	 */
	cameraFollow: { entityId: string; ride: boolean; perspectiveBefore: boolean } | null;

	commit: (recipe: (scene: Draft<TScene>) => void, options?: ICommitOptions) => void;
	loadScene: (scene: TScene) => void;
	/** Cancel an unfinished gesture: back to `before`, dropping the undo step it made. */
	revertTo: (before: TScene) => void;
	/** Set while a gizmo or keyboard transform is running, so Esc can cancel it. */
	cancelGesture: (() => void) | null;
	setCancelGesture: (cancel: (() => void) | null) => void;
	undo: () => void;
	redo: () => void;

	select: (id: string | null) => void;
	selectRoad: (id: string | null) => void;
	/** Select a control point of a road (also selects the road), or clear the point selection. */
	selectRoadPoint: (roadId: string, index: number | null) => void;
	selectArea: (id: string | null) => void;
	/** Select a corner of an area (also selects the area), or clear the point selection. */
	selectAreaPoint: (areaId: string, index: number | null) => void;
	/** Deselect any entity, road or point. */
	clearSelection: () => void;
	setMode: (mode: TEditorMode) => void;
	setTab: (tab: TInspectorTab) => void;
	setDragging: (dragging: boolean) => void;
	startPlacing: (kind: string) => void;
	stopPlacing: () => void;
	startTransform: (mode: TTransformMode) => void;
	updateTransform: (patch: Partial<ITransformSession>) => void;
	/** End a keyboard transform, keeping what it did (cancelling goes through cancelGesture). */
	endTransform: () => void;
	setViewInset: (pixels: number) => void;
	toggleSnapping: () => void;
	togglePlaying: () => void;
	togglePerspective: () => void;
	resetView: () => void;
	/** Move the camera to the selected object, road or area. */
	frameSelection: () => void;
	setHovered: (item: ISceneItem | null) => void;
	/** Set an item's `hidden` or `locked` flag (one undo step). */
	setItemFlag: (item: ISceneItem, flag: "hidden" | "locked", value: boolean) => void;
	/** Hide the selected item, or show it again if it's hidden (H). It stays selected. */
	toggleSelectedHidden: () => void;
	/** Show every hidden item again (Alt+H). */
	revealAll: () => void;

	/** Follow a vehicle with the camera, or ride along behind it (perspective). */
	followWithCamera: (entityId: string, ride: boolean) => void;
	/** Stop following; a ride-along goes back to the camera type it started from. */
	stopFollowing: () => void;
	/** Glide the camera to a saved viewpoint (switching camera type if it needs to). */
	goToViewpoint: (id: string) => void;
	/** Save a view as a new viewpoint at the end of the list. Returns its id. */
	addViewpoint: (pose: TViewPose) => string;
	updateViewpoint: (
		id: string,
		recipe: (viewpoint: Draft<TViewpoint>) => void,
		options?: ICommitOptions,
	) => void;
	removeViewpoint: (id: string) => void;
	/** Move a viewpoint to another place in the list (`to` = its new index). */
	moveViewpoint: (id: string, to: number) => void;

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
	/** Move a point across the ground, keeping its height. */
	moveRoadPoint: (id: string, index: number, point: TVec2, options?: ICommitOptions) => void;
	setRoadPointHeight: (id: string, index: number, height: number, options?: ICommitOptions) => void;
	/** Give a point its own width, or `null` to use the road's width there again. */
	setRoadPointWidth: (
		id: string,
		index: number,
		width: number | null,
		options?: ICommitOptions,
	) => void;
	/** Insert a point before `index`. */
	insertRoadPoint: (id: string, index: number, point: TRoadPoint, options?: ICommitOptions) => void;
	removeRoadPoint: (id: string, index: number) => void;
	/**
	 * Cut a road at a point. An open road becomes two roads that share that
	 * point (returns the new road's id); a loop opens there (returns its own id).
	 */
	splitRoad: (id: string, index: number) => string | null;
	/** Join two road ends into one road; joining a road's own two ends makes a loop. */
	joinRoads: (aId: string, aEnd: TRoadEnd, bId: string, bEnd: TRoadEnd) => void;
	setJoinOffer: (offer: IJoinOffer | null) => void;
	setRoutePreview: (preview: IRoutePreview | null) => void;
	setRerouting: (rerouting: boolean) => void;
	setFollowOffer: (offer: IFollowOffer | null) => void;
	/** Make the offered vehicle drive along the road, as one undo step. */
	acceptFollowOffer: () => void;

	addArea: (input: Omit<TAreaInput, "id"> & { id?: string }) => string;
	updateArea: (id: string, recipe: (area: Draft<TArea>) => void, options?: ICommitOptions) => void;
	removeArea: (id: string) => void;
	moveAreaPoint: (id: string, index: number, point: TVec2, options?: ICommitOptions) => void;
	/** Insert a corner before `index`. */
	insertAreaPoint: (id: string, index: number, point: TVec2, options?: ICommitOptions) => void;
	/** Remove a corner (an area keeps at least three). */
	removeAreaPoint: (id: string, index: number) => void;

	startDrawing: (style: TRoadStyle) => void;
	startAreaDrawing: (type: TAreaType) => void;
	/** Continue drawing from one end of an existing open road. */
	continueDrawing: (roadId: string, end: TRoadEnd) => void;
	addDrawingPoint: (point: TVec2) => void;
	undoDrawingPoint: () => void;
	/** Create the road (2+ points) or area (3+ points) from the drawn points. Returns its id. */
	finishDrawing: (options?: { closed?: boolean }) => string | null;
	cancelDrawing: () => void;
}

export const newId = (prefix: string) => `${prefix}_${nanoid(8)}`;

/** Keep road/area/point selection only if it still exists in `scene` (after undo/redo). */
const validRoadSelection = (
	scene: TScene,
	state: Pick<IEditorState, "selectedRoadId" | "selectedAreaId" | "selectedPointIndex">,
) => {
	const road = scene.roads.find((r) => r.id === state.selectedRoadId);
	const area = scene.areas.find((a) => a.id === state.selectedAreaId);
	const points = road?.points ?? area?.points;
	return {
		selectedRoadId: road ? road.id : null,
		selectedAreaId: area ? area.id : null,
		selectedPointIndex:
			points && state.selectedPointIndex !== null && state.selectedPointIndex < points.length
				? state.selectedPointIndex
				: null,
	};
};

/** The selected object, road or area, if any. */
const selectedItem = (
	state: Pick<IEditorState, "selectedId" | "selectedRoadId" | "selectedAreaId">,
): ISceneItem | null =>
	state.selectedId
		? { kind: "entity", id: state.selectedId }
		: state.selectedRoadId
			? { kind: "road", id: state.selectedRoadId }
			: state.selectedAreaId
				? { kind: "area", id: state.selectedAreaId }
				: null;

/** Selection fields cleared together whenever something else gets selected. */
const NOTHING_SELECTED = {
	selectedId: null,
	selectedRoadId: null,
	selectedAreaId: null,
	selectedPointIndex: null,
} as const;

/** Replace every reference to a data key (labels, detail tiles and parts' data key fields). */
const renameDataReferences = (scene: Draft<TScene>, from: string, to: string | null) => {
	const swap = (keys: string[]) => keys.flatMap((key) => (key === from ? (to ? [to] : []) : [key]));
	for (const entity of scene.entities) {
		if (entity.label) {
			entity.label.dataKeys = swap(entity.label.dataKeys);
		}
		entity.details.dataKeys = swap(entity.details.dataKeys);
		for (const field of getPart(entity.kind)?.fields ?? []) {
			if (field.type === "dataKey" && entity.props[field.key] === from) {
				entity.props[field.key] = to ?? "";
			}
		}
	}
};

export const createEditorStore = (initialScene: TScene = createBrightwaterScene()) => {
	return create<IEditorState>()((set, get) => ({
		scene: initialScene,
		past: [],
		future: [],
		lastCommit: null,

		...NOTHING_SELECTED,
		drawing: null,
		placingKind: null,
		transform: null,
		viewInset: 0,
		joinOffer: null,
		routePreview: null,
		rerouting: false,
		followOffer: null,
		mode: "edit",
		tab: "object",
		dragging: false,
		snapping: true,
		playing: true,
		perspective: false,
		viewNonce: 0,
		frameBox: null,
		hovered: null,
		flight: null,
		activeViewpointId: null,
		cameraFollow: null,

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
				const recent = options.gesture || (last !== null && now - last.at < COALESCE_MS);
				if (coalesce && last && last.key === coalesce && recent) {
					return { scene: next, future: [], lastCommit: { key: coalesce, at: now } };
				}
				return {
					scene: next,
					past: [...state.past, state.scene].slice(-HISTORY_LIMIT),
					future: [],
					lastCommit: coalesce ? { key: coalesce, at: now } : null,
				};
			}),

		revertTo: (before) =>
			set((state) => {
				if (state.scene === before) {
					return state;
				}
				const index = state.past.lastIndexOf(before);
				return {
					scene: before,
					past: index >= 0 ? state.past.slice(0, index) : state.past,
					lastCommit: null,
				};
			}),
		cancelGesture: null,
		setCancelGesture: (cancel) => set({ cancelGesture: cancel }),

		loadScene: (scene) =>
			set({
				scene,
				past: [],
				future: [],
				lastCommit: null,
				...NOTHING_SELECTED,
				drawing: null,
				joinOffer: null,
				followOffer: null,
				activeViewpointId: null,
				flight: null,
				cameraFollow: null,
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
					...validRoadSelection(previous, state),
					joinOffer: null,
					followOffer: null,
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
					...validRoadSelection(next, state),
					joinOffer: null,
					followOffer: null,
				};
			}),

		select: (id) =>
			set((state) =>
				id
					? {
							...NOTHING_SELECTED,
							selectedId: id,
							tab: state.mode === "edit" ? "object" : state.tab,
							followOffer: state.followOffer?.entityId === id ? state.followOffer : null,
						}
					: { selectedId: null, followOffer: null },
			),
		selectRoad: (id) =>
			set((state) =>
				id
					? {
							...NOTHING_SELECTED,
							selectedRoadId: id,
							selectedPointIndex: id === state.selectedRoadId ? state.selectedPointIndex : null,
							tab: state.mode === "edit" ? "object" : state.tab,
						}
					: { selectedRoadId: null, selectedPointIndex: null },
			),
		selectRoadPoint: (roadId, index) =>
			set((state) => ({
				...NOTHING_SELECTED,
				selectedRoadId: roadId,
				selectedPointIndex: index,
				tab: state.mode === "edit" ? "object" : state.tab,
			})),
		selectArea: (id) =>
			set((state) =>
				id
					? {
							...NOTHING_SELECTED,
							selectedAreaId: id,
							selectedPointIndex: id === state.selectedAreaId ? state.selectedPointIndex : null,
							tab: state.mode === "edit" ? "object" : state.tab,
						}
					: { selectedAreaId: null, selectedPointIndex: null },
			),
		selectAreaPoint: (areaId, index) =>
			set((state) => ({
				...NOTHING_SELECTED,
				selectedAreaId: areaId,
				selectedPointIndex: index,
				tab: state.mode === "edit" ? "object" : state.tab,
			})),
		clearSelection: () => set({ ...NOTHING_SELECTED, joinOffer: null, followOffer: null }),
		setMode: (mode) =>
			set({
				mode,
				...NOTHING_SELECTED,
				drawing: null,
				placingKind: null,
				transform: null,
				joinOffer: null,
				routePreview: null,
				followOffer: null,
			}),
		setTab: (tab) => set({ tab }),
		setDragging: (dragging) => set({ dragging }),
		startPlacing: (kind) => set({ placingKind: kind, drawing: null, followOffer: null }),
		stopPlacing: () => set({ placingKind: null }),
		startTransform: (mode) => set({ transform: { mode, axis: null, typed: "" } }),
		updateTransform: (patch) =>
			set((s) => (s.transform ? { transform: { ...s.transform, ...patch } } : s)),
		endTransform: () => set({ transform: null }),
		setViewInset: (pixels) => set({ viewInset: pixels }),
		toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
		togglePlaying: () => set((s) => ({ playing: !s.playing })),
		togglePerspective: () => set((s) => ({ perspective: !s.perspective })),
		resetView: () =>
			set((s) => ({ viewNonce: s.viewNonce + 1, frameBox: null, cameraFollow: null })),

		frameSelection: () => {
			const item = selectedItem(get());
			const box = item ? boundsOf(get().scene, item) : null;
			if (box) {
				set((s) => ({ viewNonce: s.viewNonce + 1, frameBox: box, cameraFollow: null }));
			}
		},

		setHovered: (item) => set({ hovered: item }),

		setItemFlag: (item, flag, value) =>
			get().commit((scene) => {
				const list =
					item.kind === "entity"
						? scene.entities
						: item.kind === "road"
							? scene.roads
							: scene.areas;
				const found = list.find((thing) => thing.id === item.id);
				if (found) {
					found[flag] = value;
				}
			}),

		toggleSelectedHidden: () => {
			const state = get();
			const item = selectedItem(state);
			const list =
				item?.kind === "entity"
					? state.scene.entities
					: item?.kind === "road"
						? state.scene.roads
						: state.scene.areas;
			const found = item && list.find((thing) => thing.id === item.id);
			if (item && found) {
				state.setItemFlag(item, "hidden", !found.hidden);
			}
		},

		revealAll: () =>
			get().commit((scene) => {
				for (const thing of [...scene.entities, ...scene.roads, ...scene.areas]) {
					thing.hidden = false;
				}
			}),

		followWithCamera: (entityId, ride) =>
			set((s) => {
				const perspectiveBefore = s.cameraFollow?.perspectiveBefore ?? s.perspective;
				return {
					cameraFollow: { entityId, ride, perspectiveBefore },
					perspective: ride ? true : perspectiveBefore,
					flight: null,
				};
			}),

		stopFollowing: () =>
			set((s) =>
				s.cameraFollow
					? {
							cameraFollow: null,
							perspective: s.cameraFollow.ride ? s.cameraFollow.perspectiveBefore : s.perspective,
						}
					: s,
			),

		goToViewpoint: (id) => {
			const viewpoint = get().scene.viewpoints.find((v) => v.id === id);
			if (!viewpoint) {
				return;
			}
			set((s) => ({
				cameraFollow: null,
				perspective: viewpoint.perspective,
				flight: { pose: viewpoint, nonce: (s.flight?.nonce ?? 0) + 1 },
				activeViewpointId: id,
			}));
		},

		addViewpoint: (pose) => {
			const count = get().scene.viewpoints.length;
			const viewpoint = ViewpointSchema.parse({
				...pose,
				id: newId("view"),
				name: `Viewpoint ${count + 1}`,
			});
			get().commit((scene) => {
				scene.viewpoints.push(viewpoint);
			});
			set({ activeViewpointId: viewpoint.id });
			return viewpoint.id;
		},

		updateViewpoint: (id, recipe, options) =>
			get().commit((scene) => {
				const viewpoint = scene.viewpoints.find((v) => v.id === id);
				if (viewpoint) {
					recipe(viewpoint);
				}
			}, options),

		moveViewpoint: (id, to) =>
			get().commit((scene) => {
				const from = scene.viewpoints.findIndex((v) => v.id === id);
				if (from < 0 || to < 0 || to >= scene.viewpoints.length || from === to) {
					return;
				}
				const [viewpoint] = scene.viewpoints.splice(from, 1);
				scene.viewpoints.splice(to, 0, viewpoint);
			}),

		removeViewpoint: (id) => {
			get().commit((scene) => {
				scene.viewpoints = scene.viewpoints.filter((v) => v.id !== id);
			});
			if (get().activeViewpointId === id) {
				set({ activeViewpointId: null });
			}
		},

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
			set({ ...NOTHING_SELECTED, selectedRoadId: road.id, tab: "object" });
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
				set({ selectedRoadId: null, selectedPointIndex: null });
			}
			set({ joinOffer: null });
		},

		moveRoadPoint: (id, index, point, options) =>
			get().updateRoad(
				id,
				(road) => {
					const current = road.points[index];
					if (current) {
						road.points[index] = withPoint(current, { x: point[0], z: point[1] });
					}
				},
				options,
			),

		setRoadPointHeight: (id, index, height, options) =>
			get().updateRoad(
				id,
				(road) => {
					const current = road.points[index];
					if (current) {
						road.points[index] = withPoint(current, { height: Math.max(0, height) });
					}
				},
				options,
			),

		setRoadPointWidth: (id, index, width, options) =>
			get().updateRoad(
				id,
				(road) => {
					const current = road.points[index];
					if (current) {
						road.points[index] = withPoint(current, {
							width: width === null ? null : clampRoadWidth(width),
						});
					}
				},
				options,
			),

		insertRoadPoint: (id, index, point, options) =>
			get().updateRoad(
				id,
				(road) => {
					// Between points with their own widths, the new point keeps the width there.
					const n = road.points.length;
					const neighbours = road.closed
						? [road.points[(index - 1 + n) % n], road.points[index % n]]
						: [road.points[index - 1], road.points[index]];
					const widths = neighbours.filter(Boolean).map((p) => pointWidth(p));
					const width = widths.some((w) => w !== undefined)
						? widths.reduce<number>((sum, w) => sum + (w ?? road.width), 0) / widths.length
						: null;
					road.points.splice(index, 0, withPoint([point[0], point[1], point[2]], { width }));
				},
				options,
			),

		removeRoadPoint: (id, index) => {
			get().updateRoad(id, (road) => {
				if (road.points.length > 2) {
					road.points.splice(index, 1);
				}
			});
			set((state) =>
				state.selectedRoadId === id && state.selectedPointIndex !== null
					? { selectedPointIndex: null }
					: state,
			);
		},

		splitRoad: (id, index) => {
			const road = get().scene.roads.find((r) => r.id === id);
			if (!road || index < 0 || index >= road.points.length) {
				return null;
			}
			if (road.closed) {
				// Open the loop at this point: it becomes both the start and the end.
				get().updateRoad(id, (r) => {
					r.points = [...r.points.slice(index), ...r.points.slice(0, index + 1)];
					r.closed = false;
				});
				set({ selectedPointIndex: 0, joinOffer: null });
				return id;
			}
			if (index === 0 || index === road.points.length - 1) {
				return null; // nothing to cut at an end
			}
			const second = RoadSchema.parse({
				...structuredClone(road),
				id: newId("road"),
				name: road.name ? `${road.name} (2)` : "",
				points: road.points.slice(index),
			});
			get().commit((scene) => {
				const first = scene.roads.find((r) => r.id === id);
				if (first) {
					first.points = first.points.slice(0, index + 1);
					scene.roads.splice(scene.roads.indexOf(first) + 1, 0, second);
				}
			});
			set({ selectedRoadId: second.id, selectedPointIndex: 0, joinOffer: null });
			return second.id;
		},

		joinRoads: (aId, aEnd, bId, bEnd) => {
			const { roads } = get().scene;
			const a = roads.find((r) => r.id === aId);
			const b = roads.find((r) => r.id === bId);
			if (!a || !b || a.closed || b.closed) {
				return;
			}
			if (aId === bId) {
				if (aEnd !== bEnd && a.points.length > 2) {
					get().updateRoad(aId, (r) => {
						const first = r.points[0];
						const last = r.points[r.points.length - 1];
						if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) {
							r.points.pop(); // ends touch: keep one shared point
						}
						r.closed = true;
					});
				}
				set({ joinOffer: null, selectedRoadId: aId, selectedPointIndex: null });
				return;
			}
			get().commit((scene) => {
				const target = scene.roads.find((r) => r.id === aId);
				if (!target) {
					return;
				}
				// The absorbed road keeps its own width as per-point widths if it differs.
				const bPoints = b.points.map((p) =>
					b.width !== a.width && pointWidth(p) === undefined ? withPoint(p, { width: b.width }) : p,
				);
				target.points = joinedPoints(a.points, aEnd, bPoints, bEnd);
				scene.roads = scene.roads.filter((r) => r.id !== bId);
				// Vehicles on the absorbed road now drive the joined one.
				for (const entity of scene.entities) {
					if (entity.follow?.roadId === bId) {
						entity.follow.roadId = aId;
					}
				}
			});
			set({ ...NOTHING_SELECTED, joinOffer: null, selectedRoadId: aId });
		},

		setJoinOffer: (offer) => set({ joinOffer: offer }),
		setRoutePreview: (preview) => set({ routePreview: preview }),
		setRerouting: (rerouting) => set({ rerouting }),
		setFollowOffer: (offer) => set({ followOffer: offer }),

		acceptFollowOffer: () => {
			const offer = get().followOffer;
			if (!offer) {
				return;
			}
			set({ followOffer: null });
			get().updateEntity(offer.entityId, (entity) => {
				entity.follow = FollowSchema.parse({
					roadId: offer.roadId,
					offset: round(offer.offset),
					reverse: offer.reverse,
				});
				// The road sets height, heading and slope now; these would add on top of it.
				entity.elevation = 0;
				entity.rotation = 0;
				entity.pitch = 0;
			});
		},

		startDrawing: (style) =>
			set({
				drawing: { target: "road", style, areaType: "grass", points: [] },
				...NOTHING_SELECTED,
				joinOffer: null,
				followOffer: null,
			}),

		startAreaDrawing: (areaType) =>
			set({
				drawing: { target: "area", style: "asphalt", areaType, points: [] },
				...NOTHING_SELECTED,
				joinOffer: null,
				followOffer: null,
			}),

		continueDrawing: (roadId, end) => {
			const road = get().scene.roads.find((r) => r.id === roadId);
			if (!road || road.closed) {
				return;
			}
			// Orient the points so new ones are added after the chosen end.
			const points = end === "end" ? [...road.points] : [...road.points].reverse();
			set({
				drawing: { target: "road", style: road.style, areaType: "grass", points, roadId },
				...NOTHING_SELECTED,
				joinOffer: null,
				followOffer: null,
			});
		},

		addArea: (input) => {
			const area = AreaSchema.parse({ ...input, id: input.id ?? newId("area") });
			get().commit((scene) => {
				scene.areas.push(area);
			});
			set({ ...NOTHING_SELECTED, selectedAreaId: area.id, tab: "object" });
			return area.id;
		},

		updateArea: (id, recipe, options) =>
			get().commit((scene) => {
				const area = scene.areas.find((a) => a.id === id);
				if (area) {
					recipe(area);
				}
			}, options),

		removeArea: (id) => {
			get().commit((scene) => {
				scene.areas = scene.areas.filter((a) => a.id !== id);
			});
			if (get().selectedAreaId === id) {
				set({ selectedAreaId: null, selectedPointIndex: null });
			}
		},

		moveAreaPoint: (id, index, point, options) =>
			get().updateArea(
				id,
				(area) => {
					if (area.points[index]) {
						area.points[index] = [round(point[0]), round(point[1])];
					}
				},
				options,
			),

		insertAreaPoint: (id, index, point, options) =>
			get().updateArea(
				id,
				(area) => {
					area.points.splice(index, 0, [round(point[0]), round(point[1])]);
				},
				options,
			),

		removeAreaPoint: (id, index) => {
			get().updateArea(id, (area) => {
				if (area.points.length > 3) {
					area.points.splice(index, 1);
				}
			});
			set((state) =>
				state.selectedAreaId === id && state.selectedPointIndex !== null
					? { selectedPointIndex: null }
					: state,
			);
		},

		addDrawingPoint: (point) =>
			set((state) => {
				if (!state.drawing) {
					return state;
				}
				const last = state.drawing.points.at(-1);
				if (last && last[0] === point[0] && last[1] === point[1]) {
					return state;
				}
				// New points continue at the previous point's height (ground level for a new road).
				const next: TRoadPoint = [point[0], point[1], last?.[2] ?? 0];
				return { drawing: { ...state.drawing, points: [...state.drawing.points, next] } };
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
			if (drawing.target === "area") {
				if (drawing.points.length < 3) {
					return null;
				}
				const count = scene.areas.filter((a) => a.type === drawing.areaType).length;
				return get().addArea({
					name: `${AREA_TYPE_LABELS[drawing.areaType]} ${count + 1}`,
					type: drawing.areaType,
					points: drawing.points.map(([x, z]) => [x, z]),
					height: AREA_TYPE_HEIGHT[drawing.areaType],
				});
			}
			const closed = Boolean(options.closed) && drawing.points.length > 2;
			if (drawing.roadId) {
				const roadId = drawing.roadId;
				get().updateRoad(roadId, (road) => {
					road.points = drawing.points;
					road.closed = closed;
				});
				set({ ...NOTHING_SELECTED, selectedRoadId: roadId, tab: "object" });
				return roadId;
			}
			const count = scene.roads.filter((r) => r.style === drawing.style).length;
			return get().addRoad({
				name: `${ROAD_STYLE_LABELS[drawing.style]} ${count + 1}`,
				style: drawing.style,
				points: drawing.points,
				width: ROAD_STYLE_WIDTH[drawing.style],
				closed,
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

export const selectSelectedArea = (state: IEditorState) =>
	state.scene.areas.find((a) => a.id === state.selectedAreaId) ?? null;
