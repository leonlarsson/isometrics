import { useState } from "react";

import {
	DEFAULT_CAMERA_FEEL,
	resetCameraFeel,
	setCameraFeel,
	type TCameraFeel,
	useCameraFeel,
} from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";
import { farthestSpanOf } from "#/render/cameraMath";
import { CameraSettingsSchema, type TCameraSettings } from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import {
	FieldGroup,
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

/** A personal camera setting's Default / Reset (ADR-0027): its default is the app's. */
const feelDefault = <K extends keyof TCameraFeel>(feel: TCameraFeel, key: K, value: string) => ({
	from: "default",
	inherited: feel[key] === DEFAULT_CAMERA_FEEL[key],
	onReset: () => setCameraFeel(key, DEFAULT_CAMERA_FEEL[key]),
	value,
});

/**
 * Your camera: how the camera feels to move, in every world in this browser
 * (editor/cameraFeel), never saved with the world.
 */
const CameraFeelSection = () => {
	const feel = useCameraFeel();
	return (
		<Section
			id="camera.feel"
			icon="user"
			title="Your camera"
			keywords="speed orbit turn zoom scroll wheel invert reverse smooth smoothing damping inertia glide flight viewpoint personal browser keyboard keys arrows overlays composition grid thirds navigation gizmo compass view label viewpoints in the world"
		>
			<Hint>
				Yours alone: these apply to every world in this browser and aren’t saved with the world.
			</Hint>

			<SliderField
				label="Orbit speed"
				value={feel.orbitSpeed}
				min={0.2}
				max={3}
				step={0.1}
				suffix="×"
				onChange={(v) => setCameraFeel("orbitSpeed", v)}
				inherit={feelDefault(feel, "orbitSpeed", "1×")}
				hint="Dragging to turn and tilt, and Shift+arrows."
			/>

			<SliderField
				label="Zoom speed"
				value={feel.zoomSpeed}
				min={0.2}
				max={3}
				step={0.1}
				suffix="×"
				onChange={(v) => setCameraFeel("zoomSpeed", v)}
				inherit={feelDefault(feel, "zoomSpeed", "1×")}
				hint="Scrolling, pinching, the middle button, and + and −."
			/>

			<SwitchField
				label="Invert zoom"
				checked={feel.invertZoom}
				onChange={(v) => setCameraFeel("invertZoom", v)}
				inherit={feelDefault(feel, "invertZoom", "off")}
				hint="Scrolling up zooms out instead of in. Pinching and + and − stay as they are."
			/>

			<SliderField
				label="Smoothing"
				value={Math.round(feel.smoothing * 100)}
				min={0}
				max={100}
				step={5}
				suffix="%"
				onChange={(v) => setCameraFeel("smoothing", v / 100)}
				inherit={feelDefault(feel, "smoothing", "60%")}
				hint="How long the view keeps gliding after you let go: 0% stops at once."
			/>

			<SliderField
				label="Glide to viewpoints"
				value={feel.glideSeconds}
				min={0}
				max={3}
				step={0.1}
				suffix="s"
				onChange={(v) => setCameraFeel("glideSeconds", v)}
				inherit={feelDefault(feel, "glideSeconds", "0.8 s")}
				hint="How long the camera takes to glide to a viewpoint or back to the opening view: 0 jumps there."
			/>

			<SliderField
				label="Keyboard pan speed"
				value={feel.keyboardSpeed}
				min={0.2}
				max={3}
				step={0.1}
				suffix="×"
				onChange={(v) => setCameraFeel("keyboardSpeed", v)}
				inherit={feelDefault(feel, "keyboardSpeed", "1×")}
				hint="With nothing selected, the arrow keys pan; with Shift they turn and tilt the view. + and − zoom, and Home goes back to the opening view."
			/>

			<FieldGroup title="Overlays in Edit mode">
				<SwitchField
					label="Navigation gizmo"
					checked={feel.navigationGizmo}
					onChange={(v) => setCameraFeel("navigationGizmo", v)}
					inherit={feelDefault(feel, "navigationGizmo", "on")}
				/>

				<SwitchField
					label="View label"
					checked={feel.viewLabel}
					onChange={(v) => setCameraFeel("viewLabel", v)}
					inherit={feelDefault(feel, "viewLabel", "on")}
				/>

				<SwitchField
					label="Viewpoints in the world"
					checked={feel.viewpointsInWorld}
					onChange={(v) => setCameraFeel("viewpointsInWorld", v)}
					inherit={feelDefault(feel, "viewpointsInWorld", "off")}
				/>

				<SwitchField
					label="Composition grid"
					checked={feel.compositionGrid}
					onChange={(v) => setCameraFeel("compositionGrid", v)}
					inherit={feelDefault(feel, "compositionGrid", "off")}
				/>

				<Hint>
					The gizmo in the top-right corner shows which way the view looks: click a letter to look
					that way, the middle to look straight down, or drag it to turn. The label says what the
					camera shows; viewpoints show as little cameras (click to select one, double-click to go
					there); the grid splits the view in thirds for lining up viewpoints.
				</Hint>
			</FieldGroup>
		</Section>
	);
};

/**
 * The Camera tab (ADR-0062): where the world opens and how its camera is
 * framed, saved with the world, then how the camera feels to you, saved in
 * this browser.
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
					</ButtonGroup>
				</div>
			)}

			<ConfirmDialog
				open={confirmingReset}
				onOpenChange={setConfirmingReset}
				title="Reset the camera?"
				description="The camera goes back to the whole world in the diorama view, and every camera setting to its default: View and Zoom and tilt for this world (Undo brings those back), and Your camera in this browser. The turntable and tilt-shift keep their settings."
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
						{ value: "diorama", label: "Diorama view" },
						{ value: "perspective", label: "Perspective view" },
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
						value: "diorama view",
					}}
					hint="P switches between them. Like the rest of where you’re looking, it’s remembered for this world in this browser, and a viewpoint keeps its own."
				/>

				<SliderField
					label="Field of view"
					value={camera.fieldOfView}
					min={10}
					max={100}
					step={1}
					suffix="°"
					onChange={(v) => set("fieldOfView", v)}
					inherit={byDefault("fieldOfView", `${CAMERA_DEFAULTS.fieldOfView}°`)}
					hint="For the perspective view (P): small looks flat, like a long lens; large exaggerates depth, like a wide-angle lens. A viewpoint can have its own."
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

				<SwitchField
					label="Keep the camera over the ground"
					checked={camera.keepOverGround}
					onChange={(v) => set("keepOverGround", v)}
					inherit={byDefault("keepOverGround", "on")}
				/>
			</Section>

			<Section
				id="camera.limits"
				icon="focus"
				title="Zoom and tilt"
				keywords="limits zoom in out closest farthest tilt low steep angle elevation"
			>
				<SliderField
					label="Closest zoom"
					value={camera.closestSpan}
					min={1}
					max={100}
					step={1}
					onChange={(v) => set("closestSpan", v)}
					inherit={byDefault("closestSpan", `${CAMERA_DEFAULTS.closestSpan} units`)}
					hint="How many grid units still fit from the top of the view to the bottom when zoomed in all the way."
				/>

				<SliderField
					label="Farthest zoom"
					value={farthestSpanOf(camera, ground)}
					min={10}
					max={2000}
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
					hint="Degrees above the ground: 0 looks level across the world, like standing in it."
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
			</Section>

			<Section
				id="camera.turntable"
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

			<CameraFeelSection />
		</>
	);
};
