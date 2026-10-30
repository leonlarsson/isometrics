import { z } from "zod";

import {
	ColorSettingSchema,
	EntityLightSchema,
	type TColorSetting,
	type TDataBinding,
	type TEntityLight,
} from "./schema";

/**
 * An object's own settings for its part: its props, and its colours and
 * lights by id (ADR-0058, ADR-0060), as a world's file stores them, and the
 * changes the properties make to them. No React here.
 */

/**
 * A change to an object's settings for one light: fields to set (null = back
 * to the part's), and data bindings by setting (a binding to set, or null to
 * stop that setting following data).
 */
export type TEntityLightChange = Partial<Omit<TEntityLight, "data">> & {
	data?: Partial<Record<string, TDataBinding | null>>;
};

/** A change to an object's setting for one colour, like a light's (ADR-0060). */
export type TColorSettingChange = Partial<Omit<TColorSetting, "data">> & {
	data?: Partial<Record<string, TDataBinding | null>>;
};

/** A light or colour setting that's entirely as the part has it: no fields set, nothing following data. */
export const isUnsetSetting = ({ data, ...fields }: TEntityLight | TColorSetting) =>
	Object.keys(data).length === 0 && Object.values(fields).every((value) => value === null);

/** A setting with a change applied: fields set, data bindings set or (null) removed. */
export const applySettingChange = <T extends TEntityLight | TColorSetting>(
	current: T,
	{
		data: dataChange,
		...fields
	}: Partial<Omit<T, "data">> & { data?: Partial<Record<string, TDataBinding | null>> },
): T => {
	const next = { ...current, ...fields, data: { ...current.data } };
	for (const [setting, binding] of Object.entries(dataChange ?? {})) {
		if (binding) {
			next.data[setting] = binding;
		} else {
			delete next.data[setting];
		}
	}
	return next;
};

/**
 * A `colors` map with one colour's setting changed, in place (an immer draft):
 * an object's, a fence's, a road's, an area's or the ground's. A colour back to
 * its default leaves the map.
 */
export const changeColorSetting = (
	colors: Record<string, TColorSetting>,
	id: string,
	change: TColorSettingChange,
) => {
	const next = applySettingChange(colors[id] ?? ColorSettingSchema.parse({}), change);
	if (isUnsetSetting(next)) {
		delete colors[id];
	} else {
		colors[id] = next;
	}
};

/** An object's props, colours and lights, without the rest of it: what the parts catalogue tries out. */
export const ObjectSettingsSchema = z.object({
	props: z.record(z.string(), z.unknown()).default({}),
	colors: z.record(z.string(), ColorSettingSchema).default({}),
	lights: z.record(z.string(), EntityLightSchema).default({}),
});

export type TObjectSettings = z.output<typeof ObjectSettingsSchema>;

export const NO_OBJECT_SETTINGS: TObjectSettings = { props: {}, colors: {}, lights: {} };

/** Whether any prop, colour or light is set. */
export const hasObjectSettings = ({ props, colors, lights }: TObjectSettings) =>
	Object.keys(props).length + Object.keys(colors).length + Object.keys(lights).length > 0;

/** The settings with one light changed; a light back to the part's leaves the map. */
export const withLightChange = (
	settings: TObjectSettings,
	id: string,
	change: TEntityLightChange,
): TObjectSettings => {
	const next = applySettingChange(settings.lights[id] ?? EntityLightSchema.parse({}), change);
	const { [id]: _, ...others } = settings.lights;
	return { ...settings, lights: isUnsetSetting(next) ? others : { ...others, [id]: next } };
};

/** The settings with one colour changed; a colour back to the part's leaves the map. */
export const withColorChange = (
	settings: TObjectSettings,
	id: string,
	change: TColorSettingChange,
): TObjectSettings => {
	const next = applySettingChange(settings.colors[id] ?? ColorSettingSchema.parse({}), change);
	const { [id]: _, ...others } = settings.colors;
	return { ...settings, colors: isUnsetSetting(next) ? others : { ...others, [id]: next } };
};

/** The settings with one prop set; a prop set to the part's default leaves the map. */
export const withPropChange = (
	settings: TObjectSettings,
	key: string,
	value: unknown,
	defaults: Readonly<Record<string, unknown>>,
): TObjectSettings => {
	const { [key]: _, ...others } = settings.props;
	const isDefault = JSON.stringify(value) === JSON.stringify(defaults[key]);
	return { ...settings, props: isDefault ? others : { ...others, [key]: value } };
};
