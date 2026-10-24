import type { TDataEntry, TEntity, TEntityLight, TLightMode } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { readColor, readScale, readSwitch, type TBindingKind } from "./dataBinding";
import type { ILightSpec, IResolvedLight, TColorDefault } from "./types";

/**
 * Lights as a shared model (ADR-0058): a part declares its lights
 * (`ILightSpec`), an object stores settings for some of them by id
 * (`TEntityLight`, everything null while it's as the part has it), and this
 * works out each light's state for drawing, reading data through
 * dataBinding.ts. No React here.
 */

/** What a part needs for its lights: their specs, and lights whose id changed. */
export interface IPartLights {
	lights?: readonly ILightSpec[];
	renamedLights?: Readonly<Record<string, string>>;
}

/** The world around a light right now. */
export interface ILightContext {
	/** For how dark it is (`night`, 0–1, with the world's light setting applied) and lamplight. */
	palette: IScenePalette;
	/** It drives along a road (lights with `when: "driving"` are only on then). */
	driving: boolean;
	/** The world's data, for lights switched or dimmed by a value. */
	data?: readonly TDataEntry[];
}

const resolveColor = (value: TColorDefault, palette: IScenePalette) =>
	typeof value === "function" ? value(palette) : value;

/** The most a light's strength goes to (300%). */
export const MAX_STRENGTH = 3;

/**
 * Which of a light's settings can follow data, and how each reads its value
 * (dataBinding.ts): switched on and off, a number, or a colour. To make another
 * setting follow data, add it here, read it in `resolveLight` and give it a
 * row in the Lights tab (DataBindingFields); saved worlds need nothing, since
 * a light's `data` is a map by setting.
 */
export const LIGHT_DATA = {
	on: "switch",
	strength: "scale",
	color: "color",
	litPanes: "scale",
} as const satisfies Record<string, TBindingKind>;

export type TLightDataTarget = keyof typeof LIGHT_DATA;

/**
 * The object's settings for one light: its own entry (or the one under the
 * light's old id), and, for worlds from before per-light settings, the one
 * mode they had for all its lights.
 */
export const lightSettingsOf = (
	part: IPartLights,
	stored: TEntity["lights"],
	id: string,
): { setting: TEntityLight | undefined; objectMode: TLightMode } => {
	if (typeof stored === "string") {
		return { setting: undefined, objectMode: stored };
	}
	const oldId = Object.entries(part.renamedLights ?? {}).find(([, to]) => to === id)?.[0];
	return {
		setting: stored[id] ?? (oldId === undefined ? undefined : stored[oldId]),
		objectMode: "auto",
	};
};

/** What a light is like before the world (darkness, driving, data) comes in: its settings in effect. */
export const lightDefaults = (
	spec: ILightSpec,
	entity: Pick<TEntity, "props" | "accent">,
	palette: IScenePalette,
) => {
	const legacy = spec.legacy?.({ props: entity.props, accent: entity.accent }) ?? {};
	return {
		color: legacy.color ?? resolveColor(spec.color ?? palette.lamplight, palette),
		strength: legacy.strength ?? spec.strength ?? 1,
		reach: legacy.reach ?? spec.reach ?? 1,
		litPanes: spec.litPanes ?? 1,
		weight: spec.weight ?? 1,
	};
};

/** One light as it is right now. */
export const resolveLight = (
	spec: ILightSpec,
	part: IPartLights,
	entity: Pick<TEntity, "props" | "accent" | "lights">,
	{ palette, driving, data }: ILightContext,
): IResolvedLight => {
	const { setting, objectMode } = lightSettingsOf(part, entity.lights, spec.id);
	const defaults = lightDefaults(spec, entity, palette);
	// Settings that follow data take the value when it reads as one; otherwise their own.
	const bound = setting?.data ?? {};
	const color = readColor(bound.color, data) ?? setting?.color ?? defaults.color;
	const reach = setting?.reach ?? defaults.reach;
	const litPanes =
		readScale(bound.litPanes, data, { max: 1 }) ?? setting?.litPanes ?? defaults.litPanes;
	const strength =
		readScale(bound.strength, data, { max: MAX_STRENGTH }) ??
		setting?.strength ??
		defaults.strength;

	let level: number;
	if (bound.on) {
		// Switched by a value: on while it says so, day and night (off without the value).
		level = readSwitch(bound.on, data) ? strength : 0;
	} else {
		const mode = setting?.mode ?? objectMode;
		level =
			mode === "off"
				? 0
				: mode === "on"
					? strength
					: spec.when === "driving" && !driving
						? 0
						: palette.night * strength;
	}
	return { on: level > 0, level, color, reach, litPanes, weight: defaults.weight };
};

/** Every light of a part on an object, by id, as it is right now. */
export const resolveLights = (
	part: IPartLights,
	entity: Pick<TEntity, "props" | "accent" | "lights">,
	context: ILightContext,
): Record<string, IResolvedLight> =>
	Object.fromEntries(
		(part.lights ?? []).map((spec) => [spec.id, resolveLight(spec, part, entity, context)]),
	);

/** A part's lights with no object around them (previews, thumbnails): as the part has them, parked. */
export const resolvePartLights = (part: IPartLights, palette: IScenePalette) =>
	resolveLights(part, { props: {}, accent: null, lights: {} }, { palette, driving: false });
