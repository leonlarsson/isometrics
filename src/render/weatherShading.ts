import * as THREE from "three";

/**
 * Snow on the ground and wet ground (ADR-0102): an addition to every
 * standard material's shader, from shared values the weather sets each frame.
 * Snow settles on what faces up (more of it as the cover grows), whitening it;
 * wet ground darkens and turns glossy, more on what faces up. Compiled in only
 * while there's snow or wetness (`enabled`): switching recompiles the
 * shaders once. A material can stay out (`userData.noWeather`: water), or
 * take less snow (`userData.snowFactor`, a uniform: roads in use, kept clearer
 * by their traffic).
 */
export const weatherShading = {
	enabled: false,
	/** The editor's view's renderer: only its materials take it (not the parts' pictures, ADR-0102). */
	renderer: null as THREE.WebGLRenderer | null,
	uniforms: {
		snowCover: { value: 0 },
		wetness: { value: 0 },
		snowColor: { value: new THREE.Color("#f3f6fa") },
	},
};

/** A material's share of the snow when it doesn't say: all of it. */
const ALL_THE_SNOW = { value: 1 };

const SHADING = /* glsl */ `
	#include <normal_fragment_maps>
	{
		float cover = weatherSnowCover * weatherSnowFactor;
		float facingUp = clamp(inverseTransformDirection(normal, viewMatrix).y, 0.0, 1.0);
		float settles = 1.0 - cover * 0.85;
		float snowy = cover > 0.0 ? smoothstep(settles, settles + 0.15, facingUp) : 0.0;
		diffuseColor.rgb = mix(diffuseColor.rgb, weatherSnowColor, snowy * min(1.0, cover * 1.8));
		roughnessFactor = mix(roughnessFactor, 0.9, snowy);
		float wet = weatherWetness * (0.45 + 0.55 * facingUp) * (1.0 - snowy);
		diffuseColor.rgb *= 1.0 - 0.38 * wet;
		roughnessFactor = mix(roughnessFactor, 0.22, wet * 0.85);
	}
`;

/** What standard materials compile with: the weather's shading, while it's enabled. */
const weatherOnBeforeCompile: THREE.Material["onBeforeCompile"] = function (
	this: THREE.Material,
	shader,
	renderer,
) {
	if (!weatherShading.enabled || this.userData.noWeather || renderer !== weatherShading.renderer) {
		return;
	}
	shader.uniforms.weatherSnowCover = weatherShading.uniforms.snowCover;
	shader.uniforms.weatherWetness = weatherShading.uniforms.wetness;
	shader.uniforms.weatherSnowColor = weatherShading.uniforms.snowColor;
	shader.uniforms.weatherSnowFactor = this.userData.snowFactor ?? ALL_THE_SNOW;
	shader.fragmentShader = shader.fragmentShader
		.replace(
			"void main() {",
			"uniform float weatherSnowCover;\nuniform float weatherSnowFactor;\nuniform float weatherWetness;\nuniform vec3 weatherSnowColor;\nvoid main() {",
		)
		.replace("#include <normal_fragment_maps>", SHADING);
};

// Three tells materials' programs apart by their own onBeforeCompile (the reflective water has
// its own): kept, with whether the weather's shading is in.
const weatherProgramKey: THREE.Material["customProgramCacheKey"] = function (this: THREE.Material) {
	const weather = weatherShading.enabled && !this.userData.noWeather ? "weather:" : "";
	return weather + this.onBeforeCompile.toString();
};

/** Installed once: every standard material takes the weather's shading while it's enabled. */
export const installWeatherShading = () => {
	THREE.MeshStandardMaterial.prototype.onBeforeCompile = weatherOnBeforeCompile;
	THREE.MeshStandardMaterial.prototype.customProgramCacheKey = weatherProgramKey;
};

/**
 * Whether a material compiles as three's plain kinds do, the weather's
 * shading aside: not one with a shader of its own (text, the reflective
 * water), which can't be drawn together with others (render/instancing).
 */
export const compilesPlainly = (material: THREE.Material) =>
	(material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile ||
		material.onBeforeCompile === weatherOnBeforeCompile) &&
	(material.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ||
		material.customProgramCacheKey === weatherProgramKey);
