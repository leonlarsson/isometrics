import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { APP_NAME } from "#/lib/app";
import { PartsCatalogue } from "#/ui/PartsCatalogue";

// Every part you can add to a world, with its colours, lights and settings: the parts catalogue.
// `?part=<kind>` opens one.
export const Route = createFileRoute("/parts")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): { part?: string } =>
		typeof search.part === "string" ? { part: search.part } : {},
	head: () => ({ meta: [{ title: `Parts · ${APP_NAME}` }] }),
	component: Parts,
});

// Route files keep `Route` first; the hoisted function declaration makes that possible (ADR-0015).
function Parts() {
	const { part } = Route.useSearch();
	const navigate = useNavigate({ from: "/parts" });
	return (
		<PartsCatalogue
			openKind={part ?? null}
			onOpen={(kind) => navigate({ search: kind ? { part: kind } : {}, replace: true })}
		/>
	);
}
