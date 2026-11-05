import { SITE_URL } from "#/lib/app";

/** Pages of other people's content: worlds and prefabs shared by link (ADR-0120, ADR-0134). */
const SHARED_PATHS = ["/w/", "/p/"];

/**
 * What a page tells search engines (its `X-Robots-Tag`), or null to let them index it: only the
 * published site's own pages are open. Previews and other addresses would compete with it, and a
 * page of what someone shared by link is theirs, not the site's, so it's never offered to search
 * engines (nobody can use a share link to get spam indexed under this domain).
 */
export const robotsTagFor = (url: URL): string | null => {
	const isPublishedSite = url.host === new URL(SITE_URL).host;
	const isShared = SHARED_PATHS.some((path) => url.pathname.startsWith(path));
	return isPublishedSite && !isShared ? null : "noindex, nofollow";
};
