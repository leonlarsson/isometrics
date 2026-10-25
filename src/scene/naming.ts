/**
 * How copies are named (a preference): "Tower copy", or numbered, "Tower 2".
 */
export type TCopyNames = "copy" | "numbered";

/**
 * The name for a copy (ADR-0068). A name that isn't taken stays as it is
 * (pasted into another world), and an empty one stays empty: unnamed things
 * are called by their part or style. Otherwise, "copy" adds " copy" ("Tower
 * copy", then "Tower copy copy"); "numbered" counts: "Tower" → "Tower 2", then
 * "Tower 3", a name that ends in a number counts on from it ("Gate 5" → "Gate
 * 6"), and older copies' " copy" endings are dropped first ("Tower copy copy"
 * → "Tower 2").
 */
export const copyName = (name: string, taken: ReadonlySet<string>, style: TCopyNames) => {
	if (!name || !taken.has(name)) {
		return name;
	}
	if (style === "copy") {
		return `${name} copy`;
	}
	const plain = name.replace(/( copy)+( \d+)?$/, "");
	const numbered = /^(.*\S) (\d+)$/.exec(plain);
	const base = numbered ? numbered[1] : plain;
	let next = numbered ? Number(numbered[2]) + 1 : 2;
	while (taken.has(`${base} ${next}`)) {
		next++;
	}
	return `${base} ${next}`;
};

/**
 * Names for several copies at once, numbered ones unique among `existing` and
 * the copies named before them.
 */
export const copyNamer = (existing: Iterable<string>, style: TCopyNames) => {
	const taken = new Set(existing);
	return (name: string) => {
		const next = copyName(name, taken, style);
		if (next) {
			taken.add(next);
		}
		return next;
	};
};
