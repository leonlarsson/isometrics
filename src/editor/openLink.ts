import { measurePrefab, prefabName } from "#/parts/prefabParts";
import { repairWorld } from "#/parts/repairWorld";
import { SCENE_VERSION, SceneSchema, type TPrefab, type TScene } from "#/scene/schema";
import { isWorldPatch } from "#/scene/worldPatch";
import { templateById } from "#/templates";

import { allowLink } from "./linkTrust";
import { markAddressesAsked, outsideAddressesOf } from "./sourceRefresh";
import { useEditor } from "./store";
import { fetchSharedPrefab } from "./userPrefabs";
import { fetchSharedWorld, ShareError } from "./userWorlds";
import type { ILinkAsked } from "./whatIsOpen";

/**
 * Opening a world from a link (ADR-0121, ADR-0129): `/w/<id>` (a shared world)
 * and `/templates/<id>` are the editor itself, which reads the link from its
 * address and loads nothing else. The world is
 * fetched (waiting out the minute a new link can take to arrive) and read; a
 * shared world that reads from addresses this browser hasn't allowed waits
 * for an answer before it's built (Open and allow, Open, Don't open it). It
 * opens as a preview in View mode: nothing is kept in this browser until
 * Edit (or Keep a copy) keeps it. The address stays the link while the
 * preview is open, so a reload opens it again; it goes back to `/`, in place,
 * once the preview does.
 */

/** Why a link to a patch isn't opened. */
export const PATCH_LINK =
	"It holds changes to a world (a patch), not a world, so there's nothing to open on its own. Links like this are for handing changes back from an AI: open the world they're for, then paste the link into Build with AI → Change this world.";

const SHARED_ID = /^[A-Za-z0-9_-]{22}$/;

/** The link a page's address is, if it's one: `/w/<id>` or `/templates/<id>`. */
export const linkInAddress = (pathname = window.location.pathname): ILinkAsked | null => {
	const [, from, encoded, ...rest] = pathname.split("/");
	if (rest.some(Boolean) || !encoded || (from !== "w" && from !== "templates" && from !== "p")) {
		return null;
	}
	// Any id is read, one that names nothing too (an old `lantern_bay`): opening it says so.
	let id = encoded;
	try {
		id = decodeURIComponent(encoded);
	} catch {
		// Not percent-encoding after all: read as it is.
	}
	return { from: from === "w" ? "shared" : from === "p" ? "prefab" : "template", id };
};

/**
 * A shared prefab to look at before it's added to My prefabs (ADR-0134): one copy of it in the
 * middle of a small world of its own, named after it.
 */
export const worldShowingPrefab = (prefab: TPrefab): TScene => {
	const { footprint } = measurePrefab(prefab);
	const side = (size: number) => Math.min(500, Math.max(16, 2 * Math.ceil((size + 8) / 2)));
	return SceneSchema.parse({
		version: SCENE_VERSION,
		meta: { title: prefabName(prefab), subtitle: "A prefab shared by link" },
		ground: { width: side(footprint[0]), depth: side(footprint[1]) },
		prefabs: [prefab],
		entities: [{ id: "shared_prefab", kind: prefab.id }],
	});
};

/**
 * The editor's own address, `/`, once what's open isn't the link: in place. The router sees it,
 * and the editor carries on as it is: its route is the one around `/` and the links (ADR-0129).
 */
const leaveLinkAddress = () => {
	if (linkInAddress()) {
		window.history.replaceState(window.history.state, "", "/");
	}
};

/** Nothing more to open: the home screen says why. */
const failed = (link: ILinkAsked, message: string) =>
	useEditor.getState().setWhatIsOpen({
		kind: "home",
		why: { kind: "linkFailed", from: link.from, message },
	});

/** Build the world from the link, as a preview; `addresses`: the outside ones already asked about. */
const openAsPreview = (
	link: ILinkAsked,
	scene: TScene,
	expiresAt: string | null,
	addresses: readonly string[],
) => {
	const { loadScene, showOpeningView } = useEditor.getState();
	loadScene(scene, { preview: { from: link.from, id: link.id, expiresAt } });
	showOpeningView(null);
	// Asked about before it was built: the usual question about outside addresses isn't asked again.
	markAddressesAsked(addresses);
};

