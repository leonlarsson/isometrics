import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "#/ui/AppShell";

// The editor is WebGL + localStorage only, so skip server rendering for it.
export const Route = createFileRoute("/")({ ssr: false, component: AppShell });
