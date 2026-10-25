import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode, useState } from "react";

import { IconButton } from "./Button";
import { SearchField, SettingsSearchContext } from "./fields";
import { matchesSearch } from "./fields/settingsSearch";
import { Icon, type TIconName } from "./Icon";

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
}

interface ISettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** A line under the page list, e.g. where these settings are kept. */
	note?: ReactNode;
	pages: ISettingsPage[];
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
}: ISettingsDialogProps) => {
	const [pageId, setPageId] = useState(pages[0]?.id ?? "");
	const [query, setQuery] = useState("");
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

							{note && <p className={styles.note}>{note}</p>}
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
									</section>
								))}

								{searching && (
									<p className={styles.noResults}>No preferences match “{query.trim()}”.</p>
								)}
							</div>
						</SettingsSearchContext.Provider>
					</div>
				</BaseDialog.Popup>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
};
