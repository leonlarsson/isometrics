import type { ReactNode } from "react";

import {
	comesOnOf,
	inPeriod,
	LIGHT_DATA,
	MAX_STRENGTH,
	type TLightDataTarget,
} from "#/parts/lightModel";
import { type ILightSpec, LIGHT_SHAPES_WITH_REACH } from "#/parts/types";
import type { TEntityLightChange } from "#/scene/objectSettings";
import {
	DataBindingSchema,
	type TComesOn,
	type TDataBinding,
	type TDataEntry,
	type TEntityLight,
	type TLightMode,
} from "#/scene/schema";

import { DataBindingFields } from "./DataBindingFields";
import { DataDrivenField } from "./DataDrivenField";
import {
	ColorField,
	FieldGroup,
	formatClock,
	Hint,
	PeriodsField,
	Section,
	SelectField,
	SliderField,
} from "./fields";

interface ILightSettingsProps {
	/** The light, as its part declares it. */
	spec: ILightSpec;
	/** Its colour, strength and reach as the part has them, shown while not set here. */
	defaults: { color: string; strength: number; reach: number; litPaneShare: number };
	/** The object's settings for it (undefined: none yet). */
	setting: TEntityLight | undefined;
	/** The world's data, to drive its settings by a value. */
	data: readonly TDataEntry[];
	/** Window lights: its part of the part's windows (its weight against the others'), 0–1. */
	windowShare?: number;
	/** The world's hour now, for schedules; null without a time of day. */
	hour: number | null;
	/**
	 * A change to its settings (null = back to the part's; a data binding of
	 * null stops that setting following data). `coalesce` names the setting
	 * being dragged or typed, so it's one undo step.
	 */
	onChange: (change: TEntityLightChange, coalesce?: string) => void;
	/**
	 * Several objects are selected (ADR-0064): whether a setting (a field of the light's settings,
	 * or `data.<setting>` for what follows data) differs between them, so its field says Mixed.
	 */
	mixed?: (setting: TLightSettingKey) => boolean;
	/** Several objects are selected: which of them have this light ("On 2 of 6 selected…"). */
	appliesTo?: string;
	/** The card's Copy / Paste menu (ADR-0068). */
	menu?: ReactNode;
	/** What a world's file calls the light, under its description (the parts catalogue). */
	fileName?: ReactNode;
	/** Folded each time it shows, not remembered (the parts catalogue). */
	startsFolded?: boolean;
}

/** A light setting, or what one of its settings follows in the data, for `mixed`. */
export type TLightSettingKey = Exclude<keyof TEntityLight, "data"> | `data.${TLightDataTarget}`;

const NOTHING_MIXED = () => false;

/** How it turns on: by itself, or by a data value. */
type TTurnsOn = TLightMode | "data";

/** What each way of coming on is called, and what it does. */
export const COMES_ON: Record<
	TComesOn,
	{
		label: string;
		afterDark: string;
		windowsAfterDark?: string;
		onSchedule: string;
	}
> = {
	atOnce: {
		label: "At once",
		afterDark:
			"Switches on fully once it's dark enough, like a lamp with a light sensor. To switch some lights at other times, give them a schedule.",
		windowsAfterDark: "All its lit windows switch on together once it's dark enough.",
		onSchedule:
			"Fully on for each whole period, exactly at its times: lights with the same schedule switch together, like lamps on one timer.",
	},
	oneByOne: {
		label: "One by one",
		afterDark:
			"Its windows light up one after another as it gets dark, each at full brightness, like people coming home.",
		onSchedule:
			"Its windows light up one after another over the first hour of each period and go dark one by one over the last, like people arriving and going home.",
	},
	gradually: {
		label: "Gradually",
		afterDark: "Fades in from dusk until it's fully dark, and out again at dawn.",
		onSchedule: "Fades in over the first hour of each period and out over the last.",
	},
};

/** The first period of a new schedule, and what Add period adds: an evening. */
const NEW_PERIOD = { from: 18, until: 23 };

const percent = (strength: number) => `${Math.round(strength * 100)}%`;

/** What a shape's reach is called, and what it does. */
const REACH: Record<string, { label: string; hint: string }> = {
	beam: { label: "Beam length", hint: "How far its beam reaches, like headlights along the road." },
	pool: { label: "Glow size", hint: "How far its glow spreads on the ground around it." },
};

