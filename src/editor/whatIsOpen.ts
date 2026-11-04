import type { TScene, TVec2, TViewPose } from "#/scene/schema";

import type { ISceneItem } from "./framing";

/**
 * What the editor has open (ADR-0121), in one place, so the loading screen,
 * the home screen, saving and the dialogs all go by the same thing:
 *
 * - `starting`: nothing yet, while the page starts;
 * - `link`: a world from a link (`/w/<id>`, `/templates/<id>`, the address it's at) being fetched,
 *   or waiting for an answer before it's built; no other world is loaded;
 * - `home`: no world open (the home screen), and why;
 * - `world`: a world is open; `preview` while it's one from a link that isn't
 *   kept in this browser yet (nothing is saved until it's kept); `workshop`
 *   while it's the Workshop, a world of its own for building a prefab, with
 *   the world it came from to go back to (ADR-0134; nothing is saved there either).
 *
 * Runtime only: never saved, never in the world.
 */
export type TWhatIsOpen =
	| { kind: "starting" }
	| { kind: "link"; link: ILinkAsked; step: TLinkStep }
	| { kind: "home"; why: THomeReason }
	| { kind: "world"; preview: IPreview | null; workshop: IWorkshop | null };

/** A world open as it is: neither a preview nor the Workshop. */
export const OWN_WORLD: Extract<TWhatIsOpen, { kind: "world" }> = {
	kind: "world",
	preview: null,
	workshop: null,
};

/** The Workshop (ADR-0134): what's being built, and the world to go back to. */
export interface IWorkshop {
	/** The world it was opened from, as it was then, with its undo history and the view of it. */
	from: {
		scene: TScene;
		past: TScene[];
		future: TScene[];
		view: TViewPose | null;
	};
	/** The prefab being changed, by its id; null while a new one is made. */
	prefabId: string | null;
	/** Made from things in the world: those things, and where the copy that replaces them goes. */
	replaces: { items: ISceneItem[]; position: TVec2; altitude: number } | null;
	/** The name in the bar: the prefab's. */
	name: string;
}

/** A link the page's address asked to open. */
export interface ILinkAsked {
	/** A shared world (`/w/<id>`), a template (`/templates/<id>`) or a shared prefab (`/p/<id>`, ADR-0134). */
	from: "shared" | "template" | "prefab";
	id: string;
}

/** Where opening a link has got to. */
export type TLinkStep =
	/**
	 * Being fetched. `waited` once a new link is being waited for (it takes up to a minute to
	 * spread): how many tries so far, and the seconds left before giving up.
	 */
	| { kind: "fetching"; waited: { tries: number; secondsLeft: number } | null }
	/** Read, and it reads from addresses this browser hasn't allowed: asked before it's built. */
	| { kind: "asking"; scene: TScene; addresses: string[]; expiresAt: string | null };

/** Why the home screen shows. */
export type THomeReason =
	/** The preference says to start here. */
	| { kind: "chosen" }
	/** No worlds in this browser (the last one was deleted). */
	| { kind: "noWorlds" }
	/** The open world was just deleted (ADR-0132): never another world in its place. */
	| { kind: "deleted" }
	/** A link couldn't be opened; `message` says why, in words. */
	| { kind: "linkFailed"; from: ILinkAsked["from"]; message: string }
	/** A world from a link wasn't opened, by choice. */
	| { kind: "declined"; title: string }
	/** A preview was closed and there's no world of one's own to go back to. */
	| { kind: "closed" };

/** A world from a link, open but not kept in this browser. */
export interface IPreview {
	from: ILinkAsked["from"];
	id: string;
	/** When a shared world's link expires (ISO), if known. */
	expiresAt: string | null;
}

/** The preview open, if the open world is one from a link that isn't kept yet. */
export const previewOf = (whatIsOpen: TWhatIsOpen): IPreview | null =>
	whatIsOpen.kind === "world" ? whatIsOpen.preview : null;

/** The Workshop, if it's what's open (ADR-0134). */
export const workshopOf = (whatIsOpen: TWhatIsOpen): IWorkshop | null =>
	whatIsOpen.kind === "world" ? whatIsOpen.workshop : null;

/**
 * Whether the open world is one's own, kept in this browser: only then is it
 * saved, and where the camera is remembered (not a preview, the Workshop, a link or home).
 */
export const keepsOpenWorld = (whatIsOpen: TWhatIsOpen) =>
	whatIsOpen.kind === "world" && whatIsOpen.preview === null && whatIsOpen.workshop === null;

/**
 * Why actions on the open world as a world (Share a link…, Save to file, Duplicate world, Delete
 * world…, Change this world…) don't apply now, in the words a greyed-out item adds to its label
 * ("Save to file (not in the Workshop)"), or null when they do: there's no world open, or it's
 * the Workshop's, which is no world to pass on or keep (ADR-0134). One answer for every item.
 */
export const whyNoWorldAction = (whatIsOpen: TWhatIsOpen): string | null => {
	if (whatIsOpen.kind !== "world") {
		return "no world is open";
	}
	return whatIsOpen.workshop ? "not in the Workshop" : null;
};

/** A menu item's label with why it's greyed out, if it is. */
export const labelWithReason = (label: string, why: string | null) =>
	why ? `${label} (${why})` : label;

/**
 * Why prefabs can't be made or changed now, in the words a greyed-out option says it with
 * ("Make a prefab… (keep a copy first)"), or null when they can (ADR-0134).
 */
export const whyNoWorkshop = (whatIsOpen: TWhatIsOpen): string | null => {
	if (whatIsOpen.kind !== "world") {
		return "open a world first";
	}
	if (whatIsOpen.preview) {
		return "keep a copy first";
	}
	if (whatIsOpen.workshop) {
		return "not inside the Workshop";
	}
	return null;
};
