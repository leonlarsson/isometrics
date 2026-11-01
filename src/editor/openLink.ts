import { readWorld } from "#/parts/readWorld";
import type { TScene } from "#/scene/schema";
import { TEMPLATES } from "#/templates";

import { allowLink } from "./linkTrust";
import { markAddressesAsked, outsideAddressesOf } from "./sourceRefresh";
import { useEditor } from "./store";
import { notify } from "./toasts";
import { fetchSharedWorld, ShareError } from "./userWorlds";
import type { ILinkAsked } from "./whatIsOpen";

/**
 * Opening a world from a link (ADR-0121): `/w/<id>` (a shared world) and
 * `/templates/<id>` redirect to the editor as `/?shared=<id>` and
 * `/?template=<id>`, and the editor then loads nothing else. The world is
 * fetched (waiting out the minute a new link can take to arrive) and read; a
 * shared world that reads from addresses this browser hasn't allowed waits
 * for an answer before it's built (Open and allow, Open, Don't open it). It
 * opens as a preview in View mode: nothing is kept in this browser until
 * Edit (or Keep a copy) keeps it. The address keeps `?shared=` while the
 * preview is open, so a reload opens it again; it goes once the preview does.
 */

const SHARED_ID = /^[A-Za-z0-9_-]{22}$/;
const TEMPLATE_ID = /^[a-z0-9_]+$/;

/** What the page's address asks to open, if anything. */
export const linkInAddress = (search = window.location.search): ILinkAsked | null => {
	const params = new URLSearchParams(search);
	const shared = params.get("shared");
	if (shared && SHARED_ID.test(shared)) {
		return { from: "shared", id: shared };
	}
	const template = params.get("template");
	return template && TEMPLATE_ID.test(template) ? { from: "template", id: template } : null;
};

/** The editor's own address, without a link to open. */
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
	if (link.from === "template") {
		const template = TEMPLATES.find((each) => each.id === link.id);
		if (!template) {
			throw new ShareError(`There's no template called “${link.id}”.`);
		}
		return { scene: template.create(), expiresAt: null };
	}
	const { text, expiresAt } = await fetchSharedWorld(link.id, {
		onWaiting: () =>
			useEditor.getState().setWhatIsOpen({
				kind: "link",
				link,
				step: { kind: "fetching", isArriving: true },
			}),
	});
	try {
		return { scene: readWorld(JSON.parse(text)).scene, expiresAt };
	} catch {
		throw new ShareError("What the link holds isn't a world this app can read.");
	}
};

/**
 * Open the world a link names, with nothing else loaded. Templates are ours:
 * they open straight away (their addresses wait for a yes in the world, as
 * from New world). A shared world opens straight away too, unless it reads
 * from addresses this browser hasn't allowed: then it waits for `answerLink`.
 */
export const openLink = async (link: ILinkAsked) => {
	const { setWhatIsOpen } = useEditor.getState();
	setWhatIsOpen({ kind: "link", link, step: { kind: "fetching", isArriving: false } });
	let fetched: { scene: TScene; expiresAt: string | null };
	try {
		fetched = await fetchLinked(link);
	} catch (error) {
		failed(link, error instanceof ShareError ? error.message : "It couldn't be opened.");
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
	openAsPreview(link, step.scene, step.expiresAt, step.addresses);
	if (answer === "open") {
		notify(
			"Its addresses are waiting",
			"Nothing is read from them until you allow them, in the Data tab under Sources.",
		);
	}
};

/**
 * Keep the page's address in step with what's open: `?shared=` / `?template=`
 * while the link or its preview is, the editor's own address once something
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
