import type { ReactNode } from "react";

import type { TInspectorTab } from "#/editor/store";
import type { TPartCategory } from "#/parts/types";

import type { TIconName } from "./Icon";

/** One tab of the properties editor (ADR-0054): its rail icon and what it shows. */
export interface IInspectorTab {
	value: TInspectorTab;
	label: string;
	icon: TIconName;
	content: ReactNode;
}

/** Each part category's icon, in Add to scene, the outliner and the properties. */
export const CATEGORY_ICONS: Record<TPartCategory, TIconName> = {
	buildings: "building",
	vehicles: "car",
	nature: "tree",
	furniture: "bench",
	infrastructure: "cone",
	markers: "pin",
};
