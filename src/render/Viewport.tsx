import { Canvas } from "@react-three/fiber";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";

import { AreaHandles } from "./AreaHandles";
import { AreaMesh } from "./AreaMesh";
import { CameraControls } from "./CameraControls";
import { CameraRig } from "./CameraRig";
import { EntityNode } from "./EntityNode";
import { Ground } from "./Ground";
import { KeyboardTransform } from "./KeyboardTransform";
import { LabelProjector } from "./LabelProjector";
import { PlacementPreview } from "./PlacementPreview";
import { RoadDrawTool } from "./RoadDrawTool";
import { RoadHandles } from "./RoadHandles";
import { RoadMesh } from "./RoadMesh";
import { RouteHighlight } from "./RouteHighlight";
import { GizmoFirst } from "./TransformGizmo";

const Lights = () => {
	const palette = usePalette();
	const ground = useEditor((s) => s.scene.ground);
	const half = Math.max(ground.width, ground.depth) * 0.75;
	return (
		<>
			<hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]} />

			<ambientLight intensity={palette.ambientIntensity} />

			<directionalLight
				castShadow
				position={[half * 0.6, half * 1.2, half * 0.4]}
				intensity={palette.sunIntensity}
				shadow-mapSize={[2048, 2048]}
				shadow-camera-left={-half}
				shadow-camera-right={half}
				shadow-camera-top={half}
				shadow-camera-bottom={-half}
				shadow-camera-near={0.5}
				shadow-camera-far={half * 4}
				shadow-bias={-0.0004}
				shadow-normalBias={0.03}
			/>
		</>
	);
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

			{areas.map((area, index) => (
				<AreaMesh key={area.id} area={area} layer={index} />
			))}

			<AreaHandles />

			{entities.map((entity) => (
				<EntityNode key={entity.id} entity={entity} />
			))}

			{roads.map((road, index) => (
				<RoadMesh key={road.id} road={road} layer={index} />
			))}

			<RoadHandles />

			<RoadDrawTool />

			<PlacementPreview />

			<RouteHighlight />

			<CameraControls />

			<GizmoFirst />

			<KeyboardTransform />

			<CameraRig />

			<LabelProjector />
		</Canvas>
	);
};
