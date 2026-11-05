import type { ReactNode } from "react";

import styles from "./ActionCards.module.css";

export interface IActionCard {
	title: string;
	/** What it does, or why it can't yet (then it's `disabled`, not hidden). */
	about: string;
	onChoose: () => void;
	disabled?: boolean;
	/**
	 * Shown above the title, e.g. a picture of the world it opens; the card keeps the space while
	 * it loads. Cards with pictures are smaller, more to a row, their line cut off after two.
	 */
	picture?: ReactNode;
}

/**
 * A few things to do, as cards: a title and a line under it, each a button,
 * with a picture above if they have one (a starter to open). For a step's
 * next moves (Show it in the world, Add data), where each needs a sentence to
 * be understood; one that can't be done yet stays, greyed, with its reason in
 * its words. For picking one of several options, use ChoiceCards.
 */
export const ActionCards = ({ cards }: { cards: IActionCard[] }) => (
	<div
		className={styles.choices}
		data-pictured={cards.some((card) => card.picture !== undefined) || undefined}
	>
		{cards.map((card) => (
			<button
				key={card.title}
				type="button"
				className={styles.choice}
				disabled={card.disabled}
				onClick={card.onChoose}
			>
				{card.picture !== undefined && <span className={styles.picture}>{card.picture}</span>}

				<strong>{card.title}</strong>

				<span className={styles.about}>{card.about}</span>
			</button>
		))}
	</div>
);
