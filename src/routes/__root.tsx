import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { APP_NAME } from "#/lib/app";
import { ErrorScreen } from "#/ui/ErrorScreen";
import { NotFound } from "#/ui/NotFound";

import appCss from "../styles.css?url";

const DESCRIPTION =
	"Build animated 3D miniature worlds that show your data: low-poly buildings, roads, vehicles and live data cards.";

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
			{
				name: "description",
				content: DESCRIPTION,
			},
			// The light toolbar colour (--surface); useThemeAttribute keeps it in step with the theme.
			{
				name: "theme-color",
				content: "#f8f7f3",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				property: "og:title",
				content: APP_NAME,
			},
			{
				property: "og:description",
				content: DESCRIPTION,
			},
			{
				property: "og:image",
				content: "/og.png",
			},
			{
				property: "og:image:width",
				content: "1200",
			},
			{
				property: "og:image:height",
				content: "630",
			},
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			// Not public yet: keep search engines out. Remove (with the header below) at launch.
			{
				name: "robots",
				content: "noindex, nofollow",
			},
		],
		scripts: [
			// Zod checks without eval (ADR-0122): the Content Security Policy allows none, so in the
			// browser its eval-built checks could never run, and each try is logged as a violation.
			// Set before any module runs (Zod reads this when it loads), so it doesn't try at all.
			{
				children: "globalThis.__zod_globalConfig = { jitless: true };",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
		],
	}),
	headers: () => ({
		// Same as the robots meta tag, for crawlers that only read headers.
		"X-Robots-Tag": "noindex, nofollow",
		// Security (ADR-0119): no other site may frame the editor (clickjacking), no sniffing, little
		// referrer, and no camera, microphone or location. The Content Security Policy (scripts only
		// from this site or with the page's nonce, and more) is set per request with that nonce, in
		// router.tsx (ADR-0122).
		"X-Frame-Options": "DENY",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFound,
	errorComponent: ErrorScreen,
});

// Route files keep `Route` first; the hoisted function declaration makes that possible (ADR-0015).
function RootDocument({ children }: { children: ReactNode }) {
	return (
		// suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to these tags
		// before React hydrates. It only covers attributes on these two elements, not their children.
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>

			<body suppressHydrationWarning>
				{children}

				<Scripts />
			</body>
		</html>
	);
}
