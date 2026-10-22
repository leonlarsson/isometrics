import { Toast } from "@base-ui/react/toast";

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
