import { type ReactNode, useState } from "react";

import type { ISceneItem } from "#/editor/framing";
import { listOf, useEditor } from "#/editor/store";
import { getPart, partNameOf } from "#/parts/registry";
import { AREA_TYPE_LABELS } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TArea, TEntity, TRoad } from "#/scene/schema";

import { ContextMenu, Menu } from "./Menu";
import { RenamePopover } from "./RenamePopover";
import { useLastNonNull } from "./useLastNonNull";
import { saveCurrentView } from "./ViewpointsMenu";

/** What to call a road in a menu: its name, or its style. */
const roadName = (road: { name: string; style: keyof typeof ROAD_STYLE_LABELS }) =>
	road.name || ROAD_STYLE_LABELS[road.style];

/** Actions only objects have: driving and the camera for vehicles, the label card for all. */
const EntityActions = ({ id }: { id: string }) => {
	const entity = useEditor((s) => s.scene.entities.find((e) => e.id === id));
	const roads = useEditor((s) => s.scene.roads);
	const store = () => useEditor.getState();
	const part = entity ? getPart(entity.kind) : undefined;
	if (!entity) {
		return null;
	}

	const driveAlong = (roadId: string | null) =>
		store().updateEntity(entity.id, (e) => {
			e.follow = roadId
				? {
						roadId,
						speed: e.follow?.speed ?? 2,
						offset: e.follow?.offset ?? 0,
						reverse: e.follow?.reverse ?? false,
						turns: e.follow?.turns ?? null,
					}
				: null;
		});

	return (
		<>
			{entity.follow && (
				<Menu.Item
					icon="focus"
					label="Follow with the camera"
					onClick={() => store().followWithCamera(entity.id, false)}
				/>
			)}

			{entity.follow && (
				<Menu.Item
					icon="perspective"
					label="Ride along"
					onClick={() => store().followWithCamera(entity.id, true)}
				/>
			)}

			{part?.canFollowPath && (
				<Menu.Submenu icon="play" label="Drive along">
					{roads.length === 0 && <Menu.Item label="No roads yet" disabled onClick={() => {}} />}

					{roads.map((road) => (
						<Menu.Item
							key={road.id}
							icon={entity.follow?.roadId === road.id ? "check" : undefined}
							label={roadName(road)}
							onClick={() => driveAlong(road.id)}
						/>
					))}

					{entity.follow && <Menu.Separator />}

					{entity.follow && (
						<Menu.Item icon="pause" label="Park it" onClick={() => driveAlong(null)} />
					)}
				</Menu.Submenu>
			)}

			{(entity.follow || part?.canFollowPath) && <Menu.Separator />}

			<Menu.CheckboxItem
				icon="eye"
				label="Label card"
				checked={entity.label?.enabled ?? false}
				onCheckedChange={(on) =>
					store().updateEntity(entity.id, (e) => {
						if (e.label) {
							e.label.enabled = on;
						} else {
							e.label = { enabled: true, title: e.name, dataKeys: [], offset: [0, 2, 0] };
						}
					})
				}
			/>

			<Menu.Item
				icon="edit"
				label="Edit its data…"
				description="Values on its card and details, in the Label tab"
				onClick={() => store().setTab("label")}
			/>

			<Menu.Item
				icon="copy"
				label="Duplicate"
				shortcut="Ctrl+D"
				onClick={() => store().duplicateEntity(entity.id)}
			/>
		</>
	);
};

/** Actions only roads have: carry on drawing from either open end. */
const RoadActions = ({ id }: { id: string }) => {
	const road = useEditor((s) => s.scene.roads.find((r) => r.id === id));
	const store = () => useEditor.getState();
	if (!road || road.closed || road.locked) {
		return null;
	}
	return (
		<>
			<Menu.Item
				icon="edit"
				label="Continue from its end"
				onClick={() => store().continueDrawing(road.id, "end")}
			/>

			<Menu.Item
				icon="edit"
				label="Continue from its start"
				onClick={() => store().continueDrawing(road.id, "start")}
			/>
		</>
	);
};

/** The object, road or area itself (the same object until it changes, so selecting it is stable). */
const useItem = (item: ISceneItem | undefined) =>
	useEditor((s) => {
		if (!item) {
			return undefined;
		}
		const list =
			item.kind === "entity"
				? s.scene.entities
				: item.kind === "road"
					? s.scene.roads
					: s.scene.areas;
		return list.find((thing) => thing.id === item.id);
	});

/** What an item is called without a name: its part, road style or area type. */
const kindName = (item: ISceneItem, thing: TEntity | TRoad | TArea) =>
	item.kind === "entity"
		? (partNameOf((thing as TEntity).kind) ?? (thing as TEntity).kind)
		: item.kind === "road"
			? ROAD_STYLE_LABELS[(thing as TRoad).style]
			: AREA_TYPE_LABELS[(thing as TArea).type];

interface IItemMenuProps {
	item: ISceneItem;
	kindActions: ReactNode;
	onRename: () => void;
}

