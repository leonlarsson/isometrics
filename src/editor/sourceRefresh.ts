import { useEffect, useRef } from "react";
import { create } from "zustand";

import { keepOnHotReload } from "#/lib/hot";
import { readSourceAgain } from "#/scene/jsonSource";
import type { TDataSource, TScene, TWorldData } from "#/scene/schema";
import { dataFromSheet, guessReading, putReadData, readSheet } from "#/scene/sheets";

import { allowLink, isLinkAllowed, useAllowedLinks } from "./linkTrust";
import { LinkError, nameOfLink, readLink, type TLinkContent } from "./readLink";
import { useEditor } from "./store";
import { clearArrived, keptWithArrived, tableArrived, valueArrived } from "./worldData";

/**
 * Links and APIs read again while a world is open (ADR-0113): each source with
 * a URL is read when the world opens and every `refreshSeconds` after, in the
 * browser, and what it gives goes into the arrived layer (ADR-0107): shown and
 * followed, never an undo step or an autosave. Keep these values puts it in
 * the world. Errors keep the saved snapshot and say why.
 */

/** How reading a source went last, by source id. Runtime only. */
export interface ISourceStatus {
	/** When it was last read successfully, as an ISO date and time. */
	readAt: string | null;
	/** Why the last reading failed, in words; null when it worked. */
	error: string | null;
	reading: boolean;
}

export const useSourceStatus = keepOnHotReload("sourceStatus", () =>
	create<Record<string, ISourceStatus>>(() => ({})),
);

const NOT_READ: ISourceStatus = { readAt: null, error: null, reading: false };

const setStatus = (id: string, change: Partial<ISourceStatus>) =>
	useSourceStatus.setState((all) => ({ ...all, [id]: { ...(all[id] ?? NOT_READ), ...change } }));

/** What a source's reading gives each of its values and tables, put in the arrived layer. */
export const arriveFrom = (kept: TWorldData, source: TDataSource, content: TLinkContent) => {
	const at = new Date().toISOString();
	if (content.kind === "json") {
		const reading = readSourceAgain(kept, source, content.json);
		for (const value of reading.values) {
			valueArrived(
				value.key,
				{ at: value.history.at(-1)?.at ?? at, value: value.value },
				value.history.length > 0 ? value.history : undefined,
			);
		}
		for (const table of reading.tables) {
			tableArrived(table.key, table.rows);
		}
		return;
	}
	// A CSV link: read as it would be read now, then what it gives its values and tables.
	const sheet = readSheet(content.sheet.rows, { decimalComma: content.sheet.decimalComma });
	const read = dataFromSheet(sheet, guessReading(sheet), {
		sourceId: source.id,
		tableName: source.name,
	});
	const next = putReadData(kept, source, read);
	for (const value of next.values) {
		if (value.source?.sourceId === source.id) {
			valueArrived(
				value.key,
				value.history.at(-1) ?? { at, value: value.value },
				value.history.length > 0 ? value.history : undefined,
			);
		}
	}
	for (const table of next.tables) {
		if (table.source?.sourceId === source.id) {
			tableArrived(table.key, table.rows);
		}
	}
};

/**
 * Reads a link or API source again now, into the arrived layer. `asked`: a
 * person asked for it (Read it again, Allow), which is their yes to the
 * address (ADR-0119); otherwise an address this browser hasn't allowed isn't read.
 */
export const refreshSource = async (source: TDataSource, { asked = false } = {}) => {
	if (!source.url) {
		return;
	}
	if (!isLinkAllowed(source.url)) {
		if (asked) {
			// The yes: the reading schedule picks it up and reads it now (and on its timer), once.
			allowLink(source.url);
		}
		return;
	}
	setStatus(source.id, { reading: true });
	try {
		const content = await readLink(source.url);
		arriveFrom(useEditor.getState().scene.data, source, content);
		setStatus(source.id, { readAt: new Date().toISOString(), error: null, reading: false });
	} catch (error) {
		setStatus(source.id, {
			error: error instanceof LinkError ? error.message : "It couldn't be read.",
			reading: false,
		});
	}
};

/** The world's link and API sources, with when to read them again, as one stable string. */
const scheduleOf = (sources: readonly TDataSource[]) =>
	sources
		.filter((source) => (source.kind === "link" || source.kind === "api") && source.url)
		.map((source) => `${source.id} ${source.refreshSeconds ?? 0}`)
		.join(",");

/**
 * The addresses already asked about since the world opened (ADR-0119): the
 * dialog when a world opens asks about each once, and opening a shared world,
 * which asks before it loads (ADR-0120), counts as asking.
 */
export const useAskedAddresses = keepOnHotReload("askedAddresses", () =>
	create<{ opening: number; urls: ReadonlySet<string> }>(() => ({ opening: -1, urls: new Set() })),
);

/** Note that these addresses were asked about, in the world open now. */
export const markAddressesAsked = (urls: readonly string[]) => {
	const opening = useEditor.getState().openedWorldCount;
	const asked = useAskedAddresses.getState();
	const before = asked.opening === opening ? asked.urls : new Set<string>();
	useAskedAddresses.setState({ opening, urls: new Set([...before, ...urls]) });
};

