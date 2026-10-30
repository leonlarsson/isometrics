import type { Draft } from "immer";
import type { ReactNode } from "react";

import { copySettings, pasteFromClipboard, settingsOf } from "#/editor/clipboard";
import { useSceneHours } from "#/editor/dayClock";
import type { ISceneItem } from "#/editor/framing";
import { type ICommitOptions, listOf, newId, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { FENCE_STYLE_LABELS } from "#/fences/registry";
import { round } from "#/lib/math";
import {
	COLOR_DATA,
	colorSettingOf,
	resolveColorDefault,
	resolveTransparency,
} from "#/parts/colorModel";
import { comesOnOf, lightDefaults } from "#/parts/lightModel";
import { getPart, partName, partNameOf, resolveProps, type TAnyPart } from "#/parts/registry";
import type { IColorSpec, ILightSpec } from "#/parts/types";
import { AREA_KIND_LABELS, groundHeightAt } from "#/scene/areas";
import type { TColorSettingChange } from "#/scene/objectSettings";
import { ROAD_KIND_LABELS } from "#/scene/roads";
import type { TEntity, TScene } from "#/scene/schema";

import { IconButton, IconButtonGroup } from "./Button";
import { CopyPasteMenu } from "./CopyPasteMenu";
import { DataDrivenField } from "./DataDrivenField";
import { LightCopyPasteMenu } from "./EntityInspector";
import { FollowDataNote } from "./FollowDataNote";
import { ColorField, FieldGroup, Hint, Kbd, resetToDefault, Section, SliderField } from "./fields";
import type { IInspectorTab } from "./inspectorTabs";
import { LightSettings, type TLightSettingKey } from "./LightSettings";
import { List, ListItem } from "./List";
import { PropField } from "./PartSettings";

/** A selected object whose part this version has, with that part. */
interface IMember {
	entity: TEntity;
	part: TAnyPart;
}

/** Whether values differ (compared as JSON, so arrays and bindings compare by content). */
const differ = (values: readonly unknown[]) =>
	new Set(values.map((value) => JSON.stringify(value ?? null))).size > 1;

/**
 * Write to several objects as one undo step (ADR-0064): edits of the same
 * setting (typing, sliding) share a key, one-off changes get their own.
 */
const writeTo = (entities: readonly TEntity[]) => {
	const ids = entities.map((entity) => entity.id).join(",");
	return (write: (id: string, options: ICommitOptions) => void, field?: string) => {
		const options = { coalesce: field ? `group:${ids}:${field}` : newId("group") };
		for (const entity of entities) {
			write(entity.id, options);
		}
	};
};

/** What an item is: its part, road style, fence style or area type. */
const kindNameOf = (scene: TScene, item: ISceneItem) => {
	if (item.kind === "entity") {
		const entity = scene.entities.find((e) => e.id === item.id);
		return entity ? (partNameOf(entity.kind) ?? entity.kind) : "";
	}
	if (item.kind === "road") {
		const road = scene.roads.find((r) => r.id === item.id);
		return road ? ROAD_KIND_LABELS[road.kind] : "";
	}
	if (item.kind === "fence") {
		const fence = scene.fences.find((f) => f.id === item.id);
		return fence ? FENCE_STYLE_LABELS[fence.kind] : "";
	}
	const area = scene.areas.find((a) => a.id === item.id);
	return area ? AREA_KIND_LABELS[area.kind] : "";
};

/** The selected things by what they are, in the order first selected: "Round tree", 2 of them… */
const kindsOf = (scene: TScene, items: readonly ISceneItem[]) => {
	const kinds = new Map<string, ISceneItem[]>();
	for (const item of items) {
		const name = kindNameOf(scene, item);
		kinds.set(name, [...(kinds.get(name) ?? []), item]);
	}
	return [...kinds.entries()];
};

/** Which of the selected things a setting is on: "On all 6 selected", "On 2 of 6: Round tree (2)". */
const appliesTo = (holders: readonly IMember[], total: number) => {
	if (holders.length === total) {
		return total === 2 ? "On both selected" : `On all ${total} selected`;
	}
	const counts = new Map<string, number>();
	for (const { part } of holders) {
		counts.set(partName(part), (counts.get(partName(part)) ?? 0) + 1);
	}
	const kinds = [...counts.entries()].map(([name, count]) => `${name} (${count})`).join(", ");
	return `On ${holders.length} of ${total} selected: ${kinds}`;
};

/**
 * What's selected, by kind, at the top of every tab (ADR-0064): click a kind
 * to keep only those selected, Ctrl-click to take them out. Hide, lock,
 * duplicate and delete act on all of them.
 */
const SelectionPanel = ({ items }: { items: readonly ISceneItem[] }) => {
	const store = () => useEditor.getState();
	const scene = useEditor((s) => s.scene);
	const things = items.flatMap(
		(item) => listOf(scene, item.kind).find((thing) => thing.id === item.id) ?? [],
	);
	const allHidden = things.every((thing) => thing.isHidden);
	const allLocked = things.every((thing) => thing.isLocked);

	return (
		<Section
			id="group.selection"
			icon="layers"
			title={`Selection · ${items.length}`}
			keywords="selected multi several group"
			actions={
				<IconButtonGroup>
					<IconButton
						icon={allHidden ? "eyeOff" : "eye"}
						label={allHidden ? "Show them (H)" : "Hide them (H)"}
						pressed={allHidden}
						onClick={() => store().setSelectedFlag("isHidden", !allHidden)}
					/>

					<IconButton
						icon={allLocked ? "lock" : "unlock"}
						label={allLocked ? "Unlock them" : "Lock them"}
						pressed={allLocked}
						onClick={() => store().setSelectedFlag("isLocked", !allLocked)}
					/>

					<IconButton
						icon="copy"
						label="Duplicate them (Ctrl+D)"
						onClick={() => store().duplicateSelected()}
					/>

					<IconButton
						icon="trash"
						label="Delete them (Del)"
						onClick={() => store().removeSelected()}
					/>
				</IconButtonGroup>
			}
		>
			<List>
				{kindsOf(scene, items).map(([name, kindItems]) => (
					<ListItem
						key={name}
						label={name}
						meta={String(kindItems.length)}
						onClick={({ ctrlKey, metaKey }) =>
							store().selectItems(
								ctrlKey || metaKey ? items.filter((item) => !kindItems.includes(item)) : kindItems,
							)
						}
					/>
				))}
			</List>

			<Hint>
				Click a kind to keep only those, <Kbd>Ctrl</Kbd>-click to take them out.
			</Hint>
		</Section>
	);
};

/** A group tab's panels under the Selection panel. */
const WithSelection = ({
	items,
	children,
}: {
	items: readonly ISceneItem[];
	children: ReactNode;
}) => {
	return (
		<>
			<SelectionPanel items={items} />

			{children}
		</>
	);
};

/** The Object tab for several things: the transform of the objects among them. */
const GroupObjectTab = ({ members, total }: { members: readonly IMember[]; total: number }) => {
	const entities = members.map((member) => member.entity);
	const writeAll = writeTo(entities);
	const edit = (field: string, recipe: (entity: Draft<TEntity>) => void) =>
		writeAll((id, options) => useEditor.getState().updateEntity(id, recipe, options), field);
	const areas = useEditor((s) => s.scene.areas);
	/** Where an object stands on the ground under it, its altitude's default (ADR-0098). */
	const onTheGround = (entity: Pick<TEntity, "position">) =>
		round(groundHeightAt(areas, entity.position));

	return (
		<Section
			id="object.transform"
			icon="move"
			title="Transform"
			keywords="position location rotation size scale"
		>
			{entities.length > 0 && (
				<>
					{entities.length < total && <Hint>{appliesTo(members, total)}</Hint>}

					<SliderField
						label="Rotation"
						value={entities.at(-1)?.rotation[1] ?? 0}
						mixed={differ(entities.map((entity) => entity.rotation[1]))}
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
							entities.every((entity) => entity.rotation[1] === 0),
							true,
							() =>
								edit("rotation", (e) => {
									e.rotation = [e.rotation[0], 0, e.rotation[2]];
								}),
							"0°",
						)}
					/>

					<SliderField
						label="Size"
						value={entities.at(-1)?.scale ?? 1}
						mixed={differ(entities.map((entity) => entity.scale))}
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
							entities.every((entity) => entity.scale === 1),
							true,
							() =>
								edit("scale", (e) => {
									e.scale = 1;
								}),
							"1×",
						)}
					/>

					<SliderField
						label="Altitude"
						value={entities.at(-1)?.altitude ?? 0}
						mixed={differ(entities.map((entity) => entity.altitude))}
						min={0}
						max={20}
						step={0.1}
						onChange={(v) =>
							edit("altitude", (e) => {
								e.altitude = v;
							})
						}
						inherit={resetToDefault(
							entities.every((entity) => round(entity.altitude) === onTheGround(entity)),
							true,
							() =>
								edit("altitude", (e) => {
									e.altitude = onTheGround(e);
								}),
							"on the ground",
						)}
					/>
				</>
			)}

			<Hint>
				{entities.length > 0
					? "These set each one in place. To move, turn or resize them as a group, around their middle, drag the arrows in the scene · G move, R turn, S resize · Q/E to rotate · Ctrl+drag or Shift+D moves copies."
					: "Drag the arrows in the scene to move, turn or resize them as a group, around their middle · G move, R turn, S resize · Q/E to rotate · Ctrl+drag or Shift+D moves copies."}
			</Hint>
		</Section>
	);
};

