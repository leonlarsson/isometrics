import type { Draft } from "immer";

import { type ICommitOptions, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { getPart, resolveColors, resolveProps } from "#/parts/registry";
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
		case "select":
			return (
				<SelectField
					label={spec.label}
					value={String(value)}
					options={spec.options}
					onChange={onChange}
				/>
			);
	}
};

export const EntityInspector = ({ entity }: { entity: TEntity }) => {
	const updateEntity = useEditor((s) => s.updateEntity);
	const removeEntity = useEditor((s) => s.removeEntity);
	const duplicateEntity = useEditor((s) => s.duplicateEntity);
	const roads = useEditor((s) => s.scene.roads);
	const sceneTurns = useEditor((s) => s.scene.turns);
	const palette = usePalette();
	const part = getPart(entity.kind);

	/** Every edit coalesces per entity+field so typing or sliding is one undo step. */
	const edit = (field: string, recipe: (e: Draft<TEntity>) => void) => {
		const options: ICommitOptions = { coalesce: `${entity.id}:${field}` };
		updateEntity(entity.id, recipe, options);
	};

	if (!part) {
		return (
			<Section title="Unknown part">
				<Hint>This object uses a part type (“{entity.kind}”) that isn’t available.</Hint>

				<Button variant="danger" size="sm" icon="trash" onClick={() => removeEntity(entity.id)}>
					Delete
				</Button>
			</Section>
		);
	}

	const props = resolveProps(part, entity.props);
	const followedRoad = roads.find((r) => r.id === entity.follow?.roadId);
	const followedRoadLength = followedRoad
		? Math.max(1, Math.ceil(polylineLength(roadCenterlineOf(followedRoad), followedRoad.closed)))
		: 1;
	const colors = resolveColors(part, entity, palette);
	const following = entity.follow !== null;
	/** What this vehicle inherits: its road's setting, else the scene's. */
	const roadTurns = resolveTurns(sceneTurns, followedRoad?.turns, null);

	return (
		<>
			<Section
				title={part.name}
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
					placeholder={part.name}
					onChange={(v) =>
						edit("name", (e) => {
							e.name = v;
						})
					}
				/>
			</Section>

			<Section title="Position">
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

			<Section title="Colours">
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
			</Section>

			{part.fields.length > 0 && (
				<Section title="Shape">
					{part.fields.map((spec) => (
						<PropField
							key={spec.key}
							spec={spec}
							value={props[spec.key]}
							onChange={(v) =>
								edit(`prop:${spec.key}`, (e) => {
									e.props = { ...props, [spec.key]: v };
								})
							}
						/>
					))}
				</Section>
			)}

			<Section
				title="Label"
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
							placeholder={entity.name || part.name}
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

			{part.canFollowPath && (
				<Section title="Motion">
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
			)}

			<Section title="Details (view mode)">
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
