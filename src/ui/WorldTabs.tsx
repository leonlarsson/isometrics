import { useEditor } from "#/editor/store";
import { useThemePalette } from "#/editor/useTheme";
import { GROUND } from "#/scene/ground";
import { changeColorSetting } from "#/scene/objectSettings";
import { TURN_STYLE_OPTIONS } from "#/scene/roads";
import {
	OnScreenSchema,
	type TDrivingSide,
	type TOnScreen,
	type TThemePreference,
	type TTurnStyle,
} from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { Hint, Section, SelectField, SliderField, SwitchField, TextField } from "./fields";
import { ColorSettingFields } from "./PartSettings";

/** Each On screen switch as a new world has it, for Default / Reset. */
const ON_SCREEN_DEFAULTS = OnScreenSchema.parse({});

const ON_SCREEN_SWITCHES: { key: keyof TOnScreen; label: string; hint?: string }[] = [
	{ key: "showsTitle", label: "Show the title" },
	{ key: "showsSubtitle", label: "Show the subtitle" },
	{ key: "showsTimeOfDay", label: "Show the time of day" },
	{
		key: "showsLabelCards",
		label: "Show label cards",
		hint: "Every object's card. One object's card is switched in its Label tab.",
	},
	{
		key: "showsDetails",
		label: "Show details on click",
		hint: "An object's values when it's clicked.",
	},
	{
		key: "showsViewpointBar",
		label: "Show the viewpoint bar",
		hint: "← and → still step through the viewpoints without it.",
	},
];

/**
 * What viewers see over the world in View mode (scene.onScreen, ADR-0063).
 * Edit mode shows everything, faded where View mode won't.
 */
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
			title="Shown in View mode"
			keywords="on screen show hide title subtitle time of day label cards details viewpoint bar overlay clean presentation viewers"
		>
			<Hint>
				What viewers see over the world. Edit mode still shows everything, faded where View mode
				won’t.
			</Hint>

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

/** The World tab (ADR-0054): the world's title and theme, its ground, and what shows on screen. */
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

				<ColorSettingFields
					spec={GROUND.colors[0]}
					setting={scene.ground.colors.surface}
					data={scene.data}
					palette={palette}
					onChange={(change, field) =>
						commit(
							(s) => {
								changeColorSetting(s.ground.colors, "surface", change);
							},
							field ? { coalesce: `ground.color.${field}` } : undefined,
						)
					}
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
				value={scene.traffic.drivingSide}
				options={[
					{ value: "right", label: "Right" },
					{ value: "left", label: "Left" },
				]}
				onChange={(v) =>
					commit((s) => {
						s.traffic.drivingSide = v;
					})
				}
			/>

			<SelectField<TTurnStyle>
				label="Vehicles turn"
				value={scene.traffic.turnStyle}
				options={TURN_STYLE_OPTIONS}
				onChange={(v) =>
					commit((s) => {
						s.traffic.turnStyle = v;
					})
				}
				hint="Smoothly eases through corners; sharply snaps to each new direction. Roads and vehicles can override this."
			/>

			<SwitchField
				label="Lean in turns"
				checked={scene.traffic.leansInTurns}
				onChange={(v) =>
					commit((s) => {
						s.traffic.leansInTurns = v;
					})
				}
				inherit={{
					from: "default",
					inherited: scene.traffic.leansInTurns,
					onReset: () =>
						commit((s) => {
							s.traffic.leansInTurns = true;
						}),
					value: "on",
				}}
				hint="Boats lean into turns, more the faster and tighter they turn. Roads and vehicles can override this."
			/>

			<SwitchField
				label="Keep distance"
				checked={scene.traffic.keepsDistance}
				onChange={(v) =>
					commit((s) => {
						s.traffic.keepsDistance = v;
					})
				}
			/>

			{scene.traffic.keepsDistance ? (
				<SwitchField
					label="Overtake slower vehicles"
					checked={scene.traffic.overtakes}
					onChange={(v) =>
						commit((s) => {
							s.traffic.overtakes = v;
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
