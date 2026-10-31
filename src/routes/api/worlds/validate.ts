import { createFileRoute } from "@tanstack/react-router";

import { checkPatch, checkWorld } from "#/parts/checkWorld";
import { readWorld } from "#/parts/readWorld";
import { isWorldPatch } from "#/scene/worldPatch";

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
	patch:
		'To check a patch (ADR-0118), POST { "world": <the world it changes>, "patch": <the patch> }: the answer also says what the patch changes (changes), and its own problems start with "patch".',
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
				// A patch with the world it changes (ADR-0118).
				if (
					typeof input === "object" &&
					input !== null &&
					"patch" in input &&
					"world" in input &&
					isWorldPatch(input.patch)
				) {
					const world = checkWorld(input.world);
					if (world.isUnreadable) {
						return Response.json(world, { headers: CORS });
					}
					return Response.json(checkPatch(readWorld(input.world).scene, input.patch), {
						headers: CORS,
					});
				}
				if (isWorldPatch(input)) {
					return Response.json(
						{
							isValid: false,
							isUnreadable: true,
							problems: [
								{
									where: "(the patch)",
									what: 'a patch is checked with the world it changes: POST { "world": ..., "patch": ... }',
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
