import { newId, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import type { TScenePath, TThemePreference } from "#/scene/schema";
import { TEMPLATES } from "#/templates";

import { ColorField, Section, Select, SliderField, TextInput, Toggle } from "./fields";
import { Icon } from "./Icon";

import styles from "./Fields.module.css";

const RouteEditor = ({ path }: { path: TScenePath }) => {
	const commit = useEditor((s) => s.commit);
	const update = (field: string, recipe: (p: TScenePath) => void) =>
		commit(
			(scene) => {
				const target = scene.paths.find((p) => p.id === path.id);
				if (target) {
					recipe(target);
				}
			},
			{ coalesce: `path:${path.id}:${field}` },
		);
	const remove = () =>
		commit((scene) => {
			scene.paths = scene.paths.filter((p) => p.id !== path.id);
			for (const entity of scene.entities) {
				if (entity.follow?.pathId === path.id) {
					entity.follow = null;
				}
			}
		});

	return (
		<div className={styles.route}>
			<div className={styles.routeHeader}>
				<input
					className={styles.input}
					aria-label="Route name"
					value={path.name}
					placeholder="Route name"
					onChange={(e) =>
						update("name", (p) => {
							p.name = e.target.value;
						})
					}
				/>

				<button type="button" className={styles.iconButton} title="Delete route" onClick={remove}>
					<Icon name="trash" size={15} />
				</button>
			</div>

			<div className={styles.toggleRow}>
				<Toggle
					label="Loop"
					checked={path.closed}
					onChange={(v) =>
						update("closed", (p) => {
							p.closed = v;
						})
					}
				/>

				<Toggle
					label="Show line"
					checked={path.visible}
					onChange={(v) =>
						update("visible", (p) => {
							p.visible = v;
						})
					}
				/>
			</div>

			<ol className={styles.points}>
				{path.points.map(([x, z], i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: points are positional
					<li key={i} className={styles.point}>
						<span className={styles.axisName}>{i + 1}</span>

						{[x, z].map((value, axis) => (
							<input
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed x/z pair
								key={axis}
								className={styles.number}
								type="number"
								step={0.5}
								aria-label={`Point ${i + 1} ${axis === 0 ? "X" : "Z"}`}
								value={value}
								onChange={(e) => {
									const n = Number.parseFloat(e.target.value);
									if (Number.isNaN(n)) {
										return;
									}
									update("points", (p) => {
										p.points[i][axis] = n;
									});
								}}
							/>
						))}

						<button
							type="button"
							className={styles.iconButton}
							title="Remove point"
							disabled={path.points.length <= 2}
							onClick={() =>
								update("points-remove", (p) => {
									p.points.splice(i, 1);
								})
							}
						>
							<Icon name="close" size={14} />
						</button>
					</li>
				))}
			</ol>

			<button
				type="button"
				className={styles.smallButton}
				onClick={() =>
					update("points-add", (p) => {
						const last = p.points[p.points.length - 1];
						p.points.push([last[0] + 2, last[1]]);
					})
				}
			>
				<Icon name="plus" size={14} /> Add point
			</button>
		</div>
	);
};

export const ScenePanel = () => {
	const scene = useEditor((s) => s.scene);
	const commit = useEditor((s) => s.commit);
	const loadScene = useEditor((s) => s.loadScene);
	const resetView = useEditor((s) => s.resetView);
	const palette = usePalette();

	const addRoute = () =>
		commit((s) => {
			s.paths.push({
				id: newId("route"),
				name: `Route ${s.paths.length + 1}`,
				closed: true,
				visible: true,
				color: null,
				points: [
					[-4, -4],
					[4, -4],
					[4, 4],
					[-4, 4],
				],
			});
		});

	return (
		<>
			<Section title="Dashboard">
				<TextInput
					label="Title"
					value={scene.meta.title}
					onChange={(v) =>
						commit(
							(s) => {
								s.meta.title = v;
							},
							{ coalesce: "meta.title" },
						)
					}
				/>

				<TextInput
					label="Subtitle"
					value={scene.meta.subtitle}
					onChange={(v) =>
						commit(
							(s) => {
								s.meta.subtitle = v;
							},
							{ coalesce: "meta.subtitle" },
						)
					}
				/>

				<Select<TThemePreference>
					label="Theme"
					value={scene.theme}
					options={[
						{ value: "system", label: "Match device" },
						{ value: "light", label: "Light" },
						{ value: "dark", label: "Dark" },
					]}
					onChange={(v) =>
						commit((s) => {
							s.theme = v;
						})
					}
				/>
			</Section>

			<Section title="Ground">
				<SliderField
					label="Width"
					value={scene.ground.width}
					min={8}
					max={120}
					step={1}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.width = v;
							},
							{ coalesce: "ground.width" },
						)
					}
				/>

				<SliderField
					label="Depth"
					value={scene.ground.depth}
					min={8}
					max={120}
					step={1}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.depth = v;
							},
							{ coalesce: "ground.depth" },
						)
					}
				/>

				<ColorField
					label="Colour"
					value={scene.ground.color ?? palette.ground}
					isDefault={scene.ground.color === null}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.color = v;
							},
							{ coalesce: "ground.color" },
						)
					}
					onReset={() =>
						commit((s) => {
							s.ground.color = null;
						})
					}
				/>

				<button type="button" className={styles.smallButton} onClick={resetView}>
					<Icon name="focus" size={14} /> Re-centre camera
				</button>
			</Section>

			<Section
				title="Routes"
				actions={
					<button type="button" className={styles.smallButton} onClick={addRoute}>
						<Icon name="plus" size={14} /> Add
					</button>
				}
			>
				<p className={styles.hint}>
					Vehicles can drive along routes. Pick a route in a vehicle’s Motion section.
				</p>

				{scene.paths.map((path) => (
					<RouteEditor key={path.id} path={path} />
				))}
			</Section>

			<Section title="Start over">
				{TEMPLATES.map((template) => (
					<button
						key={template.id}
						type="button"
						className={styles.templateButton}
						onClick={() => {
							if (window.confirm(`Replace the current dashboard with “${template.name}”?`)) {
								loadScene(template.create());
								resetView();
							}
						}}
					>
						<strong>{template.name}</strong>

						<span>{template.description}</span>
					</button>
				))}
			</Section>
		</>
	);
};
