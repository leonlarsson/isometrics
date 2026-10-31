import type { Draft } from "immer";

import { useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { type TWeatherDataTarget, weatherNow } from "#/editor/weather";
import { useWorldData } from "#/editor/worldData";
import type { TBindingKind } from "#/parts/dataBinding";
import { type TDataBinding, type TScene, type TWeather, WeatherSchema } from "#/scene/schema";
import { skyLookAt } from "#/scene/sky";

import { Button, ButtonGroup } from "./Button";
import { DataDrivenField } from "./DataDrivenField";
import { FollowDataNote } from "./FollowDataNote";
import { ColorField, Hint, Section, SliderField, SwitchField } from "./fields";

const DEFAULTS = WeatherSchema.parse({});
const AMOUNT: TBindingKind = "scale";

const percent = (amount: number) => `${Math.round(amount * 100)}%`;

/** The amounts a quick pick sets: nothing falling, no fog or haze, no lightning, unless it says. */
const CALM = {
	rainAmount: 0,
	snowAmount: 0,
	fogDensity: 0,
	hazeAmount: 0,
	lightningRate: 0,
} as const;

/** One click to a kind of weather: its amounts, and the clouds that go with it. */
const QUICK_PICKS: { label: string; weather: Partial<TWeather> }[] = [
	{ label: "Clear", weather: { cloudCover: 0.15 } },
	{ label: "Cloudy", weather: { cloudCover: 0.85 } },
	{ label: "Rain", weather: { rainAmount: 0.6, cloudCover: 0.9 } },
	{
		label: "Storm",
		weather: { rainAmount: 0.95, lightningRate: 0.6, fogDensity: 0.15, cloudCover: 1 },
	},
	{ label: "Snow", weather: { snowAmount: 0.6, cloudCover: 0.8 } },
	{ label: "Fog", weather: { fogDensity: 0.7, cloudCover: 0.5 } },
];

/**
 * The Weather tab (ADR-0102): quick picks, then rain and snow, fog and haze,
 * what's on the ground, lightning, the clouds and whether
 * weather softens the light. Every amount can follow a data value.
 */
export const WeatherTab = () => {
	const weather = useEditor((s) => s.scene.weather);
	const sky = useEditor((s) => s.scene.sky);
	const lighting = useEditor((s) => s.scene.lighting);
	const data = useWorldData().values;
	const perspective = useEditor((s) => s.projection === "perspective");
	const commit = useEditor((s) => s.commit);
	const hours = useSceneHours();
	const now = weatherNow(weather, data);
	// The clouds' colour as the light tints them, for the Cloud colour field's default.
	const look = skyLookAt(lighting, sky, hours, { ...now, cloudColor: null });

	const set = <K extends keyof TWeather>(key: K, value: TWeather[K], coalesce?: boolean) =>
		commit(
			(s: Draft<TScene>) => {
				s.weather[key] = value;
			},
			coalesce ? { coalesce: `weather.${key}` } : undefined,
		);
	/** A setting with a plain default: Default until changed, then Reset. */
	const byDefault = <K extends keyof TWeather>(key: K, value: string) => ({
		from: "default",
		inherited: weather[key] === DEFAULTS[key],
		onReset: () => set(key, DEFAULTS[key]),
		value,
	});
	const onBindingChange =
		(target: TWeatherDataTarget) => (binding: TDataBinding | null, coalesce?: string) =>
			commit(
				(s: Draft<TScene>) => {
					if (binding) {
						s.weather.data[target] = binding;
					} else {
						delete s.weather.data[target];
					}
				},
				coalesce ? { coalesce: `weather.data.${target}.${coalesce}` } : undefined,
			);
	/** An amount set by hand or from data, 0–100%. */
	const amountField = (key: TWeatherDataTarget, label: string, hint: string) => (
		<DataDrivenField
			kind={AMOUNT}
			binding={weather.data[key]}
			data={data}
			onBindingChange={onBindingChange(key)}
			formatScale={percent}
			max={1}
		>
			<SliderField
				label={label}
				value={Math.round(weather[key] * 100)}
				min={0}
				max={100}
				step={5}
				suffix="%"
				onChange={(value) => set(key, value / 100, true)}
				inherit={byDefault(key, percent(DEFAULTS[key]))}
				hint={hint}
			/>
		</DataDrivenField>
	);
	const pick = (choice: (typeof QUICK_PICKS)[number]) =>
		commit((s: Draft<TScene>) => {
			Object.assign(s.weather, CALM, choice.weather, { groundWetness: null, snowCover: null });
		});

	return (
		<>
			<FollowDataNote title="Weather from data">
				Clouds, rain, snow, fog, haze and lightning can follow a data value (a rain gauge, a
				forecast).
			</FollowDataNote>

			<Section
				id="weather.picks"
				icon="rain"
				title="Weather"
				keywords="weather clear cloudy rain storm snow fog preset"
			>
				<ButtonGroup>
					{QUICK_PICKS.map((choice) => (
						<Button key={choice.label} size="sm" onClick={() => pick(choice)}>
							{choice.label}
						</Button>
					))}
				</ButtonGroup>

				<Hint>
					One click sets the amounts below and the clouds; fine-tune them after. Moods keep the
					weather too.
				</Hint>
			</Section>

			<Section
				id="weather.falling"
				defaultClosed
				icon="rain"
				title="Rain and snow"
				keywords="rain snow drops flakes splashes downpour blizzard sleet"
			>
				{amountField("rainAmount", "Rain", "0% is dry, 100% a downpour.")}

				<SwitchField
					label="Show splashes where drops land"
					checked={weather.showsSplashes}
					onChange={(shown) => set("showsSplashes", shown)}
					inherit={byDefault("showsSplashes", "on")}
				/>

				{amountField("snowAmount", "Snow", "0% is none, 100% a blizzard. With rain, it's sleet.")}
			</Section>

			<Section
				id="weather.fog"
				defaultClosed
				icon="cloud"
				title="Fog and haze"
				keywords="fog mist haze smog visibility distance"
			>
				{amountField(
					"fogDensity",
					"Fog",
					"Thicker fog comes closer: in the diorama, it fogs from the far side.",
				)}

				{amountField(
					"hazeAmount",
					"Haze",
					"A pale veil over the distance: dust, smog or a hot day.",
				)}
			</Section>

			<Section
				id="weather.ground"
				defaultClosed
				icon="area"
				title="On the ground"
				keywords="wet ground puddles snow cover settled white roofs"
			>
				<SliderField
					label="Wet ground"
					value={Math.round(now.wetness * 100)}
					min={0}
					max={100}
					step={5}
					suffix="%"
					onChange={(value) => set("groundWetness", value / 100, true)}
					inherit={{
						from: "rain",
						inherited: weather.groundWetness === null,
						onReset: () => set("groundWetness", null),
						value: percent(now.wetness),
					}}
					hint="Darker and a little glossy. Stays after the rain if you set it."
				/>

				<SliderField
					label="Snow on the ground"
					value={Math.round(now.snowCover * 100)}
					min={0}
					max={100}
					step={5}
					suffix="%"
					onChange={(value) => set("snowCover", value / 100, true)}
					inherit={{
						from: "snowfall",
						inherited: weather.snowCover === null,
						onReset: () => set("snowCover", null),
						value: percent(now.snowCover),
					}}
					hint="Settles on what faces up: roofs, grass, roads, treetops. Water stays clear."
				/>
			</Section>

			<Section
				id="weather.lightning"
				defaultClosed
				icon="alert"
				title="Lightning"
				keywords="lightning thunder storm flash"
			>
				{amountField(
					"lightningRate",
					"Lightning",
					"How often it flashes: 100% is every few seconds. Pausing holds it.",
				)}
			</Section>

			<Section
				id="weather.clouds"
				defaultClosed
				icon="cloud"
				title="Clouds"
				keywords="clouds cloud cover colour speed sky"
			>
				{amountField("cloudCover", "Cloud cover", "0% is a clear sky.")}

				{now.cloudCover > 0 && (
					<>
						<ColorField
							label="Cloud colour"
							value={weather.cloudColor ?? look.cloudColor}
							onChange={(color) => set("cloudColor", color, true)}
							inherit={{
								from:
									lighting.time === null && lighting.timeSource === "fixed"
										? "default"
										: "time of day",
								inherited: weather.cloudColor === null,
								onReset: () => set("cloudColor", null),
								value: look.cloudColor,
							}}
						/>

						<SliderField
							label="Cloud speed"
							value={weather.cloudSpeed}
							min={0}
							max={5}
							step={0.1}
							suffix="×"
							onChange={(value) => set("cloudSpeed", value, true)}
							inherit={byDefault("cloudSpeed", `${DEFAULTS.cloudSpeed}×`)}
						/>
					</>
				)}

				{!perspective && (
					<Hint>Clouds float round the world in perspective; the diorama shows the backdrop.</Hint>
				)}
			</Section>

			<Section
				id="weather.light"
				defaultClosed
				icon="sun"
				title="Light"
				keywords="overcast soften light shadows grey sky"
			>
				<SwitchField
					label="Weather softens the light"
					checked={weather.softensLight}
					onChange={(on) => set("softensLight", on)}
					inherit={byDefault("softensLight", "on")}
					hint="Rain, snow and fog make it overcast: the sun dims, shadows soften and the sky greys, more as they grow."
				/>
			</Section>
		</>
	);
};
