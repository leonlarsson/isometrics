import { APP_NAME } from "#/lib/app";
import { round, turnedHalfSize } from "#/lib/math";
import { measurePrefab, prefabName, prefabPartOf, UNNAMED_PREFAB } from "#/parts/prefabParts";
import { getBasePart, resolveProps } from "#/parts/registry";
import { groundHeightAt } from "#/scene/areas";
import {
	EntitySchema,
	isPrefabKind,
	PrefabSchema,
	SceneSchema,
	type TEntity,
	type TFence,
	type TPrefab,
	type TScene,
	type TVec2,
	type TViewPose,
} from "#/scene/schema";

import { rememberedView, workshopViewKey } from "./cameraMemory";
import type { ISceneItem } from "./framing";
import { setPaletteCategory } from "./paletteMemory";
import { findFreeSpot } from "./placement";
import { keepInLibrary } from "./prefabLibrary";
import { newId, useEditor } from "./store";
import { notify } from "./toasts";
import { type IWorkshop, whyNoWorkshop, workshopOf } from "./whatIsOpen";

/**
 * The Workshop (ADR-0134): a small world of its own for building a prefab
 * with the whole editor, opened from the world it's for (whose look and data
 * it has) and left back to it. Saving keeps the design in that world, as one
 * undo step, and updates its copies. The pure parts (what a design is, what
 * the Workshop world is) are separate from what acts on the store, so they're
 * tested on their own.
 */

/** The Workshop's ground is at least this big a side, and this much bigger than its pieces. */
const SMALLEST_GROUND = 16;
const GROUND_MARGIN = 8;
const LARGEST_GROUND = 500;

/** The pieces of a prefab: objects and fences. */
export interface IPieces {
	entities: TEntity[];
	fences: TFence[];
}

/** The box round some pieces on the ground, its middle and the lowest piece's altitude; null for none. */
export const boundsOf = ({ entities, fences }: IPieces) => {
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	let low = Number.POSITIVE_INFINITY;
	for (const entity of entities) {
		const part = getBasePart(entity.kind);
		const [width, depth] = part ? part.footprint(resolveProps(part, entity.props)) : [1, 1];
		const [halfX, halfZ] = turnedHalfSize(width, depth, entity.rotation[1], entity.scale);
		const [x, z] = entity.position;
		minX = Math.min(minX, x - halfX);
		maxX = Math.max(maxX, x + halfX);
		minZ = Math.min(minZ, z - halfZ);
		maxZ = Math.max(maxZ, z + halfZ);
		low = Math.min(low, entity.altitude);
	}
	for (const fence of fences) {
		for (const [x, z, lift] of fence.points) {
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minZ = Math.min(minZ, z);
			maxZ = Math.max(maxZ, z);
			low = Math.min(low, lift);
		}
	}
	if (!Number.isFinite(minX)) {
		return null;
	}
	return {
		middle: [round((minX + maxX) / 2), round((minZ + maxZ) / 2)] as TVec2,
		low: Number.isFinite(low) ? low : 0,
		/** Its sides: the box round the pieces on the ground. */
		box: { minX, maxX, minZ, maxZ },
	};
};

/** Pieces moved by an offset along the ground and down by `low`, so the lowest stands at 0. */
const movePieces = ({ entities, fences }: IPieces, [dx, dz]: TVec2, low: number): IPieces => ({
	entities: entities.map((entity) => ({
		...structuredClone(entity),
		position: [round(entity.position[0] - dx), round(entity.position[1] - dz)],
		altitude: round(entity.altitude - low),
	})),
	fences: fences.map((fence) => ({
		...structuredClone(fence),
		points: fence.points.map(([x, z, lift]): [number, number, number] => [
			round(x - dx),
			round(z - dz),
			round(Math.max(0, lift - low)),
		]),
	})),
});

/**
 * Pieces round their own middle, the lowest at altitude 0 (a prefab's origin), with where that
 * middle was and how high: where a copy goes to stand where they stood.
 */
export const centredPieces = (pieces: IPieces) => {
	const bounds = boundsOf(pieces);
	if (!bounds) {
		return { pieces, middle: [0, 0] as TVec2, low: 0 };
	}
	return {
		pieces: movePieces(pieces, bounds.middle, bounds.low),
		middle: bounds.middle,
		low: bounds.low,
	};
};

