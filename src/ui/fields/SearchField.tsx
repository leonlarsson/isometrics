import { Input as BaseInput } from "@base-ui/react/input";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { type RefObject, useRef } from "react";

import { Icon } from "../Icon";

import { Kbd } from "./Kbd";

import styles from "./Fields.module.css";

interface ISearchFieldProps {
	value: string;
	onChange: (value: string) => void;
	/** Accessible name, e.g. "Search parts". */
	label: string;
	placeholder?: string;
	/** Enter: act on the first result. */
	onSubmit?: () => void;
	/** Lets a parent focus the field, e.g. from a "/" shortcut. */
	inputRef?: RefObject<HTMLInputElement | null>;
	/** A key hint shown at the right while empty, e.g. "/". */
	shortcut?: string;
}

/**
 * A search box: a search icon, the text, and a clear button once there's
 * text. Enter calls `onSubmit`; Escape clears the text, or leaves the field
 * when it's already empty.
 */
export const SearchField = ({
	value,
	onChange,
	label,
	placeholder = "Search…",
	onSubmit,
	inputRef,
	shortcut,
}: ISearchFieldProps) => {
	const ownRef = useRef<HTMLInputElement>(null);
	const ref = inputRef ?? ownRef;

	useHotkeys(
		[
			{
				hotkey: "Enter",
				callback: () => onSubmit?.(),
				options: { meta: { name: "Use the first result" } },
			},
			{
				hotkey: "Escape",
				callback: () => {
					if (value) {
						onChange("");
					} else {
						ref.current?.blur();
					}
				},
				options: { meta: { name: "Clear search" } },
			},
		],
		{ target: ref },
	);

	return (
		<div className={styles.search}>
			<span className={styles.searchIcon}>
				<Icon name="search" size={15} />
			</span>

			<BaseInput
				ref={ref}
				type="search"
				className={styles.input}
				aria-label={label}
				value={value}
				placeholder={placeholder}
				onValueChange={(next) => onChange(next)}
			/>

			{value ? (
				<button
					type="button"
					className={styles.searchClear}
					aria-label="Clear search"
					onClick={() => {
						onChange("");
						ref.current?.focus();
					}}
				>
					<Icon name="close" size={13} />
				</button>
			) : (
				shortcut && <Kbd>{shortcut}</Kbd>
			)}
		</div>
	);
};
