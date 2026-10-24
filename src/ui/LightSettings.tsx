import type { TEntityLightChange } from "#/editor/store";
import { LIGHT_DATA, MAX_STRENGTH, type TLightDataTarget } from "#/parts/lightModel";
import { type ILightSpec, LIGHT_SHAPES_WITH_REACH } from "#/parts/types";
import {
	DataBindingSchema,
	type TDataEntry,
	type TEntityLight,
	type TLightMode,
} from "#/scene/schema";

import { DataBindingFields } from "./DataBindingFields";
import { ColorField, FieldGroup, Section, SelectField, SliderField } from "./fields";

interface ILightSettingsProps {
	/** The light, as its part declares it. */
	spec: ILightSpec;
	/** Its colour, strength and reach as the part has them, shown while not set here. */
	defaults: { color: string; strength: number; reach: number };
	/** The object's settings for it (undefined: none yet). */
	setting: TEntityLight | undefined;
	/** When it turns on while that isn't set here: older worlds had one setting for all an object's lights. */
	inheritedMode: TLightMode;
	/** The world's data, to drive its settings by a value. */
	data: readonly TDataEntry[];
	/**
	 * A change to its settings (null = back to the part's; a data binding of
	 * null stops that setting following data). `coalesce` names the setting
	 * being dragged or typed, so it's one undo step.
	 */
	onChange: (change: TEntityLightChange, coalesce?: string) => void;
}

/** How it turns on: by itself, or by a data value. */
type TTurnsOn = TLightMode | "data";

/** Where a setting's value comes from. */
type TSource = "hand" | "data";

const percent = (strength: number) => `${Math.round(strength * 100)}%`;

/** What a shape's reach is called, and what it does. */
const REACH: Record<string, { label: string; hint: string }> = {
	beam: { label: "Beam length", hint: "How far its beam reaches along the road ahead." },
	pool: { label: "Glow size", hint: "How far its glow spreads on the ground around it." },
};

/**
 * One light's settings, as a card in the Lights tab (ADR-0058), in three
 * groups: how it turns on, how bright it is and how it looks. One question per
 * setting, so they can't contradict each other. Settings that can follow data
 * (the light model's LIGHT_DATA) choose "from data" and then show the shared
 * DataBindingFields, which say what the data does right now. Each shows the
 * part's value as "Default" until it's set (ADR-0027).
 */
export const LightSettings = ({
	spec,
	defaults,
	setting,
	inheritedMode,
	data,
	onChange,
}: ILightSettingsProps) => {
	const bound = setting?.data ?? {};
	const hasData = data.length > 0;
	/** Start following data: the first value, with no options set. */
	const follow = (target: TLightDataTarget) =>
		onChange({ data: { [target]: DataBindingSchema.parse({ key: data[0]?.key ?? "" }) } });
	const stopFollowing = (target: TLightDataTarget) => onChange({ data: { [target]: null } });
	/** The shared fields for a setting that follows data. */
	const bindingFields = (
		target: TLightDataTarget,
		extra?: { formatScale?: (reading: number) => string; max?: number },
	) => {
		const binding = bound[target];
		return binding ? (
			<DataBindingFields
				kind={LIGHT_DATA[target]}
				binding={binding}
				data={data}
				onChange={(next, coalesce) =>
					onChange({ data: { [target]: next } }, coalesce && `${target}.${coalesce}`)
				}
				{...extra}
			/>
		) : null;
	};
	/** Data options are always offered; without data values they're greyed out (the tab says why). */
	const needsData = hasData ? "" : " (no values yet)";
	/** "By hand" or "From data", for a setting that can follow data. */
	const sourceField = (target: TLightDataTarget) => (
		<SelectField<TSource>
			label="Source"
			value={bound[target] ? "data" : "hand"}
			options={[
				{ value: "hand", label: "By hand" },
				{ value: "data", label: `From data${needsData}`, disabled: !hasData },
			]}
			onChange={(source) => (source === "data" ? follow(target) : stopFollowing(target))}
		/>
	);

	const turnsOnLabels: Record<TTurnsOn, string> = {
		auto: "After dark",
		on: "Always",
		off: "Never",
		data: "From data",
	};
	const turnsOn: TTurnsOn = bound.on ? "data" : (setting?.mode ?? inheritedMode);
	const reach = REACH[spec.shape];

	return (
		<Section
			id={`light.${spec.id}`}
			icon="bulb"
			title={spec.name}
			keywords="light lights night glow colour brightness turns on data"
		>
			<FieldGroup title="Turns on">
				<SelectField<TTurnsOn>
					label="When"
					value={turnsOn}
					options={(["auto", "on", "off", "data"] as const).map((option) =>
						option === "data"
							? { value: option, label: `${turnsOnLabels.data}${needsData}`, disabled: !hasData }
							: { value: option, label: turnsOnLabels[option] },
					)}
					onChange={(next) =>
						next === "data" ? follow("on") : onChange({ mode: next, data: { on: null } })
					}
					inherit={{
						from: "default",
						inherited: setting?.mode == null && !bound.on,
						onReset: () => onChange({ mode: null, data: { on: null } }),
						value: turnsOnLabels[inheritedMode].toLowerCase(),
					}}
					hint={
						turnsOn === "auto" && spec.when === "driving"
							? "Only while it drives along a road, like real headlights."
							: turnsOn === "on"
								? spec.when === "driving"
									? "Day and night, even parked."
									: "Day and night."
								: undefined
					}
				/>

				{bindingFields("on")}
			</FieldGroup>

			<FieldGroup title="Brightness">
				{sourceField("strength")}

				{bound.strength ? (
					bindingFields("strength", { formatScale: percent, max: MAX_STRENGTH })
				) : (
					<SliderField
						label="Level"
						value={Math.round((setting?.strength ?? defaults.strength) * 100)}
						min={0}
						max={MAX_STRENGTH * 100}
						step={5}
						suffix="%"
						onChange={(value) => onChange({ strength: value / 100 }, "strength")}
						inherit={{
							from: "default",
							inherited: setting?.strength == null,
							onReset: () => onChange({ strength: null }),
							value: percent(defaults.strength),
						}}
						hint="100% is normal; up to 300%."
					/>
				)}
			</FieldGroup>

			<FieldGroup title="Look">
				{sourceField("color")}

				{bound.color ? (
					bindingFields("color")
				) : (
					<ColorField
						label="Colour"
						value={setting?.color ?? defaults.color}
						onChange={(color) => onChange({ color }, "color")}
						inherit={{
							from: "default",
							inherited: setting?.color == null,
							onReset: () => onChange({ color: null }),
						}}
					/>
				)}

				{reach && LIGHT_SHAPES_WITH_REACH.includes(spec.shape) && (
					<SliderField
						label={reach.label}
						value={setting?.reach ?? defaults.reach}
						min={0.2}
						max={8}
						step={0.1}
						onChange={(value) => onChange({ reach: value }, "reach")}
						inherit={{
							from: "default",
							inherited: setting?.reach == null,
							onReset: () => onChange({ reach: null }),
							value: String(defaults.reach),
						}}
						hint={reach.hint}
					/>
				)}
			</FieldGroup>
		</Section>
	);
};
