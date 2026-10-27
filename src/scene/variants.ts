/**
 * Ids of parts, road styles and area types carry a variant number, so a
 * family can have several looks: "office_tower_01", "office_tower_02"…,
 * "road_01", "water_01". See docs/adr/0050-numbered-variants.md.
 */

const VARIANT = /_(\d+)$/;

/** The family an id belongs to: "office_tower" for "office_tower_02". */
export const familyOf = (id: string) => id.replace(VARIANT, "");

/** Which variant of its family an id is: 2 for "office_tower_02" (1 without a number). */
export const variantOf = (id: string) => Number(VARIANT.exec(id)?.[1] ?? 1);

/**
 * What to call an id: the family's name while it has one variant among `ids`
 * ("Office tower"), with the number once it has more ("Office tower 2").
 */
export const variantName = (id: string, name: string, ids: readonly string[]) => {
	const family = familyOf(id);
	const siblings = ids.filter((other) => familyOf(other) === family).length;
	return siblings > 1 ? `${name} ${variantOf(id)}` : name;
};

/**
 * Things grouped by family, in the order their families first appear, each
 * family's variants by number: one entry per family, for a tile that holds
 * all its looks. `idOf` says where a thing's id is ("part:race_car_02" works
 * too: the prefix stays in the family).
 */
export const groupByFamily = <T>(things: readonly T[], idOf: (thing: T) => string) => {
	const families = new Map<string, T[]>();
	for (const thing of things) {
		const family = familyOf(idOf(thing));
		families.set(family, [...(families.get(family) ?? []), thing]);
	}
	return [...families.entries()].map(([family, variants]) => ({
		family,
		variants: [...variants].sort((a, b) => variantOf(idOf(a)) - variantOf(idOf(b))),
	}));
};
