import { restartDayCycle, useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { SWITCH_ON_DARKNESS } from "#/parts/lightModel";
import type { TLighting } from "#/scene/schema";
import { formatHour, skyLightAt } from "#/scene/sun";

import { FollowDataNote } from "./FollowDataNote";
import { ColorField, Hint, Section, SelectField, SliderField } from "./fields";
import { Icon } from "./Icon";
import { Menu } from "./Menu";
import { BackdropSection, SkySection } from "./SkySettings";

/** Times of day a click away. */
const PRESETS: { label: string; hour: number }[] = [
	{ label: "Dawn", hour: 6.3 },
	{ label: "Morning", hour: 9 },
	{ label: "Noon", hour: 12.75 },
	{ label: "Golden hour", hour: 18.6 },
	{ label: "Dusk", hour: 19.7 },
	{ label: "Night", hour: 23 },
];

const SOURCES: { value: TLighting["timeSource"]; label: string }[] = [
	{ value: "fixed", label: "A fixed time" },
	{ value: "cycle", label: "A day cycle" },
	{ value: "clock", label: "The viewer's clock" },
	{ value: "data", label: "From data" },
];

const LIGHTS_OPTIONS: { value: TLighting["whenLightsAreOn"]; label: string }[] = [
	{ value: "auto", label: "After dark" },
	{ value: "on", label: "Always" },
	{ value: "off", label: "Never" },
];

/**
 * The Sun & sky tab (ADR-0052, ADR-0054): the time of day and where it comes
 * from; the sun's direction, height, colour and strength, each following the
 * time of day (or the classic daylight without one) until it's set by hand;
 * the sky in perspective and the backdrop behind the diorama (ADR-0070); and
 * when lights come on.
 */
export const SkyTab = () => {
	const lighting = useEditor((s) => s.scene.lighting);
	const data = useEditor((s) => s.scene.data);
	const commit = useEditor((s) => s.commit);
	const hours = useSceneHours();
	// What the time of day gives each sun setting, shown while it isn't set by hand.
	const fromTime = skyLightAt(
		{ ...lighting, sunAzimuth: null, sunElevation: null, sunColor: null, sunStrength: null },
		hours,
	);
	const set = <K extends keyof TLighting>(key: K, value: TLighting[K], coalesce?: string) =>
		commit(
			(s) => {
				s.lighting[key] = value;
			},
			coalesce ? { coalesce: `lighting.${coalesce}` } : undefined,
		);
	const classic = lighting.time === null && lighting.timeSource === "fixed";
	// While a day runs, the slider shows the time it is now; picking a time jumps there and the day
	// goes on from it.
	const cycling = lighting.timeSource === "cycle";
	const setTime = (time: number, coalesce?: string) => {
		set("time", time, coalesce);
		if (cycling) {
			restartDayCycle();
		}
	};
	// Each sun setting follows the time of day, or the classic daylight ("Default") without one.
	const following = (
		key: "sunAzimuth" | "sunElevation" | "sunColor" | "sunStrength",
		value: string,
	) => ({
		from: classic ? "default" : "time of day",
		inherited: lighting[key] === null,
		onReset: () => set(key, null),
		value,
	});

	return (
		<>
			<FollowDataNote title="The time can follow data">
				The time of day can come from a value in the Data tab, like the hour a sensor reports.
			</FollowDataNote>

			<Section
				id="sky.time"
				icon="clock"
				// The world's time in the title while it has one, so nothing jumps in and out below.
				title={hours === null ? "Time of day" : `Time of day · ${formatHour(hours)}`}
				keywords="time of day night cycle clock presets dawn noon dusk"
				actions={
					// Shortcuts to times with a distinctive light, for the time slider below.
					(lighting.timeSource === "fixed" || cycling) && (
						<Menu.Root>
							<Menu.Trigger label="Preset times" tooltip="Preset times" iconOnly>
								<Icon name="sun" size={16} />
							</Menu.Trigger>

							<Menu.Popup>
								{PRESETS.map((preset) => (
									<Menu.Item
										key={preset.label}
										label={preset.label}
										description={formatHour(preset.hour)}
										onClick={() => setTime(preset.hour)}
									/>
								))}
							</Menu.Popup>
						</Menu.Root>
					)
				}
			>
				{/* First: it decides what the rest of the panel means. */}
				<SelectField<TLighting["timeSource"]>
					label="Time follows"
					value={lighting.timeSource}
					// Without data values From data is greyed out, saying why (Time from explains below).
					options={SOURCES.map((source) =>
						source.value === "data" && data.length === 0 && lighting.timeSource !== "data"
							? { ...source, label: "From data (no values yet)", disabled: true }
							: source,
					)}
					onChange={(timeSource) => set("timeSource", timeSource)}
				/>

				{(lighting.timeSource === "fixed" || lighting.timeSource === "cycle") && (
					<>
						<SliderField
							label="Time of day"
							value={cycling && hours !== null ? hours : (lighting.time ?? 12.75)}
							min={0}
							max={24}
							step={0.25}
							clock
							onChange={(time) => setTime(time, "time")}
							inherit={{
								from: "default",
								inherited: lighting.time === null,
								onReset: () => set("time", null),
								value: "classic daylight",
							}}
							hint={
								classic
									? "Classic daylight: the sun stays where it is. Pick a time to light the world by it, with lit windows and lamps at night."
									: undefined
							}
						/>
					</>
				)}

				{lighting.timeSource === "cycle" && (
					<SliderField
						label="A day lasts"
						value={lighting.dayLength}
						min={10}
						max={600}
						step={5}
						suffix="s"
						onChange={(dayLength) => set("dayLength", dayLength, "dayLength")}
						hint="Days pass while motion plays (Space). Pick a time above to jump there."
					/>
				)}

				{lighting.timeSource === "data" && (
					<>
						<SelectField
							label="Time from"
							value={lighting.timeKey ?? ""}
							options={[
								{ value: "", label: "Choose a data value…" },
								...data.map((entry) => ({ value: entry.key, label: entry.label || entry.key })),
							]}
							onChange={(key) => set("timeKey", key || null)}
							hint="Its value is the hour, 0–24 (e.g. 18.5 = 18:30)."
						/>

						<SliderField
							label="Without a value"
							value={lighting.time ?? 12.75}
							min={0}
							max={24}
							step={0.25}
							clock
							onChange={(time) => set("time", time, "time")}
							inherit={{
								from: "default",
								inherited: lighting.time === null,
								onReset: () => set("time", null),
								value: "classic daylight",
							}}
							hint="The time while the data value is missing or isn't an hour."
						/>
					</>
				)}
			</Section>

			<Section id="sky.sun" icon="sun" title="Sun" keywords="light shadow">
				<SliderField
					label="Sun direction"
					value={lighting.sunAzimuth ?? Math.round(fromTime.azimuth)}
					min={0}
					max={360}
					step={1}
					suffix="°"
					onChange={(azimuth) => set("sunAzimuth", azimuth, "sunAzimuth")}
					inherit={following("sunAzimuth", `${Math.round(fromTime.azimuth)}°`)}
				/>

				<SliderField
					label="Sun height"
					value={lighting.sunElevation ?? Math.round(fromTime.elevation)}
					min={2}
					max={90}
					step={1}
					suffix="°"
					onChange={(elevation) => set("sunElevation", elevation, "sunElevation")}
					inherit={following("sunElevation", `${Math.round(fromTime.elevation)}°`)}
				/>

				<ColorField
					label="Sunlight colour"
					value={lighting.sunColor ?? fromTime.color}
					onChange={(color) => set("sunColor", color, "sunColor")}
					inherit={following("sunColor", fromTime.color)}
				/>

				<SliderField
					label="Sunlight strength"
					value={lighting.sunStrength ?? Math.round(fromTime.strength * 100) / 100}
					min={0}
					max={3}
					step={0.05}
					suffix="×"
					onChange={(strength) => set("sunStrength", strength, "sunStrength")}
					inherit={following("sunStrength", `${Math.round(fromTime.strength * 100) / 100}×`)}
				/>
			</Section>

			<SkySection />

			<BackdropSection />

			<Section id="sky.lights" icon="bulb" title="Lights" keywords="night windows lamps headlights">
				<SelectField<TLighting["whenLightsAreOn"]>
					label="Lit windows, lamps and headlights"
					value={lighting.whenLightsAreOn}
					options={LIGHTS_OPTIONS}
					onChange={(lights) => set("whenLightsAreOn", lights)}
				/>

				{fromTime.night >= SWITCH_ON_DARKNESS && lighting.whenLightsAreOn === "auto" && (
					<Hint>It's dark: lights that turn on after dark are on.</Hint>
				)}
			</Section>
		</>
	);
};
