import { createFileRoute } from "@tanstack/react-router";

import { guideAsMarkdown } from "#/guide/guide";

// The guide as Markdown, for AIs writing worlds (ADR-0116); the same text as /guide.
export const Route = createFileRoute("/guide.md")({
	server: {
		handlers: {
			GET: ({ request }) =>
				new Response(guideAsMarkdown(new URL(request.url).origin), {
					headers: {
						"Content-Type": "text/markdown; charset=utf-8",
						"Cache-Control": "public, max-age=300",
					},
				}),
		},
	},
});
