import { z } from "zod";

import { APP_NAME } from "#/lib/app";
import { clamp, round } from "#/lib/math";
import { colorSettingOf } from "#/parts/colorModel";
import { lightSettingsOf } from "#/parts/lightModel";
import { getPart, partNameOf, type TAnyPart } from "#/parts/registry";
import { cornerLift, cornerWithLift, elevationMovedTo } from "#/scene/areas";
import { bindingMapsOf } from "#/scene/dataBindings";
import { copyNamer } from "#/scene/naming";
import { parseOrRepairScene } from "#/scene/repair";
import {
	DetailsSchema,
	EntityColorSchema,
	EntityLightSchema,
	FollowSchema,
	LabelSchema,
	SCENE_VERSION,
	type TArea,
	type TEntity,
	type TEntityColor,
	type TEntityLight,
	type TRoad,
	type TVec2,
} from "#/scene/schema";

import type { ISceneItem } from "./framing";
import { readPreferences } from "./preferences";
import { type ICommitOptions, newId, renameEntity, useEditor } from "./store";
import { notify } from "./toasts";

/**
 * Copying and pasting (ADR-0068): things (objects, roads, areas) and a
 * panel's settings travel as JSON on the system clipboard, marked as this
 * app's, so they move between worlds and tabs and an AI can write them. What
 * comes back is untrusted: things go through the scene's repair, settings
 * through their schemas.
 */

const APP = APP_NAME.toLowerCase();

/** What each kind of copied settings holds. */
const CopiedSettingsSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("light"),
		/** The light's name where it was copied, for messages. */
		name: z.string(),
		lightId: z.string(),
		shape: z.enum(["lens", "beam", "pool", "windows", "glow"]),
		light: EntityLightSchema,
	}),
	z.object({ kind: z.literal("colors"), colors: z.record(z.string(), EntityColorSchema) }),
	z.object({ kind: z.literal("label"), label: LabelSchema.nullable(), details: DetailsSchema }),
	z.object({ kind: z.literal("motion"), follow: FollowSchema }),
	z.object({
		kind: z.literal("shape"),
		part: z.string(),
		props: z.record(z.string(), z.unknown()),
	}),
	z.object({
		kind: z.literal("object"),
		part: z.string(),
		props: z.record(z.string(), z.unknown()),
		colors: z.record(z.string(), EntityColorSchema),
		lights: z.record(z.string(), EntityLightSchema),
		label: LabelSchema.nullable(),
		details: DetailsSchema,
	}),
]);

export type TCopiedSettings = z.output<typeof CopiedSettingsSchema>;

const ClipSchema = z.discriminatedUnion("type", [
	z.object({
		app: z.literal(APP),
		type: z.literal("things"),
		entities: z.array(z.unknown()).default([]),
		roads: z.array(z.unknown()).default([]),
		areas: z.array(z.unknown()).default([]),
	}),
	z.object({ app: z.literal(APP), type: z.literal("settings"), settings: CopiedSettingsSchema }),
]);

const store = () => useEditor.getState();

/** What a part's colours are on an object: each one's setting, an older world's colour, or unset. */
const colorsOf = (entity: TEntity, part: TAnyPart): Record<string, TEntityColor> =>
	Object.fromEntries(
		part.colors.map((spec) => {
			const legacy = spec.legacy ? entity[spec.legacy] : null;
			const setting = colorSettingOf(entity, spec.id);
			return [spec.id, setting ?? EntityColorSchema.parse(legacy ? { color: legacy } : {})];
		}),
	);

/** One light's settings on an object, an older world's one mode for all its lights included. */
const lightOf = (entity: TEntity, part: TAnyPart, id: string): TEntityLight => {
	const { setting, objectMode } = lightSettingsOf(part, entity.lights, id);
	return setting ?? EntityLightSchema.parse(objectMode === "auto" ? {} : { mode: objectMode });
};

// Copying ----------------------------------------------------------------------------------------

