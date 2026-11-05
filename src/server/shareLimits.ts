/**
 * How big a share can be (ADR-0145). A shared link is public and kept for up
 * to 30 days, so it must not be a cheap place to keep anything else. These
 * limits apply only when sharing: worlds saved in a browser or opened from a
 * file are never held to them (a limit is never tightened on what people
 * already have). No Cloudflare imports here.
 */

/** A world is kept at most this big, as kept (defaults left out): Stockholm is about 519 kB. */
export const MOST_SHARED_WORLD_BYTES = 1_500_000;

/** A prefab is kept at most this big: a few pieces, a fifth of a world, as before. */
export const MOST_SHARED_PREFAB_BYTES = 300_000;

/** The size of a text in bytes, as kept (UTF-8). */
export const bytesOf = (text: string) => new TextEncoder().encode(text).length;

/** A size in words: "519 kB", "1.5 MB". */
export const sizeInWords = (bytes: number) =>
	bytes >= 1_000_000
		? `${(bytes / 1_000_000).toLocaleString("en", { maximumFractionDigits: 1 })} MB`
		: `${Math.ceil(bytes / 1000).toLocaleString("en")} kB`;
