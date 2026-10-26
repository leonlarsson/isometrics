import { SoftShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { lazy, Suspense } from "react";

import { drawsEffects, useGraphics } from "#/editor/graphics";
import { usePreferences } from "#/editor/preferences";
import { isToggleClick, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";

import { AreaHandles } from "./AreaHandles";
import { AreaMesh } from "./AreaMesh";
import { BoxSelect } from "./BoxSelect";
import { CameraControls } from "./CameraControls";
import { CameraFlight } from "./CameraFlight";
import { CameraFollow } from "./CameraFollow";
import { CameraMemory } from "./CameraMemory";
import { CameraReadout } from "./CameraReadout";
import { CameraRig, FieldOfViewFollow, ProjectionSwitch } from "./CameraRig";
import { Clouds } from "./Clouds";
import { DistanceHaze } from "./DistanceHaze";
import { EntityNode } from "./EntityNode";
import { Ground } from "./Ground";
import { GroundMenuMarker } from "./GroundMenuMarker";
import { GroupGizmo } from "./GroupGizmo";
import { HoverHighlight } from "./HoverHighlight";
import { InstantResize } from "./InstantResize";
import { KeyboardCamera } from "./KeyboardCamera";
import { KeyboardTransform } from "./KeyboardTransform";
import { LabelProjector } from "./LabelProjector";
import { PlacementPreview } from "./PlacementPreview";
import { PointerSpot } from "./PointerSpot";
import { RealLights } from "./RealLights";
import { RoadDrawTool } from "./RoadDrawTool";
import { RoadHandles } from "./RoadHandles";
import { RoadMesh } from "./RoadMesh";
import { RouteHighlight } from "./RouteHighlight";
import { SceneLights } from "./SceneLights";
import { SkyDome } from "./SkyDome";
import { useTiltShiftShown } from "./TiltShift";
import { GizmoFirst } from "./TransformGizmo";
import { Turntable } from "./Turntable";
import { TrafficStep } from "./traffic";
import { ViewpointMarkers } from "./ViewpointMarkers";
import { WakeFieldStep } from "./WakeField";
import { Wireframe } from "./Wireframe";

// The effects composer and its libraries load only once a graphics setting needs them (ADR-0072).
const Effects = lazy(() => import("./Effects").then((module) => ({ default: module.Effects })));

const Lights = () => {
	const palette = usePalette();
	const ground = useEditor((s) => s.scene.ground);
	const lighting = useEditor((s) => s.scene.lighting);
	const shadowMapSize = useGraphics().shadowMapSize;
	const wireframe = usePreferences().showWireframe;
	return (
		<SceneLights
			ground={ground}
			palette={palette}
			lighting={lighting}
			followView
			shadowMapSize={shadowMapSize}
			castsShadows={!wireframe}
		/>
	);
};

export const Viewport = () => {
	const entities = useEditor((s) => s.scene.entities);
	const roads = useEditor((s) => s.scene.roads);
	const areas = useEditor((s) => s.scene.areas);
	const graphics = useGraphics();
	const wireframe = usePreferences().showWireframe;
	const tiltShiftShown = useTiltShiftShown();
	// Wireframe draws as plainly as it can: no effects, tilt-shift included.
	const composed = !wireframe && (drawsEffects(graphics) || tiltShiftShown);

	return (
		<Canvas
			shadows="percentage"
			orthographic
			dpr={[1, graphics.maxPixelDensity]}
			camera={{ position: [100, 90, 100], zoom: 18, near: 0.1, far: 1000 }}
			onPointerMissed={(event) => {
				// Only a left click on nothing deselects; a right-click is the start of an orbit. Shift or
				// Ctrl, which add to the selection, leave it as it is.
				if (event.button === 0 && !isToggleClick(event)) {
					useEditor.getState().clearSelection();
				}
			}}
		>
			<Lights />

			<SkyDome />

			<Clouds />

			<Ground />

			{/* Hidden items keep their index: it's their draw layer. */}
			{areas.map((area, index) =>
				area.hidden ? null : <AreaMesh key={area.id} area={area} layer={index} />,
			)}

			<AreaHandles />

			{entities.map((entity) => (
				<EntityNode key={entity.id} entity={entity} />
			))}

			{roads.map((road, index) =>
				road.hidden ? null : <RoadMesh key={road.id} road={road} layer={index} />,
			)}

			<RoadHandles />

			<GroupGizmo />

			<RoadDrawTool />

			<PlacementPreview />

			<RouteHighlight />

			<GroundMenuMarker />

			<HoverHighlight />

			<CameraControls />

			<GizmoFirst />

			<KeyboardTransform />

			<BoxSelect />

			<PointerSpot />

			<CameraRig />

			<ProjectionSwitch />

			<FieldOfViewFollow />

			<CameraFlight />

			<CameraMemory />

			<KeyboardCamera />

			<Turntable />

			{composed && (
				<Suspense fallback={null}>
					<Effects graphics={graphics} />
				</Suspense>
			)}

			{/* Soft shadow edges; a small light, so long shadows stay. */}
			{graphics.useSoftShadows && <SoftShadows size={8} samples={16} focus={0.6} />}

			{graphics.realLightCount > 0 && <RealLights count={graphics.realLightCount} />}

			{graphics.showDistanceHaze && <DistanceHaze />}

			{/* The boats' waves, which only reflective water shows (ADR-0081). */}
			{graphics.boatWakes === "foamAndWaves" && graphics.showWaterReflections && <WakeFieldStep />}

			{wireframe && <Wireframe />}

			<CameraReadout />

			<ViewpointMarkers />

			<TrafficStep />

			<CameraFollow />

			<LabelProjector />

			<InstantResize />
		</Canvas>
	);
};
