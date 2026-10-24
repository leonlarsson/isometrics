import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { usePalette } from "#/editor/useTheme";
import { resolvePartColors } from "#/parts/colorModel";
import { resolvePartLights } from "#/parts/lightModel";
import { getPart, resolveProps } from "#/parts/registry";

import { frameBoxIn, PartLights } from "./thumbnails";

/** Radians per second the part turns. */
const TURN_SPEED = 0.6;
const FILL = 0.8;

const bounds = new THREE.Box3();

/** One part, turning slowly, framed so it never touches the edges while it turns. */
const Turntable = ({ kind }: { kind: string }) => {
	const palette = usePalette();
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const turning = useRef<THREE.Group>(null);
	const framed = useRef(false);
	const part = getPart(kind);

	// Frame the space the part sweeps while it turns (a box as wide as its widest corner in
	// every direction), so the zoom never changes.
	const frame = () => {
		if (framed.current || !turning.current || !(camera instanceof THREE.OrthographicCamera)) {
			return;
		}
		framed.current = true;
		bounds.setFromObject(turning.current);
		const reach = Math.max(
			...[bounds.min.x, bounds.max.x].flatMap((x) =>
				[bounds.min.z, bounds.max.z].map((z) => Math.hypot(x, z)),
			),
		);
		bounds.min.x = -reach;
		bounds.max.x = reach;
		bounds.min.z = -reach;
		bounds.max.z = reach;
		frameBoxIn(camera, bounds, size, FILL);
	};

	// After the part's own layout effects, so everything it builds is there. Parts that build
	// asynchronously (text) call onReady instead.
	useEffect(() => {
		if (!part?.rendersAsync) {
			frame();
		}
	}, []);

	useFrame((_, delta) => {
		if (turning.current) {
			turning.current.rotation.y += Math.min(delta, 0.1) * TURN_SPEED;
		}
	});

	if (!part) {
		return null;
	}
	const props = resolveProps(part, {});
	const colors = resolvePartColors(part, palette);
	const Component = part.Component;
	return (
		<>
			<PartLights palette={palette} />

			{/* Start turned a little, like the thumbnail's angle but alive. */}
			<group ref={turning} rotation={[0, -0.4, 0]}>
				<Component
					props={props}
					colors={colors}
					palette={palette}
					lights={resolvePartLights(part, palette)}
					playing
					onReady={part.rendersAsync ? frame : undefined}
				/>
			</group>
		</>
	);
};

/**
 * A live 3D view of one part, slowly turning: the Add to scene panel's hover
 * preview. One at a time; switching `kind` keeps the same canvas.
 */
export const PartPreviewModel = ({ kind }: { kind: string }) => {
	return (
		<Canvas orthographic dpr={[1, 2]} camera={{ near: 0.1, far: 200 }} gl={{ alpha: true }}>
			<Turntable key={kind} kind={kind} />
		</Canvas>
	);
};
