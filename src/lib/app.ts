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
 * Where a shared world or prefab is reported (ADR-0145): Report, in a shared
 * link's preview bar, opens an email to it with the link and its id.
 *
 * TODO(owner): a placeholder (`.invalid` is a domain that can never exist):
 * put the address that reads reports here before launch.
 */
export const ABUSE_CONTACT = "abuse-contact-not-set@example.invalid";
