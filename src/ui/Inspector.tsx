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
import { RoadInspector } from "./RoadInspector";
import { ScenePanel } from "./ScenePanel";

import styles from "./Fields.module.css";

const TABS: { id: TInspectorTab; label: string }[] = [
	{ id: "object", label: "Object" },
	{ id: "data", label: "Data" },
	{ id: "scene", label: "Scene" },
];

export const Inspector = () => {
	const tab = useEditor((s) => s.tab);
	const setTab = useEditor((s) => s.setTab);
	const entity = useEditor(selectSelectedEntity);
	const road = useEditor(selectSelectedRoad);
	const area = useEditor(selectSelectedArea);

	return (
		<div className={styles.inspector}>
			<div className={styles.tabs} role="tablist">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={tab === t.id}
						className={styles.tab}
						onClick={() => setTab(t.id)}
					>
						{t.label}
					</button>
				))}
			</div>

			<div className={styles.tabBody}>
				{tab === "object" &&
					(entity ? (
						<EntityInspector key={entity.id} entity={entity} />
					) : road ? (
						<RoadInspector key={road.id} road={road} />
					) : area ? (
						<AreaInspector key={area.id} area={area} />
					) : (
						<div className={styles.empty}>
							<p>
								<strong>Nothing selected.</strong>
							</p>

							<p className={styles.hint}>
								Click an object or road in the scene to edit it, or add something new from the list
								on the left.
							</p>
						</div>
					))}

				{tab === "data" && <DataPanel />}

				{tab === "scene" && <ScenePanel />}
			</div>
		</div>
	);
};
