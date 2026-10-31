import { useEffect, useRef, useState } from "react";

import { notify } from "#/editor/toasts";

/** How long a copy button shows its tick after copying. */
const COPIED_MS = 2000;

/**
 * Put text on the clipboard, saying so (or that the browser didn't allow it).
 * For a moment afterwards `copied` is true, and `copiedKey` names what was
 * copied (the `key` given, for one of several buttons), so the button can show
 * a tick: a `check` icon, with `showsSuccess` on a `Button` or a "Copied" label
 * on an `IconButton`.
 */
export const useCopy = () => {
	const [copiedKey, setCopiedKey] = useState<string | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);
	const copy = (text: string, done: string, key = "") => {
		void navigator.clipboard
			.writeText(text)
			.then(() => {
				notify(done);
				setCopiedKey(key);
				clearTimeout(timer.current);
				timer.current = setTimeout(() => setCopiedKey(null), COPIED_MS);
			})
			.catch(() => notify("Couldn't copy: the browser didn't allow it"));
	};
	return { copied: copiedKey !== null, copiedKey, copy };
};
