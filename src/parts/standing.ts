import * as THREE from "three";

import { toRadians, turnedHalfSize } from "#/lib/math";
import type { TArea, TEntity, TVec2 } from "#/scene/schema";
import { altitudeMovedOn, areaTopsOf, type ITop, standingAltitudeOn } from "#/scene/standing";

import { getPart, resolveProps } from "./registry";

/**
 * What things stand on (ADR-0138): the ground as the areas raise it
 * (ADR-0098), and the tops of objects whose part can be stood on
 * (`topHeightAt`: the shapes, shipping containers). An object dropped or
 * dragged onto one lands on its top, where the pointer is over it.
 */

/** What a world's things stand on is worked out from these. */
export interface IStandingWorld {
	areas: readonly TArea[];
	entities: readonly TEntity[];
}

const objectTops = new WeakMap<TEntity, ITop | null>();
const turned = new THREE.Matrix4();
const corner = new THREE.Vector3();
const foot = new THREE.Vector3();
const upward = new THREE.Vector3();

/**
 * The top of a tipped object (turned about X or Z, ADR-0097): the top of its
 * box as it's turned, for any point of the ground under it.
 */
const tippedTop = (
	entity: TEntity,
	[width, depth]: [number, number],
	height: number,
): ITop | null => {
	const [rx, ry, rz] = entity.rotation.map(toRadians);
	turned.compose(
		new THREE.Vector3(entity.position[0], entity.altitude, entity.position[1]),
		new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YZX")),
		new THREE.Vector3(entity.scale, entity.scale, entity.scale),
	);
	const low = [-width / 2, 0, -depth / 2];
	const high = [width / 2, height, depth / 2];
	const xs: number[] = [];
	const ys: number[] = [];
	const zs: number[] = [];
	for (const x of [low[0], high[0]]) {
		for (const y of [low[1], high[1]]) {
			for (const z of [low[2], high[2]]) {
				corner.set(x, y, z).applyMatrix4(turned);
				xs.push(corner.x);
				ys.push(corner.y);
				zs.push(corner.z);
			}
		}
	}
	// The vertical line through a point, in the object's own space: where it leaves the box at its top.
	const inverse = turned.clone().invert();
	return {
		entityId: entity.id,
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minZ: Math.min(...zs),
		maxZ: Math.max(...zs),
		highestAltitude: Math.max(...ys),
		altitudeAt: (x, z) => {
			foot.set(x, 0, z).applyMatrix4(inverse);
			upward
				.set(0, 1, 0)
				.transformDirection(inverse)
				.multiplyScalar(1 / entity.scale);
			let from = Number.NEGATIVE_INFINITY;
			let to = Number.POSITIVE_INFINITY;
			for (let axis = 0; axis < 3; axis++) {
				const start = foot.getComponent(axis);
				const along = upward.getComponent(axis);
				if (Math.abs(along) < 1e-9) {
					if (start < low[axis] - 1e-6 || start > high[axis] + 1e-6) {
						return null;
					}
					continue;
				}
				const a = (low[axis] - start) / along;
				const b = (high[axis] - start) / along;
				from = Math.max(from, Math.min(a, b));
				to = Math.min(to, Math.max(a, b));
			}
			return to >= from ? to : null;
		},
	};
};

/** An object's top as something to stand on, or null when nothing stands on it. */
const objectTopOf = (entity: TEntity): ITop | null => {
	const known = objectTops.get(entity);
	if (known !== undefined) {
		return known;
	}
	const part = getPart(entity.kind);
	let top: ITop | null = null;
	// Driving things move, and hidden ones aren't there to stand on.
	if (part?.topHeightAt && !part.flat && !entity.follow && !entity.isHidden) {
		const topHeightAt = part.topHeightAt;
		const props = resolveProps(part, entity.props);
		const footprint = part.footprint(props);
		const height = part.height(props);
		const [x0, z0] = entity.position;
		const { altitude, scale } = entity;
		if (entity.rotation[0] !== 0 || entity.rotation[2] !== 0) {
			top = tippedTop(entity, footprint, height);
		} else {
			const [halfX, halfZ] = turnedHalfSize(footprint[0], footprint[1], entity.rotation[1], scale);
			// Counter-clockwise seen from above, as the object is turned: undone to find the point in its own space.
			const cos = Math.cos(toRadians(entity.rotation[1]));
			const sin = Math.sin(toRadians(entity.rotation[1]));
			top = {
				entityId: entity.id,
				minX: x0 - halfX,
				maxX: x0 + halfX,
				minZ: z0 - halfZ,
				maxZ: z0 + halfZ,
				highestAltitude: altitude + height * scale,
				altitudeAt: (x, z) => {
					const dx = x - x0;
					const dz = z - z0;
					const local = topHeightAt(
						props,
						(cos * dx - sin * dz) / scale,
						(sin * dx + cos * dz) / scale,
					);
					return local === null ? null : altitude + local * scale;
				},
			};
		}
	}
	objectTops.set(entity, top);
	return top;
};

const topsOfEntities = new WeakMap<readonly TEntity[], ITop[]>();

/** The tops of the objects that can be stood on, worked out once per object as it is. */
const objectTopsOf = (entities: readonly TEntity[]) => {
	let tops = topsOfEntities.get(entities);
	if (!tops) {
		tops = entities.flatMap((entity) => objectTopOf(entity) ?? []);
		topsOfEntities.set(entities, tops);
	}
	return tops;
};

/**
 * Everything things stand on in a world: its raised land and the tops of its
 * objects, but those in `except` (what's moving: never what it stands on).
 */
export const topsToStandOn = (
	world: IStandingWorld,
	except?: string | ReadonlySet<string>,
): ITop[] => {
	const objects = objectTopsOf(world.entities);
	const isLeftOut =
		except === undefined
			? null
			: typeof except === "string"
				? (top: ITop) => top.entityId === except
				: (top: ITop) => top.entityId !== null && except.has(top.entityId);
	return [
		...areaTopsOf(world.areas),
		...(isLeftOut ? objects.filter((top) => !isLeftOut(top)) : objects),
	];
};

/** What the thing asked about is: the objects moving (never what they stand on), and its altitude. */
export interface IStanding {
	/** What moves, left out of what it stands on: an object's id, or several. */
	except?: string | ReadonlySet<string>;
	/** Its altitude, when asking what it stands on where it is now: tops above it don't count. */
	base?: number;
}

/**
 * How high what stands at a point is in a world: the ground there, or the top
 * of an object over it. What a thing put there stands on (ADR-0138).
 */
export const standingAltitudeAt = (
	world: IStandingWorld,
	point: TVec2,
	{ except, base }: IStanding = {},
) => standingAltitudeOn(topsToStandOn(world, except), point, base);

/**
 * An object's altitude once it moves to `to`: as high above what it stands on
 * there as it was above what it stood on where it is (ADR-0098, ADR-0138).
 * `world` is the world before the move; `there` the ground where it goes,
 * when that isn't the same (areas pasted with it).
 */
export const altitudeMovedTo = (
	world: IStandingWorld,
	entity: Pick<TEntity, "id" | "altitude" | "position">,
	to: TVec2,
	{
		except = entity.id,
		there = world,
	}: { except?: string | ReadonlySet<string>; there?: IStandingWorld } = {},
) =>
	altitudeMovedOn(
		entity.altitude,
		{ tops: topsToStandOn(world, except), point: entity.position },
		{ tops: topsToStandOn(there, except), point: to },
	);
