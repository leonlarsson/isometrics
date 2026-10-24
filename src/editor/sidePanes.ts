import { readPanelMemory, setPanelOpen, usePanelMemory } from "./panelMemory";

/**
 * Whether the wide layout's side panes are open: Add to scene on the left,
 * the outliner and properties on the right. Folded, each is a thin strip.
 * Remembered per browser with the panels' folds (ADR-0055).
 */
export type TSidePane = "left" | "right";

const ID: Record<TSidePane, string> = { left: "pane:left", right: "pane:right" };

const isOpen = (memory: Record<string, boolean>, side: TSidePane) => memory[ID[side]] ?? true;

/** Which side panes are open, updating when one opens or closes. */
export const useSidePanes = (): Record<TSidePane, boolean> => {
	const memory = usePanelMemory();
	return { left: isOpen(memory, "left"), right: isOpen(memory, "right") };
};

export const setSidePaneOpen = (side: TSidePane, open: boolean) => setPanelOpen(ID[side], open);

/** Hide both panes, or show both when they're already hidden (Ctrl+Space, the toolbar button). */
export const toggleSidePanes = () => {
	const memory = readPanelMemory();
	const show = !isOpen(memory, "left") && !isOpen(memory, "right");
	setSidePaneOpen("left", show);
	setSidePaneOpen("right", show);
};
