import { useEffect, useMemo, useState } from "react";

import { aiPrompt, worldFromAnswer } from "#/editor/aiPrompt";
import { pickFile, startNewWorld } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { checkPatch, checkWorld, type IWorldCheck, issuesForAi } from "#/parts/checkWorld";
import { readWorld } from "#/parts/readWorld";
import { describeRepairs } from "#/scene/repair";
import { applyWorldPatch, describePatchChanges, isWorldPatch } from "#/scene/worldPatch";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { FieldGroup, Hint, RadioGroupField, TextField } from "./fields";
import { List, ListItem } from "./List";
import { openGuide } from "./Welcome";

import styles from "./BuildWithAiDialog.module.css";

type TBuilds = "new" | "change";

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** A pasted answer's check in a sentence: what it is, what it changes, and what's wrong. */
const summaryOf = (check: IWorldCheck) => {
	const what = check.changes ? `a patch. ${check.changes}` : `${check.contents}.`;
	const wrong = [
		check.problems.length > 0 &&
			`${plural(check.problems.length, "problem")} (${check.changes ? "the rest still applies" : "opening repairs them"})`,
		check.warnings.length > 0 &&
			`${plural(check.warnings.length, "warning")} (it opens, but won't look as meant)`,
	].filter(Boolean);
	if (wrong.length === 0) {
		return `Checked: ${what} ${check.changes ? "It applies as written." : "It opens as written."}`;
	}
	return `Checked: ${what} ${wrong.join(" and ")}. Go ahead anyway, or ask your AI to fix them.`;
};

/** How many of a pasted world's problems and warnings the dialog lists. */
const ISSUES_SHOWN = 6;

/** Files whose text can go in the prompt as it is. */
const DATA_FILES = ".csv,.tsv,.txt,.json,text/csv,text/plain,application/json";

/**
 * Build with your AI (ADR-0116): describe the world, add data, copy a prompt
 * into any AI chat, and paste back the world it writes. Nothing is sent
 * anywhere by the app; what comes back is read like any world file
 * (`readWorld`), and opens as a new world or replaces this one (one undo step).
 * Keeps what's typed while the page is open.
 */
