import { Toast } from "@base-ui/react/toast";

import { APP_NAME } from "#/lib/app";

/**
 * One toast queue for the whole app (ADR-0025). Code anywhere, including
 * outside React (file actions, hotkeys), calls `notify`; `<Toaster>` in the
 * UI renders the queue. Use it instead of `window.alert`.
 */
export const toastManager = Toast.createToastManager();

export type TToastType = "info" | "success" | "error";

export const notify = (title: string, description?: string, type: TToastType = "info") => {
	toastManager.add({ title, description, type, timeout: type === "error" ? 8000 : 4000 });
};

/** Where a toast waits for the page to reload (this tab only). */
const AFTER_RELOAD_KEY = `${APP_NAME.toLowerCase()}:notice-after-reload`;

/**
 * A toast to show once the page has reloaded, for an action that reloads it
 * (an import, ADR-0140). Kept in this tab's sessionStorage; shown by
 * `notifyFromBeforeReload` on start. Without storage it's simply not shown.
 */
export const notifyAfterReload = (title: string, description: string, type: TToastType) => {
	try {
		sessionStorage.setItem(AFTER_RELOAD_KEY, JSON.stringify({ title, description, type }));
	} catch {
		// No storage: nothing to show after the reload.
	}
};

/** Show the toast `notifyAfterReload` left, once. */
export const notifyFromBeforeReload = () => {
	try {
		const raw = sessionStorage.getItem(AFTER_RELOAD_KEY);
		sessionStorage.removeItem(AFTER_RELOAD_KEY);
		const notice = JSON.parse(raw ?? "null") as unknown;
		if (typeof notice !== "object" || notice === null) {
			return;
		}
		const { title, description, type } = notice as Record<string, unknown>;
		if (typeof title === "string" && typeof description === "string") {
			notify(title, description, type === "error" || type === "success" ? type : "info");
		}
	} catch {
		// Nothing readable: nothing to show.
	}
};
