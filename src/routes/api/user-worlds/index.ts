import { createFileRoute } from "@tanstack/react-router";

import { textUpTo } from "#/lib/textUpTo";
import {
	DEFAULT_USER_WORLD_EXPIRY,
	MOST_USER_WORLD_BYTES,
	shareUserWorld,
	USER_WORLD_EXPIRIES,
	UserWorldError,
} from "#/server/userWorlds";

import { env } from "cloudflare:workers";

/** Anyone may share, from any site or tool; answers are JSON, never sniffed as anything else. */
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
		"Shares a world by link (ADR-0120): POST it (or a patch) as JSON. It's kept for ?expiresIn seconds and anyone with the link can open it until then. The answer has its kind (world or patch), its url (a world opens in the editor; a patch's is for pasting into Build with your AI → Change this world, and isn't opened on its own), its jsonUrl (the JSON), when it expires, and a deleteKey to DELETE it early.",
	expiresIn: `One of ${USER_WORLD_EXPIRIES.join(", ")} seconds (an hour, a day, a week, 30 days); ${DEFAULT_USER_WORLD_EXPIRY} when left out.`,
	limit: `At most ${MOST_USER_WORLD_BYTES.toLocaleString("en")} bytes, and a few shares a minute.`,
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

/** Share what was posted: limited per address, refused when too big or not a world. */
const share = async (request: Request) => {
	if (!env.USER_WORLDS) {
		console.error("POST /api/user-worlds: the USER_WORLDS KV binding is missing (wrangler.jsonc)");
		return problem("Sharing isn't set up on this site.", 503);
	}
	const sender = request.headers.get("cf-connecting-ip") ?? "unknown";
	// The rate limit, where the binding is there (it may not be in every deployment, e.g. previews).
	if (env.USER_WORLD_UPLOADS) {
		const { success } = await env.USER_WORLD_UPLOADS.limit({ key: sender });
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
		return problem(`It's more than ${MOST_USER_WORLD_BYTES.toLocaleString("en")} bytes.`, 413);
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
			return problem(error.message, 400);
		}
		throw error;
	}
};
