import { createFileRoute } from "@tanstack/react-router";

import { TEMPLATES } from "#/templates";

// The templates, listed (ADR-0117): complete worlds for people and AIs to learn from or start with,
// each at its `url`. They follow /schema.json.
export const Route = createFileRoute("/api/worlds/templates/")({
	server: {
		handlers: {
			GET: () =>
				Response.json(
					{
						templates: TEMPLATES.map(({ id, name, description, category }) => ({
							id,
							name,
							description,
							category,
							url: `/api/worlds/templates/${id}`,
						})),
					},
					{
						headers: {
							"Cache-Control": "public, max-age=300",
							"Access-Control-Allow-Origin": "*",
						},
					},
				),
		},
	},
});
