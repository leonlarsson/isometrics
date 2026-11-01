import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import {
	contentSecurityPolicy,
	DEVELOPMENT_POLICY,
	makeNonce,
} from "#/server/contentSecurityPolicy";

import { routeTree } from "./routeTree.gen";

/**
 * This page's nonce, on the server (ADR-0122): a fresh one per request, sent in its Content
 * Security Policy, and given to the router, which puts it on the inline scripts it writes. In
 * development only the policy's parts that don't touch scripts (Vite's own inline scripts for hot
 * reload carry no nonce); in the browser nothing needs one.
 */
const pageNonce = createIsomorphicFn()
	.server(() => {
		if (!import.meta.env.PROD) {
			setResponseHeader("Content-Security-Policy", DEVELOPMENT_POLICY);
			return undefined;
		}
		const nonce = makeNonce();
		setResponseHeader("Content-Security-Policy", contentSecurityPolicy(nonce));
		return nonce;
	})
	.client(() => undefined);

export const getRouter = () => {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		ssr: { nonce: pageNonce() },
	});

	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
