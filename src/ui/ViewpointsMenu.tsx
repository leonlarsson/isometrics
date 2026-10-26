import { useEditor } from "#/editor/store";
import { currentView } from "#/render/viewpoints";
import { wearsMood } from "#/scene/moods";

import { Icon } from "./Icon";
import { Menu } from "./Menu";
import { moodName, moodTime } from "./MoodsSection";
import { viewpointName } from "./ViewpointsSection";

import styles from "./ViewpointsMenu.module.css";

/** Save the camera's view as a new viewpoint (Views menu and the context menus). */
export const saveCurrentView = () => {
	const pose = currentView.read?.();
	if (pose) {
		useEditor.getState().addViewpoint(pose);
	}
};

/**
 * The toolbar's Views menu: glide to any viewpoint (keys 1–9 do too), put on
 * one of the world's moods, and in Edit mode save the current view or open the
 * list in the Viewpoints tab.
 */
export const ViewpointsMenu = () => {
	const scene = useEditor((s) => s.scene);
	const { viewpoints, moods } = scene;
	const mode = useEditor((s) => s.mode);
	const store = () => useEditor.getState();

	return (
		<Menu.Root>
			<Menu.Trigger label="Viewpoints">
				<Icon name="camera" size={16} />

				<span className={styles.label}>Views</span>
			</Menu.Trigger>

			<Menu.Popup>
				{viewpoints.length === 0 && (
					<Menu.Item label="No viewpoints yet" disabled onClick={() => {}} />
				)}

				{viewpoints.map((viewpoint, index) => (
					<Menu.Item
						key={viewpoint.id}
						label={viewpointName(viewpoint, index)}
						description={viewpoint.description || undefined}
						shortcut={index < 9 ? String(index + 1) : undefined}
						onClick={() => store().goToViewpoint(viewpoint.id)}
					/>
				))}

				{moods.length > 0 && (
					<Menu.Group label="Moods">
						{moods.map((mood, index) => (
							<Menu.Item
								key={mood.id}
								icon={wearsMood(scene, mood) ? "check" : undefined}
								label={moodName(mood, index)}
								description={moodTime(mood)}
								onClick={() => store().putOnMood(mood.id)}
							/>
						))}
					</Menu.Group>
				)}

				{mode === "edit" && <Menu.Separator />}

				{mode === "edit" && (
					<Menu.Item icon="plus" label="Save the current view" onClick={saveCurrentView} />
				)}

				{mode === "edit" && (
					<Menu.Item
						icon="edit"
						label="Manage viewpoints…"
						description="Rename, describe or re-save them in the Viewpoints tab"
						onClick={() => store().setTab("views")}
					/>
				)}
			</Menu.Popup>
		</Menu.Root>
	);
};
