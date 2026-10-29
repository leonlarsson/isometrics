import type { Draft } from "immer";

import { copySettings, pasteFromClipboard, settingsOf } from "#/editor/clipboard";
import { useSceneHours } from "#/editor/dayClock";
import { type ICommitOptions, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { normalizeDegrees, wrapDegrees } from "#/lib/math";
import { SWITCH_ON_DARKNESS } from "#/parts/lightModel";
import { getPart, partName, type TAnyPart } from "#/parts/registry";
import type { ILightSpec } from "#/parts/types";
import {
	polylineLength,
	ROAD_STYLE_LABELS,
	resolveLeansInTurns,
	resolveTurnStyle,
	roadCenterlineOf,
	TURN_STYLE_LABELS,
	TURN_STYLE_OPTIONS,
} from "#/scene/roads";
import type { TEntity, TTurnStyle } from "#/scene/schema";

import { Button, ButtonGroup, IconButton, IconButtonGroup } from "./Button";
import { CameraFollowButtons } from "./CameraFollowBar";
import { CopyPasteMenu } from "./CopyPasteMenu";
import { FollowDataNote } from "./FollowDataNote";
import {
	CheckboxGroupField,
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
import { Menu } from "./Menu";
import { PartColorsSection, PartLightCards, PartShapeSection } from "./PartSettings";

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
						onChange={(i, v) => {
							// Through moveEntity, so it stands on the ground there (ADR-0098).
							const next: [number, number] = [entity.position[0], entity.position[1]];
							next[i] = v;
							useEditor.getState().moveEntity(entity.id, next, {
								coalesce: `${entity.id}:position`,
							});
						}}
					/>
				)}

				{/* X tips it (roll), Y turns it around the vertical, Z leans it (pitch), in degrees: applied
				turn, pitch, roll (ADR-0097). A driving vehicle only turns around the vertical. */}
				{following ? (
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
				) : (
					<VectorField
						label="Rotation (°)"
						axes={["X", "Y", "Z"]}
						values={[entity.roll, entity.rotation, entity.pitch]}
						step={1}
						onChange={(axis, v) =>
							edit(`rotation.${axis}`, (e) => {
								if (axis === 0) {
									e.roll = wrapDegrees(v);
								} else if (axis === 1) {
									e.rotation = normalizeDegrees(v);
								} else {
									e.pitch = wrapDegrees(v);
								}
							})
						}
					/>
				)}

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
					min={-30}
					max={20}
					sliderMin={-5}
					step={0.1}
					onChange={(v) =>
						edit("elevation", (e) => {
							e.elevation = v;
						})
					}
				/>

				{!following && (
					<Hint>
						Drag it or use the arrows in the scene · G move, R turn (then X, Y or Z for an axis), S
						resize · Q/E to rotate · hold Alt to place freely · Ctrl+drag or Shift+D moves a copy ·
						below 0 sinks it into the ground
					</Hint>
				)}
			</Section>
		</>
	);
};

