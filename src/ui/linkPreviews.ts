import { APP_NAME, SITE_URL } from "#/lib/app";
import { starterPreviewOf, templateEntryById } from "#/templates/catalogue";

/**
 * What a page's link shows when it's pasted somewhere (a chat, a forum): its
 * title, a line about it and, for a starter, its picture (ADR-0146). Each
 * page's `head` adds these over the root's; a meta tag of the same name or
 * property replaces the root's. Kept light (no worlds, no editor), as the
 * routes that use it load on every page.
 */

interface ILinkPreview {
	title: string;
	description: string;
	/** A picture on this site (`/starters/…`), made absolute: most previews ignore a relative one. */
	image?: { path: string; alt: string; width: number; height: number };
}

const metaOf = ({ title, description, image }: ILinkPreview) => [
	{ title },
	{ name: "description", content: description },
	{ property: "og:title", content: title },
	{ property: "og:description", content: description },
	...(image
		? [
				{ property: "og:image", content: `${SITE_URL}${image.path}` },
				{ property: "og:image:alt", content: image.alt },
				{ property: "og:image:width", content: String(image.width) },
				{ property: "og:image:height", content: String(image.height) },
				{ name: "twitter:image", content: `${SITE_URL}${image.path}` },
			]
		: []),
];

/** A starter's address (/templates/<id>): its name, what it's about and its picture; nothing for an unknown id. */
export const templateLinkPreview = (id: string) => {
	const entry = templateEntryById(id);
	const path = starterPreviewOf(id);
	if (!entry || !path) {
		return [];
	}
	return metaOf({
		title: `${entry.name} · ${APP_NAME}`,
		description: entry.description,
		image: {
			path,
			alt: `${entry.name}, a starter world in ${APP_NAME}, seen from above`,
			width: 1200,
			height: 630,
		},
	});
};

/**
 * A world or prefab shared by link (/w/<id>, /p/<id>): always the same words, never the sharer's
 * title or text. Those are anyone's to write, and a preview in their words could pass for ours.
 */
export const SHARED_WORLD_LINK_PREVIEW = metaOf({
	title: `A world shared on ${APP_NAME}`,
	description: `A small animated 3D world, made with ${APP_NAME}. Open it to look around, and keep a copy to change it.`,
});

export const SHARED_PREFAB_LINK_PREVIEW = metaOf({
	title: `A prefab shared on ${APP_NAME}`,
	description: `A piece for a 3D world, made with ${APP_NAME}. Open it to look at it, and add it to My prefabs to place it in your own worlds.`,
});

/**
 * The editor's addresses' previews, by the route a page's address matched and its params: a
 * starter's, a shared world's or prefab's, or the root's for the editor itself. Worked out in the
 * editor's own route (`_editor`): the server leaves the routes inside one that isn't rendered
 * there unloaded, so their own `head` would never reach a page's HTML, where previews read it.
 */
export const editorLinkPreview = (routeId: string | undefined, params: { id?: string }) => {
	switch (routeId) {
		case "/_editor/templates/$id":
			return templateLinkPreview(params.id ?? "");
		case "/_editor/w/$id":
			return SHARED_WORLD_LINK_PREVIEW;
		case "/_editor/p/$id":
			return SHARED_PREFAB_LINK_PREVIEW;
		default:
			return [];
	}
};

export const PARTS_LINK_PREVIEW = metaOf({
	title: `Parts · ${APP_NAME}`,
	description:
		"Every part you can add to a world: buildings, vehicles, trees, street furniture and shapes, each turning, in each theme by day and at night, with its settings, colours and lights.",
});

export const GUIDE_LINK_PREVIEW = metaOf({
	title: `Guide · ${APP_NAME}`,
	description:
		"How a world is made, by hand or from your data, walked through with a real API: for people, and for the AI that builds one for you.",
});
