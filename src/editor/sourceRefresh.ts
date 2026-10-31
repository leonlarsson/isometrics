import { useEffect } from "react";
import { create } from "zustand";

import { keepOnHotReload } from "#/lib/hot";
import { readSourceAgain } from "#/scene/jsonSource";
import type { TDataSource, TWorldData } from "#/scene/schema";
import { dataFromSheet, guessReading, putReadData, readSheet } from "#/scene/sheets";

import { LinkError, readLink, type TLinkContent } from "./readLink";
import { useEditor } from "./store";
import { clearArrived, tableArrived, valueArrived, worldDataNow } from "./worldData";

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

/** Reads a link or API source again now, into the arrived layer. */
export const refreshSource = async (source: TDataSource) => {
	if (!source.url) {
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
 * Reads the open world's link and API sources when it opens and on their
 * timers. Mount once (AppShell).
 */
export const useSourceRefresh = () => {
	const opening = useEditor((s) => s.openedWorldCount);
	const schedule = useEditor((s) => scheduleOf(s.scene.data.sources));
	useEffect(() => {
		const sources = () =>
			useEditor
				.getState()
				.scene.data.sources.filter(
					(source) => (source.kind === "link" || source.kind === "api") && source.url,
				);
		for (const source of sources()) {
			void refreshSource(source);
		}
		const timers = sources()
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
					(source.refreshSeconds ?? 60) * 1000,
				),
			);
		return () => {
			for (const timer of timers) {
				clearInterval(timer);
			}
		};
	}, [opening, schedule]);
};

/** Keep these values: what arrived put in the world as one undo step, its sources marked as read then. */
export const keepArrivedValues = () => {
	const now = worldDataNow();
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
