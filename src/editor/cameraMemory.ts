import { APP_NAME } from "#/lib/app";
import { type TViewPose, ViewpointSchema } from "#/scene/schema";

/**
 * Where the camera was in each world, per browser: reopening a world (or
 * reloading the page) puts the camera back there. Runtime state like the
 * panel sizes, never part of the world (AGENTS.md), so orbiting doesn't
 * change the world, its undo history or its save status. Keyed by the stored
 * world's id. See docs/adr/0062-camera-settings.md.
 *
 * When the stored shape changes: nothing is migrated. An entry that can't be
 * read is dropped, and that world opens at its opening view once.
 */
const KEY = `${APP_NAME.toLowerCase()}:camera`;

const PoseSchema = ViewpointSchema.pick({
	target: true,
	targetAltitude: true,
	azimuth: true,
	elevation: true,
	span: true,
	projection: true,
	fieldOfView: true,
});

/** World id → where the camera was. */
export type TCameraMemory = Record<string, TViewPose>;

/** Stored memory: every entry that reads as a pose, so one bad entry doesn't forget the rest. */
export const parseCameraMemory = (raw: string | null): TCameraMemory => {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return {};
		}
		const memory: TCameraMemory = {};
		for (const [id, entry] of Object.entries(value)) {
			const pose = PoseSchema.safeParse(entry);
			if (pose.success) {
				memory[id] = pose.data;
			}
		}
		return memory;
	} catch {
		return {};
	}
};

/** Read fresh every time, so another tab of the app's cameras aren't overwritten. */
const read = () => {
	try {
		return parseCameraMemory(localStorage.getItem(KEY));
	} catch {
		return {};
	}
};

const write = (memory: TCameraMemory) => {
	try {
		localStorage.setItem(KEY, JSON.stringify(memory));
	} catch {
		// Storage unavailable or full: the world opens at its opening view next time.
	}
};

/**
 * The world that isn't stored yet (the untouched starter, "Not saved yet")
 * has no id: its camera is remembered under this one until the world's first
 * save gives it an id (adoptUnsavedView). Not an id nanoid makes.
 */
export const UNSAVED_WORLD = "(not saved yet)";

/** The world just got its first save: its camera so far is now under its own id. */
export const adoptUnsavedView = (worldId: string) => {
	const memory = read();
	const pose = memory[UNSAVED_WORLD];
	if (pose) {
		delete memory[UNSAVED_WORLD];
		write({ ...memory, [worldId]: pose });
	}
};

/** Where the camera was in a world, if this browser remembers it. */
export const rememberedView = (worldId: string | null): TViewPose | null =>
	worldId ? (read()[worldId] ?? null) : null;

export const rememberView = (worldId: string, pose: TViewPose) =>
	write({ ...read(), [worldId]: pose });

/** Forget a world's camera (the world was deleted). */
export const forgetView = (worldId: string) => {
	const memory = read();
	if (worldId in memory) {
		delete memory[worldId];
		write(memory);
	}
};

/** How long the camera has to be still before where it is gets stored. */
const SAVE_DELAY_MS = 500;

const pending: {
	timer: ReturnType<typeof setTimeout> | undefined;
	save: (() => void) | null;
} = { timer: undefined, save: null };

/**
 * The camera moved: store where it is once it has been still for a moment.
 * `save` reads the view and stores it (render/CameraMemory), so a burst of
 * moves only reads and writes once.
 */
export const cameraMoved = (save: () => void) => {
	pending.save = save;
	clearTimeout(pending.timer);
	pending.timer = setTimeout(saveCameraNow, SAVE_DELAY_MS);
};

/** Store a camera move that's still waiting, now: before another world opens, or the page closes. */
export const saveCameraNow = () => {
	clearTimeout(pending.timer);
	const save = pending.save;
	pending.save = null;
	save?.();
};
