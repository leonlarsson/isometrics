import {
	editGround,
	groundShapeIdOf,
	setGroundShape,
	updateGround,
	useGroundEditing,
	usePickedGround,
} from "#/editor/groundEditing";
import { GROUND_SHAPES, type TGroundShapeId } from "#/scene/groundShape";

import { Button, ButtonGroup } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { GroupLabel, Hint, resetToDefault, SliderField } from "./fields";

/** What the Shape chips choose: one of the shapes, or the ground's own once it's been reshaped. */
type TShapeChoice = TGroundShapeId | "own";

/**
 * A ground's shape (ADR-0155), in the World tab's Grounds panel, for the
 * picked ground: a shape in one click, filling its width and depth, how round
 * its corners are, and Move and shape it, which puts handles on it in the view.
 */
export const GroundShapeFields = () => {
	const ground = usePickedGround();
	const isShaping = useGroundEditing((s) => s.isOn);
	const shapeId = groundShapeIdOf(ground);
	const chips: { value: TShapeChoice; label: string }[] = [
		...GROUND_SHAPES.map((shape) => ({ value: shape.id, label: shape.name })),
		// Only once it's been reshaped by hand: then it's none of the above.
		...(shapeId === null ? [{ value: "own" as const, label: "Its own" }] : []),
	];
	// Rounder than half its shorter side would only round it less (each corner is limited by its sides).
	const mostRound = Math.max(1, Math.round(Math.min(ground.width, ground.depth) / 2));

	return (
		<>
			<GroupLabel>Shape</GroupLabel>

			<ChipGroup<TShapeChoice>
				label="Shape"
				size="sm"
				value={shapeId ?? "own"}
				chips={chips}
				onChange={(choice) => {
					if (choice !== "own") {
						setGroundShape(choice);
					}
				}}
			/>

			<SliderField
				label="Corner rounding"
				value={ground.cornerRadius}
				min={0}
				max={mostRound}
				step={0.5}
				onChange={(value) =>
					updateGround(
						(picked) => {
							picked.cornerRadius = value;
						},
						{ coalesce: `ground.${ground.id}.cornerRadius` },
					)
				}
				inherit={resetToDefault(
					ground.cornerRadius,
					0,
					() =>
						updateGround((picked) => {
							picked.cornerRadius = 0;
						}),
					"none",
				)}
				hint="How round each corner is, in grid units."
			/>

			<ButtonGroup>
				<Button
					size="sm"
					icon="area"
					variant={isShaping ? "primary" : "secondary"}
					onClick={() => editGround(!isShaping)}
				>
					{isShaping ? "Done moving and shaping" : "Move and shape it"}
				</Button>
			</ButtonGroup>

			<Hint>
				Move and shape it puts handles on it in the view: the arrows in its middle move it with
				everything on it, its corners reshape it, and the balls on its sides resize it.
			</Hint>
		</>
	);
};
