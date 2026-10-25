import type { Draft } from "immer";

import { copySettings, pasteFromClipboard, settingsOf } from "#/editor/clipboard";
import { useSceneHours } from "#/editor/dayClock";
import { type ICommitOptions, type TEntityColorChange, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { COLOR_DATA, colorDefault, colorSettingOf } from "#/parts/colorModel";
import { lightDefaults, lightSettingsOf, SWITCH_ON_DARKNESS } from "#/parts/lightModel";
import { getPart, partName, resolveProps, type TAnyPart } from "#/parts/registry";
import type { ILightSpec, TFieldSpec } from "#/parts/types";
import {
	polylineLength,
	ROAD_STYLE_LABELS,
	resolveTurns,
	roadCenterlineOf,
	TURNS_LABELS,
	TURNS_OPTIONS,
} from "#/scene/roads";
import type { TEntity, TTurns } from "#/scene/schema";

import { Button, ButtonGroup, IconButton, IconButtonGroup } from "./Button";
import { CameraFollowButtons } from "./CameraFollowBar";
import { CopyPasteMenu } from "./CopyPasteMenu";
import { DataDrivenField } from "./DataDrivenField";
import { FollowDataNote } from "./FollowDataNote";
import {
	CheckboxGroupField,
	ColorField,
	FieldGroup,
	formatClock,
	Hint,
	Section,
	SelectField,
	SliderField,
	SwitchField,
	TextField,
	VectorField,
} from "./fields";
import { CATEGORY_ICONS, type IInspectorTab } from "./inspectorTabs";
import { LightSettings } from "./LightSettings";
import { Menu } from "./Menu";

const KeyPicker = ({
	label,
	selected,
	onChange,
}: {
	label: string;
	selected: string[];
	onChange: (keys: string[]) => void;
}) => {
	const data = useEditor((s) => s.scene.data);
	if (data.length === 0) {
		return <Hint>Add values in the Data tab to show them here.</Hint>;
	}
	return (
		<CheckboxGroupField
			label={label}
			options={data.map((entry) => ({ value: entry.key, label: entry.label || entry.key }))}
			value={selected}
			onChange={onChange}
		/>
	);
};

/** Pick one of the world's data keys, or none. */
const DataKeyField = ({
	label,
	value,
	onChange,
	mixed,
}: {
	label: string;
	value: string;
	onChange: (key: string) => void;
	mixed?: boolean;
}) => {
	const data = useEditor((s) => s.scene.data);
	return (
		<SelectField
			label={label}
			value={value}
			mixed={mixed}
			options={[
				{ value: "", label: "None" },
				...data.map((entry) => ({ value: entry.key, label: entry.label || entry.key })),
			]}
			onChange={onChange}
			hint={data.length === 0 ? "Add values in the Data tab to show one here." : undefined}
		/>
	);
};

/** One of a part's own settings, as its field spec describes it. */
export const PropField = ({
	spec,
	value,
	onChange,
	mixed,
}: {
	spec: TFieldSpec;
	value: unknown;
	onChange: (value: unknown) => void;
	/** It differs between the selected objects (ADR-0064). */
	mixed?: boolean;
}) => {
	switch (spec.type) {
		case "number":
			return (
				<SliderField
					label={spec.label}
					value={Number(value)}
					min={spec.min}
					max={spec.max}
					step={spec.step}
					onChange={onChange}
					mixed={mixed}
				/>
			);
		case "boolean":
			return (
				<SwitchField
					label={spec.label}
					checked={Boolean(value)}
					onChange={onChange}
					mixed={mixed}
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
				/>
			);
		case "dataKey":
			return (
				<DataKeyField
					label={spec.label}
					value={String(value ?? "")}
					onChange={onChange}
					mixed={mixed}
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
				/>
			);
	}
};

/** Every edit coalesces per entity+field so typing or sliding is one undo step. */
const useEntityEdit = (entity: TEntity) => {
	const updateEntity = useEditor((s) => s.updateEntity);
	return (field: string, recipe: (e: Draft<TEntity>) => void) => {
		const options: ICommitOptions = { coalesce: `${entity.id}:${field}` };
		updateEntity(entity.id, recipe, options);
	};
};

/** The Object tab: what it is, its name, and where it stands. */
const ObjectTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const removeEntity = useEditor((s) => s.removeEntity);
	const duplicateEntity = useEditor((s) => s.duplicateEntity);
	const edit = useEntityEdit(entity);
	const following = entity.follow !== null;

	return (
		<>
			<Section
				icon={CATEGORY_ICONS[part.category]}
				title={partName(part)}
				actions={
					<IconButtonGroup>
						<IconButton
							icon={entity.locked ? "lock" : "unlock"}
							label={entity.locked ? "Unlock" : "Lock position"}
							pressed={entity.locked}
							onClick={() =>
								edit("locked", (e) => {
									e.locked = !e.locked;
								})
							}
						/>

						<IconButton
							icon="copy"
							label="Duplicate (Ctrl+D)"
							onClick={() => duplicateEntity(entity.id)}
						/>

						<IconButton icon="trash" label="Delete (Del)" onClick={() => removeEntity(entity.id)} />
					</IconButtonGroup>
				}
			>
				<TextField
					label="Name"
					value={entity.name}
					placeholder={partName(part)}
					onChange={(v) =>
						edit("name", (e) => {
							e.name = v;
						})
					}
				/>
			</Section>

			<Section
				id="object.transform"
				icon="move"
				title="Transform"
				keywords="position location rotation size scale"
			>
				{!following && (
					<VectorField
						label="Location"
						axes={["X", "Z"]}
						values={entity.position}
						onChange={(i, v) =>
							edit("position", (e) => {
								e.position[i] = v;
							})
						}
					/>
				)}

				<SliderField
					label="Rotation"
					value={entity.rotation}
					min={0}
					max={359}
					step={15}
					suffix="°"
					onChange={(v) =>
						edit("rotation", (e) => {
							e.rotation = v;
						})
					}
				/>

				<SliderField
					label="Size"
					value={entity.scale}
					min={0.25}
					max={4}
					step={0.05}
					suffix="×"
					onChange={(v) =>
						edit("scale", (e) => {
							e.scale = v;
						})
					}
				/>

				<SliderField
					label="Lift"
					value={entity.elevation}
					min={0}
					max={20}
					step={0.1}
					onChange={(v) =>
						edit("elevation", (e) => {
							e.elevation = v;
						})
					}
				/>

				{!following && (
					<Hint>
						Drag it or use the arrows in the scene · G move, R turn, S resize · Q/E to rotate · hold
						Alt to place freely · Ctrl+drag or Shift+D moves a copy
					</Hint>
				)}
			</Section>
		</>
	);
};

