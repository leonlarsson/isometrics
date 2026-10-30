import { useEffect, useState, useSyncExternalStore } from "react";

import { keepOnHotReload } from "#/lib/hot";
import type { TLighting, TReadableValues } from "#/scene/schema";
import { skyLightAt } from "#/scene/sun";

import { useEditor } from "./store";
import { useWorldData, worldDataNow } from "./worldData";

/**
 * What time of day it is in the world, from its lighting settings: fixed, a
 * day cycle that runs while motion plays, the viewer's clock, or a data value
 * (ADR-0052). The 3D lights read the exact time every frame
 * (`sceneHoursNow`); React reads it in steps (`useSceneHours`), so a running
 * day doesn't re-render the world every frame. Runtime state, never saved.
 */

/** Seconds of day cycle played so far (advanced by render/SceneLights while motion plays). */
const cycle = keepOnHotReload("dayCycle", () => ({ seconds: 0 }));
const listeners = keepOnHotReload("dayCycleListeners", () => new Set<() => void>());

const local = (now: number) => {
	const date = new Date(now);
	return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
};

/** The world's hour for its settings, data, the time now and the cycle so far; null = classic daylight. */
export const sceneHours = (
	lighting: TLighting,
	data: TReadableValues,
	now: number,
	cycled: number,
): number | null => {
	switch (lighting.timeSource) {
		case "cycle":
			return ((lighting.time ?? 12) + (cycled / lighting.dayLength) * 24) % 24;
		case "clock":
			return local(now);
		case "data": {
			const value = Number(data.find((entry) => entry.key === lighting.data.time?.key)?.value);
			return Number.isFinite(value) ? ((value % 24) + 24) % 24 : lighting.time;
		}
		default:
			return lighting.time;
	}
};

/**
 * React follows a running day in steps of at least one world minute, and at
 * most about this many times a real second however fast the day runs.
 */
const UPDATES_PER_SECOND = 4;

/** How many world hours one React step of a day cycle covers: a minute, more for fast days. */
const cycleStepHours = (lighting: TLighting) =>
	Math.max(1, Math.ceil((24 * 60) / lighting.dayLength / UPDATES_PER_SECOND)) / 60;

/**
 * The hour as React shows it: the viewer's clock to the minute, a day cycle in
 * its steps, a set time (or one from data) exactly.
 */
export const shownHours = (hours: number, lighting: TLighting) => {
	if (lighting.timeSource === "clock") {
		return Math.floor(hours * 60) / 60;
	}
	if (lighting.timeSource === "cycle") {
		const step = cycleStepHours(lighting);
		return (Math.round(hours / step) * step) % 24;
	}
	return hours;
};

/** Seconds of day cycle per React step. */
const stepOf = (lighting: TLighting) => (cycleStepHours(lighting) / 24) * lighting.dayLength;

/** Play `seconds` more of the day cycle (while motion plays). */
export const advanceDayCycle = (seconds: number, lighting: TLighting) => {
	const step = stepOf(lighting);
	const before = Math.floor(cycle.seconds / step);
	cycle.seconds += seconds;
	if (Math.floor(cycle.seconds / step) !== before) {
		for (const listener of listeners) {
			listener();
		}
	}
};

/**
 * Start the day cycle again from its start time (`lighting.time`): picking a
 * time while a day runs moves the world to that time, and the day goes on
 * from there.
 */
export const restartDayCycle = () => {
	cycle.seconds = 0;
	for (const listener of listeners) {
		listener();
	}
};

/** The world's hour right now, exactly (for the lights, every frame). */
export const sceneHoursNow = () => {
	const { lighting } = useEditor.getState().scene;
	return sceneHours(lighting, worldDataNow().values, Date.now(), cycle.seconds);
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/**
 * Something worked out from the world's hour, for React: it re-renders only
 * when that changes, not on every step of a running day. `select` must give a
 * number or null (compared by value). Follows the settings, the data (only
 * when the time comes from data), the cycle and the clock.
 */
const useFromSceneHours = <T extends number | null>(
	select: (hours: number | null, lighting: TLighting) => T,
): T => {
	const lighting = useEditor((s) => s.scene.lighting);
	const values = useWorldData().values;
	const data = lighting.timeSource === "data" ? values : NO_DATA;
	const step = stepOf(lighting);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (lighting.timeSource !== "clock") {
			return;
		}
		// Right away, then just after each minute turns, so it shows the minute it is.
		setNow(Date.now());
		let timer = 0;
		const nextMinute = () => {
			timer = window.setTimeout(
				() => {
					setNow(Date.now());
					nextMinute();
				},
				60_000 - (Date.now() % 60_000) + 50,
			);
		};
		nextMinute();
		return () => window.clearTimeout(timer);
	}, [lighting.timeSource]);
	return useSyncExternalStore(
		subscribe,
		() =>
			select(sceneHours(lighting, data, now, Math.floor(cycle.seconds / step) * step), lighting),
		() => select(sceneHours(lighting, data, now, 0), lighting),
	);
};

const NO_DATA: TReadableValues = [];

/**
 * The world's hour for React: exact for a set time, to the minute for the
 * viewer's clock, in steps for a day cycle (`shownHours`); null = the classic
 * daylight, and always null while `enabled` is false (so a component that only
 * sometimes needs the hour doesn't re-render on every step).
 */
export const useSceneHours = (enabled = true): number | null =>
	useFromSceneHours((hours, lighting) =>
		!enabled || hours === null ? null : shownHours(hours, lighting),
	);

/**
 * How dark it is in the world (0 by day to 1 at night, in tenths), re-rendering
 * only when that changes: about twenty times a day, at dusk and dawn.
 */
export const useSceneNight = (): number =>
	useFromSceneHours((hours, lighting) => Math.round(skyLightAt(lighting, hours).night * 10) / 10);
