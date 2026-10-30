import { describe, expect, it } from "vitest";

import {
	createTrafficState,
	type ITrafficCar,
	type ITrafficState,
	MIN_GAP,
	stepRoadTraffic,
} from "./traffic";

const LOOP = { length: 60, loop: true };
const DT = 1 / 30;

interface ITestCar {
	id: string;
	speed: number;
	/** Distance driven since the start, from where it started around the loop. */
	progress: number;
	reverse?: boolean;
}

/** The cars as the traffic step sees them on a 60-unit loop. */
const placed = (cars: ITestCar[]): ITrafficCar[] =>
	cars.map((car) => {
		const position = ((car.progress % LOOP.length) + LOOP.length) % LOOP.length;
		return {
			id: car.id,
			stream: car.reverse ? "reverse" : "forward",
			ring: LOOP.length,
			position,
			centre: car.reverse ? (LOOP.length - position) % LOOP.length : position,
			direction: car.reverse ? -1 : 1,
			turning: false,
			length: 1.6,
			speed: car.speed,
		};
	});

/** Run the traffic for `seconds`, calling `check` after every step. */
const run = (
	cars: ITestCar[],
	seconds: number,
	check: (states: Map<string, ITrafficState>) => void = () => {},
) => {
	const states = new Map<string, ITrafficState>();
	for (let t = 0; t < seconds; t += DT) {
		const moves = stepRoadTraffic(LOOP, placed(cars), states, DT);
		for (const car of cars) {
			car.progress += moves.get(car.id) ?? 0;
		}
		check(states);
	}
	return states;
};

