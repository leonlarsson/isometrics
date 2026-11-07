import * as THREE from "three";

import { addSurfaceShading, surfaceProgramKey } from "./surfaceShading";

/**
 * Snow on the ground and wet ground (ADR-0102): an addition to every
 * standard material's shader, from shared values the weather sets each frame.
 * Snow settles on what faces up (more of it as the cover grows), whitening it;
 * wet ground darkens and turns glossy, more on what faces up. Compiled in only
 * while there's snow or wetness (`enabled`): switching recompiles the
 * shaders once. A material can stay out (`userData.noWeather`: water, which
 * still takes areas' own fog and storm, unless `userData.noAreaWeather`), or
 * take less snow (`userData.snowFactor`, a uniform: roads in use, kept clearer
 * by their traffic). The same hook adds a ground's or area's surface
 * (render/surfaceShading, ADR-0137), for any renderer: the snow and wetness
 * come after its pattern and gather in its hollows first.
 */
/** At most this many lightning flashes light the view at once (areas' own lightning, ADR-0151). */
export const MOST_FLASHES = 4;

/** A map of nothing, until areas have weather of their own. */
const emptyMap = () => {
	const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
	texture.needsUpdate = true;
	return texture;
};

export const weatherShading = {
	enabled: false,
	/**
	 * Whether areas have weather of their own (ADR-0151): then every point reads
	 * the weather map (render/WeatherMap) for its snow, wetness, fog, haze and
	 * light, and lightning in an area lights what's round where it strikes.
	 */
	local: false,
	/** The editor's view's renderer: only its materials take it (not the parts' pictures, ADR-0102). */
	renderer: null as THREE.WebGLRenderer | null,
	uniforms: {
		snowCover: { value: 0 },
		wetness: { value: 0 },
		snowColor: { value: new THREE.Color("#f3f6fa") },
		/** The weather map's textures (scene/weatherMap): rain, snow, wetness, snow cover; fog, haze, overcast, coverage; splashes. */
		mapA: { value: emptyMap() as THREE.Texture },
		mapB: { value: emptyMap() as THREE.Texture },
		mapC: { value: emptyMap() as THREE.Texture },
		/** Where the map lies: x and z of its corner, and 1 / its width and depth, in grid units. */
		mapBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
		/** How overcast the world's weather makes the light, which its lights already show. */
		overcast: { value: 0 },
		fogColor: { value: new THREE.Color("#cdd3d9") },
		hazeColor: { value: new THREE.Color("#f4ecdc") },
		/** Areas' lightning: where each flash is (x, z), how far it reaches and how bright it is now. */
		flashes: { value: Array.from({ length: MOST_FLASHES }, () => new THREE.Vector4()) },
		flashColor: { value: new THREE.Color("#dfe6ff") },
	},
};

/**
 * Where a point lies on the weather map, from its world position: GLSL, for
 * every shader that reads the map. `weatherMapBounds` as `uniforms.mapBounds`.
 */
export const WEATHER_MAP_UV = /* glsl */ `
	vec2 weatherMapUv(vec3 at) {
		return (at.xz - weatherMapBounds.xy) * weatherMapBounds.zw;
	}
`;

/** A material's share of the snow when it doesn't say: all of it. */
const ALL_THE_SNOW = { value: 1 };

