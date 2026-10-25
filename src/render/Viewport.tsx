import { Canvas } from "@react-three/fiber";

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
import { RoadDrawTool } from "./RoadDrawTool";
import { RoadHandles } from "./RoadHandles";
import { RoadMesh } from "./RoadMesh";
import { RouteHighlight } from "./RouteHighlight";
import { SceneLights } from "./SceneLights";
import { SkyDome } from "./SkyDome";
import { TiltShift } from "./TiltShift";
import { GizmoFirst } from "./TransformGizmo";
import { Turntable } from "./Turntable";
import { TrafficStep } from "./traffic";
import { ViewpointMarkers } from "./ViewpointMarkers";

const Lights = () => {
	const palette = usePalette();
	const ground = useEditor((s) => s.scene.ground);
	const lighting = useEditor((s) => s.scene.lighting);
	return <SceneLights ground={ground} palette={palette} lighting={lighting} followView />;
};

export const Viewport = () => {
	const entities = useEditor((s) => s.scene.entities);
	const roads = useEditor((s) => s.scene.roads);
	const areas = useEditor((s) => s.scene.areas);

	return (
		<Canvas
			shadows="percentage"
			orthographic
			dpr={[1, 2]}
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

			<TiltShift />

			<CameraReadout />

			<ViewpointMarkers />

			<TrafficStep />

			<CameraFollow />

			<LabelProjector />

			<InstantResize />
		</Canvas>
	);
};
