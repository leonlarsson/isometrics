import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { APP_NAME } from "#/lib/app";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: APP_NAME,
			},
			// Not public yet: keep search engines out. Remove (with the header below) at launch.
			{
				name: "robots",
				content: "noindex, nofollow",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	// Same as the robots meta tag, for crawlers that only read headers.
	headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
	shellComponent: RootDocument,
});

// Route files keep `Route` first; the hoisted function declaration makes that possible (ADR-0015).
function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>

			<body>
				{children}

				<Scripts />
			</body>
		</html>
	);
}
