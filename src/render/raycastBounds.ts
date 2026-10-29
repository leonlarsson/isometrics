import * as THREE from "three";

/**
 * An object's meshes are tested against the pointer only when the ray passes
 * through the object's bounds (PERFORMANCE.md). r3f tests every mesh of every
 * object on every pointer move, each moving its bounding sphere into the world
 * first: with thousands of objects, moving the pointer over a painted wood
 * kept the main thread busy. three leaves out the children of an object whose
 * raycast says false. The bounds of an object standing still are worked out
 * when the pointer first comes by after it renders; a moving one's meshes are
 * always tested.
 */

/** Objects standing still, and their bounds once worked out. */
const standing = new WeakMap<THREE.Object3D, THREE.Sphere | null>();
const box = new THREE.Box3();

/** After the object renders: its bounds are worked out again, or none kept while it moves. */
export const forgetBounds = (object: THREE.Object3D | null, moving: boolean) => {
	if (!object) {
		return;
	}
	if (moving) {
		standing.delete(object);
	} else {
		standing.set(object, null);
	}
};

/** The bounds of everything in the object, wide enough for the lines and points three hits near. */
const boundsOf = (object: THREE.Object3D, raycaster: THREE.Raycaster) => {
	box.setFromObject(object);
	if (box.isEmpty()) {
		return null;
	}
	let near = 0;
	object.traverse((each) => {
		if ((each as THREE.Line).isLine) {
			near = Math.max(near, raycaster.params.Line?.threshold ?? 0);
		}
		if ((each as THREE.Points).isPoints) {
			near = Math.max(near, raycaster.params.Points?.threshold ?? 0);
		}
	});
	const sphere = box.getBoundingSphere(new THREE.Sphere());
	sphere.radius += near;
	return sphere;
};

/** An object's raycast: false (its meshes left out) when the ray misses its bounds. */
export const raycastWithinBounds = function (
	this: THREE.Object3D,
	raycaster: THREE.Raycaster,
): boolean | undefined {
	if (!standing.has(this)) {
		return undefined;
	}
	let sphere = standing.get(this);
	if (!sphere) {
		sphere = boundsOf(this, raycaster);
		if (!sphere) {
			return undefined;
		}
		standing.set(this, sphere);
	}
	return raycaster.ray.intersectsSphere(sphere) ? undefined : false;
};
