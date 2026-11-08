import { useState } from "react";

import {
	addGround,
	countGoingWith,
	editGround,
	pickGround,
	removeGround,
	resizeGround,
	updateGround,
	usePickedGround,
} from "#/editor/groundEditing";
import { useEditor } from "#/editor/store";
import { useThemePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { plural } from "#/scene/format";
import { GROUND } from "#/scene/ground";
import { groundName } from "#/scene/grounds";
import { changeColorSetting } from "#/scene/objectSettings";
import { GroundSchema } from "#/scene/schema";

import { Button, ButtonGroup, IconButton } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import {
	GroupLabel,
	Hint,
	resetToDefault,
	Section,
	SliderField,
	SwitchField,
	TextField,
} from "./fields";
import { GroundShapeFields } from "./GroundShapeFields";
import { List, ListItem } from "./List";
import { ColorSettingFields } from "./PartSettings";
import { GroundSurfaceFields } from "./SurfaceSettings";

const GROUND_DEFAULTS = GroundSchema.parse({});

/**
 * The world's grounds (ADR-0155), in the World tab: the list of them (pick one
 * to edit it; Add a ground), the picked one's settings (its name, size,
 * shape, height, thickness, look, whether it shows or is locked, Move and
 * shape it, Remove), and whether the editor keeps things on a ground.
 */
export const GroundsSection = ({ onRecentre }: { onRecentre: () => void }) => {
	const grounds = useEditor((s) => s.scene.grounds);
	const keepsThingsOnGround = useEditor((s) => s.scene.keepsThingsOnGround);
	const commit = useEditor((s) => s.commit);
	const ground = usePickedGround();
	const index = Math.max(
		0,
		grounds.findIndex((each) => each.id === ground.id),
	);
	const name = groundName(ground, index);
	const palette = useThemePalette();
	const data = useWorldData().values;
	const [removing, setRemoving] = useState<{ id: string; name: string; count: number } | null>(
		null,
	);
	const key = (field: string) => ({ coalesce: `ground.${ground.id}.${field}` });
	const several = grounds.length > 1;

	return (
		<Section
			id="world.ground"
			icon="layers"
			title={several ? "Grounds" : "Ground"}
			keywords="ground grounds island islands floating size floor base shape outline circle round rounded corners height altitude thickness move add remove surface texture textured pattern grass sand gravel paving concrete cobbles dirt snow"
		>
			{several && (
				<List>
					{grounds.map((each, i) => (
						<ListItem
							key={each.id}
							label={groundName(each, i)}
							meta={each.altitude > 0 ? `${each.altitude} up` : undefined}
							current={each.id === ground.id}
							muted={each.isHidden}
							onClick={() => pickGround(each.id)}
							actions={
								<IconButton
									icon={each.isHidden ? "eyeOff" : "eye"}
									label={
										each.isHidden ? `Show ${groundName(each, i)}` : `Hide ${groundName(each, i)}`
									}
									pressed={each.isHidden}
									onClick={() =>
										updateGround(
											(picked) => {
												picked.isHidden = !picked.isHidden;
											},
											undefined,
											each.id,
										)
									}
								/>
							}
						/>
					))}
				</List>
			)}

			<ButtonGroup>
				<Button size="sm" icon="plus" onClick={() => editGround(true, addGround())}>
					Add a ground
				</Button>
			</ButtonGroup>

			<Hint>
				{several
					? "Pick one to change it, or click a ground in the view. Things stand on whichever ground they're on, and move with it."
					: "Add another for floating islands or a second town: it starts beside this one, to move where you like, with bridges between them."}
			</Hint>

			{several && <GroupLabel>{name}</GroupLabel>}

			<TextField
				inherit={resetToDefault(
					ground.name,
					"",
					() =>
						updateGround((picked) => {
							picked.name = "";
						}),
					name,
				)}
				label="Name"
				value={ground.name}
				placeholder={groundName({ name: "" }, index)}
				onChange={(value) =>
					updateGround((picked) => {
						picked.name = value;
					}, key("name"))
				}
			/>

			<SliderField
				inherit={resetToDefault(ground.width, GROUND_DEFAULTS.width, () =>
					resizeGround(GROUND_DEFAULTS.width, ground.depth),
				)}
				label="Width"
				value={ground.width}
				min={8}
				max={500}
				step={1}
				onChange={(v) => resizeGround(v, ground.depth, key("width"))}
			/>

			<SliderField
				inherit={resetToDefault(ground.depth, GROUND_DEFAULTS.depth, () =>
					resizeGround(ground.width, GROUND_DEFAULTS.depth),
				)}
				label="Depth"
				value={ground.depth}
				min={8}
				max={500}
				step={1}
				onChange={(v) => resizeGround(ground.width, v, key("depth"))}
				hint={ground.points ? "Its shape stretches to fill the width and depth." : undefined}
			/>

			<GroundShapeFields />

			<SliderField
				inherit={resetToDefault(ground.altitude, GROUND_DEFAULTS.altitude, () =>
					updateGround((picked) => {
						picked.altitude = GROUND_DEFAULTS.altitude;
					}),
				)}
				label="Altitude"
				value={ground.altitude}
				min={0}
				max={60}
				sliderMax={60}
				step={0.25}
				onChange={(v) =>
					updateGround((picked) => {
						picked.altitude = v;
					}, key("altitude"))
				}
				hint="How high its top is: a floating island above the others. What stands on it rises with it in Move and shape it."
			/>

			<SliderField
				inherit={resetToDefault(ground.thickness, GROUND_DEFAULTS.thickness, () =>
					updateGround((picked) => {
						picked.thickness = GROUND_DEFAULTS.thickness;
					}),
				)}
				label="Thickness"
				value={ground.thickness}
				min={0.2}
				max={50}
				sliderMax={20}
				step={0.1}
				onChange={(v) =>
					updateGround((picked) => {
						picked.thickness = v;
					}, key("thickness"))
				}
				hint="How deep its slab is under its top: a thin plate, or a deep block for an island."
			/>

			<ColorSettingFields
				spec={GROUND.colors[0]}
				setting={ground.colors.surface}
				data={data}
				palette={palette}
				onChange={(change, field) =>
					updateGround(
						(picked) => {
							changeColorSetting(picked.colors, "surface", change);
						},
						field ? key(`color.${field}`) : undefined,
					)
				}
			/>

			<GroundSurfaceFields />

			<SwitchField
				inherit={resetToDefault(ground.isHidden, false, () =>
					updateGround((picked) => {
						picked.isHidden = false;
					}),
				)}
				label="Show it"
				checked={!ground.isHidden}
				onChange={(shown) =>
					updateGround((picked) => {
						picked.isHidden = !shown;
					})
				}
				hint={
					ground.isHidden
						? "Hidden: nothing stands on it and it isn't drawn (a dashed outline while editing), for floating islands without the ground under them. It still counts for the world's size."
						: undefined
				}
			/>

			<SwitchField
				inherit={resetToDefault(ground.isLocked, false, () =>
					updateGround((picked) => {
						picked.isLocked = false;
					}),
				)}
				label="Locked"
				checked={ground.isLocked}
				onChange={(locked) =>
					updateGround((picked) => {
						picked.isLocked = locked;
					})
				}
				hint={ground.isLocked ? "It can't be moved or reshaped in the view." : undefined}
			/>

			<ButtonGroup>
				<Button
					size="sm"
					icon="trash"
					disabled={!several}
					onClick={() =>
						setRemoving({
							id: ground.id,
							name,
							count: countGoingWith(useEditor.getState().scene, ground.id),
						})
					}
				>
					Remove this ground…
				</Button>

				<Button size="sm" icon="focus" onClick={onRecentre}>
					Re-centre camera
				</Button>
			</ButtonGroup>

			{!several && <Hint>A world keeps at least one ground: add another to remove this one.</Hint>}

			<SwitchField
				inherit={resetToDefault(keepsThingsOnGround, true, () =>
					commit((s) => {
						s.keepsThingsOnGround = true;
					}),
				)}
				label="Keep things on a ground"
				checked={keepsThingsOnGround}
				onChange={(keeps) =>
					commit((s) => {
						s.keepsThingsOnGround = keeps;
					})
				}
				hint={
					keepsThingsOnGround
						? "Objects, roads and fences dropped or dragged past a ground's edge come back onto it; roads still cross between grounds, as bridges."
						: "Off: objects, roads and fences can go anywhere in the world, over empty space too."
				}
			/>

			<ConfirmDialog
				open={removing !== null}
				onOpenChange={(open) => {
					if (!open) {
						setRemoving(null);
					}
				}}
				title={`Remove ${removing?.name ?? "this ground"}?`}
				description={
					removing && removing.count > 0
						? `The ${plural(removing.count, "thing")} standing wholly on it go with it; a road or fence crossing to another ground stays. Undo (Ctrl+Z) brings it all back.`
						: "Nothing stands on it. Undo (Ctrl+Z) brings it back."
				}
				confirmLabel="Remove"
				danger
				onConfirm={() => {
					if (removing) {
						removeGround(removing.id);
					}
					setRemoving(null);
				}}
			/>
		</Section>
	);
};