/** The addresses a world reads that this browser hasn't allowed, whether or not its data is on. */
export const outsideAddressesOf = (scene: TScene) => [
	...new Set(
		scene.data.sources.flatMap((source) =>
			(source.kind === "link" || source.kind === "api") && source.url && !isLinkAllowed(source.url)
				? [source.url]
				: [],
		),
	),
];

/** The hosts of some sources, the first few named and the rest counted: "a.com, b.org and 3 more". */
export const hostsOf = (sources: readonly TDataSource[], most = 5) => {
	const hosts = [...new Set(sources.map((source) => nameOfLink(source.url ?? "")))];
	return hosts.length <= most
		? hosts.join(", ")
		: `${hosts.slice(0, most).join(", ")} and ${hosts.length - most} more`;
};

/** At most this many sources are read on their own: a world can't make a browser call a crowd of servers. */
export const MOST_SOURCES_READ = 10;

/** Never read again sooner than this on its own, whatever a world asks (its own limit is 10 s). */
export const LEAST_REFRESH_SECONDS = 60;

/** The open world's link and API sources (with data on), and which of them this browser has allowed. */
const linkSources = (allowed: ReadonlySet<string>) => {
	const { data } = useEditor.getState().scene;
	const sources = data.isOn
		? data.sources.filter(
				(source) => (source.kind === "link" || source.kind === "api") && source.url,
			)
		: [];
	return {
		allowed: sources.filter((source) => isLinkAllowed(source.url ?? "", allowed)),
		waiting: sources.filter((source) => !isLinkAllowed(source.url ?? "", allowed)),
	};
};

/** The addresses of the open world's sources this browser hasn't allowed yet (ADR-0119). */
export const useWaitingSources = () => {
	const allowed = useAllowedLinks((s) => s.links);
	const sources = useEditor((s) => s.scene.data.sources);
	const isOn = useEditor((s) => s.scene.data.isOn);
	return isOn
		? sources.filter(
				(source) =>
					(source.kind === "link" || source.kind === "api") &&
					source.url &&
					!isLinkAllowed(source.url, allowed),
			)
		: [];
};

/**
 * Reads the open world's allowed link and API sources when it opens and on
 * their timers, at most MOST_SOURCES_READ of them, never more often than
 * LEAST_REFRESH_SECONDS. Sources at addresses this browser hasn't allowed wait
 * for a yes (ADR-0119; WaitingSourcesDialog asks). Mount once (AppShell).
 */
export const useSourceRefresh = () => {
	const opening = useEditor((s) => s.openedWorldCount);
	// With data off (ADR-0115), nothing is read.
	const schedule = useEditor((s) => (s.scene.data.isOn ? scheduleOf(s.scene.data.sources) : ""));
	const allowed = useAllowedLinks((s) => s.links);
	// The addresses read since the world opened: a change to its sources or to what's allowed
	// reads only what's new, the rest wait for their timers.
	const readSinceOpening = useRef<{ opening: number; urls: Set<string> }>({
		opening,
		urls: new Set(),
	});

	useEffect(() => {
		if (readSinceOpening.current.opening !== opening) {
			readSinceOpening.current = { opening, urls: new Set() };
		}
		// A forgotten address counts as unread: allowed again, it's read again at once.
		for (const url of readSinceOpening.current.urls) {
			if (!isLinkAllowed(url, allowed)) {
				readSinceOpening.current.urls.delete(url);
			}
		}
		// One source per address, at most MOST_SOURCES_READ addresses: repeating an address
		// doesn't multiply the calls to it.
		const seen = new Set<string>();
		const read = linkSources(allowed).allowed.filter((source) => {
			const url = source.url ?? "";
			if (seen.has(url) || seen.size >= MOST_SOURCES_READ) {
				return false;
			}
			seen.add(url);
			return true;
		});
		for (const source of read) {
			if (!readSinceOpening.current.urls.has(source.url ?? "")) {
				readSinceOpening.current.urls.add(source.url ?? "");
				void refreshSource(source);
			}
		}
		const timers = read
			.filter((source) => source.refreshSeconds !== null)
			.map((source) =>
				setInterval(
					() => {
						const now = useEditor
							.getState()
							.scene.data.sources.find((each) => each.id === source.id);
						if (now) {
							void refreshSource(now);
						}
					},
					Math.max(source.refreshSeconds ?? LEAST_REFRESH_SECONDS, LEAST_REFRESH_SECONDS) * 1000,
				),
			);
		return () => {
			for (const timer of timers) {
				clearInterval(timer);
			}
		};
	}, [opening, schedule, allowed]);
};

/** Keep these values: what arrived put in the world as one undo step, its sources marked as read then. */
export const keepArrivedValues = () => {
	const now = keptWithArrived();
	const statuses = useSourceStatus.getState();
	useEditor.getState().commit((scene) => {
		scene.data.values = now.values;
		scene.data.tables = now.tables;
		for (const source of scene.data.sources) {
			const readAt = statuses[source.id]?.readAt;
			if (readAt) {
				source.lastReadAt = readAt;
			}
		}
	});
	clearArrived();
};
