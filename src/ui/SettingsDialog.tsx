import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode, useState } from "react";

import { Button, ButtonGroup, IconButton } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { SearchField, SettingsSearchContext } from "./fields";
import { matchesSearch } from "./fields/settingsSearch";
import { Icon, type TIconName } from "./Icon";
import { useNarrowLayout } from "./useNarrowLayout";

import styles from "./SettingsDialog.module.css";

/** One setting: a field from the kit (it brings its own label), and words that also find it. */
export interface ISettingsRow {
	id: string;
	field: ReactNode;
	keywords?: string;
}

export interface ISettingsGroup {
	title: string;
	rows: ISettingsRow[];
	/** A note under the group's settings. */
	note?: ReactNode;
}

export interface ISettingsPage {
	id: string;
	label: string;
	icon: TIconName;
	groups: ISettingsGroup[];
	/** Put this page's settings back to their defaults; `changed` says whether any differs now. */
	reset?: { onReset: () => void; changed: boolean };
}

interface ISettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** A line under the page list, e.g. where these settings are kept. */
	note?: ReactNode;
	pages: ISettingsPage[];
	/** Put every setting back to its default; `changed` says whether any differs now. */
	resetAll?: { label: string; onReset: () => void; changed: boolean };
}

/**
 * A settings window, like an app's preferences: a search and the pages on the
 * left, the open page's settings on the right, one per row, in titled groups.
 * Searching shows every page's settings that match, by their label or their
 * keywords. Built on Base UI's Dialog (ADR-0024).
 */
export const SettingsDialog = ({
	open,
	onOpenChange,
	title,
	note,
	pages,
	resetAll,
}: ISettingsDialogProps) => {
	const [pageId, setPageId] = useState(pages[0]?.id ?? "");
	const [query, setQuery] = useState("");
	// Which reset is being confirmed: a page's id, "all", or none.
	const [confirming, setConfirming] = useState<string | null>(null);
	const confirmingPage = pages.find((page) => page.id === confirming);
	// Phones and small tablets: the pages stack above the settings, and the resets turn quiet.
	const narrow = useNarrowLayout();
	const pageResetButton = (page: ISettingsPage) =>
		page.reset && (
			<Button
				size="sm"
				icon="reset"
				variant={narrow ? "secondary" : "danger"}
				disabled={!page.reset.changed}
				onClick={() => setConfirming(page.id)}
			>
				{`Reset ${page.label}`}
			</Button>
		);
	const resetAllButton = resetAll && (
		<Button
			size="sm"
			icon="reset"
			variant={narrow ? "secondary" : "danger"}
			block={!narrow}
			centered
			disabled={!resetAll.changed}
			onClick={() => setConfirming("all")}
		>
			{resetAll.label}
		</Button>
	);
	const searching = query.trim() !== "";
	const shown = searching ? pages : pages.filter((page) => page.id === pageId);

	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className={styles.backdrop} />

				<BaseDialog.Popup className={styles.popup}>
					<header className={styles.header}>
						<BaseDialog.Title className={styles.title}>{title}</BaseDialog.Title>

						<IconButton icon="close" label="Close" onClick={() => onOpenChange(false)} />
					</header>

					<div className={styles.columns}>
						<nav className={styles.nav}>
							<SearchField label="Search the preferences" value={query} onChange={setQuery} />

							<ul className={styles.pages}>
								{pages.map((page) => (
									<li key={page.id}>
										<button
											type="button"
											className={styles.page}
											aria-current={!searching && page.id === pageId ? "page" : undefined}
											onClick={() => {
												setQuery("");
												setPageId(page.id);
											}}
										>
											<Icon name={page.icon} size={16} />

											{page.label}
										</button>
									</li>
								))}
							</ul>

							{/* On phones these go to the end of the page instead (below), out of the way. */}
							{!narrow && (
								<div className={styles.navFoot}>
									{note && <p className={styles.note}>{note}</p>}

									{resetAllButton}
								</div>
							)}
						</nav>

						<SettingsSearchContext.Provider value={query}>
							<div className={styles.content} data-searching={searching || undefined}>
								{shown.map((page) => (
									<section key={page.id} className={styles.pageBody}>
										{searching && <h2 className={styles.pageTitle}>{page.label}</h2>}

										{page.groups.map((group) => (
											<div key={group.title} className={styles.group}>
												<h3 className={styles.groupTitle}>{group.title}</h3>

												{group.rows.map((row) => (
													<div
														key={row.id}
														className={styles.row}
														data-keyword-match={
															(searching && row.keywords && matchesSearch(row.keywords, query)) ||
															undefined
														}
													>
														{row.field}
													</div>
												))}

												{group.note && !searching && (
													<div className={styles.groupNote}>{group.note}</div>
												)}
											</div>
										))}

										{/* Last on the page: it acts on everything above it. On phones it joins the footer. */}
										{page.reset && !searching && !narrow && (
											<div className={styles.pageActions}>{pageResetButton(page)}</div>
										)}
									</section>
								))}

								{narrow && !searching && (
									<div className={styles.contentFoot}>
										<ButtonGroup>
											{shown[0]?.reset && pageResetButton(shown[0])}

											{resetAllButton}
										</ButtonGroup>

										{note && <p className={styles.note}>{note}</p>}
									</div>
								)}

								{searching && (
									<p className={styles.noResults}>No preferences match “{query.trim()}”.</p>
								)}
							</div>
						</SettingsSearchContext.Provider>
					</div>
				</BaseDialog.Popup>
			</BaseDialog.Portal>

			<ConfirmDialog
				open={confirming !== null}
				onOpenChange={(next) => {
					if (!next) {
						setConfirming(null);
					}
				}}
				title={
					confirming === "all"
						? `${resetAll?.label ?? "Reset everything"}?`
						: `Reset ${confirmingPage?.label ?? ""}?`
				}
				description={
					confirming === "all"
						? "Every setting here goes back to its default. This can’t be undone."
						: `The settings on ${confirmingPage?.label ?? "this page"} go back to their defaults. This can’t be undone.`
				}
				confirmLabel="Reset"
				onConfirm={() => {
					if (confirming === "all") {
						resetAll?.onReset();
					} else {
						confirmingPage?.reset?.onReset();
					}
				}}
			/>
		</BaseDialog.Root>
	);
};
