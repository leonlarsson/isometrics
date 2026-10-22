import { createFileRoute } from "@tanstack/react-router";

import { sceneJsonSchema } from "#/scene/jsonSchema";

// The scene format as JSON Schema, for editors, AI generation and data providers to target.
export const Route = createFileRoute("/schema.json")({
	server: {
		handlers: {
			GET: () =>
				Response.json(sceneJsonSchema(), {
					headers: { "Cache-Control": "public, max-age=300" },
				}),
		},
	},
});
