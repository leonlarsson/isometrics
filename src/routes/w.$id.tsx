import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "#/ui/AppShell";
import { ErrorScreen } from "#/ui/ErrorScreen";

// A world shared by link (ADR-0120): the editor itself, at the link's own address, which it opens
// as a preview (openLink); the address goes back to / in place once anything else is open (ADR-0129).
export const Route = createFileRoute("/w/$id")({
	ssr: false,
	component: AppShell,
	errorComponent: ErrorScreen,
});
