import { useEditor } from "#/editor/store";
import { useThemePalette } from "#/editor/useTheme";
import { TURNS_OPTIONS } from "#/scene/roads";
import {
	OnScreenSchema,
	type TDrivingSide,
	type TOnScreen,
	type TThemePreference,
	type TTurns,
} from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import {
	ColorField,
	Hint,
	Section,
	SelectField,
	SliderField,
	SwitchField,
	TextField,
} from "./fields";

/** The World tab (ADR-0054): the world's title and theme, its ground, and what shows on screen. */
/** Each On screen switch as a new world has it, for Default / Reset. */
const ON_SCREEN_DEFAULTS = OnScreenSchema.parse({});

const ON_SCREEN_SWITCHES: { key: keyof TOnScreen; label: string; hint?: string }[] = [
	{ key: "title", label: "Title" },
	{ key: "subtitle", label: "Subtitle" },
	{ key: "timeOfDay", label: "Time of day", hint: "In Edit mode it's also the way to Sun & sky." },
	{
		key: "labelCards",
		label: "Label cards",
		hint: "Every object's card. One object's card is switched in its Label tab.",
	},
	{
		key: "details",
		label: "Details on click",
		hint: "In View mode, an object's values when it's clicked.",
	},
	{
		key: "viewpointBar",
		label: "Viewpoint bar",
		hint: "In View mode. ← and → still step through the viewpoints without it.",
	},
];

/** What shows on screen over the world, in Edit and View mode alike (scene.onScreen). */
const OnScreenSection = () => {
	const onScreen = useEditor((s) => s.scene.onScreen);
	const commit = useEditor((s) => s.commit);
	const set = (key: keyof TOnScreen, value: boolean) =>
		commit((s) => {
			s.onScreen[key] = value;
		});
	return (
		<Section
			id="world.onScreen"
			icon="eye"
			title="On screen"
			keywords="show hide title subtitle time of day label cards details viewpoint bar overlay clean presentation"
		>
			<Hint>What shows over the world, in Edit and View mode alike.</Hint>

			{ON_SCREEN_SWITCHES.map(({ key, label, hint }) => (
				<SwitchField
					key={key}
					label={label}
					checked={onScreen[key]}
					onChange={(v) => set(key, v)}
					inherit={{
						from: "default",
						inherited: onScreen[key] === ON_SCREEN_DEFAULTS[key],
						onReset: () => set(key, ON_SCREEN_DEFAULTS[key]),
						value: "shown",
					}}
					hint={hint}
				/>
			))}
		</Section>
	);
};

export const WorldTab = () => {
	const scene = useEditor((s) => s.scene);
	const commit = useEditor((s) => s.commit);
	const resetView = useEditor((s) => s.resetView);
	const palette = useThemePalette();

	return (
		<>
			<Section id="world.world" icon="globe" title="World" keywords="name heading">
				<TextField
					label="Title"
					value={scene.meta.title}
					onChange={(v) =>
						commit(
							(s) => {
								s.meta.title = v;
							},
							{ coalesce: "meta.title" },
						)
					}
				/>

				<TextField
					label="Subtitle"
					value={scene.meta.subtitle}
					onChange={(v) =>
						commit(
							(s) => {
								s.meta.subtitle = v;
							},
							{ coalesce: "meta.subtitle" },
						)
					}
				/>

				<SelectField<TThemePreference>
					label="Theme"
					value={scene.theme}
					options={[
						{ value: "system", label: "Match device" },
						{ value: "light", label: "Light" },
						{ value: "dark", label: "Dark" },
					]}
					onChange={(v) =>
						commit((s) => {
							s.theme = v;
						})
					}
				/>
			</Section>

			<Section id="world.ground" icon="layers" title="Ground" keywords="size floor base">
				<SliderField
					label="Width"
					value={scene.ground.width}
					min={8}
					max={500}
					step={1}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.width = v;
							},
							{ coalesce: "ground.width" },
						)
					}
				/>

				<SliderField
					label="Depth"
					value={scene.ground.depth}
					min={8}
					max={500}
					step={1}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.depth = v;
							},
							{ coalesce: "ground.depth" },
						)
					}
				/>

				<ColorField
					label="Colour"
					value={scene.ground.color ?? palette.ground}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.color = v;
							},
							{ coalesce: "ground.color" },
						)
					}
					inherit={{
						from: "default",
						inherited: scene.ground.color === null,
						onReset: () =>
							commit((s) => {
								s.ground.color = null;
							}),
					}}
				/>

				<ButtonGroup>
					<Button size="sm" icon="focus" onClick={resetView}>
						Re-centre camera
					</Button>
				</ButtonGroup>
			</Section>

			<OnScreenSection />
		</>
	);
};

/** The Traffic tab: how vehicles drive, everywhere in the world. Roads and vehicles can override it. */
export const TrafficTab = () => {
	const scene = useEditor((s) => s.scene);
	const commit = useEditor((s) => s.commit);

	return (
		<Section
			id="traffic.rules"
			icon="traffic"
			title="Traffic rules"
			keywords="vehicles cars driving roads"
		>
			<SelectField<TDrivingSide>
				label="Vehicles drive on the"
				value={scene.driving}
				options={[
					{ value: "right", label: "Right" },
					{ value: "left", label: "Left" },
				]}
				onChange={(v) =>
					commit((s) => {
						s.driving = v;
					})
				}
			/>

			<SelectField<TTurns>
				label="Vehicles turn"
				value={scene.turns}
				options={TURNS_OPTIONS}
				onChange={(v) =>
					commit((s) => {
						s.turns = v;
					})
				}
				hint="Smoothly eases through corners; sharply snaps to each new direction. Roads and vehicles can override this."
			/>

			<SwitchField
				label="Keep distance"
				checked={scene.traffic.spacing}
				onChange={(v) =>
					commit((s) => {
						s.traffic.spacing = v;
					})
				}
			/>

			{scene.traffic.spacing ? (
				<SwitchField
					label="Overtake slower vehicles"
					checked={scene.traffic.overtaking}
					onChange={(v) =>
						commit((s) => {
							s.traffic.overtaking = v;
						})
					}
				/>
			) : (
				<Hint>Every vehicle drives at its own speed, through slower ones.</Hint>
			)}

			{scene.roads.length === 0 && <Hint>No roads yet. Draw one from Add to scene → Roads.</Hint>}
		</Section>
	);
};
