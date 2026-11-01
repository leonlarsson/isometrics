import { useEditor } from "#/editor/store";
import { useThemePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { GROUND } from "#/scene/ground";
import { changeColorSetting } from "#/scene/objectSettings";
import { TURN_STYLE_LABELS, TURN_STYLE_OPTIONS } from "#/scene/roads";
import {
	OnScreenSchema,
	SCENE_VERSION,
	SceneSchema,
	type TDrivingSide,
	type TOnScreen,
	type TThemePreference,
	type TTurnStyle,
} from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import {
	Hint,
	resetToDefault,
	Section,
	SelectField,
	SliderField,
	SwitchField,
	TextField,
} from "./fields";
import { LegendSection } from "./LegendSection";
import { ColorSettingFields } from "./PartSettings";

/** Each On screen switch as a new world has it, for Default / Reset. */
const ON_SCREEN_DEFAULTS = OnScreenSchema.parse({});

/** A new world's settings, for Default / Reset (ADR-0105). */
const WORLD_DEFAULTS = SceneSchema.parse({ version: SCENE_VERSION });

/** The on/off settings of what View mode shows. */
type TOnScreenSwitch = {
	[K in keyof TOnScreen]: TOnScreen[K] extends boolean ? K : never;
}[keyof TOnScreen];

const ON_SCREEN_SWITCHES: { key: TOnScreenSwitch; label: string; hint?: string }[] = [
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
	{
		key: "showsDataSwitch",
		label: "Show the Map / Data switch",
		hint: "For a world with data: Data shows its tables and values as tables, the accessible way to read it.",
	},
];

/**
 * What viewers see over the world in View mode (scene.onScreen, ADR-0063).
 * Edit mode shows everything, faded where View mode won't.
 */
const OnScreenSection = () => {
	const onScreen = useEditor((s) => s.scene.onScreen);
	const usesData = useEditor((s) => s.scene.data.isOn);
	const commit = useEditor((s) => s.commit);
	const set = (key: TOnScreenSwitch, value: boolean) =>
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

			{/* The Map / Data switch is about data: not offered with data off (ADR-0115). */}
			{ON_SCREEN_SWITCHES.filter(({ key }) => usesData || key !== "showsDataSwitch").map(
				({ key, label, hint }) => (
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
				),
			)}
		</Section>
	);
};

/** The World tab (ADR-0054): the world's title and theme, its ground, and what shows on screen. */
export const WorldTab = () => {
	const scene = useEditor((s) => s.scene);
	const commit = useEditor((s) => s.commit);
	const resetView = useEditor((s) => s.resetView);
	const palette = useThemePalette();
	const data = useWorldData().values;
	const usesData = useEditor((s) => s.scene.data.isOn);

	return (
		<>
			<Section
				id="world.world"
				icon="globe"
				title="World"
				keywords="name heading theme data uses data plain"
			>
				<TextField
					inherit={resetToDefault(scene.meta.title, WORLD_DEFAULTS.meta.title, () =>
						commit((s) => {
							s.meta.title = WORLD_DEFAULTS.meta.title;
						}),
					)}
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
					inherit={resetToDefault(
						scene.meta.subtitle,
						"",
						() =>
							commit((s) => {
								s.meta.subtitle = "";
							}),
						"none",
					)}
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
					inherit={resetToDefault(
						scene.theme,
						WORLD_DEFAULTS.theme,
						() =>
							commit((s) => {
								s.theme = WORLD_DEFAULTS.theme;
							}),
						"match device",
					)}
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

				<SwitchField
					label="Uses data"
					checked={scene.data.isOn}
					onChange={(isOn) =>
						commit((s) => {
							s.data.isOn = isOn;
						})
					}
					inherit={{
						from: "default",
						inherited: scene.data.isOn,
						onReset: () =>
							commit((s) => {
								s.data.isOn = true;
							}),
						value: "on",
					}}
					hint={
						scene.data.isOn
							? "Things can show and follow values and tables: the Data tab, From data, values on cards. Off for a plain world to build."
							: "Off: a plain world to build, with nothing about data anywhere. Its values, tables and sources are kept, back when this is on."
					}
				/>
			</Section>

			<Section id="world.ground" icon="layers" title="Ground" keywords="size floor base">
				<SliderField
					inherit={resetToDefault(scene.ground.width, WORLD_DEFAULTS.ground.width, () =>
						commit((s) => {
							s.ground.width = WORLD_DEFAULTS.ground.width;
						}),
					)}
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
					inherit={resetToDefault(scene.ground.depth, WORLD_DEFAULTS.ground.depth, () =>
						commit((s) => {
							s.ground.depth = WORLD_DEFAULTS.ground.depth;
						}),
					)}
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
					data={data}
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

			{/* About data: not offered with data off (ADR-0115). */}
			{usesData && <LegendSection />}
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
				inherit={resetToDefault(scene.traffic.drivingSide, WORLD_DEFAULTS.traffic.drivingSide, () =>
					commit((s) => {
						s.traffic.drivingSide = WORLD_DEFAULTS.traffic.drivingSide;
					}),
				)}
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
				inherit={resetToDefault(
					scene.traffic.turnStyle,
					WORLD_DEFAULTS.traffic.turnStyle,
					() =>
						commit((s) => {
							s.traffic.turnStyle = WORLD_DEFAULTS.traffic.turnStyle;
						}),
					TURN_STYLE_LABELS[WORLD_DEFAULTS.traffic.turnStyle].toLowerCase(),
				)}
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
				inherit={resetToDefault(scene.traffic.keepsDistance, true, () =>
					commit((s) => {
						s.traffic.keepsDistance = true;
					}),
				)}
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
					inherit={resetToDefault(scene.traffic.overtakes, true, () =>
						commit((s) => {
							s.traffic.overtakes = true;
						}),
					)}
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