/** The Shape tab for objects of the same part: its settings, Mixed where they differ. */
const GroupShapeTab = ({ members, total }: { members: readonly IMember[]; total: number }) => {
	const part = members[0].part;
	const writeAll = writeTo(members.map((member) => member.entity));
	const props = members.map((member) => resolveProps(part, member.entity.props));
	const data = useEditor((s) => s.scene.data);

	return (
		<Section
			id="shape.part"
			icon="spline"
			title={`${partName(part)} shape`}
			keywords="shape size"
			actions={
				<CopyPasteMenu
					what={`${partName(part)} shape`}
					onCopy={() => copySettings(settingsOf(members[members.length - 1].entity, "shape"))}
					onPaste={() => pasteFromClipboard()}
				/>
			}
		>
			{members.length < total && <Hint>{appliesTo(members, total)}</Hint>}

			{part.fields.map((spec) => (
				<PropField
					key={spec.key}
					spec={spec}
					value={props.at(-1)?.[spec.key]}
					fallback={(part.schema.parse({}) as Record<string, unknown>)[spec.key]}
					mixed={differ(props.map((values) => values[spec.key]))}
					data={data}
					onChange={(v) =>
						writeAll(
							(id, options) => useEditor.getState().setEntityProp(id, spec.key, v, options),
							`prop:${spec.key}`,
						)
					}
				/>
			))}
		</Section>
	);
};

