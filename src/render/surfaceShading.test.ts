import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { SURFACE_KIND_IDS } from "#/scene/surfaces";

import { addSurfaceShading, type ISurfaceShading, surfaceProgramKey } from "./surfaceShading";

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
			const surface: ISurfaceShading = { kind, uniforms: uniforms() };
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
			expect(surfaceProgramKey(material)).toBe(`surface:${kind}:`);
		}
	});

	it("tells kinds apart by their programs", () => {
		const keys = SURFACE_KIND_IDS.filter(
			(kind): kind is ISurfaceShading["kind"] => kind !== "plain",
		).map((kind) =>
			surfaceProgramKey(
				new THREE.MeshStandardMaterial({ userData: { surface: { kind, uniforms: uniforms() } } }),
			),
		);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
