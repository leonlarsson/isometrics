import { Select } from "@base-ui/react/select";
import type { ReactNode } from "react";

import { Icon } from "../Icon";

import { Field } from "./Field";
import type { IInherit } from "./InheritAction";

import styles from "./Fields.module.css";

interface ISelectFieldProps<TValue extends string> {
	label: string;
	value: TValue;
	/** A disabled option is shown but can't be picked; say why near the field. */
	options: { value: TValue; label: string; disabled?: boolean }[];
	onChange: (value: TValue) => void;
	inherit?: IInherit;
	/** The value differs between the selected things (ADR-0064). */
	mixed?: boolean;
	hint?: ReactNode;
}

/** A dropdown of options, styled like the menus. */
export const SelectField = <TValue extends string>({
	label,
	value,
	options,
	onChange,
	inherit,
	mixed,
	hint,
}: ISelectFieldProps<TValue>) => {
	return (
		<Field label={label} inherit={inherit} mixed={mixed} hint={hint}>
			{(id) => (
				<Select.Root
					items={options}
					value={value}
					onValueChange={(next) => next !== null && onChange(next as TValue)}
				>
					<Select.Trigger id={id} className={styles.selectTrigger}>
						<Select.Value className={styles.selectValue} />

						<Select.Icon className={styles.selectIcon}>
							<Icon name="chevronDown" size={14} />
						</Select.Icon>
					</Select.Trigger>

					<Select.Portal>
						<Select.Positioner
							className={styles.selectPositioner}
							sideOffset={4}
							alignItemWithTrigger={false}
						>
							<Select.Popup className={styles.selectPopup}>
								<Select.List>
									{options.map((option) => (
										<Select.Item
											key={option.value}
											value={option.value}
											disabled={option.disabled}
											className={styles.selectItem}
										>
											<Select.ItemIndicator className={styles.selectCheck}>
												<Icon name="check" size={14} />
											</Select.ItemIndicator>

											<Select.ItemText>{option.label}</Select.ItemText>
										</Select.Item>
									))}
								</Select.List>
							</Select.Popup>
						</Select.Positioner>
					</Select.Portal>
				</Select.Root>
			)}
		</Field>
	);
};
