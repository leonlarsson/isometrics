// The Cloudflare bindings the server uses (wrangler.jsonc), as much of them as it uses: declared
// here rather than with `wrangler types`, whose runtime types clash with the browser's.
declare module "cloudflare:workers" {
	export const env: {
		/** Worlds shared by link (ADR-0120). */
		USER_WORLDS: import("#/server/userWorlds").IUserWorldStore;
		/** At most so many shares a minute from one address. */
		USER_WORLD_UPLOADS: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
	};
}