describe("road traffic", () => {
	it("keeps its distance behind a vehicle that's barely slower, without passing", () => {
		const slow = { id: "slow", speed: 1.9, progress: 10 };
		const fast = { id: "fast", speed: 2, progress: 6 };
		const states = run([slow, fast], 60, (s) => {
			expect(s.get("fast")?.passing).toBeNull();
			expect(slow.progress - fast.progress - 1.6).toBeGreaterThan(MIN_GAP / 2 - 1e-6);
		});
		expect(states.get("fast")?.speed).toBeCloseTo(1.9, 1);
	});

	it("overtakes a much slower vehicle and pulls back into its lane", () => {
		const slow = { id: "slow", speed: 0.5, progress: 10 };
		const fast = { id: "fast", speed: 2, progress: 4 };
		let passed = false;
		const states = run([slow, fast], 30, (s) => {
			const shift = s.get("fast")?.shift ?? 0;
			passed ||= shift > 0.5;
			// Never through it while both are in the lane.
			if (shift < 0.5 && fast.progress < slow.progress) {
				expect(slow.progress - fast.progress - 1.6).toBeGreaterThan(0);
			}
		});
		expect(passed).toBe(true);
		expect(fast.progress).toBeGreaterThan(slow.progress + 1.6);
		expect(states.get("fast")?.shift).toBe(0);
		expect(states.get("fast")?.speed).toBeCloseTo(2, 1);
	});

	it("waits behind while something comes the other way", () => {
		const slow = { id: "slow", speed: 0.5, progress: 10 };
		const fast = { id: "fast", speed: 2, progress: 7.5 };
		// Coming the other way, a few units ahead (the reverse stream's centre runs backwards).
		const oncoming = { id: "oncoming", speed: 2, progress: LOOP.length - 16, reverse: true };
		// Already waited long enough behind it, so only the oncoming van stops it.
		const waited = (): Map<string, ITrafficState> =>
			new Map([["fast", { ...createTrafficState(2), heldFor: 10 }]]);
		const states = waited();
		stepRoadTraffic(LOOP, placed([slow, fast, oncoming]), states, DT);
		expect(states.get("fast")?.passing).toBeNull();

		const clearStates = waited();
		stepRoadTraffic(LOOP, placed([slow, fast]), clearStates, DT);
		expect(clearStates.get("fast")?.passing).toBe("slow");
	});

	it("queues behind instead when overtaking is off", () => {
		const slow = { id: "slow", speed: 0.5, progress: 10 };
		const fast = { id: "fast", speed: 2, progress: 4 };
		const states = new Map<string, ITrafficState>();
		for (let t = 0; t < 30; t += DT) {
			const cars = placed([slow, fast]);
			const moves = stepRoadTraffic({ ...LOOP, overtakes: false }, cars, states, DT);
			slow.progress += moves.get("slow") ?? 0;
			fast.progress += moves.get("fast") ?? 0;
			expect(states.get("fast")?.shift).toBe(0);
		}
		expect(fast.progress).toBeLessThan(slow.progress);
		expect(states.get("fast")?.speed).toBeCloseTo(0.5, 1);
	});

	it("follows for a while before it overtakes", () => {
		const slow = { id: "slow", speed: 0.5, progress: 10 };
		const fast = { id: "fast", speed: 2, progress: 7.5 };
		const states = new Map<string, ITrafficState>();
		let firstPass = Number.POSITIVE_INFINITY;
		let t = 0;
		for (; t < 10; t += DT) {
			const moves = stepRoadTraffic(LOOP, placed([slow, fast]), states, DT);
			slow.progress += moves.get("slow") ?? 0;
			fast.progress += moves.get("fast") ?? 0;
			if (states.get("fast")?.passing && t < firstPass) {
				firstPass = t;
			}
		}
		expect(firstPass).toBeGreaterThanOrEqual(1.5);
		expect(firstPass).toBeLessThan(4);
	});

	it("never meets oncoming traffic while out overtaking", () => {
		const cars: ITestCar[] = [
			{ id: "truck", speed: 0.8, progress: 20 },
			{ id: "car1", speed: 3, progress: 12 },
			{ id: "car2", speed: 2.6, progress: 6 },
			{ id: "van", speed: 2, progress: LOOP.length - 50, reverse: true },
			{ id: "bus", speed: 1.2, progress: LOOP.length - 20, reverse: true },
		];
		let overtakes = 0;
		run(cars, 180, (states) => {
			const now = placed(cars);
			for (const car of now) {
				const shift = states.get(car.id)?.shift ?? 0;
				if (shift === 1) {
					overtakes += 1;
				}
				if (shift <= 0.2) {
					continue;
				}
				for (const other of now) {
					if (other.direction === car.direction) {
						continue;
					}
					const apart = Math.abs(other.centre - car.centre);
					const gap = Math.min(apart, LOOP.length - apart);
					expect(gap).toBeGreaterThan((car.length + other.length) / 2);
				}
			}
		});
		expect(overtakes).toBeGreaterThan(0);
	});

	it("overtakes a stopped vehicle on a short open road, even when very fast", () => {
		// A 30-unit road driven there and back, with 3-unit U-turns at the ends.
		const length = 30;
		const turn = 3;
		const ring = 2 * length + 2 * turn;
		const road = { length, loop: false };
		const at = (id: string, speed: number, progress: number): ITrafficCar => {
			const position = ((progress % ring) + ring) % ring;
			const back = position >= length + turn && position < 2 * length + turn;
			return {
				id,
				stream: "both",
				ring,
				position,
				centre: position < length ? position : back ? 2 * length + turn - position : 0,
				direction: back ? -1 : 1,
				turning: !back && position >= length,
				length: 2,
				speed,
			};
		};
		let van = 6;
		const states = new Map<string, ITrafficState>();
		let passed = false;
		for (let t = 0; t < 8 && !passed; t += DT) {
			const moves = stepRoadTraffic(road, [at("truck", 0, 12), at("van", 50, van)], states, DT);
			van += moves.get("van") ?? 0;
			passed = van > 12 + 2;
		}
		expect(passed).toBe(true);
	});

	it("drives straight on at its own speed when the lane is empty", () => {
		const solo = { id: "solo", speed: 3, progress: 0 };
		run([solo], 2);
		expect(solo.progress).toBeCloseTo(6, 1);
	});

	it("forgets vehicles that are no longer on the road", () => {
		const states = new Map<string, ITrafficState>();
		stepRoadTraffic(LOOP, placed([{ id: "a", speed: 1, progress: 0 }]), states, DT);
		stepRoadTraffic(LOOP, [], states, DT);
		expect(states.size).toBe(0);
	});
});
