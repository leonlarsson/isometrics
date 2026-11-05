import { createFileRoute } from "@tanstack/react-router";

import { textUpTo } from "#/lib/textUpTo";
import { rateLimitKeyOf } from "#/server/rateLimitKey";
import { MOST_SHARED_PREFAB_BYTES, sizeInWords } from "#/server/shareLimits";
import { isSharingDisabled, SHARING_PAUSED } from "#/server/sharingControls";
import {
	DEFAULT_USER_PREFAB_EXPIRY,
	MOST_USER_PREFAB_BYTES,
	shareUserPrefab,
	USER_PREFAB_EXPIRIES,
	UserPrefabError,
} from "#/server/userPrefabs";

import { env } from "cloudflare:workers";

/** Anyone may share, from any site or tool (as worlds); answers are JSON, never sniffed as anything else. */
const HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"X-Content-Type-Options": "nosniff",
};

const problem = (what: string, status: number) =>
	Response.json({ error: what }, { status, headers: HEADERS });

const HOW_TO = {
	about:
		"Shares a prefab by link (ADR-0134): POST it as JSON, shaped as one of a world's prefabs (/api/worlds/schema). It's kept for ?expiresIn seconds and anyone with the link can open it and add it to their own prefabs until then. The answer has its url (/p/<id>, which opens it in the editor), its jsonUrl, when it expires, and a deleteKey to DELETE it early. It must read exactly as written; anything else is refused with 400.",
	expiresIn: `One of ${USER_PREFAB_EXPIRIES.join(", ")} seconds (an hour, a day, a week, 30 days); ${DEFAULT_USER_PREFAB_EXPIRY} when left out.`,
	limit: `At most ${MOST_USER_PREFAB_BYTES.toLocaleString("en")} bytes sent, and ${sizeInWords(MOST_SHARED_PREFAB_BYTES)} as kept, and a few shares a minute.`,
	public: "Anyone with the link can open what's shared here. Share nothing private.",
};

// Share a prefab: POST it as JSON, get back a public link that expires (ADR-0134). GET says how.
export const Route = createFileRoute("/api/user-prefabs/")({
	server: {
		handlers: {
			GET: () => Response.json(HOW_TO, { headers: HEADERS }),
			OPTIONS: () => new Response(null, { status: 204, headers: HEADERS }),
			POST: async ({ request }) => {
				try {
					return await share(request);
				} catch (error) {
					// Logged in full for us; answered in our words, nothing of the server's insides.
					console.error("POST /api/user-prefabs failed:", error);
					return problem("It couldn't be shared just now.", 500);
				}
			},
		},
	},
});

/** Share what was posted: limited per sender, refused when too big or not a prefab. */
const share = async (request: Request) => {
	// The kill switch (ADR-0145): nothing new is kept while it's on.
	if (isSharingDisabled(env.SHARING_DISABLED)) {
		return problem(SHARING_PAUSED, 503);
	}
	if (!env.USER_PREFABS) {
		console.error(
			"POST /api/user-prefabs: the USER_PREFABS KV binding is missing (wrangler.jsonc)",
		);
		return problem("Sharing prefabs isn't set up on this site.", 503);
	}
	// The rate limit, where the binding is there (it may not be in every deployment): per IPv4
	// address, or per IPv6 /64 (ADR-0145).
	if (env.USER_PREFAB_UPLOADS) {
		const key = rateLimitKeyOf(request.headers.get("cf-connecting-ip"));
		const { success } = await env.USER_PREFAB_UPLOADS.limit({ key });
		if (!success) {
			return problem("Too many shares from here just now: try again in a minute.", 429);
		}
	} else {
		console.warn("POST /api/user-prefabs: no USER_PREFAB_UPLOADS rate limit binding; not limited");
	}
	const expiresIn = Number(
		new URL(request.url).searchParams.get("expiresIn") ?? DEFAULT_USER_PREFAB_EXPIRY,
	);
	const text = await textUpTo(request, MOST_USER_PREFAB_BYTES);
	if (text === null) {
		return problem(`It's more than ${MOST_USER_PREFAB_BYTES.toLocaleString("en")} bytes.`, 413);
	}
	try {
		const shared = await shareUserPrefab(
			env.USER_PREFABS,
			text,
			expiresIn,
			new URL(request.url).origin,
		);
		return Response.json(shared, { status: 201, headers: HEADERS });
	} catch (error) {
		if (error instanceof UserPrefabError) {
			return problem(error.message, 400);
		}
		throw error;
	}
};
