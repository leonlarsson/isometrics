/**
 * Colours in words, for people who can't tell them apart by sight (colour
 * blindness): "light orange", "dark blue", "greyish green", "beige". Rough on
 * purpose: a name that says which family a colour is in and how light it is,
 * next to its hex code. No React here.
 */

/** Hue names round the colour wheel: each up to the hue (in degrees) where the next begins. */
const HUES: [until: number, name: string][] = [
	[10, "red"],
	[42, "orange"],
	[68, "yellow"],
	[90, "yellow-green"],
	[150, "green"],
	[175, "teal"],
	[195, "turquoise"],
	[245, "blue"],
	[270, "violet"],
	[300, "purple"],
	[330, "pink"],
	[350, "pinkish red"],
	[360, "red"],
];

/** Hue (0–360), saturation and lightness (0–1) of a #rrggbb colour; null if it isn't one. */
const hslOf = (hex: string) => {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) {
		return null;
	}
	const n = Number.parseInt(match[1], 16);
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const lightness = (max + min) / 2;
	const range = max - min;
	if (range === 0) {
		return { hue: 0, saturation: 0, lightness };
	}
	const saturation = range / (1 - Math.abs(2 * lightness - 1));
	const hue =
		max === r ? ((g - b) / range + 6) % 6 : max === g ? (b - r) / range + 2 : (r - g) / range + 4;
	return { hue: hue * 60, saturation, lightness };
};

/** A #rrggbb colour in a few words ("light orange"), or null if it isn't one. */
export const describeColor = (hex: string): string | null => {
	const hsl = hslOf(hex);
	if (!hsl) {
		return null;
	}
	const { hue, saturation, lightness } = hsl;
	if (lightness < 0.1) {
		return "black";
	}
	if (lightness > 0.94) {
		return "white";
	}
	// Barely any colour: a grey, by lightness.
	if (saturation < 0.12 || (saturation < 0.2 && lightness > 0.85)) {
		return lightness < 0.3
			? "dark grey"
			: lightness < 0.65
				? "grey"
				: lightness < 0.85
					? "light grey"
					: "off-white";
	}
	// Oranges and golds go brown when dark, beige when light and soft.
	if (hue >= 15 && hue < 52) {
		if (lightness < 0.3) {
			return "dark brown";
		}
		if (lightness < 0.45 || (saturation < 0.45 && lightness < 0.6)) {
			return "brown";
		}
		if (saturation < 0.7 && lightness > 0.65) {
			return lightness > 0.85 ? "cream" : "beige";
		}
	}
	const name = HUES.find(([until]) => hue < until)?.[1] ?? "red";
	const shade =
		lightness < 0.3 ? "dark " : lightness > 0.82 ? "pale " : lightness > 0.66 ? "light " : "";
	// Short enough for a narrow field: a dark colour's greyness goes unsaid ("dark blue").
	const greyish = saturation < 0.3 && lightness >= 0.3 ? "greyish " : "";
	return `${shade}${greyish}${name}`;
};
