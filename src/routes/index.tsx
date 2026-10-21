import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "#/ui/AppShell";
import { ErrorScreen } from "#/ui/ErrorScreen";

// The editor is WebGL + localStorage only, so skip server rendering for it.
export const Route = createFileRoute("/")({
	ssr: false,
	component: AppShell,
	// A crash shows a recovery screen instead of a blank page (ADR-0020).
	errorComponent: ErrorScreen,
});
