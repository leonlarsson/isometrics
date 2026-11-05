import { ABUSE_CONTACT, APP_NAME } from "./app";

/**
 * Reporting what someone shared by link (ADR-0145): an email to ABUSE_CONTACT
 * with what it is, its link and its id written in, for whoever reads reports
 * to find and take it down (docs/runbooks/takedown.md).
 */

/** What can be shared by link and reported: a world (/w/<id>) or a prefab (/p/<id>). */
export type TReported = "world" | "prefab";

/** A shared world's or prefab's link, on this site. */
export const sharedLinkOf = (kind: TReported, id: string, origin: string) =>
	`${origin}/${kind === "world" ? "w" : "p"}/${id}`;

/** A `mailto:` address that reports a shared world or prefab, its link and id in the email. */
export const reportAddressOf = (kind: TReported, id: string, origin: string) => {
	const subject = `Report a shared ${kind} on ${APP_NAME}: ${id}`;
	const body = [
		`I'm reporting this ${kind}, shared by link on ${APP_NAME}:`,
		"",
		`Link: ${sharedLinkOf(kind, id, origin)}`,
		`Id: ${id}`,
		"",
		"What's wrong with it:",
		"",
	].join("\n");
	return `mailto:${ABUSE_CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
