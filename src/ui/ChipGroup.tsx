import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

import { Icon, type TIconName } from "./Icon";

import styles from "./ChipGroup.module.css";

export interface IChip<TValue extends string> {
	value: TValue;
	label: string;
	icon?: TIconName;
	/** How many things it stands for, after its label (e.g. parts in a category). */
	count?: number;
}

interface IChipGroupProps<TValue extends string> {
	/** What the chips choose, for screen readers (e.g. "Category"). */
	label: string;
	value: TValue;
	onChange: (value: TValue) => void;
	chips: IChip<TValue>[];
}

/**
 * A row of chips, one of them chosen: categories to filter by, or a few looks
 * to switch between. Wraps onto more rows when narrow. Built on Base UI's
 * ToggleGroup (ADR-0024); pressing the chosen one keeps it chosen.
 */
export const ChipGroup = <TValue extends string>({
	label,
	value,
	onChange,
	chips,
}: IChipGroupProps<TValue>) => (
	<ToggleGroup
		className={styles.group}
		aria-label={label}
		value={[value]}
		onValueChange={(pressed) => {
			const next = pressed.at(-1);
			if (next !== undefined) {
				onChange(next as TValue);
			}
		}}
	>
		{chips.map((chip) => (
			<Toggle key={chip.value} value={chip.value} className={styles.chip}>
				{chip.icon && <Icon name={chip.icon} size={14} />}

				{chip.label}

				{chip.count !== undefined && <span className={styles.count}>{chip.count}</span>}
			</Toggle>
		))}
	</ToggleGroup>
);
