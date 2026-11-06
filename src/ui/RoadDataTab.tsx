import { ROAD_DATA_SETTINGS, type TRoadDataSetting, valuesOfRoad } from "#/editor/roadFlows";
import { useEditor } from "#/editor/store";
import { useUsesData, useWorldData } from "#/editor/worldData";
import { PARTS, partName } from "#/parts/registry";
import { roadNetworkOf } from "#/scene/junctions";
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

/** What a road reads (its values and row) and how a setting of it is set to follow data. */
const useRoadBindings = (road: TRoad) => {
	const updateRoad = useEditor((s) => s.updateRoad);
	const values = valuesOfRoad(road, useWorldData());
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
	return { values, setBinding };
};

/**
 * A road's flow (ADR-0112): vehicles each way, how many by hand or from data, or background
 * traffic that drives on through its junctions (ADR-0147). In the road's Data tab, or in its Road
 * tab in a world that doesn't use data (ADR-0115), whose Data tabs are gone: background traffic is
 * for city builders too.
 */
export const RoadFlowSection = ({ road }: { road: TRoad }) => {
	const updateRoad = useEditor((s) => s.updateRoad);
	const usesData = useUsesData();
	// Whether it has a junction at an end, which its flow needs to drive on (ADR-0147).
	const isJoined = useEditor((s) =>
		roadNetworkOf(s.scene.roads, s.scene.junctions).connects(road.id),
	);
	const drivesOn = road.flow.drivesThroughJunctions && isJoined;
	const { values, setBinding } = useRoadBindings(road);
	const editFlow = (field: string, change: Partial<TRoad["flow"]>) =>
		updateRoad(
			road.id,
			(draft) => {
				Object.assign(draft.flow, change);
			},
			{ coalesce: `${road.id}:flow:${field}` },
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
		<Section
			id="data.flow"
			icon="traffic"
			title="Flow"
			keywords="flow traffic vehicles direction amount from to data arrows junctions background busy"
			actions={
				<SwitchField
					label="Show"
					checked={road.flow.enabled}
					onChange={(enabled) => editFlow("enabled", { enabled })}
					inherit={{ ...reset("enabled"), isCompact: true }}
				/>
			}
		>
			{road.flow.enabled ? (
				<>
					{drivesOn ? (
						<Hint>
							Background traffic: its vehicles start on this road, then drive on through its
							junctions, picking a way at each and turning round at dead ends. The counts are how
							many start here.
						</Hint>
					) : (
						<Hint>
							Vehicles show how much goes each way: more vehicles, more flow; they drive the way it
							goes, and arrows on the road point the bigger way.
						</Hint>
					)}

					<SwitchField
						label={
							isJoined
								? "Drive through junctions onto other roads"
								: "Drive through junctions onto other roads (no junction at its ends)"
						}
						checked={road.flow.drivesThroughJunctions}
						onChange={(drivesThroughJunctions) =>
							editFlow("drivesThroughJunctions", { drivesThroughJunctions })
						}
						inherit={reset("drivesThroughJunctions")}
						disabled={!isJoined}
						hint={
							isJoined
								? "Busy streets without placing vehicles. Off, they keep to this road and show its amount."
								: "Connect an end of this road to another road for its vehicles to drive on."
						}
					/>

					<SelectField
						label="Vehicle"
						value={road.flow.vehicleKind}
						options={VEHICLE_OPTIONS}
						onChange={(vehicleKind) => editFlow("vehicleKind", { vehicleKind })}
						inherit={reset("vehicleKind")}
					/>

					{count("vehicleCountAlong", "Along its points")}

					{count("vehicleCountAgainst", "The other way")}

					<SliderField
						label="Vehicle size"
						value={road.flow.vehicleScale}
						min={0.1}
						max={4}
						step={0.05}
						onChange={(vehicleScale) => editFlow("vehicleScale", { vehicleScale })}
						inherit={reset("vehicleScale")}
						hint="How big its vehicles are drawn: smaller on a map drawn smaller than them, like a whole city."
					/>

					<DataDrivenField
						kind="range"
						binding={road.data.vehicleDensity}
						data={values}
						range={ROAD_DATA_SETTINGS.vehicleDensity}
						onBindingChange={(binding, coalesce) => setBinding("vehicleDensity", binding, coalesce)}
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
						label={
							drivesOn
								? "Arrows on the road (none while its vehicles drive on)"
								: "Arrows on the road"
						}
						checked={road.flow.showsArrows}
						onChange={(showsArrows) => editFlow("showsArrows", { showsArrows })}
						inherit={reset("showsArrows")}
						disabled={drivesOn}
					/>
				</>
			) : usesData ? (
				<Hint>
					Show a flow along this road: vehicles from its first point to its last and back, as many
					as a value or a column of its row says (goods between depots, people between depots), or
					background traffic that drives on through its junctions.
				</Hint>
			) : (
				<Hint>
					Show vehicles along this road without placing them: from its first point to its last and
					back, or background traffic that drives on through its junctions.
				</Hint>
			)}
		</Section>
	);
};

/**
 * A road's Data tab (ADR-0108, ADR-0112): the table row it follows (a "from,
 * to, amount" table), its flow and its width from data.
 */
export const RoadDataTab = ({ road }: { road: TRoad }) => {
	const updateRoad = useEditor((s) => s.updateRoad);
	const { values, setBinding } = useRoadBindings(road);

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

			<RoadFlowSection road={road} />

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
