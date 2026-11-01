import type { z } from "zod";

import { describeRepairs } from "#/scene/repair";
import { cellOf, columnOfKey } from "#/scene/rowData";
import { SceneSchema, type TDataBinding, type TScene } from "#/scene/schema";
import { applyWorldPatch, describePatchChanges } from "#/scene/worldPatch";

import { getPart, resolveProps } from "./registry";
import { repairWorld, upgradeWorld } from "./repairWorld";

/**
 * Checking a world (ADR-0117): what's wrong in it and where, in words an AI
 * or a person can act on. The same check answers POST /api/worlds/validate and runs on a
 * world pasted back into Build with your AI. **Problems** are what opening it
 * would repair (reset to a default) or leave out; **warnings** are what opens
 * but won't look as meant (a part kind that doesn't exist, a card value that
 * reads nothing, an object off the ground). No React.
 */

export interface IWorldIssue {
	/** Where, as a path with ids: `entities[2] "shop_north".props.floorCount`. */
	where: string;
	what: string;
}

export interface IWorldValidation {
	/** No problems: it opens exactly as written (warnings can still say it won't look as meant). */
	isValid: boolean;
	/** Couldn't be read as a world at all (not an object, no version or things). */
	isUnreadable: boolean;
	problems: IWorldIssue[];
	warnings: IWorldIssue[];
	/** What opening it repairs, in a sentence, or null when nothing. */
	repairs: string | null;
	/** What's in it once opened, for a quick look: "12 objects, 3 roads". */
	contents: string;
	/** For a patch (ADR-0118): what it changes, in a sentence. */
	changes?: string;
}

/** More objects or table rows than these make a world slow and big to keep: said as a warning. */
const MOST_OBJECTS = 20_000;
const MOST_ROWS = 100_000;

/** More issues than this of one sort are summed up, not listed. */
const MOST_ISSUES = 40;

const LISTS = ["entities", "roads", "areas", "fences", "viewpoints", "moods"] as const;

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A path with each list entry named by its id where it has one. */
const pathWithIds = (root: unknown, path: readonly PropertyKey[]) => {
	let at: unknown = root;
	let text = "";
	for (const key of path) {
		if (typeof key === "number") {
			const entry = Array.isArray(at) ? at[key] : undefined;
			const id = isRecord(entry) ? (entry.id ?? entry.key) : undefined;
			text += `[${key}]${typeof id === "string" ? ` "${id}"` : ""}`;
		} else {
			text += `${text ? "." : ""}${String(key)}`;
		}
		at = isRecord(at) || Array.isArray(at) ? (at as TRecord)[key as string] : undefined;
	}
	return text || "(the world)";
};

/** Zod's issues as problems, said plainly. */
const schemaProblems = (root: unknown, issues: readonly z.core.$ZodIssue[]): IWorldIssue[] =>
	issues.map((issue) => ({ where: pathWithIds(root, issue.path), what: issue.message }));

/** The value and row keys something in the world can read, for checking what it reads. */
const readableKeys = (scene: TScene, row: TScene["entities"][number]["dataRow"]) => {
	const keys = new Set(scene.data.values.map((value) => value.key));
	const table = row ? scene.data.tables.find((each) => each.key === row.tableKey) : undefined;
	for (const column of table?.columns ?? []) {
		keys.add(`row.${column.key}`);
	}
	return { keys, table };
};

