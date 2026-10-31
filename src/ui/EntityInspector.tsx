import type { Draft } from "immer";

import { copySettings, pasteFromClipboard, settingsOf } from "#/editor/clipboard";
import { useSceneHours } from "#/editor/dayClock";
import { type ICommitOptions, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { normalizeDegrees, round, wrapDegrees } from "#/lib/math";
import { SWITCH_ON_DARKNESS } from "#/parts/lightModel";
import { SCALE_RANGE, SCALE_SETTING, scaleFromData, valuesOfEntity } from "#/parts/propData";
import { getPart, partName, type TAnyPart } from "#/parts/registry";
import type { ILightSpec } from "#/parts/types";
import { groundHeightAt } from "#/scene/areas";
import {
	polylineLength,
	ROAD_KIND_LABELS,
	resolveLeansInTurns,
	resolveTurnStyle,
	roadCenterlineOf,
	TURN_STYLE_LABELS,
	TURN_STYLE_OPTIONS,
} from "#/scene/roads";
import { rowColumnChoices, tableOfRow } from "#/scene/rowData";
import { FollowSchema, NO_LABEL, type TEntity, type TTurnStyle, type TVec3 } from "#/scene/schema";

/** A vehicle's driving as a new one has it, for Default / Reset. */
const FOLLOW_DEFAULTS = FollowSchema.parse({ roadId: "" });

import { Button, ButtonGroup, IconButton, IconButtonGroup } from "./Button";
import { CameraFollowButtons } from "./CameraFollowBar";
import { CopyPasteMenu } from "./CopyPasteMenu";
import { dataChoiceLabel } from "./DataBindingFields";
import { EntityDataTab } from "./EntityDataTab";
import { FollowDataNote } from "./FollowDataNote";
import { FollowsDataField } from "./FollowsDataField";
import {
	CheckboxGroupField,
	formatClock,
	Hint,
	resetToDefault,
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
	entity,
	selected,
	onChange,
}: {
	label: string;
	entity: TEntity;
	selected: string[];
	onChange: (keys: string[]) => void;
}) => {
	const data = useWorldData();
	// The world's values, then every column of its row (ADR-0108), filled or not.
	const choices = [
		...data.values.map((entry) => ({ value: entry.key, label: dataChoiceLabel(entry) })),
		...rowColumnChoices(tableOfRow(data, entity.dataRow)).map((choice) => ({
			value: choice.key,
			label: dataChoiceLabel(choice),
		})),
	];
	if (choices.length === 0) {
		return (
			<Hint>
				Add values in the Data tab, or give it a table row in its own Data tab, to show them here.
			</Hint>
		);
	}
	return (
		<CheckboxGroupField
			label={label}
			options={choices}
			value={selected}
			onChange={onChange}
			inherit={resetToDefault(selected, [], () => onChange([]), "none")}
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
	const areas = useEditor((s) => s.scene.areas);
	const setTab = useEditor((s) => s.setTab);
	const values = valuesOfEntity(entity, useWorldData());

	return (
		<>
			<Section
				icon={CATEGORY_ICONS[part.category]}
				title={partName(part)}
				actions={
					<IconButtonGroup>
						<IconButton
							icon={entity.isLocked ? "lock" : "unlock"}
							label={entity.isLocked ? "Unlock" : "Lock position"}
							pressed={entity.isLocked}
							onClick={() =>
								edit("locked", (e) => {
									e.isLocked = !e.isLocked;
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
					inherit={resetToDefault(
						entity.name,
						"",
						() =>
							edit("name", (e) => {
								e.name = "";
							}),
						partName(part),
					)}
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
						hasNoDefault
					/>
				)}

				{/* Y turns it around the vertical, then Z and X tip it about its own axes, in degrees
				(ADR-0097). A driving vehicle only turns around the vertical. */}
				{following ? (
					<SliderField
						label="Rotation"
						value={entity.rotation[1]}
						min={0}
						max={359}
						step={15}
						suffix="°"
						onChange={(v) =>
							edit("rotation", (e) => {
								e.rotation = [e.rotation[0], v, e.rotation[2]];
							})
						}
						inherit={resetToDefault(
							entity.rotation[1],
							0,
							() =>
								edit("rotation", (e) => {
									e.rotation = [e.rotation[0], 0, e.rotation[2]];
								}),
							"0°",
						)}
					/>
				) : (
					<VectorField
						label="Rotation (°)"
						axes={["X", "Y", "Z"]}
						values={entity.rotation}
						step={1}
						onChange={(axis, v) =>
							edit(`rotation.${axis}`, (e) => {
								const next: TVec3 = [...e.rotation];
								next[axis] = axis === 1 ? normalizeDegrees(v) : wrapDegrees(v);
								e.rotation = next;
							})
						}
						inherit={resetToDefault(
							entity.rotation,
							[0, 0, 0],
							() =>
								edit("rotation", (e) => {
									e.rotation = [0, 0, 0];
								}),
							"upright, facing +z",
						)}
					/>
				)}

				{entity.data[SCALE_SETTING] ? (
					<FollowsDataField
						label="Size"
						binding={entity.data[SCALE_SETTING]}
						data={values}
						range={SCALE_RANGE}
						shownNow={`${(scaleFromData(entity, values) ?? entity.scale).toFixed(2)}×`}
						showSetting={(value) => `${value.toFixed(2)}×`}
						onOpenData={() => setTab("objectData")}
					/>
				) : (
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
						inherit={resetToDefault(
							entity.scale,
							1,
							() =>
								edit("scale", (e) => {
									e.scale = 1;
								}),
							"1×",
						)}
					/>
				)}

				<SliderField
					label="Altitude"
					value={entity.altitude}
					min={-30}
					max={20}
					sliderMin={-5}
					step={0.1}
					onChange={(v) =>
						edit("altitude", (e) => {
							e.altitude = v;
						})
					}
					// Its default is standing on the ground under it (ADR-0098).
					inherit={resetToDefault(
						round(entity.altitude),
						round(groundHeightAt(areas, entity.position)),
						() =>
							edit("altitude", (e) => {
								e.altitude = round(groundHeightAt(areas, e.position));
							}),
						"on the ground",
					)}
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
	const setTab = useEditor((s) => s.setTab);
	const data = valuesOfEntity(entity, useWorldData());

	return (
		<PartShapeSection
			part={part}
			object={entity}
			data={data}
			dataBindings={entity.data}
			onOpenData={() => setTab("objectData")}
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
	const data = valuesOfEntity(entity, useWorldData());
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
	const data = valuesOfEntity(entity, useWorldData());
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
						// The windows' split changes every window light at once: one undo step for all of them.
						field?.startsWith("split")
							? { coalesce: `${entity.id}:lights:${field}` }
							: field
								? { coalesce: `${entity.id}:light:${lightId}:${field}` }
								: undefined,
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
							checked={entity.label.isShown}
							onChange={(on) =>
								edit("label", (e) => {
									e.label.isShown = on;
								})
							}
							// In the panel's header: a Reset icon once it's shown, no Default tag.
							inherit={{
								...resetToDefault(
									entity.label.isShown,
									false,
									() =>
										edit("label", (e) => {
											e.label.isShown = false;
										}),
									"hidden",
								),
								isCompact: true,
							}}
						/>
					</>
				}
			>
				{entity.label.isShown ? (
					<>
						<TextField
							label="Title"
							value={entity.label.title}
							placeholder={entity.name || partName(part)}
							onChange={(v) =>
								edit("label.title", (e) => {
									e.label.title = v;
								})
							}
							inherit={resetToDefault(
								entity.label.title,
								"",
								() =>
									edit("label.title", (e) => {
										e.label.title = "";
									}),
								"the object's name",
							)}
						/>

						<KeyPicker
							label="Values shown"
							entity={entity}
							selected={entity.label.dataKeys}
							onChange={(keys) =>
								edit("label.keys", (e) => {
									e.label.dataKeys = keys;
								})
							}
						/>

						<VectorField
							label="Card offset"
							axes={["X", "Y", "Z"]}
							values={entity.label.offset}
							onChange={(i, v) =>
								edit("label.offset", (e) => {
									e.label.offset[i] = v;
								})
							}
							inherit={resetToDefault(
								entity.label.offset,
								NO_LABEL.offset,
								() =>
									edit("label.offset", (e) => {
										e.label.offset = [...NO_LABEL.offset];
									}),
								NO_LABEL.offset.join(", "),
							)}
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
					inherit={resetToDefault(
						entity.details.description,
						"",
						() =>
							edit("details.description", (e) => {
								e.details.description = "";
							}),
						"none",
					)}
				/>

				<KeyPicker
					label="Stat tiles"
					entity={entity}
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
	const sceneTurns = useEditor((s) => s.scene.traffic.turnStyle);
	const sceneLeans = useEditor((s) => s.scene.traffic.leansInTurns);
	const edit = useEntityEdit(entity);
	const followedRoad = roads.find((r) => r.id === entity.follow?.roadId);
	const followedRoadLength = followedRoad
		? Math.max(1, Math.ceil(polylineLength(roadCenterlineOf(followedRoad), followedRoad.loops)))
		: 1;
	/** What this vehicle inherits: its road's setting, else the scene's. */
	const roadTurns = resolveTurnStyle(sceneTurns, followedRoad?.traffic.turnStyle, null);
	const roadLeans = resolveLeansInTurns(sceneLeans, followedRoad?.traffic.leansInTurns, null);
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
					...roads.map((r) => ({ value: r.id, label: r.name || ROAD_KIND_LABELS[r.kind] })),
				]}
				onChange={(roadId) =>
					edit("follow", (e) => {
						e.follow = roadId
							? {
									roadId,
									speed: e.follow?.speed ?? 2,
									startDistance: e.follow?.startDistance ?? 0,
									drivesTheOtherWay: e.follow?.drivesTheOtherWay ?? false,
									turnStyle: e.follow?.turnStyle ?? null,
									leansInTurns: e.follow?.leansInTurns ?? null,
								}
							: null;
					})
				}
				inherit={resetToDefault(
					entity.follow?.roadId ?? "",
					"",
					() =>
						edit("follow", (e) => {
							e.follow = null;
						}),
					"parked",
				)}
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
						inherit={resetToDefault(
							entity.follow.speed,
							FOLLOW_DEFAULTS.speed,
							() =>
								edit("follow.speed", (e) => {
									if (e.follow) {
										e.follow.speed = FOLLOW_DEFAULTS.speed;
									}
								}),
							`${FOLLOW_DEFAULTS.speed}`,
						)}
					/>

					<SliderField
						label="Start point"
						value={entity.follow.startDistance}
						min={0}
						max={followedRoadLength}
						step={0.5}
						onChange={(v) =>
							edit("follow.startDistance", (e) => {
								if (e.follow) {
									e.follow.startDistance = v;
								}
							})
						}
						inherit={resetToDefault(
							entity.follow.startDistance,
							0,
							() =>
								edit("follow.startDistance", (e) => {
									if (e.follow) {
										e.follow.startDistance = 0;
									}
								}),
							"the road's first point",
						)}
					/>

					<SwitchField
						label="Drive the other way"
						checked={entity.follow.drivesTheOtherWay}
						onChange={(v) =>
							edit("follow.drivesTheOtherWay", (e) => {
								if (e.follow) {
									e.follow.drivesTheOtherWay = v;
								}
							})
						}
						inherit={resetToDefault(
							entity.follow.drivesTheOtherWay,
							false,
							() =>
								edit("follow.drivesTheOtherWay", (e) => {
									if (e.follow) {
										e.follow.drivesTheOtherWay = false;
									}
								}),
							"off",
						)}
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
							from: followedRoad?.traffic.turnStyle ? "road" : "scene",
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
								from: followedRoad?.traffic.leansInTurns != null ? "road" : "scene",
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
		{
			value: "objectData",
			label: "Data",
			icon: "chart",
			content: <EntityDataTab key={entity.id} {...props} />,
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
