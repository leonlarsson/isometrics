/** Whether the viewer prefers less motion (their system's setting): then things change at once rather than move. */
export const prefersLessMotion = () =>
	typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
