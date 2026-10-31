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
		"Shares a world by link (ADR-0120): POST it (or a patch) as JSON. It's kept for ?expiresIn seconds and anyone with the link can open it until then. The answer has its url (opens it in the editor), its jsonUrl (the world as JSON), when it expires, and a deleteKey to DELETE it early.",
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
				const sender = request.headers.get("cf-connecting-ip") ?? "unknown";
				const { success } = await env.USER_WORLD_UPLOADS.limit({ key: sender });
				if (!success) {
					return problem("Too many shares from here just now: try again in a minute.", 429);
				}
				const expiresIn = Number(
					new URL(request.url).searchParams.get("expiresIn") ?? DEFAULT_USER_WORLD_EXPIRY,
				);
				const text = await textUpTo(request, MOST_USER_WORLD_BYTES);
				if (text === null) {
					return problem(
						`It's more than ${MOST_USER_WORLD_BYTES.toLocaleString("en")} bytes.`,
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
					// Our own words for what we foresaw; nothing of the server's insides otherwise.
					return error instanceof UserWorldError
						? problem(error.message, 400)
						: problem("It couldn't be shared just now.", 500);
				}
			},
		},
	},
});
