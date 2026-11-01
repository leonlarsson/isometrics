import { useState } from "react";

import { openSavedWorld, openWorldFile } from "#/editor/fileActions";
import { listWorlds } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import type { THomeReason } from "#/editor/whatIsOpen";
import { APP_NAME } from "#/lib/app";

import { Button } from "./Button";
import { Icon } from "./Icon";
import { List, ListItem } from "./List";
import { openGuide } from "./Welcome";
import { formatEdited } from "./WorldsDialog";

import styles from "./HomeScreen.module.css";

/** How many of one's worlds are listed. */
const WORLDS_SHOWN = 12;

/** What the home screen says first, for why it's showing; null when nothing needs saying. */
const noticeOf = (why: THomeReason): { title: string; text: string; isProblem: boolean } | null => {
	switch (why.kind) {
		case "linkFailed":
			return {
				title:
					why.from === "shared"
						? "That shared world can't be opened"
						: "That template can't be opened",
				text: why.message,
				isProblem: true,
			};
		case "declined":
			return {
				title: `“${why.title}” wasn't opened`,
				text: "Nothing from it was read or kept. Open the link again to change your mind.",
				isProblem: false,
			};
		case "closed":
			return {
				title: "Closed without keeping it",
				text: "Nothing from it is kept in this browser.",
				isProblem: false,
			};
		case "noWorlds":
			return {
				title: "No worlds in this browser",
				text: "Start a new one, open a file, or have your AI build one.",
				isProblem: false,
			};
		case "chosen":
			return null;
	}
};

/**
 * No world open (ADR-0121), like an empty editor window: why, if there's
 * anything to say (a link that couldn't be opened, one not opened, no worlds
 * left), the ways to start (New world…, Open file…, Build with your AI) and
 * one's worlds in this browser to open. On start too, if Preferences say so.
 */
export const HomeScreen = () => {
	const why = useEditor((s) => (s.whatIsOpen.kind === "home" ? s.whatIsOpen.why : null));
	// Read once: nothing changes the list while the home screen shows.
	const [worlds] = useState(listWorlds);
	if (!why) {
		return null;
	}
	const notice = noticeOf(why);
	const store = () => useEditor.getState();

	return (
		<main className={styles.home} aria-label="Home">
			<div className={styles.column}>
				<header className={styles.header}>
					<span className={styles.logo} aria-hidden="true" />

					<h1 className={styles.title}>{APP_NAME}</h1>
				</header>

				{notice && (
					<div className={styles.notice} data-problem={notice.isProblem || undefined} role="status">
						<Icon name={notice.isProblem ? "alert" : "info"} size={18} />

						<div>
							<p className={styles.noticeTitle}>{notice.title}</p>

							<p className={styles.noticeText}>{notice.text}</p>
						</div>
					</div>
				)}

				<section className={styles.section} aria-labelledby="home-start">
					<h2 id="home-start" className={styles.heading}>
						Start
					</h2>

					<div className={styles.actions}>
						<Button
							variant="primary"
							icon="file"
							onClick={() => store().setNewWorld({ shows: "all", usesData: true })}
						>
							New world…
						</Button>

						<Button icon="upload" onClick={() => void openWorldFile()}>
							Open file…
						</Button>

						<Button icon="sparkle" onClick={() => store().setBuildWithAi("new")}>
							Build with your AI…
						</Button>
					</div>
				</section>

				<section className={styles.section} aria-labelledby="home-worlds">
					<h2 id="home-worlds" className={styles.heading}>
						Your worlds
					</h2>

					{worlds.length === 0 ? (
						<p className={styles.empty}>None in this browser yet.</p>
					) : (
						<List>
							{worlds.slice(0, WORLDS_SHOWN).map((world) => (
								<ListItem
									key={world.id}
									label={world.title}
									meta={formatEdited(world.updatedAt)}
									onClick={() => openSavedWorld(world.id)}
								/>
							))}
						</List>
					)}

					{worlds.length > WORLDS_SHOWN && (
						<p className={styles.empty}>
							{`And ${worlds.length - WORLDS_SHOWN} more: File → Open world → All worlds…`}
						</p>
					)}
				</section>

				<section className={styles.section} aria-labelledby="home-learn">
					<h2 id="home-learn" className={styles.heading}>
						Learn
					</h2>

					<div className={styles.actions}>
						<Button icon="sparkle" onClick={() => store().setWelcomeOpen(true)}>
							Welcome…
						</Button>

						<Button icon="newTab" onClick={openGuide}>
							Guide
						</Button>
					</div>
				</section>
			</div>
		</main>
	);
};