/** The settings a panel copies from an object (ADR-0068), or null when it has nothing to copy. */
export const settingsOf = (
	entity: TEntity,
	kind: TCopiedSettings["kind"],
	lightId?: string,
): TCopiedSettings | null => {
	const part = getPart(entity.kind);
	if (!part) {
		return null;
	}
	switch (kind) {
		case "light": {
			const spec = part.lights?.find((light) => light.id === lightId);
			return spec
				? {
						kind,
						name: spec.name,
						lightId: spec.id,
						shape: spec.shape,
						light: lightOf(entity, part, spec.id),
					}
				: null;
		}
		case "colors":
			return { kind, colors: colorsOf(entity, part) };
		case "label":
			return { kind, label: entity.label, details: entity.details };
		case "motion":
			return entity.follow ? { kind, follow: entity.follow } : null;
		case "shape":
			return { kind, part: entity.kind, props: structuredClone(entity.props) };
		case "object":
			return {
				kind,
				part: entity.kind,
				props: structuredClone(entity.props),
				colors: colorsOf(entity, part),
				lights: Object.fromEntries(
					(part.lights ?? []).map((spec) => [spec.id, lightOf(entity, part, spec.id)]),
				),
				label: entity.label,
				details: entity.details,
			};
	}
};

/** Copied settings as clipboard text. */
export const settingsText = (settings: TCopiedSettings) =>
	JSON.stringify({ app: APP, type: "settings", settings }, null, 2);

/** The selected objects, roads and areas as clipboard text, or null when nothing is selected. */
export const selectedThingsText = () => {
	const { scene, selectedItems } = store();
	const picked = <T extends { id: string }>(list: T[], kind: ISceneItem["kind"]) =>
		list.filter((thing) =>
			selectedItems.some((item) => item.kind === kind && item.id === thing.id),
		);
	const entities = picked(scene.entities, "entity");
	const roads = picked(scene.roads, "road");
	const areas = picked(scene.areas, "area");
	if (entities.length + roads.length + areas.length === 0) {
		return null;
	}
	return JSON.stringify({ app: APP, type: "things", entities, roads, areas }, null, 2);
};

/** "3 objects and a road": how many things of each kind, for messages. */
export const describeThings = (counts: { entities: number; roads: number; areas: number }) => {
	const parts = (
		[
			[counts.entities, "an object", "objects"],
			[counts.roads, "a road", "roads"],
			[counts.areas, "an area", "areas"],
		] as const
	).flatMap(([n, one, many]) => (n === 0 ? [] : [n === 1 ? one : `${n} ${many}`]));
	return parts.length > 1
		? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
		: (parts[0] ?? "");
};

/** What a panel's settings are called in messages: "Lamp's settings", "the colours"… */
const settingsName = (settings: TCopiedSettings) => {
	switch (settings.kind) {
		case "light":
			return `the ${settings.name} light's settings`;
		case "colors":
			return "the colours";
		case "label":
			return "the label card";
		case "motion":
			return "the motion";
		case "shape":
			return "the shape";
		case "object":
			return "the settings";
	}
};

/** Put text on the system clipboard, saying so (or why it couldn't). */
export const copyToClipboard = async (text: string, what: string, hint: string) => {
	try {
		await navigator.clipboard.writeText(text);
		notify(`Copied ${what}`, hint, "success");
	} catch {
		notify("Couldn't copy", "The browser didn't let the page use the clipboard.", "error");
	}
};

/** Copy a panel's settings to the clipboard (its menu's Copy). */
export const copySettings = (settings: TCopiedSettings | null) => {
	if (!settings) {
		notify(
			"Nothing to copy here",
			"It isn't set up yet, e.g. a vehicle that doesn't drive anywhere.",
		);
		return;
	}
	void copyToClipboard(
		settingsText(settings),
		settingsName(settings),
		"Select what to paste onto, then use Paste in the panel's menu, or press Ctrl+V.",
	);
};

// Pasting ----------------------------------------------------------------------------------------

/** Data keys that settings or things use but this world doesn't have, to warn about. */
const missingDataKeys = (keys: Iterable<string>) => {
	const known = new Set(store().scene.data.map((entry) => entry.key));
	return [...new Set(keys)].filter((key) => key && !known.has(key));
};

const warnAboutMissingData = (keys: string[]) => {
	if (keys.length > 0) {
		notify(
			"Some of it follows values this world doesn't have",
			`${keys.map((key) => `“${key}”`).join(", ")}: add them in the Data tab, or pick other values.`,
			"error",
		);
	}
};

/** The data keys a setting or thing uses: bindings, label and detail values, parts' data fields. */
const dataKeysOf = (thing: {
	lights?: TEntity["lights"];
	colors?: TEntity["colors"];
	label?: TEntity["label"];
	details?: TEntity["details"];
	props?: Record<string, unknown>;
	kind?: string;
}) => {
	const part = thing.kind ? getPart(thing.kind) : undefined;
	return [
		...bindingMapsOf({ lights: thing.lights ?? {}, colors: thing.colors ?? {} }).flatMap((map) =>
			Object.values(map).map((binding) => binding.key),
		),
		...(thing.label?.dataKeys ?? []),
		...(thing.details?.dataKeys ?? []),
		...(part?.fields ?? [])
			.filter((field) => field.type === "dataKey")
			.map((field) => String(thing.props?.[field.key] ?? "")),
	];
};

