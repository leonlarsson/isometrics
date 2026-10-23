import { Canvas } from "@react-three/fiber";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";

import { AreaHandles } from "./AreaHandles";
import { AreaMesh } from "./AreaMesh";
import { CameraControls } from "./CameraControls";
import { CameraFlight } from "./CameraFlight";
import { CameraFollow } from "./CameraFollow";
import { CameraRig, ProjectionSwitch } from "./CameraRig";
import { EntityNode } from "./EntityNode";
import { Ground } from "./Ground";
import { GroundMenuMarker } from "./GroundMenuMarker";
import { HoverHighlight } from "./HoverHighlight";
import { KeyboardTransform } from "./KeyboardTransform";
import { LabelProjector } from "./LabelProjector";
import { PlacementPreview } from "./PlacementPreview";
import { RoadDrawTool } from "./RoadDrawTool";
import { RoadHandles } from "./RoadHandles";
import { RoadMesh } from "./RoadMesh";
import { RouteHighlight } from "./RouteHighlight";
import { SceneLights } from "./SceneLights";
import { GizmoFirst } from "./TransformGizmo";
import { TrafficStep } from "./traffic";

const Lights = () => {
	const palette = usePalette();
	const ground = useEditor((s) => s.scene.ground);
	return <SceneLights ground={ground} palette={palette} followView />;
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
				// Only a left click on nothing deselects; a right-click is the start of an orbit.
				if (event.button === 0) {
					useEditor.getState().clearSelection();
				}
			}}
		>
			<Lights />

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

			<RoadDrawTool />

			<PlacementPreview />

			<RouteHighlight />

			<GroundMenuMarker />

			<HoverHighlight />

			<CameraControls />

			<GizmoFirst />

			<KeyboardTransform />

			<CameraRig />

			<ProjectionSwitch />

			<CameraFlight />

			<TrafficStep />

			<CameraFollow />

			<LabelProjector />
		</Canvas>
	);
};
