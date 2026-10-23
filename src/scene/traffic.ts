/**
 * Traffic on one road: vehicles keep a gap to the one ahead in their lane, and
 * overtake slower ones when the way is clear, then pull back in. Framework-free
 * and stateless between calls apart from the `states` map the caller keeps.
 * See docs/adr/0042-traffic-following-and-passing.md.
 */

/** One driving vehicle, as the traffic step sees it this frame. */
export interface ITrafficCar {
	id: string;
	/** Vehicles in the same stream drive in the same lane and direction (see `ITrafficPlace`). */
	stream: string;
	/** Length of the stream's cycle. */
	ring: number;
	/** Where it is around the cycle, 0 to `ring`. */
	position: number;
	/** Distance along the road's centre line, and which way it's driving there. */
	centre: number;
	direction: 1 | -1;
	/** Turning around at an open road's end: it doesn't start overtaking there. */
	turning: boolean;
	/** Bumper to bumper, in grid units. */
	length: number;
	/** The speed it's set to drive (grid units per second). */
	speed: number;
}

export interface ITrafficRoad {
	/** Length of the road's centre line. */
	length: number;
	/** A loop (otherwise an open road, driven there and back). */
	loop: boolean;
	/** Vehicles may overtake (otherwise they queue behind slower ones). Default on. */
	overtaking?: boolean;
}

/** What the traffic step remembers about a vehicle between frames. */
export interface ITrafficState {
	/** Its speed right now (it eases off behind slower vehicles). */
	speed: number;
	/** How far it has moved out to overtake: 0 = in its lane, 1 = fully out. */
	shift: number;
	/** How fast `shift` changes, per second (for leaning into the lane change). */
	shiftRate: number;
	/** The vehicle it's overtaking, if any. */
	passing: string | null;
	/** Seconds spent on the current overtake (gives up after a while). */
	passingFor: number;
	/** Seconds it has been stuck behind a slower vehicle (it waits a while before overtaking). */
	heldFor: number;
}

/** Clear space kept to the vehicle ahead when stopped, and the time gap added per unit of speed. */
export const MIN_GAP = 0.6;
const HEADWAY = 0.5;
/**
 * Speeding up and braking, in grid units per second squared: at least these,
 * and quicker for fast vehicles, so any vehicle gets back to its speed in
 * about a second (and stops in a fraction of one).
 */
const ACCEL = 2.5;
const BRAKE = 10;
const accelOf = (car: ITrafficCar) => Math.max(ACCEL, car.speed);
const brakeOf = (car: ITrafficCar) => Math.max(BRAKE, car.speed * 4);
/** How quickly a vehicle closes the gap to the speed it wants (seconds). */
const RESPONSE = 0.8;
/** It considers overtaking when held below this share of its own speed. */
const SLOWER = 0.85;
/** An overtake that would take longer than this isn't started, or is given up. */
const MAX_PASS_SECONDS = 10;
/** Moving out or back in takes this much road, within these many seconds. */
const SHIFT_DISTANCE = 3;
const SHIFT_SECONDS = { min: 0.3, max: 1.2 };
const shiftSecondsOf = (car: ITrafficCar) =>
	Math.min(
		SHIFT_SECONDS.max,
		Math.max(SHIFT_SECONDS.min, SHIFT_DISTANCE / Math.max(car.speed, 0.1)),
	);
/** Seconds it follows a slower vehicle before overtaking: this, plus up to `PATIENCE_SPREAD`. */
const PATIENCE = 1.5;
const PATIENCE_SPREAD = 2;

/** How long this vehicle waits behind a slower one: its own, the same every time, 0 to 1. */
const temperament = (id: string) => {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	return (Math.abs(hash) % 1000) / 1000;
};

export const createTrafficState = (speed: number): ITrafficState => ({
	speed,
	shift: 0,
	shiftRate: 0,
	passing: null,
	passingFor: 0,
	heldFor: 0,
});

/** Distance covered in `seconds`, speeding up from `from` to `to` at `accel`. */
const distanceIn = (seconds: number, from: number, to: number, accel: number) => {
	const speeding = Math.min(seconds, Math.max(0, (to - from) / accel));
	return from * speeding + (accel * speeding ** 2) / 2 + to * (seconds - speeding);
};

