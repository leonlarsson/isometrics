import { useEditor } from "#/editor/store";
import { farthestSpanOf } from "#/render/cameraMath";
import type { TCameraSettings } from "#/scene/schema";

import { Button } from "./Button";
import { Hint, Section, SelectField, SliderField, SwitchField } from "./fields";
import { viewpointName } from "./ViewpointsSection";

/**
 * The Camera tab (ADR-0062): where the world opens and how its camera is
 * framed, saved with the world.
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
		</>
	);
};
