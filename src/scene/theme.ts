import type { TThemePreference } from "./schema";

export type TResolvedTheme = "light" | "dark";

/**
 * Colours used inside the 3D scene. UI chrome colours live in CSS tokens
 * (src/styles.css); three.js needs concrete values, so they are mirrored here.
 */
export interface IScenePalette {
	ground: string;
	gridCell: string;
	gridSection: string;
	wall: string;
	trim: string;
	glass: string;
	panel: string;
	signal: string;
	tire: string;
	trunk: string;
	foliage: string;
	road: string;
	roadMark: string;
	dirt: string;
	/** Side faces of elevated decks, and pillars. */
	deck: string;
	railing: string;
	embankment: string;
	/** Default colours per area type (see AreaTypeSchema). */
	areas: { water: string; grass: string; sand: string; plaza: string; land: string };
	/** Cliff sides of raised areas. */
	cliff: string;
	cardboard: string;
	/** Default colour of text in the world (the text part). */
	text: string;
	selection: string;
	/** Transform gizmo: one colour per axis (X red, Y/up green, Z blue), size handle, hover. */
	gizmo: { x: string; y: string; z: string; size: string; hover: string };
	hemiSky: string;
	hemiGround: string;
	hemiIntensity: number;
	sunIntensity: number;
	ambientIntensity: number;
}

export const scenePalettes: Record<TResolvedTheme, IScenePalette> = {
	light: {
		ground: "#f4f3ee",
		gridCell: "#dedbd3",
		gridSection: "#c9c5bb",
		wall: "#fbfaf6",
		trim: "#d6d3cb",
		glass: "#2f3a56",
		panel: "#2c3463",
		signal: "#e2603b",
		tire: "#2b2b2f",
		trunk: "#a07a5a",
		foliage: "#7cc48a",
		road: "#cdc9bf",
		roadMark: "#ffffff",
		dirt: "#d6bd92",
		deck: "#b9b5ab",
		railing: "#f4f2ec",
		embankment: "#cdd5bd",
		areas: {
			water: "#9ccbe8",
			grass: "#bcd9ab",
			sand: "#ecdcb4",
			plaza: "#e6e1d6",
			land: "#e2dac8",
		},
		cliff: "#c9bfa9",
		cardboard: "#d8a967",
		text: "#2f3437",
		selection: "#e2603b",
		gizmo: { x: "#e5484d", y: "#3f9b5a", z: "#3e63dd", size: "#4b4a46", hover: "#f5b301" },
		hemiSky: "#ffffff",
		hemiGround: "#cfc8b8",
		hemiIntensity: 1.5,
		sunIntensity: 2.4,
		ambientIntensity: 0.35,
	},
	dark: {
		ground: "#3a3c36",
		gridCell: "#45473f",
		gridSection: "#55574e",
		wall: "#d9d6cc",
		trim: "#5a5c55",
		glass: "#1c2233",
		panel: "#20263f",
		signal: "#e8714c",
		tire: "#1a1a1c",
		trunk: "#7d6047",
		foliage: "#5d9a68",
		road: "#4a4c46",
		roadMark: "#8d8f88",
		dirt: "#6e604a",
		deck: "#5b5d55",
		railing: "#8f918a",
		embankment: "#4b5243",
		areas: {
			water: "#2f4b60",
			grass: "#3f5a3a",
			sand: "#6b5f45",
			plaza: "#4a4b45",
			land: "#4f4c43",
		},
		cliff: "#3d3b34",
		cardboard: "#b48a52",
		text: "#ecebe6",
		selection: "#e8714c",
		gizmo: { x: "#ff6369", y: "#5bb98b", z: "#7b93ff", size: "#e8e6e1", hover: "#ffd60a" },
		hemiSky: "#c9ccd6",
		hemiGround: "#2a2b27",
		hemiIntensity: 0.9,
		sunIntensity: 1.7,
		ambientIntensity: 0.25,
	},
};

export const resolveTheme = (
	preference: TThemePreference,
	prefersDark: boolean,
): TResolvedTheme => {
	if (preference === "system") {
		return prefersDark ? "dark" : "light";
	}
	return preference;
};

/** Friendly preset colours offered in every colour picker. */
export const SWATCHES = [
	"#3d4fd6",
	"#4a64e0",
	"#2bb58c",
	"#3cbf9a",
	"#8a5cf0",
	"#c06bd8",
	"#f07b4f",
	"#e2603b",
	"#f2c230",
	"#e85d75",
	"#7cc48a",
	"#a07a5a",
	"#f7f7f4",
	"#9a9a96",
	"#3a3b40",
];
