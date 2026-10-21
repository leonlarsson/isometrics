import type { TScene } from "#/scene/schema";

import { createWarehouseScene } from "./warehouse";

export interface ITemplateInfo {
	id: string;
	name: string;
	description: string;
	create: () => TScene;
}

export const TEMPLATES: ITemplateInfo[] = [
	{
		id: "warehouse",
		name: "Delivery hub",
		description: "Warehouse, office, depot and vans on a delivery loop",
		create: createWarehouseScene,
	},
];
