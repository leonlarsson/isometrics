import { z } from "zod";

/**
 * The scene document is the single source of truth for a dashboard.
 * The renderer, editor, persistence and (future) AI generation all read and
 * write this shape. See docs/adr/0003-scene-as-json-document.md.
 *
 * Bump SCENE_VERSION on breaking changes and add a migration in ./migrate.ts.
 */
export const SCENE_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #3d4fd6");

/** [x, z] on the ground plane, in grid units. */
export const Vec2Schema = z.tuple([z.number(), z.number()]);
/** [x, y, z] in world units. */
export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const LabelSchema = z.object({
	enabled: z.boolean().default(true),
	title: z.string().default(""),
	/** Keys into `scene.data`. One key renders as a big number, several as rows. */
	dataKeys: z.array(z.string()).default([]),
	/** Card position relative to the entity's label anchor (top of the part). */
	offset: Vec3Schema.default([0, 2, 0]),
});

export const FollowSchema = z.object({
	pathId: z.string(),
	/** Grid units per second. */
	speed: z.number().min(0).max(50).default(2),
	/** Distance along the path where the entity starts. */
	offset: z.number().default(0),
});

export const DetailsSchema = z.object({
	description: z.string().default(""),
	/** Data shown as tiles when the entity is opened in view mode. */
	dataKeys: z.array(z.string()).default([]),
});

export const EntitySchema = z.object({
	id: z.string().min(1),
	/** Part kind from the part registry (src/parts/registry.ts). */
	kind: z.string().min(1),
	name: z.string().default(""),
	position: Vec2Schema.default([0, 0]),
	elevation: z.number().default(0),
	/** Degrees around the vertical axis. */
	rotation: z.number().default(0),
	scale: z.number().min(0.1).max(10).default(1),
	/** null = use the part's default colour for the active theme. */
	color: hexColor.nullable().default(null),
	accent: hexColor.nullable().default(null),
	/** Part-specific parameters, validated by the part's own schema. */
	props: z.record(z.string(), z.unknown()).default({}),
	label: LabelSchema.nullable().default(null),
	follow: FollowSchema.nullable().default(null),
	details: DetailsSchema.default({ description: "", dataKeys: [] }),
	locked: z.boolean().default(false),
});

export const DataEntrySchema = z.object({
	key: z.string().regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
	label: z.string().default(""),
	value: z.union([z.number(), z.string()]),
	unit: z.string().default(""),
});

export const PathSchema = z.object({
	id: z.string().min(1),
	name: z.string().default(""),
	points: z.array(Vec2Schema).min(2),
	closed: z.boolean().default(true),
	visible: z.boolean().default(false),
	color: hexColor.nullable().default(null),
});

export const GroundSchema = z.object({
	width: z.number().min(4).max(200).default(40),
	depth: z.number().min(4).max(200).default(30),
	color: hexColor.nullable().default(null),
});

export const ThemeSchema = z.enum(["system", "light", "dark"]);

export const SceneSchema = z
	.object({
		version: z.literal(SCENE_VERSION),
		meta: z
			.object({
				title: z.string().default("Untitled dashboard"),
				subtitle: z.string().default(""),
			})
			.default({ title: "Untitled dashboard", subtitle: "" }),
		theme: ThemeSchema.default("system"),
		ground: GroundSchema.default({ width: 40, depth: 30, color: null }),
		entities: z.array(EntitySchema).default([]),
		paths: z.array(PathSchema).default([]),
		data: z.array(DataEntrySchema).default([]),
	})
	.superRefine((scene, ctx) => {
		const checkUnique = (values: string[], path: (string | number)[], what: string) => {
			const seen = new Set<string>();
			values.forEach((value, index) => {
				if (seen.has(value)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate ${what} "${value}"`,
						path: [...path, index],
					});
				}
				seen.add(value);
			});
		};
		checkUnique(
			scene.entities.map((e) => e.id),
			["entities"],
			"entity id",
		);
		checkUnique(
			scene.paths.map((p) => p.id),
			["paths"],
			"path id",
		);
		checkUnique(
			scene.data.map((d) => d.key),
			["data"],
			"data key",
		);
	});

export type TScene = z.output<typeof SceneSchema>;
export type TSceneInput = z.input<typeof SceneSchema>;
export type TEntity = z.output<typeof EntitySchema>;
export type TEntityInput = z.input<typeof EntitySchema>;
export type TLabel = z.output<typeof LabelSchema>;
export type TFollow = z.output<typeof FollowSchema>;
export type TDataEntry = z.output<typeof DataEntrySchema>;
export type TScenePath = z.output<typeof PathSchema>;
export type TThemePreference = z.output<typeof ThemeSchema>;
export type TVec2 = z.output<typeof Vec2Schema>;
export type TVec3 = z.output<typeof Vec3Schema>;
