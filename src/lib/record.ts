/** A JSON object's fields, before anything is known about them. */
export type TRecord = Record<string, unknown>;

/** Whether a value is a plain JSON object: not null, not a list. */
export const isRecord = (value: unknown): value is TRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The record under `key`, made if it isn't one (a missing group, say). */
export const groupOf = (record: TRecord, key: string): TRecord => {
	const group = record[key];
	if (isRecord(group)) {
		return group;
	}
	const made: TRecord = {};
	record[key] = made;
	return made;
};
