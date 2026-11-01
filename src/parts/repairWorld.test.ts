import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { upgradeLegacyIds } from "#/scene/legacy";
import { TEMPLATES } from "#/templates";

import { repairWorld, upgradePartSettings } from "./repairWorld";

const fixtureUrl = (name: string) =>
	new URL(`../scene/fixtures/old-worlds/${name}.json`, import.meta.url);

const fixture = (name: string) => JSON.parse(readFileSync(fixtureUrl(name), "utf8"));

/** The templates that existed when the format was tidied, each saved then. */
const tidiedTemplates = TEMPLATES.filter((template) =>
	existsSync(fixtureUrl(`${template.id}-1a50d84`)),
);

describe("reading a world saved before the format was tidied (ADR-0104)", () => {
	it.each(tidiedTemplates.map((template) => [template.id, template] as const))(
		"%s, as saved then, reads back exactly as the template builds it now",
		(id, template) => {
			const { scene, report } = repairWorld(fixture(`${id}-1a50d84`));
			expect(report).toBeNull();
			expect(scene).toEqual(template.create());
		},
	);

	const { scene, report } = repairWorld(fixture("every-field-1a50d84"));
	const entity = (id: string) => {
		const found = scene.entities.find((e) => e.id === id);
		if (!found) {
			throw new Error(`no object ${id}`);
		}
		return found;
	};

	it("needs no repairs", () => {
		expect(report).toBeNull();
	});

	it("keeps the world's settings, moved and renamed", () => {
		expect(scene.ground).toEqual({
			width: 30,
			depth: 20,
			colors: { surface: { color: "#a0b0c0", transparency: null, data: {} } },
		});
		expect(scene.traffic).toEqual({
			drivingSide: "left",
			turnStyle: "sharp",
			leansInTurns: false,
			keepsDistance: false,
			overtakes: false,
		});
		expect(scene.lighting).toMatchObject({
			time: 18.5,
			timeSource: "data",
			dayLength: 90,
			sunAzimuth: 200,
			whenLightsAreOn: "on",
			data: { time: { key: "hour" } },
		});
		expect(scene.lighting).not.toHaveProperty("timeKey");
		expect(scene.sky).toEqual({
			showsInPerspective: false,
			colorOverhead: "#112233",
			colorAtHorizon: "#445566",
			showsSun: false,
			showsMoon: false,
			starDensity: 0.9,
		});
		expect(scene.weather).toMatchObject({
			cloudCover: 0.8,
			cloudColor: "#dddddd",
			cloudSpeed: 2,
			rainAmount: 0.5,
			snowCover: 0.25,
			showsSplashes: false,
			softensLight: false,
			data: { rainAmount: { key: "rain", valueAtFull: 10 } },
		});
		// The six switches it had then, all off; what came later has its default.
		const { showsDataSwitch, legend, tileKeys, ...switches } = scene.onScreen;
		expect(Object.values(switches)).toEqual([false, false, false, false, false, false]);
		expect([showsDataSwitch, legend, tileKeys]).toEqual([true, [], []]);
		expect(scene.camera).toEqual({
			openingViewpointId: "overview",
			openingProjection: "perspective",
			fieldOfView: 35,
			closestSpan: 3,
			farthestSpan: 200,
			lowestElevation: 5,
			highestElevation: 80,
			keepsOverGround: false,
			keepsIsometricAngle: true,
			turntable: { isOn: true, speed: -6, delay: 20 },
			tiltShift: { isOn: true, blurStrength: 0.6, sharpBandHeight: 0.2, sharpBandPosition: 0.4 },
		});
		expect(scene.backdrop).toMatchObject({ kind: "gradient", gradientAngle: 90 });
	});

	it("keeps moods' looks, with their clouds as weather and their tilt-shift", () => {
		const [mood] = scene.moods;
		expect(mood.lighting).toMatchObject({ time: 19, data: { time: { key: "hour" } } });
		expect(mood.sky.showsSun).toBe(false);
		expect(mood.sky).not.toHaveProperty("cloudCover");
		expect(mood.weather).toMatchObject({
			cloudCover: 0.5,
			cloudColor: "#ccbbaa",
			cloudSpeed: 0.5,
			rainAmount: 0.2,
			data: { fogDensity: { key: "rain", valueAtFull: 4 } },
		});
		expect(mood.water.rippleStrength).toBe(0.7);
		expect(mood.tiltShift).toEqual({
			isOn: true,
			blurStrength: 0.7,
			sharpBandHeight: 0.4,
			sharpBandPosition: 0.6,
		});
		expect(mood).not.toHaveProperty("camera");
	});

	it("keeps an object's place, turn, colours, card and lights", () => {
		const home = entity("home");
		expect(home).toMatchObject({
			altitude: 1.5,
			rotation: [-10, 90, 5],
			scale: 1.2,
			isLocked: true,
			isHidden: false,
			props: { showsChimney: false, roofHeight: 0.8 },
			label: { isShown: false, title: "Home", dataKeys: ["hour"], offset: [0, 3, 0] },
			details: { description: "Where the heart is", dataKeys: ["rain"] },
		});
		expect(home.colors.roof.color).toBe("#c0392b");
		expect(home.colors.roof.data.color).toMatchObject({
			key: "rain",
			valueAtLowColor: 1,
			valueAtHighColor: 9,
		});
		// The accent was the house's door.
		expect(home.colors.door.color).toBe("#123456");
		expect(home.lights.windows).toMatchObject({
			whenOn: "schedule",
			comesOn: "gradually",
			strength: 1.5,
			data: {
				strength: { key: "rain", valueAtFull: 5 },
				on: { key: "rain", switchesOnAbove: 2 },
				schedule: { key: "hours" },
			},
		});
		for (const old of ["elevation", "pitch", "roll", "color", "accent", "locked", "hidden"]) {
			expect(home).not.toHaveProperty(old);
		}
	});

	it("keeps a vehicle's driving, its old colour and its one lights mode", () => {
		const car = entity("car");
		expect(car.follow).toEqual({
			roadId: "high_street",
			speed: 3,
			startDistance: 2,
			drivesTheOtherWay: true,
			turnStyle: "smooth",
			leansInTurns: true,
		});
		expect(car.colors.body.color).toBe("#00ff00");
		expect(car.lights.headlights.whenOn).toBe("on");
		expect(car.label.isShown).toBe(false);
	});

	it("shows a card that had no switch, as it did", () => {
		expect(entity("sign").label).toMatchObject({ isShown: true, title: "Sign" });
	});

	it("folds a nature part's size into its scale", () => {
		expect(entity("tree")).toMatchObject({ scale: 3, isHidden: true });
		expect(entity("tree").props).not.toHaveProperty("size");
		expect(entity("big_tree").scale).toBe(10);
	});

	it("keeps the window lights' shares and weights", () => {
		expect(entity("tower").lights.windows).toMatchObject({
			litPaneShare: 0.5,
			paneWeight: 3,
			data: { litPaneShare: { key: "rain", valueAtFull: 10 } },
		});
		expect(entity("tower").lights.screens.paneWeight).toBe(2);
	});

	it("brings older light settings into the lights", () => {
		expect(entity("racer").lights.rainLight.color).toBe("#ff00ff");
		expect(entity("racer_set").lights.rainLight.color).toBe("#ff0000");
		expect(entity("lamp").lights.lamp).toMatchObject({ color: "#ffaa00", strength: 2, reach: 4 });
		expect(entity("forklift").lights.warningLight.strength).toBe(2);
		expect(entity("ship").lights.mastheadLight.color).toBe("#ffffff");
		expect(entity("boat").lights.mastheadLight.strength).toBe(2);
		expect(entity("bike").lights.headlight.color).toBe("#ffffff");
		expect(entity("crane").lights.warningLight.whenOn).toBe("off");
		expect(entity("gantry").lights.warningLight.strength).toBe(0.5);
		expect(entity("pylon").lights.warningLight.color).toBe("#ff0000");
	});

	it("keeps renamed part props", () => {
		expect(entity("sign").props).toMatchObject({ text: "Hi", dataKey: "hour", showsPlate: false });
		expect(entity("beam").props).toMatchObject({ beamRotates: false, beamSecondsPerTurn: 8 });
		expect(entity("church").props).toMatchObject({ depth: 5, width: 3 });
		expect(entity("barn").props).toMatchObject({ depth: 4 });
		expect(entity("greenhouse").props).toMatchObject({ depth: 3 });
		expect(entity("tunnel").props).toMatchObject({ buildingHeight: 2.2 });
		expect(entity("stand").props).toMatchObject({
			seatRowCount: 4,
			showsCrowd: false,
			showsRoof: true,
		});
		expect(entity("ship").props).toMatchObject({ containerLayerCount: 3 });
		expect(entity("box").props).toMatchObject({ containerCount: 3 });
		expect(entity("turbine").props).toMatchObject({ rotorSpins: false });
		expect(entity("bike").props).toMatchObject({ showsRider: false });
		expect(entity("boat").props).toMatchObject({ showsSails: false });
		expect(entity("crane").props).toMatchObject({ showsOutriggers: false });
	});

	it("keeps roads' settings, grouped and renamed", () => {
		const [street, ferry] = scene.roads;
		expect(street).toMatchObject({
			kind: "road_01",
			name: "High Street",
			points: [
				[-5, 0, 0],
				[0, 0, 1],
				[5, 0, 1, 3],
			],
			width: 2,
			cornerRadius: 1,
			showsCentreLine: false,
			heldUpBy: "embankment",
			pillarSpacing: 5,
			embankmentAngle: 60,
			embankmentWidth: 0.8,
			showsRailings: false,
			traffic: { drivingLane: "centre", turnStyle: "sharp", leansInTurns: false },
			isLocked: true,
		});
		expect(street.colors.surface.color).toBe("#333333");
		expect(street.colors.embankment.color).toBe("#887766");
		expect(ferry).toMatchObject({ kind: "hidden_route_01", isHidden: true });
	});

	it("keeps areas' settings, with a water area's own water", () => {
		const [lake, hill] = scene.areas;
		expect(lake).toMatchObject({
			kind: "water_01",
			water: { rippleStrength: 0.1, reflectionStrength: 0.3 },
			isHidden: true,
		});
		expect(lake.colors.surface.color).toBe("#2244aa");
		expect(hill).toMatchObject({
			kind: "raised_land_01",
			height: 2,
			points: [
				[2, 2],
				[6, 2, 1],
				[6, 6, -0.5],
			],
			peaks: [[4, 3, 1]],
			isLocked: true,
		});
	});

	it("keeps fences' settings", () => {
		expect(scene.fences[0]).toMatchObject({
			kind: "hedge_01",
			loops: true,
			height: 0.8,
			postSpacing: 2,
			builtShare: 0.5,
			data: { builtShare: { key: "rain", valueAtFull: 10 } },
			isLocked: true,
		});
		expect(scene.fences[0].colors.leaves.color).toBe("#336633");
	});

	it("keeps data values' names and viewpoints' targets", () => {
		expect(scene.data.values.map((entry) => entry.name)).toEqual(["Hour", "Rain", "Opening hours"]);
		expect(scene.viewpoints[0]).toMatchObject({
			target: [1, 2],
			targetAltitude: 1,
			azimuth: 300,
			elevation: 40,
			projection: "perspective",
			fieldOfView: 50,
			moodId: "dusk",
		});
	});

	it("has a place for every field once upgraded, so none is dropped unread", () => {
		const raw = upgradePartSettings(upgradeLegacyIds(fixture("every-field-1a50d84")));
		expect(fieldsWithoutAPlace(raw, scene)).toEqual([]);
	});
});

