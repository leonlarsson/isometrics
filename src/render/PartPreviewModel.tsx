import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { usePalette } from "#/editor/useTheme";
import { clamp } from "#/lib/math";
import { getPart } from "#/parts/registry";
import { NO_OBJECT_SETTINGS, type TObjectSettings } from "#/scene/objectSettings";
import type { IScenePalette } from "#/scene/theme";

import { frameBoxIn, PartLights, partBounds, partDrawing } from "./thumbnails";

/** Radians per second the part turns. */
const TURN_SPEED = 0.6;
const FILL = 0.8;
/** With `zoomsWithWheel`: how far in and out the wheel goes, from the framed view. */
const ZOOM_LIMITS = { min: 0.5, max: 6 };
/** How much a wheel step zooms (per pixel scrolled). */
const ZOOM_PER_PIXEL = 0.0015;

const bounds = new THREE.Box3();

interface IPreviewProps {
	kind: string;
	/** The colours to show it in; the world's by default. */
	palette?: IScenePalette;
	/** An object's settings to show it with (the parts catalogue); the part's own by default. */
	settings?: TObjectSettings;
	/** The hour, for lights on a schedule. */
	hour?: number | null;
	/** The mouse wheel zooms in and out (the parts catalogue). */
	zoomsWithWheel?: boolean;
}

/** One part, turning slowly, framed so it never touches the edges while it turns. */
const Turntable = ({
	kind,
	palette: given,
	settings = NO_OBJECT_SETTINGS,
	hour = null,
	zoomsWithWheel,
}: IPreviewProps) => {
	const worldPalette = usePalette();
	const palette = given ?? worldPalette;
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const size = useThree((s) => s.size);
	const turning = useRef<THREE.Group>(null);
	const framed = useRef(false);
	/** The zoom that frames the part, and how far the wheel has zoomed from it. */
	const fitted = useRef(1);
	const zoomed = useRef(1);
	const part = getPart(kind);

	// Frame the space the part sweeps while it turns (a box as wide as its widest corner in
	// every direction), so the zoom never changes.
	const frame = () => {
		if (framed.current || !turning.current || !(camera instanceof THREE.OrthographicCamera)) {
			return;
		}
		framed.current = true;
		// Measured unturned, so the box is the part's own, not one around it at an angle.
		const angle = turning.current.rotation.y;
		turning.current.rotation.y = 0;
		partBounds(turning.current, bounds);
		turning.current.rotation.y = angle;
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
		fitted.current = camera.zoom;
		camera.zoom = fitted.current * zoomed.current;
		camera.updateProjectionMatrix();
	};

	useEffect(() => {
		if (!zoomsWithWheel) {
			return;
		}
		const onWheel = (event: WheelEvent) => {
			// Zoom the part, not scroll what's around it.
			event.preventDefault();
			zoomed.current = clamp(
				zoomed.current * Math.exp(-event.deltaY * ZOOM_PER_PIXEL),
				ZOOM_LIMITS.min,
				ZOOM_LIMITS.max,
			);
			camera.zoom = fitted.current * zoomed.current;
			camera.updateProjectionMatrix();
		};
		gl.domElement.addEventListener("wheel", onWheel, { passive: false });
		return () => gl.domElement.removeEventListener("wheel", onWheel);
	}, [zoomsWithWheel, gl, camera]);

	// After the part's own layout effects, so everything it builds is there. Parts that build
	// asynchronously (text) call onReady instead.
	// Framed again when its settings change its size.
	const propsKey = JSON.stringify(settings.props);
	useEffect(() => {
		framed.current = false;
		if (!part?.rendersAsync) {
			frame();
		}
	}, [propsKey]);

	useFrame((_, delta) => {
		if (turning.current) {
			turning.current.rotation.y += Math.min(delta, 0.1) * TURN_SPEED;
		}
	});

	if (!part) {
		return null;
	}
	const { props, colors, lights } = partDrawing(part, settings, palette, hour);
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
					lights={lights}
					playing
					onReady={part.rendersAsync ? frame : undefined}
				/>
			</group>
		</>
	);
};

/**
 * A live 3D view of one part, slowly turning: the Add to scene panel's hover
 * preview, and the parts catalogue's. One at a time; switching `kind` keeps the
 * same canvas. In the world's colours, or the `palette` given (the catalogue's
 * theme, at night with its lights on), with an object's `settings` if given.
 */
export const PartPreviewModel = ({
	kind,
	palette,
	settings,
	hour,
	zoomsWithWheel,
}: IPreviewProps) => {
	return (
		<Canvas
			orthographic
			dpr={[1, 2]}
			camera={{ near: 0.1, far: 200 }}
			gl={{ alpha: true }}
			// Its layout size, not its size on screen: measured while a dialog scales in, that's too
			// small, and a scale ending doesn't count as a resize.
			resize={{ offsetSize: true }}
		>
			<Turntable
				key={kind}
				kind={kind}
				palette={palette}
				settings={settings}
				hour={hour}
				zoomsWithWheel={zoomsWithWheel}
			/>
		</Canvas>
	);
};
