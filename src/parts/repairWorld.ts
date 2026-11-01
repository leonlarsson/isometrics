import { upgradeLegacyIds } from "#/scene/legacy";
import { parseOrRepairScene } from "#/scene/repair";
import { safeJson } from "#/scene/safeJson";

import { getPart, type TAnyPart } from "./registry";

/**
 * The one way to read a world from untrusted JSON: storage, a file, a paste
 * or an AI (ADR-0104). Old ids, names and places of fields come up to date
 * (`upgradeLegacyIds`), then what only the parts know (`upgradePartSettings`),
 * then it's parsed, or repaired if it still doesn't validate (ADR-0026). What
 * comes out is in the current shape, so nothing reads old shapes at draw time.
 */
export const repairWorld = (input: unknown) => parseOrRepairScene(upgradeWorld(input));

/** A world's old names and shapes brought up to date, before it's parsed (validateWorld reads this too). */
export const upgradeWorld = (input: unknown) =>
	// A safe copy first (ADR-0119): no prototype keys, no nesting deep enough to overflow.
	upgradePartSettings(upgradeLegacyIds(safeJson(input)));

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Old keys under their new names, in place: a value under the new name wins,
 * and of several old names for it, the latest listed (as `renamedProps` says).
 */
const renameKeys = (record: TRecord, names: Readonly<Record<string, string>>) => {
	const present = new Set(Object.keys(record));
	for (const [from, to] of Object.entries(names)) {
		if (!Object.hasOwn(record, from)) {
			continue;
		}
		if (!present.has(to)) {
			record[to] = record[from];
		}
		delete record[from];
	}
};

/** The record under `key`, made if it isn't one. */
const groupOf = (record: TRecord, key: string): TRecord => {
	const group = record[key];
	if (isRecord(group)) {
		return group;
	}
	const made: TRecord = {};
	record[key] = made;
	return made;
};

/**
 * The colours older worlds kept in `color` and `accent` (ADR-0060): into the
 * colour settings of the part's colours marked with that legacy, unless set there.
 */
const upgradeColors = (entity: TRecord, part: TAnyPart | undefined) => {
	for (const spec of part?.colors ?? []) {
		const old = spec.legacy ? entity[spec.legacy] : undefined;
		if (typeof old === "string") {
			const setting = groupOf(groupOf(entity, "colors"), spec.id);
			setting.color ??= old;
		}
	}
	delete entity.color;
	delete entity.accent;
};

/**
 * Lights: one mode older worlds had for all of them (`lights: "on"`) as each
 * light's `whenOn`, renamed light ids under their new ones, and settings a light
 * took from props or the accent before it had its own (its `legacy` hook).
 */
const upgradeLights = (entity: TRecord, part: TAnyPart | undefined, props: TRecord) => {
	const mode = entity.lights;
	const lights: TRecord = isRecord(mode) ? mode : {};
	entity.lights = lights;
	renameKeys(lights, part?.renamedLights ?? {});
	const accent = typeof entity.accent === "string" ? entity.accent : null;
	for (const spec of part?.lights ?? []) {
		const fromOlder = spec.legacy?.({ props, accent }) ?? {};
		const settings = {
			...(mode === "on" || mode === "off" ? { whenOn: mode } : {}),
			...Object.fromEntries(Object.entries(fromOlder).filter(([, value]) => value != null)),
		};
		if (Object.keys(settings).length === 0) {
			continue;
		}
		const light = groupOf(lights, spec.id);
		for (const [field, value] of Object.entries(settings)) {
			light[field] ??= value;
		}
	}
};

/** Renamed props under their new names (a value under the new name wins), and props folded into `scale`. */
const upgradeProps = (entity: TRecord, part: TAnyPart, props: TRecord) => {
	renameKeys(props, part.renamedProps ?? {});
	for (const key of part.foldedIntoScale ?? []) {
		const size = props[key];
		delete props[key];
		if (typeof size === "number" && size > 0) {
			const scale = typeof entity.scale === "number" ? entity.scale : 1;
			entity.scale = Math.min(10, Math.max(0.1, scale * size));
		}
	}
};

/**
 * Settings of objects that only their parts can bring up to date. Works on a
 * world `upgradeLegacyIds` returned (a copy), in place; anything else passes through.
 */
export const upgradePartSettings = (input: unknown): unknown => {
	if (!isRecord(input) || !Array.isArray(input.entities)) {
		return input;
	}
	for (const entity of input.entities.filter(isRecord)) {
		const part = typeof entity.kind === "string" ? getPart(entity.kind) : undefined;
		const props = isRecord(entity.props) ? entity.props : {};
		// Lights first: their legacy hooks read the accent and the props as they were saved.
		upgradeLights(entity, part, props);
		upgradeColors(entity, part);
		if (part && isRecord(entity.props)) {
			upgradeProps(entity, part, entity.props);
		}
	}
	return input;
};
