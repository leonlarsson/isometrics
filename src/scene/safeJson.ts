/**
 * Untrusted JSON made safe to handle (ADR-0119): a deep copy without the key
 * that reaches an object's prototype when assigned (`__proto__`),
 * refusing nesting deeper than any world needs. Everything that reads JSON
 * from outside (files, storage, paste, an AI's answer, a patch, POST
 * /api/worlds/validate) goes through it first, so later merges, `z.record`
 * parsing and recursive walks can't be turned against the app. No React.
 *
 * `JSON.parse('{"__proto__": {...}}')` makes an own property named
 * `__proto__`; copying or merging it with plain assignment (`target[key] =`)
 * sets the target's prototype instead, so lookups on it fall through to
 * attacker-chosen values. Dropping it at the door closes that for good.
 * `constructor` and `prototype` stay: assigning them makes an ordinary own
 * property, nothing here walks paths through them, and real data uses them (a
 * Formula 1 table's "constructor" column).
 */

/** The key that reaches a prototype when assigned: never copied from untrusted input. */
export const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__"]);

/** Deeper than this is refused: worlds nest a dozen levels, and recursion must not overflow. */
export const MOST_DEPTH = 64;

export class UnsafeJsonError extends Error {}

const copy = (value: unknown, depth: number): unknown => {
	if (depth > MOST_DEPTH) {
		throw new UnsafeJsonError(
			`It's nested more than ${MOST_DEPTH} levels deep, which no world is.`,
		);
	}
	if (Array.isArray(value)) {
		return value.map((item) => copy(item, depth + 1));
	}
	if (typeof value === "object" && value !== null) {
		const result: Record<string, unknown> = {};
		for (const [key, field] of Object.entries(value)) {
			if (!UNSAFE_KEYS.has(key)) {
				result[key] = copy(field, depth + 1);
			}
		}
		return result;
	}
	return value;
};

/** A deep copy of untrusted JSON without prototype keys; throws `UnsafeJsonError` past MOST_DEPTH. */
export const safeJson = <T>(value: T): T => copy(value, 0) as T;
