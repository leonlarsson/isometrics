import type { ReactNode } from "react";

import {
	COLOR_DATA,
	colorSettingOf,
	type IPartColors,
	type IStoredColors,
	resolveColorDefault,
} from "#/parts/colorModel";
import { lightDefaults } from "#/parts/lightModel";
import { partName, resolveProps, type TAnyPart } from "#/parts/registry";
import type { IColorSpec, ILightSpec, TFieldSpec } from "#/parts/types";
import type { TColorSettingChange, TEntityLightChange } from "#/scene/objectSettings";
import type { TColorSetting, TDataEntry, TEntity } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { ChipGroup } from "./ChipGroup";
import { DataDrivenField } from "./DataDrivenField";
import {
	ColorField,
	FieldGroup,
	Hint,
	Section,
	SelectField,
	SliderField,
	SplitField,
	SwitchField,
	TextField,
} from "./fields";
import { LightSettings } from "./LightSettings";

/**
 * A part's settings panels, without the editor around them: its shape (props),
 * its colours and its lights, for an object's stored settings. Each change
 * goes to `onChange`, so the properties (EntityInspector, which commits it to
 * the world) and the parts catalogue (which tries it out) show the same
 * panels.
 */

/** What the panels read of an object: what a world's file stores for its part. */
export type TPartSettingsOf = Pick<TEntity, "props" | "colors" | "lights">;

/** How a setting is called in a world's file, under its field (the parts catalogue). */
const FileName = ({ name }: { name: string }) => (
	<>
		In a world's file: <code>{name}</code>
	</>
);

/** Pick one of the world's data keys, or none. */
const DataKeyField = ({
	label,
	value,
	data,
	onChange,
	mixed,
	hint,
}: {
	label: string;
	value: string;
	data: readonly TDataEntry[];
	onChange: (key: string) => void;
	mixed?: boolean;
	hint?: ReactNode;
}) => {
	return (
		<SelectField
			label={label}
			value={value}
			mixed={mixed}
			options={[
				{ value: "", label: "None" },
				...data.map((entry) => ({ value: entry.key, label: entry.name || entry.key })),
			]}
			onChange={onChange}
			hint={
				hint ?? (data.length === 0 ? "Add values in the Data tab to show one here." : undefined)
			}
		/>
	);
};

/** One of a part's own settings, as its field spec describes it. */
export const PropField = ({
	spec,
	value,
	data,
	onChange,
	mixed,
	hint,
}: {
	spec: TFieldSpec;
	value: unknown;
	/** The world's data, for a field that picks a data value. */
	data: readonly TDataEntry[];
	onChange: (value: unknown) => void;
	/** It differs between the selected objects (ADR-0064). */
	mixed?: boolean;
	hint?: ReactNode;
}) => {
	switch (spec.type) {
		case "number":
			return (
				<>
					<SliderField
						label={spec.label}
						value={Number(value)}
						min={spec.min}
						max={spec.max}
						step={spec.step}
						onChange={onChange}
						mixed={mixed}
						hint={hint}
					/>

					{spec.presets && (
						<ChipGroup
							label={`${spec.label}: presets`}
							size="sm"
							value={mixed ? "" : String(value)}
							onChange={(next) => onChange(Number(next))}
							chips={spec.presets.map((preset) => ({
								value: String(preset.value),
								label: preset.label,
							}))}
						/>
					)}
				</>
			);
		case "boolean":
			return (
				<SwitchField
					label={spec.label}
					checked={Boolean(value)}
					onChange={onChange}
					mixed={mixed}
					hint={hint}
				/>
			);
		case "text":
			return (
				<TextField
					label={spec.label}
					value={String(value ?? "")}
					placeholder={spec.placeholder}
					onChange={onChange}
					mixed={mixed}
					hint={hint}
				/>
			);
		case "dataKey":
			return (
				<DataKeyField
					label={spec.label}
					value={String(value ?? "")}
					data={data}
					onChange={onChange}
					mixed={mixed}
					hint={hint}
				/>
			);
		case "select":
			return (
				<SelectField
					label={spec.label}
					value={String(value)}
					options={spec.options}
					onChange={onChange}
					mixed={mixed}
					hint={hint}
				/>
			);
	}
};

