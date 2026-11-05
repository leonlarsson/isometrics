/**
 * The owner's controls over sharing (ADR-0145): pausing it (the
 * `SHARING_DISABLED` var), delete keys compared in constant time, and the
 * metadata kept with each share, held under KV's limit whatever its title. No
 * Cloudflare imports here: the routes pass the settings in.
 */

/** What POST answers while sharing is paused, and what the app's share dialogs say. */
export const SHARING_PAUSED = "Sharing is paused for now. Try again later.";

/** Whether the `SHARING_DISABLED` var pauses sharing: true, "true", "1", "yes" or "on". */
export const isSharingDisabled = (setting: unknown) =>
	setting === true ||
	setting === 1 ||
	(typeof setting === "string" &&
		["true", "1", "yes", "on"].includes(setting.trim().toLowerCase()));

const digestOf = async (text: string) =>
	new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

/**
 * Whether two secrets are the same, in time that doesn't depend on where they
 * differ: both are hashed first, so their lengths don't show either.
 */
export const sameSecret = async (given: string, expected: string) => {
	const [a, b] = await Promise.all([digestOf(given), digestOf(expected)]);
	let difference = 0;
	for (let index = 0; index < a.length; index++) {
		difference |= a[index] ^ b[index];
	}
	return difference === 0;
};

/** KV keeps at most 1,024 bytes of metadata as JSON; ours stays under this. */
export const MOST_METADATA_BYTES = 900;

/** The longest title kept in metadata, in characters (it's for the owner, looking up a share). */
const MOST_METADATA_TITLE = 200;

// Control characters (C0, DEL, C1) and the line and paragraph separators: nothing a title needs.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

const metadataBytes = (metadata: object) =>
	new TextEncoder().encode(JSON.stringify(metadata)).length;

/**
 * Metadata with its text field (`field`: a world's title, a prefab's name)
 * cleaned of control characters and cut, by whole characters, until the whole
 * of it is at most MOST_METADATA_BYTES as JSON, so no title can make keeping a
 * share fail.
 */
export const fitMetadata = <T extends object, K extends keyof T>(metadata: T, field: K): T => {
	const text = String(metadata[field] ?? "")
		.replace(CONTROL, " ")
		.trim();
	let characters = [...text].slice(0, MOST_METADATA_TITLE);
	for (;;) {
		const fitted = { ...metadata, [field]: characters.join("") };
		if (metadataBytes(fitted) <= MOST_METADATA_BYTES || characters.length === 0) {
			return fitted;
		}
		characters = characters.slice(0, -1);
	}
};
