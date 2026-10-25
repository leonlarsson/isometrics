import { pasteFromClipboard } from "#/editor/clipboard";
import { rememberUsed } from "#/editor/paletteMemory";
import { spotOnGrid, useEditor } from "#/editor/store";
import { round } from "#/lib/math";
import { partName, partsByCategory } from "#/parts/registry";
import { CATEGORY_LABELS } from "#/parts/types";
import { AREA_TYPE_LABELS } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TAreaType, TRoadStyle, TVec2 } from "#/scene/schema";

import { ContextMenu, Menu } from "./Menu";
import { useLastNonNull } from "./useLastNonNull";
import { saveCurrentView } from "./ViewpointsMenu";

const ROAD_STYLES = Object.keys(ROAD_STYLE_LABELS) as TRoadStyle[];
const AREA_TYPES = Object.keys(AREA_TYPE_LABELS) as TAreaType[];

/** "x 12, z −4.5": where on the ground the menu is for. */
const describePoint = ([x, z]: TVec2) => `x ${round(x, 1)}, z ${round(z, 1)}`.replaceAll("-", "−");

/**
 * The right-click menu for empty ground (Edit mode): add a part right there,
 * start a road or area from that point, or move the camera. Opened through
 * the store (`openGroundMenu`) by render/contextMenu.
 */
export const GroundContextMenu = () => {
	const menuNow = useEditor((s) => s.groundMenu);
	// The last one opened, kept while it animates closed.
	const menu = useLastNonNull(menuNow);
	const store = () => useEditor.getState();
	// Where things go: on the grid while snapping is on, like everything placed by hand. The
	// crosshair on the ground marks it (render/GroundMenuMarker).
	const spot = () => spotOnGrid(menu?.point ?? [0, 0], store().snapping);
	const draw = (start: () => void) => {
		const point = spot();
		start();
		store().addDrawingPoint(point);
	};

	return (
		<ContextMenu
			open={menuNow !== null}
			onOpenChange={(open) => {
				if (!open) {
					store().openGroundMenu(null);
				}
			}}
			x={menu?.x ?? 0}
			y={menu?.y ?? 0}
			title="Ground"
			subtitle={menu ? describePoint(menu.point) : undefined}
		>
			<Menu.Submenu icon="plus" label="Add here">
				{/* One list with headings, not a submenu per category: a third level would flip over the others near the window's edge. */}
				{partsByCategory().map(([category, parts]) => (
					<Menu.Group key={category} label={CATEGORY_LABELS[category]}>
						{parts.map((part) => (
							<Menu.Item
								key={part.kind}
								label={partName(part)}
								onClick={() => {
									store().addEntity({ kind: part.kind, name: "", position: spot() });
									rememberUsed(`part:${part.kind}`);
								}}
							/>
						))}
					</Menu.Group>
				))}
			</Menu.Submenu>

			<Menu.Submenu icon="edit" label="Draw a road from here">
				{ROAD_STYLES.map((style) => (
					<Menu.Item
						key={style}
						label={ROAD_STYLE_LABELS[style]}
						onClick={() => {
							draw(() => store().startDrawing(style));
							rememberUsed(`road:${style}`);
						}}
					/>
				))}
			</Menu.Submenu>

			<Menu.Submenu icon="layers" label="Draw an area from here">
				{AREA_TYPES.map((type) => (
					<Menu.Item
						key={type}
						label={AREA_TYPE_LABELS[type]}
						onClick={() => {
							draw(() => store().startAreaDrawing(type));
							rememberUsed(`area:${type}`);
						}}
					/>
				))}
			</Menu.Submenu>

			<Menu.Item
				icon="paste"
				label="Paste here"
				shortcut="Ctrl+V"
				description="Objects, roads or areas copied here or in another world"
				onClick={() => pasteFromClipboard({ at: spot() })}
			/>

			<Menu.Separator />

			<Menu.Item icon="focus" label="Zoom here" onClick={() => store().framePoint(spot())} />

			<Menu.Item
				icon="camera"
				label="Save this view"
				description="As a viewpoint, listed in the Viewpoints tab"
				onClick={saveCurrentView}
			/>
		</ContextMenu>
	);
};
