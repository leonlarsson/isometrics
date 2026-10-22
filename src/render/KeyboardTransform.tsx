import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { type ITransformSession, useEditor } from "#/editor/store";
import type { TRoadPoint, TScene } from "#/scene/schema";

import type { IGizmoDrag, TGizmoHandle } from "./TransformGizmo";
import {
	applyEntityDrag,
	applyRoadPointDrag,
	entityStart,
	type IEntityStart,
	roadPointStart,
	roadPointWorld,
} from "./transforms";

type TTarget =
	| { kind: "entity"; id: string; from: IEntityStart }
	| { kind: "point"; roadId: string; index: number; from: TRoadPoint };

interface IContext {
	target: TTarget;
	token: string;
	before: TScene;
	/** World position the transform pivots on, and where it shows on screen (px, y up). */
	center: THREE.Vector3;
	centerPx: THREE.Vector2;
	/** Pointer when the transform started, and now (NDC). */
	from: THREE.Vector2;
	now: THREE.Vector2;
	/** Ground point under the pointer at the start. */
	fromHit: THREE.Vector3 | null;
	pixelsPerUnit: number;
	/** Screen angle of the pointer around the centre (degrees), and the turn so far. */
	angle: number;
	turn: number;
	alt: boolean;
}

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const up = new THREE.Vector3();

const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

/**
 * Blender-style keyboard transforms (G move, R turn, S resize) for the
 * selected object or road point. While `transform` is set in the store, the
 * mouse drives the change without holding a button; ui/TransformBar handles
 * the keys (axis lock, typed numbers, Enter, Esc). A left click confirms, a
 * right click cancels. The whole transform is one undo step.
 */
