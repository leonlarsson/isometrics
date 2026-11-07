import type { Draft } from "immer";

import { useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { type TWeatherDataTarget, weatherNow } from "#/editor/weather";
import { useWorldData } from "#/editor/worldData";
import type { TBindingKind } from "#/parts/dataBinding";
import { percent } from "#/scene/format";
import {
	type TArea,
	type TDataBinding,
	type TScene,
	type TWeather,
	WeatherSchema,
} from "#/scene/schema";
import { skyLookAt } from "#/scene/sky";

import { Button, ButtonGroup } from "./Button";
import { DataDrivenField } from "./DataDrivenField";
import { FollowDataNote } from "./FollowDataNote";
import { ColorField, Hint, Section, SliderField, SwitchField } from "./fields";

const DEFAULTS = WeatherSchema.parse({});
const AMOUNT: TBindingKind = "scale";

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

interface IWeatherFieldsProps {
	weather: TWeather;
	/** Changes it; continuous edits (sliders) pass a key, so a drag is one undo step. */
	change: (recipe: (weather: Draft<TWeather>) => void, coalesce?: string) => void;
	/** Whose weather: the world's, or an area's own (ADR-0151), which words a few hints differently. */
	owner: "world" | "area";
	/** What its panels' ids start with, so the world's and an area's fold on their own. */
	panelIds: string;
}

/**
 * The weather's panels (ADR-0102): quick picks, then rain and snow, fog and
 * haze, what's on the ground, lightning, the clouds and whether weather
 * softens the light, every amount by hand or from a data value. The world's
 * Weather tab, and an area's when it has its own (ADR-0151).
 */
export const WeatherFields = ({ weather, change, owner, panelIds }: IWeatherFieldsProps) => {
	const sky = useEditor((s) => s.scene.sky);
	const lighting = useEditor((s) => s.scene.lighting);
	const data = useWorldData().values;
	const perspective = useEditor((s) => s.projection === "perspective");
	const hours = useSceneHours();
	const now = weatherNow(weather, data);
	const isArea = owner === "area";
	// The clouds' colour as the light tints them, for the Cloud colour field's default.
	const look = skyLookAt(lighting, sky, hours, { ...now, cloudColor: null });

	const set = <K extends keyof TWeather>(key: K, value: TWeather[K], coalesce?: boolean) =>
		change(
			(w) => {
				w[key] = value as Draft<TWeather>[K];
			},
			coalesce ? key : undefined,
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
			change(
				(w) => {
					if (binding) {
						w.data[target] = binding;
					} else {
						delete w.data[target];
					}
				},
				coalesce ? `data.${target}.${coalesce}` : undefined,
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
		change((w) => {
			Object.assign(w, CALM, choice.weather, { groundWetness: null, snowCover: null });
		});

	return (
		<>
			<Section
				id={`${panelIds}.picks`}
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
					{isArea
						? "One click sets the amounts below and the clouds; fine-tune them after. Moods keep the world's weather, not an area's."
						: "One click sets the amounts below and the clouds; fine-tune them after. Moods keep the weather too."}
				</Hint>
			</Section>

			<Section
				id={`${panelIds}.falling`}
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
				id={`${panelIds}.fog`}
				defaultClosed
				icon="cloud"
				title="Fog and haze"
				keywords="fog mist haze smog visibility distance"
			>
				{amountField(
					"fogDensity",
					"Fog",
					isArea
						? "Lies over what's in the area, thickest near the ground."
						: "Thicker fog comes closer: in the diorama, it fogs from the far side.",
				)}

				{amountField(
					"hazeAmount",
					"Haze",
					isArea
						? "A pale veil over what's in the area: dust or smog."
						: "A pale veil over the distance: dust, smog or a hot day.",
				)}
			</Section>

			<Section
				id={`${panelIds}.ground`}
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
				id={`${panelIds}.lightning`}
				defaultClosed
				icon="alert"
				title="Lightning"
				keywords="lightning thunder storm flash"
			>
				{amountField(
					"lightningRate",
					"Lightning",
					isArea
						? "How often it strikes inside the area, lighting what's round it: 100% is every few seconds. Pausing holds it."
						: "How often it flashes: 100% is every few seconds. Pausing holds it.",
				)}
			</Section>

			<Section
				id={`${panelIds}.clouds`}
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

				{isArea ? (
					<Hint>Its clouds gather over it, in both views.</Hint>
				) : (
					!perspective && (
						<Hint>
							Clouds float round the world in perspective; the diorama shows the backdrop.
						</Hint>
					)
				)}
			</Section>

			<Section
				id={`${panelIds}.light`}
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
					hint={
						isArea
							? "Rain, snow and fog darken the area under its clouds, more as they grow. The sky and the sun stay the world's."
							: "Rain, snow and fog make it overcast: the sun dims, shadows soften and the sky greys, more as they grow."
					}
				/>
			</Section>
		</>
	);
};

/** The world's Weather tab (ADR-0102). */
export const WeatherTab = () => {
	const weather = useEditor((s) => s.scene.weather);
	const commit = useEditor((s) => s.commit);

	return (
		<>
			<FollowDataNote title="Weather from data">
				Clouds, rain, snow, fog, haze and lightning can follow a data value (a rain gauge, a
				forecast).
			</FollowDataNote>

			<WeatherFields
				weather={weather}
				owner="world"
				panelIds="weather"
				change={(recipe, coalesce) =>
					commit(
						(s: Draft<TScene>) => {
							recipe(s.weather);
						},
						coalesce ? { coalesce: `weather.${coalesce}` } : undefined,
					)
				}
			/>
		</>
	);
};

/**
 * An area's Weather tab (ADR-0151): the world's weather until it has its own,
 * which starts as a copy of the world's and replaces it inside the area: a
 * storm over one district, or each region's weather showing a value.
 */
export const AreaWeatherTab = ({ area }: { area: TArea }) => {
	const updateArea = useEditor((s) => s.updateArea);
	const edit = (recipe: (a: Draft<TArea>) => void, coalesce?: string) =>
		updateArea(
			area.id,
			recipe,
			coalesce ? { coalesce: `${area.id}:weather.${coalesce}` } : undefined,
		);
	const ownsWeather = (owns: boolean) =>
		edit((a) => {
			a.weather = owns ? structuredClone(useEditor.getState().scene.weather) : null;
		});

	return (
		<>
			<FollowDataNote title="Its weather can follow data">
				An area's rain, snow, fog, clouds and lightning can follow a value in the Data tab, like a
				district that storms as complaints rise.
			</FollowDataNote>

			<Section
				id="area.weather"
				icon="rain"
				title="Its own weather"
				keywords="weather own local storm rain snow fog clouds lightning district zone sentiment"
			>
				<SwitchField
					label="Has its own weather"
					checked={area.weather !== null}
					onChange={ownsWeather}
					inherit={{
						from: "default",
						inherited: area.weather === null,
						onReset: () => ownsWeather(false),
						value: "the world's weather",
					}}
					hint={
						area.weather
							? "Inside the area, this weather replaces the world's; it fades out at the edge."
							: "Off, the area has the world's weather. On, it starts as a copy of the world's, for a storm, fog or snow in one place."
					}
				/>
			</Section>

			{area.weather && (
				<WeatherFields
					weather={area.weather}
					owner="area"
					panelIds="area.weather"
					change={(recipe, coalesce) =>
						edit((a) => {
							if (a.weather) {
								recipe(a.weather);
							}
						}, coalesce)
					}
				/>
			)}
		</>
	);
};
