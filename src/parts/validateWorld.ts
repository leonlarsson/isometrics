import type { z } from "zod";

import { isRecord, type TRecord } from "#/lib/record";
import {
	FLOW_EASE_LENGTH,
	flowDrivesOn,
	flowVehicleLength,
	shortestRoadForFlow,
} from "#/scene/flows";
import { plural } from "#/scene/format";
import { ALTITUDE_GAP, roadNetworkOf } from "#/scene/junctions";
import { networkEntries, waysOut } from "#/scene/network";
import { describeRepairs } from "#/scene/repair";
import { isHiddenRoute, polylineLength, roadCenterlineOf, steepestGrade } from "#/scene/roads";
import { cellOf, columnOfKey } from "#/scene/rowData";
import { SceneSchema, type TDataBinding, type TEntity, type TScene } from "#/scene/schema";
import { applyWorldPatch, describePatchChanges } from "#/scene/worldPatch";

import { bodiesOf, objectsInEachOther, objectsOnRoads, reachAlongXAndZ } from "./bodies";
import { partIn } from "./prefabParts";
import { getBasePart, getPart, resolveProps, type TAnyPart } from "./registry";
import { repairWorld, upgradeWorld } from "./repairWorld";

/**
 * Checking a world (ADR-0117): what's wrong in it and where, in words an AI
 * or a person can act on. The same check answers POST /api/worlds/validate and runs on a
 * world pasted back into Build with AI. **Problems** are what opening it
 * would repair (reset to a default) or leave out; **warnings** are what opens
 * but won't look as meant (a part kind that doesn't exist, a card value that
 * reads nothing, an object off the ground, objects inside each other or on a
 * road, a flow on a road too short for it, joined at a junction or set to
 * drive on without one). Some are
 * meant, so they're never problems. No React.
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

/** The steepest a one-way road (a carriageway or ramp) may climb before validate says so (ADR-0148). */
const STEEPEST_RAMP = 0.12;

/** A road's settings in `road.data` that set how many vehicles its flow has (ADR-0112). */
const FLOW_DATA_SETTINGS = ["vehicleDensity", "vehicleCountAlong", "vehicleCountAgainst"];

/** More issues than this of one sort are summed up, not listed. */
const MOST_ISSUES = 40;

/** More than these objects in each other, or on roads, are summed up, so other sorts still show. */
const MOST_OF_A_SORT = 10;

const LISTS = [
	"entities",
	"roads",
	"junctions",
	"areas",
	"fences",
	"prefabs",
	"viewpoints",
	"moods",
] as const;

/** A distance as it's said: to a tenth, or a hundredth below 1 (0.05, 1.5, 12). */
const roughly = (distance: number) => String(Number(distance.toFixed(distance < 1 ? 2 : 1)));

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

const propsKnown = new WeakMap<TAnyPart, Set<string>>();