/**
 * What of a world's selection can be a prefab's pieces: its objects (never a prefab's copies:
 * no nesting) and fences, parked (pieces don't drive) and without cards (the copy has one).
 */
export const piecesOfSelection = (scene: TScene, items: readonly ISceneItem[]) => {
	const picked = (kind: ISceneItem["kind"], id: string) =>
		items.some((item) => item.kind === kind && item.id === id);
	const objects = scene.entities.filter((entity) => picked("entity", entity.id));
	return {
		pieces: {
			entities: objects
				.filter((entity) => !isPrefabKind(entity.kind))
				.map((entity) => ({ ...entity, follow: null, dataRow: null })),
			fences: scene.fences.filter((fence) => picked("fence", fence.id)),
		},
		/** Copies of prefabs among them, which stay out. */
		leftOut: objects.filter((entity) => isPrefabKind(entity.kind)).length,
	};
};

/**
 * The Workshop's world for some pieces, made for the world it's opened from: its theme,
 * light, sky, water, weather, moods, backdrop and data, so the pieces look and follow data as
 * they will there, on a ground of its own sized to them (at least 16 × 16), with nothing else.
 */
export const workshopWorldOf = (from: TScene, pieces: IPieces): TScene => {
	const { footprint } = measurePrefab(pieces);
	const side = (size: number) =>
		Math.min(LARGEST_GROUND, Math.max(SMALLEST_GROUND, 2 * Math.ceil((size + GROUND_MARGIN) / 2)));
	return SceneSchema.parse({
		version: from.version,
		meta: { title: "The Workshop", subtitle: `Making a prefab for ${from.meta.title}` },
		// The world's theme and data, so pieces look and follow data as they will there; a plain,
		// flattering daylight and backdrop of its own, as a studio's (lighting, sky, weather and
		// backdrop left at their defaults), whatever the hour or weather in the world.
		theme: from.theme,
		ground: { width: side(footprint[0]), depth: side(footprint[1]), colors: from.ground.colors },
		traffic: from.traffic,
		water: from.water,
		data: from.data,
		onScreen: {
			...from.onScreen,
			showsTimeOfDay: false,
			showsViewpointBar: false,
		},
		camera: { ...from.camera, openingViewpointId: null },
		entities: pieces.entities,
		fences: pieces.fences,
	});
};

/**
 * The design a Workshop world holds: its objects (never copies of prefabs) and fences, round
 * their middle, the lowest at altitude 0 (roads and areas aren't a prefab's).
 */
export const designOf = (
	world: Pick<TScene, "entities" | "fences">,
	{ id, name, description }: Pick<TPrefab, "id" | "name" | "description">,
): TPrefab => {
	const { pieces } = centredPieces({
		entities: world.entities.filter((entity) => !isPrefabKind(entity.kind)),
		fences: world.fences,
	});
	return PrefabSchema.parse({ id, name, description, ...pieces });
};

/** A name for a new prefab that none of these has: "Prefab", "Prefab 2"… */
export const newPrefabName = (prefabs: readonly Pick<TPrefab, "name">[]) => {
	const taken = new Set(prefabs.map((prefab) => prefabName(prefab)));
	let name = UNNAMED_PREFAB;
	for (let n = 2; taken.has(name); n++) {
		name = `${UNNAMED_PREFAB} ${n}`;
	}
	return name;
};

// Acting on the store ---------------------------------------------------------------------------

const store = () => useEditor.getState();

/** Say why the Workshop can't open now, and whether it can. */
const canOpen = () => {
	const why = whyNoWorkshop(store().whatIsOpen);
	if (why) {
		notify("Prefabs can't be made here", `To make or change one, ${why}.`, "error");
	}
	return why === null;
};

/** Whether the Workshop shows the ground, remembered in this browser from the last time (off at first). */
const GROUND_KEY = `${APP_NAME.toLowerCase()}:workshop-shows-ground`;

const readShowsGround = () => {
	try {
		return localStorage.getItem(GROUND_KEY) === "true";
	} catch {
		return false;
	}
};

