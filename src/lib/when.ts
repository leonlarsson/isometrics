/** A moment as people read it: in the viewer's own time zone and language ("2 Nov 2026, 12:36"). */
export const localDateTime = (when: string | number | Date) =>
	new Date(when).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** A past value's date in words: "30 Oct 2026", "Oct 2026", "2019", or as written. */
export const formatWhen = (at: string): string => {
	if (/^\d{4}$/.test(at)) {
		return at;
	}
	const month = /^(\d{4})-(\d{2})$/.exec(at);
	if (month) {
		return new Date(Number(month[1]), Number(month[2]) - 1).toLocaleDateString(undefined, {
			month: "short",
			year: "numeric",
		});
	}
	const time = Date.parse(at);
	if (Number.isNaN(time)) {
		return at;
	}
	return at.length > 10
		? new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
		: new Date(time).toLocaleDateString(undefined, { dateStyle: "medium" });
};
