import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { SURFACE_KIND_IDS } from "#/scene/surfaces";

import {
	addSurfaceShading,
	facingGlsl,
	type ISurfaceShading,
	SIDES_FADE,
	surfaceProgramKey,
} from "./surfaceShading";

const shaderOf = () => {
	const lib = THREE.ShaderLib.physical;
	return {
		uniforms: {} as Record<string, THREE.IUniform>,
		vertexShader: lib.vertexShader,
		fragmentShader: lib.fragmentShader,
	} as unknown as THREE.WebGLProgramParametersWithUniforms;
};

const uniforms = () => ({ strength: { value: 0.5 }, scale: { value: 1 } });

describe("surface shading (ADR-0137)", () => {
	it("leaves a plain material's shader exactly as it was", () => {
		const shader = shaderOf();
		const before = { ...shader };
		const material = new THREE.MeshStandardMaterial();
		addSurfaceShading(material, shader);
		expect(shader.vertexShader).toBe(before.vertexShader);
		expect(shader.fragmentShader).toBe(before.fragmentShader);
		expect(shader.uniforms).toEqual({});
		expect(surfaceProgramKey(material)).toBe("");
	});

	it("adds each kind's pattern, and only that one, after the normal is worked out", () => {
		for (const kind of SURFACE_KIND_IDS) {
			if (kind === "plain") {
				continue;
			}
			const shader = shaderOf();
			const surface: ISurfaceShading = { kind, uniforms: uniforms(), coversOnlyTops: true };
			const material = new THREE.MeshStandardMaterial({ userData: { surface } });
			addSurfaceShading(material, shader);
			expect(shader.uniforms.surfaceStrength).toBe(surface.uniforms.strength);
			expect(shader.uniforms.surfaceScale).toBe(surface.uniforms.scale);
			expect(shader.vertexShader).toContain("vSurfaceAt = (modelMatrix");
			const fragment = shader.fragmentShader;
			expect(fragment.indexOf("#define SURFACE_PATTERN")).toBeLessThan(
				fragment.indexOf("void main()"),
			);
			expect(fragment.indexOf("#include <normal_fragment_maps>")).toBeLessThan(
				fragment.indexOf("surfaceHollow = clamp"),
			);
			expect(surfaceProgramKey(material)).toBe(`surface:${kind}:tops:`);
		}
	});

	it("tells kinds apart by their programs", () => {
		const keys = SURFACE_KIND_IDS.filter(
			(kind): kind is ISurfaceShading["kind"] => kind !== "plain",
		).map((kind) =>
			surfaceProgramKey(
				new THREE.MeshStandardMaterial({
					userData: { surface: { kind, uniforms: uniforms(), coversOnlyTops: true } },
				}),
			),
		);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("pattern every face of an area's top, however it slopes, and fade only where sides share the material", () => {
		// An area's material is only on its top: sloped corners, peaks and ramps keep the pattern.
		expect(facingGlsl(true)).toBe("float surfFacing = 1.0;");
		const fragmentOf = (coversOnlyTops: boolean) => {
			const shader = shaderOf();
			const surface: ISurfaceShading = { kind: "cobbles_01", uniforms: uniforms(), coversOnlyTops };
			addSurfaceShading(new THREE.MeshStandardMaterial({ userData: { surface } }), shader);
			return shader.fragmentShader;
		};
		expect(fragmentOf(true)).toContain("float surfFacing = 1.0;");
		expect(fragmentOf(false)).toContain(`smoothstep(${SIDES_FADE[0].toFixed(2)}`);
		// The ground's slab: a 45° slope keeps all of it, a wall none, and it fades between.
		const smoothstep = (a: number, b: number, x: number) => {
			const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
			return t * t * (3 - 2 * t);
		};
		const facing = (degrees: number) =>
			smoothstep(SIDES_FADE[0], SIDES_FADE[1], Math.cos((degrees * Math.PI) / 180));
		expect(facing(0)).toBe(1);
		expect(facing(45)).toBe(1);
		expect(facing(65)).toBeGreaterThan(0.2);
		expect(facing(90)).toBe(0);
		// Kept apart: the two compile differently.
		const key = (coversOnlyTops: boolean) =>
			surfaceProgramKey(
				new THREE.MeshStandardMaterial({
					userData: { surface: { kind: "grass_01", uniforms: uniforms(), coversOnlyTops } },
				}),
			);
		expect(key(true)).not.toBe(key(false));
	});
});
