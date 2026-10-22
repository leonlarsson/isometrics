import { Toast } from "@base-ui/react/toast";
import type { ReactNode } from "react";

import { toastManager } from "#/editor/toasts";

import { Icon } from "./Icon";

import styles from "./Toaster.module.css";

const ToastList = () => {
	const { toasts } = Toast.useToastManager();
	return toasts.map((toast) => (
		<Toast.Root key={toast.id} toast={toast} className={styles.toast}>
			<Toast.Content className={styles.content}>
				<div className={styles.text}>
					<Toast.Title className={styles.title} />

					<Toast.Description className={styles.description} />
				</div>

				<Toast.Close className={styles.close} aria-label="Dismiss">
					<Icon name="close" size={14} />
				</Toast.Close>
			</Toast.Content>
		</Toast.Root>
	));
};

/** Renders the app's toast queue (see `notify` in editor/toasts.ts) in the bottom-right corner. */
export const Toaster = ({ children }: { children: ReactNode }) => {
	return (
		<Toast.Provider toastManager={toastManager}>
			{children}

			<Toast.Portal>
				<Toast.Viewport className={styles.viewport}>
					<ToastList />
				</Toast.Viewport>
			</Toast.Portal>
		</Toast.Provider>
	);
};
