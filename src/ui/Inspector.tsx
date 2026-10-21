import { selectSelectedEntity, type TInspectorTab, useEditor } from "#/editor/store";

import { DataPanel } from "./DataPanel";
import { EntityInspector } from "./EntityInspector";
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
					) : (
						<div className={styles.empty}>
							<p>
								<strong>Nothing selected.</strong>
							</p>

							<p className={styles.hint}>
								Click an object in the scene to move, rotate, recolour or label it, or add a new one
								from the parts list.
							</p>
						</div>
					))}

				{tab === "data" && <DataPanel />}

				{tab === "scene" && <ScenePanel />}
			</div>
		</div>
	);
};
