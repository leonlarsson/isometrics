import type { TScene } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

interface ISceneLightsProps {
	ground: TScene["ground"];
	palette: IScenePalette;
}

/** The scene's sky, fill and sun; the sun's shadows cover the whole ground. */
export const SceneLights = ({ ground, palette }: ISceneLightsProps) => {
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