const SHADING = /* glsl */ `
	#include <normal_fragment_maps>
	{
		float cover = weatherSnowCover * weatherSnowFactor;
		float facingUp = clamp(inverseTransformDirection(normal, viewMatrix).y, 0.0, 1.0);
		float settles = 1.0 - cover * 0.85;
		float snowy = cover > 0.0 ? smoothstep(settles, settles + 0.15, facingUp) : 0.0;
		float settled = min(1.0, cover * 1.8);
		float pooled = 1.0;
		#ifdef SURFACE_PATTERN
			// A surface's joints and gaps (ADR-0137): thin snow lies there first, and they're wettest.
			settled += (1.0 - settled) * surfaceHollow * 0.7 * smoothstep(0.0, 0.5, cover);
			pooled = 1.0 + 0.7 * surfaceHollow;
		#endif
		diffuseColor.rgb = mix(diffuseColor.rgb, weatherSnowColor, snowy * settled);
		roughnessFactor = mix(roughnessFactor, 0.9, snowy);
		float wet = min(1.0, weatherWetness * (0.45 + 0.55 * facingUp) * pooled) * (1.0 - snowy);
		diffuseColor.rgb *= 1.0 - 0.38 * wet;
		roughnessFactor = mix(roughnessFactor, 0.22, wet * 0.85);
	}
`;

/**
 * The same with areas' own weather (ADR-0151): the snow and wetness at this
 * point from the weather map, the light darker under an area's storm (or
 * brighter under its clear sky in a stormy world), lit by its lightning, and
 * its fog and haze kept for the end (`LOCAL_FOG`).
 */
const LOCAL_SHADING = /* glsl */ `
	#include <normal_fragment_maps>
	{
		vec2 weatherUv = weatherMapUv(vWeatherAt);
		vec4 weatherA = texture2D(weatherMapA, weatherUv);
		vec4 weatherB = texture2D(weatherMapB, weatherUv);
		float weatherCovered = weatherB.a;
		float cover = (weatherSnowCover * (1.0 - weatherCovered) + weatherA.a) * weatherSnowFactor;
		float wetness = weatherWetness * (1.0 - weatherCovered) + weatherA.b;
		float facingUp = clamp(inverseTransformDirection(normal, viewMatrix).y, 0.0, 1.0);
		float settles = 1.0 - cover * 0.85;
		float snowy = cover > 0.0 ? smoothstep(settles, settles + 0.15, facingUp) : 0.0;
		float settled = min(1.0, cover * 1.8);
		float pooled = 1.0;
		#ifdef SURFACE_PATTERN
			settled += (1.0 - settled) * surfaceHollow * 0.7 * smoothstep(0.0, 0.5, cover);
			pooled = 1.0 + 0.7 * surfaceHollow;
		#endif
		diffuseColor.rgb = mix(diffuseColor.rgb, weatherSnowColor, snowy * settled);
		roughnessFactor = mix(roughnessFactor, 0.9, snowy);
		float wet = min(1.0, wetness * (0.45 + 0.55 * facingUp) * pooled) * (1.0 - snowy);
		diffuseColor.rgb *= 1.0 - 0.38 * wet;
		roughnessFactor = mix(roughnessFactor, 0.22, wet * 0.85);
		// Under an area's own sky: darker as it's more overcast than the world's, lighter as it's less.
		diffuseColor.rgb *= clamp(1.0 - 0.5 * (weatherB.b - weatherOvercast * weatherCovered), 0.45, 1.35);
		// Its lightning, lighting what's round where it struck, most what faces up.
		float flash = 0.0;
		for (int i = 0; i < ${MOST_FLASHES}; i++) {
			vec4 strike = weatherFlashes[i];
			float reach = 1.0 - smoothstep(0.0, max(strike.z, 0.001), distance(vWeatherAt.xz, strike.xy));
			flash += strike.w * reach * reach;
		}
		totalEmissiveRadiance += diffuseColor.rgb * weatherFlashColor * flash * (0.35 + 0.65 * facingUp);
		// Fog and haze lie thickest near the ground and thin out upwards.
		float low = 1.0 - smoothstep(0.0, 16.0, vWeatherAt.y);
		weatherFogHere = clamp(weatherB.r * (0.35 + 0.65 * low) * 0.95, 0.0, 0.92);
		weatherHazeHere = clamp(weatherB.g * (0.5 + 0.5 * low) * 0.6, 0.0, 0.6);
	}
`;