/** The Shape tab: the part's own settings (floors, width, text…). */
const ShapeTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const setEntityProp = useEditor((s) => s.setEntityProp);
	const data = useEditor((s) => s.scene.data);

	return (
		<PartShapeSection
			part={part}
			object={entity}
			data={data}
			actions={
				<CopyPasteMenu
					what={`${partName(part)} shape`}
					onCopy={() => copySettings(settingsOf(entity, "shape"))}
					onPaste={() => pasteFromClipboard()}
				/>
			}
			onChange={(key, value) =>
				setEntityProp(entity.id, key, value, { coalesce: `${entity.id}:prop:${key}` })
			}
		/>
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

			<PartColorsSection
				part={part}
				object={entity}
				data={data}
				palette={palette}
				actions={
					<CopyPasteMenu
						what="Colours"
						onCopy={() => copySettings(settingsOf(entity, "colors"))}
						onPaste={() => pasteFromClipboard()}
					/>
				}
				onChange={(colorId, change, field) =>
					setEntityColor(
						entity.id,
						colorId,
						change,
						field ? { coalesce: `${entity.id}:color:${colorId}:${field}` } : undefined,
					)
				}
			/>
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
		lighting.whenLightsAreOn === "off"
			? {
					title: "Lights are off everywhere",
					text: "Time & light → Lights is set to Never, so no light in this world turns on after dark. Set it to After dark there.",
				}
			: lighting.whenLightsAreOn === "on" || lighting.timeSource !== "fixed"
				? null
				: hour === null
					? {
							title: "It's always day here",
							text: "This world shows classic daylight: the sun stays where it is and there's no clock, so lights that turn on after dark or on a schedule stay off. Pick a time in the Time & light tab, or set a light to turn on Always.",
						}
					: palette.night < SWITCH_ON_DARKNESS
						? {
								title: "It's daytime here",
								text: `It's ${formatClock(hour)} here and the time doesn't move, so lights that turn on after dark stay off. Pick a later time, or a day cycle, in the Time & light tab.`,
							}
						: null;

	return (
		<>
			{notDark && (
				<Section icon="clock" title={notDark.title}>
					<Hint>{notDark.text}</Hint>

					<Button size="sm" icon="sun" onClick={() => setTab("light")}>
						Open the Time & light tab
					</Button>
				</Section>
			)}

			<FollowDataNote title="Lights can follow data">
				A light can turn on, get brighter or change colour with a value from the Data tab, like a
				lamp that turns on while an alert is above 0.
			</FollowDataNote>

			<PartLightCards
				part={part}
				object={entity}
				data={data}
				palette={palette}
				hour={hour}
				menu={(spec) => <LightCopyPasteMenu entity={entity} spec={spec} />}
				onChange={(lightId, change, field) =>
					setEntityLight(
						entity.id,
						lightId,
						change,
						field ? { coalesce: `${entity.id}:light:${lightId}:${field}` } : undefined,
					)
				}
			/>
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
				defaultClosed
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
	const sceneTurns = useEditor((s) => s.scene.turnStyle);
	const sceneLeans = useEditor((s) => s.scene.leansInTurns);
	const edit = useEntityEdit(entity);
	const followedRoad = roads.find((r) => r.id === entity.follow?.roadId);
	const followedRoadLength = followedRoad
		? Math.max(1, Math.ceil(polylineLength(roadCenterlineOf(followedRoad), followedRoad.loops)))
		: 1;
	/** What this vehicle inherits: its road's setting, else the scene's. */
	const roadTurns = resolveTurnStyle(sceneTurns, followedRoad?.turnStyle, null);
	const roadLeans = resolveLeansInTurns(sceneLeans, followedRoad?.leansInTurns, null);
	// Whether its kind leans in turns at all (a part's turnLean).
	const leans = getPart(entity.kind)?.turnLean !== undefined;

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
									turnStyle: e.follow?.turnStyle ?? null,
									leansInTurns: e.follow?.leansInTurns ?? null,
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

					<SelectField<TTurnStyle>
						label="Turns"
						value={entity.follow.turnStyle ?? roadTurns}
						options={TURN_STYLE_OPTIONS}
						onChange={(v) =>
							edit("follow.turns", (e) => {
								if (e.follow) {
									e.follow.turnStyle = v;
								}
							})
						}
						inherit={{
							// The road's own setting, or the scene's when the road has none.
							from: followedRoad?.turnStyle ? "road" : "scene",
							inherited: entity.follow.turnStyle === null,
							onReset: () =>
								edit("follow.turns", (e) => {
									if (e.follow) {
										e.follow.turnStyle = null;
									}
								}),
							value: TURN_STYLE_LABELS[roadTurns].toLowerCase(),
						}}
					/>

					{/* Only kinds that lean (ADR-0082): nothing a car's settings could change makes it lean. */}
					{leans && (
						<SwitchField
							label="Lean in turns"
							checked={entity.follow.leansInTurns ?? roadLeans}
							onChange={(v) =>
								edit("follow.leans", (e) => {
									if (e.follow) {
										e.follow.leansInTurns = v;
									}
								})
							}
							inherit={{
								from: followedRoad?.leansInTurns != null ? "road" : "scene",
								inherited: entity.follow.leansInTurns === null,
								onReset: () =>
									edit("follow.leans", (e) => {
										if (e.follow) {
											e.follow.leansInTurns = null;
										}
									}),
								value: roadLeans ? "on" : "off",
							}}
						/>
					)}
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