/** The selected objects with their parts. */
const selectedObjects = () => {
	const { scene, selectedItems } = store();
	return selectedItems.flatMap((item) => {
		const entity = item.kind === "entity" && scene.entities.find((e) => e.id === item.id);
		const part = entity && getPart(entity.kind);
		return entity && part ? [{ entity, part }] : [];
	});
};

/** A change that makes a light's settings exactly `light`: its bindings replace the ones there. */
const replaceLight = (light: TEntityLight, current: TEntityLight | undefined) => {
	const { data, ...fields } = light;
	const cleared = Object.fromEntries(Object.keys(current?.data ?? {}).map((key) => [key, null]));
	return { ...fields, data: { ...cleared, ...data } };
};

/** The same for a colour. */
const replaceColor = (color: TEntityColor, current: TEntityColor | undefined) => {
	const { data, ...fields } = color;
	const cleared = Object.fromEntries(Object.keys(current?.data ?? {}).map((key) => [key, null]));
	return { ...fields, data: { ...cleared, ...data } };
};

/**
 * Which of a part's lights copied light settings go to: the one named (a light
 * card's Paste), else the one with the same id and shape, else its only light
 * of that shape.
 */
const targetLight = (
	part: TAnyPart,
	copied: { lightId: string; shape: string },
	named?: string,
) => {
	const lights = part.lights ?? [];
	if (named) {
		return lights.find((light) => light.id === named && light.shape === copied.shape) ?? null;
	}
	const same = lights.find((light) => light.id === copied.lightId && light.shape === copied.shape);
	const ofShape = lights.filter((light) => light.shape === copied.shape);
	return same ?? (ofShape.length === 1 ? ofShape[0] : null);
};

export interface IPasteOptions {
	/** A light card's Paste: onto this light of each selected object. */
	lightId?: string;
	/** Only the light's schedule (Paste schedule only). */
	scheduleOnly?: boolean;
}

/**
 * Paste settings onto the selected objects that have the same thing, as one
 * undo step (ADR-0068): a light with the same id and shape, colours by id, a
 * shape onto objects of the same part. Says what it did, or why nothing.
 */