/**
 * Every colour any selected object's part has (by id, ADR-0060), with the
 * objects that have it, the last selected first. Its spec is the last of
 * those objects' (the one whose values show).
 */
const colorsOf = (members: readonly IMember[]) => {
	const colors = new Map<string, { spec: IColorSpec; holders: IMember[] }>();
	for (const member of [...members].reverse()) {
		for (const spec of member.part.colors) {
			const entry = colors.get(spec.id) ?? { spec, holders: [] };
			entry.holders.unshift(member);
			colors.set(spec.id, entry);
		}
	}
	return [...colors.values()];
};

/** Every light any selected object's part has, by id and shape (ADR-0058), like colorsOf. */
const lightsOf = (members: readonly IMember[]) => {
	const lights = new Map<string, { spec: ILightSpec; holders: IMember[] }>();
	for (const member of [...members].reverse()) {
		for (const spec of member.part.lights ?? []) {
			const key = `${spec.id}:${spec.shape}`;
			const entry = lights.get(key) ?? { spec, holders: [] };
			entry.holders.unshift(member);
			lights.set(key, entry);
		}
	}
	return [...lights.values()];
};

/** The Look tab for several objects: every colour any of them has, saying which have it. */
const GroupLookTab = ({ members, total }: { members: readonly IMember[]; total: number }) => {
	const palette = usePalette();
	const data = useEditor((s) => s.scene.data);

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
						onCopy={() => {
							const last = members.at(-1);
							copySettings(last ? settingsOf(last.entity, "colors") : null);
						}}
						onPaste={() => pasteFromClipboard()}
					/>
				}
			>
				{colorsOf(members).map(({ spec, holders }) => {
					const entities = holders.map((holder) => holder.entity);
					const writeAll = writeTo(entities);
					const active = entities.at(-1);
					// Each one's colour as it shows, from its own part's spec for this id.
					const shown = holders.map(({ entity, part }) => {
						const own = part.colors.find((color) => color.id === spec.id) ?? spec;
						return (
							colorSettingOf(entity, spec.id)?.color ?? resolveColorDefault(own.default, palette)
						);
					});
					const bindings = entities.map((entity) => colorSettingOf(entity, spec.id)?.data.color);
					// See-through when every one of them has it see-through, each as it shows.
					const seeThrough = holders.every(({ part }) =>
						part.colors.some((color) => color.id === spec.id && color.seeThrough),
					);
					const transparencies = holders.map(({ entity, part }) =>
						resolveTransparency(part.colors.find((color) => color.id === spec.id) ?? spec, entity),
					);
					const inherited = holders.every(
						({ entity }) => colorSettingOf(entity, spec.id)?.color == null,
					);
					const change = (colorChange: TColorSettingChange, field?: string) =>
						writeAll(
							(id, options) =>
								useEditor.getState().setEntityColor(id, spec.id, colorChange, options),
							field && `color:${spec.id}:${field}`,
						);
					return (
						<FieldGroup key={spec.id} title={spec.name}>
							<Hint>{appliesTo(holders, total)}</Hint>

							<DataDrivenField
								kind={COLOR_DATA.color}
								binding={active ? colorSettingOf(active, spec.id)?.data.color : undefined}
								mixed={differ(bindings)}
								data={data}
								onBindingChange={(binding, field) =>
									change({ data: { color: binding } }, field && `data.${field}`)
								}
							>
								<ColorField
									label="Colour"
									value={shown.at(-1) ?? ""}
									mixed={differ(shown)}
									onChange={(color) => change({ color }, "color")}
									inherit={{
										from: "default",
										inherited,
										onReset: () => change({ color: null }),
									}}
								/>
							</DataDrivenField>

							{/* Glass and the like: how see-through it is (ADR-0090). */}
							{seeThrough && (
								<SliderField
									label="Transparency"
									value={Math.round((transparencies.at(-1) ?? 0) * 100)}
									mixed={differ(transparencies)}
									min={0}
									max={100}
									step={1}
									suffix="%"
									onChange={(value) => change({ transparency: value / 100 }, "transparency")}
									inherit={{
										from: "default",
										inherited: entities.every(
											(entity) => colorSettingOf(entity, spec.id)?.transparency == null,
										),
										onReset: () => change({ transparency: null }),
									}}
									hint="0% is solid, 100% clear."
								/>
							)}
						</FieldGroup>
					);
				})}
			</Section>
		</>
	);
};

