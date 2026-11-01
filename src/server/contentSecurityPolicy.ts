/**
 * The editor's Content Security Policy (ADR-0119, ADR-0122): what a page may
 * load and run, so that if anything ever slipped untrusted text into the page
 * (a world's text, a pasted answer, a shared link), the browser still refuses
 * to run it as a script. No React; the router sets it per request.
 *
 * - Scripts: only this site's own files, plus the inline scripts the
 *   framework writes into each page, which carry this request's nonce, and
 *   scripts the page made itself as blobs (the 3D text's layout worker loads
 *   its functions that way; a blob can only come from script already running
 *   here, so nothing from outside gets in by it). No inline script without
 *   the nonce runs, nor eval.
 * - Workers: this site's, and those made in the page from blobs (the 3D text's
 *   layout worker builds itself that way).
 * - Styles: this site's files, and inline styles (React's `style` props and
 *   the canvas's sizing write them); styles can't run code.
 * - Images: this site's, and pictures made in the page (part and world
 *   pictures are data URLs; a rendered picture is a blob).
 * - Connections: this site, and any web address, as worlds read links and
 *   APIs from anywhere by design; what's read is gated in the app instead
 *   (readLink and the addresses this browser allowed). The 3D text's fonts
 *   come from cdn.jsdelivr.net this way too.
 * - Nothing may frame the editor, no plugins, no changing the page's base
 *   address or where forms post.
 */
export const contentSecurityPolicy = (nonce: string) =>
	[
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' blob:`,
		"worker-src 'self' blob:",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		"connect-src 'self' https: http: data: blob:",
		"frame-ancestors 'none'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	].join("; ");

/**
 * In development, only what doesn't touch scripts and styles: Vite's dev server writes inline
 * scripts of its own (hot reload) that carry no nonce. The full policy is for production builds.
 */
export const DEVELOPMENT_POLICY =
	"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

/** A fresh nonce for one page: 16 random bytes, base64. */
export const makeNonce = () => {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
};
