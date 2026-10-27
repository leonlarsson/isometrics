import { keepOnHotReload } from "./hot";

/**
 * Seconds of motion so far: it runs only while motion plays (render/MotionClockStep),
 * so pausing (Space) holds everything drawn from it still, the water's ripples,
 * the wakes' shimmer and the beacons' pulse like the vehicles and clouds, and a
 * picture of a paused world is the same however long it takes to draw (ADR-0084).
 */
export const motionClock = keepOnHotReload("motionClock", () => ({ seconds: 0 }));
