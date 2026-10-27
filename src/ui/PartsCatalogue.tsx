import { useEffect, useState } from "react";

import { notify } from "#/editor/toasts";
import { usePrefersDark } from "#/editor/useTheme";
import { APP_NAME } from "#/lib/app";
import { resolvePartColors } from "#/parts/colorModel";
import { PARTS, partName, resolveProps, type TAnyPart } from "#/parts/registry";
import {
	CATEGORY_LABELS,
	type ILightSpec,
	type TFieldSpec,
	type TLightShape,
	type TPartCategory,
} from "#/parts/types";
import { PartPreviewModel } from "#/render/PartPreviewModel";
import {
	type IPictureLook,
	type IPictureSize,
	pictureLookPalette,
	usePartPictures,
} from "#/render/thumbnails";
import { scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { IconButton } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { Dialog } from "./Dialog";
import { Hint, SearchField } from "./fields";
import { Icon } from "./Icon";
import { CATEGORY_ICONS } from "./inspectorTabs";
import { COMES_ON } from "./LightSettings";
import { Toaster } from "./Toaster";
import { TooltipProvider } from "./Tooltip";

import styles from "./PartsCatalogue.module.css";

/** A card's picture, and each of the four looks in a part's details. */
const CARD_PICTURE: IPictureSize = { width: 240, height: 170 };
const LOOK_PICTURE: IPictureSize = { width: 150, height: 110 };

const LOOKS: { look: IPictureLook; label: string }[] = [
	{ look: { theme: "light", night: false }, label: "Light, by day" },
	{ look: { theme: "light", night: true }, label: "Light, at night" },
	{ look: { theme: "dark", night: false }, label: "Dark, by day" },
	{ look: { theme: "dark", night: true }, label: "Dark, at night" },
];

/** What each shape of light is, in a few words. */
const LIGHT_SHAPES: Record<TLightShape, string> = {
	lens: "A small glowing light",
	beam: "A beam on the road ahead",
	pool: "A glow on the ground around it",
	windows: "Lit windows",
	glow: "A glowing surface",
};

const round = (value: number) => Math.round(value * 10) / 10;

/** Every word of the query in the part's name, kind, category, description or search words. */
const matches = (part: TAnyPart, query: string) => {
	const text = [
		partName(part),
		part.kind,
		CATEGORY_LABELS[part.category],
		part.description,
		...(part.keywords ?? []),
	]
		.join(" ")
		.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => text.includes(word));
};

/** What a setting can be, in words. */
const settingRange = (field: TFieldSpec) => {
	switch (field.type) {
		case "number":
			return `${field.min} to ${field.max}`;
		case "boolean":
			return "On or off";
		case "select":
			return field.options.map((option) => option.label).join(", ");
		case "text":
			return "Text";
		case "dataKey":
			return "One of the world's data values";
	}
};

/** A setting's value in words. */
const settingValue = (field: TFieldSpec, value: unknown) => {
	switch (field.type) {
		case "boolean":
			return value ? "On" : "Off";
		case "select":
			return field.options.find((option) => option.value === value)?.label ?? String(value);
		case "text":
			return value ? `“${value}”` : "Empty";
		case "dataKey":
			return value ? String(value) : "None";
		default:
			return String(value);
	}
};

/** When a light is on by itself, and how it comes on. */
const lightWhen = (light: ILightSpec) =>
	`${light.when === "driving" ? "On while driving after dark" : "On after dark"}, ${COMES_ON[
		light.comesOn ?? "atOnce"
	].label.toLowerCase()}`;

/** A part's kind, to copy for a world written by hand or by an AI. */
const KindCode = ({ kind }: { kind: string }) => (
	<span className={styles.kind}>
		<code>{kind}</code>

		<IconButton
			icon="copy"
			label={`Copy ${kind}`}
			onClick={() => {
				void navigator.clipboard
					.writeText(kind)
					.then(() => notify(`Copied ${kind}`))
					.catch(() => notify("Couldn't copy: the browser didn't allow it"));
			}}
		/>
	</span>
);

