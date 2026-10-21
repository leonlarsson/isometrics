import type { Draft } from "immer";

import { type ICommitOptions, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { getPart, resolveColors, resolveProps } from "#/parts/registry";
import type { TFieldSpec } from "#/parts/types";
import { polylineLength, ROAD_STYLE_LABELS, roadCenterlineOf } from "#/scene/roads";
import type { TEntity } from "#/scene/schema";

import { ColorField, Section, Select, SliderField, TextInput, Toggle, VectorField } from "./fields";
import { Icon } from "./Icon";

import styles from "./Fields.module.css";

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
		return <p className={styles.hint}>Add values in the Data tab to show them here.</p>;
	}
	return (
		<fieldset className={styles.checklist}>
			<legend className={styles.label}>{label}</legend>

			{data.map((entry) => (
				<label key={entry.key} className={styles.check}>
					<input
						type="checkbox"
						checked={selected.includes(entry.key)}
						onChange={(e) =>
							onChange(
								e.target.checked
									? [...selected, entry.key]
									: selected.filter((k) => k !== entry.key),
							)
						}
					/>

					<span>{entry.label || entry.key}</span>
				</label>
			))}
		</fieldset>
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
			return <Toggle label={spec.label} checked={Boolean(value)} onChange={onChange} />;
		case "select":
			return (
				<Select
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
				<p className={styles.hint}>
					This object uses a part type (“{entity.kind}”) that isn’t available.
				</p>

				<button
					type="button"
					className={styles.dangerButton}
					onClick={() => removeEntity(entity.id)}
				>
					<Icon name="trash" size={16} /> Delete
				</button>
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

	return (
		<>
			<Section
				title={part.name}
				actions={
					<div className={styles.iconActions}>
						<button
							type="button"
							className={styles.iconButton}
							title={entity.locked ? "Unlock" : "Lock position"}
							aria-pressed={entity.locked}
							onClick={() =>
								edit("locked", (e) => {
									e.locked = !e.locked;
								})
							}
						>
							<Icon name={entity.locked ? "lock" : "unlock"} size={16} />
						</button>

						<button
							type="button"
							className={styles.iconButton}
							title="Duplicate (Ctrl+D)"
							onClick={() => duplicateEntity(entity.id)}
						>
							<Icon name="copy" size={16} />
						</button>

						<button
							type="button"
							className={styles.iconButton}
							title="Delete (Del)"
							onClick={() => removeEntity(entity.id)}
						>
							<Icon name="trash" size={16} />
						</button>
					</div>
				}
			>
				<TextInput
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
					<p className={styles.hint}>
						Drag in the scene to move · Q/E to rotate · hold Alt to place freely
					</p>
				)}
			</Section>

			<Section title="Colours">
				<ColorField
					label={part.colorLabel ?? "Main colour"}
					value={colors.color}
					isDefault={entity.color === null}
					onChange={(v) =>
						edit("color", (e) => {
							e.color = v;
						})
					}
					onReset={() =>
						edit("color", (e) => {
							e.color = null;
						})
					}
				/>

				{part.accentLabel !== "Unused" && (
					<ColorField
						label={part.accentLabel ?? "Accent"}
						value={colors.accent}
						isDefault={entity.accent === null}
						onChange={(v) =>
							edit("accent", (e) => {
								e.accent = v;
							})
						}
						onReset={() =>
							edit("accent", (e) => {
								e.accent = null;
							})
						}
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
					<Toggle
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
						<TextInput
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
					<p className={styles.hint}>Show a floating card with live values above this object.</p>
				)}
			</Section>

			{part.canFollowPath && (
				<Section title="Motion">
					<Select
						label="Drive along"
						value={entity.follow?.roadId ?? ""}
						options={[
							{ value: "", label: "Nothing (parked)" },
							...roads.map((r) => ({ value: r.id, label: r.name || ROAD_STYLE_LABELS[r.style] })),
						]}
						onChange={(roadId) =>
							edit("follow", (e) => {
								e.follow = roadId
									? { roadId, speed: e.follow?.speed ?? 2, offset: e.follow?.offset ?? 0 }
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
						</>
					)}

					{roads.length === 0 && (
						<p className={styles.hint}>
							Draw a road first: Add to scene → Roads. Vehicles drive along roads and hidden routes.
						</p>
					)}
				</Section>
			)}

			<Section title="Details (view mode)">
				<TextInput
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
