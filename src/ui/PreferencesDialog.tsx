import {
	cameraFeelChanged,
	DEFAULT_CAMERA_FEEL,
	OVERLAY_PLACES,
	resetCameraFeel,
	setCameraFeel,
	type TCameraFeel,
	type TOverlay,
	type TOverlayPlace,
	useCameraFeel,
} from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";

import { SelectField, SliderField, SwitchField } from "./fields";
import { type ISettingsPage, SettingsDialog } from "./SettingsDialog";

/** The preferences on each page, for resetting a page. */
const CAMERA_PAGE: (keyof TCameraFeel)[] = [
	"cameraControl",
	"orbitSpeed",
	"zoomSpeed",
	"invertZoom",
	"smoothing",
	"glideSeconds",
];
const KEYBOARD_PAGE: (keyof TCameraFeel)[] = ["keyboardSpeed"];
const OVERLAYS_PAGE: (keyof TCameraFeel)[] = [
	"navigationGizmo",
	"viewLabel",
	"viewpointsInWorld",
	"compositionGrid",
];

/** A page's reset: back to the defaults, offered once any of them changed. */
const pageReset = (feel: TCameraFeel, keys: (keyof TCameraFeel)[]) => ({
	onReset: () => resetCameraFeel(keys),
	changed: cameraFeelChanged(feel, keys),
});

/** A preference's Default / Reset (ADR-0027): its default is the app's. */
const feelDefault = <K extends keyof TCameraFeel>(feel: TCameraFeel, key: K, value: string) => ({
	from: "default",
	inherited: feel[key] === DEFAULT_CAMERA_FEEL[key],
	onReset: () => setCameraFeel(key, DEFAULT_CAMERA_FEEL[key]),
	value,
});

/** A speed, × the usual. */
const speedField = (
	feel: TCameraFeel,
	key: "orbitSpeed" | "zoomSpeed" | "keyboardSpeed",
	label: string,
	hint: string,
) => (
	<SliderField
		label={label}
		value={feel[key]}
		min={0.2}
		max={3}
		step={0.1}
		suffix="×"
		onChange={(v) => setCameraFeel(key, v)}
		inherit={feelDefault(feel, key, "1×")}
		hint={hint}
	/>
);

/** Where an overlay can show, in words. */
const OVERLAY_PLACE_LABELS: Record<TOverlayPlace, string> = {
	off: "Off",
	edit: "Edit mode",
	view: "View mode",
	both: "Both modes",
};

/** Where an overlay shows over the view: nowhere, in Edit mode, in View mode, or in both. */
const overlayField = (feel: TCameraFeel, key: TOverlay, label: string, hint: string) => (
	<SelectField<TOverlayPlace>
		label={label}
		value={feel[key]}
		options={OVERLAY_PLACES.map((place) => ({ value: place, label: OVERLAY_PLACE_LABELS[place] }))}
		onChange={(v) => setCameraFeel(key, v)}
		inherit={feelDefault(feel, key, OVERLAY_PLACE_LABELS[DEFAULT_CAMERA_FEEL[key]])}
		hint={hint}
	/>
);

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

	const pages: ISettingsPage[] = [
		{
			id: "camera",
			reset: pageReset(feel, CAMERA_PAGE),
			label: "Camera",
			icon: "video",
			groups: [
				{
					title: "Navigation",
					rows: [
						{
							id: "cameraControl",
							keywords: "free simple blender limits under ground sky orbit anywhere",
							field: (
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
							),
						},
						{
							id: "orbitSpeed",
							keywords: "turn rotate drag",
							field: speedField(
								feel,
								"orbitSpeed",
								"Orbit speed",
								"Dragging to turn and tilt, and Shift+arrows.",
							),
						},
						{
							id: "zoomSpeed",
							keywords: "scroll wheel pinch",
							field: speedField(
								feel,
								"zoomSpeed",
								"Zoom speed",
								"Scrolling, pinching, the middle button, and + and −.",
							),
						},
						{
							id: "invertZoom",
							keywords: "reverse scroll wheel",
							field: (
								<SwitchField
									label="Invert zoom"
									checked={feel.invertZoom}
									onChange={(v) => setCameraFeel("invertZoom", v)}
									inherit={feelDefault(feel, "invertZoom", "off")}
									hint="Scrolling up zooms out instead of in. Pinching and + and − stay as they are."
								/>
							),
						},
						{
							id: "smoothing",
							keywords: "damping inertia drift",
							field: (
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
							),
						},
					],
				},
				{
					title: "Viewpoints",
					rows: [
						{
							id: "glideSeconds",
							keywords: "flight transition animation",
							field: (
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
							),
						},
					],
				},
			],
		},
		{
			id: "keyboard",
			reset: pageReset(feel, KEYBOARD_PAGE),
			label: "Keyboard",
			icon: "move",
			groups: [
				{
					title: "Moving with the keys",
					rows: [
						{
							id: "keyboardSpeed",
							keywords: "arrows wasd keys pan",
							field: speedField(
								feel,
								"keyboardSpeed",
								"Keyboard pan speed",
								"Panning with the arrow keys, and W A S D.",
							),
						},
					],
					note: "With nothing selected, the arrow keys pan, and with Shift they turn and tilt. W A S D move and Q E go down and up in View mode, or in any mode while you hold the right mouse button. + and − zoom, Home goes back to the opening view, P switches to perspective.",
				},
			],
		},
		{
			id: "overlays",
			reset: pageReset(feel, OVERLAYS_PAGE),
			label: "Overlays",
			icon: "eye",
			groups: [
				{
					title: "Where each overlay shows",
					rows: [
						{
							id: "navigationGizmo",
							keywords: "compass north",
							field: overlayField(
								feel,
								"navigationGizmo",
								"Navigation gizmo",
								"A compass in the top-right corner: click a letter to look that way, the middle to look straight down, or drag it to turn.",
							),
						},
						{
							id: "viewLabel",
							field: overlayField(
								feel,
								"viewLabel",
								"View label",
								"What the camera shows, in the bottom-left corner. Where it isn't shown, it still appears while you move with the keys or fly, to see how fast.",
							),
						},
						{
							id: "viewpointsInWorld",
							keywords: "cameras markers",
							field: overlayField(
								feel,
								"viewpointsInWorld",
								"Viewpoints in the world",
								"Each viewpoint as a little camera: click to select it, double-click to go there.",
							),
						},
						{
							id: "compositionGrid",
							keywords: "thirds",
							field: overlayField(
								feel,
								"compositionGrid",
								"Composition grid",
								"The view in thirds, for lining up viewpoints.",
							),
						},
					],
				},
			],
		},
	];

	return (
		<SettingsDialog
			open={open}
			onOpenChange={setOpen}
			title="Preferences"
			note="Yours alone: kept in this browser for every world, never saved with one."
			pages={pages}
			resetAll={{
				label: "Reset all preferences",
				onReset: () => resetCameraFeel(),
				changed: cameraFeelChanged(feel),
			}}
		/>
	);
};
