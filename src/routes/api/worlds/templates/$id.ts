import { createFileRoute } from "@tanstack/react-router";

import { templateById } from "#/templates";

// One template as a complete world (ADR-0117), ready to open with File → Open file….
export const Route = createFileRoute("/api/worlds/templates/$id")({
	server: {
		handlers: {
			GET: ({ params }) => {
				// `lantern-bay` or `lantern-bay.json` (or `lantern_bay`, its id before hyphens, ADR-0126).
				const id = params.id.replace(/\.json$/, "");
				const template = templateById(id);
				const headers = { "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" };
				if (!template) {
					return Response.json(
						{ error: `No template "${id}": /api/worlds/templates lists them` },
						{ status: 404, headers },
					);
				}
				return Response.json(template.create(), {
					headers: {
						...headers,
						"Cache-Control": "public, max-age=300",
						"X-Content-Type-Options": "nosniff",
					},
				});
			},
		},
	},
});
