import { createFileRoute } from "@tanstack/react-router";

// A template by its id (/templates/lantern-bay): the editor reads it from this address and opens it
// as a preview (openLink); the address goes back to / once anything else is open (ADR-0129).
export const Route = createFileRoute("/_editor/templates/$id")({
	ssr: false,
});
