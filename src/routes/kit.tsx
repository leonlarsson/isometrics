import { createFileRoute, notFound } from "@tanstack/react-router";

import { KitPage } from "#/ui/KitPage";

// Dev-only page showing every shared UI component (ADR-0025); a 404 in production builds.
export const Route = createFileRoute("/kit")({
	ssr: false,
	beforeLoad: () => {
		if (!import.meta.env.DEV) {
			throw notFound();
		}
	},
	component: Kit,
});

// Route files keep `Route` first; the hoisted function declaration makes that possible (ADR-0015).
function Kit() {
	return <KitPage />;
}