/** An area's fog and haze over what's drawn, before the world's own fog. */
const LOCAL_FOG = /* glsl */ `
	gl_FragColor.rgb = mix(gl_FragColor.rgb, weatherHazeColor, weatherHazeHere);
	gl_FragColor.rgb = mix(gl_FragColor.rgb, weatherFogColor, weatherFogHere);
	#include <fog_fragment>
`;

const LOCAL_FRAGMENT_HEAD = /* glsl */ `
	uniform sampler2D weatherMapA;
	uniform sampler2D weatherMapB;
	uniform vec4 weatherMapBounds;
	uniform float weatherOvercast;
	uniform vec3 weatherFogColor;
	uniform vec3 weatherHazeColor;
	uniform vec4 weatherFlashes[${MOST_FLASHES}];
	uniform vec3 weatherFlashColor;
	varying vec3 vWeatherAt;
	float weatherFogHere = 0.0;
	float weatherHazeHere = 0.0;
	${WEATHER_MAP_UV}
`;

/**
 * Where a vertex is in the world, for the weather map: drawn alone, batched
 * or instanced. After three's own project_vertex.
 */
export const WEATHER_AT_VERTEX = /* glsl */ `
	#include <project_vertex>
	{
		vec4 weatherAt = vec4(transformed, 1.0);
		#ifdef USE_BATCHING
			weatherAt = batchingMatrix * weatherAt;
		#endif
		#ifdef USE_INSTANCING
			weatherAt = instanceMatrix * weatherAt;
		#endif
		vWeatherAt = (modelMatrix * weatherAt).xyz;
	}
`;

/**
 * An area's own weather over a material that takes no snow or wetness
 * (water, ADR-0151): its fog and haze, the light darker under its storm and
 * its lightning's flash, worked on the lit colour at the end. GLSL in place of
 * three's fog_fragment.
 */
const OVER_FOG = /* glsl */ `
	{
		vec4 weatherB = texture2D(weatherMapB, weatherMapUv(vWeatherAt));
		gl_FragColor.rgb *= clamp(1.0 - 0.5 * (weatherB.b - weatherOvercast * weatherB.a), 0.45, 1.35);
		float flash = 0.0;
		for (int i = 0; i < ${MOST_FLASHES}; i++) {
			vec4 strike = weatherFlashes[i];
			float reach = 1.0 - smoothstep(0.0, max(strike.z, 0.001), distance(vWeatherAt.xz, strike.xy));
			flash += strike.w * reach * reach;
		}
		gl_FragColor.rgb += weatherFlashColor * flash * 0.3;
		float low = 1.0 - smoothstep(0.0, 16.0, vWeatherAt.y);
		weatherFogHere = clamp(weatherB.r * (0.35 + 0.65 * low) * 0.95, 0.0, 0.92);
		weatherHazeHere = clamp(weatherB.g * (0.5 + 0.5 * low) * 0.6, 0.0, 0.6);
	}
	${LOCAL_FOG}
`;

/** Whether a material takes areas' own weather now: while there is some, unless it stays out (clouds). */
const takesAreaWeather = (material: THREE.Material, renderer: unknown) =>
	weatherShading.enabled &&
	weatherShading.local &&
	!material.userData.noAreaWeather &&
	renderer === weatherShading.renderer;

/**
 * Adds an area's own weather over a material that takes no snow or wetness
 * (ADR-0151): the plain water through the shared hook, the reflective water
 * (render/Water) from its own. Nothing while no area has weather of its own.
 */
