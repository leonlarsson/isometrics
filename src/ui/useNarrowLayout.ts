import { useMediaQuery } from "./useMediaQuery";

/** The phone and small-tablet layout. Keep in sync with the `max-width: 900px` rules in AppShell.module.css. */
const QUERY = "(max-width: 900px)";

/** Whether the editor uses its narrow layout: the scene full screen with the panels in a bottom sheet. */
export const useNarrowLayout = () => useMediaQuery(QUERY);
