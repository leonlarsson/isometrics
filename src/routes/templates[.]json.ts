import { createFileRoute } from "@tanstack/react-router";

import { TEMPLATES } from "#/templates";

// The templates, complete worlds for people and AIs writing worlds against /schema.json (ADR-0083).
export const Route = createFileRoute("/templates.json")({
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
							url: `/templates/${id}.json`,
						})),
					},
					{ headers: { "Cache-Control": "public, max-age=300" } },
				),
		},
	},
});
