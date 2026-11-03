import { createFileRoute } from "@tanstack/react-router";

// The editor's own address: it opens the world that was open last, or the home screen.
export const Route = createFileRoute("/_editor/")({
	ssr: false,
});
