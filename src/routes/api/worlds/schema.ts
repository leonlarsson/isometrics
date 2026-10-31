import { createFileRoute } from "@tanstack/react-router";

import { worldJsonSchema } from "#/parts/jsonSchema";

// The world format as JSON Schema, with every part kind and its props, for editors, AI generation
// and data providers to target (ADR-0032, ADR-0117).
export const Route = createFileRoute("/api/worlds/schema")({
	server: {
		handlers: {
			GET: () =>
				Response.json(worldJsonSchema(), {
					headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
				}),
		},
	},
});