/** The Shape tab: the part's own settings (floors, width, text…). */
const ShapeTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const setEntityProp = useEditor((s) => s.setEntityProp);
	const props = resolveProps(part, entity.props);

	return (
		<Section
			id="shape.part"
			icon="spline"
			title={`${partName(part)} shape`}
			keywords="shape size"
			actions={
				<CopyPasteMenu
					what={`${partName(part)} shape`}
					onCopy={() => copySettings(settingsOf(entity, "shape"))}
					onPaste={() => pasteFromClipboard()}
				/>
			}
		>
			{part.fields.map((spec) => (
				<PropField
					key={spec.key}
					spec={spec}
					value={props[spec.key]}
					onChange={(v) =>
						setEntityProp(entity.id, spec.key, v, { coalesce: `${entity.id}:prop:${spec.key}` })
					}
				/>
			))}
		</Section>
	);
};

/**
 * The Look tab: a group per colour of its part (ADR-0060), in the part's
 * order, each set by hand or from data.
 */
const LookTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const palette = usePalette();
	const data = useEditor((s) => s.scene.data);
	const setEntityColor = useEditor((s) => s.setEntityColor);

	return (
		<>
			<FollowDataNote title="Colours can follow data">
				A colour can come from a value in the Data tab: a value holding a colour (red, #ff0000), or
				a number on a colour scale, like a building that turns from green to red as it fills up.
			</FollowDataNote>

			<Section
				id="look.colours"
				icon="palette"
				title="Colours"
				keywords="colors paint data scale heatmap"
				actions={
					<CopyPasteMenu
						what="Colours"
						onCopy={() => copySettings(settingsOf(entity, "colors"))}
						onPaste={() => pasteFromClipboard()}
					/>
				}
			>
				{part.colors.map((spec) => {
					const setting = colorSettingOf(entity, spec.id);
					const change = (colorChange: TEntityColorChange, field?: string) =>
						setEntityColor(
							entity.id,
							spec.id,
							colorChange,
							field ? { coalesce: `${entity.id}:color:${spec.id}:${field}` } : undefined,
						);
					// An older world's colour counts as set here, so Reset goes back to the part's.
					const fromOlderWorld = spec.legacy ? entity[spec.legacy] : null;
					return (
						<FieldGroup key={spec.id} title={spec.name}>
							<DataDrivenField
								kind={COLOR_DATA.color}
								binding={setting?.data.color}
								data={data}
								onBindingChange={(binding, field) =>
									change({ data: { color: binding } }, field && `data.${field}`)
								}
							>
								<ColorField
									label="Colour"
									value={setting?.color ?? colorDefault(spec, entity, palette)}
									onChange={(color) => change({ color }, "color")}
									inherit={{
										from: "default",
										inherited: (setting?.color ?? fromOlderWorld) === null,
										onReset: () => change({ color: null }),
									}}
								/>
							</DataDrivenField>
						</FieldGroup>
					);
				})}

				{part.colors.length === 0 && <Hint>It has no colours to change.</Hint>}
			</Section>
		</>
	);
};

