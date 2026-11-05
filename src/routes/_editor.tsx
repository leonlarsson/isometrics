import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "#/ui/AppShell";
import { ErrorScreen } from "#/ui/ErrorScreen";
import { editorLinkPreview } from "#/ui/linkPreviews";

// The editor, for its own address and the links it opens (ADR-0129): one route around them, so
// going from a link back to / (a kept copy, the home screen) leaves it as it is instead of starting
// it over. WebGL and localStorage only, so no server rendering. Its links' previews (a starter's,
// a shared world's) are worked out here, from the address it matched (ADR-0146).
export const Route = createFileRoute("/_editor")({
	ssr: false,
	head: ({ matches }) => {
		const link = matches.at(-1);
		return { meta: editorLinkPreview(link?.routeId, link?.params ?? {}) };
	},
	component: AppShell,
	// A crash shows a recovery screen instead of a blank page (ADR-0020).
	errorComponent: ErrorScreen,
});
