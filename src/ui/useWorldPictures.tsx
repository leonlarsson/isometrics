import { useState } from "react";

import { type IScenePictureSource, useScenePictures } from "#/render/scenePictures";
import type { TResolvedTheme } from "#/scene/theme";
import { starterPictureOf } from "#/templates/pictures";

const NO_SOURCES: IScenePictureSource[] = [];

/**
 * Pictures of worlds for cards (ADR-0146): a built-in world's (a starter's,
 * the Blank card's) from its file, made ahead of time, and anything else, or
 * a built-in one whose file doesn't load, drawn live from the world (ADR-0047).
 * Nothing is fetched or drawn while `isShown` is false. Gives a source's
 * picture by its id, as an image for a card, or null while there's none yet.
 */
export const useWorldPictures = (
	theme: TResolvedTheme,
	sources: readonly IScenePictureSource[],
	isShown: boolean,
) => {
	// Files that didn't load, by theme and id: drawn live instead.
	const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set());
	const hasFile = (id: string) =>
		starterPictureOf(id, theme) !== null && !missing.has(`${theme}:${id}`);
	const drawn = useScenePictures(
		theme,
		isShown ? sources.filter((source) => !hasFile(source.id)) : NO_SOURCES,
	);
	return (id: string) => {
		const file = hasFile(id) ? starterPictureOf(id, theme) : null;
		if (file) {
			return (
				<img
					src={file}
					alt=""
					decoding="async"
					onError={() => setMissing((before) => new Set(before).add(`${theme}:${id}`))}
				/>
			);
		}
		return drawn[id] ? <img src={drawn[id]} alt="" /> : null;
	};
};
