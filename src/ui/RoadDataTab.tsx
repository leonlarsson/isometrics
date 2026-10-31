import { ROAD_DATA_SETTINGS, type TRoadDataSetting, valuesOfRoad } from "#/editor/roadFlows";
import { useEditor } from "#/editor/store";
import { useWorldData } from "#/editor/worldData";
import { PARTS, partName } from "#/parts/registry";
import { RoadFlowSchema, type TDataBinding, type TRoad } from "#/scene/schema";

import { DataDrivenField } from "./DataDrivenField";
import { TableRowSection } from "./EntityDataTab";
import { Hint, resetsAgainst, Section, SelectField, SliderField, SwitchField } from "./fields";

/** A road's flow as a new road has it, for Default / Reset. */
const FLOW_DEFAULTS = RoadFlowSchema.parse({});

/** The vehicles a flow can drive: parts that follow routes. */
const VEHICLE_OPTIONS = PARTS.filter((part) => part.canFollowPath).map((part) => ({
	value: part.kind,
	label: partName(part),
}));

/**
 * A road's Data tab (ADR-0108, ADR-0112): the table row it follows (a "from,
 * to, amount" table), its flow (vehicles each way, how many from data) and its
 * width from data.
 */
export const RoadDataTab = ({ road }: { road: TRoad }) => {
	const updateRoad = useEditor((s) => s.updateRoad);
	const values = valuesOfRoad(road, useWorldData());
	const editFlow = (field: string, change: Partial<TRoad["flow"]>) =>
		updateRoad(
			road.id,
			(draft) => {
				Object.assign(draft.flow, change);
			},
			{ coalesce: `${road.id}:flow:${field}` },
		);
	const setBinding = (setting: TRoadDataSetting, binding: TDataBinding | null, coalesce?: string) =>
		updateRoad(
			road.id,
			(draft) => {
				if (binding) {
					draft.data[setting] = binding;
				} else {
					delete draft.data[setting];
				}
			},
			coalesce ? { coalesce: `${road.id}:data:${setting}:${coalesce}` } : undefined,
		);
	const reset = resetsAgainst(road.flow, FLOW_DEFAULTS, (key, value) =>
		editFlow(key, { [key]: value }),
	);
	const count = (setting: "vehicleCountAlong" | "vehicleCountAgainst", label: string) => (
		<DataDrivenField
			kind="range"
			binding={road.data[setting]}
			data={values}
			range={ROAD_DATA_SETTINGS[setting]}
			onBindingChange={(binding, coalesce) => setBinding(setting, binding, coalesce)}
		>
			<SliderField
				label={label}
				value={road.flow[setting]}
				min={0}
				max={40}
				step={1}
				onChange={(value) => editFlow(setting, { [setting]: value })}
				inherit={reset(setting)}
			/>
		</DataDrivenField>
	);

	return (
		<>
			<TableRowSection
				dataRow={road.dataRow}
				name={road.name}
				what="Its width, flow and colours"
				setRow={(next) =>
					updateRoad(road.id, (draft) => {
						draft.dataRow = next;
					})
				}
			/>

			<Section
				id="data.flow"
				icon="traffic"
				title="Flow"
				keywords="flow traffic vehicles direction amount from to data arrows"
				actions={
					<SwitchField
						label="Show"
						checked={road.flow.isOn}
						onChange={(isOn) => editFlow("isOn", { isOn })}
						inherit={{ ...reset("isOn"), isCompact: true }}
					/>
				}
			>
				{road.flow.isOn ? (
					<>
						<Hint>
							Vehicles show how much goes each way: more vehicles, more flow; they drive the way it
							goes, and arrows on the road point the bigger way.
						</Hint>

						<SelectField
							label="Vehicle"
							value={road.flow.vehicleKind}
							options={VEHICLE_OPTIONS}
							onChange={(vehicleKind) => editFlow("vehicleKind", { vehicleKind })}
							inherit={reset("vehicleKind")}
						/>

						{count("vehicleCountAlong", "Along its points")}

						{count("vehicleCountAgainst", "The other way")}

						<DataDrivenField
							kind="range"
							binding={road.data.vehicleDensity}
							data={values}
							range={ROAD_DATA_SETTINGS.vehicleDensity}
							onBindingChange={(binding, coalesce) =>
								setBinding("vehicleDensity", binding, coalesce)
							}
						>
							<SliderField
								label="Vehicles per 10 units"
								value={road.flow.vehicleDensity ?? 1}
								min={0.1}
								max={6}
								step={0.1}
								onChange={(vehicleDensity) => editFlow("vehicleDensity", { vehicleDensity })}
								inherit={{
									from: "default",
									inherited: road.flow.vehicleDensity === null,
									onReset: () => editFlow("vehicleDensity", { vehicleDensity: null }),
									value: "the counts above",
								}}
								hint="How busy it is each way, so short and long roads compare fairly; by default it has the counts above."
							/>
						</DataDrivenField>

						<SliderField
							label="Speed"
							value={road.flow.speed}
							min={0.2}
							max={20}
							step={0.1}
							onChange={(speed) => editFlow("speed", { speed })}
							inherit={reset("speed")}
						/>

						<SwitchField
							label="Arrows on the road"
							checked={road.flow.showsArrows}
							onChange={(showsArrows) => editFlow("showsArrows", { showsArrows })}
							inherit={reset("showsArrows")}
						/>
					</>
				) : (
					<Hint>
						Show a flow along this road: vehicles from its first point to its last and back, as many
						as a value or a column of its row says (players moving between games, goods between
						depots).
					</Hint>
				)}
			</Section>

			<Section id="data.width" icon="chart" title="Width from data" keywords="width data size">
				<DataDrivenField
					kind="range"
					binding={road.data.width}
					data={values}
					range={ROAD_DATA_SETTINGS.width}
					onBindingChange={(binding, coalesce) => setBinding("width", binding, coalesce)}
				>
					<Hint>Its width is set in the Shape tab; it can follow data here instead.</Hint>
				</DataDrivenField>
			</Section>
		</>
	);
};
