import type { ReactNode } from "react";

import type { TBindingKind } from "#/parts/dataBinding";
import { DataBindingSchema, type TDataBinding, type TDataEntry } from "#/scene/schema";

import { DataBindingFields } from "./DataBindingFields";
import { resetToDefault, SelectField } from "./fields";

interface IDataDrivenFieldProps {
	/** How the setting reads a data value: switched on and off, a number, or a colour. */
	kind: TBindingKind;
	/** Its binding while it follows data. */
	binding: TDataBinding | undefined;
	data: readonly TDataEntry[];
	/**
	 * Start following data (a binding), stop (null) or change the binding.
	 * `coalesce` names the option being typed, so it's one undo step.
	 */
	onBindingChange: (binding: TDataBinding | null, coalesce?: string) => void;
	/** Numbers: how a reading shows, e.g. as a percentage. */
	formatScale?: (reading: number) => string;
	/** Numbers: the most a reading goes to. */
	max?: number;
	/** The field that sets it by hand. */
	children: ReactNode;
	/** Several things are selected and follow data differently (ADR-0064): Source says Mixed. */
	mixed?: boolean;
}

type TSource = "hand" | "data";

/**
 * A setting that can be set by hand or follow a data value (ADR-0058,
 * ADR-0060): a Source select (By hand / From data), then the hand field or the
 * shared DataBindingFields. Without data values From data is greyed out
 * ("no values yet"); a FollowDataNote at the top of the tab says why. Use it
 * for any setting that can follow data.
 */
export const DataDrivenField = ({
	kind,
	binding,
	data,
	onBindingChange,
	formatScale,
	max,
	children,
	mixed,
}: IDataDrivenFieldProps) => {
	const hasData = data.length > 0;
	return (
		<>
			<SelectField<TSource>
				label="Source"
				value={binding ? "data" : "hand"}
				mixed={mixed}
				options={[
					{ value: "hand", label: "By hand" },
					{
						value: "data",
						label: hasData ? "From data" : "From data (no values yet)",
						disabled: !hasData,
					},
				]}
				onChange={(source) =>
					onBindingChange(
						source === "data" ? DataBindingSchema.parse({ key: data[0]?.key ?? "" }) : null,
					)
				}
				inherit={resetToDefault(
					binding ? "data" : "hand",
					"hand",
					() => onBindingChange(null),
					"by hand",
				)}
			/>

			{binding ? (
				<DataBindingFields
					kind={kind}
					binding={binding}
					data={data}
					onChange={onBindingChange}
					formatScale={formatScale}
					max={max}
				/>
			) : (
				children
			)}
		</>
	);
};