/** What opens but won't look as meant. */
const worldWarnings = (scene: TScene): IWorldIssue[] => {
	const warnings: IWorldIssue[] = [];
	const warn = (where: string, what: string) => warnings.push({ where, what });
	const halfWidth = scene.ground.width / 2;
	const halfDepth = scene.ground.depth / 2;
	const bindingsRead = (
		where: string,
		bindings: Readonly<Record<string, TDataBinding | null | undefined>>,
		keys: Set<string>,
	) => {
		for (const [setting, binding] of Object.entries(bindings)) {
			if (binding && !keys.has(binding.key)) {
				warn(
					`${where}.data.${setting}`,
					`follows "${binding.key}", which isn't a value of the world${columnOfKey(binding.key) ? " or a column of its row's table" : ""}: it's drawn as set by hand`,
				);
			}
		}
	};
	const rowRead = (where: string, row: TScene["entities"][number]["dataRow"]) => {
		if (!row) {
			return;
		}
		const table = scene.data.tables.find((each) => each.key === row.tableKey);
		if (!table) {
			warn(`${where}.dataRow`, `follows table "${row.tableKey}", which the world doesn't have`);
		} else if (
			!table.rows.some((each) => String(cellOf(each, table.keyColumn) ?? "") === row.rowKey)
		) {
			warn(
				`${where}.dataRow`,
				`follows row "${row.rowKey}", which table "${row.tableKey}" doesn't have (by its ${table.keyColumn} column): it shows no data`,
			);
		}
	};

	scene.entities.forEach((entity, index) => {
		const where = `entities[${index}] "${entity.id}"`;
		const part = getPart(entity.kind);
		if (!part) {
			warn(`${where}.kind`, `"${entity.kind}" isn't a part kind: it's drawn as a placeholder box`);
			return;
		}
		const known = new Set(Object.keys(part.schema.parse({}) as TRecord));
		for (const prop of Object.keys(entity.props)) {
			if (!known.has(prop)) {
				warn(
					`${where}.props.${prop}`,
					`${part.kind} has no prop "${prop}": it's kept but does nothing`,
				);
			}
		}
		for (const id of Object.keys(entity.colors)) {
			if (!part.colors.some((color) => color.id === id)) {
				warn(`${where}.colors.${id}`, `${part.kind} has no colour "${id}"`);
			}
		}
		rowRead(where, entity.dataRow);
		const { keys } = readableKeys(scene, entity.dataRow);
		for (const key of [...entity.label.dataKeys, ...entity.details.dataKeys]) {
			if (!keys.has(key)) {
				warn(`${where}.label`, `shows "${key}", which reads nothing: it says no data`);
			}
		}
		bindingsRead(where, entity.data, keys);
		// Standing over the ground's edge, floating on nothing.
		if (!entity.follow && !part.flat && part.category !== "markers") {
			// Its footprint turned as it stands: how far it reaches along x and along z.
			const [width, depth] = part.footprint(resolveProps(part, entity.props));
			const turn = (entity.rotation[1] * Math.PI) / 180;
			const cos = Math.abs(Math.cos(turn));
			const sin = Math.abs(Math.sin(turn));
			const reachX = ((width * cos + depth * sin) / 2) * entity.scale;
			const reachZ = ((width * sin + depth * cos) / 2) * entity.scale;
			const [x, z] = entity.position;
			if (Math.abs(x) + reachX > halfWidth + 0.05 || Math.abs(z) + reachZ > halfDepth + 0.05) {
				warn(
					`${where}.position`,
					`[${x}, ${z}] is over the ground's edge (it's ${scene.ground.width} × ${scene.ground.depth}, centred on 0, 0): it floats on nothing`,
				);
			}
		}
	});

	scene.roads.forEach((road, index) => {
		const where = `roads[${index}] "${road.id}"`;
		if (road.flow.isOn && !getPart(road.flow.vehicleKind)) {
			warn(`${where}.flow.vehicleKind`, `"${road.flow.vehicleKind}" isn't a part kind`);
		}
		rowRead(where, road.dataRow);
		bindingsRead(where, road.data, readableKeys(scene, road.dataRow).keys);
	});

	scene.data.tables.forEach((table, index) => {
		if (!table.columns.some((column) => column.key === table.keyColumn)) {
			warn(
				`data.tables[${index}] "${table.key}".keyColumn`,
				`"${table.keyColumn}" isn't one of its columns: rows can't be followed by name`,
			);
		}
	});

	// Very big worlds open, but slowly, and may not fit in the browser's storage (ADR-0119).
	if (scene.entities.length > MOST_OBJECTS) {
		warn(
			"entities",
			`${scene.entities.length.toLocaleString("en")} objects, more than ${MOST_OBJECTS.toLocaleString("en")}: it may be slow, and too big to keep in this browser`,
		);
	}
	const rows = scene.data.tables.reduce(
		(sum, table) =>
			sum + table.rows.length + table.history.reduce((all, past) => all + past.rows.length, 0),
		0,
	);
	if (rows > MOST_ROWS) {
		warn(
			"data.tables",
			`${rows.toLocaleString("en")} table rows (their pasts included), more than ${MOST_ROWS.toLocaleString("en")}: it may be slow, and too big to keep in this browser`,
		);
	}
	const opening = scene.camera.openingViewpointId;
	if (opening && !scene.viewpoints.some((viewpoint) => viewpoint.id === opening)) {
		warn("camera.openingViewpointId", `"${opening}" isn't one of its viewpoints`);
	}
	for (const key of scene.onScreen.tileKeys) {
		if (!scene.data.values.some((value) => value.key === key)) {
			warn("onScreen.tileKeys", `"${key}" isn't a value of the world: its tile says no data`);
		}
	}
	return warnings;
};