export const KeyboardTransform = () => {
	const mode = useEditor((s) => s.transform?.mode ?? null);
	const axis = useEditor((s) => s.transform?.axis ?? null);
	const typed = useEditor((s) => s.transform?.typed ?? "");
	const camera = useThree((s) => s.camera);
	const pointer = useThree((s) => s.pointer);
	const size = useThree((s) => s.size);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	const context = useRef<IContext | null>(null);

	const toPx = (ndc: THREE.Vector2) =>
		new THREE.Vector2((ndc.x * size.width) / 2, (ndc.y * size.height) / 2);

	const groundHit = (ndc: THREE.Vector2, y: number) => {
		raycaster.setFromCamera(ndc, camera);
		plane.constant = -y;
		const hit = new THREE.Vector3();
		return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
	};

	const apply = (session: ITransformSession) => {
		const ctx = context.current;
		if (!ctx) {
			return;
		}
		const value = Number.parseFloat(session.typed);
		const exact = Number.isFinite(value);
		const free = exact || ctx.alt || !useEditor.getState().snapping;
		const drag = (handle: TGizmoHandle, patch: Partial<IGizmoDrag>): IGizmoDrag => ({
			handle,
			offset: [0, 0],
			lift: 0,
			turn: 0,
			ratio: 1,
			free,
			token: ctx.token,
			...patch,
		});

		const steps: IGizmoDrag[] = [];
		if (session.mode === "grab") {
			// Always set both the ground position and the height, so switching axis resets the other.
			let offset: [number, number] = [0, 0];
			let lift = 0;
			if (exact) {
				if (session.axis === "y") {
					lift = value;
				} else if (session.axis === "z") {
					offset = [0, value];
				} else {
					offset = [value, 0];
				}
			} else if (session.axis === "y") {
				lift = ((ctx.now.y - ctx.from.y) * size.height) / 2 / ctx.pixelsPerUnit;
			} else {
				const hit = groundHit(ctx.now, ctx.center.y);
				if (hit && ctx.fromHit) {
					const dx = hit.x - ctx.fromHit.x;
					const dz = hit.z - ctx.fromHit.z;
					offset = session.axis === "x" ? [dx, 0] : session.axis === "z" ? [0, dz] : [dx, dz];
				}
			}
			steps.push(drag("xz", { offset }), drag("y", { lift }));
		} else if (session.mode === "rotate") {
			steps.push(drag("rotate", { turn: exact ? value : ctx.turn }));
		} else {
			const fromDistance = toPx(ctx.from).distanceTo(ctx.centerPx);
			const ratio = exact
				? value
				: fromDistance > 1
					? toPx(ctx.now).distanceTo(ctx.centerPx) / fromDistance
					: 1;
			steps.push(drag("scale", { ratio }));
		}

		const { target } = ctx;
		for (const step of steps) {
			if (target.kind === "entity") {
				applyEntityDrag(target.id, target.from, step);
			} else {
				applyRoadPointDrag(target.roadId, target.index, target.from, step);
			}
		}
	};

	// Start and stop a transform.
	useEffect(() => {
		if (!mode) {
			return;
		}
		const state = useEditor.getState();
		let target: TTarget | null = null;
		let center: THREE.Vector3 | null = null;
		if (state.selectedId) {
			const from = entityStart(state.selectedId);
			if (from) {
				target = { kind: "entity", id: state.selectedId, from };
				center = new THREE.Vector3(from.position[0], from.elevation, from.position[1]);
			}
		} else if (state.selectedRoadId && state.selectedPointIndex !== null) {
			const from = roadPointStart(state.selectedRoadId, state.selectedPointIndex);
			if (from) {
				target = {
					kind: "point",
					roadId: state.selectedRoadId,
					index: state.selectedPointIndex,
					from,
				};
				center = roadPointWorld(state.selectedRoadId, from);
			}
		}
		if (!target || !center) {
			state.endTransform();
			return;
		}

		const projected = center.clone().project(camera);
		up.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
		const from = pointer.clone();
		const fromPx = toPx(from);
		const centerPx = toPx(new THREE.Vector2(projected.x, projected.y));
		context.current = {
			target,
			token: `transform:${mode}:${performance.now()}`,
			before: state.scene,
			center,
			centerPx,
			from,
			now: from.clone(),
			fromHit: groundHit(from, center.y),
			pixelsPerUnit: Math.max(1, up.y * camera.zoom),
			angle: (Math.atan2(fromPx.y - centerPx.y, fromPx.x - centerPx.x) * 180) / Math.PI,
			turn: 0,
			alt: false,
		};

		const finish = () => {
			const store = useEditor.getState();
			store.setCancelGesture(null);
			store.endTransform();
		};
		const cancel = () => {
			if (context.current) {
				useEditor.getState().revertTo(context.current.before);
			}
			finish();
		};
		state.setCancelGesture(cancel);

		const onMove = (event: PointerEvent) => {
			const ctx = context.current;
			const session = useEditor.getState().transform;
			if (!ctx || !session) {
				return;
			}
			const rect = element.getBoundingClientRect();
			ctx.now.set(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-((event.clientY - rect.top) / rect.height) * 2 + 1,
			);
			ctx.alt = event.altKey;
			const nowPx = toPx(ctx.now);
			const angle =
				(Math.atan2(nowPx.y - ctx.centerPx.y, nowPx.x - ctx.centerPx.x) * 180) / Math.PI;
			ctx.turn += wrap(angle - ctx.angle);
			ctx.angle = angle;
			apply(session);
		};

		// Clicks in the scene confirm (left) or cancel (right) instead of selecting things.
		const swallow = (event: Event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		const onDown = (event: PointerEvent) => {
			if (!element.contains(event.target as Node)) {
				return;
			}
			swallow(event);
			// Swallow the click that follows this press too, but only that one.
			window.addEventListener("click", swallow, { capture: true, once: true });
			window.addEventListener(
				"pointerup",
				() => setTimeout(() => window.removeEventListener("click", swallow, { capture: true })),
				{ capture: true, once: true },
			);
			if (event.button === 2) {
				cancel();
			} else {
				finish();
			}
		};
		const onContextMenu = (event: MouseEvent) => {
			if (element.contains(event.target as Node)) {
				event.preventDefault();
			}
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerdown", onDown, { capture: true });
		window.addEventListener("contextmenu", onContextMenu, { capture: true });
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerdown", onDown, { capture: true });
			window.removeEventListener("contextmenu", onContextMenu, { capture: true });
			if (useEditor.getState().cancelGesture === cancel) {
				useEditor.getState().setCancelGesture(null);
			}
			context.current = null;
		};
	}, [mode]);

	// Typing a number or locking an axis re-applies straight away, without moving the mouse.
	useEffect(() => {
		const session = useEditor.getState().transform;
		if (session) {
			apply(session);
		}
	}, [axis, typed]);

	return null;
};
