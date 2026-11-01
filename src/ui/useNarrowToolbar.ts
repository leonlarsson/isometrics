import { useMediaQuery } from "./useMediaQuery";

/**
 * The toolbar's widths, as it gives up room (keep in sync with Toolbar.module.css): below 1300px
 * the shading buttons move into More, below 1100px the view buttons (play, re-centre, theme) too,
 * and at 700px it's the phone toolbar (one menu, File, for everything).
 */
export const TOOLBAR_FOLDS_SHADING = "(max-width: 1300px)";
export const TOOLBAR_FOLDS_VIEW = "(max-width: 1100px)";
export const TOOLBAR_IS_NARROW = "(max-width: 700px)";

/** Whether the toolbar is at its phone width: no room for the app menu's logo, so File holds its items. */
export const useNarrowToolbar = () => useMediaQuery(TOOLBAR_IS_NARROW);
