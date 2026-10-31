import { useEffect, useMemo, useState } from "react";

import { startNewWorld } from "#/editor/fileActions";
import { useResolvedTheme } from "#/editor/useTheme";
import { type IScenePictureSource, useScenePictures } from "#/render/scenePictures";
import { SceneSchema, type TDrivingSide, type TScene, type TThemePreference } from "#/scene/schema";
import {
	createEmptyScene,
	TEMPLATE_CATEGORIES,
	TEMPLATES,
	type TTemplateCategory,
} from "#/templates";

import { ChipGroup } from "./ChipGroup";
import { ChoiceCards, type IChoiceCard } from "./ChoiceCards";
import { Dialog } from "./Dialog";
import { Hint, RadioGroupField, resetToDefault, SelectField, TextField } from "./fields";

import styles from "./NewWorldDialog.module.css";

const BLANK = "blank";
const BLANK_TITLE = "Untitled world";

/** Ground sizes to start a blank world from; any exact size can be set later in the World tab. */
const GROUND_PRESETS = {
	corner: { name: "Corner", width: 24, depth: 18, fits: "a street corner" },
	blocks: { name: "Blocks", width: 40, depth: 30, fits: "a few blocks" },
	district: { name: "District", width: 80, depth: 60, fits: "a neighbourhood" },
	town: { name: "Town", width: 120, depth: 90, fits: "a small town" },
	city: { name: "City", width: 240, depth: 180, fits: "a whole city" },
};

type TGroundPreset = keyof typeof GROUND_PRESETS;

const GROUND_PRESET_IDS = Object.keys(GROUND_PRESETS) as TGroundPreset[];

interface INewWorldChoices {
	/** "blank", or the id of the starter template to copy. */
	startFrom: string;
	groundPreset: TGroundPreset;
	theme: TThemePreference;
	drivingSide: TDrivingSide;
}

const DEFAULT_CHOICES: INewWorldChoices = {
	startFrom: BLANK,
	groundPreset: "blocks",
	theme: "system",
	drivingSide: "right",
};

const blankPictureId = (preset: TGroundPreset) => `${BLANK}:${preset}`;

/**
 * The Blank card's picture for a ground size: the bare ground with a house, a
 * tree and a car in the middle, which stay the same size as the ground grows,
 * so the picture shows how big it is. They aren't in the world it creates.
 */
const blankPictureScene = (preset: TGroundPreset) => {
	const { width, depth } = GROUND_PRESETS[preset];
	return SceneSchema.parse({
		...createEmptyScene({ ground: { width, depth } }),
		entities: [
			{ id: "scale_house", kind: "house_01", position: [-1.2, 0] },
			{ id: "scale_tree", kind: "round_tree_01", position: [1.4, -0.9] },
			{ id: "scale_car", kind: "car_01", position: [1.6, 1.3] },
		],
	});
};

