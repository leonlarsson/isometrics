import { useEffect, useState } from "react";

import { startNewWorld } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";
import { useResolvedTheme } from "#/editor/useTheme";
import { markWelcomed, shouldWelcome } from "#/editor/welcome";
import { APP_NAME } from "#/lib/app";
import { TEMPLATES } from "#/templates";

import { Button } from "./Button";
import { ChoiceCards, type IChoiceCard } from "./ChoiceCards";
import { Dialog } from "./Dialog";
import { Hint } from "./fields";
import { Icon, type TIconName } from "./Icon";
import { useWorldPictures } from "./useWorldPictures";

import styles from "./Welcome.module.css";

type TWelcomeChoice = "city" | "ai" | "example";

/** Build with AI's picture: no world yet, it starts from words, so a prompt and the AI answering. */
const PromptPicture = () => (
	<span className={styles.prompt}>
		<span className={styles.asked}>
			A harbour town at dusk
			<span className={styles.caret} />
		</span>

		<span className={styles.answering}>
			<Icon name="sparkle" size={12} />

			<span className={styles.dot} />

			<span className={styles.dot} />

			<span className={styles.dot} />
		</span>
	</span>
);

/** Each way in, and its picture: a starter's, or Build with AI's prompt. */
const WAYS_IN: {
	value: TWelcomeChoice;
	title: string;
	description: string;
	picture: { starter: string } | "prompt";
	titleIcon?: TIconName;
}[] = [
	{
		value: "city",
		title: "Build a city",
		description: "Start from a blank world or a starter.",
		picture: { starter: "lantern-bay" },
	},
	{
		value: "example",
		title: "Explore an example",
		description: "Brightwater, a finished harbour city.",
		picture: { starter: "brightwater" },
	},
	{
		value: "ai",
		title: "Build with AI",
		description: "Your own AI builds it.",
		picture: "prompt",
		titleIcon: "sparkle",
	},
];

const PICTURE_SOURCES = TEMPLATES.filter((template) =>
	WAYS_IN.some((way) => way.picture !== "prompt" && way.picture.starter === template.id),
);

/** The guide, in a tab of its own so the editor stays as it is. */
export const openGuide = () => window.open("/guide", "_blank", "noopener");

/** Open what a way in leads to. */
const go = (choice: TWelcomeChoice) => {
	const state = useEditor.getState();
	if (choice === "city") {
		state.setNewWorld({ shows: "places", usesData: false });
	}
	// Described in words, built by the person's own AI (ADR-0116).
	if (choice === "ai") {
		state.setBuildWithAi("new");
	}
	// Brightwater as a world of their own, straight away: on a first visit, in place of the starter behind.
	if (choice === "example") {
		const brightwater = TEMPLATES.find((template) => template.id === "brightwater");
		if (brightwater) {
			startNewWorld(brightwater.create());
		}
	}
};

/**
 * The welcome (ADR-0116, ADR-0131): three ways in, each with a picture, for
 * someone who has just arrived: build a city (New world), explore an example
 * (Brightwater, opened as their own), or build with their own AI (Build with
 * AI, a new world). Shown once to a browser with no worlds; the app menu's
 * Welcome… (the logo) shows it again. Closing it leaves the starter world to look around in.
 */
export const Welcome = () => {
	const open = useEditor((s) => s.welcomeOpen);
	const title = useEditor((s) => s.scene.meta.title);
	const [choice, setChoice] = useState<TWelcomeChoice>("city");
	const picture = useWorldPictures(useResolvedTheme(), PICTURE_SOURCES, open);

	useEffect(() => {
		if (shouldWelcome()) {
			useEditor.getState().setWelcomeOpen(true);
		}
	}, []);

	const close = () => {
		markWelcomed();
		useEditor.getState().setWelcomeOpen(false);
	};
	const start = (picked: TWelcomeChoice) => {
		close();
		go(picked);
	};

	const cards: IChoiceCard<TWelcomeChoice>[] = WAYS_IN.map((way) => ({
		value: way.value,
		title: way.title,
		titleIcon: way.titleIcon,
		description: way.description,
		picture: way.picture === "prompt" ? <PromptPicture /> : picture(way.picture.starter),
	}));

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !next && close()}
			title={`Welcome to ${APP_NAME}`}
			description="Small animated 3D worlds: a city to build, or a map that shows your data. How would you like to start?"
			closeLabel="Look around first"
			confirm={{ label: "Start", onConfirm: () => start(choice) }}
			wide
		>
			<ChoiceCards
				label="How to start"
				value={choice}
				onChange={setChoice}
				onPick={start}
				cards={cards}
			/>

			<Hint>
				{`Behind this is “${title}”: look around first if you like. Every way in is there later too: the ${APP_NAME} menu (the logo, top left) has Welcome…, and the guide walks through it all, with a real API.`}
			</Hint>

			<Button size="sm" icon="newTab" onClick={openGuide}>
				Read the guide
			</Button>
		</Dialog>
	);
};
