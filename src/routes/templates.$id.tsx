import { createFileRoute, redirect } from "@tanstack/react-router";

// A template by its id (/templates/brightwater): the editor opens a copy of it next to the others
// (SharedWorldOpener, ADR-0120), from its own page.
export const Route = createFileRoute("/templates/$id")({
	beforeLoad: ({ params }) => {
		throw redirect({ href: `/?template=${encodeURIComponent(params.id)}`, replace: true });
	},
});
