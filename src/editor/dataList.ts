import type { TDataSource, TDataSourceKind, TDataTable, TDataValue, TScene } from "#/scene/schema";

/**
 * The world's data as one list (ADR-0123): grouped by where it came from, a
 * group per source with the values and tables it gave, then what was typed by
 * hand, then anything whose source is gone. Shared by the Data tab and the
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

export interface IDataGroup {
	/** Its id in the list: a source's id, "typed" or "gone". */
	id: string;
	title: string;
	/** The source it shows; null for what was typed by hand, or whose source is gone. */
	source: TDataSource | null;
	values: TDataValue[];
	tables: TDataTable[];
}

/** Whether a text has every word of a search in it, ignoring case. */
const hasWords = (text: string, query: string) => {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	const lower = text.toLowerCase();
	return words.every((word) => lower.includes(word));
};

/**
 * The world's data in groups: a group per source (even one that has given
 * nothing yet, like one waiting for a yes), then "Typed by me", then "From a
 * source that's gone", the last two only when they hold something. A search
 * keeps what matches by name or key, and all of a source that matches by its
 * name, site or file.
 */
export const dataGroupsOf = (data: TScene["data"], query = ""): IDataGroup[] => {
	const searching = query.trim() !== "";
	const known = new Set(data.sources.map((source) => source.id));
	const itemMatches = (item: TDataValue | TDataTable) =>
		!searching || hasWords(`${item.name} ${item.key}`, query);
	const groups: IDataGroup[] = data.sources
		.map((source): IDataGroup | null => {
			const sourceMatches =
				searching &&
				hasWords(`${sourceNameOf(source)} ${source.url ?? ""} ${source.fileName ?? ""}`, query);
			const mine = <T extends TDataValue | TDataTable>(items: readonly T[]) =>
				items.filter(
					(item) => item.source?.sourceId === source.id && (sourceMatches || itemMatches(item)),
				);
			const group: IDataGroup = {
				id: source.id,
				title: sourceNameOf(source),
				source,
				values: mine(data.values),
				tables: mine(data.tables),
			};
			return !searching || sourceMatches || group.values.length + group.tables.length > 0
				? group
				: null;
		})
		.filter((group): group is IDataGroup => group !== null);
	const without = <T extends TDataValue | TDataTable>(items: readonly T[], gone: boolean) =>
		items.filter(
			(item) =>
				(gone ? item.source !== null && !known.has(item.source.sourceId) : item.source === null) &&
				itemMatches(item),
		);
	for (const [id, title, gone] of [
		["typed", "Typed by me", false],
		["gone", "From a source that's gone", true],
	] as const) {
		const group: IDataGroup = {
			id,
			title,
			source: null,
			values: without(data.values, gone),
			tables: without(data.tables, gone),
		};
		if (group.values.length + group.tables.length > 0) {
			groups.push(group);
		}
	}
	return groups;
};

/** Whether the world has any data at all: a source, a value or a table. */
export const hasAnyData = (data: TScene["data"]) =>
	data.sources.length + data.values.length + data.tables.length > 0;
