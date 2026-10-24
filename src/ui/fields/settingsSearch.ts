import { createContext, useContext } from "react";

/**
 * What the properties editor's settings search is looking for (ADR-0054),
 * empty while it isn't searching. Fields and panels read it to mark whether
 * they match; the panels' styles hide what doesn't.
 */
export const SettingsSearchContext = createContext("");

/** Every word of the query appears somewhere in the text. */
export const matchesSearch = (text: string, query: string) => {
	const haystack = text.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => haystack.includes(word));
};

/** The settings search's text, trimmed. */
export const useSettingsSearch = () => useContext(SettingsSearchContext).trim();

/**
 * For a field's `data-search-match`: true while a search is on and the field's
 * label matches it, otherwise undefined (no attribute).
 */
export const useSearchMatch = (text: string) => {
	const query = useSettingsSearch();
	return (query !== "" && matchesSearch(text, query)) || undefined;
};
