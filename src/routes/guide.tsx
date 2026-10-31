import { createFileRoute } from "@tanstack/react-router";

import { APP_NAME } from "#/lib/app";
import { GuidePage } from "#/ui/GuidePage";

// How a world is made, walked through with a real API, for people and AIs (ADR-0116).
export const Route = createFileRoute("/guide")({
	head: () => ({ meta: [{ title: `Guide · ${APP_NAME}` }] }),
	component: Guide,
});

// Route files keep `Route` first; the hoisted function declaration makes that possible (ADR-0015).
function Guide() {
	return <GuidePage />;
}
