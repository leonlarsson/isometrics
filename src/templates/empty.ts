import {
	SCENE_VERSION,
	SceneSchema,
	type TDrivingSide,
	type TScene,
	type TSceneInput,
	type TThemePreference,
} from "#/scene/schema";

/** What File → New world lets you set for a blank world; anything left out gets its default. */
export interface IEmptySceneOptions {
	title?: string;
	ground?: { width: number; depth: number };
	theme?: TThemePreference;
	drivingSide?: TDrivingSide;
	/** Whether it uses data (ADR-0115): false for a plain world to build. */
	usesData?: boolean;
}

/** Starting option: bare ground, with no objects, roads, areas or data. */
export const createEmptyScene = ({
	title = "Untitled world",
	ground,
	theme,
	drivingSide,
	usesData = true,
}: IEmptySceneOptions = {}): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: { title },
		...(ground && { ground }),
		...(theme && { theme }),
		...(drivingSide && { traffic: { drivingSide } }),
		...(!usesData && { data: { isOn: false } }),
	} satisfies TSceneInput);
