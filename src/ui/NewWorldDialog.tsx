import { useEffect, useMemo, useState } from "react";

import { startNewWorld } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";
import { useResolvedTheme } from "#/editor/useTheme";
import { plural } from "#/scene/format";
import type { TDrivingSide, TScene, TThemePreference } from "#/scene/schema";
import {
	createEmptyScene,
	TEMPLATE_CATEGORIES,
	TEMPLATES,
	type TTemplateCategory,
} from "#/templates";
import {
	blankPictureId,
	GROUND_PRESET_IDS,
	GROUND_PRESETS,
	STARTER_PICTURE_SOURCES,
	type TGroundPreset,
} from "#/templates/pictures";

import { Button } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { ChoiceCards, type IChoiceCard } from "./ChoiceCards";
import { Dialog } from "./Dialog";
import {
	FieldGroup,
	Hint,
	RadioGroupField,
	resetToDefault,
	SelectField,
	SwitchField,
	TextField,
} from "./fields";
import { useCopy } from "./useCopy";
import { useWorldPictures } from "./useWorldPictures";

import styles from "./NewWorldDialog.module.css";

const BLANK = "blank";
const BLANK_TITLE = "Untitled world";

interface INewWorldChoices {
	/** "blank", or the id of the starter template to copy. */
	startFrom: string;
	groundPreset: TGroundPreset;
	theme: TThemePreference;
	drivingSide: TDrivingSide;
	/**
	 * Whether the new world uses data (ADR-0115), a world setting; null while it's as the picked
	 * world has it: a starter's own (on for those that show data), off for a blank world (ADR-0127).
	 */
	usesData: boolean | null;
}

const DEFAULT_CHOICES: INewWorldChoices = {
	startFrom: BLANK,
	groundPreset: "blocks",
	theme: "system",
	drivingSide: "right",
	usesData: null,
};

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

/**
 * File → New world: start from bare ground with a few settings, or from a
 * starter world, picked from cards with a picture of each (ADR-0047). It
 * keeps its choices while the page is open; nothing is stored. The new world
 * opens next to the others (ADR-0044).
 */
/** A starter's own address (/templates/<id>), which opens a copy of it for anyone (ADR-0120). */
const templateLink = (id: string) => `${window.location.origin}/templates/${id}`;

export const NewWorldDialog = () => {
	const asked = useEditor((s) => s.newWorld);
	const open = asked !== null;
	const onOpenChange = (next: boolean) => {
		if (!next) {
			useEditor.getState().setNewWorld(null);
		}
	};
	const [choices, setChoices] = useState(DEFAULT_CHOICES);
	const { copiedKey, copy } = useCopy();
	// Which starters show: all, or one category's (places, data maps).
	const [category, setCategory] = useState<TTemplateCategory | "all">("all");
	// Empty means the placeholder: the starter's own title, or "Untitled world".
	const [name, setName] = useState("");
	// The cards' pictures: bare ground at each preset size (so switching is instant), then each starter.
	const picture = useWorldPictures(useResolvedTheme(), STARTER_PICTURE_SOURCES, open);

	useEffect(() => {
		if (asked !== null) {
			setName("");
			// Opened for one kind (the welcome's city or example): those starters, the first picked.
			setCategory(asked.shows);
			const first =
				asked.shows === "all"
					? undefined
					: TEMPLATES.find((template) => template.category === asked.shows);
			setChoices((before) => ({
				...before,
				usesData: asked.usesData,
				startFrom: first?.id ?? before.startFrom,
			}));
		}
	}, [asked]);

	// Every starter's world, for its details (all of them are laid out, see below).
	const starters = useMemo(
		() => (open ? TEMPLATES.map((template) => ({ template, scene: template.create() })) : []),
		[open],
	);
	const starter = starters.find(({ template }) => template.id === choices.startFrom)?.scene;
	const defaultName = starter?.meta.title ?? BLANK_TITLE;
	/** Whether the picked world uses data as it comes: a starter as made, a blank world doesn't. */
	const usesDataAsMade = starter?.data.enabled ?? false;
	const usesData = choices.usesData ?? usesDataAsMade;
	const update = (patch: Partial<INewWorldChoices>) => setChoices({ ...choices, ...patch });

	/** Create the world from the picked card, or from `startFrom` (a card that was double-clicked). */
	const create = (startFrom = choices.startFrom) => {
		const picked = starters.find(({ template }) => template.id === startFrom)?.scene;
		const title = name.trim() || (picked?.meta.title ?? BLANK_TITLE);
		const { width, depth } = GROUND_PRESETS[choices.groundPreset];
		setChoices({ ...choices, startFrom });
		startNewWorld(
			picked
				? {
						...picked,
						meta: { ...picked.meta, title },
						data: { ...picked.data, enabled: choices.usesData ?? picked.data.enabled },
					}
				: createEmptyScene({
						title,
						ground: { width, depth },
						theme: choices.theme,
						drivingSide: choices.drivingSide,
						usesData: choices.usesData ?? false,
					}),
		);
	};

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

					{/* The other way to start: describe it, and an AI builds it. */}
					<div className={styles.withAi}>
						<span>Or describe a world and let an AI build it.</span>

						<Button
							size="sm"
							icon="sparkle"
							iconTone="accent"
							onClick={() => {
								onOpenChange(false);
								useEditor.getState().setBuildWithAi("new");
							}}
						>
							Build with AI…
						</Button>
					</div>
				</div>

				<div className={styles.details}>
					<TextField
						label="Name"
						value={name}
						placeholder={defaultName}
						onChange={setName}
						inherit={resetToDefault(name, "", () => setName(""), defaultName)}
					/>

					<SwitchField
						label="Uses data"
						checked={usesData}
						onChange={(next) => update({ usesData: next })}
						inherit={resetToDefault(usesData, usesDataAsMade, () => update({ usesData: null }))}
						hint="Off for a plain world to build, with nothing about data anywhere (a starter's data is kept, hidden). It starts as the starter has it, and the World tab can change it later."
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

								<FieldGroup title="Its link">
									<p className={styles.link}>{templateLink(template.id)}</p>

									<Button
										size="sm"
										icon={copiedKey === template.id ? "check" : "copy"}
										showsSuccess={copiedKey === template.id}
										onClick={() =>
											copy(templateLink(template.id), "Link copied", {
												key: template.id,
												detail: templateLink(template.id),
											})
										}
									>
										Copy the link
									</Button>

									<Hint>Opens a copy of this starter for anyone, as a preview they can keep.</Hint>
								</FieldGroup>
							</div>
						))}
					</div>
				</div>
			</div>
		</Dialog>
	);
};