interface IPartSettingsProps {
	part: TAnyPart;
	object: TPartSettingsOf;
	/** The world's data, for settings that follow it (none in the parts catalogue). */
	data: readonly TDataEntry[];
	/** Say under each setting what a world's file calls it (the parts catalogue). */
	showFileNames?: boolean;
	/** Panels folded each time they show, not remembered (the parts catalogue). */
	startsFolded?: boolean;
}

/** The part's own settings (its props), in one panel. */
export const PartShapeSection = ({
	part,
	object,
	data,
	showFileNames,
	startsFolded,
	actions,
	onChange,
}: IPartSettingsProps & {
	/** Controls on the panel's header, like the Copy / Paste menu. */
	actions?: ReactNode;
	onChange: (key: string, value: unknown) => void;
}) => {
	const props = resolveProps(part, object.props);
	return (
		<Section
			id="shape.part"
			defaultClosed={startsFolded}
			remembersOpen={!startsFolded}
			icon="spline"
			title={`${partName(part)} shape`}
			keywords="shape size"
			actions={actions}
		>
			{part.fields.map((spec) => (
				<PropField
					key={spec.key}
					spec={spec}
					value={props[spec.key]}
					data={data}
					onChange={(value) => onChange(spec.key, value)}
					hint={showFileNames ? <FileName name={spec.key} /> : undefined}
				/>
			))}

			{part.fields.length === 0 && <Hint>It has no settings of its own.</Hint>}
		</Section>
	);
};

/**
 * One colour's setting (ADR-0060): set by hand or from data, and how see-through
 * it is for glass (ADR-0090). Inside the colours panel, and on its own for a
 * road's, an area's or the ground's colour (ADR-0104).
 */
export const ColorSettingFields = ({
	spec,
	setting,
	data,
	palette,
	label = "Colour",
	fileName,
	onChange,
}: {
	spec: IColorSpec;
	setting: TColorSetting | undefined;
	data: readonly TDataEntry[];
	palette: IScenePalette;
	label?: string;
	/** What a world's file calls it, shown under it (the parts catalogue). */
	fileName?: string;
	/** `coalesce` names the setting being dragged or typed, so it's one undo step. */
	onChange: (change: TColorSettingChange, coalesce?: string) => void;
}) => (
	<>
		<DataDrivenField
			kind={COLOR_DATA.color}
			binding={setting?.data.color}
			data={data}
			onBindingChange={(binding, field) =>
				onChange({ data: { color: binding } }, field && `data.${field}`)
			}
		>
			<ColorField
				label={label}
				value={setting?.color ?? resolveColorDefault(spec.default, palette)}
				onChange={(color) => onChange({ color }, "color")}
				inherit={{
					from: "default",
					inherited: setting?.color == null,
					onReset: () => onChange({ color: null }),
				}}
				hint={fileName ? <FileName name={fileName} /> : undefined}
			/>
		</DataDrivenField>

		{/* Glass and the like: how see-through it is (ADR-0090). */}
		{spec.seeThrough && (
			<SliderField
				label="Transparency"
				value={Math.round((setting?.transparency ?? spec.seeThrough.transparency) * 100)}
				min={0}
				max={100}
				step={1}
				suffix="%"
				onChange={(value) => onChange({ transparency: value / 100 }, "transparency")}
				inherit={{
					from: "default",
					inherited: setting?.transparency == null,
					onReset: () => onChange({ transparency: null }),
					value: `${Math.round(spec.seeThrough.transparency * 100)}%`,
				}}
				hint="0% is solid, 100% clear."
			/>
		)}
	</>
);

