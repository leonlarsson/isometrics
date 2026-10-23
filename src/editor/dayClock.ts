import { useEffect, useState, useSyncExternalStore } from "react";

import type { TDataEntry, TLighting } from "#/scene/schema";

import { useEditor } from "./store";

/**
 * What time of day it is in the world, from its lighting settings: fixed, a
 * day cycle that runs while motion plays, the viewer's clock, or a data value
 * (ADR-0052). The 3D lights read the exact time every frame
 * (`sceneHoursNow`); React reads it in steps (`useSceneHours`), so a running
 * day doesn't re-render the world every frame. Runtime state, never saved.
 */

/** Seconds of day cycle played so far (advanced by render/SceneLights while motion plays). */
let cycleSeconds = 0;
const listeners = new Set<() => void>();
/** React updates this many times per in-world hour. */
const STEPS_PER_HOUR = 6;

const local = (now: number) => {
	const date = new Date(now);
	return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
};

/** The world's hour for its settings, data, the time now and the cycle so far; null = classic daylight. */
export const sceneHours = (
	lighting: TLighting,
	data: readonly TDataEntry[],
	now: number,
	cycled: number,
): number | null => {
	switch (lighting.timeSource) {
		case "cycle":
			return ((lighting.time ?? 12) + (cycled / lighting.dayLength) * 24) % 24;
		case "clock":
			return local(now);
		case "data": {
			const value = Number(data.find((entry) => entry.key === lighting.timeKey)?.value);
			return Number.isFinite(value) ? ((value % 24) + 24) % 24 : lighting.time;
		}
		default:
			return lighting.time;
	}
};

const stepOf = (lighting: TLighting) => lighting.dayLength / 24 / STEPS_PER_HOUR;

/** Play `seconds` more of the day cycle (while motion plays). */
export const advanceDayCycle = (seconds: number, lighting: TLighting) => {
	const step = stepOf(lighting);
	const before = Math.floor(cycleSeconds / step);
	cycleSeconds += seconds;
	if (Math.floor(cycleSeconds / step) !== before) {
		for (const listener of listeners) {
			listener();
		}
	}
};

/** The world's hour right now, exactly (for the lights, every frame). */
export const sceneHoursNow = () => {
	const { lighting, data } = useEditor.getState().scene;
	return sceneHours(lighting, data, Date.now(), cycleSeconds);
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/**
 * The world's hour for React, in steps of 10 in-world minutes; null = the
 * classic daylight. Follows the settings, the data, the cycle and the clock.
 */
export const useSceneHours = (): number | null => {
	const lighting = useEditor((s) => s.scene.lighting);
	const data = useEditor((s) => s.scene.data);
	const step = stepOf(lighting);
	const cycled = useSyncExternalStore(
		subscribe,
		() => Math.floor(cycleSeconds / step) * step,
		() => 0,
	);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (lighting.timeSource !== "clock") {
			return;
		}
		const timer = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(timer);
	}, [lighting.timeSource]);
	const hours = sceneHours(lighting, data, now, cycled);
	return hours === null ? null : Math.round(hours * STEPS_PER_HOUR) / STEPS_PER_HOUR;
};
