import { useEffect } from "react";

import { useEditor } from "#/editor/store";
import { setStoryAt, setStoryPlaying, useStory } from "#/editor/story";
import { storyDates } from "#/scene/story";

import { Button, IconButton } from "./Button";
import { SliderField } from "./fields";
import { formatWhen } from "./Sparkline";

import styles from "./StoryBar.module.css";

/** How long each date shows while the story plays, in milliseconds. */
const STEP_MS = 900;

/**
 * The story bar in View mode (ADR-0114): a slider over every date the world's
 * data has, and Play, so everything that follows a value shows it as it was
 * then. Now goes back to the data as it is. Shown when the data has at least
 * two dates.
 */
export const StoryBar = () => {
	const inView = useEditor((s) => s.mode === "view");
	const data = useEditor((s) => s.scene.data);
	const { at, isPlaying } = useStory();
	const dates = storyDates(data);
	const index = at === null ? dates.length - 1 : Math.max(0, dates.indexOf(at));

	// Playing: a date at a time, stopping at the last.
	useEffect(() => {
		if (!isPlaying) {
			return;
		}
		const timer = setInterval(() => {
			const { at: now } = useStory.getState();
			const next = now === null ? 0 : dates.indexOf(now) + 1;
			if (next >= dates.length) {
				setStoryPlaying(false);
				return;
			}
			setStoryAt(dates[next]);
		}, STEP_MS);
		return () => clearInterval(timer);
	}, [isPlaying, dates.join(",")]);

	// Leaving View mode stops the story.
	useEffect(() => {
		if (!inView) {
			setStoryPlaying(false);
			setStoryAt(null);
		}
	}, [inView]);

	if (!inView || dates.length < 2) {
		return null;
	}
	return (
		<section className={styles.bar} aria-label="Story">
			<IconButton
				icon={isPlaying ? "pause" : "play"}
				label={isPlaying ? "Pause the story" : "Play the story through its dates"}
				onClick={() => {
					if (!isPlaying && (at === null || at === dates.at(-1))) {
						setStoryAt(dates[0]);
					}
					setStoryPlaying(!isPlaying);
				}}
			/>

			<div className={styles.slider}>
				<SliderField
					label={at === null ? "Now" : formatWhen(at)}
					value={index}
					min={0}
					max={dates.length - 1}
					step={1}
					onChange={(value) => {
						setStoryPlaying(false);
						setStoryAt(dates[Math.round(value)] ?? null);
					}}
					hasNoDefault
					hidesBox
					hint={`${formatWhen(dates[0])} to ${formatWhen(dates.at(-1) ?? dates[0])}`}
				/>
			</div>

			<Button
				size="sm"
				disabled={at === null}
				onClick={() => {
					setStoryPlaying(false);
					setStoryAt(null);
				}}
			>
				Now
			</Button>
		</section>
	);
};
