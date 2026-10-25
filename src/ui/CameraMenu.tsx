import {
	overlayPlaceWith,
	overlayShownIn,
	setPreference,
	type TOverlay,
	usePreferences,
} from "#/editor/preferences";
import { setSidePaneOpen } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { fieldOfViewOf, focalLengthOf } from "#/render/cameraMath";
import { CameraSettingsSchema } from "#/scene/schema";

import { Icon } from "./Icon";
import { Menu } from "./Menu";

/** Lenses a click away, as on a camera: focal length (mm, full frame) and what it's like. */
/** The world camera's settings as a new world has them. */
const CAMERA_DEFAULTS = CameraSettingsSchema.parse({});

const LENSES = [
	{ millimetres: 18, description: "Very wide" },
	{ millimetres: 24, description: "Wide" },
	// The world's default field of view (40°), as a lens.
	{
		millimetres: Math.round(focalLengthOf(CAMERA_DEFAULTS.fieldOfView)),
		description: "Default",
	},
	{ millimetres: 35, description: "A little wide" },
	{ millimetres: 50, description: "Normal, like the eye" },
	{ millimetres: 85, description: "Short telephoto" },
	{ millimetres: 135, description: "Telephoto" },
	{ millimetres: 200, description: "Long telephoto, flat" },
];

const OVERLAYS: { key: TOverlay; label: string }[] = [
	{ key: "navigationGizmo", label: "Navigation gizmo" },
	{ key: "viewLabel", label: "View label" },
	{ key: "compositionGrid", label: "Composition grid" },
	{ key: "viewpointsInWorld", label: "Viewpoints in the world" },
];

/**
 * The toolbar's camera menu (ADR-0062): diorama or perspective view, a lens a
 * click away, re-centring, the overlays, and the way to the Camera tab and
 * Preferences.
 */
export const CameraMenu = () => {
	const perspective = useEditor((s) => s.projection === "perspective");
	const fieldOfView = useEditor((s) => s.scene.camera.fieldOfView);
	const editing = useEditor((s) => s.mode === "edit");
	const preferences = usePreferences();
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
					label="Isometric diorama"
					checked={!perspective}
					onCheckedChange={() => store().setProjection("orthographic")}
					keepOpen
					shortcut="P"
				/>

				<Menu.CheckboxItem
					icon="perspective"
					label="Perspective"
					checked={perspective}
					onCheckedChange={() => store().setProjection("perspective")}
					keepOpen
					shortcut="P"
				/>

				<Menu.Submenu
					icon="focus"
					label={`Focal length · ${lens} mm${fieldOfView === CAMERA_DEFAULTS.fieldOfView ? " (default)" : ""}`}
				>
					{LENSES.map(({ millimetres, description }) => (
						<Menu.Item
							key={millimetres}
							icon={millimetres === lens ? "check" : undefined}
							label={`${millimetres} mm`}
							description={description}
							onClick={() => {
								store().commit((scene) => {
									// The default lens is exactly the default field of view.
									scene.camera.fieldOfView =
										description === "Default"
											? CAMERA_DEFAULTS.fieldOfView
											: Math.round(fieldOfViewOf(millimetres) * 100) / 100;
								});
								store().setProjection("perspective");
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

				{/* Ticked: shown in the mode you're in; the other mode is set in Preferences. */}
				<Menu.Group label={editing ? "Overlays in Edit mode" : "Overlays in View mode"}>
					{OVERLAYS.map(({ key, label }) => (
						<Menu.CheckboxItem
							key={key}
							icon="eye"
							label={label}
							checked={overlayShownIn(preferences[key], editing ? "edit" : "view")}
							onCheckedChange={(on) =>
								setPreference(
									key,
									overlayPlaceWith(preferences[key], editing ? "edit" : "view", on),
								)
							}
							keepOpen
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
