import type { Draft } from "immer";

import { type ICommitOptions, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { getPart, partName, resolveColors, resolveProps, type TAnyPart } from "#/parts/registry";
import type { TFieldSpec } from "#/parts/types";
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
import {
	CheckboxGroupField,
	ColorField,
	Hint,
	Section,
	SelectField,
	SliderField,
	SwitchField,
	TextField,
	VectorField,
} from "./fields";
import { CATEGORY_ICONS, type IInspectorTab } from "./inspectorTabs";

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
}: {
	label: string;
	value: string;
	onChange: (key: string) => void;
}) => {
	const data = useEditor((s) => s.scene.data);
	return (
		<SelectField
			label={label}
			value={value}
			options={[
				{ value: "", label: "None" },
				...data.map((entry) => ({ value: entry.key, label: entry.label || entry.key })),
			]}
			onChange={onChange}
			hint={data.length === 0 ? "Add values in the Data tab to show one here." : undefined}
		/>
	);
};

const PropField = ({
	spec,
	value,
	onChange,
}: {
	spec: TFieldSpec;
	value: unknown;
	onChange: (value: unknown) => void;
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
				/>
			);
		case "boolean":
			return <SwitchField label={spec.label} checked={Boolean(value)} onChange={onChange} />;
		case "text":
			return (
				<TextField
					label={spec.label}
					value={String(value ?? "")}
					placeholder={spec.placeholder}
					onChange={onChange}
				/>
			);
		case "dataKey":
			return <DataKeyField label={spec.label} value={String(value ?? "")} onChange={onChange} />;
		case "select":
			return (
				<SelectField
					label={spec.label}
					value={String(value)}
					options={spec.options}
					onChange={onChange}
				/>
			);
		case "color":
			// With the other colours, in the Look tab (LookTab).
			return null;
	}
};

/** A part's own settings for the Shape tab: all but its colours, which are in the Look tab. */
const shapeFields = (part: TAnyPart) => part.fields.filter((spec) => spec.type !== "color");

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
						Alt to place freely
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
		<Section id="shape.part" icon="spline" title={`${partName(part)} shape`} keywords="shape size">
			{shapeFields(part).map((spec) => (
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

/** The Look tab: colours, and lights after dark. */
const LookTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const palette = usePalette();
	const edit = useEntityEdit(entity);
	const setEntityProp = useEditor((s) => s.setEntityProp);
	const colors = resolveColors(part, entity, palette);
	const props = resolveProps(part, entity.props) as Record<string, unknown>;

	return (
		<>
			<Section id="look.colours" icon="palette" title="Colours" keywords="colors paint">
				<ColorField
					label={part.colorLabel ?? "Main colour"}
					value={colors.color}
					onChange={(v) =>
						edit("color", (e) => {
							e.color = v;
						})
					}
					inherit={{
						from: "default",
						inherited: entity.color === null,
						onReset: () =>
							edit("color", (e) => {
								e.color = null;
							}),
					}}
				/>

				{part.accentLabel !== "Unused" && (
					<ColorField
						label={part.accentLabel ?? "Accent"}
						value={colors.accent}
						onChange={(v) =>
							edit("accent", (e) => {
								e.accent = v;
							})
						}
						inherit={{
							from: "default",
							inherited: entity.accent === null,
							onReset: () =>
								edit("accent", (e) => {
									e.accent = null;
								}),
						}}
					/>
				)}

				{/* The part's own colours, e.g. a race car's rain light. Null follows its default. */}
				{part.fields.map(
					(spec) =>
						spec.type === "color" && (
							<ColorField
								key={spec.key}
								label={spec.label}
								value={typeof props[spec.key] === "string" ? String(props[spec.key]) : spec.default}
								onChange={(v) =>
									setEntityProp(entity.id, spec.key, v, {
										coalesce: `${entity.id}:prop:${spec.key}`,
									})
								}
								inherit={{
									from: "default",
									inherited: props[spec.key] === null,
									onReset: () => setEntityProp(entity.id, spec.key, null),
								}}
							/>
						),
				)}
			</Section>

			{part.lights && (
				<Section id="look.lights" icon="bulb" title="Lights" keywords="night headlights lamps">
					<SelectField<TEntity["lights"]>
						label={part.lights.label ?? (part.lights.whileDriving ? "Headlights" : "Lights on")}
						value={entity.lights}
						options={[
							{
								value: "auto",
								label: part.lights.whileDriving ? "After dark, while driving" : "After dark",
							},
							{ value: "on", label: "Always" },
							{ value: "off", label: "Never" },
						]}
						onChange={(lights) =>
							edit("lights", (e) => {
								e.lights = lights;
							})
						}
						hint={
							part.lights.whileDriving
								? "Always: day and night, even parked."
								: "Always: lit day and night too."
						}
					/>
				</Section>
			)}
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
		<Section id="motion.route" icon="route" title="Motion" keywords="drive road speed follow">
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
		...(shapeFields(part).length > 0
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
