import type { Draft } from "immer";

import { useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { useResolvedTheme } from "#/editor/useTheme";
import { SkySchema, type TBackdrop, type TScene, type TSky } from "#/scene/schema";
import { skyColorsAt, skyLookAt } from "#/scene/sky";

import { Button } from "./Button";
import { ColorField, Hint, Section, SelectField, SliderField, SwitchField } from "./fields";
import { WaterSection } from "./WaterSettings";

const SKY_DEFAULTS = SkySchema.parse({});

const BACKDROPS: { value: TBackdrop["kind"]; label: string }[] = [
	{ value: "sky", label: "The sky’s colour" },
	{ value: "color", label: "A colour" },
	{ value: "gradient", label: "A gradient" },
	{ value: "greenScreen", label: "Green screen" },
];

/** The theme's background (the backdrop's colours fall back to it), as #rrggbb. */
const useThemeBackground = () => {
	useResolvedTheme();
	return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#efede8";
};

const percent = (amount: number) => `${Math.round(amount * 100)}%`;

/**
 * The sky around the world in perspective (ADR-0070): whether it's drawn, its
 * colours (following the time of day until set), the sun and moon, stars and
 * clouds. Every setting shows Default / From time of day and offers Reset.
 */
export const SkySection = () => {
	const sky = useEditor((s) => s.scene.sky);
	const lighting = useEditor((s) => s.scene.lighting);
	const perspective = useEditor((s) => s.projection === "perspective");
	const commit = useEditor((s) => s.commit);
	const hours = useSceneHours();
	const classic = lighting.time === null && lighting.timeSource === "fixed";
	const fromTime = skyColorsAt(hours);
	const look = skyLookAt(lighting, { ...sky, cloudColor: null }, hours);
	const set = <K extends keyof TSky>(key: K, value: TSky[K], coalesce?: boolean) =>
		commit(
			(s: Draft<TScene>) => {
				s.sky[key] = value;
			},
			coalesce ? { coalesce: `sky.${key}` } : undefined,
		);
	/** A setting with a plain default: Default until changed, then Reset. */
	const byDefault = <K extends keyof TSky>(key: K, value: string) => ({
		from: "default",
		inherited: sky[key] === SKY_DEFAULTS[key],
		onReset: () => set(key, SKY_DEFAULTS[key]),
		value,
	});
	/** A colour that follows the time of day (or the classic daylight) until it's set. */
	const following = (key: "colorOverhead" | "colorAtHorizon" | "cloudColor", value: string) => ({
		from: classic ? "default" : "time of day",
		inherited: sky[key] === null,
		onReset: () => set(key, null),
		value,
	});

	return (
		<Section
			id="sky.perspective"
			icon="cloud"
			title="Sky"
			keywords="dome perspective horizon clouds stars sun moon colour"
		>
			<SwitchField
				label="Show the sky in perspective"
				checked={sky.showInPerspective}
				onChange={(shown) => set("showInPerspective", shown)}
				inherit={byDefault("showInPerspective", "on")}
				hint="Around the world when you look in perspective. Off, perspective shows the backdrop below too, as it always does with a green screen."
			/>

			{sky.showInPerspective && (
				<>
					<ColorField
						label="Colour overhead"
						value={sky.colorOverhead ?? fromTime.colorOverhead}
						onChange={(color) => set("colorOverhead", color, true)}
						inherit={following("colorOverhead", fromTime.colorOverhead)}
					/>

					<ColorField
						label="Colour at the horizon"
						value={sky.colorAtHorizon ?? fromTime.colorAtHorizon}
						onChange={(color) => set("colorAtHorizon", color, true)}
						inherit={following("colorAtHorizon", fromTime.colorAtHorizon)}
					/>

					<Hint>Colours set here are the sky’s by day; at night it darkens anyway.</Hint>

					<SwitchField
						label="Show the sun in the sky"
						checked={sky.showSun}
						onChange={(shown) => set("showSun", shown)}
						inherit={byDefault("showSun", "on")}
						hint="By day, where the sunlight comes from."
					/>

					<SwitchField
						label="Show the moon in the sky"
						checked={sky.showMoon}
						onChange={(shown) => set("showMoon", shown)}
						inherit={byDefault("showMoon", "on")}
						hint="At night, opposite the sun."
					/>

					<SliderField
						label="Stars at night"
						value={Math.round(sky.starDensity * 100)}
						min={0}
						max={100}
						step={5}
						suffix="%"
						onChange={(value) => set("starDensity", value / 100, true)}
						inherit={byDefault("starDensity", percent(SKY_DEFAULTS.starDensity))}
					/>

					<SliderField
						label="Cloud cover"
						value={Math.round(sky.cloudCover * 100)}
						min={0}
						max={100}
						step={5}
						suffix="%"
						onChange={(value) => set("cloudCover", value / 100, true)}
						inherit={byDefault("cloudCover", percent(SKY_DEFAULTS.cloudCover))}
					/>

					{sky.cloudCover > 0 && (
						<>
							<ColorField
								label="Cloud colour"
								value={sky.cloudColor ?? look.cloudColor}
								onChange={(color) => set("cloudColor", color, true)}
								inherit={following("cloudColor", look.cloudColor)}
							/>

							<SliderField
								label="Cloud speed"
								value={sky.cloudSpeed}
								min={0}
								max={5}
								step={0.1}
								suffix="×"
								onChange={(value) => set("cloudSpeed", value, true)}
								inherit={byDefault("cloudSpeed", `${SKY_DEFAULTS.cloudSpeed}×`)}
							/>
						</>
					)}

					{!perspective && (
						<>
							<Hint>
								The isometric diorama shows the backdrop below; the sky shows in perspective.
							</Hint>

							<Button
								size="sm"
								icon="perspective"
								onClick={() => useEditor.getState().setProjection("perspective")}
							>
								Look in perspective (P)
							</Button>
						</>
					)}
				</>
			)}
		</Section>
	);
};

/**
 * What's behind the world in the isometric diorama (ADR-0070), and in
 * perspective with the sky off: the sky's colour (as before), a colour, a
 * gradient, or a green screen to key the world out in a video editor.
 */
export const BackdropSection = () => {
	const backdrop = useEditor((s) => s.scene.backdrop);
	const commit = useEditor((s) => s.commit);
	const themeBackground = useThemeBackground();
	const set = <K extends keyof TBackdrop>(key: K, value: TBackdrop[K], coalesce?: boolean) =>
		commit(
			(s: Draft<TScene>) => {
				s.backdrop[key] = value;
			},
			coalesce ? { coalesce: `backdrop.${key}` } : undefined,
		);
	const fromTheme = (key: "color" | "gradientStart" | "gradientEnd") => ({
		from: "theme",
		inherited: backdrop[key] === null,
		onReset: () => set(key, null),
		value: themeBackground,
	});

	return (
		<Section
			id="sky.backdrop"
			icon="layers"
			title="Backdrop"
			keywords="background diorama isometric green screen chroma key gradient colour video"
		>
			<SelectField<TBackdrop["kind"]>
				label="Behind the world"
				value={backdrop.kind}
				options={BACKDROPS}
				onChange={(kind) => set("kind", kind)}
				inherit={{
					from: "default",
					inherited: backdrop.kind === "sky",
					onReset: () => set("kind", "sky"),
					value: "the sky’s colour",
				}}
			/>

			{backdrop.kind === "color" && (
				<ColorField
					label="Colour"
					value={backdrop.color ?? themeBackground}
					onChange={(color) => set("color", color, true)}
					inherit={fromTheme("color")}
				/>
			)}

			{backdrop.kind === "gradient" && (
				<>
					<ColorField
						label="Gradient from"
						value={backdrop.gradientStart ?? themeBackground}
						onChange={(color) => set("gradientStart", color, true)}
						inherit={fromTheme("gradientStart")}
					/>

					<ColorField
						label="Gradient to"
						value={backdrop.gradientEnd ?? themeBackground}
						onChange={(color) => set("gradientEnd", color, true)}
						inherit={fromTheme("gradientEnd")}
					/>

					<SliderField
						label="Gradient angle"
						value={backdrop.gradientAngle}
						min={0}
						max={360}
						step={15}
						suffix="°"
						onChange={(angle) => set("gradientAngle", angle, true)}
						inherit={{
							from: "default",
							inherited: backdrop.gradientAngle === 180,
							onReset: () => set("gradientAngle", 180),
							value: "180°, top to bottom",
						}}
						hint="Which way it runs: 180° is top to bottom, 90° left to right."
					/>
				</>
			)}

			<Hint>
				{backdrop.kind === "greenScreen"
					? "Pure green (#00ff00) behind the world, to key it out in a video editor."
					: "Behind the world in the isometric diorama, and in perspective when the sky is off."}
			</Hint>
		</Section>
	);
};

/** The Sky & water tab (ADR-0079): the sky in perspective, the backdrop behind the diorama, the water. */
export const SkyWaterTab = () => (
	<>
		<SkySection />

		<BackdropSection />

		<WaterSection />
	</>
);
