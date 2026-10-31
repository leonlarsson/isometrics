import { useEffect, useState } from "react";

import { useEditor } from "#/editor/store";
import { useResolvedTheme } from "#/editor/useTheme";
import { markWelcomed, shouldWelcome } from "#/editor/welcome";
import { APP_NAME } from "#/lib/app";
import { type IScenePictureSource, useScenePictures } from "#/render/scenePictures";
import { TEMPLATES } from "#/templates";

import { Button } from "./Button";
import { ChoiceCards, type IChoiceCard } from "./ChoiceCards";
import { Dialog } from "./Dialog";
import { Hint } from "./fields";

type TWelcomeChoice = "city" | "data" | "example";

/** Each way in, the starter its picture shows, and what it opens. */
const WAYS_IN: { value: TWelcomeChoice; title: string; description: string; picture: string }[] = [
	{
		value: "city",
		title: "Build a city",
		description: "Buildings, roads and water, with nothing about data.",
		picture: "brightwater",
	},
	{
		value: "data",
		title: "Show my data",
		description: "Describe it, and your own AI builds it from your data.",
		picture: "battlefield_territory",
	},
	{
		value: "example",
		title: "Explore an example",
		description: "A finished map of live data, to see how it's wired.",
		picture: "extraction_shooters",
	},
];

const PICTURE_SOURCES: IScenePictureSource[] = TEMPLATES.filter((template) =>
	WAYS_IN.some((way) => way.picture === template.id),
);
const NO_PICTURES: IScenePictureSource[] = [];

/** The guide, in a tab of its own so the editor stays as it is. */
export const openGuide = () => window.open("/guide", "_blank", "noopener");

/** Open what a way in leads to. */
const go = (choice: TWelcomeChoice) => {
	const state = useEditor.getState();
	if (choice === "city") {
		state.setNewWorld({ shows: "places", usesData: false });
	}
	if (choice === "data") {
		state.setBuildWithAiOpen(true);
	}
	if (choice === "example") {
		state.setNewWorld({ shows: "dataMaps", usesData: true });
	}
};

/**
 * The welcome (ADR-0116): three ways in, each with a picture, for someone who
 * has just arrived: build a city, show their data with their own AI, or open
 * an example. Shown once to a browser with no worlds; File → Welcome… shows
 * it again. Closing it leaves the starter world to look around in.
 */
export const Welcome = () => {
	const open = useEditor((s) => s.welcomeOpen);
	const [choice, setChoice] = useState<TWelcomeChoice>("city");
	const pictures = useScenePictures(useResolvedTheme(), open ? PICTURE_SOURCES : NO_PICTURES);

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
		description: way.description,
		picture: pictures[way.picture] ? <img src={pictures[way.picture]} alt="" /> : null,
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
				The world behind this is Brightwater, a starter town: look around first if you like. Every
				way in is in the File menu later, and the guide walks through it all, with a real API.
			</Hint>

			<Button size="sm" icon="newTab" onClick={openGuide}>
				Read the guide
			</Button>
		</Dialog>
	);
};
