import { useEffect, useState } from "react";

import { notify } from "#/editor/toasts";

import { Button, ButtonGroup, IconButton, IconButtonGroup } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { ChoiceCards } from "./ChoiceCards";
import { CollapsibleSection } from "./CollapsibleSection";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import {
	CheckboxGroupField,
	ColorField,
	ComboboxField,
	FieldGroup,
	GroupLabel,
	Hint,
	type ITimePeriod,
	Kbd,
	NumberField,
	PeriodsField,
	RadioGroupField,
	Section,
	SelectField,
	SliderField,
	SplitField,
	SwitchField,
	TextField,
	VectorField,
} from "./fields";
import { List, ListItem } from "./List";
import { Menu } from "./Menu";
import { PaneHeader } from "./PaneHeader";
import { RailTabPanel, RailTabs } from "./RailTabs";
import { SettingsDialog } from "./SettingsDialog";
import { TabPanel, Tabs } from "./Tabs";
import { Toaster } from "./Toaster";
import { TooltipProvider } from "./Tooltip";

import styles from "./KitPage.module.css";

/**
 * Every shared component on one page, in both themes (ADR-0025). Dev only:
 * open /kit while `pnpm dev` runs to check a change to the kit at a glance.
 */
export const KitPage = () => {
	const [dark, setDark] = useState(false);
	const [text, setText] = useState("Brightwater");
	const [number, setNumber] = useState(12.5);
	const [slider, setSlider] = useState(2.4);
	const [ticked, setTicked] = useState(true);
	const [startFrom, setStartFrom] = useState("blank");
	const [size, setSize] = useState("blocks");
	const [sectionOpen, setSectionOpen] = useState(true);
	const [periods, setPeriods] = useState<ITimePeriod[]>([
		{ from: 5, until: 8 },
		{ from: 19, until: 24 },
	]);
	const [split, setSplit] = useState<number[]>([60, 30, 10]);
	const [vector, setVector] = useState([4, -2, 1]);
	const [choice, setChoice] = useState<"pillars" | "embankment">("pillars");
	const [chip, setChip] = useState("all");
	const [comboValue, setComboValue] = useState("birch");
	const [on, setOn] = useState(true);
	const [rowName, setRowName] = useState("Harbour depot");
	const [renaming, setRenaming] = useState(false);
	const [rowHidden, setRowHidden] = useState(false);
	const [order, setOrder] = useState(["Overview", "Harbour", "Stadium"]);
	const [keys, setKeys] = useState(["population"]);
	const [color, setColor] = useState("#4a64e0");
	const [tab, setTab] = useState<"one" | "two">("one");
	const [railTab, setRailTab] = useState<"world" | "sky" | "object">("world");
	const [selected, setSelected] = useState("ring");
	const [confirming, setConfirming] = useState(false);
	const [browsing, setBrowsing] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);

	useEffect(() => {
		document.documentElement.dataset.theme = dark ? "dark" : "light";
	}, [dark]);

	return (
		<TooltipProvider>
			<Toaster>
				<main className={styles.page}>
					<header className={styles.header}>
						<h1>UI kit</h1>

						<SwitchField label="Dark theme" checked={dark} onChange={setDark} />
					</header>

					<div className={styles.columns}>
						<div className={styles.panel}>
							<Section
								title="Section with actions"
								actions={
									<IconButtonGroup>
										<IconButton icon="lock" label="Lock" pressed onClick={() => {}} />

										<IconButton icon="copy" label="Duplicate (Ctrl+D)" onClick={() => {}} />

										<IconButton icon="trash" label="Delete (Del)" onClick={() => {}} />
									</IconButtonGroup>
								}
							>
								<TextField
									label="Text"
									value={text}
									onChange={setText}
									hint="A hint under a field."
								/>

								<NumberField label="Number (drag the label)" value={number} onChange={setNumber} />

								<SliderField
									label="Slider"
									value={slider}
									onChange={setSlider}
									min={0.4}
									max={8}
									step={0.1}
									inherit={{
										from: "road",
										inherited: slider === 2.4,
										onReset: () => setSlider(2.4),
										value: "2.4",
									}}
								/>

								<VectorField
									label="Vector"
									axes={["X", "Y", "Z"]}
									values={vector}
									onChange={(i, v) => setVector((old) => old.map((x, j) => (j === i ? v : x)))}
								/>

								<SliderField
									label="Slider, mixed"
									value={slider}
									onChange={setSlider}
									min={0.4}
									max={8}
									step={0.1}
									mixed
									inherit={{
										from: "road",
										inherited: slider === 2.4,
										onReset: () => setSlider(2.4),
										value: "2.4",
									}}
								/>

								<SliderField
									label="Slider, disabled"
									value={slider}
									onChange={setSlider}
									min={0.4}
									max={8}
									step={0.1}
									disabled
									hint="Says why it can't be changed, and where to go instead."
								/>

								<SelectField
									label="Select"
									value={choice}
									options={[
										{ value: "pillars", label: "Pillars (roads can pass under)" },
										{ value: "embankment", label: "Embankment (sloped bank)" },
									]}
									onChange={setChoice}
								/>

								<SwitchField label="Switch" checked={on} onChange={setOn} />

								<SwitchField
									label="Switch with a default"
									checked={on}
									onChange={setOn}
									inherit={{
										from: "default",
										inherited: !on,
										onReset: () => setOn(false),
										value: "off",
									}}
									hint="A switch can have a hint too."
								/>

								<CheckboxGroupField
									label="Checkbox group"
									options={[
										{ value: "population", label: "Population" },
										{ value: "air", label: "Air quality" },
									]}
									value={keys}
									onChange={setKeys}
								/>

								<ColorField
									label="Colour"
									value={color}
									onChange={setColor}
									inherit={{
										from: "default",
										inherited: color === "#4a64e0",
										onReset: () => setColor("#4a64e0"),
									}}
								/>
							</Section>
						</div>

						<div className={styles.panel}>
							<PaneHeader
								icon="list"
								title="Pane header"
								actions={<IconButton icon="chart" label="A filter" pressed onClick={() => {}} />}
							/>

							<div className={styles.railDemo}>
								<RailTabs
									label="Rail tabs"
									value={railTab}
									onChange={setRailTab}
									groups={[
										[
											{ value: "world", label: "World", icon: "globe" },
											{ value: "sky", label: "Time & light", icon: "sun" },
										],
										[{ value: "object", label: "Object", icon: "cube" }],
									]}
								>
									<RailTabPanel value={railTab}>
										<Section id="kit.foldable" icon="palette" title="Foldable panel">
											<ColorField label="Colour" value={color} onChange={setColor} />

											<SwitchField label="A switch" checked={on} onChange={setOn} />

											<SwitchField
												label="A switch with a default"
												checked={on}
												onChange={setOn}
												inherit={{
													from: "default",
													inherited: !on,
													onReset: () => setOn(false),
													value: "off",
												}}
											/>
										</Section>

										<Section id="kit.folded" icon="info" title="Folded at first" defaultClosed>
											<Hint>Folding is remembered in this browser.</Hint>
										</Section>

										<Section icon="bulb" title="Field groups">
											<FieldGroup title="Brightness">
												<SliderField
													label="Level"
													value={slider}
													min={0}
													max={5}
													step={0.1}
													onChange={setSlider}
												/>

												<SwitchField label="Inside a group" checked={on} onChange={setOn} />
											</FieldGroup>

											<PeriodsField
												label="On between"
												periods={periods}
												onChange={setPeriods}
												hint="Like a timer; a period may run past midnight."
											/>

											<SplitField
												label="Split between"
												parts={[
													{ id: "windows", label: "Windows", color: "#ffd88a" },
													{ id: "screens", label: "Screens", color: "#9fd3ff" },
													{ id: "signs", label: "Signs", color: "#ff9a8a" },
												]}
												weights={split}
												onChange={setSplit}
												hint="One bar shared out: drag a divider, or use the arrow keys on it."
											/>
										</Section>
									</RailTabPanel>
								</RailTabs>
							</div>

							<div className={styles.clusterDemo}>
								<IconButtonGroup cluster="History">
									<IconButton icon="undo" label="Undo" size="md" onClick={() => {}} />

									<IconButton icon="redo" label="Redo" size="md" onClick={() => {}} />
								</IconButtonGroup>
							</div>
						</div>

						<div className={styles.panel}>
							<Tabs
								value={tab}
								onChange={setTab}
								tabs={[
									{ value: "one", label: "Buttons" },
									{ value: "two", label: "Lists" },
								]}
							>
								<TabPanel value="one">
									<Section title="Buttons">
										<ButtonGroup>
											<Button variant="primary">Primary</Button>

											<Button>Secondary</Button>

											<Button variant="ghost">Ghost</Button>

											<Button variant="text" icon="clock">
												Text
											</Button>

											<Button variant="danger">Danger</Button>

											<Button disabled>Disabled</Button>
										</ButtonGroup>

										<ButtonGroup>
											<Button size="sm" icon="cut">
												Small with icon
											</Button>

											<Button size="sm" icon="plus">
												Add
											</Button>

											<Button size="sm" icon="check" showsSuccess>
												Just worked
											</Button>
										</ButtonGroup>

										<ButtonGroup vertical>
											<GroupLabel>Group label</GroupLabel>

											<Button size="sm" icon="join" block meta="3.2 away">
												Block button with meta
											</Button>

											<Button size="sm" icon="reset" variant="danger" block centered>
												Centered block button
											</Button>
										</ButtonGroup>

										<ButtonGroup>
											<Button onClick={() => notify("Saved", "Your world was saved to a file.")}>
												Toast
											</Button>

											<Button
												onClick={() =>
													notify("That file isn’t a valid world", "version: Expected 1", "error")
												}
											>
												Error toast
											</Button>

											<Button onClick={() => setConfirming(true)}>Dialog</Button>

											<Button onClick={() => setBrowsing(true)}>Panel dialog</Button>

											<Button onClick={() => setSettingsOpen(true)}>Settings dialog</Button>

											<Menu.Root>
												<Menu.Trigger>Menu</Menu.Trigger>

												<Menu.Popup>
													<Menu.Note>A note: a short paragraph that isn’t an item.</Menu.Note>

													<Menu.Item
														icon="file"
														label="Item"
														shortcut="Ctrl+N"
														onClick={() => {}}
													/>

													<Menu.Item
														label="With description"
														description="Muted second line"
														onClick={() => {}}
													/>

													<Menu.Group label="Group heading">
														<Menu.Item label="Item in a group" onClick={() => {}} />
													</Menu.Group>

													<Menu.CheckboxItem
														icon="grid"
														label="Checkbox item"
														checked={ticked}
														onCheckedChange={setTicked}
													/>
												</Menu.Popup>
											</Menu.Root>
										</ButtonGroup>

										<Hint>
											Keys: <Kbd>Enter</Kbd> <Kbd>Esc</Kbd> <Kbd>Ctrl</Kbd>
										</Hint>
									</Section>
								</TabPanel>

								<TabPanel value="two">
									<Section title="Choice cards">
										<ChoiceCards
											label="Start from"
											value={startFrom}
											onChange={setStartFrom}
											cards={[
												{
													value: "blank",
													title: "Blank",
													description: "No picture yet: a placeholder",
												},
												{
													value: "starter",
													title: "Starter",
													description:
														"A longer description is cut off after two lines like this one",
												},
											]}
										/>
									</Section>

									<Section title="Chips">
										<ChipGroup
											label="Category"
											value={chip}
											onChange={setChip}
											chips={[
												{ value: "all", label: "All", count: 19 },
												{ value: "buildings", label: "Buildings", icon: "building", count: 5 },
												{ value: "nature", label: "Nature", icon: "tree", count: 2 },
											]}
										/>

										<ComboboxField
											label="Combobox (with a search)"
											value={comboValue}
											onChange={setComboValue}
											groups={[
												{
													label: "Trees",
													options: [
														{ value: "oak", label: "Oak" },
														{ value: "birch", label: "Birch" },
														{ value: "pine", label: "Pine" },
													],
												},
												{
													label: "Bushes",
													options: [
														{ value: "box", label: "Box hedge" },
														{ value: "rose", label: "Rose bush" },
													],
												},
											]}
										/>

										<ChipGroup
											label="Category, small"
											size="sm"
											value={chip}
											onChange={setChip}
											chips={[
												{ value: "all", label: "All" },
												{ value: "buildings", label: "Buildings", icon: "building" },
												{ value: "nature", label: "Nature", icon: "tree" },
											]}
										/>
									</Section>

									<Section title="Collapsible section">
										<CollapsibleSection
											label="Buildings"
											count={2}
											open={sectionOpen}
											onOpenChange={setSectionOpen}
										>
											<Hint>Folded away with its heading.</Hint>
										</CollapsibleSection>
									</Section>

									<Section title="Radio group">
										<RadioGroupField
											label="Ground"
											value={size}
											options={[
												{ value: "corner", label: "Corner", meta: "24 × 18 · a street corner" },
												{ value: "blocks", label: "Blocks", meta: "40 × 30 · a few blocks" },
												{ value: "town", label: "Town" },
											]}
											onChange={setSize}
											hint="Each option can carry a muted note."
										/>
									</Section>

									<Section title="Reorderable list">
										<List>
											{order.map((name, index) => (
												<ListItem
													key={name}
													label={name}
													onClick={() => {}}
													reorder={{
														index,
														count: order.length,
														onMove: (to) => {
															const next = order.filter((item) => item !== name);
															next.splice(to, 0, name);
															setOrder(next);
														},
													}}
												/>
											))}
										</List>
									</Section>

									<Section title="Lists">
										<List>
											<ListItem
												label="Ring road"
												meta="Road"
												swatch="#c9c4b8"
												current={selected === "ring"}
												onClick={() => setSelected("ring")}
											/>

											<ListItem
												label="Ferry route"
												meta="Hidden route"
												swatch="repeating-linear-gradient(90deg, var(--accent) 0 4px, transparent 4px 7px)"
												current={selected === "ferry"}
												onClick={() => setSelected("ferry")}
											/>

											<ListItem
												label={rowName || "Warehouse"}
												meta="2,340"
												swatch="linear-gradient(135deg, #3d4fd6 55%, #f7f7f4 55%)"
												muted={rowHidden}
												current={selected === "depot"}
												onClick={() => setSelected("depot")}
												rename={{
													value: rowName,
													placeholder: "Warehouse",
													editing: renaming,
													onEditingChange: setRenaming,
													onCommit: setRowName,
												}}
												actions={
													<IconButton
														icon={rowHidden ? "eyeOff" : "eye"}
														label={rowHidden ? "Show" : "Hide"}
														pressed={rowHidden}
														onClick={() => setRowHidden(!rowHidden)}
													/>
												}
											/>

											<ListItem
												stacked
												label="Backup: Brightwater"
												meta="22 Oct 2026, 11:42"
												actions={
													<IconButton icon="download" label="Download backup" onClick={() => {}} />
												}
											/>
										</List>
									</Section>
								</TabPanel>
							</Tabs>
						</div>
					</div>

					<SettingsDialog
						open={settingsOpen}
						onOpenChange={setSettingsOpen}
						title="Settings"
						note="A note under the pages."
						pages={[
							{
								id: "general",
								label: "General",
								icon: "globe",
								groups: [
									{
										title: "A group",
										rows: [
											{
												id: "switch",
												field: <SwitchField label="A switch" checked={on} onChange={setOn} />,
											},
											{
												id: "slider",
												keywords: "number",
												field: (
													<SliderField
														label="A slider"
														value={slider}
														min={0}
														max={5}
														step={0.1}
														onChange={setSlider}
														hint="Rows can have hints."
													/>
												),
											},
										],
										note: "A note under a group.",
									},
								],
							},
							{
								id: "other",
								label: "Another page",
								icon: "eye",
								groups: [
									{
										title: "Search finds every page",
										rows: [
											{
												id: "colour",
												field: <ColorField label="Colour" value={color} onChange={setColor} />,
											},
										],
									},
								],
							},
						]}
					/>

					<Dialog
						open={browsing}
						onOpenChange={setBrowsing}
						title="All worlds"
						description="A long list scrolls inside the dialog."
					>
						<List>
							{Array.from({ length: 30 }, (_, i) => (
								<ListItem
									// biome-ignore lint/suspicious/noArrayIndexKey: a fixed demo list
									key={i}
									label={`World ${i + 1}`}
									meta="Edited today"
									stacked
									onClick={() => notify(`Opened world ${i + 1}`)}
								/>
							))}
						</List>
					</Dialog>

					<ConfirmDialog
						open={confirming}
						onOpenChange={setConfirming}
						title="Replace “Brightwater”?"
						description="It will be replaced by an empty world, and undo can’t bring it back."
						confirmLabel="Replace"
						onConfirm={() => notify("Replaced")}
						extraAction={{ label: "Save to file", onClick: () => notify("Saved") }}
					/>
				</main>
			</Toaster>
		</TooltipProvider>
	);
};
