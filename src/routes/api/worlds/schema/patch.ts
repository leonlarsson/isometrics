import { createFileRoute } from "@tanstack/react-router";

import { worldPatchJsonSchema } from "#/parts/jsonSchema";

// A world patch's format as JSON Schema: the changes to a world, shaped like it (ADR-0118).
export const Route = createFileRoute("/api/worlds/schema/patch")({
	server: {
		handlers: {
			GET: () =>
				Response.json(worldPatchJsonSchema(), {
					headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
				}),
		},
	},
});
