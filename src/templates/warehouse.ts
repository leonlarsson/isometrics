import { SceneSchema, type TEntityInput, type TScene, type TSceneInput } from "#/scene/schema";

const ROAD_ID = "road_loop";

const trees: TEntityInput[] = [
	...[
		[-21, -14.5],
		[-13, -14.2],
		[-7, -13.8],
		[-1, -14],
		[4, -14.2],
		[-19, 12.5],
		[-13.2, 13.2],
		[-7.8, 12.8],
		[-2.2, 13.2],
		[5.5, 13],
		[10.5, 12],
	].map(([x, z], i) => ({
		id: `tree_${i}`,
		kind: "tree",
		position: [x, z] as [number, number],
		props: { size: 0.9 + ((i * 37) % 5) / 10 },
	})),
	...[
		[13, -14],
		[19.5, -14],
		[20, 2.5],
		[-21.2, 0],
		[-21.2, -5.5],
		[17, 12],
		[20.5, 9.5],
	].map(([x, z], i) => ({
		id: `pine_${i}`,
		kind: "pine",
		position: [x, z] as [number, number],
		props: { size: 1 + ((i * 23) % 4) / 10 },
	})),
];

const houseColors = ["#f07b4f", "#4a64e0", "#3cbf9a", "#8a5cf0"];

/** Starter template: a logistics hub with a warehouse, office and delivery vans. */
export const createWarehouseScene = (): TScene => {
	const input: TSceneInput = {
		version: 1,
		meta: {
			title: "Delivery hub",
			subtitle: "Live operations overview",
		},
		theme: "system",
		ground: { width: 44, depth: 32, color: null },
		data: [
			{ key: "orders_packed", label: "Orders packed", value: 148 },
			{ key: "parcels_waiting", label: "Parcels waiting", value: 128 },
			{ key: "dock_utilization", label: "Dock utilisation", value: 82, unit: "%" },
			{ key: "van7_load", label: "Load", value: "14 / 40" },
			{ key: "van7_eta", label: "Next drop", value: 6, unit: " min" },
			{ key: "staff_on_site", label: "Staff on site", value: 48 },
			{ key: "vans_out", label: "Vans out", value: 6, unit: " / 9" },
			{ key: "on_time", label: "On-time deliveries", value: 92, unit: "%" },
		],
		driving: "right",
		roads: [
			{
				id: ROAD_ID,
				name: "Delivery loop",
				style: "asphalt",
				closed: true,
				cornerRadius: 4,
				points: [
					[-19, 6],
					[15, 6],
					[15, -11.8],
					[-19, -11.8],
				],
			},
			{
				id: "garden_path",
				name: "Pond path",
				style: "dirt",
				width: 1.2,
				cornerRadius: 2,
				points: [
					[-10, 4.8],
					[-10, 0],
					[-12.5, -4.5],
				],
			},
		],
		entities: [
			{
				id: "pond",
				kind: "zone",
				name: "Pond",
				position: [-14, -7.5],
				color: "#bcdcf0",
				props: { width: 5.5, depth: 3.6, shape: "circle" },
			},
			{
				id: "warehouse",
				kind: "warehouse",
				name: "Fulfilment hall",
				position: [-3, -5],
				props: { width: 10, depth: 6, height: 3.4, doors: 4 },
				label: {
					title: "Orders packed",
					dataKeys: ["orders_packed"],
					offset: [-5, 3, 1],
				},
				details: {
					description: "Main fulfilment hall. Orders are picked and loaded here.",
					dataKeys: ["orders_packed", "parcels_waiting", "dock_utilization"],
				},
			},
			{
				id: "dock_beacon",
				kind: "beacon",
				name: "Loading dock",
				position: [-3, 0.6],
				props: { radius: 1.1 },
			},
			{ id: "parcels_a", kind: "parcels", position: [-7.4, 0.6], props: { count: 8 } },
			{ id: "parcels_b", kind: "parcels", position: [-5.6, 1.2], props: { count: 5 } },
			{ id: "parcels_c", kind: "parcels", position: [0.8, 0.9], props: { count: 3 } },
			{
				id: "tower",
				kind: "tower",
				name: "Head office",
				position: [8.5, -8],
				props: { width: 3.4, depth: 3.4, floors: 10 },
				label: {
					title: "Staff on site",
					dataKeys: ["staff_on_site"],
					offset: [3, 1.5, 1],
				},
				details: { description: "Head office.", dataKeys: ["staff_on_site"] },
			},
			{
				id: "depot",
				kind: "shed",
				name: "Van depot",
				position: [8.5, 0.2],
				props: { width: 4.2, depth: 3.2, height: 1.7 },
				label: { title: "Vans out", dataKeys: ["vans_out"], offset: [2.5, 1.6, 1.5] },
				details: { description: "Vans are charged and serviced here.", dataKeys: ["vans_out"] },
			},
			...houseColors.map((color, i) => ({
				id: `house_${i}`,
				kind: "house",
				name: `Customer ${i + 1}`,
				position: [-16 + i * 5.5, 9.8] as [number, number],
				color,
				label:
					i === 2
						? {
								title: "On-time deliveries",
								dataKeys: ["on_time"],
								offset: [-2.5, 1.2, 3.5] as [number, number, number],
							}
						: null,
			})),
			{
				id: "van_07",
				kind: "van",
				name: "Van 7",
				follow: { roadId: ROAD_ID, speed: 3, offset: 4 },
				label: {
					title: "Van 7",
					dataKeys: ["van7_load", "van7_eta"],
					offset: [2.5, 2.2, 2.5],
				},
				details: {
					description: "Currently on the delivery loop.",
					dataKeys: ["van7_load", "van7_eta"],
				},
			},
			{
				id: "van_01",
				kind: "van",
				name: "Van 01",
				accent: "#2bb58c",
				follow: { roadId: ROAD_ID, speed: 3, offset: 30 },
			},
			{
				id: "truck_01",
				kind: "truck",
				name: "Truck 01",
				follow: { roadId: ROAD_ID, speed: 2.4, offset: 58 },
			},
			...[-11, -8.6, -6.2].map((z, i) => ({
				id: `parked_van_${i}`,
				kind: "van",
				name: `Parked van ${i + 1}`,
				position: [19, z] as [number, number],
				accent: i === 1 ? "#8a5cf0" : null,
			})),
			{ id: "car_01", kind: "car", position: [3.2, 11], rotation: 90 },
			...[-14, -6, 2, 10].map((x, i) => ({
				id: `lamp_${i}`,
				kind: "lamp",
				position: [x, 4.3] as [number, number],
			})),
			...trees,
		],
	};
	return SceneSchema.parse(input);
};
