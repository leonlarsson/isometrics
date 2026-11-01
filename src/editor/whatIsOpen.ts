import type { TScene } from "#/scene/schema";

/**
 * What the editor has open (ADR-0121), in one place, so the loading screen,
 * the home screen, saving and the dialogs all go by the same thing:
 *
 * - `starting`: nothing yet, while the page starts;
 * - `link`: a world from a link (`/w/<id>`, `/templates/<id>`) being fetched,
 *   or waiting for an answer before it's built; no other world is loaded;
 * - `home`: no world open (the home screen), and why;
 * - `world`: a world is open; `preview` while it's one from a link that isn't
 *   kept in this browser yet (nothing is saved until it's kept).
 *
 * Runtime only: never saved, never in the world.
 */
export type TWhatIsOpen =
	| { kind: "starting" }
	| { kind: "link"; link: ILinkAsked; step: TLinkStep }
	| { kind: "home"; why: THomeReason }
	| { kind: "world"; preview: IPreview | null };

/** A link the page's address asked to open. */
export interface ILinkAsked {
	from: "shared" | "template";
	id: string;
}

/** Where opening a link has got to. */
export type TLinkStep =
	/** Being fetched; `isArriving` once a new link is being waited for (it takes up to a minute to spread). */
	| { kind: "fetching"; isArriving: boolean }
	/** Read, and it reads from addresses this browser hasn't allowed: asked before it's built. */
	| { kind: "asking"; scene: TScene; addresses: string[]; expiresAt: string | null };

/** Why the home screen shows. */
export type THomeReason =
	/** The preference says to start here. */
	| { kind: "chosen" }
	/** No worlds in this browser (the last one was deleted). */
	| { kind: "noWorlds" }
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

/**
 * Whether the open world is one's own, kept in this browser: only then is it
 * saved, and where the camera is remembered (not a preview, a link or home).
 */
export const keepsOpenWorld = (whatIsOpen: TWhatIsOpen) =>
	whatIsOpen.kind === "world" && whatIsOpen.preview === null;