/**
 * Seconds to gain `distance` on a vehicle driving at `lead`, starting at `from`
 * and speeding up to `to` (faster than `lead`) at `accel`.
 */
const timeToGain = (distance: number, from: number, lead: number, to: number, accel: number) => {
	const start = from - lead;
	const most = to - lead;
	const speeding = Math.max(0, (most - start) / accel);
	const gained = start * speeding + (accel * speeding ** 2) / 2;
	if (gained >= distance) {
		return (-start + Math.sqrt(start ** 2 + 2 * accel * distance)) / accel;
	}
	return speeding + (distance - gained) / most;
};

/** How far `to` is ahead of `from` around a cycle. */
const ahead = (from: number, to: number, ring: number) => {
	const gap = to - from;
	return gap < 0 ? gap + ring : gap;
};

/** Space between two vehicles' bumpers, `back` behind `front`. */
const clearance = (back: ITrafficCar, front: ITrafficCar) =>
	ahead(back.position, front.position, back.ring) - (back.length + front.length) / 2;

/** Whether `car` is past `other`: ahead of it by less than half the cycle, bumpers clear by `gap`. */
const isPast = (car: ITrafficCar, other: ITrafficCar, gap: number) =>
	ahead(other.position, car.position, car.ring) < car.ring / 2 && clearance(other, car) > gap;

/**
 * Whether anything comes the other way between `from` and `reach` ahead along
 * the centre line (or is right beside it), within `within` seconds.
 */
const oncomingClear = (
	road: ITrafficRoad,
	car: ITrafficCar,
	cars: ITrafficCar[],
	reach: number,
	within: number,
) => {
	for (const other of cars) {
		if (other.id === car.id || other.direction === car.direction) {
			continue;
		}
		// Fully past it with room to spare, or far enough away for the whole move.
		const beside = (car.length + other.length) / 2 + MIN_GAP;
		let delta = (other.centre - car.centre) * car.direction;
		if (road.loop) {
			delta = ahead(0, delta, road.length);
			if (delta > road.length - beside) {
				delta -= road.length; // just behind, i.e. still beside it
			}
		}
		const closing = reach + other.speed * within + beside;
		if (delta > -beside && delta < closing) {
			return false;
		}
	}
	return true;
};

/**
 * Advance every vehicle on one road by `dt` seconds. `states` is this road's
 * memory: it's updated, gains new vehicles and drops ones no longer on the
 * road. Returns how far each vehicle moved, by id.
 */
