import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "#/ui/AppShell";
import { ErrorScreen } from "#/ui/ErrorScreen";

// The editor, for its own address and the links it opens (ADR-0129): one route around them, so
// going from a link back to / (a kept copy, the home screen) leaves it as it is instead of starting
// it over. WebGL and localStorage only, so no server rendering.
export const Route = createFileRoute("/_editor")({
	ssr: false,
	component: AppShell,
	// A crash shows a recovery screen instead of a blank page (ADR-0020).
	errorComponent: ErrorScreen,
});