/** A group per colour of the part (ADR-0060), in the part's order, each set by hand or from data. */
export const PartColorsSection = ({
	part,
	object,
	data,
	showFileNames,
	startsFolded,
	palette,
	actions,
	onChange,
}: Omit<IPartSettingsProps, "part" | "object"> & {
	/** What has the colours: a part, or a fence's kind (ADR-0103). */
	part: IPartColors;
	/** What keeps settings for them: an object or a fence. */
	object: IStoredColors;
	palette: IScenePalette;
	actions?: ReactNode;
	/** `coalesce` names the setting being dragged or typed, so it's one undo step. */
	onChange: (colorId: string, change: TColorSettingChange, coalesce?: string) => void;
}) => {
	return (
		<Section
			id="look.colours"
			defaultClosed={startsFolded}
			remembersOpen={!startsFolded}
			icon="palette"
			title="Colours"
			keywords="colors paint data scale heatmap"
			actions={actions}
		>
			{part.colors.map((spec) => (
				<FieldGroup key={spec.id} title={spec.name}>
					<ColorSettingFields
						spec={spec}
						setting={colorSettingOf(object, spec.id)}
						data={data}
						palette={palette}
						fileName={showFileNames ? spec.id : undefined}
						onChange={(change, field) => onChange(spec.id, change, field)}
					/>
				</FieldGroup>
			))}

			{part.colors.length === 0 && <Hint>It has no colours to change.</Hint>}
		</Section>
	);
};

/** A card for each of the part's lights (ADR-0058), in the order the part lists them. */
export const PartLightCards = ({
	part,
	object,
	data,
	showFileNames,
	startsFolded,
	palette,
	hour,
	menu,
	onChange,
}: IPartSettingsProps & {
	palette: IScenePalette;
	/** The world's hour now, for schedules; null without a time of day. */
	hour: number | null;
	/** A light card's Copy / Paste menu. */
	menu?: (spec: ILightSpec) => ReactNode;
	/** `coalesce` names the setting being dragged or typed, so it's one undo step. */
	onChange: (lightId: string, change: TEntityLightChange, coalesce?: string) => void;
}) => {
	// Window lights split the part's windows between them by weight: the object's, else the part's.
	const windowLights = (part.lights ?? []).filter((light) => light.shape === "windows");
	const weightOf = (spec: ILightSpec) => object.lights[spec.id]?.paneWeight ?? spec.paneWeight ?? 1;
	const windowWeights = windowLights.reduce((sum, light) => sum + weightOf(light), 0) || 1;
	const split = windowLights.length > 1 && (
		<Section
			key="split"
			id="lights.split"
			defaultClosed={startsFolded}
			remembersOpen={!startsFolded}
			icon="layers"
			title="Windows"
			keywords="split share weight windows panes screens"
		>
			<SplitField
				label="Split between"
				parts={windowLights.map((spec) => ({
					id: spec.id,
					label: spec.name,
					color: lightDefaults(spec, palette).color,
				}))}
				weights={windowLights.map(weightOf)}
				onChange={(percentages) =>
					windowLights.forEach((spec, i) => {
						onChange(spec.id, { paneWeight: percentages[i] }, "split");
					})
				}
				inherit={{
					from: "default",
					inherited: windowLights.every((spec) => object.lights[spec.id]?.paneWeight == null),
					onReset: () => {
						const reset = `split:reset:${performance.now()}`;
						for (const spec of windowLights) {
							onChange(spec.id, { paneWeight: null }, reset);
						}
					},
				}}
				hint={`How the building's windows are shared out between its window lights. Each light's Lit panes is a share of its own. Changing the split moves which panes are whose.${showFileNames ? " In a world's file: paneWeight, on each light." : ""}`}
			/>
		</Section>
	);
	const cards = (part.lights ?? []).map((spec) => {
		const setting = object.lights[spec.id];
		return (
			<LightSettings
				key={spec.id}
				spec={spec}
				defaults={lightDefaults(spec, palette)}
				setting={setting}
				data={data}
				hour={hour}
				windowShare={spec.shape === "windows" ? weightOf(spec) / windowWeights : undefined}
				menu={menu?.(spec)}
				fileName={showFileNames ? <FileName name={spec.id} /> : undefined}
				startsFolded={startsFolded}
				onChange={(change, field) => onChange(spec.id, change, field)}
			/>
		);
	});
	return split ? [split, ...cards] : cards;
};
