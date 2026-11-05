import { createFileRoute } from "@tanstack/react-router";

import { GuidePage } from "#/ui/GuidePage";
import { GUIDE_LINK_PREVIEW } from "#/ui/linkPreviews";

// How a world is made, walked through with a real API, for people and AIs (ADR-0116).
export const Route = createFileRoute("/guide")({
	head: () => ({ meta: GUIDE_LINK_PREVIEW }),
	component: Guide,
});

// Route files keep `Route` first; the hoisted function declaration makes that possible (ADR-0015).
function Guide() {
	return <GuidePage />;
}
