import { formatWhen } from "#/lib/when";
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

/**
 * A link or API with no address: what it gave was put in from outside the app
 * (by whoever made the world, by hand or by an AI), and can't be read again.
 * Nothing in the app makes one; worlds written outside it can.
 */
export const hasNoAddress = (source: TDataSource) =>
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
		: hasNoAddress(source)
			? "A link or API with no address"
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

/** Where in a spreadsheet: a sheet's name and a column's (or a row's), from "Stats!sent" or "sent". */
const placeIn = (path: string) => {
	const at = path.indexOf("!");
	return at === -1
		? { sheet: "", name: path }
		: { sheet: path.slice(0, at), name: path.slice(at + 1) };
};

/** The site a source reads, or its name when it has no address. */
const siteNameOf = (source: TDataSource) => siteOf(source.url) ?? sourceNameOf(source);

/** What a source with no address says, wherever it shows. */
const NO_ADDRESS =
	"Put in from outside this app by whoever made the world (by hand or by an AI). It has no address, so it can't be read again.";

/** How a value or table was read, in words: a full sentence for its page, a few words for a list. */
export interface IReadInWords {
	long: string;
	short: string;
}

/**
 * Why a value shows the number it does, in plain words (ADR-0123): where it
 * comes from (typed by hand, a spreadsheet's column, a field in what a site
 * answers) and, when it keeps past values, that the number shown is the newest.
 */
export const valueInWords = (value: TDataValue, sources: readonly TDataSource[]): IReadInWords => {
	const count = value.history.length;
	const first = count > 0 ? formatWhen(value.history[0].at) : "";
	const last = count > 0 ? formatWhen(value.history[count - 1].at) : "";
	const pastValues =
		count === 0
			? ""
			: count === 1
				? ` It keeps 1 past value, from ${last}, which is the number shown.`
				: ` It keeps ${count.toLocaleString()} past values, ${first} to ${last}; the number shown is the newest, from ${last}.`;
	const ref = value.source;
	if (!ref) {
		return { long: `Typed by hand.${pastValues}`, short: "typed by hand" };
	}
	const source = sources.find((each) => each.id === ref.sourceId);
	if (!source) {
		return {
			long: `Its source was removed, so it keeps what was last read.${pastValues}`,
			short: "its source was removed",
		};
	}
	if (source.kind === "file") {
		const { sheet, name } = placeIn(ref.path);
		const file = source.fileName || sourceNameOf(source);
		const where = sheet ? `the “${sheet}” sheet of ${file}` : file;
		return count > 0
			? {
					long: `From the “${name}” column of ${where}, one row per date.${pastValues}`,
					short: `the “${name}” column, ${count.toLocaleString()} past values`,
				}
			: { long: `From “${name}” in ${where}.`, short: `“${name}”` };
	}
	if (hasNoAddress(source)) {
		return { long: `${NO_ADDRESS}${pastValues}`, short: "put in from outside, no address" };
	}
	if (source.kind === "push") {
		return { long: `Pushed to the world from outside.${pastValues}`, short: "pushed from outside" };
	}
	const site = siteNameOf(source);
	if (ref.field) {
		const at = ref.path ? ` at “${ref.path}”` : "";
		const dated = ref.dateField ? `, dated by its “${ref.dateField}”` : "";
		return {
			long: `From the list ${site} answers${at}: each entry's “${ref.field}”${dated}.${pastValues}`,
			short: `each entry's “${ref.field}”`,
		};
	}
	return ref.path
		? {
				long: `From ${site}: the “${ref.path}” in its answer.${pastValues}`,
				short: `“${ref.path}”`,
			}
		: { long: `From ${site}: its whole answer.${pastValues}`, short: "the whole answer" };
};

/** Where a table's rows come from, in plain words (ADR-0123). */
export const tableInWords = (table: TDataTable, sources: readonly TDataSource[]): IReadInWords => {
	const rows = table.rows.length === 1 ? "1 row" : `${table.rows.length.toLocaleString()} rows`;
	const short = `a table of ${rows}`;
	const ref = table.source;
	if (!ref) {
		return { long: `Typed by hand: ${rows}.`, short };
	}
	const source = sources.find((each) => each.id === ref.sourceId);
	if (!source) {
		return { long: `Its source was removed, so it keeps the ${rows} last read.`, short };
	}
	if (source.kind === "file") {
		const file = source.fileName || sourceNameOf(source);
		const sheet = ref.path ? `, the “${ref.path}” sheet` : "";
		return { long: `From ${file}${sheet}: one row for each line, ${rows}.`, short };
	}
	if (hasNoAddress(source)) {
		return { long: `${NO_ADDRESS} ${rows}.`, short };
	}
	if (source.kind === "push") {
		return { long: `Pushed to the world from outside: ${rows}.`, short };
	}
	const at = ref.path ? ` at “${ref.path}”` : "";
	return {
		long: `From the list ${siteNameOf(source)} answers${at}: one row for each entry, ${rows}.`,
		short,
	};
};
