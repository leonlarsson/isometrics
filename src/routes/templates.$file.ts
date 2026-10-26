import { createFileRoute } from "@tanstack/react-router";

import { TEMPLATES } from "#/templates";

// One template as a complete world file (/examples/brightwater.json), ready to open with File → Open.
export const Route = createFileRoute("/examples/$file")({
	server: {
		handlers: {
			GET: ({ params }) => {
				const template = TEMPLATES.find((t) => `${t.id}.json` === params.file);
				if (!template) {
					return Response.json({ error: "No such example" }, { status: 404 });
				}
				return Response.json(template.create(), {
					headers: { "Cache-Control": "public, max-age=300" },
				});
			},
		},
	},
});
