import type { ReactNode } from "react";

import { round } from "#/lib/math";
import { fieldOfViewOf, focalLengthOf } from "#/render/cameraMath";

import { SliderField } from "./fields";

interface IFieldOfViewFieldProps {
	/** The field of view in degrees, as the world stores it. */
	value: number;
	onChange: (degrees: number) => void;
	/** Default / Reset (ADR-0027), with the value it goes back to in degrees. */
	inherit: { from: string; inherited: boolean; onReset: () => void; degrees: number };
	/** What the field is for, before the angle it gives. */
	hint?: ReactNode;
}

/**
 * The perspective camera's lens, as the focal length of a full-frame camera in
 * mm, with the angle it gives from top to bottom under it. The world stores
 * degrees. The slider covers the usual lenses; any other can be typed (about
 * 1–1375 mm, 170°–1°).
 */
export const FieldOfViewField = ({ value, onChange, inherit, hint }: IFieldOfViewFieldProps) => {
	const millimetres = (degrees: number) => `${round(focalLengthOf(degrees), 1)} mm`;
	return (
		<SliderField
			label="Focal length"
			value={round(focalLengthOf(value), 1)}
			min={1.05}
			max={1375}
			sliderMin={10}
			sliderMax={200}
			step={1}
			suffix="mm"
			onChange={(mm) => onChange(round(fieldOfViewOf(mm), 2))}
			inherit={{
				from: inherit.from,
				inherited: inherit.inherited,
				onReset: inherit.onReset,
				value: millimetres(inherit.degrees),
			}}
			hint={
				<>
					≈ {Math.round(value)}° from top to bottom. {hint}
				</>
			}
		/>
	);
};
