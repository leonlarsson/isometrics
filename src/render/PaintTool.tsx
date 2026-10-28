import { Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { groundHeightAt } from "#/scene/areas";
import type { TVec2 } from "#/scene/schema";

import { surfaceHitOnRay } from "./useGroundDrag";

/** How far apart a stroke's stamps are, as a share of the brush's radius. */
const STAMP_SPACING = 0.5;
/** The ring's points round its circle. */
const RING_SEGMENTS = 48;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

interface ICursor {
	point: TVec2;
	height: number;
	/** Erasing (the eraser, or the brush with Shift held). */
	erasing: boolean;
}

/**
 * Painting objects (ADR-0091), while the paint bar is open: a drag on the view
 * paints with the brush, stamping as it goes, or erases (the eraser, or Shift
 * held); one stroke is one undo step, and what was painted is selected when the bar closes.
 * The left button is taken before the camera and the objects see it, so the
 * drag never pans or picks; the other buttons and the wheel still move the
 * camera. The brush shows as a ring on the ground: solid to paint, dashed to erase.
 */
export const PaintTool = () => {
	const painting = useEditor((s) => s.painting);
	const size = useEditor((s) => s.paintBrush.size);
	const camera = useThree((s) => s.camera);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	const palette = usePalette();
	const [cursor, setCursor] = useState<ICursor | null>(null);

	useEffect(() => {
		if (!painting) {
			setCursor(null);
			return;
		}
		const store = useEditor.getState;
		let stroke: { id: string; last: TVec2; erasing: boolean } | null = null;
		element.style.cursor = "crosshair";

		const swallow = (event: Event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		// Label cards float over the canvas in their own DOM layer, but they're part of the scene.
		const inScene = (target: EventTarget | null) =>
			target instanceof Element &&
			(element.contains(target) || target.closest("[data-label-layer]") !== null);
		/** The ground under the pointer, on raised land where it stands (unsnapped). */
		const groundAt = (event: PointerEvent): { point: TVec2; height: number } | null => {
			const rect = element.getBoundingClientRect();
			pointer.set(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-((event.clientY - rect.top) / rect.height) * 2 + 1,
			);
			raycaster.setFromCamera(pointer, camera);
			// On the ground as it stands under the pointer: raised land and slopes (ADR-0098).
			const found = surfaceHitOnRay(raycaster.ray, store().scene.areas);
			if (!found) {
				return null;
			}
			const point: TVec2 = [found.x, found.z];
			return { point, height: groundHeightAt(store().scene.areas, point) };
		};
		const erasingFor = (event: PointerEvent) =>
			store().paintBrush.mode === "erase" || event.shiftKey;

		const onDown = (event: PointerEvent) => {
			if (!inScene(event.target) || event.button !== 0) {
				return;
			}
			swallow(event);
			const at = groundAt(event);
			if (!at) {
				return;
			}
			const erasing = erasingFor(event);
			stroke = { id: nanoid(8), last: at.point, erasing };
			store().paintAt(at.point, stroke.id, erasing ? "erase" : "paint");
		};
		const onMove = (event: PointerEvent) => {
			if (!stroke && !inScene(event.target)) {
				setCursor(null);
				return;
			}
			const at = groundAt(event);
			if (!at) {
				return;
			}
			setCursor({ ...at, erasing: stroke?.erasing ?? erasingFor(event) });
			if (!stroke) {
				return;
			}
			const { paintBrush } = store();
			const moved = Math.hypot(at.point[0] - stroke.last[0], at.point[1] - stroke.last[1]);
			if (moved >= paintBrush.size * STAMP_SPACING) {
				stroke.last = at.point;
				store().paintAt(at.point, stroke.id, stroke.erasing ? "erase" : "paint");
			}
		};
		const onUp = (event: PointerEvent) => {
			if (!stroke) {
				return;
			}
			swallow(event);
			stroke = null;
			// The click after the stroke would select what's under the pointer.
			window.addEventListener("click", swallow, { capture: true, once: true });
			setTimeout(() => window.removeEventListener("click", swallow, { capture: true }));
		};

		window.addEventListener("pointerdown", onDown, { capture: true });
		window.addEventListener("pointermove", onMove, { capture: true });
		window.addEventListener("pointerup", onUp, { capture: true });
		return () => {
			element.style.cursor = "";
			window.removeEventListener("pointerdown", onDown, { capture: true });
			window.removeEventListener("pointermove", onMove, { capture: true });
			window.removeEventListener("pointerup", onUp, { capture: true });
		};
	}, [painting, camera, element]);

	const ring = useMemo(
		() =>
			Array.from({ length: RING_SEGMENTS + 1 }, (_, i) => {
				const angle = (i / RING_SEGMENTS) * Math.PI * 2;
				return [Math.cos(angle) * size, 0, Math.sin(angle) * size] as [number, number, number];
			}),
		[size],
	);

	if (!painting || !cursor) {
		return null;
	}
	return (
		<group position={[cursor.point[0], cursor.height + 0.08, cursor.point[1]]}>
			<Line
				points={ring}
				color={palette.selection}
				lineWidth={2.5}
				dashed={cursor.erasing}
				dashSize={0.35}
				gapSize={0.25}
			/>

			{/* A dot at the centre, where the stamp lands. */}
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.08, 12]} />

				<meshBasicMaterial color={palette.selection} />
			</mesh>
		</group>
	);
};
