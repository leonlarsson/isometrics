import { createFileRoute, redirect } from "@tanstack/react-router";

// A world shared by link (ADR-0120): the editor opens it (SharedWorldOpener), from its own page, so
// cleaning the address afterwards doesn't start the editor over.
export const Route = createFileRoute("/w/$id")({
	beforeLoad: ({ params }) => {
		throw redirect({ href: `/?shared=${encodeURIComponent(params.id)}`, replace: true });
	},
});