/**
 * Open the Workshop on these pieces, with the camera where it was the last time this prefab was
 * built (or a new one), else framing its ground.
 */
const open = (
	pieces: IPieces,
	workshop: Omit<IWorkshop, "from" | "showsGround">,
	view: TViewPose | null,
) => {
	const { scene, past, future } = store();
	store().enterWorkshop(workshopWorldOf(scene, pieces), {
		...workshop,
		showsGround: readShowsGround(),
		from: { scene, past, future, view },
	});
	const remembered = rememberedView(workshopViewKey(workshop.prefabId));
	if (remembered) {
		store().showOpeningView(remembered);
	}
};

/** Add to scene's Make a prefab…: the Workshop, empty, for a new prefab. */
export const makeNewPrefab = (view: TViewPose | null) => {
	if (!canOpen()) {
		return;
	}
	open(
		{ entities: [], fences: [] },
		{ prefabId: null, replaces: null, name: newPrefabName(store().scene.prefabs), description: "" },
		view,
	);
};

/**
 * The context menu's Make a prefab from these…: the selected objects and fences, recentred, in
 * the Workshop; saving puts a copy where they stood, in their place.
 */
export const makePrefabFromSelection = (view: TViewPose | null) => {
	if (!canOpen()) {
		return;
	}
	const { scene, selectedItems } = store();
	const { pieces, leftOut } = piecesOfSelection(scene, selectedItems);
	if (pieces.entities.length + pieces.fences.length === 0) {
		notify(
			"Nothing here can be a prefab's piece",
			"Select objects or fences first. A prefab can't hold a prefab's copy.",
			"error",
		);
		return;
	}
	const centred = centredPieces(pieces);
	open(
		centred.pieces,
		{
			prefabId: null,
			replaces: {
				items: [
					...pieces.entities.map((entity): ISceneItem => ({ kind: "entity", id: entity.id })),
					...pieces.fences.map((fence): ISceneItem => ({ kind: "fence", id: fence.id })),
				],
				position: centred.middle,
				altitude: centred.low,
			},
			name: newPrefabName(scene.prefabs),
			description: "",
		},
		view,
	);
	if (leftOut > 0) {
		notify(
			`${leftOut === 1 ? "A prefab's copy stays" : `${leftOut} prefabs' copies stay`} in the world`,
			"A prefab can't hold another prefab.",
		);
	}
};

/** Edit prefab (a copy's menu and properties, its tile's menu): its design, to change it and every copy. */
export const editPrefab = (prefabId: string, view: TViewPose | null) => {
	const prefab = store().scene.prefabs.find((each) => each.id === prefabId);
	if (!prefab || !canOpen()) {
		return;
	}
	open(
		{ entities: prefab.entities, fences: prefab.fences },
		{ prefabId, replaces: null, name: prefabName(prefab), description: prefab.description },
		view,
	);
};

/** Change the Workshop's own settings (the prefab's name and description, the ground shown). */
const changeWorkshop = (
	change: Partial<Pick<IWorkshop, "name" | "description" | "showsGround">>,
) => {
	const { whatIsOpen, setWhatIsOpen } = store();
	const workshop = workshopOf(whatIsOpen);
	if (workshop && whatIsOpen.kind === "world") {
		setWhatIsOpen({ ...whatIsOpen, workshop: { ...workshop, ...change } });
	}
};

/** The bar's and the Prefab panel's name field. */
export const renamePrefabInWorkshop = (name: string) => changeWorkshop({ name });

/** The Prefab panel's description. */
export const describePrefabInWorkshop = (description: string) => changeWorkshop({ description });

/** Show the ground under the pieces, or let them float in the studio; remembered for next time. */
export const showGroundInWorkshop = (showsGround: boolean) => {
	changeWorkshop({ showsGround });
	try {
		localStorage.setItem(GROUND_KEY, String(showsGround));
	} catch {
		// Storage unavailable: the Workshop starts without the ground next time.
	}
};

/** Whether the Workshop holds anything a prefab can be made of. */
export const workshopHasPieces = (scene: Pick<TScene, "entities" | "fences">) =>
	scene.entities.some((entity) => !isPrefabKind(entity.kind)) || scene.fences.length > 0;