/** The Lights tab for several objects: a card for every light any of them has, saying which have it. */
const GroupLightsTab = ({ members, total }: { members: readonly IMember[]; total: number }) => {
	const palette = usePalette();
	const data = useEditor((s) => s.scene.data);
	const hour = useSceneHours();

	return (
		<>
			<FollowDataNote title="Lights can follow data">
				A light can turn on, get brighter or change colour with a value from the Data tab, like a
				lamp that turns on while an alert is above 0.
			</FollowDataNote>

			{lightsOf(members).map(({ spec, holders }) => {
				const writeAll = writeTo(holders.map((holder) => holder.entity));
				// Each one's settings for this light as they show, to see which differ.
				const shown = holders.map(({ entity, part }) => {
					const own = (part.lights ?? []).find((light) => light.id === spec.id) ?? spec;
					const setting = entity.lights[spec.id];
					const defaults = lightDefaults(own, palette);
					return {
						mode: setting?.whenOn ?? "auto",
						comesOn: comesOnOf(own, setting),
						schedule: setting?.schedule ?? [],
						color: setting?.color ?? defaults.color,
						strength: setting?.strength ?? defaults.strength,
						reach: setting?.reach ?? defaults.reach,
						litPaneShare: setting?.litPaneShare ?? defaults.litPaneShare,
						data: setting?.data ?? {},
					};
				});
				const mixed = (key: TLightSettingKey) =>
					key.startsWith("data.")
						? differ(shown.map((light) => light.data[key.slice(5)]))
						: differ(shown.map((light) => light[key as keyof (typeof shown)[number]]));
				const { entity: active, part: activePart } = holders[holders.length - 1];
				const setting = active.lights[spec.id];
				const windowWeights = (activePart.lights ?? [])
					.filter((light) => light.shape === "windows")
					.reduce((sum, light) => sum + (light.paneWeight ?? 1), 0);
				return (
					<LightSettings
						key={`${spec.id}:${spec.shape}`}
						spec={spec}
						defaults={lightDefaults(spec, palette)}
						setting={setting}
						data={data}
						hour={hour}
						windowShare={
							spec.shape === "windows" ? (spec.paneWeight ?? 1) / windowWeights : undefined
						}
						mixed={mixed}
						appliesTo={appliesTo(holders, total)}
						menu={<LightCopyPasteMenu entity={active} spec={spec} />}
						onChange={(change, field) =>
							writeAll(
								(id, options) => useEditor.getState().setEntityLight(id, spec.id, change, options),
								field && `light:${spec.id}:${field}`,
							)
						}
					/>
				);
			})}
		</>
	);
};

