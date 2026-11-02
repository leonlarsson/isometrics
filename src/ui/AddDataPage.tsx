import { useEditor } from "#/editor/store";

import { ActionCards } from "./ActionCards";
import { Button } from "./Button";
import { Icon, type TIconName } from "./Icon";

import styles from "./DataWindow.module.css";

/** What data can do in a world, as three small examples (ADR-0123). */
const EXAMPLES: { icon: TIconName; title: string; about: string }[] = [
	{
		icon: "building",
		title: "A tower for each shop, as tall as its sales",
		about: "From a table: one row for each shop",
	},
	{
		icon: "tag",
		title: "A card with today's visitors",
		about: "From a single number, typed or read from a link",
	},
	{
		icon: "road",
		title: "A road as busy as this month's trips",
		about: "Read again every hour from a link",
	},
];

interface IAddDataPageProps {
	/** The world has no data yet: say what data is for first. */
	isFirst: boolean;
	onFile: () => void;
	onLink: () => void;
	onType: () => void;
}

/**
 * Add data in the Data window (ADR-0123): where the data is, as three cards
 * (a spreadsheet file, a link or API, a number typed by hand). For a world
 * with no data yet it first says what data is for, with three examples and
 * a way to open an example world.
 */
export const AddDataPage = ({ isFirst, onFile, onLink, onType }: IAddDataPageProps) => {
	const setNewWorld = useEditor((s) => s.setNewWorld);
	const openDataWindow = useEditor((s) => s.openDataWindow);

	return (
		<>
			{isFirst && (
				<section className={styles.why}>
					<h3 className={styles.pageTitle}>Make the world show real numbers</h3>

					<p className={styles.pageAbout}>
						Bring in numbers from a spreadsheet or a link, or type them. Then things in the world
						show them, and change when the numbers do.
					</p>

					<ul className={styles.examples}>
						{EXAMPLES.map((example) => (
							<li key={example.title} className={styles.example}>
								<span className={styles.exampleIcon}>
									<Icon name={example.icon} size={18} />
								</span>

								<span>
									<strong>{example.title}</strong>

									<span>{example.about}</span>
								</span>
							</li>
						))}
					</ul>
				</section>
			)}

			<header className={styles.pageHead}>
				<h3 className={isFirst ? styles.stepTitle : styles.pageTitle}>Where is your data?</h3>

				<p className={styles.pageAbout}>
					You'll see what was read before anything changes, then pick what shows it in the world.
				</p>
			</header>

			<ActionCards
				cards={[
					{
						title: "A spreadsheet file…",
						about: "CSV or Excel from your computer. Read it again when it changes.",
						onChoose: onFile,
					},
					{
						title: "A link or API…",
						about:
							"An address that gives CSV or JSON. It can update by itself every minute or hour.",
						onChoose: onLink,
					},
					{
						title: "Type a number",
						about: "A number you keep up to date by hand, like a goal or a count.",
						onChoose: onType,
					},
				]}
			/>

			{isFirst && (
				<div className={styles.pageFoot}>
					<Button
						size="sm"
						variant="ghost"
						icon="globe"
						onClick={() => {
							openDataWindow(null);
							setNewWorld({ shows: "dataMaps", usesData: true });
						}}
					>
						Open an example world…
					</Button>
				</div>
			)}
		</>
	);
};
