import { Combobox } from "@base-ui/react/combobox";
import type { ReactNode } from "react";

import { Icon } from "../Icon";

import { Field } from "./Field";
import type { TResettable } from "./InheritAction";

import styles from "./Fields.module.css";

export interface IComboboxOption<TValue extends string> {
	value: TValue;
	label: string;
}

export interface IComboboxGroup<TValue extends string> {
	label: string;
	options: IComboboxOption<TValue>[];
}

interface IComboboxFieldProps<TValue extends string> {
	label: string;
	value: TValue;
	/** Options in groups, each under its heading; typing filters them by label. */
	groups: IComboboxGroup<TValue>[];
	onChange: (value: TValue) => void;
	/** What the box says while empty, before typing. */
	placeholder?: string;
	hint?: ReactNode;
}

/**
 * A dropdown with a search: type to narrow its options (by label), pick one
 * with the keys or the pointer. For lists too long to scan in a plain
 * SelectField, like every part. Grouped. Built on Base
 * UI's Combobox (ADR-0024).
 */
export const ComboboxField = <TValue extends string>({
	label,
	value,
	groups,
	onChange,
	placeholder = "Type to search…",
	hint,
	inherit,
}: IComboboxFieldProps<TValue> & TResettable) => {
	const items = groups.map((group) => ({ value: group.label, items: group.options }));
	const selected = groups.flatMap((group) => group.options).find((o) => o.value === value) ?? null;
	return (
		<Field label={label} hint={hint} inherit={inherit}>
			{(id) => (
				<Combobox.Root
					items={items}
					value={selected}
					onValueChange={(next) => {
						if (next) {
							onChange(next.value);
						}
					}}
					itemToStringLabel={(option: IComboboxOption<TValue>) => option.label}
					isItemEqualToValue={(a: IComboboxOption<TValue>, b: IComboboxOption<TValue>) =>
						a.value === b.value
					}
				>
					<div className={styles.comboboxGroup}>
						<Combobox.Input id={id} className={styles.comboboxInput} placeholder={placeholder} />

						<Combobox.Trigger className={styles.comboboxTrigger} aria-label={`Show every ${label}`}>
							<Icon name="chevronDown" size={14} />
						</Combobox.Trigger>
					</div>

					<Combobox.Portal>
						<Combobox.Positioner className={styles.selectPositioner} sideOffset={4}>
							<Combobox.Popup className={`${styles.selectPopup} ${styles.comboboxPopup}`}>
								<Combobox.Empty className={styles.comboboxEmpty}>Nothing matches.</Combobox.Empty>

								<Combobox.List>
									{(group: (typeof items)[number]) => (
										<Combobox.Group key={group.value} items={group.items}>
											<Combobox.GroupLabel className={styles.comboboxGroupLabel}>
												{group.value}
											</Combobox.GroupLabel>

											<Combobox.Collection>
												{(option: IComboboxOption<TValue>) => (
													<Combobox.Item
														key={option.value}
														value={option}
														className={styles.comboboxItem}
													>
														{/* A fixed spot for the tick, so rows line up whether chosen or not. */}
														<span className={styles.comboboxCheck}>
															<Combobox.ItemIndicator className={styles.selectCheck}>
																<Icon name="check" size={14} />
															</Combobox.ItemIndicator>
														</span>

														<span>{option.label}</span>
													</Combobox.Item>
												)}
											</Combobox.Collection>
										</Combobox.Group>
									)}
								</Combobox.List>
							</Combobox.Popup>
						</Combobox.Positioner>
					</Combobox.Portal>
				</Combobox.Root>
			)}
		</Field>
	);
};