export const pasteSettings = (settings: TCopiedSettings, options: IPasteOptions = {}) => {
	const state = store();
	const commit: ICommitOptions = { coalesce: newId("paste") };
	const objects = selectedObjects();
	let pasted = 0;
	for (const { entity, part } of objects) {
		switch (settings.kind) {
			case "light": {
				const spec = targetLight(part, settings, options.lightId);
				if (!spec) {
					break;
				}
				const current = lightSettingsOf(part, entity.lights, spec.id).setting;
				state.setEntityLight(
					entity.id,
					spec.id,
					options.scheduleOnly
						? { whenOn: "schedule", schedule: settings.light.schedule ?? [], data: { on: null } }
						: replaceLight(settings.light, current),
					commit,
				);
				pasted++;
				break;
			}
			case "colors": {
				const ids = part.colors.filter((spec) => settings.colors[spec.id]);
				for (const spec of ids) {
					state.setEntityColor(
						entity.id,
						spec.id,
						replaceColor(settings.colors[spec.id], colorSettingOf(entity, spec.id)),
						commit,
					);
				}
				pasted += ids.length > 0 ? 1 : 0;
				break;
			}
			case "label": {
				// What it shows and where; its own title and description stay (they name it).
				state.updateEntity(
					entity.id,
					(e) => {
						e.label = settings.label && { ...settings.label, title: e.label?.title ?? e.name };
						e.details.dataKeys = [...settings.details.dataKeys];
					},
					commit,
				);
				pasted++;
				break;
			}
			case "motion": {
				if (!part.canFollowPath) {
					break;
				}
				// Along the copied road if this world has it, else the one it already drives; spaced out.
				const road = state.scene.roads.find((r) => r.id === settings.follow.roadId);
				const roadId = road?.id ?? entity.follow?.roadId;
				if (!roadId) {
					break;
				}
				const offset = settings.follow.offset + 3 * pasted;
				state.updateEntity(
					entity.id,
					(e) => {
						e.follow = { ...settings.follow, roadId, offset };
					},
					commit,
				);
				pasted++;
				break;
			}
			case "shape":
			case "object": {
				if (entity.kind !== settings.part) {
					break;
				}
				for (const [key, value] of Object.entries(settings.props)) {
					state.setEntityProp(entity.id, key, structuredClone(value), commit);
				}
				if (settings.kind === "object") {
					for (const spec of part.colors) {
						const color = settings.colors[spec.id];
						if (color) {
							state.setEntityColor(
								entity.id,
								spec.id,
								replaceColor(color, colorSettingOf(entity, spec.id)),
								commit,
							);
						}
					}
					for (const spec of part.lights ?? []) {
						const light = settings.lights[spec.id];
						if (light) {
							const current = lightSettingsOf(part, entity.lights, spec.id).setting;
							state.setEntityLight(entity.id, spec.id, replaceLight(light, current), commit);
						}
					}
					state.updateEntity(
						entity.id,
						(e) => {
							e.label = settings.label && { ...settings.label, title: e.label?.title ?? e.name };
							e.details.dataKeys = [...settings.details.dataKeys];
						},
						commit,
					);
				}
				pasted++;
				break;
			}
		}
	}

	const what = settingsName(settings);
	if (objects.length === 0) {
		notify(`Select something to paste ${what} onto`);
		return;
	}
	if (pasted === 0) {
		const needs =
			settings.kind === "light"
				? `a ${settings.shape} light like “${settings.name}”`
				: settings.kind === "shape" || settings.kind === "object"
					? `the same part (${partNameOf(settings.part) ?? settings.part})`
					: settings.kind === "motion"
						? "a road to drive along"
						: "those colours";
		notify(`Nothing selected takes ${what}`, `It needs ${needs}.`, "error");
		return;
	}
	notify(
		`Pasted ${options.scheduleOnly ? "the schedule" : what}`,
		pasted === objects.length
			? undefined
			: `Onto ${pasted} of the ${objects.length} selected objects; the others don't have it.`,
		"success",
	);
	const used =
		settings.kind === "light"
			? options.scheduleOnly
				? []
				: Object.values(settings.light.data).map((binding) => binding.key)
			: settings.kind === "motion"
				? []
				: dataKeysOf({
						colors: "colors" in settings ? settings.colors : undefined,
						lights: settings.kind === "object" ? settings.lights : undefined,
						label: "label" in settings ? settings.label : undefined,
						details: "details" in settings ? settings.details : undefined,
						props: "props" in settings ? settings.props : undefined,
						kind: "part" in settings ? settings.part : undefined,
					});
	warnAboutMissingData(missingDataKeys(used));
};

/**
 * Paste copied things into this world, selected, as one undo step (ADR-0068).
 * They go through the scene's repair like any world from outside, get new ids
 * (vehicles keep driving a road pasted with them), and land where they were,
 * a step over if their originals are still here, or centred on `at`, kept on
 * the ground.
 */
