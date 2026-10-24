/**
 * Tests only: an in-memory stand-in for `localStorage` (the tests run in Node,
 * which has none), and the event another tab sends when it writes the storage.
 */
export const memoryStorage = () => {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
		clear: () => data.clear(),
	};
};

/** A storage that throws on every use, like a browser with site data blocked. */
export const blockedStorage = () => {
	const blocked = () => {
		throw new Error("Storage is blocked");
	};
	return {
		length: 0,
		key: blocked,
		getItem: blocked,
		setItem: blocked,
		removeItem: blocked,
		clear: blocked,
	};
};

/** What another tab of the app sends when it writes the storage (or wipes it: key null). */
export const storageEvent = (key: string | null, newValue: string | null) =>
	Object.assign(new Event("storage"), { key, newValue });
