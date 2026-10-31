import { parseCsv } from "#/scene/sheets";

import type { ISpreadsheetSheet } from "./readSpreadsheet";

/**
 * Reading a link or an API in the browser (ADR-0113): a CSV file or a
 * published sheet, or JSON. Sites that don't let browsers read them (no CORS
 * header) and being offline get errors that say what happened and what would
 * fix it; the world keeps what it last read either way.
 */

/** What a link gave: JSON, or a sheet of CSV. */
export type TLinkContent =
	| { kind: "json"; json: unknown }
	| { kind: "csv"; sheet: ISpreadsheetSheet };

/** Why a link couldn't be read, with words for the user. */
export class LinkError extends Error {
	constructor(
		readonly why: "offline" | "blocked" | "status" | "unreadable" | "address",
		message: string,
	) {
		super(message);
	}
}

/**
 * The address to read for a link people paste: a Google Sheet's page becomes
 * its CSV export (the sheet must be shared or published); anything else as it is.
 */
export const readableUrlOf = (url: string) => {
	const sheet =
		/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)(?:\/[^?#]*)?(?:[?#].*?gid=(\d+))?/.exec(
			url.trim(),
		);
	if (sheet && !url.includes("/pub?") && !url.includes("format=csv")) {
		return `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv${sheet[2] ? `&gid=${sheet[2]}` : ""}`;
	}
	return url.trim();
};

/** A link's host, for naming its source: "api.battlefieldstats.com/users/count". */
export const nameOfLink = (url: string) => {
	try {
		const { host, pathname } = new URL(url);
		return `${host}${pathname === "/" ? "" : pathname}`;
	} catch {
		return url;
	}
};

/** Whether text looks like JSON rather than CSV. */
const looksLikeJson = (text: string, type: string) =>
	type.includes("json") || /^\s*[[{]/.test(text);

/** Reads a link in the browser, as JSON or CSV. Throws a `LinkError` saying what went wrong. */
export const readLink = async (
	url: string,
	fetcher: typeof fetch = fetch,
): Promise<TLinkContent> => {
	let address: URL;
	try {
		address = new URL(readableUrlOf(url));
	} catch {
		throw new LinkError("address", "That isn't a web address: it should start with https://");
	}
	if (typeof navigator !== "undefined" && navigator.onLine === false) {
		throw new LinkError(
			"offline",
			"You're offline. The world keeps the values it last read, and reads them again when you're back online.",
		);
	}
	let response: Response;
	try {
		response = await fetcher(address.href, { cache: "no-store" });
	} catch {
		throw new LinkError(
			"blocked",
			`${address.host} didn't let the browser read it. Most often the site doesn't allow other sites to read it (it sends no CORS header, Access-Control-Allow-Origin); it can also be down or blocked on this network. It would work if the site allowed it, or through a server that reads it for the browser (not built yet).`,
		);
	}
	if (!response.ok) {
		throw new LinkError(
			"status",
			`${address.host} answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${response.status === 401 || response.status === 403 ? ": it may need a key, which worlds can't keep yet" : ""}.`,
		);
	}
	const text = await response.text();
	const type = response.headers.get("content-type") ?? "";
	if (looksLikeJson(text, type)) {
		try {
			return { kind: "json", json: JSON.parse(text) };
		} catch {
			throw new LinkError("unreadable", "It looks like JSON but isn't valid JSON.");
		}
	}
	const { rows, delimiter } = parseCsv(text);
	if (rows.length < 2) {
		throw new LinkError(
			"unreadable",
			"It isn't JSON, and not a CSV with a header and rows either.",
		);
	}
	return { kind: "csv", sheet: { name: null, rows, decimalComma: delimiter === ";" } };
};
