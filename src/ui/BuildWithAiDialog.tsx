import { useEffect, useMemo, useState } from "react";

import { aiPrompt, worldFromAnswer } from "#/editor/aiPrompt";
import { pickFile, startNewWorld } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import {
	fetchSharedWorld,
	HANDOFF_SECONDS,
	ShareError,
	sharedWorldIdOf,
	shareWorld,
} from "#/editor/userWorlds";
import { repairWorld } from "#/parts/repairWorld";
import {
	type IWorldValidation,
	issuesForAi,
	validatePatch,
	validateWorld,
} from "#/parts/validateWorld";
import { describeRepairs } from "#/scene/repair";
import { applyWorldPatch, describePatchChanges, isWorldPatch } from "#/scene/worldPatch";

import { Button } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { Dialog } from "./Dialog";
import { Hint, resetToDefault, SwitchField, TextField } from "./fields";
import { List, ListItem } from "./List";

import styles from "./BuildWithAiDialog.module.css";

type TBuilds = "new" | "change";

/** Where the dialog is: saying what to build, or bringing back what the AI wrote. */
type TStep = "ask" | "answer";

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** A pasted answer's check in a sentence: what it is, and what's wrong. */
const summaryOf = (check: IWorldValidation) => {
	// A patch's summary already says what it does ("Changes lighting (time)").
	const what = check.changes ?? `A world with ${check.contents}.`;
	const wrong = [
		check.problems.length > 0 && plural(check.problems.length, "problem"),
		check.warnings.length > 0 && plural(check.warnings.length, "warning"),
	].filter(Boolean);
	return wrong.length === 0
		? `${what} Ready to ${check.changes ? "apply" : "open"}.`
		: `${what} ${wrong.join(" and ")}: it ${check.changes ? "still applies" : "still opens, repaired"}, or ask your AI to fix them.`;
};

/** How many of a pasted world's problems and warnings the dialog lists. */
const ISSUES_SHOWN = 6;

/** Files whose text can go in the prompt as it is. */
const DATA_FILES = ".csv,.tsv,.txt,.json,text/csv,text/plain,application/json";

/**
 * Build with AI (ADR-0116): two steps. Ask: say what to build (a new world, or
 * a change to this one), with data and the world as a link behind folds, and
 * copy the prompt into any AI chat. Then bring back what it writes: paste it,
 * open its file, or paste the link it gives; it's checked as it arrives, and
 * opens as a new world or changes this one (one undo step). Nothing is sent
 * anywhere by the app unless the world is handed over as a link. What comes
 * back is read like any world file (`repairWorld`). Keeps what's typed, and
 * which step it's on, while the page is open.
 */