/** Fetch and read the world a link names. Throws a `ShareError` saying why it can't. */
const fetchLinked = async (
	link: ILinkAsked,
): Promise<{ scene: TScene; expiresAt: string | null }> => {
	if (link.from === "shared" && !SHARED_ID.test(link.id)) {
		throw new ShareError("It isn't a link to a world shared from this site.");
	}
	if (link.from === "template") {
		const template = templateById(link.id);
		if (!template) {
			throw new ShareError(`There's no template called “${link.id}”.`);
		}
		return { scene: template.create(), expiresAt: null };
	}
	if (link.from === "prefab") {
		if (!SHARED_ID.test(link.id)) {
			throw new ShareError("It isn't a link to a prefab shared from this site.");
		}
		const { prefab, expiresAt } = await fetchSharedPrefab(link.id, {
			onWaiting: (tries, secondsLeft) =>
				useEditor.getState().setWhatIsOpen({
					kind: "link",
					link,
					step: { kind: "fetching", waited: { tries, secondsLeft } },
				}),
		});
		return { scene: worldShowingPrefab(prefab), expiresAt };
	}
	const { text, expiresAt } = await fetchSharedWorld(link.id, {
		onWaiting: (tries, secondsLeft) =>
			useEditor.getState().setWhatIsOpen({
				kind: "link",
				link,
				step: { kind: "fetching", waited: { tries, secondsLeft } },
			}),
	});
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new ShareError("What the link holds isn't a world this app can read.");
	}
	// A patch (ADR-0118) is changes to a world, kept for handing back from an AI: on its own it
	// has no world to change, so it isn't opened (read as a world, it would be an empty one).
	if (isWorldPatch(parsed)) {
		throw new ShareError(PATCH_LINK);
	}
	try {
		return { scene: repairWorld(parsed).scene, expiresAt };
	} catch {
		throw new ShareError("What the link holds isn't a world this app can read.");
	}
};

/**
 * Open the world a link names, with nothing else loaded. Templates are ours:
 * they open straight away, with no question over them: their addresses wait
 * for a yes in the preview's bar (Review and allow…), and nothing is read
 * from them before it. A shared world opens straight away too, unless it reads
 * from addresses this browser hasn't allowed: then it waits for `answerLink`.
 */
export const openLink = async (link: ILinkAsked) => {
	const { setWhatIsOpen, whatIsOpen } = useEditor.getState();
	// Already being fetched (the start effect running twice, as React's strict mode does in
	// development): asked once, so a missing link is asked for no more than its few tries (ADR-0145).
	if (
		whatIsOpen.kind === "link" &&
		whatIsOpen.link.from === link.from &&
		whatIsOpen.link.id === link.id &&
		whatIsOpen.step.kind === "fetching"
	) {
		return;
	}
	setWhatIsOpen({ kind: "link", link, step: { kind: "fetching", waited: null } });
	let fetched: { scene: TScene; expiresAt: string | null };
	try {
		fetched = await fetchLinked(link);
	} catch (error) {
		failed(link, error instanceof ShareError ? error.message : "It couldn't be opened.");
		return;
	}
	// A template's addresses count as asked about: the bar says they wait, with Allow.
	if (link.from === "template") {
		openAsPreview(link, fetched.scene, null, outsideAddressesOf(fetched.scene));
		return;
	}
	const addresses = link.from === "shared" ? outsideAddressesOf(fetched.scene) : [];
	if (addresses.length === 0) {
		openAsPreview(link, fetched.scene, fetched.expiresAt, []);
		return;
	}
	setWhatIsOpen({
		kind: "link",
		link,
		step: { kind: "asking", scene: fetched.scene, addresses, expiresAt: fetched.expiresAt },
	});
};

/**
 * The answer about a shared world that reads from outside: build it and allow
 * its addresses (`allow`), build it with them waiting in the Data tab under
 * Sources (`open`), or don't build it (`decline`: the home screen). Nothing
 * is requested from them before `allow`, and nothing is kept in this browser.
 */
export const answerLink = (answer: "allow" | "open" | "decline") => {
	const { whatIsOpen, setWhatIsOpen } = useEditor.getState();
	if (whatIsOpen.kind !== "link" || whatIsOpen.step.kind !== "asking") {
		return;
	}
	const { link, step } = whatIsOpen;
	if (answer === "decline") {
		setWhatIsOpen({ kind: "home", why: { kind: "declined", title: step.scene.meta.title } });
		return;
	}
	if (answer === "allow") {
		for (const url of step.addresses) {
			allowLink(url);
		}
	}
	// With Open, the preview's bar says which wait, with Allow, for as long as they do.
	openAsPreview(link, step.scene, step.expiresAt, step.addresses);
};

/**
 * Keep the page's address in step with what's open: the link (`/w/<id>`,
 * `/templates/<id>`) while it or its preview is, the editor's own address once something
 * else is (kept, another world, the home screen). Returns an unsubscribe.
 */
export const keepAddressInStep = () =>
	useEditor.subscribe((state, previous) => {
		if (state.whatIsOpen === previous.whatIsOpen) {
			return;
		}
		const { whatIsOpen } = state;
		const isLinkOpen =
			whatIsOpen.kind === "link" || (whatIsOpen.kind === "world" && whatIsOpen.preview !== null);
		if (!isLinkOpen) {
			leaveLinkAddress();
		}
	});
