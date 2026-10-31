import { createFileRoute } from "@tanstack/react-router";

import { checkWorld } from "#/parts/checkWorld";

/** Bigger bodies are turned away: no world needs this much. */
const MOST_BYTES = 5_000_000;

/** Anyone may ask, from any site or tool (it reads nothing and keeps nothing). */
const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

const HOW_TO = {
	about:
		"Checks a world (ADR-0117): POST it as JSON. The answer says whether it opens as written (isValid), its problems (what opening it would repair or leave out) and warnings (what opens but won't look as meant), each with where in the world.",
	example: "curl -X POST -H 'Content-Type: application/json' --data @world.json <this address>",
	format: "/api/worlds/schema",
	guide: "/guide.md",
};

// Check a world: POST it as JSON, get back what's wrong and where. GET says how (ADR-0117).
export const Route = createFileRoute("/api/worlds/validate")({
	server: {
		handlers: {
			GET: () => Response.json(HOW_TO, { headers: CORS }),
			OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
			POST: async ({ request }) => {
				const text = await request.text();
				if (text.length > MOST_BYTES) {
					return Response.json(
						{ error: `Too big: at most ${MOST_BYTES.toLocaleString("en")} bytes` },
						{ status: 413, headers: CORS },
					);
				}
				let input: unknown;
				try {
					input = JSON.parse(text);
				} catch (error) {
					return Response.json(
						{
							isValid: false,
							isUnreadable: true,
							problems: [
								{
									where: "(the world)",
									what: `isn't JSON: ${error instanceof Error ? error.message : String(error)}`,
								},
							],
							warnings: [],
						},
						{ status: 400, headers: CORS },
					);
				}
				return Response.json(checkWorld(input), { headers: CORS });
			},
		},
	},
});
