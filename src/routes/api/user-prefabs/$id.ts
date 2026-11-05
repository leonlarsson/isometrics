import { createFileRoute } from "@tanstack/react-router";

import { deleteUserPrefab, readUserPrefab } from "#/server/userPrefabs";

import { env } from "cloudflare:workers";

/**
 * No CORS here (ADR-0145): the app reads shared prefabs from its own site, and tools read them as
 * any page is read, so no other site's page needs to read what strangers share.
 */
const HEADERS = {
	"X-Content-Type-Options": "nosniff",
	// Shared prefabs are public to whoever has the link, not to search engines.
	"X-Robots-Tag": "noindex, nofollow",
};

/** Without its KV binding (wrangler.jsonc), there's nothing to read or delete. */
const notSetUp = () => {
	console.error("/api/user-prefabs/<id>: the USER_PREFABS KV binding is missing (wrangler.jsonc)");
	return Response.json(
		{ error: "Sharing prefabs isn't set up on this site." },
		{ status: 503, headers: HEADERS },
	);
};

// A shared prefab as JSON (ADR-0134): GET it, or DELETE it with its key (Authorization: Bearer <key>),
// or with the admin token (ADR-0145, docs/runbooks/takedown.md).
export const Route = createFileRoute("/api/user-prefabs/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				if (!env.USER_PREFABS) {
					return notSetUp();
				}
				const found = await readUserPrefab(env.USER_PREFABS, params.id);
				if (!found) {
					return Response.json(
						{
							error:
								"No prefab here: it has expired or been deleted, or it was shared moments ago and hasn't reached this part of the world yet (that takes up to a minute).",
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
						...(found.metadata ? { "X-Prefab-Expires": found.metadata.expiresAt } : {}),
					},
				});
			},
			DELETE: async ({ params, request }) => {
				if (!env.USER_PREFABS) {
					return notSetUp();
				}
				const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
				const result = await deleteUserPrefab(
					env.USER_PREFABS,
					params.id,
					key,
					env.ADMIN_DELETE_TOKEN,
				);
				const status = result === "deleted" ? 200 : result === "gone" ? 404 : 403;
				return Response.json({ result }, { status, headers: HEADERS });
			},
		},
	},
});