/** The props a part has, read from its schema once (big worlds have a thousand objects). */
const propsOf = (part: TAnyPart) => {
	let props = propsKnown.get(part);
	if (!props) {
		props = new Set(Object.keys(part.schema.parse({}) as TRecord));
		propsKnown.set(part, props);
	}
	return props;
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
		const part = partIn(entity.kind, scene.prefabs);
		if (!part) {
			warn(`${where}.kind`, `"${entity.kind}" isn't a part kind: it's drawn as a placeholder box`);
			return;
		}
		const known = propsOf(part);
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
			const reaches = bodiesOf(entity, part).map(reachAlongXAndZ);
			const reachX = Math.max(0, ...reaches.map((reach) => reach[0]));
			const reachZ = Math.max(0, ...reaches.map((reach) => reach[1]));
			const [x, z] = entity.position;
			if (Math.abs(x) + reachX > halfWidth + 0.05 || Math.abs(z) + reachZ > halfDepth + 0.05) {
				warn(
					`${where}.position`,
					`[${x}, ${z}] is over the ground's edge (it's ${scene.ground.width} × ${scene.ground.depth}, centred on 0, 0): it floats on nothing`,
				);
			}
		}
	});

	// A prefab's pieces (ADR-0134): parts this version has, reading data the world has.
	scene.prefabs.forEach((prefab, index) => {
		const where = `prefabs[${index}] "${prefab.id}"`;
		const { keys } = readableKeys(scene, null);
		// "row.<column>" reads the row a copy follows, which differs from copy to copy.
		const readable = (key: string) => keys.has(key) || key.startsWith("row.");
		prefab.entities.forEach((piece, pieceIndex) => {
			const at = `${where}.entities[${pieceIndex}] "${piece.id}"`;
			if (!getBasePart(piece.kind)) {
				warn(`${at}.kind`, `"${piece.kind}" isn't a part kind: that piece isn't drawn`);
			}
			bindingsRead(
				at,
				Object.fromEntries(Object.entries(piece.data).filter(([, b]) => !readable(b.key))),
				keys,
			);
		});
	});

	// Objects standing inside each other (one pair once), and on roads (ADR-0117).
	const partOf = (kind: string) => partIn(kind, scene.prefabs);
	const indexOf = new Map(scene.entities.map((entity, index) => [entity, index]));
	const entityAt = (entity: TEntity) => `entities[${indexOf.get(entity)}] "${entity.id}"`;
	// Asked for one more than are listed, so a world of thousands in one place isn't millions of pairs.
	const inEachOther = objectsInEachOther(scene.entities, partOf, MOST_OF_A_SORT + 1);
	for (const { a, b, overlap } of inEachOther.slice(0, MOST_OF_A_SORT)) {
		warn(
			`${entityAt(a)}.position`,
			`stands inside "${b.id}": they overlap by ${roughly(overlap)} where their heights meet, so one shows through the other. Move them apart (an object takes up its part's footprint, times its scale, round its position), or stand one on the other with its \`altitude\` at the other's top`,
		);
	}
	if (inEachOther.length > MOST_OF_A_SORT) {
		warn("entities", "and more objects inside each other");
	}
	// Its edge reaching over the road's is how a lamp or a bench stands at the kerb.
	const onRoads = objectsOnRoads(scene.entities, scene.roads, partOf).filter(
		(found) => found.isMiddleOnRoad || found.onRoadShare >= 0.5,
	);
	for (const { entity, road, isMiddleOnRoad } of onRoads.slice(0, MOST_OF_A_SORT)) {
		warn(
			`${entityAt(entity)}.position`,
			`[${entity.position.join(", ")}] is on road "${road.id}" (${isMiddleOnRoad ? "its middle" : "most of it"}): vehicles on the road drive through it. Move it beside the road, whose surface reaches half its \`width\` either side of the line through its points`,
		);
	}
	if (onRoads.length > MOST_OF_A_SORT) {
		warn("entities", `and ${plural(onRoads.length - MOST_OF_A_SORT, "more object")} on roads`);
	}

	const joinedRoads = new Set(
		scene.junctions.flatMap((junction) => junction.ends.map((end) => end.roadId)),
	);
	const network = roadNetworkOf(scene.roads, scene.junctions);
	scene.roads.forEach((road, index) => {
		const where = `roads[${index}] "${road.id}"`;
		const vehicle = road.flow.enabled ? getPart(road.flow.vehicleKind) : undefined;
		if (road.flow.enabled && !vehicle) {
			warn(`${where}.flow.vehicleKind`, `"${road.flow.vehicleKind}" isn't a part kind`);
		}
		// A flow (ADR-0112) is drawn on its own road: too short a road, or one that's joined, won't show it as meant.
		if (road.flow.enabled && !road.isHidden) {
			// Driving on (ADR-0147), its vehicles shrink nowhere: they grow in once and drive the network.
			const drivesOn = flowDrivesOn(network, road);
			if (vehicle && !drivesOn) {
				const vehicleLength = flowVehicleLength(
					road.flow,
					vehicle.footprint(resolveProps(vehicle, {}))[0],
				);
				const length = polylineLength(roadCenterlineOf(road), road.loops);
				const needed = shortestRoadForFlow(vehicleLength);
				if (length < needed) {
					warn(
						`${where}.flow`,
						`the road is ${roughly(length)} long, too short for its flow's vehicles to reach full size: they grow in and shrink out over ${FLOW_EASE_LENGTH} at each end, and a ${vehicle.kind} at this flow's size is ${roughly(vehicleLength)} long, so it takes a road of at least ${roughly(needed)}. Make the road longer, or show this amount on a longer one`,
					);
				}
			}
			// A flow whose amount follows data shows what it's for; one that doesn't is likely meant as traffic.
			const followsData = FLOW_DATA_SETTINGS.some((setting) => road.data[setting]);
			if (joinedRoads.has(road.id) && !followsData && !road.flow.drivesThroughJunctions) {
				warn(
					`${where}.flow`,
					"the road is joined at a junction, but its flow's vehicles stay on this road and shrink at its ends. A flow shows an amount from data (a from, to, amount table); for background traffic that drives on through junctions, turn on its `flow.drivesThroughJunctions`, or place vehicle objects that follow the road (`follow`) for particular vehicles",
				);
			}
			if (road.flow.drivesThroughJunctions && !network.connects(road.id)) {
				warn(
					`${where}.flow.drivesThroughJunctions`,
					"is on, but the road has no junction at either end, so its flow's vehicles stay on it. Connect it to another road (`junctions`) for them to drive on",
				);
			}
		}
		// A carriageway or ramp (one-way, ADR-0148) steeper than any real one reads as a wall.
		if (road.isOneWay && !isHiddenRoute(road.kind)) {
			const steepest = steepestGrade(road);
			if (steepest.grade > STEEPEST_RAMP) {
				warn(
					`${where}.points`,
					`climbs ${Math.round(steepest.grade * 100)}% about ${roughly(steepest.along)} along it, steeper than a ramp should be (motorway ramps climb about 6%, ${Math.round(STEEPEST_RAMP * 100)}% at most). Lengthen the ramp: spread its rise over more distance`,
				);
			}
		}
		// Vehicles reach a one-way road's dead end and start over at an entry to the network, an open
		// road end traffic drives in by (ADR-0148); where none leads to this road, they start over
		// where they began, appearing from nowhere.
		if (
			road.isOneWay &&
			!road.loops &&
			network.connects(road.id) &&
			!network.junctionAt(road.id, "end") &&
			networkEntries(network, road.id).length === 0
		) {
			warn(
				`${where}.points`,
				`one-way road "${road.id}" leads to a dead end, but no road drives into its network from an open end: vehicles reaching its end start over where they began, appearing from nowhere (at a junction or mid-road). Give the network an entry: a road whose first point (or, for a two-way road, either end) is at no junction, best at the ground's edge`,
			);
		}
		rowRead(where, road.dataRow);
		bindingsRead(where, road.data, readableKeys(scene, road.dataRow).keys);
	});

	// Junctions (ADR-0136): their ends must be roads' open ends, at one place.
	const roadsById = new Map(scene.roads.map((road) => [road.id, road]));
	scene.junctions.forEach((junction, index) => {
		const where = `junctions[${index}] "${junction.id}"`;
		let place: readonly number[] | null = null;
		let joined = 0;
		const seen = new Set<string>();
		junction.ends.forEach((end, endIndex) => {
			const at = `${where}.ends[${endIndex}]`;
			const road = roadsById.get(end.roadId);
			if (!road) {
				warn(at, `road "${end.roadId}" doesn't exist: this end is left out`);
				return;
			}
			if (road.loops) {
				warn(at, `road "${end.roadId}" loops, so it has no ends: this end is left out`);
				return;
			}
			if (seen.has(`${end.roadId}:${end.end}`)) {
				warn(at, `the ${end.end} of road "${end.roadId}" is listed twice`);
				return;
			}
			seen.add(`${end.roadId}:${end.end}`);
			const point = end.end === "start" ? road.points[0] : road.points[road.points.length - 1];
			if (place === null) {
				place = point;
			} else {
				const gap = Math.hypot(point[0] - place[0], point[1] - place[1]);
				if (gap > Math.max(road.width, 0.5)) {
					warn(
						at,
						`the ${end.end} of road "${end.roadId}" is ${gap.toFixed(1)} from the junction's first end: it's left out (put it at the same x, z and altitude)`,
					);
					return;
				}
				// A junction can't join roads at different altitudes (ADR-0148): it would draw a wall.
				const rise = point[2] - place[2];
				if (Math.abs(rise) > ALTITUDE_GAP) {
					warn(
						at,
						`the ${end.end} of road "${end.roadId}" is at altitude ${point[2].toFixed(1)}, ${Math.abs(rise).toFixed(1)} ${rise > 0 ? "above" : "below"} the junction's first end: it's left out (put it at the same altitude, or ramp the road to it)`,
					);
					return;
				}
				if (gap > 1e-6 || Math.abs(rise) > 1e-6) {
					warn(
						at,
						`the ${end.end} of road "${end.roadId}" isn't quite where the junction's first end is: put it at the same x, z and altitude`,
					);
				}
			}
			joined += 1;
		});
		if (joined < 2) {
			warn(where, "joins fewer than two road ends: it does nothing");
		}
		// The turns allowed from each end (ADR-0148), and one-way roads that lead into nothing.
		const built = network.junctions.find((each) => each.id === junction.id);
		junction.ends.forEach((end, endIndex) => {
			const at = `${where}.ends[${endIndex}]`;
			for (const to of end.leadsTo ?? []) {
				const there = junction.ends.some((e) => e.roadId === to.roadId && e.end === to.end);
				if (!there || (to.roadId === end.roadId && to.end === end.end)) {
					warn(
						`${at}.leadsTo`,
						`names the ${to.end} of road "${to.roadId}", which isn't another end of this junction: it's left out`,
					);
				} else if (roadsById.get(to.roadId)?.isOneWay && to.end === "end") {
					warn(
						`${at}.leadsTo`,
						`names the end of one-way road "${to.roadId}": vehicles never drive it against its way, so that turn is left out`,
					);
				}
			}
			const road = roadsById.get(end.roadId);
			const arrives = !(road?.isOneWay && end.end === "start");
			const own = built?.ends.find((e) => e.roadId === end.roadId && e.end === end.end);
			if (!built || !own || !arrives) {
				return;
			}
			const { ways } = waysOut(
				built,
				own,
				built.ends.filter((e) => e !== own),
			);
			if (ways.length === 0 && road?.isOneWay) {
				warn(
					at,
					`one-way road "${end.roadId}" leads into this junction, but no way out of it is allowed${end.leadsTo ? " (its leadsTo)" : " (every other road here is one-way towards it)"}: its vehicles vanish here and start again where they began. Connect a road leading on, or allow a turn`,
				);
			} else if (ways.length === 0 && end.leadsTo) {
				warn(
					`${at}.leadsTo`,
					`allows no way on, so vehicles arriving by road "${end.roadId}" turn round here`,
				);
			}
		});
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
