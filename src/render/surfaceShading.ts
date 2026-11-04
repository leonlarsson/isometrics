import type * as THREE from "three";

import type { IDrawnSurface } from "#/scene/surfaces";

/**
 * Surfaces with texture (ADR-0137): an addition to the standard material's
 * shader, like the weather's (render/weatherShading, which calls it), for the
 * ground's and areas' materials whose `userData.surface` names a kind. Each
 * kind's pattern is a function of the point's place on the ground (world x
 * and z), so the ground and areas meet without seams; it shades the surface's
 * own colour (a shade around 1, and a tint for some), tilts the normal (so
 * stones and ripples catch the sun) and says how hollow the point is (joints,
 * gaps: where the weather's thin snow and wetness gather first). Every
 * feature fades to its average as it gets smaller than a few pixels, so
 * nothing shimmers from afar. Only what faces up takes it.
 */

/** A material's surface: its kind, and its strength and size as uniforms (sliding them never recompiles). */
export interface ISurfaceShading {
	kind: IDrawnSurface["kind"];
	uniforms: { strength: { value: number }; scale: { value: number } };
}

/** The material's surface, if it has one. */
const surfaceOfMaterial = (material: THREE.Material) =>
	material.userData.surface as ISurfaceShading | undefined;

const NOISE = /* glsl */ `
	uniform float surfaceStrength;
	uniform float surfaceScale;
	varying vec3 vSurfaceAt;
	#define SURFACE_PATTERN
	/** How hollow the point is, 0 on top to 1 in a joint or gap: for the weather's snow and wetness. */
	float surfaceHollow = 0.0;
	float surfHash(vec2 p) {
		vec3 p3 = fract(vec3(p.xyx) * 0.1031);
		p3 += dot(p3, p3.yzx + 33.33);
		return fract((p3.x + p3.y) * p3.z);
	}
	vec2 surfHash2(vec2 p) {
		vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
		p3 += dot(p3, p3.yzx + 33.33);
		return fract((p3.xx + p3.yz) * p3.zy);
	}
	/** Smooth value noise, 0 to 1, with its gradient: (value, d/dx, d/dy). */
	vec3 surfNoise(vec2 p) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		// Quintic, so the gradient (which tilts the light) has no creases at the cells' edges.
		vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
		vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
		float a = surfHash(i);
		float b = surfHash(i + vec2(1.0, 0.0));
		float c = surfHash(i + vec2(0.0, 1.0));
		float d = surfHash(i + vec2(1.0, 1.0));
		float k = a - b - c + d;
		return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
	}
	/** How much of a feature this big shows where a pixel is px across: all of it from 6 pixels, none under 2. */
	float surfDetail(float size, float px) {
		return clamp((size / px - 2.0) * 0.25, 0.0, 1.0);
	}
`;

/**
 * Each kind's pattern, in the pattern's own units (`p`, world units ÷ the
 * size; `px`, a pixel across in them): it adds to `shade` (around 1), sets
 * `tint`, adds to `slope` (the rise along x and z, tilting the normal) and
 * sets `hollow`. Designed at strength 0.5; the strength scales all of it.
 */
