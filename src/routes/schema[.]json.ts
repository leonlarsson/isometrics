import { createFileRoute } from "@tanstack/react-router";

import { worldJsonSchema } from "#/parts/jsonSchema";

// The scene format as JSON Schema, with every part kind and its props, for editors, AI generation
// and data providers to target.
export const Route = createFileRoute("/schema.json")({
	server: {
		handlers: {
			GET: () =>
				Response.json(worldJsonSchema(), {
					headers: { "Cache-Control": "public, max-age=300" },
				}),
		},
	},
});
