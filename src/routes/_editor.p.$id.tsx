import { createFileRoute } from "@tanstack/react-router";

// A prefab shared by link (ADR-0134): the editor reads it from this address and shows it as a
// preview (openLink), as a shared world's /w/<id> is, offering Add to My prefabs; the address
// goes back to / once anything else is open (ADR-0129).
export const Route = createFileRoute("/_editor/p/$id")({
	ssr: false,
});
