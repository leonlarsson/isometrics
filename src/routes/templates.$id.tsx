import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "#/ui/AppShell";
import { ErrorScreen } from "#/ui/ErrorScreen";

// A template by its id (/templates/lantern-bay): the editor itself, at the template's own address,
// which it opens as a preview (openLink); back to / in place once anything else is open (ADR-0129).
export const Route = createFileRoute("/templates/$id")({
	ssr: false,
	component: AppShell,
	errorComponent: ErrorScreen,
});