const pasteThings = (
	clip: { entities: unknown[]; roads: unknown[]; areas: unknown[] },
	at?: TVec2,
) => {
	const state = store();
	const { scene: repaired } = parseOrRepairScene({
		version: SCENE_VERSION,
		entities: clip.entities,
		roads: clip.roads,
		areas: clip.areas,
	});
	const { entities, roads, areas } = repaired;
	if (entities.length + roads.length + areas.length === 0) {
		notify(
			"Nothing to paste",
			"What was copied couldn't be read as objects, roads or areas.",
			"error",
		);
		return;
	}
	const current = state.scene;
	const here = [
		...entities.filter((e) => current.entities.some((c) => c.id === e.id)),
		...roads.filter((r) => current.roads.some((c) => c.id === r.id)),
		...areas.filter((a) => current.areas.some((c) => c.id === a.id)),
	].length;
	// Where to put them: centred on the clicked point, or a step over if the originals are here.
	const spots = [
		...entities.map((e) => e.position),
		...roads.flatMap((r) => r.points),
		...areas.flatMap((a) => a.points),
	];
	const xs = spots.map((spot) => spot[0]);
	const zs = spots.map((spot) => spot[1]);
	const [dx, dz] = at
		? [
				at[0] - (Math.min(...xs) + Math.max(...xs)) / 2,
				at[1] - (Math.min(...zs) + Math.max(...zs)) / 2,
			]
		: here > 0
			? [1, 1]
			: [0, 0];
	const { width, depth } = current.ground;
	const place = (x: number, z: number): TVec2 => [
		round(clamp(x + dx, -width / 2, width / 2)),
		round(clamp(z + dz, -depth / 2, depth / 2)),
	];

	// Named like copies: kept where the name is free, else as the preference says (scene/naming).
	const style = readPreferences().namesOfCopies;
	const roadName = copyNamer(
		current.roads.map((road) => road.name),
		style,
	);
	const areaName = copyNamer(
		current.areas.map((area) => area.name),
		style,
	);
	const entityName = copyNamer(
		current.entities.map((entity) => entity.name),
		style,
	);
	const roadIds = new Map(roads.map((road) => [road.id, newId("road")]));
	const newRoads = roads.map(
		(road): TRoad => ({
			...road,
			id: roadIds.get(road.id) ?? newId("road"),
			name: roadName(road.name),
			points: road.points.map((point) => {
				const [x, z] = place(point[0], point[1]);
				return point[3] === undefined ? [x, z, point[2]] : [x, z, point[2], point[3]];
			}),
		}),
	);
	const newAreas = areas.map(
		(area): TArea => ({
			...area,
			id: newId("area"),
			name: areaName(area.name),
			points: area.points.map((point) => {
				const [x, z] = place(point[0], point[1]);
				return cornerWithLift(x, z, cornerLift(point));
			}),
		}),
	);
	const newEntities = entities.map((entity): TEntity => {
		const roadId = entity.follow && (roadIds.get(entity.follow.roadId) ?? entity.follow.roadId);
		const roadExists =
			roadId &&
			(roadIds.has(entity.follow?.roadId ?? "") || current.roads.some((r) => r.id === roadId));
		const position = place(entity.position[0], entity.position[1]);
		const pasted: TEntity = {
			...entity,
			id: newId(entity.kind),
			position,
			// Pasted at a spot, placed there: as high above the ground as where it was copied, pasted
			// areas included; a step over, at its height, like a copy (ADR-0098).
			elevation: at
				? elevationMovedTo(
						[...current.areas, ...areas],
						entity.elevation,
						entity.position,
						position,
						[...current.areas, ...newAreas],
					)
				: entity.elevation,
			// Driving a road that isn't here (from another world): parked where it was instead.
			follow: entity.follow && roadId && roadExists ? { ...entity.follow, roadId } : null,
		};
		renameEntity(pasted, entityName(entity.name));
		return pasted;
	});

	state.commit((scene) => {
		scene.entities.push(...newEntities);
		scene.roads.push(...newRoads);
		scene.areas.push(...newAreas);
	});
	state.selectItems([
		...newAreas.map((area): ISceneItem => ({ kind: "area", id: area.id })),
		...newRoads.map((road): ISceneItem => ({ kind: "road", id: road.id })),
		...newEntities.map((entity): ISceneItem => ({ kind: "entity", id: entity.id })),
	]);
	const dropped =
		clip.entities.length +
		clip.roads.length +
		clip.areas.length -
		(entities.length + roads.length + areas.length);
	notify(
		`Pasted ${describeThings({ entities: newEntities.length, roads: newRoads.length, areas: newAreas.length })}`,
		dropped > 0 ? "Some of what was copied couldn't be read and was left out." : undefined,
		"success",
	);
	warnAboutMissingData(missingDataKeys(newEntities.flatMap(dataKeysOf)));
};

/** What clipboard text holds, if it's something copied from this app (or written like it). */
export const readClip = (text: string) => {
	try {
		const result = ClipSchema.safeParse(JSON.parse(text));
		return result.success ? result.data : null;
	} catch {
		return null;
	}
};

/**
 * Paste clipboard text (Ctrl+V, or a menu's Paste): things into the world
 * (centred on `at` from the ground's menu), settings onto the selection.
 */
export const pasteText = (text: string, options: IPasteOptions & { at?: TVec2 } = {}) => {
	const clip = readClip(text);
	if (!clip) {
		notify(
			"Nothing to paste",
			`The clipboard doesn't hold objects or settings copied from ${APP_NAME}.`,
			"error",
		);
		return;
	}
	if (clip.type === "things") {
		pasteThings(clip, options.at);
	} else {
		pasteSettings(clip.settings, options);
	}
};

/**
 * Read the system clipboard and paste it (a menu's Paste). Browsers may ask
 * for permission first; without it, Ctrl+V still works.
 */
export const pasteFromClipboard = async (options: IPasteOptions & { at?: TVec2 } = {}) => {
	let text: string;
	try {
		text = await navigator.clipboard.readText();
	} catch {
		notify(
			"The browser didn't let the page read the clipboard",
			"Press Ctrl+V instead (with the objects to paste onto selected).",
			"error",
		);
		return;
	}
	pasteText(text, options);
};