/** The cards' pictures: bare ground at each preset size (all rendered, so switching is instant), then each starter. */
const PICTURE_SOURCES: IScenePictureSource[] = [
	...GROUND_PRESET_IDS.map((preset) => ({
		id: blankPictureId(preset),
		create: () => blankPictureScene(preset),
	})),
	...TEMPLATES,
];
const NO_PICTURES: IScenePictureSource[] = [];

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** What a starter comes with, data first (it's what worlds are for, ADR-0019); zero counts are left out. */
const contentsOf = (scene: TScene) => {
	const cards = scene.entities.filter((entity) => entity.label.isShown).length;
	const things = [
		[scene.entities.length, "object"],
		[scene.roads.length, "road"],
		[scene.areas.length, "area"],
		[scene.fences.length, "fence"],
	] as const;
	const listed = things.filter(([count]) => count > 0).map(([count, one]) => plural(count, one));
	return [
		scene.data.values.length + scene.data.tables.length > 0 &&
			`${[
				scene.data.tables.length > 0 && plural(scene.data.tables.length, "data table"),
				scene.data.values.length > 0 && plural(scene.data.values.length, "data value"),
			]
				.filter(Boolean)
				.join(" and ")} on ${plural(cards, "label card")}`,
		listed.length > 0 && listed.join(", ").replace(/, ([^,]*)$/, " and $1"),
		scene.viewpoints.length > 0 && plural(scene.viewpoints.length, "saved viewpoint"),
		`${scene.ground.width} × ${scene.ground.depth} ground`,
	].filter((line) => line !== false);
};

interface INewWorldDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * File → New world: start from bare ground with a few settings, or from a
 * starter world, picked from cards with a picture of each (ADR-0047). It
 * keeps its choices while the page is open; nothing is stored. The new world
 * opens next to the others (ADR-0044).
 */
export const NewWorldDialog = ({ open, onOpenChange }: INewWorldDialogProps) => {
	const [choices, setChoices] = useState(DEFAULT_CHOICES);
	// Which starters show: all, or one category's (places, data maps).
	const [category, setCategory] = useState<TTemplateCategory | "all">("all");
	// Empty means the placeholder: the starter's own title, or "Untitled world".
	const [name, setName] = useState("");
	const pictures = useScenePictures(useResolvedTheme(), open ? PICTURE_SOURCES : NO_PICTURES);

	useEffect(() => {
		if (open) {
			setName("");
		}
	}, [open]);

	// Every starter's world, for its details (all of them are laid out, see below).
	const starters = useMemo(
		() => (open ? TEMPLATES.map((template) => ({ template, scene: template.create() })) : []),
		[open],
	);
	const starter = starters.find(({ template }) => template.id === choices.startFrom)?.scene;
	const defaultName = starter?.meta.title ?? BLANK_TITLE;
	const update = (patch: Partial<INewWorldChoices>) => setChoices({ ...choices, ...patch });

	/** Create the world from the picked card, or from `startFrom` (a card that was double-clicked). */
	const create = (startFrom = choices.startFrom) => {
		const picked = starters.find(({ template }) => template.id === startFrom)?.scene;
		const title = name.trim() || (picked?.meta.title ?? BLANK_TITLE);
		const { width, depth } = GROUND_PRESETS[choices.groundPreset];
		setChoices({ ...choices, startFrom });
		startNewWorld(
			picked
				? { ...picked, meta: { ...picked.meta, title } }
				: createEmptyScene({
						title,
						ground: { width, depth },
						theme: choices.theme,
						drivingSide: choices.drivingSide,
					}),
		);
	};

	const picture = (id: string) => (pictures[id] ? <img src={pictures[id]} alt="" /> : null);
	const cards: IChoiceCard<string>[] = [
		{
			value: BLANK,
			title: "Blank",
			description: "Bare ground: choose its size and look",
			picture: picture(blankPictureId(choices.groundPreset)),
		},
		...TEMPLATES.filter((candidate) => category === "all" || candidate.category === category).map(
			(candidate) => ({
				value: candidate.id,
				title: candidate.name,
				description: candidate.description,
				picture: picture(candidate.id),
			}),
		),
	];

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="New world"
			description="Start from bare ground, or from a starter world with objects, roads and data already in place."
			confirm={{ label: "Create", onConfirm: () => create() }}
			wide
		>
			<div className={styles.layout}>
				<div className={styles.starters}>
					<ChipGroup
						label="Kind of world"
						value={category}
						onChange={setCategory}
						size="sm"
						chips={[
							{ value: "all", label: "All", count: TEMPLATES.length },
							...TEMPLATE_CATEGORIES.map(({ value, label }) => ({
								value,
								label,
								count: TEMPLATES.filter((each) => each.category === value).length,
							})),
						]}
					/>

					<ChoiceCards
						label="Start from"
						value={choices.startFrom}
						onChange={(startFrom) => update({ startFrom })}
						onPick={(startFrom) => {
							create(startFrom);
							onOpenChange(false);
						}}
						cards={cards}
					/>
				</div>

				<div className={styles.details}>
					<TextField
						label="Name"
						value={name}
						placeholder={defaultName}
						onChange={setName}
						inherit={resetToDefault(name, "", () => setName(""), defaultName)}
					/>

					{/*
						Every card's details are laid out on top of each other and only the picked one
						shows, so the dialog keeps the height of the tallest and nothing jumps when
						another card is picked.
					*/}
					<div className={styles.variants}>
						<div
							className={styles.variant}
							data-shown={!starter || undefined}
							inert={Boolean(starter)}
						>
							<RadioGroupField<TGroundPreset>
								label="Ground"
								value={choices.groundPreset}
								options={GROUND_PRESET_IDS.map((preset) => {
									const { name, width, depth, fits } = GROUND_PRESETS[preset];
									return { value: preset, label: name, meta: `${width} × ${depth} · ${fits}` };
								})}
								onChange={(groundPreset) => update({ groundPreset })}
								inherit={resetToDefault(
									choices.groundPreset,
									DEFAULT_CHOICES.groundPreset,
									() => update({ groundPreset: DEFAULT_CHOICES.groundPreset }),
									GROUND_PRESETS[DEFAULT_CHOICES.groundPreset].name,
								)}
							/>

							<SelectField<TThemePreference>
								label="Theme"
								value={choices.theme}
								options={[
									{ value: "system", label: "Match device" },
									{ value: "light", label: "Light" },
									{ value: "dark", label: "Dark" },
								]}
								onChange={(theme) => update({ theme })}
								inherit={resetToDefault(
									choices.theme,
									DEFAULT_CHOICES.theme,
									() => update({ theme: DEFAULT_CHOICES.theme }),
									"match device",
								)}
							/>

							<SelectField<TDrivingSide>
								label="Vehicles drive on the"
								value={choices.drivingSide}
								options={[
									{ value: "right", label: "Right" },
									{ value: "left", label: "Left" },
								]}
								onChange={(drivingSide) => update({ drivingSide })}
								inherit={resetToDefault(choices.drivingSide, DEFAULT_CHOICES.drivingSide, () =>
									update({ drivingSide: DEFAULT_CHOICES.drivingSide }),
								)}
							/>

							<Hint>
								All of these, and an exact ground size, can be changed later in the World tab.
							</Hint>
						</div>

						{starters.map(({ template, scene }) => (
							<div
								key={template.id}
								className={styles.variant}
								data-shown={scene === starter || undefined}
								inert={scene !== starter}
							>
								<p className={styles.description}>{template.description}</p>

								<ul className={styles.contents}>
									{contentsOf(scene).map((line) => (
										<li key={line}>{line}</li>
									))}
								</ul>

								<Hint>
									A copy opens as a new world; change anything. Its label cards show how data is
									wired to objects.
								</Hint>
							</div>
						))}
					</div>
				</div>
			</div>
		</Dialog>
	);
};
