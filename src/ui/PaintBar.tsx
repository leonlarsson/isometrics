import { HotkeysProvider, useHotkeys } from "@tanstack/react-hotkeys";

import {
	BRUSH_MIXES,
	DEFAULT_BRUSH,
	PAINT_DENSITY,
	PAINT_SIZE,
	type TPaintMode,
} from "#/editor/paint";
import { useEditor } from "#/editor/store";
import { partName, partsByCategory } from "#/parts/registry";
import { CATEGORY_LABELS } from "#/parts/types";

import { Button } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { ComboboxField, type IComboboxGroup, Kbd, resetToDefault, SliderField } from "./fields";

import styles from "./PaintBar.module.css";

/** The brushes: the ready mixes first, then every part that stands still, by category. */
const BRUSH_GROUPS: IComboboxGroup<string>[] = [
	{ label: "Mixes", options: BRUSH_MIXES.map((mix) => ({ value: mix.id, label: mix.name })) },
	...partsByCategory()
		.filter(([category]) => category !== "markers")
		.map(([category, parts]) => ({
			label: CATEGORY_LABELS[category],
			options: parts
				.filter((part) => !part.canFollowPath && !part.flat)
				.map((part) => ({ value: `part:${part.kind}`, label: partName(part) })),
		}))
		.filter((group) => group.options.length > 0),
];

const PaintControls = () => {
	const brush = useEditor((s) => s.paintBrush);
	const setPaintBrush = useEditor((s) => s.setPaintBrush);
	const setPainting = useEditor((s) => s.setPainting);

	useHotkeys([
		{
			hotkey: "Escape",
			callback: () => setPainting(false),
			options: { meta: { name: "Stop painting" } },
		},
		{
			hotkey: "N",
			callback: () => setPainting(false),
			options: { meta: { name: "Stop painting" } },
		},
		// The editor's own keys are shut out while painting; undo and redo still work (a stroke is one step).
		{
			hotkey: "Mod+Z",
			callback: () => useEditor.getState().undo(),
			options: { meta: { name: "Undo" } },
		},
		{
			hotkey: "Mod+Shift+Z",
			callback: () => useEditor.getState().redo(),
			options: { meta: { name: "Redo" } },
		},
		{
			hotkey: "Mod+Y",
			callback: () => useEditor.getState().redo(),
			options: { meta: { name: "Redo" } },
		},
		{
			hotkey: "X",
			callback: () => setPaintBrush({ mode: brush.mode === "paint" ? "erase" : "paint" }),
			options: { meta: { name: "Switch paint and erase" } },
		},
		{
			hotkey: "[BracketLeft]",
			callback: () => setPaintBrush({ size: Math.max(PAINT_SIZE.min, brush.size - 0.5) }),
			options: { meta: { name: "Smaller brush" } },
		},
		{
			hotkey: "[BracketRight]",
			callback: () => setPaintBrush({ size: Math.min(PAINT_SIZE.max, brush.size + 0.5) }),
			options: { meta: { name: "Bigger brush" } },
		},
	]);

	const erasing = brush.mode === "erase";
	return (
		<div className={styles.bar} data-label-obstacle="" role="toolbar" aria-label="Paint">
			<div className={styles.controls}>
				<ChipGroup<TPaintMode>
					label="Paint or erase"
					value={brush.mode}
					onChange={(mode) => setPaintBrush({ mode })}
					chips={[
						{ value: "paint", label: "Paint", icon: "brush" },
						{ value: "erase", label: "Erase", icon: "trash" },
					]}
				/>

				<div className={styles.brush}>
					<ComboboxField
						label="Brush"
						value={brush.brushId}
						groups={BRUSH_GROUPS}
						onChange={(brushId) => setPaintBrush({ brushId })}
						inherit={{
							...resetToDefault(
								brush.brushId,
								DEFAULT_BRUSH.brushId,
								() => setPaintBrush({ brushId: DEFAULT_BRUSH.brushId }),
								BRUSH_MIXES.find((mix) => mix.id === DEFAULT_BRUSH.brushId)?.name,
							),
							isCompact: true,
						}}
						placeholder="Search parts and mixes…"
					/>
				</div>

				<div className={styles.slider}>
					<SliderField
						label="Size"
						value={brush.size}
						min={PAINT_SIZE.min}
						max={PAINT_SIZE.max}
						step={0.5}
						onChange={(size) => setPaintBrush({ size })}
						inherit={{
							...resetToDefault(brush.size, DEFAULT_BRUSH.size, () =>
								setPaintBrush({ size: DEFAULT_BRUSH.size }),
							),
							isCompact: true,
						}}
					/>
				</div>

				<div className={styles.slider}>
					<SliderField
						label="Density"
						value={brush.density}
						min={PAINT_DENSITY.min}
						max={PAINT_DENSITY.max}
						step={0.5}
						onChange={(density) => setPaintBrush({ density })}
						inherit={{
							...resetToDefault(brush.density, DEFAULT_BRUSH.density, () =>
								setPaintBrush({ density: DEFAULT_BRUSH.density }),
							),
							isCompact: true,
						}}
					/>
				</div>
			</div>

			<div className={styles.footer}>
				<span className={styles.keys}>
					<span>
						{erasing
							? "Drag over the ground to take away what this brush paints."
							: "Drag over the ground to paint; it keeps off roads and other objects."}
					</span>

					<span>
						<Kbd>Shift</Kbd> {erasing ? "paints" : "erases"} while held · <Kbd>X</Kbd> paint or
						erase · <Kbd>[</Kbd> <Kbd>]</Kbd> size · <Kbd>Esc</Kbd> done
					</span>
				</span>

				<Button variant="primary" onClick={() => setPainting(false)}>
					Done
				</Button>
			</div>
		</div>
	);
};

/**
 * The paint bar (ADR-0091), along the bottom of the view while painting: paint
 * or erase, the brush (a mix or a part), its size and density, and how to use
 * it. Its keys live in an exclusive scope, so Escape closes it.
 */
export const PaintBar = () => {
	const painting = useEditor((s) => s.painting);
	if (!painting) {
		return null;
	}
	return (
		<HotkeysProvider scope="painting" exclusive>
			<PaintControls />
		</HotkeysProvider>
	);
};
