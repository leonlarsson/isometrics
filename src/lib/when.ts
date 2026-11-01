/** A moment as people read it: in the viewer's own time zone and language ("2 Nov 2026, 12:36"). */
export const localDateTime = (when: string | number | Date) =>
	new Date(when).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
