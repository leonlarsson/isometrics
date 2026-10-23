import { Input as BaseInput } from "@base-ui/react/input";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { releaseFocusAfterPointerClick } from "./focus";
import { Icon } from "./Icon";

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

/** The field that replaces a row's label while it's renamed; also used by RenamePopover. */
export const RenameInput = ({ rename, label }: { rename: IListItemRename; label: string }) => {
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

/** Moving a row to another place in its list. */
export interface IListItemReorder {
	/** The row's place in the list. */
	index: number;
	/** How many rows the list has. */
	count: number;
	/** Move the row so it ends up at `to` (0 = first). */
	onMove: (to: number) => void;
}

/**
 * The grip that moves a row: drag it up or down (a line shows where it will
 * land), or focus it and press ↑ / ↓.
 */
const ReorderGrip = ({ reorder, label }: { reorder: IListItemReorder; label: string }) => {
	const ref = useRef<HTMLButtonElement>(null);
	const { index, count, onMove } = reorder;
	const move = (to: number) => {
		if (to >= 0 && to < count && to !== index) {
			onMove(to);
		}
	};

	useHotkeys(
		[
			{
				hotkey: "ArrowUp",
				callback: () => move(index - 1),
				options: { meta: { name: "Move up" } },
			},
			{
				hotkey: "ArrowDown",
				callback: () => move(index + 1),
				options: { meta: { name: "Move down" } },
			},
		],
		{ target: ref },
	);

	/** Where the row would land for a pointer at `y`, and the row to draw the line on. */
	const dropAt = (y: number) => {
		const rows = [...(ref.current?.closest("ul")?.children ?? [])] as HTMLElement[];
		const others = rows.filter((_, i) => i !== index);
		const to = others.filter((row) => {
			const rect = row.getBoundingClientRect();
			return rect.top + rect.height / 2 < y;
		}).length;
		return { to, rows };
	};
	const clearLines = (rows: HTMLElement[]) => {
		for (const row of rows) {
			delete row.dataset.drop;
		}
	};

	const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		event.currentTarget.dataset.dragging = "";
	};
	const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
			return;
		}
		const { to, rows } = dropAt(event.clientY);
		clearLines(rows);
		const others = rows.filter((_, i) => i !== index);
		// A line above the row it would go before, or below the last one.
		const before = others[to];
		if (to === index) {
			return;
		}
		if (before) {
			before.dataset.drop = "above";
		} else {
			others[others.length - 1].dataset.drop = "below";
		}
	};
	const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
			return;
		}
		delete event.currentTarget.dataset.dragging;
		const { to, rows } = dropAt(event.clientY);
		clearLines(rows);
		move(to);
	};

	return (
		<button
			ref={ref}
			type="button"
			className={styles.grip}
			aria-label={`Move ${label} (drag, or ↑ ↓)`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onLostPointerCapture={(event) => {
				delete event.currentTarget.dataset.dragging;
			}}
		>
			<Icon name="grip" size={14} />
		</button>
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
	/** Lets the row be moved within its list (a grip before it). */
	reorder?: IListItemReorder;
	/** A right-click on the row, at that screen point; the browser's own menu is held back. */
	onContextMenu?: (at: { x: number; y: number }) => void;
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
	reorder,
	onContextMenu,
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
			onContextMenu={
				onContextMenu &&
				((event) => {
					event.preventDefault();
					onContextMenu({ x: event.clientX, y: event.clientY });
				})
			}
		>
			{reorder && (
				<ReorderGrip
					reorder={reorder}
					label={typeof label === "string" ? label : `item ${reorder.index + 1}`}
				/>
			)}

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
					onClick={(event) => {
						onClick();
						releaseFocusAfterPointerClick(event);
					}}
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
