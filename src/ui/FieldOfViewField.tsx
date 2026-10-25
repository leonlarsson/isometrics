import type { ReactNode } from "react";

import { useCameraFeel } from "#/editor/cameraFeel";
import { round } from "#/lib/math";
import { fieldOfViewOf, focalLengthOf } from "#/render/cameraMath";

import { SliderField } from "./fields";

interface IFieldOfViewFieldProps {
	/** The field of view in degrees, as the world stores it. */
	value: number;
	onChange: (degrees: number) => void;
	/** Default / Reset (ADR-0027), with the value it goes back to in degrees. */
	inherit?: { from: string; inherited: boolean; onReset: () => void; degrees: number };
	hint?: ReactNode;
}

/**
 * The perspective camera's field of view, in this browser's lens unit (Your
 * camera → Lens unit): the focal length of a full-frame lens in mm, as on a
 * real camera, or the angle from top to bottom in degrees. Either way the
 * world stores degrees. The slider covers the usual lenses; any other can be
 * typed (1°–170°, about 1375–1 mm).
 */
export const FieldOfViewField = ({ value, onChange, inherit, hint }: IFieldOfViewFieldProps) => {
	const millimetres = useCameraFeel().lensUnit === "millimetres";
	const shown = (degrees: number) =>
		millimetres ? `${round(focalLengthOf(degrees), 1)} mm` : `${round(degrees, 1)}°`;
	const common = {
		inherit: inherit && {
			from: inherit.from,
			inherited: inherit.inherited,
			onReset: inherit.onReset,
			value: shown(inherit.degrees),
		},
		hint,
	};
	return millimetres ? (
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
			{...common}
		/>
	) : (
		<SliderField
			label="Field of view"
			value={round(value, 1)}
			min={1}
			max={170}
			sliderMin={10}
			sliderMax={120}
			step={1}
			suffix="°"
			onChange={onChange}
			{...common}
		/>
	);
};
