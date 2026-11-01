import { isLinkAllowed, useAllowedLinks } from "#/editor/linkTrust";
import { LINK_FAILURES, type TLinkFailure } from "#/editor/readLink";
import {
	MOST_SOURCES_READ,
	readOnTheirOwn,
	useSourceStatus,
	useWaitingSources,
} from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { localDateTime } from "#/lib/when";
import type { TDataSource } from "#/scene/schema";

import { formatWhen } from "./Sparkline";

/** How a source is doing, for its icon: said in words too, never by colour alone (ADR-0089). */
export type TSourceTone = "waiting" | "reading" | "failed" | "read" | "quiet";

export interface ISourceRowStatus {
	text: string;
	tone: TSourceTone;
	/** The exact error, for a tooltip. */
	detail?: string;
}

/** The ways of failing, in the order they're explained. */
const FAILURE_ORDER: readonly TLinkFailure[] = [
	"blocked",
	"status",
	"unreadable",
	"address",
	"offline",
];

/**
 * How the world's sources are doing (ADR-0119, ADR-0123): which wait for a
 * yes, which failed and how, and a short status for each, shared by the Data
 * tab's list, the Data window and a source's own page.
 */
export const useSourceStatuses = () => {
	const sources = useEditor((s) => s.scene.data.sources);
	const dataIsOn = useEditor((s) => s.scene.data.isOn);
	const statuses = useSourceStatus();
	const waiting = useWaitingSources();
	const allowedLinks = useAllowedLinks((s) => s.links);
	const waitingIds = new Set(waiting.map((source) => source.id));
	const waitingAddresses = [...new Set(waiting.map((source) => source.url ?? ""))];
	// Which allowed sources the world reads on its own (the first few addresses): the rest say so.
	const readIds = new Set(
		readOnTheirOwn(
			sources.filter(
				(source) =>
					(source.kind === "link" || source.kind === "api") &&
					source.url &&
					isLinkAllowed(source.url, allowedLinks),
			),
		).map((source) => source.id),
	);

	const statusOf = (source: TDataSource): ISourceRowStatus => {
		const status = statuses[source.id];
		if (waitingIds.has(source.id)) {
			return { text: "waiting for your yes", tone: "waiting" };
		}
		if (status?.reading) {
			return { text: "reading…", tone: "reading" };
		}
		if (status?.error) {
			return {
				text: `couldn't read it: ${LINK_FAILURES[status.failure ?? "unreadable"].short}`,
				tone: "failed",
				detail: status.error,
			};
		}
		if (
			(source.kind === "link" || source.kind === "api") &&
			source.url &&
			dataIsOn &&
			!readIds.has(source.id)
		) {
			return {
				text: `not read on its own: a world reads ${MOST_SOURCES_READ} at most`,
				tone: "quiet",
			};
		}
		const every = source.refreshSeconds ? everyInWords(source.refreshSeconds) : null;
		if (status?.readAt) {
			return {
				text: `read ${formatWhen(status.readAt)}${every ? `, ${every}` : ""}`,
				tone: "read",
			};
		}
		const lastRead = source.lastReadAt && `read ${localDateTime(source.lastReadAt)}`;
		// Read once, outside the app: it can't be read again from here.
		if ((source.kind === "link" || source.kind === "api") && !source.url) {
			return { text: lastRead ? `a snapshot, ${lastRead}` : "a snapshot", tone: "quiet" };
		}
		if (source.kind === "file") {
			return {
				text: lastRead ? `a file, ${lastRead}` : "a file from someone's computer",
				tone: "quiet",
			};
		}
		return { text: lastRead || (every ? `read ${every}` : "not read yet"), tone: "quiet" };
	};

	/** The sources that failed to be read, by how (not those waiting for a yes). */
	const failures = FAILURE_ORDER.map((failure) => ({
		failure,
		failed: sources.filter(
			(source) => !waitingIds.has(source.id) && statuses[source.id]?.failure === failure,
		),
	})).filter(({ failed }) => failed.length > 0);

	return { statusOf, waiting, waitingIds, waitingAddresses, failures };
};

/** How often a source is read again, in words: "every minute", "every 2 hours". */
export const everyInWords = (seconds: number) => {
	const units: [number, string][] = [
		[86400, "day"],
		[3600, "hour"],
		[60, "minute"],
		[1, "second"],
	];
	const [size, unit] = units.find(([each]) => seconds % each === 0 && seconds >= each) ?? [
		1,
		"second",
	];
	const count = seconds / size;
	return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;
};