const PATTERNS: Record<IDrawnSurface["kind"], string> = {
	grass_01: /* glsl */ `
		vec3 big = surfNoise(p * 0.35);
		vec3 mid = surfNoise(p * 1.4 + 17.0);
		float dBig = surfDetail(2.8, px);
		float dMid = surfDetail(0.7, px);
		shade += (big.x - 0.5) * 0.16 * dBig + (mid.x - 0.5) * 0.1 * dMid;
		// The lighter patches a little drier and yellower.
		tint = mix(vec3(1.0), vec3(1.08, 1.05, 0.8), smoothstep(0.55, 0.85, big.x) * 0.6 * dBig);
		slope += mid.yz * 1.4 * 0.035 * dMid;
		// Fine, uneven blades: streaks across the wind, at two sizes, so no grid shows.
		vec3 fine = surfNoise(vec2(p.x * 6.0, p.y * 2.2) + 31.0);
		vec3 finer = surfNoise(vec2(p.y * 9.0, p.x * 3.5) + 47.0);
		shade += (fine.x - 0.5) * 0.12 * surfDetail(0.2, px) + (finer.x - 0.5) * 0.08 * surfDetail(0.12, px);
		hollow = smoothstep(0.45, 0.15, big.x) * 0.5 * dBig;
	`,
	sand_01: /* glsl */ `
		// Wind ripples: gentle on the windward side, steeper on the lee, bent and fading in and out.
		vec3 bend = surfNoise(p * 0.18);
		vec2 wind = vec2(0.82, 0.57);
		float along = dot(p, wind) / 0.5 + bend.x * 6.0;
		vec2 dAlong = wind / 0.5 + bend.yz * 0.18 * 6.0;
		float theta = 6.2832 * along;
		float phase = theta + 0.7 * sin(theta);
		float rise = 0.5 + 0.5 * sin(phase);
		float dRise = 0.5 * cos(phase) * (1.0 + 0.7 * cos(theta)) * 6.2832;
		float rippled = smoothstep(0.25, 0.75, surfNoise(p * 0.45 + 3.1).x) * surfDetail(0.5, px);
		slope += dRise * dAlong * 0.009 * rippled;
		shade += (rise - 0.5) * 0.07 * rippled;
		hollow = (1.0 - rise) * 0.7 * rippled;
		// Soft mottling and a fine grain.
		vec3 mottle = surfNoise(p * 0.3 + 9.0);
		float dMottle = surfDetail(3.0, px);
		shade += (mottle.x - 0.5) * 0.1 * dMottle;
		shade += (surfHash(floor(p / 0.06)) - 0.5) * 0.08 * surfDetail(0.06, px);
		tint = mix(vec3(1.0), vec3(1.04, 1.0, 0.9), smoothstep(0.45, 0.85, mottle.x) * 0.6 * dMottle);
	`,
	gravel_01: /* glsl */ `
		// Small stones: cells round random points, each its own shade, rounded, with gaps between.
		vec2 q = p / 0.2;
		vec2 home = floor(q);
		vec2 f = fract(q);
		float first = 8.0;
		float second = 8.0;
		vec2 toMiddle = vec2(0.0);
		vec2 stoneId = vec2(0.0);
		for (int j = -1; j <= 1; j++) {
			for (int i = -1; i <= 1; i++) {
				vec2 o = vec2(float(i), float(j));
				vec2 r = o + surfHash2(home + o) - f;
				float d = dot(r, r);
				if (d < first) {
					second = first;
					first = d;
					toMiddle = r;
					stoneId = home + o;
				} else if (d < second) {
					second = d;
				}
			}
		}
		float edge = sqrt(second) - sqrt(first);
		float dStone = surfDetail(0.2, px);
		// Round pebbles of different sizes, with grit between them.
		float radius = 0.34 + surfHash(stoneId + 6.1) * 0.22;
		float stone = smoothstep(0.02, 0.08 + px / 0.2, edge) * (1.0 - smoothstep(radius, radius + 0.1 + px / 0.2, sqrt(first)));
		float lum = surfHash(stoneId + 2.7);
		shade += ((lum - 0.5) * 0.3 * stone - (1.0 - stone) * 0.24 + 0.05) * dStone;
		tint = mix(vec3(1.0), mix(vec3(1.05, 1.0, 0.93), vec3(0.95, 0.99, 1.05), lum), 0.5 * dStone);
		slope += toMiddle * 0.9 * stone * dStone;
		hollow = (1.0 - stone) * dStone;
		// Patches of finer and coarser stones, which still show from afar.
		shade += (surfNoise(p * 0.5).x - 0.5) * 0.08 * surfDetail(2.0, px);
		shade += (surfNoise(p * 1.7 + 8.0).x - 0.5) * 0.12 * surfDetail(0.6, px);
	`,
	paving_01: /* glsl */ `
		// Square slabs with thin joints and bevelled edges, each a little lighter or darker.
		const float SLAB = 0.8;
		const float JOINT = 0.018;
		vec2 q = p / SLAB;
		vec2 slab = floor(q);
		vec2 f = fract(q) - 0.5;
		vec2 toEdges = (0.5 - abs(f)) * SLAB;
		float toEdge = min(toEdges.x, toEdges.y);
		float dSlab = surfDetail(SLAB, px);
		float joint = (1.0 - smoothstep(JOINT, JOINT + max(px, 0.006), toEdge)) * clamp(JOINT * 2.0 / px, 0.0, 1.0);
		shade += ((surfHash(slab) - 0.5) * 0.1 - joint * 0.3) * dSlab;
		float bevel = (1.0 - smoothstep(JOINT, JOINT + 0.05, toEdge)) * (1.0 - joint);
		vec2 outward = toEdges.x < toEdges.y ? vec2(sign(f.x), 0.0) : vec2(0.0, sign(f.y));
		slope -= outward * bevel * 0.35 * dSlab;
		shade += (surfNoise(p * 3.0).x - 0.5) * 0.06 * surfDetail(0.33, px);
		shade += (surfNoise(p * 0.4 + 2.0).x - 0.5) * 0.06 * surfDetail(2.5, px);
		hollow = joint * dSlab;
	`,
	concrete_01: /* glsl */ `
		// Large panels with joints, quiet mottling, a fine aggregate and a few faint stains.
		const float PANEL = 3.0;
		const float JOINT = 0.02;
		vec2 q = p / PANEL;
		vec2 panel = floor(q);
		vec2 f = fract(q) - 0.5;
		vec2 toEdges = (0.5 - abs(f)) * PANEL;
		float toEdge = min(toEdges.x, toEdges.y);
		float dPanel = surfDetail(PANEL, px);
		float joint = (1.0 - smoothstep(JOINT, JOINT + max(px, 0.006), toEdge)) * clamp(JOINT * 2.0 / px, 0.0, 1.0);
		shade += ((surfHash(panel) - 0.5) * 0.07 - joint * 0.3) * dPanel;
		shade += (surfNoise(p * 0.7).x - 0.5) * 0.07 * surfDetail(1.4, px);
		shade += (surfNoise(p * 2.6 + 4.0).x - 0.5) * 0.05 * surfDetail(0.4, px);
		shade += (surfHash(floor(p / 0.04)) - 0.5) * 0.05 * surfDetail(0.04, px);
		float stain = smoothstep(0.66, 0.85, surfNoise(p * 0.16 + 21.0).x);
		shade -= stain * 0.08 * surfDetail(4.0, px);
		hollow = max(joint * dPanel, stain * 0.5);
	`,
	cobbles_01: /* glsl */ `
		// Setts: rounded stones in rows, each its own length and shade, in dark joints.
		const float ROW = 0.28;
		const float LENGTH = 0.36;
		float row = floor(p.y / ROW);
		float along = p.x / LENGTH + surfHash(vec2(row, 3.0)) * 7.0;
		float cell = floor(along);
		// Where each stone ends: a cell's end moved by up to a third of a stone, so lengths vary.
		float end = cell + 1.0 + (surfHash(vec2(cell, row)) - 0.5) * 0.6;
		float start = cell + (surfHash(vec2(cell - 1.0, row)) - 0.5) * 0.6;
		float first = along < start ? cell - 1.0 : (along > end ? cell + 1.0 : cell);
		float from = first + (surfHash(vec2(first - 1.0, row)) - 0.5) * 0.6;
		float until = first + 1.0 + (surfHash(vec2(first, row)) - 0.5) * 0.6;
		vec2 stoneId = vec2(first, row);
		vec2 local = vec2((along - (from + until) * 0.5) * LENGTH, p.y - (row + 0.5) * ROW);
		vec2 halfSize = vec2((until - from) * LENGTH, ROW - (surfHash(stoneId + 9.0) * 0.03)) * 0.5 - 0.018;
		const float ROUND = 0.06;
		vec2 corner = abs(local) - (halfSize - ROUND);
		float inStone = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - ROUND;
		float stone = 1.0 - smoothstep(-max(px, 0.005), max(px, 0.005), inStone);
		float dStone = surfDetail(ROW, px);
		float lum = surfHash(stoneId + 11.0);
		shade += ((lum - 0.5) * 0.34 * stone - (1.0 - stone) * 0.42 + 0.07) * dStone;
		tint = mix(vec3(1.0), mix(vec3(1.06, 1.0, 0.92), vec3(0.94, 0.99, 1.06), surfHash(stoneId + 4.0)), 0.7 * dStone);
		// Worn smooth: a gentle rounding over the stone, steeper near its edge.
		slope -= local / (halfSize * halfSize) * 0.022 * stone * dStone;
		shade += (surfNoise(p * 6.0).x - 0.5) * 0.06 * stone * surfDetail(0.15, px);
		hollow = (1.0 - stone) * dStone;
		shade += (surfNoise(p * 0.5 + 4.0).x - 0.5) * 0.08 * surfDetail(2.0, px);
	`,
	dirt_01: /* glsl */ `
		// Blotchy earth, damper and darker in its low patches, with a grain and scattered pebbles.
		vec3 big = surfNoise(p * 0.4);
		vec3 mid = surfNoise(p * 1.6 + 5.0);
		float dBig = surfDetail(2.5, px);
		float dMid = surfDetail(0.6, px);
		shade += (big.x - 0.5) * 0.2 * dBig + (mid.x - 0.5) * 0.14 * dMid;
		float damp = smoothstep(0.5, 0.2, big.x) * dBig;
		tint = mix(vec3(1.0), vec3(0.9, 0.87, 0.84), damp * 0.7);
		slope += big.yz * 0.4 * 0.08 * dBig + mid.yz * 1.6 * 0.025 * dMid;
		shade += (surfHash(floor(p / 0.05)) - 0.5) * 0.07 * surfDetail(0.05, px);
		vec2 cell = floor(p / 0.3);
		vec2 toPebble = (fract(p / 0.3) - 0.5 - (surfHash2(cell) - 0.5) * 0.8) * 0.3;
		float size = 0.014 + surfHash(cell + 2.1) * 0.03;
		float pebble = step(0.72, surfHash(cell + 7.0)) * (1.0 - smoothstep(size, size + 0.008 + px, length(toPebble)));
		float dPebble = surfDetail(0.1, px);
		shade += pebble * (surfHash(cell + 1.3) - 0.45) * 0.3 * dPebble;
		slope -= toPebble / (size * size) * 0.004 * pebble * dPebble;
		hollow = damp * 0.6;
	`,
	snow_01: /* glsl */ `
		// A snowfield in a tint of its colour, soft drifts lit by the sun, bluer in the hollows.
		// As white as the colour is light: on a dark theme's darker colours, a duller snow that doesn't glare.
		float lightness = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
		vec3 snowWhite = vec3(0.9, 0.925, 0.955) * clamp(lightness * 5.0, 0.4, 1.0);
		diffuseColor.rgb = mix(diffuseColor.rgb, snowWhite, 0.78 * surfOnTop);
		vec3 drift = surfNoise(p * 0.22);
		vec3 ripple = surfNoise(p * 0.8 + 13.0);
		float dDrift = surfDetail(4.0, px);
		float dRipple = surfDetail(1.2, px);
		slope += drift.yz * 0.22 * 0.35 * dDrift + ripple.yz * 0.8 * 0.05 * dRipple;
		shade += (drift.x - 0.5) * 0.05 * dDrift;
		float low = smoothstep(0.55, 0.2, drift.x) * dDrift;
		tint = mix(vec3(1.0), vec3(0.93, 0.96, 1.03), low);
		hollow = low * 0.5;
	`,
};