/**
 * A light card's Copy / Paste menu (ADR-0068): Paste goes onto this light of
 * the selected objects; Paste schedule only takes just when it's on.
 */
export const LightCopyPasteMenu = ({ entity, spec }: { entity: TEntity; spec: ILightSpec }) => {
	return (
		<CopyPasteMenu
			what={`${spec.name} light`}
			onCopy={() => copySettings(settingsOf(entity, "light", spec.id))}
			onPaste={() => pasteFromClipboard({ lightId: spec.id })}
		>
			<Menu.Item
				icon="clock"
				label="Paste schedule only"
				description="Just when it's on, from a light copied with a schedule"
				onClick={() => pasteFromClipboard({ lightId: spec.id, scheduleOnly: true })}
			/>
		</CopyPasteMenu>
	);
};

/** The Lights tab (ADR-0058): a card for each of the part's lights, in the order the part lists them. */
const LightsTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const palette = usePalette();
	const data = useEditor((s) => s.scene.data);
	const lighting = useEditor((s) => s.scene.lighting);
	const setEntityLight = useEditor((s) => s.setEntityLight);
	const hour = useSceneHours();
	const setTab = useEditor((s) => s.setTab);
	// Why lights set to come on after dark can't right now, if they can't (null: they can).
	const notDark: { title: string; text: string } | null =
		lighting.lights === "off"
			? {
					title: "Lights are off everywhere",
					text: "Sun & sky → Lights is set to Never, so no light in this world turns on after dark. Set it to After dark there.",
				}
			: lighting.lights === "on" || lighting.timeSource !== "fixed"
				? null
				: hour === null
					? {
							title: "It's always day here",
							text: "This world shows classic daylight: the sun stays where it is and there's no clock, so lights that turn on after dark or on a schedule stay off. Pick a time in Sun & sky, or set a light to turn on Always.",
						}
					: palette.night < SWITCH_ON_DARKNESS
						? {
								title: "It's daytime here",
								text: `It's ${formatClock(hour)} here and the time doesn't move, so lights that turn on after dark stay off. Pick a later time, or a day cycle, in Sun & sky.`,
							}
						: null;

	return (
		<>
			{notDark && (
				<Section icon="clock" title={notDark.title}>
					<Hint>{notDark.text}</Hint>

					<Button size="sm" icon="sun" onClick={() => setTab("sky")}>
						Open Sun &amp; sky
					</Button>
				</Section>
			)}

			<FollowDataNote title="Lights can follow data">
				A light can turn on, get brighter or change colour with a value from the Data tab, like a
				lamp that turns on while an alert is above 0.
			</FollowDataNote>

			{(part.lights ?? []).map((spec) => {
				const { setting, objectMode } = lightSettingsOf(part, entity.lights, spec.id);
				// Window lights split the part's windows between them by weight.
				const windowWeights = (part.lights ?? [])
					.filter((light) => light.shape === "windows")
					.reduce((sum, light) => sum + (light.weight ?? 1), 0);
				return (
					<LightSettings
						key={spec.id}
						spec={spec}
						defaults={lightDefaults(spec, entity, palette)}
						setting={setting}
						inheritedMode={objectMode}
						data={data}
						hour={hour}
						windowShare={spec.shape === "windows" ? (spec.weight ?? 1) / windowWeights : undefined}
						menu={<LightCopyPasteMenu entity={entity} spec={spec} />}
						onChange={(change, field) =>
							setEntityLight(
								entity.id,
								spec.id,
								change,
								field ? { coalesce: `${entity.id}:light:${spec.id}:${field}` } : undefined,
							)
						}
					/>
				);
			})}
		</>
	);
};

