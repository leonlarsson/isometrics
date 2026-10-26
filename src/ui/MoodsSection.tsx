import { useState } from "react";

import { useEditor } from "#/editor/store";
import { wearsMood } from "#/scene/moods";
import type { TMood } from "#/scene/schema";
import { formatHour } from "#/scene/sun";

import { Button, IconButton, IconButtonGroup } from "./Button";
import { Hint, Section } from "./fields";
import { List, ListItem } from "./List";

/** A mood's name, or its place in the list when it has none. */
export const moodName = (mood: { name: string }, index: number) => mood.name || `Mood ${index + 1}`;

/** What a mood's time of day is, in a few words, e.g. "18:18" or "18:18, cycling" (a day cycle from there). */
export const moodTime = (mood: TMood) => {
	const { time, timeSource } = mood.lighting;
	if (timeSource === "clock") {
		return "The viewer's time";
	}
	if (timeSource === "data") {
		return "Time from data";
	}
	if (time === null) {
		return "Classic daylight";
	}
	return timeSource === "cycle" ? `${formatHour(time)}, cycling` : formatHour(time);
};

/**
 * The Moods tab (ADR-0078, ADR-0079): named looks of the world (its time of day,
 * light, sky, water and tilt-shift). Click one to put it on; save the look as
 * it is now as a new mood or over one; a viewpoint can put one on too.
 */
export const MoodsSection = () => {
	const scene = useEditor((s) => s.scene);
	const { moods } = scene;
	const [renaming, setRenaming] = useState<string | null>(null);
	const store = () => useEditor.getState();

	return (
		<Section
			id="sky.moods"
			icon="palette"
			title="Moods"
			keywords="moods looks presets golden hour night atmosphere snapshot"
		>
			{moods.length === 0 ? (
				<Hint>
					Save the world’s look as a mood, like Golden hour or Night: its time of day, sun, sky,
					water and tilt-shift, put back on with one click. A viewpoint can put one on when you go
					to it.
				</Hint>
			) : (
				<List>
					{moods.map((mood, index) => {
						const name = moodName(mood, index);
						return (
							<ListItem
								key={mood.id}
								label={name}
								meta={moodTime(mood)}
								current={wearsMood(scene, mood)}
								onClick={() => store().putOnMood(mood.id)}
								rename={{
									value: mood.name,
									placeholder: `Mood ${index + 1}`,
									editing: renaming === mood.id,
									onEditingChange: (editing) => setRenaming(editing ? mood.id : null),
									onCommit: (text) => store().renameMood(mood.id, text),
								}}
								actions={
									<IconButtonGroup>
										<IconButton
											icon="check"
											label={`Save the current look as “${name}”`}
											onClick={() => store().resaveMood(mood.id)}
										/>

										<IconButton
											icon="trash"
											label={`Delete “${name}”`}
											onClick={() => store().removeMood(mood.id)}
										/>
									</IconButtonGroup>
								}
							/>
						);
					})}
				</List>
			)}

			<Button
				size="sm"
				icon="plus"
				onClick={() => {
					const id = store().saveMood();
					setRenaming(id);
				}}
			>
				Save the current look
			</Button>
		</Section>
	);
};
