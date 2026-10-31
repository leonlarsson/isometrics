import { create } from "zustand";

import { APP_NAME } from "#/lib/app";
import { keepOnHotReload } from "#/lib/hot";
import { TEMPLATES } from "#/templates";

/**
 * Addresses this browser has agreed to read (ADR-0119). A world can name any
 * link or API to read, and a world can come from anyone: a file, a paste, an
 * AI's answer, a patch. Reading one on its own would tell that address who's
 * looking and when, every time the world is open, or make the browser call
 * someone else's server over and over. So an address is read without asking
 * only once this browser has said yes to it: by typing it (Read a link or
 * API…), by clicking Allow or Read it again, or because it's a template's own.
 * Kept per browser, by the exact address read.
 */

const KEY = `${APP_NAME.toLowerCase()}:allowed-links`;

/** The addresses the templates read: theirs, so they need no asking. Worked out once, when first asked. */
let templateLinks: Set<string> | null = null;
const linksOfTemplates = () => {
	templateLinks ??= new Set(
		TEMPLATES.flatMap((template) =>
			template.create().data.sources.flatMap((source) => (source.url ? [source.url] : [])),
		),
	);
	return templateLinks;
};

const loadAllowed = (): Set<string> => {
	try {
		const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
		return new Set(Array.isArray(stored) ? stored.filter((each) => typeof each === "string") : []);
	} catch {
		return new Set();
	}
};

/** The addresses this browser has said yes to; components re-render when one is allowed. */
export const useAllowedLinks = keepOnHotReload("allowedLinks", () =>
	create<{ links: ReadonlySet<string> }>(() => ({
		links: typeof localStorage === "undefined" ? new Set() : loadAllowed(),
	})),
);

/** Whether an address may be read without asking. */
export const isLinkAllowed = (url: string, allowed = useAllowedLinks.getState().links) =>
	allowed.has(url) || linksOfTemplates().has(url);

/** Say yes to an address: it's read from now on, in this browser, whatever world names it. */
export const allowLink = (url: string) => {
	if (isLinkAllowed(url)) {
		return;
	}
	const links = new Set(useAllowedLinks.getState().links).add(url);
	useAllowedLinks.setState({ links });
	try {
		localStorage.setItem(KEY, JSON.stringify([...links]));
	} catch {
		// Storage unavailable: allowed for as long as the page is open.
	}
};
