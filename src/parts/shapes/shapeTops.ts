/**
 * The shapes' tops, what other objects stand on when dropped or dragged onto
 * them (ADR-0138): how high each shape's top is above its base at a point of
 * its footprint, in its own space at scale 1 (x across, z front to back), or
 * null where nothing stands on it (outside it, the hole of a hollow one, past
 * its arc). Round shapes are taken as smooth: their facets are left out.
 */

interface ISized {
	width: number;
	depth: number;
	height: number;
}

/** A tiny margin, so a point on an edge counts as on the shape. */
const EDGE = 1e-6;

/** Whether a point is on a footprint of this width and depth, centred on the origin. */
const isOnRectangle = (width: number, depth: number, x: number, z: number) =>
	Math.abs(x) <= width / 2 + EDGE && Math.abs(z) <= depth / 2 + EDGE;

/**
 * How far out a point is on a round footprint, as a share of the way to its
 * edge along its direction (0 in the middle, 1 at the edge), `inset` grid
 * units inside the edge (a hollow shape's inner wall).
 */
export const shareOut = (shape: Pick<ISized, "width" | "depth">, x: number, z: number, inset = 0) =>
	Math.hypot(
		x / Math.max(EDGE, shape.width / 2 - inset),
		z / Math.max(EDGE, shape.depth / 2 - inset),
	);

/** Whether a point is within a round shape's arc: from the back (−Z), clockwise seen from above. */
export const isWithinArc = (arcAngle: number, x: number, z: number) => {
	if (arcAngle >= 360 || (x === 0 && z === 0)) {
		return true;
	}
	const angle = (Math.atan2(x, -z) * 180) / Math.PI;
	return (angle + 360) % 360 <= arcAngle + EDGE;
};

/** A flat top over the whole footprint (a box, a panel, an arch). */
export const flatTop = (p: ISized, x: number, z: number) =>
	isOnRectangle(p.width, p.depth, x, z) ? p.height : null;

/** A box's top: flat, or only its walls when it's hollow. */
export const boxTop = (
	p: ISized & { isHollow: boolean; wallThickness: number },
	x: number,
	z: number,
) => {
	if (p.isHollow) {
		const wall = Math.min(p.wallThickness, Math.min(p.width, p.depth) / 2);
		if (isOnRectangle(p.width - 2 * wall, p.depth - 2 * wall, x, z)) {
			return null;
		}
	}
	return flatTop(p, x, z);
};

/**
 * A round shape's top from how high it is at each share of the way out
 * (`at`, 0 in the middle to 1 at the edge), within its arc.
 */
const roundTop = (
	p: Pick<ISized, "width" | "depth"> & { arcAngle?: number },
	x: number,
	z: number,
	at: (out: number) => number | null,
) => {
	const out = shareOut(p, x, z);
	if (out > 1 + EDGE || !isWithinArc(p.arcAngle ?? 360, x, z)) {
		return null;
	}
	return at(Math.min(1, out));
};

/** A cylinder's top: flat, or its walls when it's hollow. */
export const cylinderTop = (
	p: ISized & { isHollow: boolean; wallThickness: number; arcAngle: number },
	x: number,
	z: number,
) =>
	roundTop(p, x, z, () => (p.isHollow && shareOut(p, x, z, p.wallThickness) < 1 ? null : p.height));

/** From a foot to a top `topShare` as wide, straight up the side: a cone's or a pyramid's height at a share out. */
const taperedHeight = (height: number, topShare: number, out: number) =>
	out <= topShare ? height : (height * (1 - out)) / Math.max(EDGE, 1 - topShare);

/** A cone's top: up its side to its point, or to its flat top; hollow and cut off, open in the middle. */
export const coneTop = (
	p: ISized & { topWidthShare: number; isHollow: boolean; arcAngle: number },
	x: number,
	z: number,
) =>
	roundTop(p, x, z, (out) =>
		p.isHollow && out < p.topWidthShare ? null : taperedHeight(p.height, p.topWidthShare, out),
	);

