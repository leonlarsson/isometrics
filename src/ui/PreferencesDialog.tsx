import {
	DEFAULT_CAMERA_FEEL,
	setCameraFeel,
	type TCameraFeel,
	useCameraFeel,
} from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";

import { Dialog } from "./Dialog";
import { FieldGroup, Hint, SelectField, SliderField, SwitchField } from "./fields";

/** A preference's Default / Reset (ADR-0027): its default is the app's. */
const feelDefault = <K extends keyof TCameraFeel>(feel: TCameraFeel, key: K, value: string) => ({
	from: "default",
	inherited: feel[key] === DEFAULT_CAMERA_FEEL[key],
	onReset: () => setCameraFeel(key, DEFAULT_CAMERA_FEEL[key]),
	value,
});

/**
 * Preferences (File → Preferences…, ADR-0062): how the camera moves for you
 * and what's drawn over the view while editing, kept in this browser for
 * every world and never saved with one (editor/cameraFeel). The world's own
 * camera settings are in its Camera tab, as Blender keeps navigation in its
 * preferences and a camera's lens on the camera.
 */
export const PreferencesDialog = () => {
	const open = useEditor((s) => s.preferencesOpen);
	const setOpen = useEditor((s) => s.setPreferencesOpen);
	const feel = useCameraFeel();
	return (
		<Dialog
			open={open}
			onOpenChange={setOpen}
			title="Preferences"
			description="Yours alone: these apply to every world in this browser and aren’t saved with any world."
			closeLabel="Done"
		>
			<FieldGroup title="Camera">
				<SelectField<TCameraFeel["cameraControl"]>
					label="Camera control"
					value={feel.cameraControl}
					options={[
						{ value: "simple", label: "Simple" },
						{ value: "free", label: "Free, like Blender" },
					]}
					onChange={(v) => setCameraFeel("cameraControl", v)}
					inherit={feelDefault(feel, "cameraControl", "simple")}
					hint={
						feel.cameraControl === "simple"
							? "The camera stays above the world, within the world’s zoom and tilt (Camera tab)."
							: "Orbit anywhere: under the ground, straight up at the sky, as close or far as you like. The world’s zoom and tilt don’t apply to you."
					}
				/>

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
					hint="With nothing selected, the arrow keys pan; with Shift they turn and tilt the view. In View mode W A S D move and Q E go down and up. + and − zoom, and Home goes back to the opening view."
				/>
			</FieldGroup>

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
		</Dialog>
	);
};
