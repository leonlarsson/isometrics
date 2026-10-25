/**
 * Runtime state that has to outlive a hot reload in development: registries
 * that mounted components fill (vehicles in traffic, label cards), and the day
 * cycle's progress. A code change re-runs the modules that hold them, but
 * React keeps the components mounted without registering them again, so a
 * fresh registry would be empty (vehicles freeze, cards stop following).
 * In development this returns the same object every time for a key; in a
 * build it just makes one.
 */
export const keepOnHotReload = <T>(key: string, create: () => T): T => {
	if (!import.meta.hot) {
		return create();
	}
	const shelf = globalThis as { __keptOnHotReload?: Map<string, unknown> };
	shelf.__keptOnHotReload ??= new Map();
	if (!shelf.__keptOnHotReload.has(key)) {
		shelf.__keptOnHotReload.set(key, create());
	}
	return shelf.__keptOnHotReload.get(key) as T;
};
