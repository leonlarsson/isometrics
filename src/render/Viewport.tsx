import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { selectSelectedEntity, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";

import { CameraRig } from "./CameraRig";
import { EntityNode } from "./EntityNode";
import { Ground } from "./Ground";
import { LabelProjector } from "./LabelProjector";
import { PathLine } from "./PathLine";

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
	const paths = useEditor((s) => s.scene.paths);
	const select = useEditor((s) => s.select);
	const selectedPathId = useEditor((s) => selectSelectedEntity(s)?.follow?.pathId ?? null);
	const mode = useEditor((s) => s.mode);

	return (
		<Canvas
			shadows="percentage"
			orthographic
			dpr={[1, 2]}
			camera={{ position: [100, 90, 100], zoom: 18, near: 0.1, far: 1000 }}
			onPointerMissed={() => select(null)}
		>
			<Lights />

			<Ground />

			{entities.map((entity) => (
				<EntityNode key={entity.id} entity={entity} />
			))}

			{paths.map(
				(path) =>
					(path.visible || (mode === "edit" && path.id === selectedPathId)) && (
						<PathLine key={path.id} path={path} />
					),
			)}

			<OrbitControls
				makeDefault
				enableDamping
				dampingFactor={0.12}
				minPolarAngle={0.25}
				maxPolarAngle={1.2}
				minZoom={2}
				maxZoom={160}
			/>

			<CameraRig />

			<LabelProjector />
		</Canvas>
	);
};
