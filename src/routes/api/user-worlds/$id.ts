import { createFileRoute } from "@tanstack/react-router";

import { deleteUserWorld, readUserWorld } from "#/server/userWorlds";

import { env } from "cloudflare:workers";

const HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
	"X-Content-Type-Options": "nosniff",
	// Shared worlds are public to whoever has the link, not to search engines.
	"X-Robots-Tag": "noindex, nofollow",
};

// A shared world as JSON (ADR-0120): GET it, or DELETE it with its key (Authorization: Bearer <key>).
export const Route = createFileRoute("/api/user-worlds/$id")({
	server: {
		handlers: {
			OPTIONS: () => new Response(null, { status: 204, headers: HEADERS }),
			GET: async ({ params }) => {
				const found = await readUserWorld(env.USER_WORLDS, params.id);
				if (!found) {
					return Response.json(
						{
							error:
								"No world here: it has expired or been deleted, or it was shared moments ago and hasn't reached this part of the world yet (that takes up to a minute).",
						},
						{ status: 404, headers: { ...HEADERS, "Cache-Control": "no-store" } },
					);
				}
				return new Response(found.json, {
					headers: {
						...HEADERS,
						"Content-Type": "application/json; charset=utf-8",
						// A snapshot never changes; a minute, so a deleted one doesn't linger.
						"Cache-Control": "public, max-age=60",
						...(found.metadata ? { "X-World-Expires": found.metadata.expiresAt } : {}),
					},
				});
			},
			DELETE: async ({ params, request }) => {
				const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
				const result = await deleteUserWorld(env.USER_WORLDS, params.id, key);
				const status = result === "deleted" ? 200 : result === "gone" ? 404 : 403;
				return Response.json({ result }, { status, headers: HEADERS });
			},
		},
	},
});
