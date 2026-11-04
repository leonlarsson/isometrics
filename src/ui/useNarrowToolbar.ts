import { useMediaQuery } from "./useMediaQuery";

/**
 * The phone toolbar's width (keep in sync with AppRow.module.css): below 700px the app row and the
 * view bar share one row (ADR-0046, ADR-0142), with no room for the app menu's logo or the tray, so
 * File holds the app menu's items and the view bar's More the theme.
 */
const TOOLBAR_IS_NARROW = "(max-width: 700px)";

/** Whether the toolbar is at its phone width: the app row and the view bar in one row. */
export const useNarrowToolbar = () => useMediaQuery(TOOLBAR_IS_NARROW);
