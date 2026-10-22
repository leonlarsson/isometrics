import type { TScene } from "#/scene/schema";

import { createBrightwaterScene } from "./brightwater";
import { createMonacoScene } from "./monaco";

export { createEmptyScene } from "./empty";

export interface ITemplateInfo {
	id: string;
	name: string;
	description: string;
	create: () => TScene;
}

export const TEMPLATES: ITemplateInfo[] = [
	{
		id: "brightwater",
		name: "Brightwater",
		description: "Harbour city: river bridge, flyover, hill, stadium, marina and live city data",
		create: createBrightwaterScene,
	},
	{
		id: "monaco",
		name: "Monaco street circuit",
		description: "F1 street circuit around a harbour: Casino hill, hairpin, tunnel, race data",
		create: createMonacoScene,
	},
];
