// The Cloudflare bindings the server uses (wrangler.jsonc), as much of them as it uses: declared
// here rather than with `wrangler types`, whose runtime types clash with the browser's.
declare module "cloudflare:workers" {
	/** A Workers rate limit: at most so many calls a minute for one key. */
	interface IRateLimit {
		limit: (options: { key: string }) => Promise<{ success: boolean }>;
	}
	export const env: {
		/** Worlds shared by link (ADR-0120); missing where a deployment lacks the binding. */
		USER_WORLDS?: import("#/server/userWorlds").IUserWorldStore;
		/** At most so many shares a minute from one sender (ADR-0145); not in every deployment. */
		USER_WORLD_UPLOADS?: IRateLimit;
		/** Prefabs shared by link (ADR-0134); missing where a deployment lacks the binding. */
		USER_PREFABS?: import("#/server/userPrefabs").IUserPrefabStore;
		/** At most so many prefab shares a minute from one sender; not in every deployment. */
		USER_PREFAB_UPLOADS?: IRateLimit;
		/** At most so many checks a minute from one sender (POST /api/worlds/validate). */
		WORLD_VALIDATIONS?: IRateLimit;
		/** A var: "true" pauses sharing (POST answers 503), ADR-0145; "false" or missing, not. */
		SHARING_DISABLED?: string | boolean;
		/**
		 * A secret (`wrangler secret put ADMIN_DELETE_TOKEN`, never in the repo): taken in place of
		 * a share's delete key, to take anything down (docs/runbooks/takedown.md). Missing, no
		 * share can be deleted without its own key.
		 */
		ADMIN_DELETE_TOKEN?: string;
	};
}
