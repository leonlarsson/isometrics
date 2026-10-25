import {
	DEFAULT_CAMERA_FEEL,
	setCameraFeel,
	type TCameraFeel,
	useCameraFeel,
} from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";
import { farthestSpanOf } from "#/render/cameraMath";
import type { TCameraSettings } from "#/scene/schema";

import { Button } from "./Button";
import { Hint, Section, SelectField, SliderField, SwitchField } from "./fields";
import { viewpointName } from "./ViewpointsSection";

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
			keywords="speed orbit turn zoom scroll wheel invert reverse smooth smoothing damping inertia glide flight viewpoint personal browser keyboard keys arrows"
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
			/>

			<SwitchField
				label="Scroll up to zoom out"
				checked={feel.invertZoom}
				onChange={(v) => setCameraFeel("invertZoom", v)}
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
				label="Keyboard speed"
				value={feel.keyboardSpeed}
				min={0.2}
				max={3}
				step={0.1}
				suffix="×"
				onChange={(v) => setCameraFeel("keyboardSpeed", v)}
				inherit={feelDefault(feel, "keyboardSpeed", "1×")}
				hint="With nothing selected, the arrow keys pan; with Shift they turn and tilt the view. + and − zoom, and Home goes back to the opening view."
			/>
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
	const opening = viewpoints.some((v) => v.id === camera.openingViewpointId)
		? (camera.openingViewpointId ?? "")
		: "";

	return (
		<>
			<Section
				id="camera.view"
				icon="video"
				title="View"
				keywords="opening view start field of view fov lens perspective wide angle ground"
			>
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

				<SliderField
					label="Field of view"
					value={camera.fieldOfView}
					min={10}
					max={100}
					step={1}
					suffix="°"
					onChange={(v) => set("fieldOfView", v)}
					hint="For the perspective view (P): small looks flat, like a long lens; large exaggerates depth, like a wide-angle lens. A viewpoint can have its own."
				/>

				<SwitchField
					label="Keep the camera over the ground"
					checked={camera.keepOverGround}
					onChange={(v) => set("keepOverGround", v)}
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
					suffix="units"
					onChange={(v) => set("closestSpan", v)}
					hint="How many grid units still fit from the top of the view to the bottom when zoomed in all the way."
				/>

				<SliderField
					label="Farthest zoom"
					value={farthestSpanOf(camera, ground)}
					min={10}
					max={2000}
					step={10}
					suffix="units"
					onChange={(v) => set("farthestSpan", v)}
					inherit={{
						from: "default",
						inherited: camera.farthestSpan === null,
						onReset: () => set("farthestSpan", null),
						value: `${farthestSpanOf({ farthestSpan: null }, ground)}, from the ground’s size`,
					}}
				/>

				<SliderField
					label="Lowest tilt"
					value={camera.lowestElevation}
					min={2}
					max={80}
					step={1}
					suffix="°"
					onChange={(v) => set("lowestElevation", v)}
					hint="Degrees above the ground: low looks across the world, like standing in it."
				/>

				<SliderField
					label="Steepest tilt"
					value={camera.steepestElevation}
					min={20}
					max={89}
					step={1}
					suffix="°"
					onChange={(v) => set("steepestElevation", v)}
					hint="89° looks almost straight down, like a map."
				/>
			</Section>

			<CameraFeelSection />
		</>
	);
};
