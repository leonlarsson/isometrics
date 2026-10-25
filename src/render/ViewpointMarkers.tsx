import interUrl from "@fontsource/inter/files/inter-latin-600-normal.woff?url";
import { Billboard, Line, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useCameraFeel } from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { DEG2RAD } from "#/lib/math";
import type { TViewpoint } from "#/scene/schema";

import { openViewpointMenuOnClick } from "./contextMenu";
import { currentView, directionOf, runningFlight, sameView } from "./viewpoints";

const UP = new THREE.Vector3(0, 1, 0);

/** How far back the diorama view's marker stands, as a share of its span (it has no real distance). */
const DIORAMA_DEPTH = 0.6;
/** How long the marker's view pyramid is, in camera sizes. */
const PYRAMID_LENGTH = 3;

interface IMarkerShape {
	/** Where the little camera sits, and which way it faces. */
	camera: THREE.Vector3;
	facing: THREE.Quaternion;
	/** A short pyramid of what it sees (a box in the diorama view, which sees no wider further away). */
	lines: [number, number, number][][];
	/** How big the little camera is drawn. */
	size: number;
}

/**
 * Where a viewpoint's marker goes, like a camera in Blender: a little camera
 * where it looks from, with a short pyramid in front of it as wide as its
 * view (for the canvas's shape now), and a triangle on top saying which way
 * is up in it. In the diorama view the pyramid is a box: it sees no wider
 * further away.
 */
const markerShape = (
	viewpoint: TViewpoint,
	aspect: number,
	worldFieldOfView: number,
): IMarkerShape => {
	const target = new THREE.Vector3(viewpoint.target[0], 0, viewpoint.target[1]);
	const back = directionOf(viewpoint.azimuth, viewpoint.elevation);
	const forward = back.clone().negate();
	const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
	const up = new THREE.Vector3().crossVectors(right, forward).normalize();
	const size = Math.max(0.5, viewpoint.span * 0.03);
	const length = size * PYRAMID_LENGTH;
	const fieldOfView = viewpoint.fieldOfView ?? worldFieldOfView;
	const distance = viewpoint.perspective
		? viewpoint.span / 2 / Math.tan((fieldOfView * DEG2RAD) / 2)
		: viewpoint.span * DIORAMA_DEPTH;
	const camera = target.clone().addScaledVector(back, distance);
	const end = camera.clone().addScaledVector(forward, length);
	const halfHeight = viewpoint.perspective
		? length * Math.tan((fieldOfView * DEG2RAD) / 2)
		: size * 0.8;
	const halfWidth = halfHeight * aspect;
	/** A point `x` across and `y` up from `centre`, in the view's own directions. */
	const at = (centre: THREE.Vector3, x: number, y: number) =>
		centre.clone().addScaledVector(right, x).addScaledVector(up, y).toArray() as [
			number,
			number,
			number,
		];
	const rectangle = (centre: THREE.Vector3) => [
		at(centre, -halfWidth, -halfHeight),
		at(centre, halfWidth, -halfHeight),
		at(centre, halfWidth, halfHeight),
		at(centre, -halfWidth, halfHeight),
	];
	const far = rectangle(end);
	const lines = [[...far, far[0]]];
	if (viewpoint.perspective) {
		const apex = camera.toArray() as [number, number, number];
		for (const corner of far) {
			lines.push([apex, corner]);
		}
	} else {
		const near = rectangle(camera);
		lines.push([...near, near[0]]);
		near.forEach((corner, index) => {
			lines.push([corner, far[index]]);
		});
	}
	const base = halfHeight + size * 0.15;
	lines.push([
		at(end, -halfWidth * 0.5, base),
		at(end, halfWidth * 0.5, base),
		at(end, 0, base + halfWidth * 0.45),
		at(end, -halfWidth * 0.5, base),
	]);
	const facing = new THREE.Quaternion().setFromRotationMatrix(
		new THREE.Matrix4().lookAt(camera, target, UP),
	);
	return { camera, facing, lines, size };
};

interface IViewpointMarkerProps {
	viewpoint: TViewpoint;
	index: number;
	aspect: number;
}

