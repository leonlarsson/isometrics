import { createRouter as createTanStackRouter } from "@tanstack/react-router";
// Type-only: loads Start's route typings (e.g. `server.handlers` on file routes) for `tsc`.
import type {} from "@tanstack/react-start";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
