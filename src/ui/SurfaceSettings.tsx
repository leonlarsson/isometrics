import type { Draft } from "immer";

import { updateGround, usePickedGround } from "#/editor/groundEditing";
import { useEditor } from "#/editor/store";
import { AREA_KINDS, isWaterArea } from "#/scene/areas";
import { percent } from "#/scene/format";
import {
	GroundSchema,
	SCENE_VERSION,
	SceneSchema,
	type TArea,
	type TSurface,
	type TSurfaceKind,
} from "#/scene/schema";
import {
	areaSurfaceKind,
	SURFACE_KIND_IDS,
	SURFACE_KIND_LABELS,
	SURFACE_KINDS,
} from "#/scene/surfaces";

import { Button } from "./Button";
import { Hint, resetToDefault, SelectField, SliderField, SwitchField } from "./fields";

/**
 * Surfaces with texture (ADR-0137): the world's switch with the ground's
 * surface (World → Ground), and an area's own (its Look tab).
 */

const DEFAULTS = SceneSchema.parse({ version: SCENE_VERSION });
const GROUND_DEFAULTS = GroundSchema.parse({});

const KIND_OPTIONS = SURFACE_KIND_IDS.map((value) => ({
	value,
	label: SURFACE_KIND_LABELS[value],
}));

/** A pattern's size as the field shows it: "1.5×". */
const times = (scale: number) => `${scale}×`;

/** The world's switch, the picked ground's surface, and the patterns' strength and size for all. */
export const GroundSurfaceFields = () => {
	const surface = useEditor((s) => s.scene.surface);
	// The picked ground's (ADR-0155): each ground has its own texture.
	const kind = usePickedGround().surface.kind;
	const commit = useEditor((s) => s.commit);
	const set = <K extends keyof TSurface>(key: K, value: TSurface[K], coalesce = false) =>
		commit(
			(s) => {
				s.surface[key] = value;
			},
			coalesce ? { coalesce: `surface.${key}` } : undefined,
		);
	const setKind = (next: TSurfaceKind) =>
		updateGround((ground) => {
			ground.surface.kind = next;
		});
	const off = !surface.enabled;

	return (
		<>
			<SwitchField
				inherit={resetToDefault(surface.enabled, DEFAULTS.surface.enabled, () =>
					set("enabled", DEFAULTS.surface.enabled),
				)}
				label="Textured surfaces"
				checked={surface.enabled}
				onChange={(on) => set("enabled", on)}
				hint="Grass, sand, paving and more as fine patterns in each surface's own colour: the ground's below, and each area's by its kind unless it picks its own (its Look tab). Off, every surface is a flat colour."
			/>

			<SelectField<TSurfaceKind>
				inherit={resetToDefault(kind, GROUND_DEFAULTS.surface.kind, () =>
					setKind(GROUND_DEFAULTS.surface.kind),
				)}
				label="Texture"
				value={kind}
				options={KIND_OPTIONS}
				onChange={setKind}
				disabled={off}
				hint={off ? "Turn on Textured surfaces to draw it." : SURFACE_KINDS[kind].description}
			/>

			<SliderField
				inherit={resetToDefault(
					surface.patternStrength,
					DEFAULTS.surface.patternStrength,
					() => set("patternStrength", DEFAULTS.surface.patternStrength),
					percent(DEFAULTS.surface.patternStrength),
				)}
				label="Pattern strength"
				value={Math.round(surface.patternStrength * 100)}
				min={0}
				max={100}
				step={5}
				suffix="%"
				disabled={off}
				onChange={(v) => set("patternStrength", v / 100, true)}
				hint="For the ground and every area that doesn't set its own: 50% is as designed."
			/>

			<SliderField
				inherit={resetToDefault(
					surface.patternScale,
					DEFAULTS.surface.patternScale,
					() => set("patternScale", DEFAULTS.surface.patternScale),
					times(DEFAULTS.surface.patternScale),
				)}
				label="Pattern size"
				value={surface.patternScale}
				min={0.25}
				max={4}
				step={0.05}
				suffix="×"
				disabled={off}
				onChange={(v) => set("patternScale", v, true)}
				hint="Bigger stones, slabs and ripples, or smaller."
			/>
		</>
	);
};

/** An area's surface (its Look tab): its kind's or its own, and its own strength and size. */
export const AreaSurfaceFields = ({ area }: { area: TArea }) => {
	const world = useEditor((s) => s.scene.surface);
	const updateArea = useEditor((s) => s.updateArea);
	const commit = useEditor((s) => s.commit);
	if (isWaterArea(area)) {
		return null;
	}
	const edit = (field: string, recipe: (a: Draft<TArea>) => void, coalesce = false) =>
		updateArea(area.id, recipe, coalesce ? { coalesce: `${area.id}:surface.${field}` } : undefined);
	const kind = areaSurfaceKind(area);
	const ofKind = AREA_KINDS[area.kind].surface;
	const off = !world.enabled;
	const strength = area.surface.patternStrength ?? world.patternStrength;
	const scale = area.surface.patternScale ?? world.patternScale;

	return (
		<>
			<SelectField<TSurfaceKind>
				inherit={{
					from: "kind",
					inherited: area.surface.kind === null,
					onReset: () =>
						edit("kind", (a) => {
							a.surface.kind = null;
						}),
					value: SURFACE_KIND_LABELS[ofKind],
				}}
				label="Texture"
				value={kind}
				options={KIND_OPTIONS}
				onChange={(next) =>
					edit("kind", (a) => {
						a.surface.kind = next;
					})
				}
				disabled={off}
				hint={off ? undefined : SURFACE_KINDS[kind].description}
			/>

			<SliderField
				inherit={{
					from: "scene",
					inherited: area.surface.patternStrength === null,
					onReset: () =>
						edit("patternStrength", (a) => {
							a.surface.patternStrength = null;
						}),
					value: percent(world.patternStrength),
				}}
				label="Pattern strength"
				value={Math.round(strength * 100)}
				min={0}
				max={100}
				step={5}
				suffix="%"
				disabled={off || kind === "plain"}
				onChange={(v) =>
					edit(
						"patternStrength",
						(a) => {
							a.surface.patternStrength = v / 100;
						},
						true,
					)
				}
			/>

			<SliderField
				inherit={{
					from: "scene",
					inherited: area.surface.patternScale === null,
					onReset: () =>
						edit("patternScale", (a) => {
							a.surface.patternScale = null;
						}),
					value: times(world.patternScale),
				}}
				label="Pattern size"
				value={scale}
				min={0.25}
				max={4}
				step={0.05}
				suffix="×"
				disabled={off || kind === "plain"}
				onChange={(v) =>
					edit(
						"patternScale",
						(a) => {
							a.surface.patternScale = v;
						},
						true,
					)
				}
			/>

			{off && (
				<>
					<Hint>
						Textured surfaces are off in this world, so every surface is a flat colour. Turned on
						(World → Ground), this area takes its surface.
					</Hint>

					<Button
						size="sm"
						icon="layers"
						onClick={() =>
							commit((s) => {
								s.surface.enabled = true;
							})
						}
					>
						Turn on textured surfaces
					</Button>
				</>
			)}
		</>
	);
};
