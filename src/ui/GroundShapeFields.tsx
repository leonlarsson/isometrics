import {
	groundShapeIdOf,
	setGroundShape,
	shapeGround,
	useGroundShaping,
} from "#/editor/groundShaping";
import { useEditor } from "#/editor/store";
import { GROUND_SHAPES, type TGroundShapeId } from "#/scene/groundShape";

import { Button, ButtonGroup } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { GroupLabel, Hint, resetToDefault, SliderField } from "./fields";

/** What the Shape chips choose: one of the shapes, or the ground's own once it's been reshaped. */
type TShapeChoice = TGroundShapeId | "own";

/**
 * The ground's shape (ADR-0155), in the World tab's Ground panel: a shape in
 * one click, filling its width and depth, how round its corners are, and
 * Shape the ground, which puts handles on its corners and sides in the view.
 */
export const GroundShapeFields = () => {
	const ground = useEditor((s) => s.scene.ground);
	const commit = useEditor((s) => s.commit);
	const isShaping = useGroundShaping((s) => s.isOn);
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
					commit(
						(s) => {
							s.ground.cornerRadius = value;
						},
						{ coalesce: "ground.cornerRadius" },
					)
				}
				inherit={resetToDefault(
					ground.cornerRadius,
					0,
					() =>
						commit((s) => {
							s.ground.cornerRadius = 0;
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
					onClick={() => shapeGround(!isShaping)}
				>
					{isShaping ? "Done shaping" : "Shape the ground"}
				</Button>
			</ButtonGroup>

			<Hint>
				Shape the ground puts handles on its corners in the view: drag them, add corners between
				them, or drag the rectangle's sides to resize it.
			</Hint>
		</>
	);
};