const vertexAdditions = (vertexShader: string) =>
	vertexShader
		.replace("void main() {", "varying vec3 vSurfaceAt;\nvoid main() {")
		.replace(
			"#include <project_vertex>",
			"#include <project_vertex>\n\tvSurfaceAt = (modelMatrix * vec4(transformed, 1.0)).xyz;",
		);

const fragmentPattern = (kind: IDrawnSurface["kind"]) => /* glsl */ `
	#include <normal_fragment_maps>
	{
		float surfOnTop = smoothstep(0.7, 0.95, inverseTransformDirection(normal, viewMatrix).y);
		vec2 p = vSurfaceAt.xz / surfaceScale;
		float px = max(max(fwidth(p.x), fwidth(p.y)), 1e-5);
		float shade = 1.0;
		vec3 tint = vec3(1.0);
		vec2 slope = vec2(0.0);
		float hollow = 0.0;
		${PATTERNS[kind]}
		float surfAmount = surfaceStrength * 2.0 * surfOnTop;
		diffuseColor.rgb *= max(mix(vec3(1.0), tint * shade, surfAmount), vec3(0.0));
		normal = normalize(normal + (viewMatrix * vec4(-slope.x, 0.0, -slope.y, 0.0)).xyz * surfAmount);
		surfaceHollow = clamp(hollow * min(surfAmount, 1.0), 0.0, 1.0);
	}
`;

/**
 * Adds a material's surface to its shader as it compiles, after the weather's
 * (whose snow and wetness then come after the pattern in the shader, and read
 * its hollows). Nothing for a material without one.
 */
export const addSurfaceShading = (
	material: THREE.Material,
	shader: THREE.WebGLProgramParametersWithUniforms,
) => {
	const surface = surfaceOfMaterial(material);
	if (!surface) {
		return;
	}
	shader.uniforms.surfaceStrength = surface.uniforms.strength;
	shader.uniforms.surfaceScale = surface.uniforms.scale;
	shader.vertexShader = vertexAdditions(shader.vertexShader);
	shader.fragmentShader = shader.fragmentShader
		.replace("void main() {", `${NOISE}\nvoid main() {`)
		.replace("#include <normal_fragment_maps>", fragmentPattern(surface.kind));
};

/** What tells a material's program apart by its surface: its kind, or nothing. */
export const surfaceProgramKey = (material: THREE.Material) => {
	const surface = surfaceOfMaterial(material);
	return surface ? `surface:${surface.kind}:` : "";
};