const ViewpointMarker = ({ viewpoint, index, aspect }: IViewpointMarkerProps) => {
	const palette = usePalette();
	const worldFieldOfView = useEditor((s) => s.scene.camera.fieldOfView);
	const selected = useEditor((s) => s.activeViewpointId === viewpoint.id);
	const [hovered, setHovered] = useState(false);
	const group = useRef<THREE.Group>(null);
	const shape = useMemo(
		() => markerShape(viewpoint, aspect, worldFieldOfView),
		[viewpoint, aspect, worldFieldOfView],
	);
	const strong = hovered || selected;
	const color = strong ? palette.selection : palette.text;
	const name = viewpoint.name || `Viewpoint ${index + 1}`;

	const entered = useEditor((s) => s.enteredViewpointId === viewpoint.id);

	// Not drawn while the camera shows exactly this view (it would sit right on the camera), nor
	// once the camera went to it and is still in it, even after looking around a little. Gliding
	// there, a perspective camera stays until the glide ends, so it looks like flying into it; a
	// diorama camera goes at once: its view's camera stands far back (how far makes no difference
	// to what it sees), so the glide would end well behind the marker instead of in it.
	useFrame(() => {
		const pose = currentView.read?.();
		const here = Boolean(pose && sameView(pose, viewpoint, worldFieldOfView));
		const inside = entered && (!viewpoint.perspective || !runningFlight.gliding());
		if (group.current) {
			group.current.visible = !here && !inside;
		}
	});

	return (
		<group ref={group}>
			{shape.lines.map((points, line) => (
				<Line
					// biome-ignore lint/suspicious/noArrayIndexKey: the lines are fixed in number and order
					key={line}
					points={points}
					color={color}
					lineWidth={strong ? 2 : 1}
					transparent
					opacity={strong ? 0.9 : 0.35}
					depthTest={false}
				/>
			))}

			<group position={shape.camera} quaternion={shape.facing}>
				{/* The body and, in front of it (cameras look down their −z), the lens. */}
				<mesh scale={shape.size}>
					<boxGeometry args={[1.4, 1, 1]} />

					<meshBasicMaterial color={color} transparent opacity={strong ? 1 : 0.7} />
				</mesh>

				<mesh position={[0, 0, -0.7 * shape.size]} rotation-x={-Math.PI / 2} scale={shape.size}>
					<coneGeometry args={[0.45, 0.6, 12]} />

					<meshBasicMaterial color={color} transparent opacity={strong ? 1 : 0.7} />
				</mesh>

				{/* An invisible ball around it to click: the camera itself is small. A click selects it
				(its settings in the Viewpoints tab), a double-click goes there. */}
				<mesh
					scale={shape.size * 1.6}
					onClick={(event) => {
						event.stopPropagation();
						useEditor.getState().selectViewpoint(viewpoint.id);
					}}
					onDoubleClick={(event) => {
						event.stopPropagation();
						useEditor.getState().goToViewpoint(viewpoint.id);
					}}
					onContextMenu={openViewpointMenuOnClick(viewpoint.id)}
					onPointerOver={(event) => {
						event.stopPropagation();
						setHovered(true);
						document.body.style.cursor = "pointer";
					}}
					onPointerOut={() => {
						setHovered(false);
						document.body.style.cursor = "";
					}}
				>
					<sphereGeometry args={[1, 8, 6]} />

					<meshBasicMaterial visible={false} />
				</mesh>
			</group>

			{/* Its name above it, always facing the view. The font loads on first use: until then
			only the name waits, not the whole canvas. */}
			<Suspense fallback={null}>
				<Billboard position={[shape.camera.x, shape.camera.y + shape.size * 1.3, shape.camera.z]}>
					<Text
						font={interUrl}
						fontSize={shape.size * 0.7}
						color={color}
						anchorY="bottom"
						outlineWidth={shape.size * 0.06}
						outlineColor={palette.ground}
					>
						{name}
					</Text>
				</Billboard>
			</Suspense>
		</group>
	);
};

/**
 * The saved viewpoints drawn in the world in Edit mode (Your camera →
 * Viewpoints in the world, ADR-0062): each a little camera where it looks
 * from, with a short pyramid of what it sees and its name. Click one to select
 * it, double-click to go there, right-click for its menu. The one the camera
 * is at isn't drawn.
 */
export const ViewpointMarkers = () => {
	const shown = useCameraFeel().viewpointsInWorld;
	const editing = useEditor((s) => s.mode === "edit");
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const aspect = useThree((s) => (s.size.height > 0 ? s.size.width / s.size.height : 1.5));
	if (!shown || !editing) {
		return null;
	}
	return (
		<>
			{viewpoints.map((viewpoint, index) => (
				<ViewpointMarker key={viewpoint.id} viewpoint={viewpoint} index={index} aspect={aspect} />
			))}
		</>
	);
};
