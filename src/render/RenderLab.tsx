import { Environment, Lightformer, SoftShadows } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
	Bloom,
	BrightnessContrast,
	EffectComposer,
	HueSaturation,
	N8AO,
	SMAA,
	TiltShift2,
	ToneMapping,
	Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GradientEquirectTexture, WebGLPathTracer } from "three-gpu-pathtracer";

import { sceneHoursNow, useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { tintColor } from "#/lib/color";
import { skyLightAt } from "#/scene/sun";

import { labEnvStrength, labHas, labWebGpu } from "./labFlags";
import { directionOf } from "./viewpoints";

/**
 * Render lab (prototype, docs/rendering-study): effects switched on by
 * `?fx=a,b,c`. Loaded only when asked for (Viewport), so it never reaches
 * normal use. The WebGPU side loads only on a `LAB_WEBGPU=1` dev server.
 */
const RenderLabGpu = lazy(() =>
	import("./RenderLabGpu").then((module) => ({ default: module.RenderLabGpu })),
);

/** Image-based light from the sky's own colours, so shading varies with direction. */
const SkyEnvironment = () => {
	const palette = usePalette();
	const lighting = useEditor((s) => s.scene.lighting);
	const hours = useSceneHours();
	const sky = skyLightAt(lighting, hours);
	const overhead = tintColor(palette.hemiSky, sky.tint, sky.tintAmount);
	const below = tintColor(palette.hemiGround, sky.tint, sky.tintAmount * 0.6);
	const sun = directionOf(sky.azimuth, Math.max(sky.elevation, 8)).multiplyScalar(40);
	const level = sky.fill;
	return (
		<Environment
			key={`${Math.round((hours ?? 12) * 4)}`}
			frames={1}
			resolution={128}
			environmentIntensity={labEnvStrength * level}
		>
			<mesh scale={100}>
				<sphereGeometry args={[1, 32, 16]} />

				<meshBasicMaterial color={overhead} side={THREE.BackSide} />
			</mesh>

			<mesh position={[0, -30, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={300}>
				<planeGeometry />

				<meshBasicMaterial color={below} />
			</mesh>

			<Lightformer
				form="circle"
				intensity={2.5 * level}
				color={sky.color}
				position={[sun.x, sun.y, sun.z]}
				scale={30}
				target={[0, 0, 0]}
			/>
		</Environment>
	);
};

/** With an environment, the flat fill lights step back so the sky does the filling. */
const DimFlatFill = ({ factor }: { factor: number }) => {
	const scene = useThree((s) => s.scene);
	useFrame(() => {
		scene.traverse((object) => {
			if (object instanceof THREE.HemisphereLight || object instanceof THREE.AmbientLight) {
				object.intensity *= factor;
			}
		});
	});
	return null;
};

const LIT_KINDS: Record<
	string,
	{ y: number; color: "lamp" | "window"; strength: number; reach: number }
> = {
	street_lamp_01: { y: 1.7, color: "lamp", strength: 6, reach: 7 },
	light_01: { y: 1.2, color: "lamp", strength: 6, reach: 7 },
	office_tower_01: { y: 1.5, color: "window", strength: 5, reach: 8 },
	house_01: { y: 0.8, color: "window", strength: 2, reach: 4 },
	warehouse_01: { y: 1, color: "window", strength: 4, reach: 7 },
	depot_01: { y: 1, color: "window", strength: 2, reach: 5 },
	yacht_01: { y: 0.8, color: "window", strength: 1.5, reach: 3 },
};

/** Real point lights where things glow at night: lamps, and a spill of light from lit buildings. */
const RealNightLights = ({ max }: { max: number }) => {
	const entities = useEditor((s) => s.scene.entities);
	const palette = usePalette();
	const lights = useMemo(
		() =>
			entities
				.filter((e) => LIT_KINDS[e.kind])
				.slice(0, max)
				.map((e) => ({ e, spec: LIT_KINDS[e.kind] })),
		[entities, max],
	);
	const group = useRef<THREE.Group>(null);
	useFrame(() => {
		const night = skyLightAt(useEditor.getState().scene.lighting, sceneHoursNow()).night;
		group.current?.children.forEach((child, i) => {
			const light = child as THREE.PointLight;
			light.intensity = lights[i].spec.strength * night;
			light.visible = night > 0.05;
		});
	});
	return (
		<group ref={group}>
			{lights.map(({ e, spec }) => (
				<pointLight
					key={e.id}
					position={[e.position[0], (e.elevation ?? 0) + spec.y * e.scale, e.position[1]]}
					color={spec.color === "lamp" ? palette.lamplight : "#ffd28a"}
					distance={spec.reach * e.scale}
					decay={1.2}
				/>
			))}
		</group>
	);
};

/** More contrast between sun and shade: a stronger sun, a weaker flat fill. */
const KeyLight = () => {
	const scene = useThree((s) => s.scene);
	useFrame(() => {
		scene.traverse((object) => {
			if (object instanceof THREE.DirectionalLight) {
				object.intensity *= 1.3;
			} else if (object instanceof THREE.HemisphereLight || object instanceof THREE.AmbientLight) {
				object.intensity *= 0.55;
			}
		});
	});
	return null;
};

/** A progressive path tracer, like Blender's Cycles: samples add up while the view stays still. */
const PathTrace = () => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const palette = usePalette();
	const lighting = useEditor((s) => s.scene.lighting);
	const hours = useSceneHours();
	const tracer = useRef<WebGLPathTracer | null>(null);
	const seen = useRef(new THREE.Matrix4());
	const zoom = useRef(0);
	useEffect(() => {
		const sky = skyLightAt(lighting, hours);
		const gradient = new GradientEquirectTexture();
		gradient.topColor
			.set(tintColor(palette.hemiSky, sky.tint, sky.tintAmount))
			.multiplyScalar(sky.fill * 0.9);
		gradient.bottomColor
			.set(tintColor(palette.hemiGround, sky.tint, sky.tintAmount))
			.multiplyScalar(sky.fill * 0.5);
		gradient.update();
		const previous = scene.environment;
		const hidden: THREE.Object3D[] = [];
		scene.environment = gradient;
		const timer = setTimeout(() => {
			const t = new WebGLPathTracer(gl);
			t.bounces = 4;
			t.renderScale = 0.5;
			t.minSamples = 1;
			t.renderDelay = 0;
			t.fadeDuration = 0;
			// The path tracer reads standard materials only: hide shader-drawn things (sky, lines, labels).
			scene.traverse((object) => {
				const material = (object as THREE.Mesh).material as
					| THREE.Material
					| THREE.Material[]
					| undefined;
				const list = Array.isArray(material) ? material : material ? [material] : [];
				const readable = list.every(
					(m) =>
						(m as THREE.MeshStandardMaterial).color !== undefined &&
						!(m instanceof THREE.ShaderMaterial),
				);
				if (
					object.visible &&
					(!readable || object.type.startsWith("Line") || object instanceof THREE.Sprite)
				) {
					object.visible = false;
					hidden.push(object);
				}
			});
			t.setScene(scene, camera);
			tracer.current = t;
		}, 1500);
		return () => {
			clearTimeout(timer);
			tracer.current?.dispose();
			tracer.current = null;
			scene.environment = previous;
			for (const object of hidden) {
				object.visible = true;
			}
		};
	}, [hours, camera]);
	useFrame(() => {
		const t = tracer.current;
		if (!t) {
			gl.render(scene, camera);
			return;
		}
		if (
			!seen.current.equals(camera.matrixWorld) ||
			zoom.current !== (camera as THREE.OrthographicCamera).zoom
		) {
			seen.current.copy(camera.matrixWorld);
			zoom.current = (camera as THREE.OrthographicCamera).zoom;
			t.updateCamera();
		}
		try {
			t.renderSample();
		} catch (error) {
			console.error("[pt]", (error as Error).stack?.split("\n").slice(0, 4).join(" | "));
			tracer.current = null;
		}
		(globalThis as { __ptSamples?: number }).__ptSamples = t.samples;
	}, 1);
	return null;
};

/** Everything the lab can switch on. */
export const RenderLab = () => {
	const gl = useThree((s) => s.gl);
	const lighting = useEditor((s) => s.scene.lighting);
	const night = skyLightAt(lighting, useSceneHours()).night;
	const env = labHas("env");
	const post = !labWebGpu && ["ao", "bloom", "tilt", "grade", "agx", "smaa"].some(labHas);
	if (labHas("agx") && !post) {
		gl.toneMapping = THREE.AgXToneMapping;
	}
	if (labHas("vsm")) {
		gl.shadowMap.type = THREE.VSMShadowMap;
	}
	return (
		<>
			{labWebGpu && (
				<Suspense fallback={null}>
					<RenderLabGpu />
				</Suspense>
			)}

			{!labWebGpu && labHas("soft") && <SoftShadows size={18} samples={12} focus={0.6} />}

			{labHas("pt") && <PathTrace />}

			{labHas("key") && <KeyLight />}

			{env && <SkyEnvironment />}

			{env && <DimFlatFill factor={0.15} />}

			{labHas("lamps") && <RealNightLights max={labHas("lamps64") ? 64 : 24} />}

			{post && (
				<EffectComposer multisampling={labHas("smaa") ? 0 : 4} enableNormalPass={false}>
					<>
						{labHas("ao") && (
							<N8AO aoRadius={2.2} distanceFalloff={1} intensity={2.4} quality="high" halfRes />
						)}
					</>

					<>
						{labHas("bloom") && (
							<Bloom mipmapBlur luminanceThreshold={0.85} intensity={1.1 * night} radius={0.7} />
						)}
					</>

					<>{labHas("grade") && <HueSaturation saturation={0.12} />}</>

					<>{labHas("grade") && <BrightnessContrast contrast={0.08} />}</>

					<>
						{labHas("tilt") && (
							<TiltShift2 blur={0.1} taper={0.6} start={[0.5, 0.0]} end={[0.5, 1.0]} />
						)}
					</>

					<ToneMapping mode={labHas("agx") ? ToneMappingMode.AGX : ToneMappingMode.ACES_FILMIC} />

					<>{labHas("grade") && <Vignette offset={0.3} darkness={0.45} />}</>

					<>{labHas("smaa") && <SMAA />}</>
				</EffectComposer>
			)}
		</>
	);
};
