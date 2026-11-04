import { useLayoutEffect, useMemo } from "react";

import type { IDrawnSurface } from "#/scene/surfaces";

import type { ISurfaceShading } from "./surfaceShading";
import { installWeatherShading } from "./weatherShading";

/**
 * A ground's or area's material's surface: `userData` for it, and a `key`
 * that changes with the kind, so another kind is a new material, compiled
 * afresh (and back to plain, one without the surface, as it always was).
 */
export const useSurfaceShading = (surface: IDrawnSurface | null) => {
	// Installed once with the weather's, whose hook adds surfaces: also for pictures drawn before the view.
	installWeatherShading();
	const uniforms = useMemo(() => ({ strength: { value: 0.5 }, scale: { value: 1 } }), []);
	const kind = surface?.kind ?? null;
	const strength = surface?.patternStrength ?? 0;
	const scale = surface?.patternScale ?? 1;
	useLayoutEffect(() => {
		uniforms.strength.value = strength;
		uniforms.scale.value = scale;
	}, [uniforms, strength, scale]);
	const userData = useMemo(
		() => (kind ? { surface: { kind, uniforms } satisfies ISurfaceShading } : undefined),
		[kind, uniforms],
	);
	return { key: kind ?? "plain", userData };
};
