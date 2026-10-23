import type { ReactNode } from "react";

import {
	selectSelectedArea,
	selectSelectedEntity,
	selectSelectedRoad,
	type TInspectorTab,
	useEditor,
} from "#/editor/store";

import { AreaInspector } from "./AreaInspector";
import { DataPanel } from "./DataPanel";
import { EntityInspector } from "./EntityInspector";
import { Hint } from "./fields";
import { Outliner } from "./Outliner";
import { PartsPalette } from "./PartsPalette";
import { RoadInspector } from "./RoadInspector";
import { ScenePanel } from "./ScenePanel";
import { TabPanel, Tabs } from "./Tabs";

import styles from "./Inspector.module.css";

const TABS: { value: TInspectorTab; label: string }[] = [
	{ value: "object", label: "Object" },
	{ value: "data", label: "Data" },
	{ value: "scene", label: "Scene" },
];

const ObjectPanel = () => {
	const entity = useEditor(selectSelectedEntity);
	const road = useEditor(selectSelectedRoad);
	const area = useEditor(selectSelectedArea);

	if (entity) {
		return <EntityInspector key={entity.id} entity={entity} />;
	}
	if (road) {
		return <RoadInspector key={road.id} road={road} />;
	}
	if (area) {
		return <AreaInspector key={area.id} area={area} />;
	}
	return (
		<div className={styles.empty}>
			<strong>Nothing selected.</strong>

			<Hint>
				Click an object or road in the scene to edit it, or add something new from Add to scene.
			</Hint>
		</div>
	);
};

/** Narrow layout only: the left column's panels become tabs of the sheet. */
const NARROW_TABS: { value: TInspectorTab; label: string }[] = [
	{ value: "add", label: "Add" },
	{ value: "outliner", label: "List" },
];

interface IInspectorProps {
	/** Narrow layout: adds Add and List tabs with the left column's panels (it's hidden). */
	narrow?: boolean;
	/** False shows just the tab bar (the collapsed bottom sheet). */
	open?: boolean;
	/** Called when the user picks a tab, so a collapsed sheet can open. */
	onTabSelect?: () => void;
	/** Shown at the end of the tab bar (the sheet's hide/show button). */
	tabBarEnd?: ReactNode;
}

export const Inspector = ({
	narrow = false,
	open = true,
	onTabSelect,
	tabBarEnd,
}: IInspectorProps) => {
	const tab = useEditor((s) => s.tab);
	const setTab = useEditor((s) => s.setTab);
	const shown = !narrow && (tab === "add" || tab === "outliner") ? "object" : tab;

	return (
		<Tabs
			value={shown}
			onChange={(next) => {
				setTab(next);
				onTabSelect?.();
			}}
			tabs={narrow ? [...NARROW_TABS, ...TABS] : TABS}
			sticky
			barEnd={tabBarEnd}
		>
			{open && narrow && (
				<TabPanel value="add">
					<PartsPalette />
				</TabPanel>
			)}

			{open && narrow && (
				<TabPanel value="outliner">
					<Outliner />
				</TabPanel>
			)}

			{open && (
				<TabPanel value="object">
					<ObjectPanel />
				</TabPanel>
			)}

			{open && (
				<TabPanel value="data">
					<DataPanel />
				</TabPanel>
			)}

			{open && (
				<TabPanel value="scene">
					<ScenePanel />
				</TabPanel>
			)}
		</Tabs>
	);
};
