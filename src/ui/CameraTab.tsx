import { useState } from "react";

import { resetCameraFeel } from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";
import { farthestSpanOf } from "#/render/cameraMath";
import { CameraSettingsSchema, type TCameraSettings } from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { FieldOfViewField } from "./FieldOfViewField";
import {
	Hint,
	Section,
	SelectField,
	SliderField,
	SwitchField,
	useSearchMatch,
	useSettingsSearch,
} from "./fields";
import { viewpointName } from "./ViewpointsSection";

import styles from "./CameraTab.module.css";

/** Every world camera setting as a new world has it, for Default / Reset. */
const CAMERA_DEFAULTS = CameraSettingsSchema.parse({});

/**
 * The Camera tab (ADR-0062): the world's camera, saved with it: what kind of
 * camera and lens, where the world opens, and, folded at first, its zoom and
 * tilt limits, the turntable and tilt-shift. How the camera moves for you is
 * in Preferences (ui/PreferencesDialog).
 */
export const CameraTab = () => {
	const camera = useEditor((s) => s.scene.camera);
	const ground = useEditor((s) => s.scene.ground);
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const commit = useEditor((s) => s.commit);
	const setTab = useEditor((s) => s.setTab);
	const set = <K extends keyof TCameraSettings>(key: K, value: TCameraSettings[K]) =>
		commit(
			(s) => {
				s.camera[key] = value;
			},
			{ coalesce: `camera.${key}` },
		);
	const perspective = useEditor((s) => s.perspective);
	const previewTiltShift = useEditor((s) => s.previewTiltShift);
	const [confirmingReset, setConfirmingReset] = useState(false);
	// The button isn't in a panel, so it hides itself in the settings search unless it matches.
	const searching = useSettingsSearch() !== "";
	const resetMatches = useSearchMatch("Reset the camera");
	const opening = viewpoints.some((v) => v.id === camera.openingViewpointId)
		? (camera.openingViewpointId ?? "")
		: "";
	/** A setting's Default / Reset: Default while it's as a new world has it. */
	const byDefault = <K extends keyof TCameraSettings>(key: K, value: string) => ({
		from: "default",
		inherited: camera[key] === CAMERA_DEFAULTS[key],
		onReset: () =>
			commit((s) => {
				s.camera[key] = CAMERA_DEFAULTS[key];
			}),
		value,
	});

	return (
		<>
			{(!searching || resetMatches) && (
				<div className={styles.tabActions} data-search-match={resetMatches}>
					<ButtonGroup>
						<Button size="sm" icon="reset" onClick={() => setConfirmingReset(true)}>
							Reset the camera
						</Button>

						<Button
							size="sm"
							icon="user"
							onClick={() => useEditor.getState().setPreferencesOpen(true)}
						>
							Preferences…
						</Button>
					</ButtonGroup>
				</div>
			)}

			<ConfirmDialog
				open={confirmingReset}
				onOpenChange={setConfirmingReset}
				title="Reset the camera?"
				description="The camera goes back to the whole world in the isometric diorama view, and every camera setting to its default: View and Zoom and tilt for this world (Undo brings those back), and the camera preferences in this browser. The turntable and tilt-shift keep their settings."
				confirmLabel="Reset the camera"
				onConfirm={() => {
					useEditor.getState().resetCamera();
					resetCameraFeel();
				}}
			/>

			<Section
				id="camera.view"
				icon="video"
				title="View"
				keywords="diorama perspective iso isometric camera type opening view start field of view fov lens wide angle ground"
			>
				{/* First: it decides what the field of view below means. */}
				<SelectField<"diorama" | "perspective">
					label="Camera"
					value={perspective ? "perspective" : "diorama"}
					options={[
						{ value: "diorama", label: "Isometric diorama" },
						{ value: "perspective", label: "Perspective" },
					]}
					onChange={(next) => {
						if ((next === "perspective") !== perspective) {
							useEditor.getState().togglePerspective();
						}
					}}
					inherit={{
						from: "default",
						inherited: !perspective,
						onReset: () => useEditor.getState().togglePerspective(),
						value: "isometric diorama",
					}}
					hint="P switches between them. Like the rest of where you’re looking, it’s remembered for this world in this browser, and a viewpoint keeps its own."
				/>

				<FieldOfViewField
					value={camera.fieldOfView}
					onChange={(v) => set("fieldOfView", v)}
					inherit={{
						from: "default",
						inherited: camera.fieldOfView === CAMERA_DEFAULTS.fieldOfView,
						onReset: () => set("fieldOfView", CAMERA_DEFAULTS.fieldOfView),
						degrees: CAMERA_DEFAULTS.fieldOfView,
					}}
					hint="For the perspective camera (P). Short lenses (18 mm) are wide, with strong depth; long ones (200 mm) are narrow and flat. A viewpoint can have its own."
				/>

				<SelectField
					label="Opening view"
					value={opening}
					options={[
						{ value: "", label: "The whole world" },
						...(viewpoints.length > 0
							? viewpoints.map((viewpoint, index) => ({
									value: viewpoint.id,
									label: viewpointName(viewpoint, index),
								}))
							: [{ value: "none", label: "A viewpoint (no viewpoints yet)", disabled: true }]),
					]}
					onChange={(id) => useEditor.getState().setOpeningViewpoint(id || null)}
					inherit={{
						from: "default",
						inherited: opening === "",
						onReset: () => useEditor.getState().setOpeningViewpoint(null),
						value: "the whole world",
					}}
					hint="Where the world opens for anyone who hasn’t looked around it in their browser yet (a shared file, another browser), and where re-centring the camera goes."
				/>

				{viewpoints.length === 0 && (
					<>
						<Hint>Save a viewpoint in the Viewpoints tab to open the world there.</Hint>

						<Button size="sm" icon="camera" onClick={() => setTab("views")}>
							Open the Viewpoints tab
						</Button>
					</>
				)}
			</Section>

			<Section
				id="camera.limits"
				defaultClosed
				icon="focus"
				title="Zoom and tilt"
				keywords="limits zoom in out closest farthest tilt low steep angle elevation"
			>
				<Hint>
					Where the camera can go with Simple camera control. With Free (Preferences) it goes
					anywhere, like in Blender.
				</Hint>

				<SliderField
					label="Closest zoom"
					value={camera.closestSpan}
					min={0.05}
					max={1000}
					sliderMin={1}
					sliderMax={100}
					step={1}
					onChange={(v) => set("closestSpan", v)}
					inherit={byDefault("closestSpan", `${CAMERA_DEFAULTS.closestSpan} units`)}
					hint="How many grid units still fit from the top of the view to the bottom when zoomed in all the way. Type any value for closer (down to 0.05) or further."
				/>

				<SliderField
					label="Farthest zoom"
					value={farthestSpanOf(camera, ground)}
					min={1}
					max={100000}
					sliderMin={10}
					sliderMax={2000}
					step={10}
					onChange={(v) => set("farthestSpan", v)}
					hint="Grid units from the top of the view to the bottom when zoomed out all the way. By default it fits the whole ground with room around it."
					inherit={byDefault(
						"farthestSpan",
						`${farthestSpanOf({ farthestSpan: null }, ground)}, from the ground’s size`,
					)}
				/>

				<SliderField
					label="Lowest tilt"
					value={camera.lowestElevation}
					min={0}
					max={90}
					step={1}
					suffix="°"
					onChange={(v) => set("lowestElevation", v)}
					inherit={byDefault("lowestElevation", `${CAMERA_DEFAULTS.lowestElevation}°`)}
					hint="Degrees above the ground: 0 looks level across the world."
				/>

				<SliderField
					label="Steepest tilt"
					value={camera.steepestElevation}
					min={0}
					max={90}
					step={1}
					suffix="°"
					onChange={(v) => set("steepestElevation", v)}
					inherit={byDefault("steepestElevation", `${CAMERA_DEFAULTS.steepestElevation}°`)}
					hint="90° looks straight down, like a map."
				/>

				<SwitchField
					label="Keep the camera over the ground"
					checked={camera.keepOverGround}
					onChange={(v) => set("keepOverGround", v)}
					inherit={byDefault("keepOverGround", "on")}
				/>
			</Section>

			<Section
				id="camera.turntable"
				defaultClosed
				icon="rotateLeft"
				title="Turntable"
				keywords="turntable auto rotate spin circle orbit idle kiosk wall screen view mode"
			>
				<SwitchField
					label="Circle the view in View mode"
					checked={camera.turntable}
					onChange={(v) => set("turntable", v)}
					inherit={byDefault("turntable", "off")}
				/>

				<SliderField
					label="Speed"
					value={camera.turntableSpeed}
					min={-30}
					max={30}
					step={1}
					suffix="°/s"
					onChange={(v) => set("turntableSpeed", v)}
					inherit={byDefault("turntableSpeed", `${CAMERA_DEFAULTS.turntableSpeed}°/s`)}
					hint="Degrees a second; below 0 it turns the other way."
				/>

				<SliderField
					label="Starts after"
					value={camera.turntableDelay}
					min={1}
					max={120}
					step={1}
					suffix="s"
					onChange={(v) => set("turntableDelay", v)}
					inherit={byDefault("turntableDelay", `${CAMERA_DEFAULTS.turntableDelay} s`)}
					hint="Seconds without input in View mode. Any press, scroll or key stops it, like a model on a turntable in a shop window: good for a world left on a wall screen."
				/>
			</Section>

			<Section
				id="camera.tiltShift"
				defaultClosed
				icon="focus"
				title="Tilt-shift"
				keywords="tilt shift miniature blur depth of field focus toy model photo"
			>
				<SwitchField
					label="Miniature blur in View mode"
					checked={camera.tiltShift}
					onChange={(v) => set("tiltShift", v)}
					inherit={byDefault("tiltShift", "off")}
				/>

				<SwitchField
					label="Show it while editing"
					checked={previewTiltShift}
					onChange={(v) => useEditor.getState().setPreviewTiltShift(v)}
					inherit={{
						from: "default",
						inherited: !previewTiltShift,
						onReset: () => useEditor.getState().setPreviewTiltShift(false),
						value: "off",
					}}
				/>

				<SliderField
					label="Blur"
					value={Math.round(camera.tiltShiftBlur * 100)}
					min={0}
					max={100}
					step={5}
					suffix="%"
					onChange={(v) => set("tiltShiftBlur", v / 100)}
					inherit={byDefault("tiltShiftBlur", `${CAMERA_DEFAULTS.tiltShiftBlur * 100}%`)}
				/>

				<SliderField
					label="Sharp band"
					value={Math.round(camera.tiltShiftFocus * 100)}
					min={5}
					max={100}
					step={5}
					suffix="%"
					onChange={(v) => set("tiltShiftFocus", v / 100)}
					inherit={byDefault("tiltShiftFocus", `${CAMERA_DEFAULTS.tiltShiftFocus * 100}%`)}
					hint="How much of the view’s height stays sharp."
				/>

				<SliderField
					label="Band height"
					value={Math.round(camera.tiltShiftPosition * 100)}
					min={0}
					max={100}
					step={5}
					suffix="%"
					onChange={(v) => set("tiltShiftPosition", v / 100)}
					inherit={byDefault(
						"tiltShiftPosition",
						`${CAMERA_DEFAULTS.tiltShiftPosition * 100}%, the middle`,
					)}
					hint="Where the sharp band is, from the bottom of the view (0%) to the top."
				/>

				<Hint>
					Blurring the top and bottom makes the world look like a model photographed up close. It
					shows in View mode; Edit mode stays sharp unless you show it while editing.
				</Hint>
			</Section>
		</>
	);
};
