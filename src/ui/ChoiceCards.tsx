import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { ReactNode } from "react";

import styles from "./ChoiceCards.module.css";

export interface IChoiceCard<TValue extends string> {
	value: TValue;
	title: string;
	/** A muted line or two under the title. */
	description?: string;
	/** Shown above the title, e.g. a rendered picture; the card keeps the space while it loads. */
	picture?: ReactNode;
}

interface IChoiceCardsProps<TValue extends string> {
	/** The group's name for screen readers. */
	label: string;
	value: TValue;
	onChange: (value: TValue) => void;
	/** Double-clicking a card: pick it and go, e.g. create the world right away. */
	onPick?: (value: TValue) => void;
	cards: IChoiceCard<TValue>[];
}

/**
 * Pick one of a few options shown as cards with a picture, like the presets in
 * a New Document dialog. A radio group (Base UI, ADR-0024): arrow keys move
 * between the cards, and a double-click can pick one and go (`onPick`).
 */
export const ChoiceCards = <TValue extends string>({
	label,
	value,
	onChange,
	onPick,
	cards,
}: IChoiceCardsProps<TValue>) => {
	return (
		<RadioGroup
			aria-label={label}
			className={styles.grid}
			value={value}
			onValueChange={(next) => onChange(next as TValue)}
		>
			{cards.map((card) => (
				<Radio.Root
					key={card.value}
					value={card.value}
					className={styles.card}
					onDoubleClick={onPick && (() => onPick(card.value))}
				>
					<span className={styles.picture}>{card.picture}</span>

					<span className={styles.text}>
						<span className={styles.title}>{card.title}</span>

						{card.description && <span className={styles.description}>{card.description}</span>}
					</span>
				</Radio.Root>
			))}
		</RadioGroup>
	);
};
