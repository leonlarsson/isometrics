import { z } from "zod";

import { APP_NAME } from "#/lib/app";
import { repairWorld } from "#/parts/repairWorld";
import { Vec2Schema } from "#/scene/schema";

import { rememberedView, workshopViewKey } from "./cameraMemory";
import { openWorldId } from "./persistence";
import type { useEditor } from "./store";
import { workshopOf } from "./whatIsOpen";

/**
 * The Workshop over a reload (ADR-0134): what's being built is kept in this
 * tab (session storage) while the Workshop is open, with the world it's for,
 * so reloading the page opens that world and the Workshop on it again, as it
 * was, with its camera. Nothing of it is kept once it's left; the world
 * itself is saved as always. A session that can't be read is forgotten.
 */
const KEY = `${APP_NAME.toLowerCase()}:workshop`;

/** How long building has to pause before it's kept (a drag is many changes). */
const KEEP_DELAY_MS = 400;

const SessionSchema = z.object({
	/** The stored world it's for (null: the world not saved yet). */
	worldId: z.string().nullable(),
	/** The Workshop's world, read like any world from storage. */
	scene: z.unknown(),
	prefabId: z.string().nullable(),
	replaces: z
		.object({
			items: z.array(
				z.object({ kind: z.enum(["entity", "road", "area", "fence"]), id: z.string() }),
			),
			position: Vec2Schema,
			altitude: z.number(),
		})
		.nullable(),
	name: z.string(),
	description: z.string(),
	showsGround: z.boolean(),
});

const forget = () => {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// Storage unavailable: nothing was kept.
	}
};

/**
 * Keep the Workshop in this tab while it's open, a moment after each change, and forget it once
 * it's left. Returns an unsubscribe.
 */
export const keepWorkshopSession = (store: typeof useEditor) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const keep = () => {
		const { scene, whatIsOpen } = store.getState();
		const workshop = workshopOf(whatIsOpen);
		if (!workshop) {
			return;
		}
		const { prefabId, replaces, name, description, showsGround } = workshop;
		try {
			sessionStorage.setItem(
				KEY,
				JSON.stringify({
					worldId: openWorldId(),
					scene,
					prefabId,
					replaces,
					name,
					description,
					showsGround,
				}),
			);
		} catch {
			// Storage unavailable or full: a reload leaves the Workshop, as before.
		}
	};
	const unsubscribe = store.subscribe((state, previous) => {
		if (state.scene === previous.scene && state.whatIsOpen === previous.whatIsOpen) {
			return;
		}
		clearTimeout(timer);
		if (workshopOf(state.whatIsOpen)) {
			timer = setTimeout(keep, KEEP_DELAY_MS);
		} else if (workshopOf(previous.whatIsOpen)) {
			forget();
		}
	});
	const keepNow = () => {
		clearTimeout(timer);
		keep();
	};
	window.addEventListener("pagehide", keepNow);
	return () => {
		clearTimeout(timer);
		window.removeEventListener("pagehide", keepNow);
		unsubscribe();
	};
};

/**
 * After a reload: the Workshop again, if this tab had it open on the world that's open now,
 * with the camera where it was in it. Returns whether it did.
 */
export const resumeWorkshopSession = (store: typeof useEditor) => {
	let raw: string | null = null;
	try {
		raw = sessionStorage.getItem(KEY);
	} catch {
		return false;
	}
	if (!raw) {
		return false;
	}
	try {
		const session = SessionSchema.parse(JSON.parse(raw));
		const state = store.getState();
		if (session.worldId !== openWorldId() || state.whatIsOpen.kind !== "world") {
			forget();
			return false;
		}
		const { scene } = repairWorld(session.scene);
		state.enterWorkshop(
			{ ...scene, prefabs: [] },
			{
				prefabId: session.prefabId,
				replaces: session.replaces,
				name: session.name,
				description: session.description,
				showsGround: session.showsGround,
				isResumed: true,
				from: {
					scene: state.scene,
					past: state.past,
					future: state.future,
					view: rememberedView(session.worldId),
				},
			},
		);
		const remembered = rememberedView(workshopViewKey(session.prefabId));
		if (remembered) {
			store.getState().showOpeningView(remembered);
		}
		return true;
	} catch {
		forget();
		return false;
	}
};