/** Ids used twice in a list: opening keeps the first. */
const duplicateIds = (raw: TRecord): IWorldIssue[] =>
	LISTS.flatMap((list) => {
		const items = raw[list];
		if (!Array.isArray(items)) {
			return [];
		}
		const seen = new Set<unknown>();
		return items.flatMap((item, index) => {
			const id = isRecord(item) ? item.id : undefined;
			if (id === undefined) {
				return [];
			}
			if (seen.has(id)) {
				return [
					{
						where: `${list}[${index}]`,
						what: `id "${String(id)}" is used twice: this one is left out`,
					},
				];
			}
			seen.add(id);
			return [];
		});
	});

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** At most MOST_ISSUES, the rest summed up. */
const capped = (issues: IWorldIssue[]) =>
	issues.length <= MOST_ISSUES
		? issues
		: [
				...issues.slice(0, MOST_ISSUES),
				{ where: "…", what: `and ${issues.length - MOST_ISSUES} more like these` },
			];

/** Check a world: what's wrong and where, and what opening it would do. */
export const validateWorld = (input: unknown): IWorldValidation => {
	if (!isRecord(input)) {
		return {
			isValid: false,
			isUnreadable: true,
			problems: [{ where: "(the world)", what: "a world is a JSON object, starting with {" }],
			warnings: [],
			repairs: null,
			contents: "",
		};
	}
	let read: ReturnType<typeof repairWorld>;
	try {
		read = repairWorld(structuredClone(input));
	} catch (error) {
		return {
			isValid: false,
			isUnreadable: true,
			problems: [
				{ where: "(the world)", what: error instanceof Error ? error.message : String(error) },
			],
			warnings: [],
			repairs: null,
			contents: "",
		};
	}
	const { scene, report } = read;
	// Its problems as written, once old names are brought up to date (those aren't problems).
	const upgraded = upgradeWorld(structuredClone(input));
	const strict = report ? SceneSchema.safeParse(upgraded) : null;
	const problems = [
		...(strict && !strict.success ? schemaProblems(upgraded, strict.error.issues) : []),
		...(isRecord(upgraded) ? duplicateIds(upgraded) : []),
	];
	if (report && problems.length === 0) {
		problems.push({ where: "(the world)", what: describeRepairs(report) });
	}
	return {
		isValid: report === null && problems.length === 0,
		isUnreadable: false,
		problems: capped(problems),
		warnings: capped(worldWarnings(scene)),
		repairs: report ? describeRepairs(report) : null,
		contents: [
			plural(scene.entities.length, "object"),
			plural(scene.roads.length, "road"),
			plural(scene.areas.length, "area"),
			scene.data.tables.length > 0 && plural(scene.data.tables.length, "data table"),
			scene.data.values.length > 0 && plural(scene.data.values.length, "data value"),
		]
			.filter(Boolean)
			.join(", "),
	};
};

/**
 * Check a patch (ADR-0118) against the world it changes: its own problems
 * (an id that isn't there, a list sent whole), said where they are in the
 * patch, then the world it makes, checked like any world, and what it changes.
 */
export const validatePatch = (world: TScene, patch: Record<string, unknown>): IWorldValidation => {
	const { world: patched, issues, changes } = applyWorldPatch(world, patch);
	const check = validateWorld(patched);
	const patchProblems = issues.map((issue) => ({
		where: `patch ${issue.where}`,
		what: issue.what,
	}));
	return {
		...check,
		isValid: check.isValid && patchProblems.length === 0,
		problems: capped([...patchProblems, ...check.problems]),
		changes: describePatchChanges(changes),
	};
};

/** A check as a message to send back to an AI: fix these, and send the whole world again. */
export const issuesForAi = (check: IWorldValidation) =>
	[
		check.changes
			? "The patch you wrote doesn't apply cleanly. Fix these and send the whole patch again, as JSON only:"
			: "The world you wrote doesn't open as written. Fix these and send the whole world again, as JSON only:",
		...[...check.problems, ...check.warnings].map((issue) => `- ${issue.where}: ${issue.what}`),
	].join("\n");
