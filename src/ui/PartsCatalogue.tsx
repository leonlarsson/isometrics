import { useEffect, useRef, useState } from "react";

import { notify } from "#/editor/toasts";
import { usePrefersDark } from "#/editor/useTheme";
import { APP_NAME } from "#/lib/app";
import { PARTS, partName, resolveProps, type TAnyPart } from "#/parts/registry";
import { CATEGORY_LABELS, type TPartCategory } from "#/parts/types";
import { PartPreviewModel } from "#/render/PartPreviewModel";
import {
	type IPictureLook,
	type IPictureSize,
	pictureLookHour,
	pictureLookPalette,
	usePartPictures,
	usePartPicturesWith,
} from "#/render/thumbnails";
import {
	hasObjectSettings,
	NO_OBJECT_SETTINGS,
	type TObjectSettings,
	withColorChange,
	withLightChange,
	withPropChange,
} from "#/scene/objectSettings";
import { scenePalettes, type TResolvedTheme } from "#/scene/theme";
import { familyOf, groupByFamily } from "#/scene/variants";

import { Button, IconButton } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { Dialog } from "./Dialog";
import { Hint, SearchField } from "./fields";
import { CATEGORY_ICONS } from "./inspectorTabs";
import { PartColorsSection, PartLightCards, PartShapeSection } from "./PartSettings";
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

const LOOKS_SHOWN = LOOKS.map(({ look }) => look);

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

/** How long a copy button shows its tick after copying. */
const COPIED_MS = 2000;

/**
 * Put text on the clipboard, saying so (or that the browser didn't allow it);
 * `copied` is true for a moment afterwards, so the button can show a tick.
 */
const useCopy = () => {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);
	const copy = (text: string, done: string) => {
		void navigator.clipboard
			.writeText(text)
			.then(() => {
				notify(done);
				setCopied(true);
				clearTimeout(timer.current);
				timer.current = setTimeout(() => setCopied(false), COPIED_MS);
			})
			.catch(() => notify("Couldn't copy: the browser didn't allow it"));
	};
	return { copied, copy };
};

/**
 * The part with these settings as an object copied from the editor (ADR-0068):
 * Ctrl+V in a world pastes it, and the object inside is what a world's file holds.
 */
const objectText = (part: TAnyPart, { props, colors, lights }: TObjectSettings) =>
	JSON.stringify(
		{
			app: APP_NAME.toLowerCase(),
			type: "things",
			entities: [
				{
					id: part.kind,
					kind: part.kind,
					...(Object.keys(props).length > 0 && { props }),
					...(Object.keys(colors).length > 0 && { colors }),
					...(Object.keys(lights).length > 0 && { lights }),
				},
			],
		},
		null,
		2,
	);

/** A part's kind, to copy for a world written by hand or by an AI. */
const KindCode = ({ kind }: { kind: string }) => {
	const { copied, copy } = useCopy();
	return (
		<span className={styles.kind}>
			<code>{kind}</code>

			<IconButton
				icon={copied ? "check" : "copy"}
				label={copied ? `Copied ${kind}` : `Copy ${kind}`}
				onClick={() => copy(kind, `Copied ${kind}`)}
			/>
		</span>
	);
};

/** A part's family: every part whose kind shares its family ("round_tree_01", "round_tree_02"). */
const familyParts = (part: TAnyPart) =>
	PARTS.filter((other) => familyOf(other.kind) === familyOf(part.kind));

interface IPartDetailsProps {
	part: TAnyPart;
	theme: TResolvedTheme;
	night: boolean;
	/** What's been changed here: its props, colours and lights. */
	settings: TObjectSettings;
	onSettingsChange: (settings: TObjectSettings) => void;
}

/**
 * Everything about one part: a live model and its four looks, and the
 * editor's own panels for its settings, colours and lights to try it out.
 */
