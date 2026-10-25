import { setCameraFeel, useCameraFeel } from "#/editor/cameraFeel";
import { setSidePaneOpen } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { fieldOfViewOf, focalLengthOf } from "#/render/cameraMath";

import { Icon } from "./Icon";
import { Menu } from "./Menu";

/** Lenses a click away, as on a camera: focal length (mm, full frame) and what it's like. */
const LENSES = [
	{ millimetres: 18, description: "Very wide" },
	{ millimetres: 24, description: "Wide" },
	{ millimetres: 35, description: "A little wide" },
	{ millimetres: 50, description: "Normal, like the eye" },
	{ millimetres: 85, description: "Short telephoto" },
	{ millimetres: 135, description: "Telephoto" },
	{ millimetres: 200, description: "Long telephoto, flat" },
];

type TOverlay = "navigationGizmo" | "viewLabel" | "compositionGrid" | "viewpointsInWorld";

const OVERLAYS: { key: TOverlay; label: string }[] = [
	{ key: "navigationGizmo", label: "Navigation gizmo" },
	{ key: "viewLabel", label: "View label" },
	{ key: "compositionGrid", label: "Composition grid" },
	{ key: "viewpointsInWorld", label: "Viewpoints in the world" },
];

/** Switch to the perspective view, or back to the diorama view. */
const showPerspective = (on: boolean) => {
	if (on !== useEditor.getState().perspective) {
		useEditor.getState().togglePerspective();
	}
};

/**
 * The toolbar's camera menu (ADR-0062): diorama or perspective view, a lens a
 * click away, re-centring, the overlays, and the way to the Camera tab and
 * Preferences.
 */
export const CameraMenu = () => {
	const perspective = useEditor((s) => s.perspective);
	const fieldOfView = useEditor((s) => s.scene.camera.fieldOfView);
	const editing = useEditor((s) => s.mode === "edit");
	const feel = useCameraFeel();
	const store = () => useEditor.getState();
	const lens = Math.round(focalLengthOf(fieldOfView));

	return (
		<Menu.Root>
			<Menu.Trigger label="Camera" tooltip="Camera">
				<Icon name={perspective ? "perspective" : "video"} size={18} />
			</Menu.Trigger>

			<Menu.Popup>
				<Menu.CheckboxItem
					icon="video"
					label="Diorama view"
					checked={!perspective}
					onCheckedChange={() => showPerspective(false)}
				/>

				<Menu.CheckboxItem
					icon="perspective"
					label="Perspective view (P)"
					checked={perspective}
					onCheckedChange={() => showPerspective(true)}
				/>

				<Menu.Submenu icon="focus" label={`Focal length · ${lens} mm`}>
					{LENSES.map(({ millimetres, description }) => (
						<Menu.Item
							key={millimetres}
							icon={millimetres === lens ? "check" : undefined}
							label={`${millimetres} mm`}
							description={description}
							onClick={() => {
								store().commit((scene) => {
									scene.camera.fieldOfView = Math.round(fieldOfViewOf(millimetres) * 100) / 100;
								});
								showPerspective(true);
							}}
						/>
					))}
				</Menu.Submenu>

				<Menu.Item
					icon="focus"
					label="Re-centre camera"
					shortcut="Home"
					onClick={() => store().resetView()}
				/>

				<Menu.Separator />

				<Menu.Group label="Overlays in Edit mode">
					{OVERLAYS.map(({ key, label }) => (
						<Menu.CheckboxItem
							key={key}
							icon="eye"
							label={label}
							checked={feel[key]}
							onCheckedChange={(on) => setCameraFeel(key, on)}
						/>
					))}
				</Menu.Group>

				<Menu.Separator />

				{editing && (
					<Menu.Item
						icon="video"
						label="Camera settings…"
						description="This world's camera, in the Camera tab"
						onClick={() => {
							store().setTab("camera");
							setSidePaneOpen("right", true);
						}}
					/>
				)}

				<Menu.Item
					icon="user"
					label="Preferences…"
					description="How the camera moves for you"
					onClick={() => store().setPreferencesOpen(true)}
				/>
			</Menu.Popup>
		</Menu.Root>
	);
};
