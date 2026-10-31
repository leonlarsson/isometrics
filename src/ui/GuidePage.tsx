import { Fragment, type ReactNode, useEffect } from "react";

import { usePrefersDark } from "#/editor/useTheme";
import { GUIDE, GUIDE_INTRO, type IGuideSection, type TGuideBlock } from "#/guide/guide";
import { APP_NAME } from "#/lib/app";

import styles from "./GuidePage.module.css";

/** A line of the guide with its **bold** (what's on screen) and `code` (what's typed). */
const Inline = ({ text }: { text: string }) => {
	const pieces = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
	return (
		<>
			{pieces.map((piece, index) => {
				const key = `${index}:${piece}`;
				if (piece.startsWith("**")) {
					return <strong key={key}>{piece.slice(2, -2)}</strong>;
				}
				if (piece.startsWith("`")) {
					return <code key={key}>{piece.slice(1, -1)}</code>;
				}
				return <Fragment key={key}>{piece}</Fragment>;
			})}
		</>
	);
};

const Block = ({ block }: { block: TGuideBlock }): ReactNode => {
	switch (block.kind) {
		case "text":
			return (
				<p>
					<Inline text={block.text} />
				</p>
			);
		case "note":
			return (
				<p className={styles.note}>
					<Inline text={block.text} />
				</p>
			);
		case "steps":
			return (
				<ol className={styles.steps}>
					{block.steps.map((step) => (
						<li key={step}>
							<Inline text={step} />
						</li>
					))}
				</ol>
			);
		case "points":
			return (
				<ul className={styles.points}>
					{block.points.map((point) => (
						<li key={point}>
							<Inline text={point} />
						</li>
					))}
				</ul>
			);
	}
};

const GuideSection = ({ section, isPart }: { section: IGuideSection; isPart?: boolean }) => (
	<section id={section.id} className={isPart ? styles.part : styles.section}>
		{isPart ? <h3>{section.title}</h3> : <h2>{section.title}</h2>}

		{section.blocks.map((block) => (
			<Block key={JSON.stringify(block)} block={block} />
		))}

		{section.parts?.map((part) => (
			<GuideSection key={part.id} section={part} isPart />
		))}
	</section>
);

/**
 * The guide at /guide (ADR-0116): how a world is made, walked through with
 * the Battlefield Stats API, for people and the AIs they ask; the same text
 * as /guide.md and the prompt Build with your AI copies.
 */
export const GuidePage = () => {
	const prefersDark = usePrefersDark();

	// The page wears the device's theme.
	useEffect(() => {
		document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
	}, [prefersDark]);

	return (
		<main className={styles.page}>
			<header className={styles.header}>
				<div className={styles.brand}>
					<span className={styles.logo} aria-hidden="true" />

					<h1>{`${APP_NAME} guide`}</h1>
				</div>

				<a className={styles.link} href="/">
					Open the editor
				</a>
			</header>

			<p className={styles.intro}>{GUIDE_INTRO}</p>

			<nav className={styles.contents} aria-label="Contents">
				{GUIDE.map((section) => (
					<a key={section.id} className={styles.link} href={`#${section.id}`}>
						{section.title}
					</a>
				))}
			</nav>

			{GUIDE.map((section) => (
				<GuideSection key={section.id} section={section} />
			))}

			<ul className={styles.intro}>
				<li>
					<a className={styles.link} href="/guide.md">
						/guide.md
					</a>
					: the same guide as text, for AIs
				</li>

				<li>
					<a className={styles.link} href="/api/worlds/schema">
						/api/worlds/schema
					</a>
					: the world format, with every part and its settings
				</li>

				<li>
					<a className={styles.link} href="/parts">
						/parts
					</a>
					: every part, to look at and try
				</li>
			</ul>
		</main>
	);
};
