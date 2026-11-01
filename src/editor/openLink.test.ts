import { afterEach, describe, expect, it, vi } from "vitest";

import { openLink, PATCH_LINK } from "./openLink";
import { useEditor } from "./store";

const answering = (body: unknown) =>
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
	);

describe("opening a link (ADR-0121)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("refuses a link to a patch, saying why, and opens nothing", async () => {
		answering({ version: 1, isPatch: true, meta: { title: "Renamed" } });
		await openLink({ from: "shared", id: "5ttCNb8m9AVF1wwYCij3gA" });
		expect(useEditor.getState().whatIsOpen).toEqual({
			kind: "home",
			why: { kind: "linkFailed", from: "shared", message: PATCH_LINK },
		});
	});

	it("opens a shared world that reads nothing from outside as a preview", async () => {
		answering({ version: 1, meta: { title: "Shared" } });
		await openLink({ from: "shared", id: "5ttCNb8m9AVF1wwYCij3gA" });
		const { whatIsOpen, scene, mode } = useEditor.getState();
		expect(whatIsOpen.kind === "world" && whatIsOpen.preview?.id).toBe("5ttCNb8m9AVF1wwYCij3gA");
		expect(scene.meta.title).toBe("Shared");
		expect(mode).toBe("view");
	});
});
