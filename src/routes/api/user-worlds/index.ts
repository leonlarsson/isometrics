import { createFileRoute } from "@tanstack/react-router";

import { textUpTo } from "#/lib/textUpTo";
import { rateLimitKeyOf } from "#/server/rateLimitKey";
import {
	MOST_SHARED_ITEMS,
	MOST_SHARED_WORLD_BYTES,
	MOST_TEXT_LENGTH,
	sizeInWords,
} from "#/server/shareLimits";
import { isSharingDisabled, SHARING_PAUSED } from "#/server/sharingControls";
import {
	DEFAULT_USER_WORLD_EXPIRY,
	MOST_USER_WORLD_BYTES,
	shareUserWorld,
	USER_WORLD_EXPIRIES,
	UserWorldError,
} from "#/server/userWorlds";

import { env } from "cloudflare:workers";

/**
 * Anyone may share, from any site or tool (an AI making requests from a page of its own too,
 * ADR-0120, so CORS stays open here); answers are JSON, never sniffed as anything else.
 */
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
		"Shares a world by link (ADR-0120): POST it (or a patch) as JSON. It's kept for ?expiresIn seconds and anyone with the link can open it until then. The answer has its kind (world or patch), its url (a world opens in the editor; a patch's is for pasting into Build with AI → Change this world, and isn't opened on its own), its jsonUrl (the JSON), when it expires, and a deleteKey to DELETE it early. It's checked first: a world must open exactly as written (no repairs), and a patch must be one (only the world's fields, lists changed by remove, change and add, values each field takes), at most an hour and 500 kB. Anything else is refused with 400 and its problems, where and what.",
	expiresIn: `One of ${USER_WORLD_EXPIRIES.join(", ")} seconds (an hour, a day, a week, 30 days); ${DEFAULT_USER_WORLD_EXPIRY} when left out.`,
	limit: `At most ${MOST_USER_WORLD_BYTES.toLocaleString("en")} bytes sent, and ${sizeInWords(MOST_SHARED_WORLD_BYTES)} as kept (defaults left out); no text over ${MOST_TEXT_LENGTH.toLocaleString("en")} characters, at most ${MOST_SHARED_ITEMS.entities.toLocaleString("en")} objects and ${MOST_SHARED_ITEMS.dataRows.toLocaleString("en")} data rows; a few shares a minute.`,
	public: "Anyone with the link can open what's shared here. Share nothing private.",
};

// Share a world: POST it as JSON, get back a public link that expires (ADR-0120). GET says how.
export const Route = createFileRoute("/api/user-worlds/")({
	server: {
		handlers: {
			GET: () => Response.json(HOW_TO, { headers: HEADERS }),
			OPTIONS: () => new Response(null, { status: 204, headers: HEADERS }),
			POST: async ({ request }) => {
				try {
					return await share(request);
				} catch (error) {
					// Logged in full for us; answered in our words, nothing of the server's insides.
					console.error("POST /api/user-worlds failed:", error);
					return problem("It couldn't be shared just now.", 500);
				}
			},
		},
	},
});

/** Share what was posted: limited per sender, refused when too big or not a world. */
const share = async (request: Request) => {
	// The kill switch (ADR-0145, docs/runbooks/takedown.md): nothing new is kept while it's on.
	if (isSharingDisabled(env.SHARING_DISABLED)) {
		return problem(SHARING_PAUSED, 503);
	}
	if (!env.USER_WORLDS) {
		console.error("POST /api/user-worlds: the USER_WORLDS KV binding is missing (wrangler.jsonc)");
		return problem("Sharing isn't set up on this site.", 503);
	}
	// The rate limit, where the binding is there (it may not be in every deployment): per IPv4
	// address, or per IPv6 /64 (ADR-0145).
	if (env.USER_WORLD_UPLOADS) {
		const key = rateLimitKeyOf(request.headers.get("cf-connecting-ip"));
		const { success } = await env.USER_WORLD_UPLOADS.limit({ key });
		if (!success) {
			return problem("Too many shares from here just now: try again in a minute.", 429);
		}
	} else {
		console.warn("POST /api/user-worlds: no USER_WORLD_UPLOADS rate limit binding; not limited");
	}
	const expiresIn = Number(
		new URL(request.url).searchParams.get("expiresIn") ?? DEFAULT_USER_WORLD_EXPIRY,
	);
	const text = await textUpTo(request, MOST_USER_WORLD_BYTES);
	if (text === null) {
		return problem(
			`It's more than ${MOST_USER_WORLD_BYTES.toLocaleString("en")} bytes, and at most ${sizeInWords(MOST_SHARED_WORLD_BYTES)} can be shared (defaults left out).`,
			413,
		);
	}
	try {
		const shared = await shareUserWorld(
			env.USER_WORLDS,
			text,
			expiresIn,
			new URL(request.url).origin,
		);
		return Response.json(shared, { status: 201, headers: HEADERS });
	} catch (error) {
		if (error instanceof UserWorldError) {
			return Response.json(
				{ error: error.message, ...(error.problems.length > 0 && { problems: error.problems }) },
				{ status: 400, headers: HEADERS },
			);
		}
		throw error;
	}
};