/** The Label tab: the floating card with values, and the details shown in View mode. */
const LabelTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const edit = useEntityEdit(entity);

	return (
		<>
			<Section
				id="label.card"
				icon="tag"
				title="Label card"
				keywords="data values card"
				actions={
					<>
						<CopyPasteMenu
							what="Label card"
							onCopy={() => copySettings(settingsOf(entity, "label"))}
							onPaste={() => pasteFromClipboard()}
						/>

						<SwitchField
							label="Show"
							checked={entity.label?.enabled ?? false}
							onChange={(on) =>
								edit("label", (e) => {
									if (e.label) {
										e.label.enabled = on;
									} else {
										e.label = {
											enabled: true,
											title: e.name,
											dataKeys: [],
											offset: [0, 2, 0],
										};
									}
								})
							}
						/>
					</>
				}
			>
				{entity.label?.enabled ? (
					<>
						<TextField
							label="Title"
							value={entity.label.title}
							placeholder={entity.name || partName(part)}
							onChange={(v) =>
								edit("label.title", (e) => {
									if (e.label) {
										e.label.title = v;
									}
								})
							}
						/>

						<KeyPicker
							label="Values shown"
							selected={entity.label.dataKeys}
							onChange={(keys) =>
								edit("label.keys", (e) => {
									if (e.label) {
										e.label.dataKeys = keys;
									}
								})
							}
						/>

						<VectorField
							label="Card offset"
							axes={["X", "Y", "Z"]}
							values={entity.label.offset}
							onChange={(i, v) =>
								edit("label.offset", (e) => {
									if (e.label) {
										e.label.offset[i] = v;
									}
								})
							}
						/>
					</>
				) : (
					<Hint>Show a floating card with live values above this object.</Hint>
				)}
			</Section>

			<Section
				id="label.details"
				icon="info"
				title="Details in View mode"
				keywords="description stat tiles"
			>
				<TextField
					label="Description"
					multiline
					value={entity.details.description}
					onChange={(v) =>
						edit("details.description", (e) => {
							e.details.description = v;
						})
					}
				/>

				<KeyPicker
					label="Stat tiles"
					selected={entity.details.dataKeys}
					onChange={(keys) =>
						edit("details.keys", (e) => {
							e.details.dataKeys = keys;
						})
					}
				/>
			</Section>
		</>
	);
};