const ItemMenu = ({ item, kindActions, onRename }: IItemMenuProps) => {
	const info = useItem(item);
	const store = () => useEditor.getState();
	if (!info) {
		return null;
	}
	const remove = () => {
		const state = store();
		if (item.kind === "entity") {
			state.removeEntity(item.id);
		} else if (item.kind === "road") {
			state.removeRoad(item.id);
		} else {
			state.removeArea(item.id);
		}
	};

	return (
		<>
			{kindActions}

			<Menu.Item icon="edit" label="Rename" shortcut="F2" onClick={onRename} />

			<Menu.Item
				icon="focus"
				label="Zoom to it"
				shortcut="F"
				onClick={() => store().frameSelection()}
			/>

			<Menu.Item
				icon="camera"
				label="Save this view"
				description="As a viewpoint, listed in the Viewpoints tab"
				onClick={saveCurrentView}
			/>

			<Menu.Separator />

			<Menu.CheckboxItem
				icon="eyeOff"
				label="Hidden"
				checked={info.hidden}
				onCheckedChange={(hidden) => store().setItemFlag(item, "hidden", hidden)}
			/>

			<Menu.CheckboxItem
				icon="lock"
				label="Locked"
				checked={info.locked}
				onCheckedChange={(locked) => store().setItemFlag(item, "locked", locked)}
			/>

			<Menu.Separator />

			<Menu.Item icon="trash" label="Delete" shortcut="Del" onClick={remove} />
		</>
	);
};

/** What a selection of several things is called: "3 objects", "2 objects and a road"… */
export const describeItems = (items: readonly ISceneItem[]) => {
	const count = (kind: ISceneItem["kind"]) => items.filter((item) => item.kind === kind).length;
	const parts = (
		[
			["entity", "object", "objects"],
			["road", "road", "roads"],
			["area", "area", "areas"],
		] as const
	).flatMap(([kind, one, many]) => {
		const n = count(kind);
		return n === 0 ? [] : [n === 1 ? `1 ${one}` : `${n} ${many}`];
	});
	return parts.length > 1
		? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
		: (parts[0] ?? "");
};

/** The menu for several selected things (ADR-0064): what acts on all of them. */
const GroupMenu = () => {
	const store = () => useEditor.getState();
	const flags = useEditor((s) => {
		const things = s.selectedItems.flatMap(
			(item) => listOf(s.scene, item.kind).find((thing) => thing.id === item.id) ?? [],
		);
		return `${things.every((thing) => thing.hidden)} ${things.every((thing) => thing.locked)}`;
	});
	const [hidden, locked] = flags.split(" ").map((flag) => flag === "true");

	return (
		<>
			<Menu.Item
				icon="focus"
				label="Zoom to them"
				shortcut="F"
				onClick={() => store().frameSelection()}
			/>

			<Menu.Item
				icon="camera"
				label="Save this view"
				description="As a viewpoint, listed in the Viewpoints tab"
				onClick={saveCurrentView}
			/>

			<Menu.Item
				icon="copy"
				label="Duplicate"
				shortcut="Ctrl+D"
				onClick={() => store().duplicateSelected()}
			/>

			<Menu.Separator />

			<Menu.CheckboxItem
				icon="eyeOff"
				label="Hidden"
				checked={hidden}
				onCheckedChange={(value) => store().setSelectedFlag("hidden", value)}
			/>

			<Menu.CheckboxItem
				icon="lock"
				label="Locked"
				checked={locked}
				onCheckedChange={(value) => store().setSelectedFlag("locked", value)}
			/>

			<Menu.Separator />

			<Menu.Item
				icon="trash"
				label="Delete"
				shortcut="Del"
				onClick={() => store().removeSelected()}
			/>
		</>
	);
};

/**
 * The right-click menu for an object, road or area, in the scene or the
 * outliner (Edit mode), headed by its name. Opening it selects the item, so
 * the actions act on what's highlighted. Rename edits the name in place, in a
 * field where the menu was. One menu for the whole editor, opened through the
 * store (`openContextMenu`).
 */
export const ItemContextMenu = () => {
	const menuNow = useEditor((s) => s.contextMenu);
	const [renamingNow, setRenaming] = useState<{ item: ISceneItem; x: number; y: number } | null>(
		null,
	);
	// What was last shown, kept while each one animates closed.
	const menu = useLastNonNull(menuNow);
	const renaming = useLastNonNull(renamingNow);
	const item = menu?.item;
	const thing = useItem(item);
	const renamed = useItem(renaming?.item);
	const close = () => useEditor.getState().openContextMenu(null);
	// Right-clicked one of several selected things: the menu acts on all of them.
	const groupNow = useEditor((s) =>
		s.selectedItems.length > 1 ? describeItems(s.selectedItems) : null,
	);
	// What the menu showed, kept with it while it animates closed.
	const group = useLastNonNull(menuNow ? { name: groupNow } : null)?.name ?? null;
	const showGroup = group !== null;

	return (
		<>
			<ContextMenu
				open={menuNow !== null}
				onOpenChange={(open) => {
					if (!open) {
						close();
					}
				}}
				x={menu?.x ?? 0}
				y={menu?.y ?? 0}
				title={
					showGroup
						? `${group} selected`
						: item && thing
							? thing.name || kindName(item, thing)
							: undefined
				}
				subtitle={!showGroup && item && thing?.name ? kindName(item, thing) : undefined}
			>
				{showGroup && <GroupMenu />}

				{!showGroup && item && (
					<ItemMenu
						item={item}
						onRename={() => menu && setRenaming(menu)}
						kindActions={
							item.kind === "entity" ? (
								<EntityActions id={item.id} />
							) : item.kind === "road" ? (
								<RoadActions id={item.id} />
							) : null
						}
					/>
				)}
			</ContextMenu>

			<RenamePopover
				open={renamingNow !== null && renamed !== undefined}
				onClose={() => setRenaming(null)}
				x={renaming?.x ?? 0}
				y={renaming?.y ?? 0}
				label={renaming && renamed ? renamed.name || kindName(renaming.item, renamed) : ""}
				value={renamed?.name ?? ""}
				placeholder={renaming && renamed ? kindName(renaming.item, renamed) : undefined}
				onCommit={(name) => renaming && useEditor.getState().renameItem(renaming.item, name)}
			/>
		</>
	);
};
