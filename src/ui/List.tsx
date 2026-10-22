import { Input as BaseInput } from "@base-ui/react/input";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { type ReactNode, useEffect, useRef, useState } from "react";

import styles from "./List.module.css";

/** A vertical list of rows, e.g. the roads in the Scene tab or saved backups. */
export const List = ({ children }: { children: ReactNode }) => {
	return <ul className={styles.list}>{children}</ul>;
};

/** Renaming a row in place: double-click its label (or set `editing` from outside, e.g. F2). */
export interface IListItemRename {
	/** The text to edit; the label itself may show a fallback, e.g. the part's name. */
	value: string;
	/** Shown in the empty field, e.g. the fallback name. */
	placeholder?: string;
	editing: boolean;
	/** Called to start editing (double-click) and to stop (Enter, Esc, leaving the field). */
	onEditingChange: (editing: boolean) => void;
	/** The new name, on Enter or when the field loses focus. Esc cancels without calling it. */
	onCommit: (value: string) => void;
}

/** The field that replaces a row's label while it's renamed. */
const RenameInput = ({ rename, label }: { rename: IListItemRename; label: string }) => {
	const ref = useRef<HTMLInputElement>(null);
	const [text, setText] = useState(rename.value);
	// Esc and Enter end editing themselves; the blur that follows mustn't commit again.
	const done = useRef(false);

	useEffect(() => {
		ref.current?.focus();
		ref.current?.select();
	}, []);

	const finish = (commit: boolean) => {
		if (done.current) {
			return;
		}
		done.current = true;
		if (commit) {
			rename.onCommit(text.trim());
		}
		rename.onEditingChange(false);
	};

	useHotkeys(
		[
			{ hotkey: "Enter", callback: () => finish(true), options: { meta: { name: "Rename" } } },
			{
				hotkey: "Escape",
				callback: () => finish(false),
				options: { meta: { name: "Cancel renaming" } },
			},
		],
		{ target: ref },
	);

	return (
		<BaseInput
			ref={ref}
			className={styles.rename}
			aria-label={`Rename ${label}`}
			value={text}
			placeholder={rename.placeholder}
			onValueChange={setText}
			onBlur={() => finish(true)}
		/>
	);
};

interface IListItemProps {
	label: ReactNode;
	/** Muted text on the right (or under the label with `stacked`). */
	meta?: ReactNode;
	/** A small colour chip before the label; any CSS background. */
	swatch?: string;
	/** Clicking the row selects it. Without it the row isn't clickable. */
	onClick?: () => void;
	/** Highlights the row (the selected item). */
	current?: boolean;
	/** Buttons at the end of the row (outside the clickable area). */
	actions?: ReactNode;
	/** Put the meta under the label instead of on the right. */
	stacked?: boolean;
	/** Dims the row, e.g. for something hidden. */
	muted?: boolean;
	/** Called when the pointer enters and leaves the row, e.g. to highlight its item elsewhere. */
	onHover?: (hovering: boolean) => void;
	/** Lets the row be renamed in place. */
	rename?: IListItemRename;
}

export const ListItem = ({
	label,
	meta,
	swatch,
	onClick,
	current,
	actions,
	stacked,
	muted,
	onHover,
	rename,
}: IListItemProps) => {
	const content = (
		<>
			{swatch && <span className={styles.swatch} style={{ background: swatch }} />}

			<span className={styles.text} data-stacked={stacked || undefined}>
				<span className={styles.label}>{label}</span>

				{meta && <span className={styles.meta}>{meta}</span>}
			</span>
		</>
	);
	const editing = rename?.editing ?? false;
	return (
		<li
			className={styles.item}
			data-muted={muted || undefined}
			onPointerEnter={onHover && (() => onHover(true))}
			onPointerLeave={onHover && (() => onHover(false))}
		>
			{editing && rename ? (
				<div className={styles.main} aria-current={current || undefined}>
					{swatch && <span className={styles.swatch} style={{ background: swatch }} />}

					<RenameInput rename={rename} label={typeof label === "string" ? label : rename.value} />
				</div>
			) : onClick ? (
				<button
					type="button"
					className={styles.main}
					aria-current={current || undefined}
					onClick={onClick}
					onDoubleClick={rename && (() => rename.onEditingChange(true))}
				>
					{content}
				</button>
			) : (
				<div className={styles.main}>{content}</div>
			)}

			{actions}
		</li>
	);
};