/** The Motion tab: the road it drives along, how fast, and where it starts. */
const MotionTab = ({ entity }: { entity: TEntity }) => {
	const roads = useEditor((s) => s.scene.roads);
	const sceneTurns = useEditor((s) => s.scene.turns);
	const edit = useEntityEdit(entity);
	const followedRoad = roads.find((r) => r.id === entity.follow?.roadId);
	const followedRoadLength = followedRoad
		? Math.max(1, Math.ceil(polylineLength(roadCenterlineOf(followedRoad), followedRoad.closed)))
		: 1;
	/** What this vehicle inherits: its road's setting, else the scene's. */
	const roadTurns = resolveTurns(sceneTurns, followedRoad?.turns, null);

	return (
		<Section
			id="motion.route"
			icon="route"
			title="Motion"
			keywords="drive road speed follow"
			actions={
				<CopyPasteMenu
					what="Motion"
					onCopy={() => copySettings(settingsOf(entity, "motion"))}
					onPaste={() => pasteFromClipboard()}
				/>
			}
		>
			<SelectField
				label="Drive along"
				value={entity.follow?.roadId ?? ""}
				options={[
					{ value: "", label: "Nothing (parked)" },
					...roads.map((r) => ({ value: r.id, label: r.name || ROAD_STYLE_LABELS[r.style] })),
				]}
				onChange={(roadId) =>
					edit("follow", (e) => {
						e.follow = roadId
							? {
									roadId,
									speed: e.follow?.speed ?? 2,
									offset: e.follow?.offset ?? 0,
									reverse: e.follow?.reverse ?? false,
									turns: e.follow?.turns ?? null,
								}
							: null;
					})
				}
			/>

			{entity.follow && (
				<>
					<SliderField
						label="Speed"
						value={entity.follow.speed}
						min={0}
						max={15}
						step={0.1}
						onChange={(v) =>
							edit("follow.speed", (e) => {
								if (e.follow) {
									e.follow.speed = v;
								}
							})
						}
					/>

					<SliderField
						label="Start point"
						value={entity.follow.offset}
						min={0}
						max={followedRoadLength}
						step={0.5}
						onChange={(v) =>
							edit("follow.offset", (e) => {
								if (e.follow) {
									e.follow.offset = v;
								}
							})
						}
					/>

					<SwitchField
						label="Drive the other way"
						checked={entity.follow.reverse}
						onChange={(v) =>
							edit("follow.reverse", (e) => {
								if (e.follow) {
									e.follow.reverse = v;
								}
							})
						}
					/>

					<SelectField<TTurns>
						label="Turns"
						value={entity.follow.turns ?? roadTurns}
						options={TURNS_OPTIONS}
						onChange={(v) =>
							edit("follow.turns", (e) => {
								if (e.follow) {
									e.follow.turns = v;
								}
							})
						}
						inherit={{
							// The road's own setting, or the scene's when the road has none.
							from: followedRoad?.turns ? "road" : "scene",
							inherited: entity.follow.turns === null,
							onReset: () =>
								edit("follow.turns", (e) => {
									if (e.follow) {
										e.follow.turns = null;
									}
								}),
							value: TURNS_LABELS[roadTurns].toLowerCase(),
						}}
					/>
				</>
			)}

			{entity.follow && (
				<ButtonGroup>
					<CameraFollowButtons entityId={entity.id} />
				</ButtonGroup>
			)}

			{roads.length === 0 && (
				<Hint>
					Draw a road first: Add to scene → Roads. Vehicles drive along roads and hidden routes.
				</Hint>
			)}
		</Section>
	);
};

/** An object whose part type this version doesn't have: it can only be deleted. */
const UnknownPart = ({ entity }: { entity: TEntity }) => {
	const removeEntity = useEditor((s) => s.removeEntity);
	return (
		<Section icon="info" title="Unknown part">
			<Hint>This object uses a part type (“{entity.kind}”) that isn’t available.</Hint>

			<Button variant="danger" size="sm" icon="trash" onClick={() => removeEntity(entity.id)}>
				Delete
			</Button>
		</Section>
	);
};

/** The properties tabs for a selected object (ADR-0054); which ones depend on its part. */
export const entityTabs = (entity: TEntity): IInspectorTab[] => {
	const part = getPart(entity.kind);
	if (!part) {
		return [
			{
				value: "object",
				label: "Object",
				icon: "cube",
				content: <UnknownPart key={entity.id} entity={entity} />,
			},
		];
	}
	const props = { entity, part };
	return [
		{
			value: "object",
			label: "Object",
			icon: "cube",
			content: <ObjectTab key={entity.id} {...props} />,
		},
		...(part.fields.length > 0
			? [
					{
						value: "shape",
						label: "Shape",
						icon: "spline",
						content: <ShapeTab key={entity.id} {...props} />,
					} as const,
				]
			: []),
		{
			value: "look",
			label: "Look",
			icon: "palette",
			content: <LookTab key={entity.id} {...props} />,
		},
		...(part.lights?.length
			? [
					{
						value: "lights",
						label: "Lights",
						icon: "bulb",
						content: <LightsTab key={entity.id} {...props} />,
					} as const,
				]
			: []),
		{
			value: "label",
			label: "Label",
			icon: "tag",
			content: <LabelTab key={entity.id} {...props} />,
		},
		...(part.canFollowPath
			? [
					{
						value: "motion",
						label: "Motion",
						icon: "route",
						content: <MotionTab key={entity.id} entity={entity} />,
					} as const,
				]
			: []),
	];
};