/**
 * The properties tabs for several selected things (ADR-0064), each headed by
 * the Selection panel: Object always, then Shape when the objects among them
 * are all the same part, and Look and Lights with every colour and light any
 * of them has, each saying which objects it's on.
 */
export const groupTabs = (
	items: readonly ISceneItem[],
	entities: readonly TEntity[],
): IInspectorTab[] => {
	const key = items.map((item) => item.id).join(",");
	const members = entities.flatMap((entity) => {
		const part = getPart(entity.kind);
		return part ? [{ entity, part }] : [];
	});
	const total = items.length;
	const samePart =
		members.length > 0 && members.every((member) => member.entity.kind === members[0].entity.kind);
	const props = { members, total };
	const tab = (content: ReactNode) => (
		<WithSelection key={key} items={items}>
			{content}
		</WithSelection>
	);
	return [
		{
			value: "object",
			label: "Object",
			icon: "cube",
			content: tab(<GroupObjectTab {...props} />),
		},
		...(samePart && members[0].part.fields.length > 0
			? [
					{
						value: "shape",
						label: "Shape",
						icon: "spline",
						content: tab(<GroupShapeTab {...props} />),
					} as const,
				]
			: []),
		...(colorsOf(members).length > 0
			? [
					{
						value: "look",
						label: "Look",
						icon: "palette",
						content: tab(<GroupLookTab {...props} />),
					} as const,
				]
			: []),
		...(lightsOf(members).length > 0
			? [
					{
						value: "lights",
						label: "Lights",
						icon: "bulb",
						content: tab(<GroupLightsTab {...props} />),
					} as const,
				]
			: []),
	];
};
