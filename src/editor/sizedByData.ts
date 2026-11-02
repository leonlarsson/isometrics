import { SCALE_SETTING } from "#/parts/propData";
import { nameOfDataKey } from "#/scene/rowData";
import type { TEntity, TScene } from "#/scene/schema";

import type { ISceneItem } from "./framing";
import { notify } from "./toasts";

/**
 * Objects whose size follows data (ADR-0109) are drawn at the size their data
 * gives, so resizing them by hand would change nothing on screen: the scale
 * handle and S leave them alone, and S says why and where to change it.
 */

/** Whether an object is sized by data now (with the world's data on, ADR-0115). */
export const isSizedByData = (entity: TEntity, scene: Pick<TScene, "data">) =>
	scene.data.isOn && entity.data[SCALE_SETTING] !== undefined;

/** The selected objects sized by data. */
export const selectedSizedByData = (state: {
	scene: TScene;
	selectedItems: readonly ISceneItem[];
}): TEntity[] =>
	state.selectedItems.flatMap((item) => {
		if (item.kind !== "entity") {
			return [];
		}
		const entity = state.scene.entities.find((each) => each.id === item.id);
		return entity && isSizedByData(entity, state.scene) ? [entity] : [];
	});

/** Say why S doesn't resize: what the size follows, and where to set it by hand instead. */
export const sayWhySizeFollowsData = (sized: readonly TEntity[], scene: TScene) => {
	const [first] = sized;
	if (!first) {
		return;
	}
	const key = first.data[SCALE_SETTING]?.key ?? "";
	const follows = nameOfDataKey(scene.data, key, first.dataRow);
	notify(
		sized.length === 1
			? `${first.name || "Its"} size follows data`
			: `${sized.length} of these are sized by data`,
		sized.length === 1
			? `It's sized by ${follows}. To resize it by hand, click Stop following under Follows data, in its Data tab.`
			: "Their sizes follow values or columns. To resize them by hand, stop their sizes following data under Follows data, in their Data tab.",
	);
};
