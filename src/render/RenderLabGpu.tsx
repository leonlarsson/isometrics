import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { ClusteredLighting } from "three/addons/lighting/ClusteredLighting.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { ssgi } from "three/addons/tsl/display/SSGINode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import {
	add,
	colorToDirection,
	diffuseColor,
	directionToColor,
	mrt,
	normalView,
	output,
	pass,
	sample,
	uniform,
	vec4,
	velocity,
} from "three/tsl";
import * as THREE from "three/webgpu";

import { sceneHoursNow } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { skyLightAt } from "#/scene/sun";

import { labHas } from "./labFlags";

/**
 * Render lab, WebGPU side (prototype, docs/rendering-study): only on a dev
 * server started with `LAB_WEBGPU=1`, where `three` is the WebGPU build.
 */

/** R3F's `gl` factory: a WebGPU renderer, with clustered lighting for `?fx=many`. */
export const createGpuRenderer = async (props: { canvas: HTMLCanvasElement | OffscreenCanvas }) => {
	const renderer = new THREE.WebGPURenderer({
		...(props as object),
		canvas: props.canvas as HTMLCanvasElement,
		antialias: !labHas("traa"),
		alpha: true,
		forceWebGL: labHas("webgl2"),
	});
	if (labHas("many") && !labHas("forward")) {
		renderer.lighting = new ClusteredLighting(1024);
	}
	await renderer.init();
	return renderer;
};

/** GTAO or SSGI, bloom at night and temporal anti-aliasing, as one TSL pipeline. */
const GpuPipeline = () => {
	const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer;
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const nightStrength = useMemo(() => uniform(0), []);

	const pipeline = useMemo(() => {
		const p = new THREE.RenderPipeline(gl);
		const scenePass = pass(scene, camera);
		scenePass.setMRT(
			mrt({
				output,
				diffuseColor,
				normal: directionToColor(normalView),
				velocity,
			}),
		);
		const color = scenePass.getTextureNode("output");
		const diffuse = scenePass.getTextureNode("diffuseColor");
		const depth = scenePass.getTextureNode("depth");
		const normalTexture = scenePass.getTextureNode("normal");
		const normal = sample((uv) => colorToDirection(normalTexture.sample(uv)));

		// TSL's types narrow each node to its class; the pipeline only needs a vec4 node.
		let lit: THREE.Node<"vec4"> = color;
		if (labHas("ssgi")) {
			const gi = ssgi(color, depth, normal, camera as THREE.PerspectiveCamera);
			gi.sliceCount.value = 2;
			gi.stepCount.value = 8;
			gi.radius.value = 6;
			lit = vec4(add(color.rgb.mul(gi.a), diffuse.rgb.mul(gi.rgb)), color.a);
		} else if (labHas("gtao")) {
			const occlusion = ao(depth, normal, camera);
			occlusion.radius.value = 1.5;
			lit = vec4(color.rgb.mul(occlusion.getTextureNode().x), color.a);
		}
		let out: THREE.Node<"vec4"> = lit;
		if (labHas("bloom")) {
			out = out.add(bloom(lit, 1, 0.6, 0.85).mul(nightStrength));
		}
		if (labHas("traa")) {
			out = traa(
				out,
				depth,
				scenePass.getTextureNode("velocity"),
				camera,
			) as unknown as THREE.Node<"vec4">;
		}
		p.outputNode = out;
		return p;
	}, [gl, scene, camera, nightStrength]);

	useEffect(() => () => pipeline.dispose(), [pipeline]);

	useFrame(() => {
		nightStrength.value = skyLightAt(useEditor.getState().scene.lighting, sceneHoursNow()).night;
		pipeline.render();
	}, 1);
	return null;
};

/**
 * Many real lights for clustered shading: every lamp, a few round each office
 * tower at different floors, a glow by every house and yacht. ~100 in Brightwater.
 */
const ManyLights = () => {
	const entities = useEditor((s) => s.scene.entities);
	const palette = usePalette();
	const lights = useMemo(() => {
		const list: {
			key: string;
			position: [number, number, number];
			color: string;
			reach: number;
			strength: number;
		}[] = [];
		for (const e of entities) {
			const [x, z] = e.position;
			const y = e.elevation ?? 0;
			const s = e.scale;
			if (e.kind === "street_lamp_01" || e.kind === "light_01") {
				list.push({
					key: e.id,
					position: [x, y + 1.7 * s, z],
					color: palette.lamplight,
					reach: 7,
					strength: 6,
				});
			} else if (e.kind === "office_tower_01") {
				for (let i = 0; i < 6; i++) {
					const angle = (i / 6) * Math.PI * 2;
					list.push({
						key: `${e.id}-${i}`,
						position: [
							x + Math.cos(angle) * 2.2 * s,
							y + (0.6 + (i % 3) * 2.2) * s,
							z + Math.sin(angle) * 2.2 * s,
						],
						color: i % 2 ? "#ffd28a" : "#cfe2ff",
						reach: 4.5,
						strength: 2.5,
					});
				}
			} else if (
				[
					"house_01",
					"yacht_01",
					"warehouse_01",
					"depot_01",
					"car_01",
					"truck_01",
					"delivery_van_01",
				].includes(e.kind)
			) {
				list.push({
					key: e.id,
					position: [x, y + 0.7 * s, z],
					color: "#ffd28a",
					reach: 3.5,
					strength: 2,
				});
			}
		}
		return list;
	}, [entities, palette.lamplight]);
	const group = useRef<THREE.Group>(null);
	useFrame(() => {
		const night = skyLightAt(useEditor.getState().scene.lighting, sceneHoursNow()).night;
		group.current?.children.forEach((child, i) => {
			(child as THREE.PointLight).intensity = lights[i].strength * night;
		});
	});
	useEffect(() => {
		console.log(`[lab] real lights: ${lights.length}`);
	}, [lights.length]);
	return (
		<group ref={group}>
			{lights.map((l) => (
				<pointLight
					key={l.key}
					position={l.position}
					color={l.color}
					distance={l.reach}
					decay={1.2}
				/>
			))}
		</group>
	);
};

export const RenderLabGpu = () => {
	const post = ["gtao", "ssgi", "bloom", "traa"].some(labHas);
	return (
		<>
			{labHas("many") && <ManyLights />}

			{post && <GpuPipeline />}
		</>
	);
};
