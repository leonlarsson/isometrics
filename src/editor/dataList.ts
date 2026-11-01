import type { TDataSource, TDataSourceKind, TDataTable, TDataValue, TScene } from "#/scene/schema";

/**
 * The world's data as lists by kind (ADR-0123): its values, its tables and its
 * sources, each row saying where it comes from. Shared by the Data tab and the
 * Data window, so both say the same.
 */

/** What each kind of source is called. */
export const SOURCE_KIND_NAMES: Record<TDataSourceKind, string> = {
	file: "Spreadsheet",
	link: "Link",
	api: "API",
	push: "Pushed",
};

/** The site an address is on ("api.example.com"), or null when it isn't a web address. */
export const siteOf = (url: string | null | undefined) => {
	try {
		return url ? new URL(url).host : null;
	} catch {
		return null;
	}
};

/**
 * What a source is called: its own name, else the site it reads (a list of sources all called
 * "API" says nothing), else its file, else its kind.
 */
export const sourceNameOf = (source: TDataSource) =>
	source.name || siteOf(source.url) || source.fileName || SOURCE_KIND_NAMES[source.kind];

/** A source read once outside the app: a link or API with no address left to read again. */
export const isSnapshot = (source: TDataSource) =>
	(source.kind === "link" || source.kind === "api") && !source.url;

/** Where a value or table comes from, in words: typed by hand, or its source (and where in it). */
export const originOf = (source: TDataValue["source"], sources: readonly TDataSource[]): string => {
	if (!source) {
		return "typed by hand";
	}
	const found = sources.find((each) => each.id === source.sourceId);
	const name = found ? sourceNameOf(found) : `${source.sourceId} (gone)`;
	// A spreadsheet's "Sheet!column" in words: "Sheet › column".
	return source.path ? `from ${name}, ${source.path.replace("!", " › ")}` : `from ${name}`;
};

/** Which kind of data the list shows: everything, or only values, tables or sources. */
export type TDataKind = "all" | "values" | "tables" | "sources";

/** What a source is, in a few words (its kind as people know it). */
export const sourceKindOf = (source: TDataSource) =>
	source.kind === "file"
		? "A spreadsheet file"
		: isSnapshot(source)
			? "A snapshot"
			: source.kind === "push"
				? "Pushed from outside"
				: "A link or API";

/** Whether a text has every word of a search in it, ignoring case. */
const hasWords = (text: string, query: string) => {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	const lower = text.toLowerCase();
	return words.every((word) => lower.includes(word));
};

export interface IDataFound {
	values: TDataValue[];
	tables: TDataTable[];
	sources: TDataSource[];
}

/**
 * The world's data by kind (ADR-0123): its values, its tables and its
 * sources, each a list of its own. A search keeps values and tables that match
 * by name or key, or by the name, site or file of the source they come from,
 * and sources that match by theirs.
 */
export const dataFoundIn = (data: TScene["data"], query = ""): IDataFound => {
	if (query.trim() === "") {
		return { values: [...data.values], tables: [...data.tables], sources: [...data.sources] };
	}
	const sourceText = (source: TDataSource) =>
		`${sourceNameOf(source)} ${source.url ?? ""} ${source.fileName ?? ""}`;
	const matchingSources = new Set(
		data.sources.filter((source) => hasWords(sourceText(source), query)).map((source) => source.id),
	);
	const itemMatches = (item: TDataValue | TDataTable) =>
		hasWords(`${item.name} ${item.key}`, query) ||
		(item.source !== null && matchingSources.has(item.source.sourceId));
	return {
		values: data.values.filter(itemMatches),
		tables: data.tables.filter(itemMatches),
		sources: data.sources.filter((source) => matchingSources.has(source.id)),
	};
};

/** Whether the world has any data at all: a source, a value or a table. */
export const hasAnyData = (data: TScene["data"]) =>
	data.sources.length + data.values.length + data.tables.length > 0;
