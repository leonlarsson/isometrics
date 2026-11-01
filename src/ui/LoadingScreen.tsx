import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { describeThings } from "#/editor/clipboard";
import { useEditor } from "#/editor/store";
import type { TWhatIsOpen } from "#/editor/whatIsOpen";

import styles from "./LoadingScreen.module.css";

/**
 * Its timing (ms; the fade and the finish keep in step with the CSS): shown at
 * least long enough for the blocks to stack up once, so a quick world doesn't
 * just flash it; then a finish (the stack settles, the bar fills, "Ready"), and
 * a fade into the world.
 */
const SHOWN_AT_LEAST_MS = 1000;
const FINISH_MS = 550;
const FADE_MS = 450;

/** Whether the viewer prefers less motion: then no stacking to wait for, no finish, just the fade. */
const prefersLessMotion = () =>
	typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type TPhase = "loading" | "finishing" | "leaving" | "gone";

/** The blocks that stack up while it loads, bottom first: a tiny building in the logo's colours. */
const BLOCKS = ["base", "middle", "roof"] as const;

/** A block's height in the drawing, and how much higher each sits than the one below. */
const BLOCK_HEIGHT = 26;

/**
 * One block of the stack: a cube at the isometric angle, its top and its two
 * sides you can see, standing `level` blocks up.
 */
const Block = ({ kind, level }: { kind: (typeof BLOCKS)[number]; level: number }) => {
	const y = 3 * BLOCK_HEIGHT - level * BLOCK_HEIGHT;
	return (
		<g className={styles.block} data-block={kind} style={{ "--level": level } as CSSProperties}>
			<polygon className={styles.top} points={`26,${y} 52,${y + 15} 26,${y + 30} 0,${y + 15}`} />

			<polygon
				className={styles.left}
				points={`0,${y + 15} 26,${y + 30} 26,${y + 30 + BLOCK_HEIGHT} 0,${y + 15 + BLOCK_HEIGHT}`}
			/>

			<polygon
				className={styles.right}
				points={`26,${y + 30} 52,${y + 15} 52,${y + 15 + BLOCK_HEIGHT} 26,${y + 30 + BLOCK_HEIGHT}`}
			/>
		</g>
	);
};

/** What the card says while a link opens (ADR-0121), from what's open; null for a world. */
const linkCard = (whatIsOpen: TWhatIsOpen) => {
	if (whatIsOpen.kind !== "link") {
		return null;
	}
	const { link, step } = whatIsOpen;
	if (step.kind === "asking") {
		return { meta: step.scene.meta, scene: step.scene, status: "Waiting for your answer…" };
	}
	return {
		meta: {
			title: link.from === "shared" ? "Opening a shared world" : "Opening a template",
			subtitle: "",
		},
		scene: null,
		status: step.isArriving
			? "A new link can take up to a minute to reach everywhere: still trying…"
			: "Fetching it from the link…",
	};
};

/**
 * Covers the view while a world opens (ADR-0100), and while a world from a
 * link is fetched or waits for an answer (ADR-0121): the world's name and
 * subtitle, blocks stacking up and what's being built, until the view has it
 * ready to look at (render/WorldReady); then it fades into the world. It never
 * takes the pointer, and leaves the page once faded.
 */
export const LoadingScreen = () => {
	const whatIsOpen = useEditor((s) => s.whatIsOpen);
	const opening = useEditor((s) => s.openingWorld !== null);
	const link = linkCard(whatIsOpen);
	const sceneMeta = useEditor((s) => s.scene.meta);
	const meta = link?.meta ?? sceneMeta;
	const counts = useEditor(
		useShallow((s) => {
			const scene =
				s.whatIsOpen.kind === "link"
					? s.whatIsOpen.step.kind === "asking"
						? s.whatIsOpen.step.scene
						: null
					: s.scene;
			return {
				entities: scene?.entities.length ?? 0,
				roads: scene?.roads.length ?? 0,
				areas: scene?.areas.length ?? 0,
				fences: scene?.fences.length ?? 0,
			};
		}),
	);
	// Nothing to build on the home screen; a world only until the view has it.
	const loading =
		whatIsOpen.kind === "starting" ||
		whatIsOpen.kind === "link" ||
		(whatIsOpen.kind === "world" && opening);
	const [phase, setPhase] = useState<TPhase>(loading ? "loading" : "gone");
	// When this loading began, for the least time it's shown.
	const since = useRef(performance.now());
	useEffect(() => {
		if (loading) {
			since.current = performance.now();
			setPhase("loading");
			return;
		}
		const timers: number[] = [];
		const after = (ms: number, next: TPhase) =>
			timers.push(window.setTimeout(() => setPhase(next), ms));
		if (prefersLessMotion()) {
			setPhase("leaving");
			after(FADE_MS, "gone");
		} else {
			const wait = Math.max(0, SHOWN_AT_LEAST_MS - (performance.now() - since.current));
			after(wait, "finishing");
			after(wait + FINISH_MS, "leaving");
			after(wait + FINISH_MS + FADE_MS, "gone");
		}
		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, [loading]);

	if (phase === "gone") {
		return null;
	}
	const ready = phase !== "loading";
	const things = describeThings(counts);

	return (
		<div
			className={styles.screen}
			data-phase={phase}
			data-loading-screen=""
			role="status"
			aria-live="polite"
		>
			<div className={styles.content}>
				<svg className={styles.stack} viewBox="0 0 52 134" aria-hidden="true">
					{BLOCKS.map((kind, level) => (
						<Block key={kind} kind={kind} level={level} />
					))}
				</svg>

				<p className={styles.title}>{meta.title || "Untitled world"}</p>

				{meta.subtitle && <p className={styles.subtitle}>{meta.subtitle}</p>}

				{/* Both lines take the same place, so the card keeps its width as one gives way to the other. */}
				<p className={styles.status}>
					<span data-shown={!ready || undefined} aria-hidden={ready || undefined}>
						{link
							? link.scene && things
								? `${things}: waiting for your answer…`
								: link.status
							: things
								? `Building ${things}…`
								: "Opening the world…"}
					</span>

					<span data-shown={ready || undefined} aria-hidden={!ready || undefined}>
						Ready
					</span>
				</p>

				<span className={styles.progress} aria-hidden="true" />
			</div>
		</div>
	);
};
