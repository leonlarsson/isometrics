import { type Draft, produce } from "immer";
import { nanoid } from "nanoid";
import { create } from "zustand";

import { FENCE_STYLE_LABELS } from "#/fences/registry";
import { APP_NAME } from "#/lib/app";
import { normalizeDegrees, round, snap } from "#/lib/math";
import { getPart } from "#/parts/registry";
import {
	AREA_TYPE_LABELS,
	AREA_TYPES,
	areaTopAt,
	cornerLift,
	cornerWithLift,
	elevationMovedTo,
	groundHeightAt,
	isInsidePolygon,
	liftForTop,
	middleOf,
	takesCornerHeights,
} from "#/scene/areas";
import { bindingMapsOf, fenceBindingMapsOf } from "#/scene/dataBindings";
import { fenceLength } from "#/scene/fences";
import { moodOf, putOnMood, wearsMood } from "#/scene/moods";
import { copyName, copyNamer } from "#/scene/naming";
import {
	applySettingChange,
	isUnsetSetting,
	type TEntityColorChange,
	type TEntityLightChange,
} from "#/scene/objectSettings";
import {
	joinedPoints,
	pointWidth,
	ROAD_STYLE_LABELS,
	ROAD_STYLE_WIDTH,
	type TRoadEnd,
} from "#/scene/roads";
import {
	AreaSchema,
	CameraSettingsSchema,
	EntityColorSchema,
	EntityLightSchema,
	EntitySchema,
	FenceSchema,
	FollowSchema,
	RoadSchema,
	type TArea,
	type TAreaInput,
	type TAreaType,
	type TDataBinding,
	type TDataEntry,
	type TEntity,
	type TEntityInput,
	type TFence,
	type TFenceInput,
	type TFencePoint,
	type TFenceStyle,
	type TProjection,
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

import { restartDayCycle } from "./dayClock";
import { boundsOfAll, type IFrameBox, type ISceneItem } from "./framing";
import {
	DEFAULT_BRUSH,
	eraseStamp,
	type IPaintBrush,
	PAINT_DENSITY,
	PAINT_SIZE,
	paintStamp,
} from "./paint";
import { readPreferences } from "./preferences";
import { notify } from "./toasts";

export type TEditorMode = "edit" | "view";

/** The properties editor's tabs about the whole world (ADR-0054). */
export type TWorldTab =
	| "world"
	| "moods"
	| "light"
	| "sky"
	| "weather"
	| "camera"
	| "views"
	| "traffic"
	| "data";
/** Its tabs about the selection. Which of them show depends on what's selected. */
export type TSelectionTab = "object" | "shape" | "look" | "lights" | "label" | "motion";
/**
 * Properties tabs. "add" (the Add to scene panel) and "outliner" only exist in the narrow
 * layout; the wide layout has them in the left column and above the properties.
 */
export type TInspectorTab = "add" | "outliner" | TWorldTab | TSelectionTab;

const SELECTION_TABS: readonly TInspectorTab[] = [
	"object",
	"shape",
	"look",
	"lights",
	"label",
	"motion",
];

/** Selecting something shows its settings: the selection tab you were on, else Object. */
const tabForSelection = (tab: TInspectorTab): TInspectorTab =>
	SELECTION_TABS.includes(tab) ? tab : "object";

/** Selecting a road point or an area corner shows it, in the Shape tab. */
const pointTab = (tab: TInspectorTab, index: number | null): TInspectorTab =>
	index === null ? tabForSelection(tab) : "shape";

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

/** A fence point at a spot, `lift` above the ground there (ADR-0103). */
const fencePoint = (x: number, z: number, lift = 0): TFencePoint => [
	round(x),
	round(z),
	round(Math.min(50, Math.max(0, lift))),
];

/** Grid step for dragging and nudging, in ground units. */
export const SNAP_STEP = 0.5;
/** Alt+arrow nudges by this much instead of a grid step, for lining things up by eye. */
export const FINE_NUDGE_STEP = 0.1;

/** A ground point as things placed there land: on the grid while snapping is on. */
export const spotOnGrid = ([x, z]: TVec2, snapping: boolean): TVec2 =>
	snapping ? [snap(x, SNAP_STEP), snap(z, SNAP_STEP)] : [round(x, 2), round(z, 2)];

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

/** A road, area or fence being drawn point by point. Runtime UI state; never saved in the scene. */
export interface IRoadDrawing {
	/** What the points will become. */
	target: "road" | "area" | "fence";
	/** Road style (roads only). */
	style: TRoadStyle;
	/** Area type (areas only). */
	areaType: TAreaType;
	/** Fence style (fences only). */
	fenceStyle?: TFenceStyle;
	points: TRoadPoint[];
	/** When continuing an existing road: its id. Finishing replaces that road's points. */
	roadId?: string;
	/** When continuing an existing fence: its id. Finishing replaces that fence's points. */
	fenceId?: string;
	/**
	 * Continuing a fence from its start: the points are drawn reversed, and turned back when
	 * finished, so its first point stays first (how much is built counts from it).
	 */
	reversed?: boolean;
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
	/** The undo step's key, when the transform finishes something already begun (Shift+D's copy). */
	token?: string;
	/**
	 * What cancelling goes back to, when it should undo more than the move: the world and
	 * selection before Shift+D copied it (ADR-0067).
	 */
	undo?: { scene: TScene; items: ISceneItem[] };
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

	/** The active item (ADR-0064): the one whose settings the properties show. At most one is set. */
	selectedId: string | null;
	selectedRoadId: string | null;
	selectedAreaId: string | null;
	selectedFenceId: string | null;
	/**
	 * Everything selected, the active item last (ADR-0064). Setting the active item without it
	 * selects just that item.
	 */
	selectedItems: ISceneItem[];
	/**
	 * B or Shift+B was pressed (or the toolbar's Select box): the next drag on the view draws a box
	 * that adds what's inside to the selection, or takes it out. Runtime UI state.
	 */
	boxSelect: "add" | "remove" | null;
	/**
	 * The box being drawn: where on screen (client px, for ui/BoxSelectBar), and what letting go
	 * now would add to the selection or take out of it (outlined dashed in the world as a preview).
	 */
	boxDrag: {
		rect: { left: number; top: number; width: number; height: number };
		items: ISceneItem[];
		/** Boxing points of the selected road or corners of the selected area instead (ADR-0065). */
		points: number[];
		removing: boolean;
	} | null;
	/** Selected control point of the selected road or area. */
	selectedPointIndex: number | null;
	/**
	 * Every selected point of the selected road, or corner of the selected area (ADR-0065), the
	 * active one (`selectedPointIndex`) last. Setting the active point without it selects just that.
	 */
	selectedPointIndices: number[];
	/** The selected peak of the selected area (ADR-0101): its index in `peaks`, or null. */
	selectedPeakIndex: number | null;
	drawing: IRoadDrawing | null;
	/** The paint bar is open: a drag on the view paints (or erases) objects (ADR-0091). */
	painting: boolean;
	/** The brush's settings, remembered per browser. */
	paintBrush: IPaintBrush;
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
	/**
	 * A world being opened (at start, or loaded): which opening, until the view
	 * has it ready to look at (render/WorldReady), and the loading screen covers
	 * it till then; null once it's shown. Runtime only.
	 */
	openingWorld: number | null;
	snapping: boolean;
	playing: boolean;
	/** How the camera shows the world: orthographic (the isometric diorama) or perspective. Runtime UI state. */
	projection: TProjection;
	/** Show the world's tilt-shift in Edit mode too, while setting it up (it's View mode's). */
	previewTiltShift: boolean;
	/**
	 * The right mouse button is held on the view: W A S D and Q E move the camera in any mode, as
	 * in a game, and the keys that edit stand aside. Runtime UI state.
	 */
	holdingRightButton: boolean;
	/** The Preferences dialog is open (ui/PreferencesDialog). Runtime UI state. */
	preferencesOpen: boolean;
	/** The page Preferences was opened for, if any (e.g. "graphics" from the toolbar). */
	preferencesPage: string | null;
	/** Incremented to ask the viewport to re-frame the camera. */
	viewNonce: number;
	/** What the next re-frame shows: a box (frame selection), or null for the whole ground. */
	frameBox: IFrameBox | null;
	/** The item under the pointer in a list (outliner, Scene tab), highlighted in the world. */
	hovered: ISceneItem | null;
	/** The item whose context menu is open, and where (screen px). Runtime UI state. */
	/** An item's right-click menu: where it opened, and the ground point clicked, for an area's "Add a peak here". */
	contextMenu: { item: ISceneItem; x: number; y: number; point?: TVec2 } | null;
	/** The ground's context menu: the ground point that was right-clicked, and where (screen px). */
	groundMenu: { point: TVec2; x: number; y: number } | null;
	/** A viewpoint's menu, opened on its camera in the world: which one, and where (screen px). */
	viewpointMenu: { id: string; x: number; y: number } | null;
	/**
	 * Where the camera is gliding to (a viewpoint), picked up by render/CameraFlight. An instant
	 * one jumps there (opening a world where its camera was).
	 */
	flight: { pose: TViewPose; nonce: number; instant: boolean } | null;
	/**
	 * A still picture being rendered (ADR-0084, render/StillRender): its size in pixels, and how
	 * many times as many pixels a side it's drawn with before it's shrunk to that (smoothing).
	 * While there is one, the view draws as in View mode with the render's graphics. Runtime only.
	 */
	stillRender: {
		width: number;
		height: number;
		smoothing: number;
		nonce: number;
		/** The canvas's pixel ratio for it, once the render has set the canvas's shape. */
		pixelRatio: number | null;
		/** Without the backdrop or, in perspective, the sky. */
		transparent: boolean;
		/** With the data cards and their leaders (shown for it even where the world hides them). */
		showsCards: boolean;
	} | null;
	/** Render a picture… is open. */
	renderDialogOpen: boolean;
	/** The viewpoint last gone to (the one View mode's ◀ ▶ steps from). Runtime UI state. */
	activeViewpointId: string | null;
	/**
	 * The camera follows a vehicle (render/CameraFollow): keeping its angle, or riding along
	 * behind it in perspective. Runtime UI state.
	 */
	cameraFollow: { entityId: string; ride: boolean; projectionBefore: TProjection } | null;

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
	selectFence: (id: string | null) => void;
	/** Select a point of a fence (also selects the fence), or clear the point selection. */
	selectFencePoint: (fenceId: string, index: number | null) => void;
	/**
	 * Shift/Ctrl-click a point of the selected road or a corner of the selected area: add it to the
	 * selected points (it becomes the active one), or take it out (ADR-0065).
	 */
	togglePoint: (index: number) => void;
	/** Select exactly these points of the selected road or area; the last is the active one. */
	selectPoints: (indices: number[]) => void;
	/**
	 * Delete the selected points or corners (one undo step), unless that would leave a road fewer
	 * than two points or an area fewer than three corners.
	 */
	removeSelectedPoints: () => void;
	/** Deselect any entity, road or point. */
	clearSelection: () => void;
	/** Shift/Ctrl-click: add an item to the selection (it becomes the active one), or take it out. */
	toggleSelected: (item: ISceneItem) => void;
	/** Select exactly these items; the last is the active one. */
	selectItems: (items: ISceneItem[]) => void;
	setBoxSelect: (mode: "add" | "remove" | null) => void;
	/** Open or close the paint bar (ADR-0091). */
	setPainting: (on: boolean) => void;
	setPaintBrush: (change: Partial<IPaintBrush>) => void;
	/**
	 * One stamp of the brush at a ground point, in a stroke (a unique key): what it paints is added,
	 * or what it erases taken away, and a whole stroke is one undo step. Closing the paint bar
	 * selects what was painted while it was open, so it moves or deletes as one.
	 */
	paintAt: (center: TVec2, stroke: string, mode: IPaintBrush["mode"]) => void;

	setBoxDrag: (drag: IEditorState["boxDrag"]) => void;
	/** Delete everything selected (one undo step). */
	removeSelected: () => void;
	/**
	 * Copy everything selected, a step over (`step` grid units, 0: in place), and select the copies,
	 * as one undo step (with `coalesce`, the one a move that follows shares, ADR-0067). Copied
	 * vehicles drive along the copied road when their road is copied too. `leaveBehind` keeps the
	 * selection on the originals instead (about to be moved) and leaves the copies where they were,
	 * under the originals' names, so the one that moves is the one called "… copy": for a single
	 * object's gizmo, which belongs to the object being dragged.
	 */
	duplicateSelected: (options?: {
		step?: number;
		coalesce?: string;
		leaveBehind?: boolean;
	}) => void;
	/** Shift+D: copy the selection in place and pick the copies up to move, as G does (ADR-0067). */
	duplicateAndGrab: () => void;
	/** Hide or lock everything selected, or show or unlock it (one undo step). */
	setSelectedFlag: (flag: "hidden" | "locked", value: boolean) => void;
	setMode: (mode: TEditorMode) => void;
	setTab: (tab: TInspectorTab) => void;
	setDragging: (dragging: boolean) => void;
	/** The view has this opening of a world ready to look at: the loading screen goes. */
	worldShown: (opening: number) => void;
	startPlacing: (kind: string) => void;
	stopPlacing: () => void;
	startTransform: (
		mode: TTransformMode,
		session?: Pick<ITransformSession, "token" | "undo">,
	) => void;
	updateTransform: (patch: Partial<ITransformSession>) => void;
	/** End a keyboard transform, keeping what it did (cancelling goes through cancelGesture). */
	endTransform: () => void;
	setViewInset: (pixels: number) => void;
	toggleSnapping: () => void;
	togglePlaying: () => void;
	setProjection: (projection: TProjection) => void;
	/** P: between the isometric diorama and perspective. */
	toggleProjection: () => void;
	setPreviewTiltShift: (preview: boolean) => void;
	/** Opens or closes Preferences, opening on `page` if given. */
	setPreferencesOpen: (open: boolean, page?: string) => void;
	setRenderDialogOpen: (open: boolean) => void;
	setHoldingRightButton: (holding: boolean) => void;
	/**
	 * The whole world from the default angle in the diorama view, with the world's camera settings
	 * back to their defaults (one undo step), except the turntable's, tilt-shift's and whether it
	 * keeps the isometric angle.
	 */
	resetCamera: () => void;
	/** Back to the world's opening view: its opening viewpoint, else the whole world from the default angle, in its opening projection. */
	resetView: () => void;
	/**
	 * Show a world that was just opened: where its camera was in this browser (`remembered`), else
	 * at its opening view. No glide.
	 */
	showOpeningView: (remembered: TViewPose | null) => void;
	/** Move the camera to the selection: every selected object, road and area. */
	frameSelection: () => void;
	setHovered: (item: ISceneItem | null) => void;
	/** Select an item and open its context menu at a screen point, or close the menu (null). */
	openContextMenu: (item: ISceneItem | null, at?: { x: number; y: number }, point?: TVec2) => void;
	/** Open the ground's context menu for a ground point at a screen point (deselecting), or close it (null). */
	openGroundMenu: (point: TVec2 | null, at?: { x: number; y: number }) => void;
	/** Open a viewpoint's menu at a screen point, or close it (null). */
	openViewpointMenu: (id: string | null, at?: { x: number; y: number }) => void;
	/** Move the camera to a ground point, framing a few cells around it. */
	framePoint: (point: TVec2) => void;
	/** Give an object, road or area a new name (empty: it's called by its kind again). */
	renameItem: (item: ISceneItem, name: string) => void;
	/** Set an item's `hidden` or `locked` flag (one undo step). */
	setItemFlag: (item: ISceneItem, flag: "hidden" | "locked", value: boolean) => void;
	/** Hide the selection, or show it again if the active item is hidden (H). It stays selected. */
	toggleSelectedHidden: () => void;
	/** Show every hidden item again (Alt+H). */
	revealAll: () => void;

	/** Follow a vehicle with the camera, or ride along behind it (perspective). */
	followWithCamera: (entityId: string, ride: boolean) => void;
	/** Stop following; a ride-along goes back to the camera type it started from. */
	stopFollowing: () => void;
	/** Glide the camera to a saved viewpoint (switching camera type if it needs to). */
	/** Go to a viewpoint (and put on its mood, if the viewer lets it); `instant` jumps there. */
	goToViewpoint: (id: string, options?: { instant?: boolean }) => void;
	/** Select a viewpoint (its camera in the world was clicked): its settings, in the Viewpoints tab. */
	selectViewpoint: (id: string) => void;
	/** Asks the camera (render/CameraFlight) to glide to the nearest true isometric angle. */
	isometricNonce: number;
	lookIsometric: () => void;
	/** Glide the camera to a view (the navigation gizmo's turns). */
	glideTo: (pose: TViewPose) => void;
	/** Save a view as a new viewpoint at the end of the list. Returns its id. */
	addViewpoint: (pose: TViewPose) => string;
	updateViewpoint: (
		id: string,
		recipe: (viewpoint: Draft<TViewpoint>) => void,
		options?: ICommitOptions,
	) => void;
	removeViewpoint: (id: string) => void;
	/** The viewpoint the world opens at (and re-centring goes back to), or null for the whole world. */
	setOpeningViewpoint: (id: string | null) => void;
	/** Saves the world's look now as a new mood (ADR-0078) and returns its id. */
	saveMood: () => string;
	/** Puts a mood on the world: its time of day, light, sky, water and tilt-shift. */
	putOnMood: (id: string) => void;
	/** Saves the world's look now over a mood. */
	resaveMood: (id: string) => void;
	renameMood: (id: string, name: string) => void;
	/** Deletes a mood; viewpoints that had it leave the look as it is. */
	removeMood: (id: string) => void;
	/** Move a viewpoint to another place in the list (`to` = its new index). */
	moveViewpoint: (id: string, to: number) => void;

	addEntity: (input: Omit<TEntityInput, "id"> & { id?: string }) => string;
	updateEntity: (
		id: string,
		recipe: (entity: Draft<TEntity>) => void,
		options?: ICommitOptions,
	) => void;
	/**
	 * Set one of an object's part props. Every other stored prop stays as it is,
	 * including ones this version doesn't know (from a newer version, or renamed),
	 * so editing never drops them (ADR-0056).
	 */
	setEntityProp: (id: string, key: string, value: unknown, options?: ICommitOptions) => void;
	/**
	 * Change an object's settings for one of its lights (ADR-0058); a setting
	 * set to null goes back to the part's. A world from before per-light
	 * settings had one mode for all its lights: it becomes each light's first.
	 */
	setEntityLight: (
		id: string,
		lightId: string,
		change: TEntityLightChange,
		options?: ICommitOptions,
	) => void;
	/**
	 * Change an object's setting for one of its part's colours (ADR-0060); null
	 * goes back to the part's. What an older world kept in `color` or `accent`
	 * for it is cleared, so Reset really goes back to the part's.
	 */
	setEntityColor: (
		id: string,
		colorId: string,
		change: TEntityColorChange,
		options?: ICommitOptions,
	) => void;
	/**
	 * Move an object across the ground. Placing it freely (dragging it, the
	 * gizmo's square, G with no axis) passes `followGround`: it keeps its height
	 * above the ground, climbing onto raised land; exact moves keep its height
	 * (ADR-0098).
	 */
	moveEntity: (
		id: string,
		position: TVec2,
		options?: ICommitOptions,
		how?: { followGround?: boolean },
	) => void;
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
	/** Select one of an area's peaks (ADR-0101). */
	selectAreaPeak: (areaId: string, index: number) => void;
	/**
	 * Add a peak to an area, flush with its top there, and select it: at a
	 * point inside it (a right-click, a double-click), else in its middle.
	 */
	addAreaPeak: (areaId: string, at?: TVec2) => void;
	/** Move a peak across the ground, keeping its height. */
	moveAreaPeak: (areaId: string, index: number, point: TVec2, options?: ICommitOptions) => void;
	/** Put a peak's top at this height, as a lift above the area's height. */
	setAreaPeakHeight: (areaId: string, index: number, top: number, options?: ICommitOptions) => void;
	removeAreaPeak: (areaId: string, index: number) => void;
	/** Put an area corner's top at this height (ADR-0096), as a lift above the area's height. */
	setAreaCornerHeight: (id: string, index: number, top: number, options?: ICommitOptions) => void;

	addFence: (input: Omit<TFenceInput, "id"> & { id?: string }) => string;
	updateFence: (
		id: string,
		recipe: (fence: Draft<TFence>) => void,
		options?: ICommitOptions,
	) => void;
	removeFence: (id: string) => void;
	/** Move a fence point across the ground, keeping its lift. */
	moveFencePoint: (id: string, index: number, point: TVec2, options?: ICommitOptions) => void;
	/** Lift a fence point above the ground there (0: standing on it). */
	setFencePointLift: (id: string, index: number, lift: number, options?: ICommitOptions) => void;
	/** Insert a fence point before `index`. */
	insertFencePoint: (
		id: string,
		index: number,
		point: TFencePoint,
		options?: ICommitOptions,
	) => void;
	/** Remove a fence point (a fence keeps at least two). */
	removeFencePoint: (id: string, index: number) => void;
	/**
	 * Cut a fence at a point. An open fence becomes two that share that point
	 * (returns the new fence's id); a loop opens there (returns its own id).
	 */
	splitFence: (id: string, index: number) => string | null;

	startDrawing: (style: TRoadStyle) => void;
	startAreaDrawing: (type: TAreaType) => void;
	startFenceDrawing: (style: TFenceStyle) => void;
	/** Continue drawing from one end of an existing open fence. */
	continueFenceDrawing: (fenceId: string, end: TRoadEnd) => void;
	/** Continue drawing from one end of an existing open road. */
	continueDrawing: (roadId: string, end: TRoadEnd) => void;
	addDrawingPoint: (point: TVec2) => void;
	undoDrawingPoint: () => void;
	/** Create the road or fence (2+ points) or area (3+ points) from the drawn points. Returns its id. */
	finishDrawing: (options?: { loops?: boolean }) => string | null;
	cancelDrawing: () => void;
}

export const newId = (prefix: string) => `${prefix}_${nanoid(8)}`;

/** What was painted since the paint bar opened, to select when it closes (ADR-0091). */
const paintedThisTime = new Set<string>();

const PAINT_BRUSH_KEY = `${APP_NAME.toLowerCase()}:paint-brush`;

/** The brush as last used in this browser, each setting checked; the default for anything off. */
const readPaintBrush = (): IPaintBrush => {
	try {
		const stored = JSON.parse(
			localStorage.getItem(PAINT_BRUSH_KEY) ?? "{}",
		) as Partial<IPaintBrush>;
		const within = (
			value: unknown,
			{ min, max }: { min: number; max: number },
			fallback: number,
		) => (typeof value === "number" && value >= min && value <= max ? value : fallback);
		return {
			brushId: typeof stored.brushId === "string" ? stored.brushId : DEFAULT_BRUSH.brushId,
			mode: stored.mode === "erase" ? "erase" : "paint",
			size: within(stored.size, PAINT_SIZE, DEFAULT_BRUSH.size),
			density: within(stored.density, PAINT_DENSITY, DEFAULT_BRUSH.density),
		};
	} catch {
		return DEFAULT_BRUSH;
	}
};

const savePaintBrush = (brush: IPaintBrush) => {
	try {
		localStorage.setItem(PAINT_BRUSH_KEY, JSON.stringify(brush));
	} catch {
		// Storage unavailable: it's remembered until the page closes.
	}
};

/** Keep road/area/point selection only if it still exists in `scene` (after undo/redo). */
const validRoadSelection = (
	scene: TScene,
	state: Pick<
		IEditorState,
		| "selectedRoadId"
		| "selectedAreaId"
		| "selectedFenceId"
		| "selectedPointIndex"
		| "selectedPointIndices"
		| "selectedPeakIndex"
	>,
) => {
	const road = scene.roads.find((r) => r.id === state.selectedRoadId);
	const area = scene.areas.find((a) => a.id === state.selectedAreaId);
	const fence = scene.fences.find((f) => f.id === state.selectedFenceId);
	const points = road?.points ?? area?.points ?? fence?.points;
	return {
		selectedRoadId: road ? road.id : null,
		selectedAreaId: area ? area.id : null,
		selectedFenceId: fence ? fence.id : null,
		selectedPointIndex:
			points && state.selectedPointIndex !== null && state.selectedPointIndex < points.length
				? state.selectedPointIndex
				: null,
		selectedPointIndices:
			points && state.selectedPointIndex !== null && state.selectedPointIndex < points.length
				? state.selectedPointIndices.filter((index) => index < points.length)
				: [],
		selectedPeakIndex:
			area && state.selectedPeakIndex !== null && state.selectedPeakIndex < area.peaks.length
				? state.selectedPeakIndex
				: null,
	};
};

/**
 * Part kinds in a world that no part has: objects from an older version
 * whose part was removed (renamed ones are upgraded on load, ADR-0053), or
 * from a newer one. Most common first.
 */
export const unknownPartKinds = (scene: Pick<TScene, "entities">) => {
	const counts = new Map<string, number>();
	for (const entity of scene.entities) {
		if (!getPart(entity.kind)) {
			counts.set(entity.kind, (counts.get(entity.kind) ?? 0) + 1);
		}
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

/** The last warning about unknown parts and when it was shown, so a world loaded twice warns once. */
let lastPartWarning = { text: "", at: 0 };

/** Say when a world that's opened has objects whose part doesn't exist: they show as placeholders. */
const warnAboutUnknownParts = (scene: TScene) => {
	const unknown = unknownPartKinds(scene);
	if (unknown.length === 0) {
		return;
	}
	// The same world loaded twice in a row (React's double start in development) warns once.
	const text = JSON.stringify(unknown);
	const now = Date.now();
	if (lastPartWarning.text === text && now - lastPartWarning.at < 3000) {
		return;
	}
	lastPartWarning = { text, at: now };
	const objects = unknown.reduce((sum, [, count]) => sum + count, 0);
	const kinds = unknown.map(([kind]) => `“${kind}”`);
	const shown =
		kinds.length > 4
			? `${kinds.slice(0, 4).join(", ")} and ${kinds.length - 4} more`
			: kinds.join(", ");
	notify(
		`${objects} ${objects === 1 ? "object uses a part" : "objects use parts"} this version doesn't have`,
		`${shown}: probably from an older version. They show as pink placeholders and are kept as they are; delete them from the outliner, or add the new parts in their place.`,
		"error",
	);
};

/** The selected object, road, area or fence, if any. */
const selectedItem = (
	state: Pick<IEditorState, "selectedId" | "selectedRoadId" | "selectedAreaId" | "selectedFenceId">,
): ISceneItem | null =>
	state.selectedId
		? { kind: "entity", id: state.selectedId }
		: state.selectedRoadId
			? { kind: "road", id: state.selectedRoadId }
			: state.selectedAreaId
				? { kind: "area", id: state.selectedAreaId }
				: state.selectedFenceId
					? { kind: "fence", id: state.selectedFenceId }
					: null;

/** The viewpoint the world opens at, if it has one (an id no viewpoint has counts as none). */
const openingViewpointOf = (scene: TScene) =>
	scene.viewpoints.find((v) => v.id === scene.camera.openingViewpointId) ?? null;

/** Selection fields cleared together whenever something else gets selected. */
const NOTHING_SELECTED = {
	selectedId: null,
	selectedRoadId: null,
	selectedAreaId: null,
	selectedFenceId: null,
	selectedPointIndex: null,
	selectedPeakIndex: null,
} as const;

/** The scene's objects, roads, areas or fences: the list an item of this kind is in. */
export const listOf = <T extends Pick<TScene, "entities" | "roads" | "areas" | "fences">>(
	scene: T,
	kind: ISceneItem["kind"],
): T["entities"] | T["roads"] | T["areas"] | T["fences"] =>
	kind === "entity"
		? scene.entities
		: kind === "road"
			? scene.roads
			: kind === "area"
				? scene.areas
				: scene.fences;

const sameItem = (a: ISceneItem) => (b: ISceneItem) => a.kind === b.kind && a.id === b.id;

/** The selection fields for one active item (or none), with no point selected. */
const activeFields = (item: ISceneItem | null) => ({
	...NOTHING_SELECTED,
	selectedId: item?.kind === "entity" ? item.id : null,
	selectedRoadId: item?.kind === "road" ? item.id : null,
	selectedAreaId: item?.kind === "area" ? item.id : null,
	selectedFenceId: item?.kind === "fence" ? item.id : null,
});

/** A selection of several items (ADR-0064): the last is the active one. */
const selectionOf = (state: IEditorState, items: ISceneItem[]): Partial<IEditorState> => ({
	...activeFields(items.at(-1) ?? null),
	selectedItems: items,
	tab: state.mode === "edit" && items.length > 0 ? tabForSelection(state.tab) : state.tab,
	followOffer: null,
	joinOffer: null,
});

/**
 * After undo or redo: the selected items that still exist, the active one with its point if it
 * does, else the last one left.
 */
const selectionKeptIn = (scene: TScene, state: IEditorState): Partial<IEditorState> => {
	const items = state.selectedItems.filter((item) =>
		listOf(scene, item.kind).some((thing) => thing.id === item.id),
	);
	const active = selectedItem(state);
	if (active && items.some(sameItem(active))) {
		return {
			selectedId: state.selectedId,
			...validRoadSelection(scene, state),
			selectedItems: items,
		};
	}
	return { ...activeFields(items.at(-1) ?? null), selectedItems: items };
};

/**
 * A state change with `selectedItems` kept in step (ADR-0064): a change that sets the active item
 * without saying what else is selected selects just that item.
 */
const withSelectedItems = (
	state: IEditorState,
	patch: IEditorState | Partial<IEditorState>,
): IEditorState | Partial<IEditorState> => {
	if (patch === state) {
		return patch;
	}
	// The same for points (ADR-0065): setting the active point alone selects just that one.
	const points =
		"selectedPointIndex" in patch && !("selectedPointIndices" in patch)
			? {
					...patch,
					selectedPointIndices:
						patch.selectedPointIndex === null || patch.selectedPointIndex === undefined
							? []
							: [patch.selectedPointIndex],
				}
			: patch;
	if ("selectedItems" in points) {
		return points;
	}
	if (
		!(
			"selectedId" in points ||
			"selectedRoadId" in points ||
			"selectedAreaId" in points ||
			"selectedFenceId" in points
		)
	) {
		return points;
	}
	const active = selectedItem({ ...state, ...points });
	return { ...points, selectedItems: active ? [active] : [] };
};

/** Give an object a new name; a label card titled with its old name follows (ADR-0068). */
export const renameEntity = (entity: Pick<TEntity, "name" | "label">, name: string) => {
	if (entity.label && entity.label.title === entity.name) {
		entity.label.title = name;
	}
	entity.name = name;
};

/** A map of settings that follow data values: the ones following `from` follow `to`, or stop. */
const renameBindings = (
	bindings: Record<string, TDataBinding>,
	from: string,
	to: string | null,
) => {
	for (const [setting, binding] of Object.entries(bindings)) {
		if (binding.key !== from) {
			continue;
		}
		if (to) {
			binding.key = to;
		} else {
			delete bindings[setting];
		}
	}
};

/** Replace every reference to a data key (labels, detail tiles and parts' data key fields). */
const renameDataReferences = (scene: Draft<TScene>, from: string, to: string | null) => {
	const swap = (keys: string[]) => keys.flatMap((key) => (key === from ? (to ? [to] : []) : [key]));
	// The weather's settings that follow data (ADR-0102), its moods' too.
	renameBindings(scene.weather.data, from, to);
	for (const mood of scene.moods) {
		renameBindings(mood.weather.data, from, to);
	}
	// Fences' colours and how much of them is built (ADR-0103).
	for (const fence of scene.fences) {
		for (const bindings of fenceBindingMapsOf(fence)) {
			renameBindings(bindings, from, to);
		}
		for (const [id, color] of Object.entries(fence.colors)) {
			if (isUnsetSetting(color)) {
				delete fence.colors[id];
			}
		}
	}
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
		// Settings that follow the value (lights, colours): renamed with it, or no longer following data.
		for (const bindings of bindingMapsOf(entity)) {
			renameBindings(bindings, from, to);
		}
		// Nothing left that differs from the part: no entry at all.
		if (typeof entity.lights === "object") {
			for (const [id, light] of Object.entries(entity.lights)) {
				if (isUnsetSetting(light)) {
					delete entity.lights[id];
				}
			}
		}
		for (const [id, color] of Object.entries(entity.colors)) {
			if (isUnsetSetting(color)) {
				delete entity.colors[id];
			}
		}
	}
};

export const createEditorStore = (initialScene: TScene = createBrightwaterScene()) => {
	return create<IEditorState>()((rawSet, get) => {
		// Every change goes through here, so the list of selected items follows the active item.
		const set = (
			partial:
				| IEditorState
				| Partial<IEditorState>
				| ((state: IEditorState) => IEditorState | Partial<IEditorState>),
		) =>
			rawSet((state) =>
				withSelectedItems(state, typeof partial === "function" ? partial(state) : partial),
			);
		return {
			scene: initialScene,
			past: [],
			future: [],
			lastCommit: null,

			...NOTHING_SELECTED,
			selectedPointIndices: [],
			selectedPeakIndex: null,
			selectedItems: [],
			boxSelect: null,
			boxDrag: null,
			drawing: null,
			painting: false,
			paintBrush: readPaintBrush(),
			placingKind: null,
			transform: null,
			viewInset: 0,
			joinOffer: null,
			routePreview: null,
			rerouting: false,
			followOffer: null,
			mode: "edit",
			tab: "world",
			dragging: false,
			openingWorld: 1,
			snapping: true,
			playing: true,
			projection: "orthographic",
			previewTiltShift: false,
			preferencesOpen: false,
			renderDialogOpen: false,
			stillRender: null,
			preferencesPage: null,
			holdingRightButton: false,
			viewNonce: 0,
			frameBox: null,
			hovered: null,
			contextMenu: null,
			groundMenu: null,
			viewpointMenu: null,
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

			loadScene: (scene) => {
				warnAboutUnknownParts(scene);
				set((state) => ({
					// The loading screen covers it until the view has it ready (ADR-0100).
					openingWorld: (state.openingWorld ?? 0) + 1,
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
				}));
			},

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
						...selectionKeptIn(previous, state),
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
						...selectionKeptIn(next, state),
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
								tab: state.mode === "edit" ? tabForSelection(state.tab) : state.tab,
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
								tab: state.mode === "edit" ? tabForSelection(state.tab) : state.tab,
							}
						: { selectedRoadId: null, selectedPointIndex: null },
				),
			selectRoadPoint: (roadId, index) =>
				set((state) => ({
					...NOTHING_SELECTED,
					selectedRoadId: roadId,
					selectedPointIndex: index,
					tab: state.mode === "edit" ? pointTab(state.tab, index) : state.tab,
				})),
			selectArea: (id) =>
				set((state) =>
					id
						? {
								...NOTHING_SELECTED,
								selectedAreaId: id,
								selectedPointIndex: id === state.selectedAreaId ? state.selectedPointIndex : null,
								selectedPeakIndex: id === state.selectedAreaId ? state.selectedPeakIndex : null,
								tab: state.mode === "edit" ? tabForSelection(state.tab) : state.tab,
							}
						: { selectedAreaId: null, selectedPointIndex: null, selectedPeakIndex: null },
				),
			selectAreaPoint: (areaId, index) =>
				set((state) => ({
					...NOTHING_SELECTED,
					selectedAreaId: areaId,
					selectedPointIndex: index,
					tab: state.mode === "edit" ? pointTab(state.tab, index) : state.tab,
				})),
			selectFence: (id) =>
				set((state) =>
					id
						? {
								...NOTHING_SELECTED,
								selectedFenceId: id,
								selectedPointIndex: id === state.selectedFenceId ? state.selectedPointIndex : null,
								tab: state.mode === "edit" ? tabForSelection(state.tab) : state.tab,
							}
						: { selectedFenceId: null, selectedPointIndex: null },
				),
			selectFencePoint: (fenceId, index) =>
				set((state) => ({
					...NOTHING_SELECTED,
					selectedFenceId: fenceId,
					selectedPointIndex: index,
					tab: state.mode === "edit" ? pointTab(state.tab, index) : state.tab,
				})),
			togglePoint: (index) =>
				set((state) => {
					const has = state.selectedPointIndices.includes(index);
					const indices = has
						? state.selectedPointIndices.filter((other) => other !== index)
						: [...state.selectedPointIndices, index];
					return {
						selectedPointIndex: indices.at(-1) ?? null,
						selectedPointIndices: indices,
						selectedPeakIndex: null,
						tab: state.mode === "edit" && indices.length > 0 ? "shape" : state.tab,
					};
				}),
			selectPoints: (indices) =>
				set((state) => {
					const unique = indices.filter((index, at) => indices.indexOf(index) === at);
					return {
						selectedPointIndex: unique.at(-1) ?? null,
						selectedPointIndices: unique,
						selectedPeakIndex: null,
						tab: state.mode === "edit" && unique.length > 0 ? "shape" : state.tab,
					};
				}),
			removeSelectedPoints: () => {
				const { selectedRoadId, selectedAreaId, selectedFenceId, selectedPointIndices, scene } =
					get();
				const road = scene.roads.find((r) => r.id === selectedRoadId);
				const area = scene.areas.find((a) => a.id === selectedAreaId);
				const fence = scene.fences.find((f) => f.id === selectedFenceId);
				const points = road?.points ?? area?.points ?? fence?.points;
				const fewest = area ? 3 : 2;
				if (!points || selectedPointIndices.length === 0) {
					return;
				}
				if (points.length - selectedPointIndices.length < fewest) {
					notify(
						road
							? "A road needs at least two points"
							: fence
								? "A fence needs at least two points"
								: "An area needs at least three corners",
						"Select fewer to delete, or delete the whole thing.",
					);
					return;
				}
				const doomed = new Set(selectedPointIndices);
				get().commit((draft) => {
					const shape = road
						? draft.roads.find((r) => r.id === road.id)
						: fence
							? draft.fences.find((f) => f.id === fence.id)
							: draft.areas.find((a) => a.id === area?.id);
					if (shape) {
						shape.points = shape.points.filter(
							(_, index) => !doomed.has(index),
						) as typeof shape.points;
					}
				});
				set({ selectedPointIndex: null });
			},
			clearSelection: () =>
				set({ ...NOTHING_SELECTED, joinOffer: null, followOffer: null, boxSelect: null }),
			toggleSelected: (item) =>
				set((state) =>
					selectionOf(
						state,
						state.selectedItems.some(sameItem(item))
							? state.selectedItems.filter((other) => !sameItem(item)(other))
							: [...state.selectedItems, item],
					),
				),
			selectItems: (items) =>
				set((state) =>
					selectionOf(
						state,
						items.filter((item, index) => items.findIndex(sameItem(item)) === index),
					),
				),
			setBoxSelect: (mode) =>
				set(
					mode
						? { boxSelect: mode, boxDrag: null, painting: false }
						: { boxSelect: null, boxDrag: null },
				),
			setPainting: (on) => {
				if (on) {
					paintedThisTime.clear();
					set({
						painting: true,
						boxSelect: null,
						drawing: null,
						placingKind: null,
						followOffer: null,
					});
					return;
				}
				set({ painting: false });
				// What was painted (and is still there) is selected, to move or delete as one.
				const present = new Set(get().scene.entities.map((entity) => entity.id));
				const painted = [...paintedThisTime].filter((id) => present.has(id));
				paintedThisTime.clear();
				if (painted.length > 0) {
					get().selectItems(painted.map((id) => ({ kind: "entity" as const, id })));
				}
			},
			setPaintBrush: (change) => {
				const next = { ...get().paintBrush, ...change };
				set({ paintBrush: next });
				savePaintBrush(next);
			},
			paintAt: (center, stroke, mode) => {
				const { scene, paintBrush } = get();
				const options = { coalesce: `paint:${stroke}`, gesture: true };
				if (mode === "erase") {
					const ids = new Set(eraseStamp(scene, paintBrush, center));
					if (ids.size > 0) {
						get().commit((draft) => {
							draft.entities = draft.entities.filter((entity) => !ids.has(entity.id));
						}, options);
					}
					return;
				}
				const added = paintStamp(scene, paintBrush, center).map((input) =>
					EntitySchema.parse({ ...input, id: newId(input.kind) }),
				);
				if (added.length === 0) {
					return;
				}
				get().commit((draft) => {
					draft.entities.push(...added);
				}, options);
				for (const entity of added) {
					paintedThisTime.add(entity.id);
				}
			},
			setBoxDrag: (drag) => set({ boxDrag: drag }),
			removeSelected: () => {
				const items = get().selectedItems;
				const ids = (kind: ISceneItem["kind"]) =>
					new Set(items.filter((item) => item.kind === kind).map((item) => item.id));
				const [entities, roads, areas, fences] = [
					ids("entity"),
					ids("road"),
					ids("area"),
					ids("fence"),
				];
				get().commit((scene) => {
					scene.entities = scene.entities.filter((e) => !entities.has(e.id));
					scene.roads = scene.roads.filter((r) => !roads.has(r.id));
					scene.areas = scene.areas.filter((a) => !areas.has(a.id));
					scene.fences = scene.fences.filter((f) => !fences.has(f.id));
					// Vehicles that drove along a deleted road are parked where the road was.
					for (const entity of scene.entities) {
						if (entity.follow && roads.has(entity.follow.roadId)) {
							entity.follow = null;
						}
					}
				});
				set({ ...NOTHING_SELECTED, joinOffer: null, followOffer: null });
			},
			duplicateSelected: ({ step = 1, coalesce, leaveBehind = false } = {}) => {
				const { scene: current, selectedItems } = get();
				const picked = <T extends { id: string }>(list: T[], kind: ISceneItem["kind"]) =>
					list.filter((thing) => selectedItems.some(sameItem({ kind, id: thing.id })));
				// Copies are named as the preference says: "Tower copy", or "Tower 2" (scene/naming). Left
				// behind, the copies keep the names and the originals, which move, take the new ones.
				const style = readPreferences().namesOfCopies;
				const namers = {
					entity: copyNamer(
						current.entities.map((e) => e.name),
						style,
					),
					road: copyNamer(
						current.roads.map((r) => r.name),
						style,
					),
					area: copyNamer(
						current.areas.map((a) => a.name),
						style,
					),
					fence: copyNamer(
						current.fences.map((f) => f.name),
						style,
					),
				};
				const copyName = (kind: ISceneItem["kind"], name: string) =>
					leaveBehind ? name : namers[kind](name);
				const roadIds = new Map<string, string>();
				const roads = picked(current.roads, "road").map((source): TRoad => {
					const copy = structuredClone(source);
					copy.id = newId("road");
					copy.name = copyName("road", source.name);
					copy.points = source.points.map((point) =>
						withPoint(point, { x: point[0] + step, z: point[1] + step }),
					);
					roadIds.set(source.id, copy.id);
					return copy;
				});
				const areas = picked(current.areas, "area").map((source): TArea => {
					const copy = structuredClone(source);
					copy.id = newId("area");
					copy.name = copyName("area", source.name);
					// Its corners keep their own heights (ADR-0096).
					copy.points = source.points.map((point) =>
						cornerWithLift(point[0] + step, point[1] + step, cornerLift(point)),
					);
					copy.peaks = source.peaks.map(([x, z, lift]) => [round(x + step), round(z + step), lift]);
					return copy;
				});
				const fences = picked(current.fences, "fence").map((source): TFence => {
					const copy = structuredClone(source);
					copy.id = newId("fence");
					copy.name = copyName("fence", source.name);
					copy.points = source.points.map((point) =>
						fencePoint(point[0] + step, point[1] + step, point[2]),
					);
					return copy;
				});
				const entities = picked(current.entities, "entity").map((source): TEntity => {
					const copy = structuredClone(source);
					copy.id = newId(source.kind);
					renameEntity(copy, copyName("entity", source.name));
					copy.position = [source.position[0] + step, source.position[1] + step];
					const copiedRoad = copy.follow && roadIds.get(copy.follow.roadId);
					if (copy.follow && copiedRoad) {
						// Along the copied road, where it was on the original.
						copy.follow.roadId = copiedRoad;
					} else if (copy.follow && !leaveBehind) {
						// A little further along the same road, like a single copy.
						copy.follow.offset += 3;
					}
					return copy;
				});
				if (entities.length + roads.length + areas.length + fences.length === 0) {
					return;
				}
				get().commit(
					(scene) => {
						scene.entities.push(...entities);
						scene.roads.push(...roads);
						scene.areas.push(...areas);
						scene.fences.push(...fences);
						// Left behind, the copies keep the names: the originals that move are the copies now.
						if (leaveBehind) {
							for (const item of selectedItems) {
								const original = listOf(scene, item.kind).find((thing) => thing.id === item.id);
								if (original && item.kind === "entity") {
									renameEntity(original as Draft<TEntity>, namers.entity(original.name));
								} else if (original) {
									original.name = namers[item.kind](original.name);
								}
							}
						}
					},
					coalesce ? { coalesce, gesture: true } : undefined,
				);
				if (leaveBehind) {
					return;
				}
				get().selectItems([
					...areas.map((area): ISceneItem => ({ kind: "area", id: area.id })),
					...roads.map((road): ISceneItem => ({ kind: "road", id: road.id })),
					...fences.map((fence): ISceneItem => ({ kind: "fence", id: fence.id })),
					...entities.map((entity): ISceneItem => ({ kind: "entity", id: entity.id })),
				]);
			},
			setSelectedFlag: (flag, value) => {
				const items = get().selectedItems;
				get().commit((scene) => {
					for (const item of items) {
						const found = listOf(scene, item.kind).find((thing) => thing.id === item.id);
						if (found) {
							found[flag] = value;
						}
					}
				});
			},
			setMode: (mode) =>
				set({
					mode,
					...NOTHING_SELECTED,
					drawing: null,
					painting: false,
					placingKind: null,
					transform: null,
					boxSelect: null,
					joinOffer: null,
					routePreview: null,
					followOffer: null,
					contextMenu: null,
					groundMenu: null,
					viewpointMenu: null,
				}),
			setTab: (tab) => set({ tab }),
			setDragging: (dragging) => set({ dragging }),
			worldShown: (opening) =>
				set((state) => (state.openingWorld === opening ? { openingWorld: null } : state)),
			startPlacing: (kind) => set({ placingKind: kind, drawing: null, followOffer: null }),
			stopPlacing: () => set({ placingKind: null }),
			startTransform: (mode, session) =>
				set({ transform: { mode, axis: null, typed: "", ...session } }),
			duplicateAndGrab: () => {
				const { scene: before, selectedItems: items } = get();
				const token = `duplicate:${performance.now()}`;
				get().duplicateSelected({ step: 0, coalesce: token });
				if (get().scene !== before) {
					get().startTransform("grab", { token, undo: { scene: before, items } });
				}
			},
			updateTransform: (patch) =>
				set((s) => (s.transform ? { transform: { ...s.transform, ...patch } } : s)),
			endTransform: () => set({ transform: null }),
			setViewInset: (pixels) => set({ viewInset: pixels }),
			toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
			togglePlaying: () => set((s) => ({ playing: !s.playing })),
			setProjection: (projection) => set({ projection }),
			toggleProjection: () =>
				set((s) => ({
					projection: s.projection === "perspective" ? "orthographic" : "perspective",
				})),
			setPreviewTiltShift: (preview) => set({ previewTiltShift: preview }),
			setRenderDialogOpen: (open) => set({ renderDialogOpen: open }),
			setPreferencesOpen: (open, page) =>
				set({ preferencesOpen: open, preferencesPage: open ? (page ?? null) : null }),
			setHoldingRightButton: (holding) =>
				set((s) => (s.holdingRightButton === holding ? s : { holdingRightButton: holding })),
			resetCamera: () => {
				const defaults = CameraSettingsSchema.parse({});
				get().commit((scene) => {
					const { turntableOn, turntableSpeed, turntableDelay, keepsIsometricAngle } = scene.camera;
					const { tiltShiftOn, tiltShiftBlur, tiltShiftFocus, tiltShiftPosition } = scene.camera;
					scene.camera = {
						...defaults,
						turntableOn,
						turntableSpeed,
						turntableDelay,
						keepsIsometricAngle,
						tiltShiftOn,
						tiltShiftBlur,
						tiltShiftFocus,
						tiltShiftPosition,
					};
				});
				set((s) => ({
					projection: "orthographic",
					cameraFollow: null,
					activeViewpointId: null,
					viewNonce: s.viewNonce + 1,
					frameBox: null,
				}));
			},
			resetView: () => {
				const opening = openingViewpointOf(get().scene);
				if (opening) {
					get().goToViewpoint(opening.id);
					return;
				}
				// The whole world, shown as the world says (scene.camera.openingProjection).
				set((s) => ({
					viewNonce: s.viewNonce + 1,
					frameBox: null,
					cameraFollow: null,
					projection: s.scene.camera.openingProjection,
				}));
			},

			showOpeningView: (remembered) => {
				const opening = openingViewpointOf(get().scene);
				const pose = remembered ?? opening;
				if (!pose) {
					get().resetView();
					return;
				}
				set((s) => ({
					cameraFollow: null,
					projection: pose.projection,
					flight: { pose, nonce: (s.flight?.nonce ?? 0) + 1, instant: true },
					activeViewpointId: remembered ? null : (opening?.id ?? null),
				}));
			},

			frameSelection: () => {
				const box = boundsOfAll(get().scene, get().selectedItems);
				if (box) {
					set((s) => ({ viewNonce: s.viewNonce + 1, frameBox: box, cameraFollow: null }));
				}
			},

			setHovered: (item) => set({ hovered: item }),

			openContextMenu: (item, at, point) => {
				if (!item || !at) {
					set({ contextMenu: null });
					return;
				}
				const state = get();
				// Right-clicking one of several selected things keeps them all: the menu acts on them.
				if (state.selectedItems.length < 2 || !state.selectedItems.some(sameItem(item))) {
					state.selectItems([item]);
				}
				set({ contextMenu: { item, ...at, point }, groundMenu: null, viewpointMenu: null });
			},

			openGroundMenu: (point, at) => {
				if (!point || !at) {
					set({ groundMenu: null });
					return;
				}
				get().clearSelection();
				set({ groundMenu: { point, ...at }, contextMenu: null, viewpointMenu: null });
			},

			openViewpointMenu: (id, at) =>
				set(
					id && at
						? { viewpointMenu: { id, ...at }, contextMenu: null, groundMenu: null }
						: { viewpointMenu: null },
				),

			framePoint: ([x, z]) =>
				set((s) => ({
					viewNonce: s.viewNonce + 1,
					frameBox: { center: [x, 0, z], size: [10, 2, 10] },
					cameraFollow: null,
				})),
			renameItem: (item, name) => {
				const recipe = (thing: { name: string }) => {
					thing.name = name;
				};
				if (item.kind === "entity") {
					get().updateEntity(item.id, recipe);
				} else if (item.kind === "road") {
					get().updateRoad(item.id, recipe);
				} else if (item.kind === "fence") {
					get().updateFence(item.id, recipe);
				} else {
					get().updateArea(item.id, recipe);
				}
			},

			setItemFlag: (item, flag, value) =>
				get().commit((scene) => {
					const found = listOf(scene, item.kind).find((thing) => thing.id === item.id);
					if (found) {
						found[flag] = value;
					}
				}),

			toggleSelectedHidden: () => {
				const state = get();
				const item = selectedItem(state);
				const found = item && listOf(state.scene, item.kind).find((thing) => thing.id === item.id);
				if (found) {
					state.setSelectedFlag("hidden", !found.hidden);
				}
			},

			revealAll: () =>
				get().commit((scene) => {
					for (const thing of [
						...scene.entities,
						...scene.roads,
						...scene.areas,
						...scene.fences,
					]) {
						thing.hidden = false;
					}
				}),

			followWithCamera: (entityId, ride) =>
				set((s) => {
					const projectionBefore = s.cameraFollow?.projectionBefore ?? s.projection;
					return {
						cameraFollow: { entityId, ride, projectionBefore },
						projection: ride ? "perspective" : projectionBefore,
						flight: null,
					};
				}),

			stopFollowing: () =>
				set((s) =>
					s.cameraFollow
						? {
								cameraFollow: null,
								projection: s.cameraFollow.ride ? s.cameraFollow.projectionBefore : s.projection,
							}
						: s,
				),

			goToViewpoint: (id, { instant = false } = {}) => {
				const viewpoint = get().scene.viewpoints.find((v) => v.id === id);
				if (!viewpoint) {
					return;
				}
				// Its mood too, if it has one and the viewer lets viewpoints put moods on (ADR-0078).
				if (
					viewpoint.moodId &&
					readPreferences().putOnViewpointMoods &&
					get().scene.moods.some((m) => m.id === viewpoint.moodId)
				) {
					get().putOnMood(viewpoint.moodId);
				}
				set((s) => ({
					cameraFollow: null,
					projection: viewpoint.projection,
					flight: { pose: viewpoint, nonce: (s.flight?.nonce ?? 0) + 1, instant },
					activeViewpointId: id,
				}));
			},

			selectViewpoint: (id) => set({ ...NOTHING_SELECTED, activeViewpointId: id, tab: "views" }),

			isometricNonce: 0,
			lookIsometric: () =>
				set((s) => ({ isometricNonce: s.isometricNonce + 1, cameraFollow: null })),

			glideTo: (pose) =>
				set((s) => ({
					cameraFollow: null,
					projection: pose.projection,
					flight: { pose, nonce: (s.flight?.nonce ?? 0) + 1, instant: false },
				})),

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
					if (scene.camera.openingViewpointId === id) {
						scene.camera.openingViewpointId = null;
					}
				});
				if (get().activeViewpointId === id) {
					set({ activeViewpointId: null });
				}
			},

			setOpeningViewpoint: (id) =>
				get().commit((scene) => {
					scene.camera.openingViewpointId = id;
				}),

			saveMood: () => {
				const { scene } = get();
				const mood = moodOf(scene, newId("mood"), `Mood ${scene.moods.length + 1}`);
				get().commit((draft) => {
					draft.moods.push(mood);
				});
				return mood.id;
			},

			putOnMood: (id) => {
				const mood = get().scene.moods.find((m) => m.id === id);
				if (!mood || wearsMood(get().scene, mood)) {
					return;
				}
				get().commit((scene) => {
					putOnMood(scene, mood);
				});
				// A day cycle starts again from the mood's time.
				if (mood.lighting.timeSource === "cycle") {
					restartDayCycle();
				}
			},

			resaveMood: (id) =>
				get().commit((scene) => {
					const index = scene.moods.findIndex((m) => m.id === id);
					if (index >= 0) {
						scene.moods[index] = moodOf(scene as TScene, id, scene.moods[index].name);
					}
				}),

			renameMood: (id, name) =>
				get().commit((scene) => {
					const mood = scene.moods.find((m) => m.id === id);
					if (mood) {
						mood.name = name;
					}
				}),

			removeMood: (id) =>
				get().commit((scene) => {
					scene.moods = scene.moods.filter((m) => m.id !== id);
					for (const viewpoint of scene.viewpoints) {
						if (viewpoint.moodId === id) {
							viewpoint.moodId = null;
						}
					}
				}),

			addEntity: (input) => {
				const entity = EntitySchema.parse({ ...input, id: input.id ?? newId(input.kind) });
				// Without a height of its own, it stands on the ground where it's put (ADR-0098).
				if (input.elevation === undefined) {
					entity.elevation = groundHeightAt(get().scene.areas, entity.position);
				}
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

			setEntityProp: (id, key, value, options) =>
				get().updateEntity(
					id,
					(entity) => {
						entity.props[key] = value;
					},
					options,
				),

			setEntityLight: (id, lightId, change, options) =>
				get().updateEntity(
					id,
					(entity) => {
						if (typeof entity.lights === "string") {
							const mode = entity.lights;
							entity.lights = {};
							if (mode !== "auto") {
								for (const spec of getPart(entity.kind)?.lights ?? []) {
									entity.lights[spec.id] = EntityLightSchema.parse({ whenOn: mode });
								}
							}
						}
						const next = applySettingChange(
							entity.lights[lightId] ?? EntityLightSchema.parse({}),
							change,
						);
						// Nothing left that differs from the part: no entry at all.
						if (isUnsetSetting(next)) {
							delete entity.lights[lightId];
						} else {
							entity.lights[lightId] = next;
						}
					},
					options,
				),

			setEntityColor: (id, colorId, change, options) =>
				get().updateEntity(
					id,
					(entity) => {
						const spec = getPart(entity.kind)?.colors.find((color) => color.id === colorId);
						const current = entity.colors[colorId] ?? EntityColorSchema.parse({});
						// An older world's colour for it becomes its setting here, then the old field goes.
						const legacy = spec?.legacy ? entity[spec.legacy] : null;
						const next = applySettingChange(
							current.color === null && legacy ? { ...current, color: legacy } : current,
							change,
						);
						if (spec?.legacy) {
							entity[spec.legacy] = null;
						}
						if (isUnsetSetting(next)) {
							delete entity.colors[colorId];
						} else {
							entity.colors[colorId] = next;
						}
					},
					options,
				),

			moveEntity: (id, position, options, how) =>
				get().updateEntity(
					id,
					(entity) => {
						const to: TVec2 = [round(position[0]), round(position[1])];
						// Placed freely, as high above the ground there as here (ADR-0098).
						if (how?.followGround) {
							entity.elevation = elevationMovedTo(
								get().scene.areas,
								entity.elevation,
								entity.position,
								to,
							);
						}
						entity.position = to;
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
				const names = new Set(get().scene.entities.map((e) => e.name));
				renameEntity(copy, copyName(source.name, names, readPreferences().namesOfCopies));
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
						const neighbours = road.loops
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
				if (road.loops) {
					// Open the loop at this point: it becomes both the start and the end.
					get().updateRoad(id, (r) => {
						r.points = [...r.points.slice(index), ...r.points.slice(0, index + 1)];
						r.loops = false;
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
				if (!a || !b || a.loops || b.loops) {
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
							r.loops = true;
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
						b.width !== a.width && pointWidth(p) === undefined
							? withPoint(p, { width: b.width })
							: p,
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

			addFence: (input) => {
				const fence = FenceSchema.parse({ ...input, id: input.id ?? newId("fence") });
				get().commit((scene) => {
					scene.fences.push(fence);
				});
				set({ ...NOTHING_SELECTED, selectedFenceId: fence.id, tab: "object" });
				return fence.id;
			},

			updateFence: (id, recipe, options) =>
				get().commit((scene) => {
					const fence = scene.fences.find((f) => f.id === id);
					if (fence) {
						recipe(fence);
					}
				}, options),

			removeFence: (id) => {
				get().commit((scene) => {
					scene.fences = scene.fences.filter((f) => f.id !== id);
				});
				if (get().selectedFenceId === id) {
					set({ selectedFenceId: null, selectedPointIndex: null });
				}
			},

			moveFencePoint: (id, index, point, options) =>
				get().updateFence(
					id,
					(fence) => {
						const current = fence.points[index];
						if (current) {
							fence.points[index] = fencePoint(point[0], point[1], current[2]);
						}
					},
					options,
				),

			setFencePointLift: (id, index, lift, options) =>
				get().updateFence(
					id,
					(fence) => {
						const current = fence.points[index];
						if (current) {
							fence.points[index] = fencePoint(current[0], current[1], lift);
						}
					},
					options,
				),

			insertFencePoint: (id, index, point, options) =>
				get().updateFence(
					id,
					(fence) => {
						fence.points.splice(index, 0, fencePoint(point[0], point[1], point[2]));
					},
					options,
				),

			removeFencePoint: (id, index) => {
				get().updateFence(id, (fence) => {
					if (fence.points.length > 2) {
						fence.points.splice(index, 1);
					}
				});
				set((state) =>
					state.selectedFenceId === id && state.selectedPointIndex !== null
						? { selectedPointIndex: null }
						: state,
				);
			},

			splitFence: (id, index) => {
				const fence = get().scene.fences.find((f) => f.id === id);
				if (!fence || index < 0 || index >= fence.points.length) {
					return null;
				}
				if (fence.loops) {
					// Open the loop at this point: it becomes both the start and the end.
					get().updateFence(id, (f) => {
						f.points = [...f.points.slice(index), ...f.points.slice(0, index + 1)];
						f.loops = false;
					});
					set({ selectedPointIndex: 0 });
					return id;
				}
				if (index === 0 || index === fence.points.length - 1) {
					return null; // nothing to cut at an end
				}
				// How much is built, shared out by length: the built part stays where it was. (One
				// following data keeps following it in both, each built that share of its own length.)
				const share = (part: TFencePoint[]) => fenceLength({ ...fence, points: part });
				const [firstLength, total] = [share(fence.points.slice(0, index + 1)), share(fence.points)];
				const builtLength = fence.builtShare * total;
				const second = FenceSchema.parse({
					...structuredClone(fence),
					id: newId("fence"),
					name: fence.name ? `${fence.name} (2)` : "",
					points: fence.points.slice(index),
					builtShare:
						total - firstLength > 1e-6
							? round(Math.max(0, (builtLength - firstLength) / (total - firstLength)))
							: fence.builtShare,
				});
				get().commit((scene) => {
					const first = scene.fences.find((f) => f.id === id);
					if (first) {
						first.points = first.points.slice(0, index + 1);
						if (firstLength > 1e-6) {
							first.builtShare = round(Math.min(1, builtLength / firstLength));
						}
						scene.fences.splice(scene.fences.indexOf(first) + 1, 0, second);
					}
				});
				set({ ...NOTHING_SELECTED, selectedFenceId: second.id, selectedPointIndex: 0 });
				return second.id;
			},

			startFenceDrawing: (fenceStyle) =>
				set({
					drawing: {
						target: "fence",
						style: "road_01",
						areaType: "grass_01",
						fenceStyle,
						points: [],
					},
					...NOTHING_SELECTED,
					joinOffer: null,
					followOffer: null,
				}),

			continueFenceDrawing: (fenceId, end) => {
				const fence = get().scene.fences.find((f) => f.id === fenceId);
				if (!fence || fence.loops) {
					return;
				}
				// Orient the points so new ones are added after the chosen end.
				const points = end === "end" ? [...fence.points] : [...fence.points].reverse();
				set({
					drawing: {
						target: "fence",
						style: "road_01",
						areaType: "grass_01",
						fenceStyle: fence.style,
						points,
						fenceId,
						reversed: end === "start",
					},
					...NOTHING_SELECTED,
					joinOffer: null,
					followOffer: null,
				});
			},

			startDrawing: (style) =>
				set({
					drawing: { target: "road", style, areaType: "grass_01", points: [] },
					...NOTHING_SELECTED,
					joinOffer: null,
					followOffer: null,
				}),

			startAreaDrawing: (areaType) =>
				set({
					drawing: { target: "area", style: "road_01", areaType, points: [] },
					...NOTHING_SELECTED,
					joinOffer: null,
					followOffer: null,
				}),

			continueDrawing: (roadId, end) => {
				const road = get().scene.roads.find((r) => r.id === roadId);
				if (!road || road.loops) {
					return;
				}
				// Orient the points so new ones are added after the chosen end.
				const points = end === "end" ? [...road.points] : [...road.points].reverse();
				set({
					drawing: { target: "road", style: road.style, areaType: "grass_01", points, roadId },
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
						const corner = area.points[index];
						if (corner) {
							// It keeps its own height (ADR-0096).
							area.points[index] = cornerWithLift(point[0], point[1], cornerLift(corner));
						}
					},
					options,
				),

			insertAreaPoint: (id, index, point, options) =>
				get().updateArea(
					id,
					(area) => {
						// Between its neighbours' heights, so a corner added on a slope doesn't dent it.
						const before = area.points[(index - 1 + area.points.length) % area.points.length];
						const after = area.points[index % area.points.length];
						const lift = before && after ? (cornerLift(before) + cornerLift(after)) / 2 : 0;
						area.points.splice(index, 0, cornerWithLift(point[0], point[1], lift));
					},
					options,
				),

			setAreaCornerHeight: (id, index, top, options) =>
				get().updateArea(
					id,
					(area) => {
						const corner = area.points[index];
						// Water stays level (ADR-0096).
						if (corner && takesCornerHeights(area)) {
							area.points[index] = cornerWithLift(corner[0], corner[1], liftForTop(area, top));
						}
					},
					options,
				),

			selectAreaPeak: (areaId, index) =>
				set((state) => ({
					...NOTHING_SELECTED,
					selectedAreaId: areaId,
					selectedPeakIndex: index,
					tab: state.mode === "edit" ? "shape" : state.tab,
				})),

			addAreaPeak: (areaId, at) => {
				const area = get().scene.areas.find((a) => a.id === areaId);
				if (!area || !takesCornerHeights(area)) {
					return;
				}
				const middle = at && isInsidePolygon(at, area.points) ? at : middleOf(area.points);
				// Flush with the top there: nothing changes until it's lifted (selected, its arrow ready).
				const top = areaTopAt(area, middle) ?? area.height;
				get().updateArea(areaId, (draft) => {
					draft.peaks.push([round(middle[0]), round(middle[1]), liftForTop(draft, top)]);
				});
				get().selectAreaPeak(areaId, area.peaks.length);
			},

			moveAreaPeak: (areaId, index, point, options) =>
				get().updateArea(
					areaId,
					(area) => {
						const peak = area.peaks[index];
						if (peak) {
							area.peaks[index] = [round(point[0]), round(point[1]), peak[2]];
						}
					},
					options,
				),

			setAreaPeakHeight: (areaId, index, top, options) =>
				get().updateArea(
					areaId,
					(area) => {
						const peak = area.peaks[index];
						if (peak && takesCornerHeights(area)) {
							area.peaks[index] = [peak[0], peak[1], liftForTop(area, top)];
						}
					},
					options,
				),

			removeAreaPeak: (areaId, index) => {
				get().updateArea(areaId, (area) => {
					area.peaks.splice(index, 1);
				});
				set((state) =>
					state.selectedAreaId === areaId && state.selectedPeakIndex !== null
						? { selectedPeakIndex: null }
						: state,
				);
			},

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
						height: AREA_TYPES[drawing.areaType].startHeight,
					});
				}
				const loops = Boolean(options.loops) && drawing.points.length > 2;
				if (drawing.target === "fence") {
					const drawn = drawing.points.map(([x, z, lift]) => fencePoint(x, z, lift));
					const points = drawing.reversed ? drawn.reverse() : drawn;
					if (drawing.fenceId) {
						const fenceId = drawing.fenceId;
						get().updateFence(fenceId, (fence) => {
							fence.points = points;
							fence.loops = loops;
						});
						set({ ...NOTHING_SELECTED, selectedFenceId: fenceId, tab: "object" });
						return fenceId;
					}
					const fenceStyle = drawing.fenceStyle ?? "picket_fence_01";
					const count = scene.fences.filter((f) => f.style === fenceStyle).length;
					return get().addFence({
						name: `${FENCE_STYLE_LABELS[fenceStyle]} ${count + 1}`,
						style: fenceStyle,
						points,
						loops,
					});
				}
				if (drawing.roadId) {
					const roadId = drawing.roadId;
					get().updateRoad(roadId, (road) => {
						road.points = drawing.points;
						road.loops = loops;
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
					loops,
				});
			},

			cancelDrawing: () => set({ drawing: null }),
		};
	});
};

/**
 * The mode the 3D view draws as: View mode's look (no gizmos, handles or grid) while a still
 * picture renders (ADR-0084), without leaving Edit mode, so the selection and panels stay.
 */
export const drawnModeOf = (s: Pick<IEditorState, "mode" | "stillRender">): TEditorMode =>
	s.stillRender ? "view" : s.mode;

export const useEditor = createEditorStore();

// Development: a code change in anything this module imports re-runs it, making a new store. The
// new store takes over the previous one's state (the open world, its history, the selection, mode
// and playing), but not its functions, so the world doesn't reset and the new code runs. The
// previous store is found on globalThis (Vite only hands `hot.data` to the module that accepts the
// update, which this one isn't). AppShell moves autosave over to the new store. The end-to-end
// tests (e2e/, ADR-0069) reach the store this way too: keep it on globalThis in development.
if (import.meta.hot) {
	const holder = globalThis as { __editorStore?: typeof useEditor };
	const previous = holder.__editorStore?.getState();
	if (previous) {
		useEditor.setState(
			Object.fromEntries(
				Object.entries(previous).filter(([, value]) => typeof value !== "function"),
			) as Partial<IEditorState>,
		);
	}
	holder.__editorStore = useEditor;
}

export const selectSelectedEntity = (state: IEditorState) =>
	state.scene.entities.find((e) => e.id === state.selectedId) ?? null;

export const selectSelectedRoad = (state: IEditorState) =>
	state.scene.roads.find((r) => r.id === state.selectedRoadId) ?? null;

export const selectSelectedArea = (state: IEditorState) =>
	state.scene.areas.find((a) => a.id === state.selectedAreaId) ?? null;

export const selectSelectedFence = (state: IEditorState) =>
	state.scene.fences.find((f) => f.id === state.selectedFenceId) ?? null;

/** Whether an item is among the selected ones (ADR-0064), active or not. */
/**
 * Each list of items as a set of keys, made once per list (lists are replaced, never changed): asked
 * by every object on every change, so it mustn't look through a selection of hundreds each time.
 */
const itemKeySets = new WeakMap<readonly ISceneItem[], Set<string>>();

export const includesItem = (
	items: readonly ISceneItem[],
	kind: ISceneItem["kind"],
	id: string,
) => {
	let keys = itemKeySets.get(items);
	if (!keys) {
		keys = new Set(items.map((item) => `${item.kind}:${item.id}`));
		itemKeySets.set(items, keys);
	}
	return keys.has(`${kind}:${id}`);
};

export const isItemSelected = (state: IEditorState, kind: ISceneItem["kind"], id: string) =>
	includesItem(state.selectedItems, kind, id);

/** Several things are selected: actions and transforms work on all of them (ADR-0064). */
export const selectSeveral = (state: IEditorState) => state.selectedItems.length > 1;

/** A Shift-, Ctrl- or Cmd-click: adds to the selection or takes from it, in Edit mode (ADR-0064). */
export const isToggleClick = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) =>
	event.shiftKey || event.ctrlKey || event.metaKey;

/** Whether a box being drawn would add an item to the selection or take it out (ADR-0064). */
export const isItemBoxed = (state: IEditorState, kind: ISceneItem["kind"], id: string) =>
	state.boxDrag ? includesItem(state.boxDrag.items, kind, id) : false;

/**
 * The selection moves, turns and resizes as a group (ADR-0064, ADR-0066): several things, or a
 * whole road or area (selected with none of its points, or peaks, ADR-0101).
 */
export const selectMovesAsGroup = (state: IEditorState) =>
	state.selectedItems.length > 1 ||
	(state.selectedItems.length === 1 &&
		state.selectedItems[0].kind !== "entity" &&
		state.selectedPointIndex === null &&
		state.selectedPeakIndex === null);
