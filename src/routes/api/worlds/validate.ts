import { createFileRoute } from "@tanstack/react-router";

import { textUpTo } from "#/lib/textUpTo";
import { repairWorld } from "#/parts/repairWorld";
import { validatePatch, validateWorld } from "#/parts/validateWorld";
import { UnsafeJsonError } from "#/scene/safeJson";
import { isWorldPatch } from "#/scene/worldPatch";

/** Bigger bodies are turned away: no world needs this much (ADR-0119). */
const MOST_BYTES = 5_000_000;

/**
 * Anyone may ask, from any site or tool (it reads nothing and keeps nothing);
 * answers are JSON, never sniffed as anything else.
 */
const HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"X-Content-Type-Options": "nosniff",
};

const HOW_TO = {
	about:
		"Checks a world (ADR-0117): POST it as JSON. The answer says whether it opens as written (isValid), its problems (what opening it would repair or leave out) and warnings (what opens but won't look as meant), each with where in the world.",
	example: "curl -X POST -H 'Content-Type: application/json' --data @world.json <this address>",
	patch:
		'To check a patch (ADR-0118), POST { "world": <the world it changes>, "patch": <the patch> }: the answer also says what the patch changes (changes), and its own problems start with "patch".',
	limit: `At most ${MOST_BYTES.toLocaleString("en")} bytes.`,
	format: "/api/worlds/schema",
	guide: "/guide.md",
};

/** A check that couldn't start: the body isn't a world, a patch or JSON at all. */
const unreadable = (where: string, what: string, status = 400) =>
	Response.json(
		{ isValid: false, isUnreadable: true, problems: [{ where, what }], warnings: [] },
		{ status, headers: HEADERS },
	);

/** What a parsed body checks out as: a world, or a patch with the world it changes. */
const check = (input: unknown) => {
	// A patch with the world it changes (ADR-0118).
	if (
		typeof input === "object" &&
		input !== null &&
		"patch" in input &&
		"world" in input &&
		isWorldPatch(input.patch)
	) {
		const world = validateWorld(input.world);
		if (world.isUnreadable) {
			return Response.json(world, { headers: HEADERS });
		}
		return Response.json(validatePatch(repairWorld(input.world).scene, input.patch), {
			headers: HEADERS,
		});
	}
	if (isWorldPatch(input)) {
		return unreadable(
			"(the patch)",
			'a patch is checked with the world it changes: POST { "world": ..., "patch": ... }',
		);
	}
	return Response.json(validateWorld(input), { headers: HEADERS });
};

// Check a world: POST it as JSON, get back what's wrong and where. GET says how (ADR-0117).
export const Route = createFileRoute("/api/worlds/validate")({
	server: {
		handlers: {
			GET: () => Response.json(HOW_TO, { headers: HEADERS }),
			OPTIONS: () => new Response(null, { status: 204, headers: HEADERS }),
			POST: async ({ request }) => {
				const text = await textUpTo(request, MOST_BYTES);
				if (text === null) {
					return unreadable(
						"(the body)",
						`it's more than ${MOST_BYTES.toLocaleString("en")} bytes`,
						413,
					);
				}
				let input: unknown;
				try {
					input = JSON.parse(text);
				} catch (error) {
					return unreadable(
						"(the world)",
						`isn't JSON: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
				// Whatever goes wrong in checking (nesting too deep, anything unforeseen) is an answer, not a crash.
				try {
					return check(input);
				} catch (error) {
					// Our own words for what we foresaw; nothing of the server's insides otherwise.
					return unreadable(
						"(the world)",
						error instanceof UnsafeJsonError ? error.message : "it couldn't be checked",
					);
				}
			},
		},
	},
});