const PartDetails = ({
	part,
	theme,
	night,
	settings,
	onSettingsChange,
	onOpen,
}: IPartDetailsProps & { onOpen: (kind: string) => void }) => {
	const family = familyParts(part);
	const looks = usePartPicturesWith(part, settings, LOOKS_SHOWN, LOOK_PICTURE);
	const palette = pictureLookPalette({ theme, night });
	const hour = pictureLookHour({ theme, night });
	const props = resolveProps(part, settings.props) as Record<string, unknown>;
	const [width, depth] = part.footprint(props);
	const object = { ...settings, color: null, accent: null };
	const changed = hasObjectSettings(settings);
	const json = useCopy();
	return (
		<div className={styles.details}>
			<div className={styles.detailsPictures}>
				<div className={styles.model} data-night={night || undefined}>
					<PartPreviewModel
						kind={part.kind}
						palette={palette}
						settings={settings}
						hour={hour}
						zoomsWithWheel
					/>

					<span className={styles.modelHint}>Scroll to zoom</span>
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
								{looks[i] && <img src={looks[i]} alt="" />}
							</span>

							<figcaption>{label}</figcaption>
						</figure>
					))}
				</div>
			</div>

			<div className={styles.facts}>
				{/* A family's variants: switch between them here (ADR-0088). */}
				{family.length > 1 && (
					<ChipGroup
						label="Variant"
						size="sm"
						value={part.kind}
						onChange={onOpen}
						chips={family.map((variant) => ({ value: variant.kind, label: partName(variant) }))}
					/>
				)}

				<p className={styles.description}>{part.description}.</p>

				<dl className={styles.list}>
					<dt>Kind</dt>

					<dd>
						<KindCode kind={part.kind} />
					</dd>

					<dt>Category</dt>

					<dd>{CATEGORY_LABELS[part.category]}</dd>

					<dt>Size</dt>

					<dd>{`${round(width)} × ${round(depth)} wide, ${round(part.height(props))} tall`}</dd>

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

				<div className={styles.tryOut}>
					<Button
						size="sm"
						icon={json.copied ? "check" : "copy"}
						showsSuccess={json.copied}
						onClick={() =>
							json.copy(
								objectText(part, settings),
								`Copied ${partName(part)}: paste it into a world with Ctrl+V`,
							)
						}
					>
						Copy as JSON
					</Button>

					<Button
						size="sm"
						icon="reset"
						disabled={!changed}
						onClick={() => onSettingsChange(NO_OBJECT_SETTINGS)}
					>
						Reset all
					</Button>
				</div>

				<Hint>
					Try its settings, colours and lights below; the link keeps them. Copy as JSON to paste it
					into a world (Ctrl+V in the editor) or a world's file. In a world, colours and lights can
					also follow its data.
				</Hint>

				<PartShapeSection
					part={part}
					object={object}
					data={[]}
					showFileNames
					startsFolded
					onChange={(key, value) =>
						onSettingsChange(withPropChange(settings, key, value, resolveProps(part, {})))
					}
				/>

				<PartColorsSection
					part={part}
					object={object}
					data={[]}
					showFileNames
					startsFolded
					palette={palette}
					onChange={(id, change) => onSettingsChange(withColorChange(settings, id, change))}
				/>

				<PartLightCards
					part={part}
					object={object}
					data={[]}
					showFileNames
					startsFolded
					palette={palette}
					hour={hour}
					onChange={(id, change) => onSettingsChange(withLightChange(settings, id, change))}
				/>
			</div>
		</div>
	);
};

interface IPartsCatalogueProps {
	/** The part whose details are open (`?part=` in the address), or null. */
	openKind: string | null;
	onOpen: (kind: string | null) => void;
	/** What's been changed in its details (`?settings=`). */
	settings: TObjectSettings;
	onSettingsChange: (settings: TObjectSettings) => void;
}

/**
 * The parts catalogue at /parts: every part you can add to a world, in either
 * theme, by day or at night, with a search and the categories as chips. A
 * part's details show it turning and its four looks, with the editor's panels
 * for its settings, colours and lights to try it out, and the names a world's
 * file uses for them (ADR-0087).
 */
export const PartsCatalogue = ({
	openKind,
	onOpen,
	settings,
	onSettingsChange,
}: IPartsCatalogueProps) => {
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
						Every part you can add to a world. Click one to see it turn and how it looks in each
						theme by day and at night, and to try out its settings, colours and lights.
					</p>

					<p className={styles.intro}>
						<a className={styles.link} href="/api/worlds/schema">
							/api/worlds/schema
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

					{/* A card per family, showing its first variant; its details switch between them. */}
					<ul className={styles.grid}>
						{groupByFamily(shown, (part) => part.kind).map(
							({ family, variants: [part, ...more] }) => (
								<li key={family}>
									<button type="button" className={styles.card} onClick={() => onOpen(part.kind)}>
										<span className={styles.picture} data-night={night || undefined}>
											{pictures[part.kind] && <img src={pictures[part.kind]} alt="" />}
										</span>

										<span className={styles.cardText}>
											<strong>{more.length > 0 ? part.name : partName(part)}</strong>

											{more.length > 0 && (
												<span className={styles.cardVariants}>{`${more.length + 1} variants`}</span>
											)}

											<span className={styles.cardDescription}>{part.description}</span>

											<code className={styles.cardKind}>
												{more.length > 0 ? `${familyOf(part.kind)}_…` : part.kind}
											</code>
										</span>
									</button>
								</li>
							),
						)}
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
					initialFocus="dialog"
				>
					{open && (
						<PartDetails
							part={open}
							theme={theme}
							night={night}
							settings={settings}
							onSettingsChange={onSettingsChange}
							onOpen={onOpen}
						/>
					)}
				</Dialog>
			</Toaster>
		</TooltipProvider>
	);
};
