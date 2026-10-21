/**
 * The product name: the single source of truth in runtime code. Import it
 * instead of writing the name as a literal; derive variants from it, e.g.
 * `APP_NAME.toLowerCase()` for storage keys.
 * (package.json, wrangler.jsonc and the docs can't import, so they repeat it.)
 */
export const APP_NAME = "Isometrics";