/**
 * One light's settings, as a card in the Lights tab (ADR-0058), in three
 * groups: how it turns on, how bright it is and how it looks. One question per
 * setting, so they can't contradict each other. Settings that can follow data
 * (the light model's LIGHT_DATA) use the shared DataDrivenField, whose data
 * fields say what the data does right now. Each shows the
 * part's value as "Default" until it's set (ADR-0027).
 */
export const LightSettings = ({
	spec,
	defaults,
	setting,
	data,
	windowShare,
	hour,
	onChange,
	mixed = NOTHING_MIXED,
	appliesTo,
	menu,
	fileName,
	startsFolded,
}: ILightSettingsProps) => {
	const bound = setting?.data ?? {};
	const hasData = data.length > 0;
	/** Start following data: the first value, with no options set. */
	const follow = (target: TLightDataTarget) =>
		onChange({ data: { [target]: DataBindingSchema.parse({ key: data[0]?.key ?? "" }) } });
	/** A binding changed (null: stops following data). */
	const onBindingChange =
		(target: TLightDataTarget) => (binding: TDataBinding | null, coalesce?: string) =>
			onChange({ data: { [target]: binding } }, coalesce && `${target}.${coalesce}`);
	/** Data options are always offered; without data values they're greyed out (the tab says why). */
	const needsData = hasData ? "" : " (no values yet)";

	const turnsOnLabels: Record<TTurnsOn, string> = {
		auto: spec.when === "always" ? "Day and night" : "After dark",
		on: "Always",
		off: "Never",
		schedule: "On a schedule",
		data: "From data",
	};
	/** Options that need something the world doesn't have yet are greyed out, saying what. */
	const unavailable: Partial<Record<TTurnsOn, string>> = {
		...(hasData ? {} : { data: needsData }),
	};
	const comesOn = comesOnOf(spec, setting);
	const schedule = setting?.schedule ?? [];
	const scheduledOn = hour !== null && schedule.some((period) => inPeriod(hour, period));
	const turnsOn: TTurnsOn = bound.on ? "data" : (setting?.whenOn ?? "auto");
	const reach = REACH[spec.shape];

	return (
		<Section
			id={`light.${spec.id}`}
			icon="bulb"
			title={spec.name}
			keywords="light lights night glow colour brightness turns on data windows lit panes"
			actions={menu}
			defaultClosed={startsFolded}
			remembersOpen={!startsFolded}
		>
			{appliesTo && <Hint>{appliesTo}</Hint>}

			{spec.description && <Hint>{spec.description}</Hint>}

			{fileName && <Hint>{fileName}</Hint>}

			<FieldGroup title="Turns on">
				<SelectField<TTurnsOn>
					label="When"
					value={turnsOn}
					mixed={mixed("whenOn") || mixed("data.on")}
					options={(["auto", "on", "off", "schedule", "data"] as const).map((option) => ({
						value: option,
						label: `${turnsOnLabels[option]}${unavailable[option] ?? ""}`,
						disabled: unavailable[option] !== undefined,
					}))}
					onChange={(next) =>
						next === "data"
							? follow("on")
							: next === "schedule"
								? onChange({
										whenOn: next,
										schedule: setting?.schedule ?? [NEW_PERIOD],
										data: { on: null },
									})
								: onChange({ whenOn: next, data: { on: null } })
					}
					inherit={{
						from: "default",
						inherited: setting?.whenOn == null && !bound.on,
						onReset: () => onChange({ whenOn: null, data: { on: null } }),
						value: turnsOnLabels.auto.toLowerCase(),
					}}
					hint={
						turnsOn === "auto" && spec.when === "driving"
							? "Only while it drives along a road, like real headlights."
							: turnsOn === "auto" && spec.when === "always"
								? "Like a traffic signal: lit by day, glowing after dark."
								: turnsOn === "on"
									? spec.when === "driving"
										? "Day and night, even parked."
										: spec.when === "always"
											? "Glowing fully, by day too."
											: "Day and night."
									: undefined
					}
				/>

				{((turnsOn === "auto" && spec.when !== "always") || turnsOn === "schedule") && (
					<SelectField<TComesOn>
						label="Comes on"
						value={comesOn}
						mixed={mixed("comesOn")}
						options={(spec.shape === "windows"
							? (["atOnce", "oneByOne", "gradually"] as const)
							: (["atOnce", "gradually"] as const)
						).map((option) => ({ value: option, label: COMES_ON[option].label }))}
						onChange={(next) => onChange({ comesOn: next })}
						inherit={{
							from: "default",
							inherited: setting?.comesOn == null,
							onReset: () => onChange({ comesOn: null }),
							value: COMES_ON[comesOnOf(spec, undefined)].label.toLowerCase(),
						}}
						hint={
							turnsOn === "schedule"
								? COMES_ON[comesOn].onSchedule
								: spec.shape === "windows"
									? (COMES_ON[comesOn].windowsAfterDark ?? COMES_ON[comesOn].afterDark)
									: COMES_ON[comesOn].afterDark
						}
					/>
				)}

				{/* Its periods by hand, or from a value holding times, like opening hours. */}
				{turnsOn === "schedule" && (
					<DataDrivenField
						kind={LIGHT_DATA.schedule}
						binding={bound.schedule}
						mixed={mixed("data.schedule")}
						data={data}
						onBindingChange={onBindingChange("schedule")}
					>
						<PeriodsField
							label="On between"
							periods={schedule}
							mixed={mixed("schedule")}
							newPeriod={NEW_PERIOD}
							onChange={(periods) => onChange({ schedule: periods }, "schedule")}
							inherit={{
								from: "default",
								inherited: setting?.schedule == null,
								onReset: () => onChange({ schedule: null }),
								value: "none: never on",
							}}
							hint={
								schedule.length === 0
									? "With no periods it's never on. Add the times it should be on, like a timer."
									: hour === null
										? "This world shows classic daylight, with no clock, so it stays off until you pick a time in the Time & light tab."
										: `It's ${formatClock(hour)} in the world, so it's ${scheduledOn ? "on" : "off"} now.`
							}
						/>
					</DataDrivenField>
				)}

				{bound.on && (
					<DataBindingFields
						kind={LIGHT_DATA.on}
						binding={bound.on}
						data={data}
						onChange={onBindingChange("on")}
					/>
				)}
			</FieldGroup>

			<FieldGroup title="Brightness">
				<DataDrivenField
					kind={LIGHT_DATA.strength}
					binding={bound.strength}
					mixed={mixed("data.strength")}
					data={data}
					onBindingChange={onBindingChange("strength")}
					formatScale={percent}
					max={MAX_STRENGTH}
				>
					<SliderField
						label="Level"
						value={Math.round((setting?.strength ?? defaults.strength) * 100)}
						mixed={mixed("strength")}
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
				</DataDrivenField>
			</FieldGroup>

			{spec.shape === "windows" && (
				<FieldGroup title="Lit windows">
					<DataDrivenField
						kind={LIGHT_DATA.litPaneShare}
						binding={bound.litPaneShare}
						mixed={mixed("data.litPaneShare")}
						data={data}
						onBindingChange={onBindingChange("litPaneShare")}
						formatScale={percent}
						max={1}
					>
						<SliderField
							label="Lit panes"
							value={Math.round((setting?.litPaneShare ?? defaults.litPaneShare) * 100)}
							mixed={mixed("litPaneShare")}
							min={0}
							max={100}
							step={1}
							suffix="%"
							onChange={(value) => onChange({ litPaneShare: value / 100 }, "litPaneShare")}
							inherit={{
								from: "default",
								inherited: setting?.litPaneShare == null,
								onReset: () => onChange({ litPaneShare: null }),
								value: percent(defaults.litPaneShare),
							}}
							hint={
								<>
									How many of its own windows are lit; more only ever adds windows.
									{windowShare !== undefined && windowShare < 1 && (
										<strong> It has {percent(windowShare)} of the windows.</strong>
									)}
								</>
							}
						/>
					</DataDrivenField>
				</FieldGroup>
			)}

			<FieldGroup title="Look">
				<DataDrivenField
					kind={LIGHT_DATA.color}
					binding={bound.color}
					mixed={mixed("data.color")}
					data={data}
					onBindingChange={onBindingChange("color")}
				>
					<ColorField
						label="Colour"
						value={setting?.color ?? defaults.color}
						mixed={mixed("color")}
						onChange={(color) => onChange({ color }, "color")}
						inherit={{
							from: "default",
							inherited: setting?.color == null,
							onReset: () => onChange({ color: null }),
						}}
					/>
				</DataDrivenField>

				{reach && LIGHT_SHAPES_WITH_REACH.includes(spec.shape) && (
					<SliderField
						label={reach.label}
						value={setting?.reach ?? defaults.reach}
						mixed={mixed("reach")}
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