/**
 * Save the prefab: back to the world, which keeps the design (a new one added, a changed one
 * updated, its copies following), as one undo step. Made from a selection, that step also puts a
 * copy where the selection stood, in its place; a new one from nothing gets a copy where one
 * was looking, selected, ready to move where it goes. Returns the saved design, if it was.
 */
export const saveWorkshop = (): TPrefab | null => {
	const { scene: world, whatIsOpen } = store();
	const workshop = workshopOf(whatIsOpen);
	if (!workshop || !workshopHasPieces(world)) {
		return null;
	}
	const { from, prefabId, replaces } = workshop;
	const before = from.scene.prefabs.find((prefab) => prefab.id === prefabId);
	const design = designOf(world, {
		id: before?.id ?? newId("prefab"),
		name: workshop.name.trim() || newPrefabName(from.scene.prefabs),
		description: workshop.description.trim(),
	});
	const part = prefabPartOf(design);
	const near = from.view?.target ?? [0, 0];
	const position = replaces?.position ?? findFreeSpot(from.scene, part, near);
	const copy =
		before === undefined
			? EntitySchema.parse({
					id: newId(design.id),
					kind: design.id,
					position,
					// Where the selection stood, else on the ground where it's put (ADR-0098).
					altitude: replaces?.altitude ?? groundHeightAt(from.scene.areas, position),
				})
			: null;
	const replaced = new Set((replaces?.items ?? []).map((item) => `${item.kind}:${item.id}`));
	store().leaveWorkshop((scene) => {
		const at = scene.prefabs.findIndex((prefab) => prefab.id === design.id);
		if (at >= 0) {
			scene.prefabs[at] = design;
		} else {
			scene.prefabs.push(design);
		}
		if (replaced.size > 0) {
			scene.entities = scene.entities.filter((e) => !replaced.has(`entity:${e.id}`));
			scene.fences = scene.fences.filter((f) => !replaced.has(`fence:${f.id}`));
		}
		if (copy) {
			scene.entities.push(copy);
		}
	});
	if (copy) {
		store().select(copy.id);
	}
	// Ready to place more: Add to scene shows the prefabs.
	setPaletteCategory("prefabs");
	const copies = store().scene.entities.filter((entity) => entity.kind === design.id).length;
	notify(
		`Saved the prefab ${design.name}`,
		before
			? `${copies === 1 ? "Its copy has" : `All ${copies} copies have`} changed with it.`
			: replaces
				? "It stands where the things it's made of were. Place more from Add to scene's Prefabs."
				: "A copy is in the world, selected: drag it where it goes, or place more from Add to scene's Prefabs.",
		"success",
	);
	// In My prefabs too, for one's other worlds.
	if (!keepInLibrary(design)) {
		notify(
			"It isn't in My prefabs",
			"The browser refused to keep it (its storage may be full). It's kept in this world.",
			"error",
		);
	}
	return design;
};

/** Leave without saving, now: back to the world as it was. */
export const leaveWorkshopWithoutSaving = () => {
	store().setWorkshopLeaving(null);
	store().leaveWorkshop();
};

/**
 * The one way out of the Workshop without saving, whatever leads there (its bar's Leave without
 * saving, New world, Open file, a recent world…): straight away while nothing was built, else
 * asked first (the Workshop bar's question, `workshopLeaving`). Then `then` runs, from the world
 * the Workshop came from. Outside the Workshop, `then` runs at once.
 */
export const leaveWorkshopFirst = (then: () => void = () => {}) => {
	const { whatIsOpen, past, setWorkshopLeaving } = store();
	const workshop = workshopOf(whatIsOpen);
	if (!workshop) {
		then();
		return;
	}
	if (past.length === 0 && !workshop.isResumed) {
		leaveWorkshopWithoutSaving();
		then();
		return;
	}
	setWorkshopLeaving({ then });
};

/** The question's yes: leave, then do what was asked. */
export const confirmLeavingWorkshop = () => {
	const leaving = store().workshopLeaving;
	leaveWorkshopWithoutSaving();
	leaving?.then();
};
