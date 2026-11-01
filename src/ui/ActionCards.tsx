import styles from "./ActionCards.module.css";

export interface IActionCard {
	title: string;
	/** What it does, or why it can't yet (then it's `disabled`, not hidden). */
	about: string;
	onChoose: () => void;
	disabled?: boolean;
}

/**
 * A few things to do, as cards: a title and a line under it, each a button.
 * For a step's next moves (Show it in the world, Add data), where each needs
 * a sentence to be understood; one that can't be done yet stays, greyed, with
 * its reason in its words. For picking one of several options, use ChoiceCards.
 */
export const ActionCards = ({ cards }: { cards: IActionCard[] }) => (
	<div className={styles.choices}>
		{cards.map((card) => (
			<button
				key={card.title}
				type="button"
				className={styles.choice}
				disabled={card.disabled}
				onClick={card.onChoose}
			>
				<strong>{card.title}</strong>

				<span>{card.about}</span>
			</button>
		))}
	</div>
);
