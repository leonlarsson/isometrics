import { type PointerEvent, useEffect, useRef } from "react";

import { overlayShownIn, usePreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";
import { DEG2RAD } from "#/lib/math";
import { keepsIsometricAngle } from "#/render/isometricLock";
import { cameraCommands, liveCamera } from "#/render/liveCamera";
import { currentView, isometricPoseOf } from "#/render/viewpoints";

import { Tooltip } from "./Tooltip";

import styles from "./NavigationGizmo.module.css";

/** The gizmo's size and its compass ring's radius (px). */
const SIZE = 88;
const RADIUS = 31;
/** Dragging this many px turns the view once, like dragging across a 300 px tall view. */
const DRAG_TURN_PX = 300;

/** The compass points: where each lies (azimuth, degrees counter-clockwise from +x; −z is north). */
const POINTS = [
	{ letter: "N", name: "north", azimuth: 90 },
	{ letter: "E", name: "east", azimuth: 0 },
	{ letter: "S", name: "south", azimuth: 270 },
	{ letter: "W", name: "west", azimuth: 180 },
] as const;

/**
 * Glide to the view as it is, changed by `change`. While the world keeps the
 * isometric angle, to the diagonal nearest the way asked for, at that angle;
 * it doesn't look straight down then.
 */
const glide = (change: { azimuth?: number; elevation?: number }) => {
	const pose = currentView.read?.();
	if (!pose) {
		return;
	}
	if (keepsIsometricAngle()) {
		if (change.azimuth !== undefined) {
			useEditor
				.getState()
				.glideTo({ ...isometricPoseOf({ ...pose, ...change }), projection: pose.projection });
		}
		return;
	}
	useEditor.getState().glideTo({ ...pose, ...change });
};

/**
 * The navigation gizmo (ADR-0062): a compass in the top-right corner of the
 * view in Edit mode that turns with the camera and flattens as it looks lower.
 * Click a point to look that way (it moves to the top), the middle to look straight down (as
 * steep as the world lets it), or drag it to turn and tilt the view. It moves
 * every frame without re-rendering: the points are placed straight from
 * liveCamera.
 */
export const NavigationGizmo = () => {
	const place = usePreferences().navigationGizmo;
	const mode = useEditor((s) => s.mode);
	const shown = overlayShownIn(place, mode);
	const ring = useRef<SVGEllipseElement>(null);
	const points = useRef<(HTMLButtonElement | null)[]>([]);
	const drag = useRef<{ id: number; x: number; y: number } | null>(null);

	useEffect(() => {
		if (!shown) {
			return;
		}
		let frame = 0;
		const place = () => {
			const { azimuth, elevation } = liveCamera;
			// Flat looking level, round looking straight down, or straight up at the sky.
			const squash = Math.max(0.08, Math.abs(Math.sin(elevation * DEG2RAD)));
			ring.current?.setAttribute("ry", String(RADIUS * squash));
			POINTS.forEach((point, index) => {
				// Counter-clockwise from the top of the gizmo, which is where the camera looks.
				const angle = (point.azimuth - azimuth - 180) * DEG2RAD;
				const x = SIZE / 2 - RADIUS * Math.sin(angle);
				const y = SIZE / 2 - RADIUS * Math.cos(angle) * squash;
				const element = points.current[index];
				if (element) {
					element.style.transform = `translate(${x}px, ${y}px)`;
					// The near half of the ring sits in front of the far half.
					element.style.zIndex = Math.cos(angle) < 0 ? "2" : "1";
				}
			});
			frame = requestAnimationFrame(place);
		};
		place();
		return () => cancelAnimationFrame(frame);
	}, [shown]);

	if (!shown) {
		return null;
	}

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget || event.button !== 0) {
			return;
		}
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
	};
	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const current = drag.current;
		if (current?.id !== event.pointerId) {
			return;
		}
		const dx = event.clientX - current.x;
		const dy = event.clientY - current.y;
		drag.current = { ...current, x: event.clientX, y: event.clientY };
		// Like right-dragging the view: sideways turns it, down tips it towards straight down.
		cameraCommands.orbit?.((-2 * Math.PI * dx) / DRAG_TURN_PX, (-2 * Math.PI * dy) / DRAG_TURN_PX);
	};
	const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
		if (drag.current?.id === event.pointerId) {
			drag.current = null;
		}
	};

	return (
		<div
			className={styles.gizmo}
			data-label-obstacle=""
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
		>
			<svg className={styles.ring} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
				<ellipse ref={ring} cx={SIZE / 2} cy={SIZE / 2} rx={RADIUS} ry={RADIUS} />
			</svg>

			<Tooltip label="Look straight down" side="left">
				<button
					type="button"
					className={styles.centre}
					aria-label="Look straight down"
					onClick={() => glide({ elevation: useEditor.getState().scene.camera.steepestElevation })}
				/>
			</Tooltip>

			{POINTS.map((point, index) => (
				<Tooltip key={point.letter} label={`Look ${point.name}`} side="left">
					<button
						ref={(element) => {
							points.current[index] = element;
						}}
						type="button"
						className={styles.point}
						data-north={point.letter === "N" || undefined}
						aria-label={`Look ${point.name}`}
						// Looking north, the camera stands to the south of what it looks at.
						onClick={() => glide({ azimuth: (point.azimuth + 180) % 360 })}
					>
						{point.letter}
					</button>
				</Tooltip>
			))}
		</div>
	);
};