/**
 * Paths of fields in `raw` that `parsed` has no field for: what parsing
 * dropped. A part's own props are its to read, so they aren't followed.
 */
const fieldsWithoutAPlace = (raw: unknown, parsed: unknown, path = ""): string[] => {
	if (Array.isArray(raw)) {
		return raw.flatMap((item, i) =>
			fieldsWithoutAPlace(item, Array.isArray(parsed) ? parsed[i] : undefined, `${path}[${i}]`),
		);
	}
	if (typeof raw !== "object" || raw === null || path.endsWith(".props")) {
		return [];
	}
	const into = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Record<
		string,
		unknown
	>;
	return Object.entries(raw).flatMap(([key, value]) =>
		key in into ? fieldsWithoutAPlace(value, into[key], `${path}.${key}`) : [`${path}.${key}`],
	);
};

describe("reading worlds", () => {
	it("leaves the input as it was, to keep as a backup", () => {
		const input = fixture("every-field-1a50d84");
		const before = structuredClone(input);
		repairWorld(input);
		expect(input).toEqual(before);
	});

	it("reads its own output the same again", () => {
		const { scene } = repairWorld(fixture("every-field-1a50d84"));
		const again = repairWorld(structuredClone(scene));
		expect(again.report).toBeNull();
		expect(again.scene).toEqual(scene);
	});

	it("drops the old colours of a part it doesn't know, and keeps the object", () => {
		const { scene } = repairWorld({
			version: 1,
			entities: [{ id: "x", kind: "spaceship_09", color: "#abcdef", props: { warp: 9 } }],
		});
		expect(scene.entities[0]).toMatchObject({ kind: "spaceship_09", props: { warp: 9 } });
		expect(scene.entities[0].colors).toEqual({});
	});

	it("takes the colours AIs may still write as color and accent", () => {
		const { scene } = repairWorld({
			version: 1,
			entities: [{ id: "h", kind: "house_01", color: "#111111", accent: "#222222" }],
		});
		expect(scene.entities[0].colors).toMatchObject({
			roof: { color: "#111111" },
			door: { color: "#222222" },
		});
	});
});
