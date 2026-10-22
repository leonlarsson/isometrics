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
				Click an object or road in the scene to edit it, or add something new from the list on the
				left.
			</Hint>
		</div>
	);
};

export const Inspector = () => {
	const tab = useEditor((s) => s.tab);
	const setTab = useEditor((s) => s.setTab);

	return (
		<Tabs value={tab} onChange={setTab} tabs={TABS} sticky>
			<TabPanel value="object">
				<ObjectPanel />
			</TabPanel>

			<TabPanel value="data">
				<DataPanel />
			</TabPanel>

			<TabPanel value="scene">
				<ScenePanel />
			</TabPanel>
		</Tabs>
	);
};
