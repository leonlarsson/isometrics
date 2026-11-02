import { useState } from "react";

import { assignRowsByName, matchingNameOf } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { rowKeyMatching } from "#/scene/rowData";
import type { TDataTable, TDataValue } from "#/scene/schema";

import { ActionCards } from "./ActionCards";
import { PlaceRowsDialog } from "./PlaceRowsDialog";
import { RoadRowsDialog, textColumnsOf } from "./RoadRowsDialog";

/**
 * Show it in the world (ADR-0123): what can show a table's rows, each a way
 * that ends in the world. Place one object for each row, draw a road for each,
 * or give objects already there the row matching their name.
 */
export const ShowTableInWorld = ({ table }: { table: TDataTable }) => {
	const entities = useEditor((s) => s.scene.entities);
	const commit = useEditor((s) => s.commit);
	const selectItems = useEditor((s) => s.selectItems);
	const openDataWindow = useEditor((s) => s.openDataWindow);
	const [placing, setPlacing] = useState<"objects" | "roads" | null>(null);
	const hasPlaces = textColumnsOf(table).length >= 2;
	// Objects already there whose name matches a row and that don't follow one yet.
	const matching = entities.filter(
		(entity) =>
			entity.dataRow?.tableKey !== table.key &&
			rowKeyMatching(table, matchingNameOf(entity)) !== undefined,
	);
	const rows = `${table.rows.length.toLocaleString()} rows`;

	return (
		<>
			<ActionCards
				cards={[
					{
						title: "Place one for each row…",
						about: `${rows}, a new object for each, named by its row. Pick what they are next.`,
						onChoose: () => setPlacing("objects"),
					},
					{
						title:
							matching.length > 0
								? matching.length === 1
									? "Give 1 object the row matching its name"
									: `Give ${matching.length} objects the row matching their name`
								: "Give objects the row matching their name (none match yet)",
						about:
							matching.length > 0
								? `${matching
										.slice(0, 3)
										.map((entity) => matchingNameOf(entity))
										.join(
											", ",
										)}${matching.length > 3 ? "…" : ""} ${matching.length === 1 ? "takes its row" : "each take their row"}.`
								: "Name objects like the rows (case and spaces don't matter), then come back.",
						disabled: matching.length === 0,
						onChoose: () => {
							let matched = 0;
							commit((scene) => {
								matched = assignRowsByName(
									scene,
									matching.map((entity) => entity.id),
									table,
								).matched.length;
							});
							selectItems(matching.map((entity) => ({ kind: "entity" as const, id: entity.id })));
							notify(
								`${matched === 1 ? "1 object" : `${matched} objects`} took their row`,
								"They're selected: their Data tab picks what follows it (sizes, colours, cards).",
							);
							openDataWindow(null);
						},
					},
					{
						title: hasPlaces
							? "Draw a road for each row…"
							: "Draw a road for each row (no from and to columns)",
						about: hasPlaces
							? "Roads between the objects each row names, with vehicles showing how much goes."
							: "Needs two columns of names, where each row goes from and to.",
						disabled: !hasPlaces,
						onChoose: () => setPlacing("roads"),
					},
				]}
			/>

			{placing === "objects" && <PlaceRowsDialog table={table} onClose={() => setPlacing(null)} />}

			{placing === "roads" && <RoadRowsDialog table={table} onClose={() => setPlacing(null)} />}
		</>
	);
};

/**
 * Show it in the world (ADR-0123) for a single value: on the selected object's
 * card, as a tile in View mode, or a setting of the selected object following it.
 */
export const ShowValueInWorld = ({ value }: { value: TDataValue }) => {
	const selected = useEditor((s) =>
		s.selectedItems.length === 1 && s.selectedItems[0].kind === "entity"
			? s.scene.entities.find((entity) => entity.id === s.selectedItems[0].id)
			: undefined,
	);
	const tileKeys = useEditor((s) => s.scene.onScreen.tileKeys);
	const commit = useEditor((s) => s.commit);
	const setTab = useEditor((s) => s.setTab);
	const openDataWindow = useEditor((s) => s.openDataWindow);
	const name = value.name || value.key;
	const selectedName = selected ? selected.name || "the selected object" : null;
	const isOnCard = selected?.label.isShown && selected.label.dataKeys.includes(value.key);
	const isTile = tileKeys.includes(value.key);

	return (
		<ActionCards
			cards={[
				{
					title: isOnCard
						? `Take it off ${selectedName}'s card`
						: selected
							? `Put it on ${selectedName}'s card`
							: "Put it on an object's card (select one first)",
					about: isOnCard
						? `${selectedName}'s card stops showing ${name}; anything else on it stays.`
						: selected
							? `A floating card over ${selectedName}, showing ${name}.`
							: "Close this window, select the object in the view, and open Data again.",
					disabled: !selected,
					onChoose: () => {
						if (!selected) {
							return;
						}
						commit((scene) => {
							const entity = scene.entities.find((each) => each.id === selected.id);
							if (!entity) {
								return;
							}
							if (isOnCard) {
								entity.label.dataKeys = entity.label.dataKeys.filter((key) => key !== value.key);
								return;
							}
							entity.label.isShown = true;
							if (!entity.label.dataKeys.includes(value.key)) {
								entity.label.dataKeys.push(value.key);
							}
						});
						notify(
							isOnCard
								? `${name} is off ${selectedName}'s card`
								: `${name} is on ${selectedName}'s card`,
						);
					},
				},
				{
					title: selected
						? `Make a setting of ${selectedName} follow it…`
						: "Make a setting follow it (select an object first)",
					about: "Its height, floors, colour or lights: picked in the object's Data tab.",
					disabled: !selected,
					onChoose: () => {
						setTab("objectData");
						openDataWindow(null);
					},
				},
				{
					title: isTile ? "Remove it from the tiles" : "Add it as a tile in View mode",
					about: isTile
						? "It's a tile along the bottom of the screen in View mode; this takes it away."
						: "Along the bottom of the screen, with the world's other main numbers.",
					onChoose: () => {
						commit((scene) => {
							scene.onScreen.tileKeys = isTile
								? scene.onScreen.tileKeys.filter((key) => key !== value.key)
								: [...scene.onScreen.tileKeys, value.key];
						});
						notify(isTile ? `${name} is no longer a tile` : `${name} is a tile in View mode`);
					},
				},
			]}
		/>
	);
};