export const stepRoadTraffic = (
	road: ITrafficRoad,
	cars: ITrafficCar[],
	states: Map<string, ITrafficState>,
	dt: number,
): Map<string, number> => {
	const moves = new Map<string, number>();
	const stateOf = (car: ITrafficCar) => {
		let state = states.get(car.id);
		if (!state) {
			state = createTrafficState(car.speed);
			states.set(car.id, state);
		}
		return state;
	};
	const byId = new Map(cars.map((car) => [car.id, car]));
	const streams = new Map<string, ITrafficCar[]>();
	for (const car of cars) {
		const list = streams.get(car.stream) ?? [];
		list.push(car);
		streams.set(car.stream, list);
	}

	for (const stream of streams.values()) {
		// The nearest vehicle ahead in the same lane: both in it, or both out overtaking.
		// The one being overtaken doesn't count, it's beside.
		const leaderOf = (car: ITrafficCar) => {
			const state = stateOf(car);
			let best: ITrafficCar | null = null;
			let bestGap = Number.POSITIVE_INFINITY;
			for (const other of stream) {
				if (other === car || other.id === state.passing) {
					continue;
				}
				if (Math.abs(stateOf(other).shift - state.shift) >= 0.5) {
					continue;
				}
				let gap = ahead(car.position, other.position, car.ring);
				// Exactly level: the one listed first counts as behind.
				if (gap === 0 && stream.indexOf(other) < stream.indexOf(car)) {
					gap = car.ring;
				}
				if (gap < bestGap) {
					best = other;
					bestGap = gap;
				}
			}
			return best;
		};

		for (const car of stream) {
			const state = stateOf(car);
			const leader = leaderOf(car);
			const leaderSpeed = leader ? stateOf(leader).speed : 0;
			const clear = leader ? clearance(car, leader) : Number.POSITIVE_INFINITY;
			const wanted = MIN_GAP + state.speed * HEADWAY;
			// Held up: close enough behind the leader that it sets the pace.
			const held = leader !== null && clear < wanted + car.speed * RESPONSE * 2;

			// Stuck behind a slower vehicle: it settles in behind for a while before overtaking.
			const slowed = held && leader !== null && leaderSpeed < car.speed * SLOWER;
			state.heldFor = slowed && state.passing === null ? state.heldFor + dt : 0;
			const patience = PATIENCE + PATIENCE_SPREAD * temperament(car.id);

			// Start overtaking when it has waited long enough and the way is clear for the whole move.
			if (
				road.overtaking !== false &&
				slowed &&
				leader &&
				state.heldFor >= patience &&
				state.passing === null &&
				state.shift === 0 &&
				!car.turning &&
				!leader.turning
			) {
				// How long and how far the move takes: speeding up from where it is now until past the
				// other vehicle (that part must fit before the road ends), then back in (oncoming traffic
				// must stay clear of all of it).
				const accel = accelOf(car);
				const distance = Math.max(0, clear) + car.length + leader.length + MIN_GAP * 2;
				const pastIn = timeToGain(distance, state.speed, leaderSpeed, car.speed, accel);
				const past = distanceIn(pastIn, state.speed, car.speed, accel);
				const seconds = pastIn + shiftSecondsOf(car);
				const reach = distanceIn(seconds, state.speed, car.speed, accel);
				const roomToEnd = road.loop
					? Number.POSITIVE_INFINITY
					: car.direction > 0
						? road.length - car.centre
						: car.centre;
				if (
					seconds <= MAX_PASS_SECONDS &&
					past + car.length < roomToEnd &&
					oncomingClear(road, car, cars, reach, seconds)
				) {
					state.passing = leader.id;
					state.passingFor = 0;
				}
			}

			// Overtaking: done once clear ahead of the other vehicle; given up if it takes too long or
			// the road is about to end.
			if (state.passing !== null) {
				state.passingFor += dt;
				const passed = byId.get(state.passing);
				const roomToEnd = road.loop
					? Number.POSITIVE_INFINITY
					: car.direction > 0
						? road.length - car.centre
						: car.centre;
				if (
					!passed ||
					isPast(car, passed, MIN_GAP + state.speed * HEADWAY) ||
					state.passingFor > MAX_PASS_SECONDS ||
					road.overtaking === false ||
					car.turning ||
					roomToEnd < car.length
				) {
					state.passing = null;
				}
			}

			// Speed: its own, or eased to keep the gap to the leader.
			let target = car.speed;
			if (leader && clear < wanted + car.speed * RESPONSE * 2) {
				target = Math.min(car.speed, Math.max(0, leaderSpeed + (clear - wanted) / RESPONSE));
			}
			const change = target - state.speed;
			state.speed = Math.max(
				0,
				state.speed + Math.max(-brakeOf(car) * dt, Math.min(accelOf(car) * dt, change)),
			);

			// Never into the vehicle ahead, whatever the speed says.
			let move = state.speed * dt;
			if (leader) {
				move = Math.min(move, Math.max(0, clear - MIN_GAP / 2 + leaderSpeed * dt));
			}
			moves.set(car.id, move);

			// Move out while overtaking, back in after.
			const goal = state.passing !== null ? 1 : 0;
			const before = state.shift;
			const step = dt / shiftSecondsOf(car);
			state.shift = goal > before ? Math.min(goal, before + step) : Math.max(goal, before - step);
			state.shiftRate = dt > 0 ? (state.shift - before) / dt : 0;
		}
	}

	// Forget vehicles that left the road.
	for (const id of states.keys()) {
		if (!byId.has(id)) {
			states.delete(id);
		}
	}
	return moves;
};