/** A pyramid's top: up its four sides to its point, or to its flat top. */
export const pyramidTop = (p: ISized & { topWidthShare: number }, x: number, z: number) => {
	if (!isOnRectangle(p.width, p.depth, x, z)) {
		return null;
	}
	const out = Math.min(
		1,
		Math.max(Math.abs(x) / Math.max(EDGE, p.width / 2), Math.abs(z) / Math.max(EDGE, p.depth / 2)),
	);
	return taperedHeight(p.height, p.topWidthShare, out);
};

/** A dome's top: a quarter of an oval, highest in the middle. */
export const domeTop = (p: ISized & { arcAngle: number }, x: number, z: number) =>
	roundTop(p, x, z, (out) => p.height * Math.sqrt(Math.max(0, 1 - out * out)));

/** A ball's top: its upper half. */
export const ballTop = (p: ISized, x: number, z: number) =>
	roundTop(p, x, z, (out) => (p.height / 2) * (1 + Math.sqrt(Math.max(0, 1 - out * out))));

/** A capsule's top: its round end, as round as its narrower side allows. */
export const capsuleTop = (p: ISized, x: number, z: number) => {
	const end = Math.min(Math.min(p.width, p.depth) / 2, p.height / 2);
	return roundTop(p, x, z, (out) => p.height - end + end * Math.sqrt(Math.max(0, 1 - out * out)));
};

/** A ring's top: over its band, highest along the band's middle; nothing in the hole. */
export const ringTop = (
	p: ISized & { ringThickness: number; arcAngle: number },
	x: number,
	z: number,
) => {
	if (shareOut(p, x, z) > 1 + EDGE || !isWithinArc(p.arcAngle, x, z)) {
		return null;
	}
	const band = Math.min(p.ringThickness, Math.min(p.width, p.depth) / 2 - 0.005) / 2;
	// How far the point is from the band's middle line, along its direction.
	const middle = shareOut(p, x, z, band);
	const reach = Math.hypot(x, z);
	const off = middle > 0 ? Math.abs(reach - reach / middle) : Number.POSITIVE_INFINITY;
	if (off > band + EDGE) {
		return null;
	}
	const across = Math.min(1, off / Math.max(EDGE, band));
	return (p.height / 2) * (1 + Math.sqrt(Math.max(0, 1 - across * across)));
};

/** A wedge's top: up from the front and the back to its ridge. */
export const wedgeTop = (p: ISized & { ridgeShare: number }, x: number, z: number) => {
	if (!isOnRectangle(p.width, p.depth, x, z)) {
		return null;
	}
	const front = p.depth / 2;
	const ridge = front - p.ridgeShare * p.depth;
	const rise =
		z >= ridge
			? (front - z) / Math.max(EDGE, front - ridge)
			: (z + front) / Math.max(EDGE, ridge + front);
	return p.height * Math.min(1, Math.max(0, rise));
};

/** A corner wedge's top: down from its back left corner (−X, −Z) to the front and the right. */
export const cornerWedgeTop = (p: ISized, x: number, z: number) => {
	if (!isOnRectangle(p.width, p.depth, x, z)) {
		return null;
	}
	const right = (x + p.width / 2) / Math.max(EDGE, p.width);
	const forward = (z + p.depth / 2) / Math.max(EDGE, p.depth);
	return p.height * Math.min(1, Math.max(0, 1 - Math.max(right, forward)));
};

/** Stairs' top: each step's tread, rising from the front (+Z) to the back. */
export const stairsTop = (p: ISized & { stepCount: number }, x: number, z: number) => {
	if (!isOnRectangle(p.width, p.depth, x, z)) {
		return null;
	}
	const tread = p.depth / p.stepCount;
	const step = Math.min(p.stepCount, Math.max(1, Math.ceil((p.depth / 2 - z) / tread - EDGE)));
	return (p.height / p.stepCount) * step;
};