export const BuildWithAiDialog = () => {
	const asked = useEditor((s) => s.buildWithAi);
	const open = asked !== null;
	const title = useEditor((s) => s.scene.meta.title);
	// Changing a world needs one open (not on the home screen, nor while a link opens).
	const hasWorld = useEditor((s) => s.whatIsOpen.kind === "world");
	const [builds, setBuilds] = useState<TBuilds>("new");
	const [step, setStep] = useState<TStep>("ask");
	const [description, setDescription] = useState("");
	const [showsData, setShowsData] = useState(false);
	const [data, setData] = useState("");
	const [showsOptions, setShowsOptions] = useState(false);
	// Changing a world: hand it over as a public link for an hour instead of in the prompt (ADR-0120).
	const [handsOverLink, setHandsOverLink] = useState(false);
	const [answer, setAnswer] = useState("");
	// The prompt last copied: Copy the prompt again copies it as it was (no second link made).
	const [lastPrompt, setLastPrompt] = useState<string | null>(null);
	// The prompt to copy by hand, when the browser wouldn't put it on the clipboard.
	const [promptByHand, setPromptByHand] = useState<string | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [issuesCopied, setIssuesCopied] = useState(false);
	const [makingPrompt, setMakingPrompt] = useState(false);
	// A pasted link to a shared world, being read.
	const [readingLink, setReadingLink] = useState<string | null>(null);
	const close = () => useEditor.getState().setBuildWithAi(null);

	// Opened for a new world or to change this one: that's what it builds, from the start.
	useEffect(() => {
		if (asked !== null) {
			setBuilds(asked === "change" && hasWorld ? "change" : "new");
		}
	}, [asked]);
	const isDescribed = description.trim() !== "";

	const switchTo = (next: TBuilds) => {
		setBuilds(next);
		setStep("ask");
	};

	const copyPrompt = async () => {
		const world = builds === "change" ? useEditor.getState().scene : null;
		let worldUrl: string | null = null;
		if (world && handsOverLink) {
			setMakingPrompt(true);
			try {
				worldUrl = (await shareWorld(world, HANDOFF_SECONDS, { isHandoff: true })).jsonUrl;
			} catch (error) {
				notify(
					"The world couldn't be handed over as a link",
					`${error instanceof ShareError ? error.message : "Try again in a moment."} Turn off the link to put the world in the prompt instead.`,
					"error",
				);
				return;
			} finally {
				setMakingPrompt(false);
			}
		}
		const prompt = aiPrompt({
			description,
			data,
			world,
			origin: window.location.origin,
			worldUrl,
		});
		setLastPrompt(prompt);
		await copy(prompt);
		setStep("answer");
	};

	/** Put the prompt on the clipboard, or show it to copy by hand if the browser won't. */
	const copy = async (prompt: string) => {
		try {
			await navigator.clipboard.writeText(prompt);
			setPromptByHand(null);
			notify("Prompt copied", "Paste it into your AI chat.");
		} catch {
			setPromptByHand(prompt);
		}
	};

	// An answer that's a link to a world shared on this site (an AI that posted it, ADR-0120): read
	// from the link, then checked like any answer. Only this site's own links are read.
	useEffect(() => {
		const id = sharedWorldIdOf(answer);
		if (!id) {
			return;
		}
		setReadingLink(answer.trim());
		fetchSharedWorld(id)
			.then(({ text }) => setAnswer(text))
			.catch((error) =>
				setProblem(error instanceof ShareError ? error.message : "The link couldn't be read."),
			)
			.finally(() => setReadingLink(null));
	}, [answer]);

	// The answer checked as it's pasted (ADR-0117): the same check as POST /api/worlds/validate.
	const check = useMemo(() => {
		// Nothing yet, or a link still being read.
		if (!answer.trim() || sharedWorldIdOf(answer)) {
			return null;
		}
		try {
			const parsed = worldFromAnswer(answer);
			// A patch (ADR-0118) is the changes to a world: checked against the one open now.
			if (isWorldPatch(parsed)) {
				return builds === "change"
					? validatePatch(useEditor.getState().scene, parsed)
					: {
							unreadable:
								"That's changes to a world, not a whole one: pick Change this world above to apply them.",
						};
			}
			const checked = validateWorld(parsed);
			// Not a world at all (no version or things): said as such, not as a list of problems.
			return checked.isUnreadable
				? { unreadable: checked.problems[0]?.what ?? "It isn't a world." }
				: checked;
		} catch (error) {
			return { unreadable: error instanceof Error ? error.message : String(error) };
		}
	}, [answer, builds]);

	const copyIssues = async () => {
		if (check && "isValid" in check) {
			try {
				await navigator.clipboard.writeText(issuesForAi(check));
				setIssuesCopied(true);
			} catch {
				notify(
					"This browser wouldn't copy it",
					"Select the problems above and copy them.",
					"error",
				);
			}
		}
	};

	const readAnswerFile = async () => {
		const file = await pickFile("application/json,.json,.txt,text/plain");
		if (file) {
			setAnswer(await file.text());
			setProblem(null);
			setIssuesCopied(false);
		}
	};

	const readDataFile = async () => {
		const file = await pickFile(DATA_FILES);
		if (file) {
			setData(await file.text());
		}
	};

	const putInPlace = () => {
		let read: ReturnType<typeof repairWorld>;
		// What a patch changes, said once it's in place.
		let changes: string | null = null;
		try {
			const parsed = worldFromAnswer(answer);
			if (isWorldPatch(parsed) && builds === "change") {
				const applied = applyWorldPatch(useEditor.getState().scene, parsed);
				changes = describePatchChanges(applied.changes);
				read = repairWorld(applied.world);
			} else {
				read = repairWorld(parsed);
			}
		} catch (error) {
			setProblem(error instanceof Error ? error.message : String(error));
			return;
		}
		const { scene, report } = read;
		if (builds === "new") {
			startNewWorld(scene);
		} else {
			useEditor.getState().commit((draft) => {
				Object.assign(draft, scene);
			});
		}
		notify(
			builds === "new" ? `Opened “${scene.meta.title}”` : "The world was changed",
			[
				changes,
				report && `Repaired where it needed it: ${describeRepairs(report)}`,
				builds === "change" && "Undo (Ctrl+Z) brings the world back as it was.",
			]
				.filter(Boolean)
				.join(" "),
		);
		// Done: a fresh start next time.
		setAnswer("");
		setDescription("");
		setData("");
		setProblem(null);
		setStep("ask");
		close();
	};

	const isAsking = step === "ask";
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !next && close()}
			title="Build with AI"
			description={
				isAsking
					? "Say what you want, copy the prompt into any AI chat, and bring back what it writes."
					: "Copied. Paste it into your AI chat, then bring back what it writes."
			}
			closeLabel="Cancel"
			confirm={
				isAsking
					? {
							label: makingPrompt ? "Making its link…" : "Copy the prompt",
							disabled: !isDescribed || makingPrompt,
							keepOpen: true,
							onConfirm: () => void copyPrompt(),
						}
					: {
							label: builds === "new" ? "Open it" : "Apply the changes",
							// Something to open: a world, even one that needs repairs.
							disabled: !check || "unreadable" in check,
							keepOpen: true,
							onConfirm: putInPlace,
						}
			}
		>
			<div className={styles.body}>
				{hasWorld && (
					<ChipGroup<TBuilds>
						label="What it builds"
						value={builds}
						onChange={switchTo}
						chips={[
							{ value: "new", label: "A new world", icon: "file" },
							{ value: "change", label: `Change “${title}”`, icon: "edit" },
						]}
						size="sm"
					/>
				)}

				{isAsking ? (
					<>
						<TextField
							label={builds === "new" ? "What should your AI build?" : "What should it change?"}
							value={description}
							placeholder={
								builds === "new"
									? "A harbour town at dusk, with a lighthouse and a warehouse for each of my shops."
									: "More trees along the roads, and a park in the middle."
							}
							onChange={setDescription}
							multiline
							rows={5}
							hasNoDefault
						/>

						{showsData ? (
							<div className={styles.fold}>
								<TextField
									label="Your data"
									value={data}
									placeholder="Paste rows from a spreadsheet, a CSV or JSON…"
									onChange={setData}
									multiline
									rows={4}
									hasNoDefault
									hint={
										builds === "change"
											? "The world's own data goes along with it: add only what's new."
											: "Rows from Excel or Google Sheets, a CSV or JSON. Or skip it and give your data to your AI in the chat."
									}
								/>

								<Button size="sm" icon="upload" onClick={() => void readDataFile()}>
									Read a file…
								</Button>
							</div>
						) : null}

						{builds === "change" && showsOptions && (
							<div className={styles.fold}>
								<SwitchField
									label="Give your AI a link to the world"
									checked={handsOverLink}
									onChange={setHandsOverLink}
									inherit={resetToDefault(handsOverLink, false, () => setHandsOverLink(false))}
									hint="A short prompt with a link instead of the whole world. The link is public to anyone who has it for an hour, and your AI must be able to open links."
								/>
							</div>
						)}

						<div className={styles.links}>
							{!showsData && (
								<Button size="sm" variant="text" icon="plus" onClick={() => setShowsData(true)}>
									Add your data
								</Button>
							)}

							{builds === "change" && !showsOptions && (
								<Button size="sm" variant="text" onClick={() => setShowsOptions(true)}>
									More options
								</Button>
							)}

							<Button size="sm" variant="text" onClick={() => setStep("answer")}>
								I already have an answer
							</Button>
						</div>
					</>
				) : (
					<>
						{promptByHand !== null && (
							<TextField
								label="This browser wouldn't copy the prompt: select it all and copy it"
								value={promptByHand}
								onChange={() => undefined}
								multiline
								rows={4}
								hasNoDefault
							/>
						)}

						<TextField
							label="What your AI wrote"
							value={answer}
							placeholder={
								builds === "new"
									? "Paste the world it wrote, or the link it gave you…"
									: "Paste the changes it wrote, or the link it gave you…"
							}
							onChange={(next) => {
								setAnswer(next);
								setProblem(null);
								setIssuesCopied(false);
							}}
							multiline
							rows={7}
							hasNoDefault
						/>

						<div className={styles.links}>
							<Button size="sm" variant="text" icon="chevronLeft" onClick={() => setStep("ask")}>
								Back
							</Button>

							<Button size="sm" icon="upload" onClick={() => void readAnswerFile()}>
								Open its file…
							</Button>

							{lastPrompt !== null && (
								<Button size="sm" variant="text" icon="copy" onClick={() => void copy(lastPrompt)}>
									Copy the prompt again
								</Button>
							)}
						</div>

						{readingLink && <Hint>Reading it from its link…</Hint>}

						{check && "unreadable" in check && (
							<Hint>
								<strong>Not a world yet.</strong> {check.unreadable}
							</Hint>
						)}

						{check && "isValid" in check && (
							<>
								<Hint>{summaryOf(check)}</Hint>

								{check.problems.length + check.warnings.length > 0 && (
									<>
										<List>
											{[...check.problems, ...check.warnings]
												.slice(0, ISSUES_SHOWN)
												.map((issue) => (
													<ListItem
														key={`${issue.where}:${issue.what}`}
														label={issue.what}
														meta={issue.where}
														stacked
													/>
												))}
										</List>

										<Button size="sm" icon="copy" onClick={() => void copyIssues()}>
											{issuesCopied
												? "Copied: paste it to your AI"
												: "Copy the problems for your AI"}
										</Button>
									</>
								)}
							</>
						)}

						{problem && (
							<Hint>
								<strong>That didn't work.</strong> {problem}
							</Hint>
						)}
					</>
				)}
			</div>
		</Dialog>
	);
};