/** Everything about one part: a live model, its four looks, and what it has. */
const PartDetails = ({
	part,
	theme,
	night,
}: {
	part: TAnyPart;
	theme: TResolvedTheme;
	night: boolean;
}) => {
	const looks = [
		usePartPictures(LOOKS[0].look, LOOK_PICTURE),
		usePartPictures(LOOKS[1].look, LOOK_PICTURE),
		usePartPictures(LOOKS[2].look, LOOK_PICTURE),
		usePartPictures(LOOKS[3].look, LOOK_PICTURE),
	];
	const palette = pictureLookPalette({ theme, night });
	const props = resolveProps(part, {}) as Record<string, unknown>;
	const [width, depth] = part.footprint(props);
	const colors = resolvePartColors(part, palette);
	return (
		<div className={styles.details}>
			<div className={styles.detailsPictures}>
				<div className={styles.model} data-night={night || undefined}>
					<PartPreviewModel kind={part.kind} palette={palette} />
				</div>

				<div className={styles.looks}>
					{LOOKS.map(({ look, label }, i) => (
						<figure key={label} className={styles.look}>
							<span
								className={styles.lookPicture}
								data-night={look.night || undefined}
								// By day, behind it the page of the theme it's in.
								style={
									look.night ? undefined : { background: scenePalettes[look.theme].background }
								}
							>
								{looks[i][part.kind] && <img src={looks[i][part.kind]} alt="" />}
							</span>

							<figcaption>{label}</figcaption>
						</figure>
					))}
				</div>
			</div>

			<div className={styles.facts}>
				<p className={styles.description}>{part.description}.</p>

				<dl className={styles.list}>
					<dt>Kind</dt>

					<dd>
						<KindCode kind={part.kind} />
					</dd>

					<dt>Category</dt>

					<dd>{CATEGORY_LABELS[part.category]}</dd>

					<dt>Size</dt>

					<dd>{`${round(width)} × ${round(depth)} wide, ${round(part.height(props))} tall (at its default settings)`}</dd>

					{part.canFollowPath && (
						<>
							<dt>Moves</dt>

							<dd>Can drive along roads and routes</dd>
						</>
					)}

					{(part.keywords ?? []).length > 0 && (
						<>
							<dt>Search words</dt>

							<dd>{part.keywords?.join(", ")}</dd>
						</>
					)}
				</dl>

				<h3 className={styles.heading}>Colours</h3>

				<ul className={styles.rows}>
					{part.colors.map((color) => (
						<li key={color.id}>
							<span className={styles.swatch} style={{ background: colors[color.id] }} />

							<span className={styles.rowName}>{color.name}</span>

							<span className={styles.rowMeta}>
								{typeof color.default === "function" ? "Follows the theme" : colors[color.id]}

								{" · "}

								<code>{color.id}</code>
							</span>
						</li>
					))}
				</ul>

				<h3 className={styles.heading}>Lights</h3>

				{(part.lights ?? []).length === 0 ? (
					<p className={styles.none}>None</p>
				) : (
					<ul className={styles.rows}>
						{part.lights?.map((light) => (
							<li key={light.id}>
								<Icon name="bulb" size={16} />

								<span className={styles.rowName}>{light.name}</span>

								<span className={styles.rowMeta}>
									{`${(light.description ?? LIGHT_SHAPES[light.shape]).replace(/\.$/, "")}. ${lightWhen(light)}.`}

									{" · "}

									<code>{light.id}</code>
								</span>
							</li>
						))}
					</ul>
				)}

				<h3 className={styles.heading}>Settings</h3>

				{part.fields.length === 0 ? (
					<p className={styles.none}>None</p>
				) : (
					<ul className={styles.rows}>
						{part.fields.map((field) => (
							<li key={field.key}>
								<span className={styles.rowName}>{field.label}</span>

								<span className={styles.rowMeta}>
									{`${settingRange(field)}; ${settingValue(field, props[field.key])} at first`}

									{" · "}

									<code>{field.key}</code>
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
};

interface IPartsCatalogueProps {
	/** The part whose details are open (`?part=` in the address), or null. */
	openKind: string | null;
	onOpen: (kind: string | null) => void;
}

/**
 * The parts catalogue at /parts: every part you can add to a world, in either
 * theme, by day or at night, with a search and the categories as chips. A
 * part's details show it turning, its four looks, and its colours, lights and
 * settings with the names a world's file uses for them (ADR-0087).
 */
export const PartsCatalogue = ({ openKind, onOpen }: IPartsCatalogueProps) => {
	const prefersDark = usePrefersDark();
	const [theme, setTheme] = useState<TResolvedTheme>(() => (prefersDark ? "dark" : "light"));
	const [time, setTime] = useState<"day" | "night">("day");
	const [category, setCategory] = useState<TPartCategory | "all">("all");
	const [query, setQuery] = useState("");
	const night = time === "night";
	const pictures = usePartPictures({ theme, night }, CARD_PICTURE);

	// The page wears the theme it shows the parts in.
	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);

	const searched = PARTS.filter((part) => matches(part, query));
	const shown = searched.filter((part) => category === "all" || part.category === category);
	const categories = [...new Set(PARTS.map((part) => part.category))];
	const open = PARTS.find((part) => part.kind === openKind);

	return (
		<TooltipProvider>
			<Toaster>
				<div className={styles.page}>
					<header className={styles.header}>
						<div className={styles.brand}>
							<span className={styles.logo} aria-hidden="true" />

							<h1>{`${APP_NAME} parts`}</h1>
						</div>

						<a className={styles.link} href="/">
							Open the editor
						</a>
					</header>

					<p className={styles.intro}>
						Every part you can add to a world, with its colours, lights and settings. Click one to
						see it turn and how it looks in each theme by day and at night.
					</p>

					<p className={styles.intro}>
						<a className={styles.link} href="/schema.json">
							/schema.json
						</a>
						: the same parts as data, with every setting, for tools and AIs writing worlds.
					</p>

					<div className={styles.controls}>
						<div className={styles.search}>
							<SearchField label="Search parts" value={query} onChange={setQuery} />
						</div>

						<ChipGroup
							label="Theme"
							value={theme}
							onChange={setTheme}
							chips={[
								{ value: "light", label: "Light" },
								{ value: "dark", label: "Dark" },
							]}
						/>

						<ChipGroup
							label="Time of day"
							value={time}
							onChange={setTime}
							chips={[
								{ value: "day", label: "By day", icon: "sun" },
								{ value: "night", label: "At night", icon: "moon" },
							]}
						/>
					</div>

					<ChipGroup
						label="Category"
						value={category}
						onChange={setCategory}
						chips={[
							{ value: "all", label: "All", count: searched.length },
							...categories.map((id) => ({
								value: id,
								label: CATEGORY_LABELS[id],
								icon: CATEGORY_ICONS[id],
								count: searched.filter((part) => part.category === id).length,
							})),
						]}
					/>

					{shown.length === 0 && (
						<Hint>
							{query.trim()
								? `No parts match “${query.trim()}”${category === "all" ? "" : ` in ${CATEGORY_LABELS[category]}`}.`
								: "No parts here yet."}
						</Hint>
					)}

					<ul className={styles.grid}>
						{shown.map((part) => (
							<li key={part.kind}>
								<button type="button" className={styles.card} onClick={() => onOpen(part.kind)}>
									<span className={styles.picture} data-night={night || undefined}>
										{pictures[part.kind] && <img src={pictures[part.kind]} alt="" />}
									</span>

									<span className={styles.cardText}>
										<strong>{partName(part)}</strong>

										<span className={styles.cardDescription}>{part.description}</span>

										<code className={styles.cardKind}>{part.kind}</code>
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>

				<Dialog
					open={open !== undefined}
					onOpenChange={(isOpen) => {
						if (!isOpen) {
							onOpen(null);
						}
					}}
					title={open ? partName(open) : ""}
					description={open ? CATEGORY_LABELS[open.category] : undefined}
					closeLabel="Close"
					wide
				>
					{open && <PartDetails part={open} theme={theme} night={night} />}
				</Dialog>
			</Toaster>
		</TooltipProvider>
	);
};
