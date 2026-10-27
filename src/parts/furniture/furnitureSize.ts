/**
 * Street furniture is drawn in metres, scaled into the world by this: parts
 * are a miniature at about 3.6 m per unit (a car, a lamp post), where a bench
 * true to scale would be a speck, so furniture is about 1.5 times bigger, like
 * the parcel stack. A part draws inside `<group scale={UNITS_PER_METRE}>`.
 */
export const UNITS_PER_METRE = 0.42;

/** A length in metres, in the world's units. */
export const metres = (length: number) => length * UNITS_PER_METRE;
