import { createPortal } from "react-dom";

import { getPart, resolveProps } from "#/parts/registry";
import { PartPreviewModel } from "#/render/PartPreviewModel";

import styles from "./PartPreview.module.css";

/** Where the card goes: beside the tile, vertically centred on it (CSS px, viewport). */
export interface IPreviewAnchor {
	left: number;
	centerY: number;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** The card's size (its CSS width, and about its height), to keep it inside the window. */
const CARD_WIDTH = 240;
const CARD_HEIGHT = 280;
const MARGIN = 8;

/**
 * The Add to scene panel's hover card: a live, slowly turning model of the
 * part with its name, what it is and how big it is. Purely visual (the tile
 * itself carries the accessible name), so the pointer passes through it.
 */
export const PartPreview = ({ kind, anchor }: { kind: string; anchor: IPreviewAnchor }) => {
	const part = getPart(kind);
	if (!part) {
		return null;
	}
	const props = resolveProps(part, {});
	const [width, depth] = part.footprint(props);
	const height = part.height(props);
	// Centred on the tile, but never off the top or bottom of the window.
	const top = Math.min(
		Math.max(anchor.centerY - CARD_HEIGHT / 2, MARGIN),
		window.innerHeight - CARD_HEIGHT - MARGIN,
	);

	return createPortal(
		<div
			className={styles.card}
			// In a narrow window the panel spans the width; keep the card inside the window.
			style={{ left: Math.min(anchor.left, window.innerWidth - CARD_WIDTH - MARGIN), top }}
			aria-hidden="true"
		>
			<div className={styles.model}>
				<PartPreviewModel kind={kind} />
			</div>

			<div className={styles.text}>
				<strong className={styles.name}>{part.name}</strong>

				<span>{part.description}.</span>

				<span className={styles.meta}>
					{`${round(width)} × ${round(depth)} wide, ${round(height)} tall`}

					{part.canFollowPath ? " · can drive along roads" : ""}
				</span>

				<span className={styles.meta}>Click to add, or drag onto the scene</span>
			</div>
		</div>,
		document.body,
	);
};