export const BuildWithAiDialog = () => {
	const asked = useEditor((s) => s.buildWithAi);
	const open = asked !== null;
	const title = useEditor((s) => s.scene.meta.title);
	const [builds, setBuilds] = useState<TBuilds>("new");
	const [description, setDescription] = useState("");
	const [data, setData] = useState("");
	const [answer, setAnswer] = useState("");
	const [copied, setCopied] = useState(false);
	// The prompt to copy by hand, when the browser wouldn't put it on the clipboard.
	const [promptByHand, setPromptByHand] = useState<string | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [issuesCopied, setIssuesCopied] = useState(false);
	const close = () => useEditor.getState().setBuildWithAi(null);

	// Opened for a new world or to change this one: that's what it builds.
	useEffect(() => {
		if (asked !== null) {
			setBuilds(asked);
			setCopied(false);
		}
	}, [asked]);
	const isDescribed = description.trim() !== "";

	const copyPrompt = async () => {
		const prompt = aiPrompt({
			description,
			data,
			world: builds === "change" ? useEditor.getState().scene : null,
			origin: window.location.origin,
		});
		try {
			await navigator.clipboard.writeText(prompt);
			setCopied(true);
			setPromptByHand(null);
		} catch {
			setPromptByHand(prompt);
		}
	};

	// The answer checked as it's pasted (ADR-0117): the same check as POST /api/worlds/validate.
	const check = useMemo(() => {
		if (!answer.trim()) {
			return null;
		}
		try {
			const parsed = worldFromAnswer(answer);
			// A patch (ADR-0118) is the changes to a world: checked against the one open now.
			if (isWorldPatch(parsed)) {
				return builds === "change"
					? checkPatch(useEditor.getState().scene, parsed)
					: {
							unreadable:
								"That's a patch: the changes to a world, not a whole one. Pick Change this world to put it in.",
						};
			}
			const checked = checkWorld(parsed);
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
			setCopied(false);
		}
	};

	const putInPlace = () => {
		let read: ReturnType<typeof readWorld>;
		// What a patch changes, said once it's in place.
		let changes: string | null = null;
		try {
			const parsed = worldFromAnswer(answer);
			if (isWorldPatch(parsed) && builds === "change") {
				const applied = applyWorldPatch(useEditor.getState().scene, parsed);
				changes = describePatchChanges(applied.changes);
				read = readWorld(applied.world);
			} else {
				read = readWorld(parsed);
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
		setAnswer("");
		setProblem(null);
		close();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !next && close()}
			title="Build with your AI"
			description="Describe a world or a change, copy a prompt into any AI chat, and paste back what it writes. Nothing is sent anywhere from here."
			closeLabel="Cancel"
			wide
			confirm={{
				label: builds === "new" ? "Open it" : "Put it in place",
				// Something to open: a world, even one that needs repairs.
				disabled: !check || "unreadable" in check,
				keepOpen: true,
				onConfirm: putInPlace,
			}}
		>
			<RadioGroupField<TBuilds>
				label="Build"
				value={builds}
				options={[
					{ value: "new", label: "A new world", meta: "Opens next to your other worlds" },
					{ value: "change", label: "Change this world", meta: `“${title}”, one undo step` },
				]}
				onChange={(next) => {
					setBuilds(next);
					setCopied(false);
				}}
				hasNoDefault
			/>

			<div className={styles.layout}>
				<div className={styles.column}>
					<FieldGroup title="1. Describe it">
						<TextField
							label={builds === "new" ? "How it looks and what it has" : "What to change"}
							value={description}
							placeholder={
								builds === "new"
									? "A harbour town at dusk, with a lighthouse, warehouses along the quay for each of my shops, and roads as busy as the deliveries between them."
									: "More trees along the roads, a park in the middle, and the shops' cards as chips."
							}
							onChange={(next) => {
								setDescription(next);
								setCopied(false);
							}}
							multiline
							rows={6}
							hasNoDefault
							hint="Your words go into the prompt as they are: the more you say about the look, the places and what shows what, the closer it gets."
						/>
					</FieldGroup>

					<FieldGroup title="2. Your data (optional)">
						<TextField
							label="Data (optional)"
							value={data}
							placeholder="Paste rows from a spreadsheet, a CSV or JSON…"
							onChange={(next) => {
								setData(next);
								setCopied(false);
							}}
							multiline
							rows={6}
							hasNoDefault
							hint={
								builds === "change"
									? "The world's own data goes along with it; add only what's new."
									: "Skip it if you like: you can give your data to your AI instead, attached or pasted in the chat after the prompt. Or select cells in Excel or Google Sheets and paste them here. With none at all, it builds a plain world, or one with example numbers if you asked for numbers."
							}
						/>

						<Button size="sm" icon="upload" onClick={() => void readDataFile()}>
							Read a file…
						</Button>
					</FieldGroup>
				</div>

				<div className={styles.column}>
					<FieldGroup title="3. Copy the prompt">
						<Button
							variant="primary"
							icon={copied ? "check" : "copy"}
							disabled={!isDescribed}
							onClick={() => void copyPrompt()}
						>
							{copied ? "Copied: paste it into your AI" : "Copy the prompt"}
						</Button>

						{!isDescribed && (
							<Hint>
								{builds === "new"
									? "Describe the world first: it's what the prompt is about."
									: "Say what to change first: it's what the prompt is about."}
							</Hint>
						)}

						{promptByHand !== null && (
							<TextField
								label="The prompt (this browser wouldn't copy it: select it all and copy it)"
								value={promptByHand}
								onChange={() => undefined}
								multiline
								rows={6}
								hasNoDefault
							/>
						)}

						<Hint>
							Paste it into the AI chat you use. The prompt has the world format, every part and the
							guide's rules, so it can answer with a world, or the changes to one.
						</Hint>

						<Button size="sm" icon="newTab" onClick={openGuide}>
							Read the guide
						</Button>
					</FieldGroup>

					<FieldGroup title="4. Paste its answer, or open its file">
						<TextField
							label="Its answer"
							value={answer}
							placeholder="{ … }"
							onChange={(next) => {
								setAnswer(next);
								setProblem(null);
								setIssuesCopied(false);
							}}
							multiline
							rows={6}
							hasNoDefault
							hint={
								builds === "new"
									? "Words around the JSON are fine. It opens as a new world, repaired where it needs it."
									: "The changes it wrote (a patch), or a whole world; words around the JSON are fine. Undo brings this world back."
							}
						/>

						<Button size="sm" icon="upload" onClick={() => void readAnswerFile()}>
							Open its file…
						</Button>

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
					</FieldGroup>
				</div>
			</div>
		</Dialog>
	);
};
