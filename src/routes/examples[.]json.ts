import { createFileRoute } from "@tanstack/react-router";

import { TEMPLATES } from "#/templates";

// The templates as example worlds, for people and AIs writing worlds against /schema.json.
export const Route = createFileRoute("/examples.json")({
	server: {
		handlers: {
			GET: () =>
				Response.json(
					{
						examples: TEMPLATES.map(({ id, name, description }) => ({
							id,
							name,
							description,
							url: `/examples/${id}.json`,
						})),
					},
					{ headers: { "Cache-Control": "public, max-age=300" } },
				),
		},
	},
});