export const addAreaWeatherOver = (
	material: THREE.Material,
	shader: THREE.WebGLProgramParametersWithUniforms,
	renderer: unknown,
) => {
	if (!takesAreaWeather(material, renderer)) {
		return;
	}
	const u = weatherShading.uniforms;
	Object.assign(shader.uniforms, {
		weatherMapA: u.mapA,
		weatherMapB: u.mapB,
		weatherMapBounds: u.mapBounds,
		weatherOvercast: u.overcast,
		weatherFogColor: u.fogColor,
		weatherHazeColor: u.hazeColor,
		weatherFlashes: u.flashes,
		weatherFlashColor: u.flashColor,
	});
	shader.vertexShader = shader.vertexShader
		.replace("void main() {", "varying vec3 vWeatherAt;\nvoid main() {")
		.replace("#include <project_vertex>", WEATHER_AT_VERTEX);
	shader.fragmentShader = shader.fragmentShader
		.replace("void main() {", `${LOCAL_FRAGMENT_HEAD}void main() {`)
		.replace("#include <fog_fragment>", OVER_FOG);
};

/** What tells apart a program with an area's own weather over it, for a material's cache key. */
export const areaWeatherOverKey = (material: THREE.Material) =>
	weatherShading.enabled && weatherShading.local && !material.userData.noAreaWeather
		? "weather:over:"
		: "";

/** What standard materials compile with: the weather's shading, while it's enabled. */
const weatherOnBeforeCompile: THREE.Material["onBeforeCompile"] = function (
	this: THREE.Material,
	shader,
	renderer,
) {
	if (!weatherShading.enabled || this.userData.noWeather || renderer !== weatherShading.renderer) {
		// No snow or wetness (water), but an area's own fog and storm over it.
		if (this.userData.noWeather) {
			addAreaWeatherOver(this, shader, renderer);
		}
		addSurfaceShading(this, shader);
		return;
	}
	const u = weatherShading.uniforms;
	shader.uniforms.weatherSnowCover = u.snowCover;
	shader.uniforms.weatherWetness = u.wetness;
	shader.uniforms.weatherSnowColor = u.snowColor;
	shader.uniforms.weatherSnowFactor = this.userData.snowFactor ?? ALL_THE_SNOW;
	const head =
		"uniform float weatherSnowCover;\nuniform float weatherSnowFactor;\nuniform float weatherWetness;\nuniform vec3 weatherSnowColor;\n";
	if (!weatherShading.local) {
		shader.fragmentShader = shader.fragmentShader
			.replace("void main() {", `${head}void main() {`)
			.replace("#include <normal_fragment_maps>", SHADING);
		addSurfaceShading(this, shader);
		return;
	}
	shader.uniforms.weatherMapA = u.mapA;
	shader.uniforms.weatherMapB = u.mapB;
	shader.uniforms.weatherMapBounds = u.mapBounds;
	shader.uniforms.weatherOvercast = u.overcast;
	shader.uniforms.weatherFogColor = u.fogColor;
	shader.uniforms.weatherHazeColor = u.hazeColor;
	shader.uniforms.weatherFlashes = u.flashes;
	shader.uniforms.weatherFlashColor = u.flashColor;
	shader.vertexShader = shader.vertexShader
		.replace("void main() {", "varying vec3 vWeatherAt;\nvoid main() {")
		.replace("#include <project_vertex>", WEATHER_AT_VERTEX);
	shader.fragmentShader = shader.fragmentShader
		.replace("void main() {", `${head}${LOCAL_FRAGMENT_HEAD}void main() {`)
		.replace("#include <normal_fragment_maps>", LOCAL_SHADING)
		.replace("#include <fog_fragment>", LOCAL_FOG);
	addSurfaceShading(this, shader);
};

// Three tells materials' programs apart by their own onBeforeCompile (the reflective water has
// its own): kept, with whether the weather's shading is in.
const weatherProgramKey: THREE.Material["customProgramCacheKey"] = function (this: THREE.Material) {
	const weather = !weatherShading.enabled
		? ""
		: this.userData.noWeather
			? areaWeatherOverKey(this)
			: weatherShading.local
				? "weather:local:"
				: "weather:";
	return surfaceProgramKey(this) + weather + this.onBeforeCompile.toString();
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
