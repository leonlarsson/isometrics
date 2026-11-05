/**
 * The product name: the single source of truth in runtime code. Import it
 * instead of writing the name as a literal; derive variants from it, e.g.
 * `APP_NAME.toLowerCase()` for storage keys.
 * (package.json, wrangler.jsonc and the docs can't import, so they repeat it.)
 */
export const APP_NAME = "Isometrics";

/** Where the app's code is kept, for the app menu's Star it on GitHub. */
export const SOURCE_URL = "https://github.com/leonlarsson/isometrics";

/**
 * Where the app is published: link previews need absolute addresses (`og:image`), and only this
 * host is open to search engines (`server/robots.ts`); previews and other addresses aren't.
 */
export const SITE_URL = "https://isometrics.leonlarsson.com";
