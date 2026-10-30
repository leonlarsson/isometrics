import { useEffect, useState } from "react";

import { downloadPicture } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { drawingLimits, renderStill, smoothingFor, viewPixelSize } from "#/render/StillRender";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Hint, SelectField, SwitchField } from "./fields";
import { viewpointName } from "./ViewpointsSection";

import styles from "./RenderDialog.module.css";

/** Picture sizes to pick from; "view" is the view's own, in device pixels. */
const SIZES = [
	{ value: "view", label: "The view's size" },
	{ value: "1920x1080", label: "Full HD, 1920 × 1080" },
	{ value: "2560x1440", label: "QHD, 2560 × 1440" },
	{ value: "3840x2160", label: "4K, 3840 × 2160" },
	{ value: "7680x4320", label: "8K, 7680 × 4320" },
	{ value: "2048x2048", label: "Square, 2048 × 2048" },
	{ value: "1080x1920", label: "Portrait, 1080 × 1920" },
] as const;
type TSizeChoice = (typeof SIZES)[number]["value"];

const SMOOTHING = [
	{ value: "1", label: "Off" },
	{ value: "2", label: "2 × (smooth)" },
	{ value: "3", label: "3 ×" },
	{ value: "4", label: "4 × (smoothest)" },
] as const;
type TSmoothingChoice = (typeof SMOOTHING)[number]["value"];

const sizeOf = (choice: TSizeChoice) => {
	if (choice === "view") {
		return viewPixelSize();
	}
	const [width, height] = choice.split("x").map(Number);
	return { width, height };
};

/** Whether this graphics card can draw a picture this size at all (each side within its limit). */
const fitsCard = ({ width, height }: { width: number; height: number }) => {
	const { maxSide } = drawingLimits();
	return width <= maxSide && height <= maxSide;
};

/** Two frames, for an instant jump to a viewpoint to be drawn. */
const nextFrames = () =>
	new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);

/**
 * Render a picture… (ADR-0084): one still of the view or a viewpoint (the
 * world's cameras), drawn with the render's graphics (Ultra and beyond) and
 * smoothed, to save as a PNG.
 */
export const RenderDialog = () => {
	const open = useEditor((s) => s.renderDialogOpen);
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const title = useEditor((s) => s.scene.meta.title);
	const hasCards = useEditor((s) => s.scene.entities.some((e) => e.label.isShown && !e.isHidden));
	const playing = useEditor((s) => s.playing);
	const [chosenCamera, setCamera] = useState("view");
	// A viewpoint deleted since it was picked: back to the view now.
	const camera = viewpoints.some((v) => v.id === chosenCamera) ? chosenCamera : "view";
	const [showsCards, setShowsCards] = useState<boolean | null>(null);
	const [size, setSize] = useState<TSizeChoice>("1920x1080");
	const [smoothing, setSmoothing] = useState<TSmoothingChoice>("2");
	const [transparent, setTransparent] = useState(false);
	const [rendering, setRendering] = useState(false);
	const [picture, setPicture] = useState<{
		blob: Blob;
		url: string;
		width: number;
		height: number;
	} | null>(null);

	// A new picture, or closing, lets go of the last one's.
	useEffect(
		() => () => {
			if (picture) {
				URL.revokeObjectURL(picture.url);
			}
		},
		[picture],
	);
	useEffect(() => {
		if (!open) {
			setPicture(null);
		}
	}, [open]);

	// Opening it pauses motion, so the moment can be picked; closing it plays again if it was.
	useEffect(() => {
		if (!open || !useEditor.getState().playing) {
			return;
		}
		useEditor.getState().togglePlaying();
		return () => {
			if (!useEditor.getState().playing) {
				useEditor.getState().togglePlaying();
			}
		};
	}, [open]);

	// Picking a viewpoint glides the view there, so what will be rendered shows.
	const pickCamera = (next: string) => {
		setCamera(next);
		if (next !== "view") {
			useEditor.getState().goToViewpoint(next);
		}
	};

	const { width, height } = open ? sizeOf(size) : { width: 1, height: 1 };
	const smoothed = smoothingFor(width, height, Number(smoothing));

	const render = async () => {
		setRendering(true);
		try {
			if (camera !== "view") {
				useEditor.getState().goToViewpoint(camera, { instant: true });
				await nextFrames();
			}
			const blob = await renderStill({
				width,
				height,
				smoothing: Number(smoothing),
				transparent,
				showsCards: showsCards ?? hasCards,
			});
			setPicture({ blob, url: URL.createObjectURL(blob), width, height });
		} catch (error) {
			notify("The picture didn't render", (error as Error).message, "error");
		} finally {
			setRendering(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !rendering && useEditor.getState().setRenderDialogOpen(next)}
			title="Render a picture"
			description="A still of the world, drawn finer than any live view can, to save as a PNG."
			closeLabel="Close"
			wide
			confirm={{
				label: rendering ? "Rendering…" : picture ? "Render again" : "Render",
				onConfirm: render,
				disabled: rendering,
				keepOpen: true,
			}}
		>
			<div className={styles.layout}>
				<div className={styles.settings}>
					<SelectField<string>
						label="Camera"
						value={camera}
						options={[
							{ value: "view", label: "The view now" },
							...viewpoints.map((viewpoint, index) => ({
								value: viewpoint.id,
								label: viewpointName(viewpoint, index),
							})),
						]}
						onChange={pickCamera}
						hint="A viewpoint is one of the world's cameras: the picture is taken from it, with its mood if it has one and you let viewpoints put theirs on."
					/>

					<SelectField<TSizeChoice>
						label="Size"
						value={size}
						// Sizes this card can't draw at all are greyed out, saying why.
						options={SIZES.map((choice) => {
							const fits = choice.value === "view" || fitsCard(sizeOf(choice.value));
							return {
								value: choice.value,
								label: fits ? choice.label : `${choice.label} (too big for this graphics card)`,
								disabled: !fits,
							};
						})}
						onChange={setSize}
						hint={size === "view" ? `${width} × ${height}` : undefined}
					/>

					<SelectField<TSmoothingChoice>
						label="Smoothing"
						value={smoothing}
						options={SMOOTHING.map((choice) => ({ value: choice.value, label: choice.label }))}
						onChange={setSmoothing}
						hint={
							smoothed < 1.05 && Number(smoothing) > 1
								? "No smoothing at this size: it's as big as the browser draws in one go (about 33 million pixels). A smaller size can be smoothed."
								: smoothed < Number(smoothing)
									? `Smoothed ${smoothed.toFixed(1)} × at this size, as far as the browser draws in one go.`
									: "Drawn at that many times its size and shrunk, for clean edges."
						}
					/>

					<SwitchField
						label="Transparent background"
						checked={transparent}
						onChange={setTransparent}
						inherit={{
							from: "default",
							inherited: !transparent,
							onReset: () => setTransparent(false),
							value: "off",
						}}
						hint="Leaves the backdrop out, for putting the world over something else."
					/>

					<SwitchField
						label="Show the data cards"
						checked={showsCards ?? hasCards}
						onChange={setShowsCards}
						inherit={{
							from: "default",
							inherited: showsCards === null,
							onReset: () => setShowsCards(null),
							value: hasCards ? "on, the world has cards" : "off, the world has no cards",
						}}
						hint="The cards with their values and leader lines, as they sit in the view."
					/>

					<Button
						icon={playing ? "pause" : "play"}
						onClick={() => useEditor.getState().togglePlaying()}
					>
						{playing ? "Pause motion" : "Play motion"}
					</Button>

					<Hint>
						Drawn with every graphics setting at its best (ambient occlusion, real night lights,
						glow, reflections, boat waves, soft and extra-sharp shadows, the colour grade), whatever
						yours are, without the editor's handles. Motion pauses while this is open, so the moment
						stays put.
					</Hint>
				</div>

				<div className={styles.preview}>
					{picture ? (
						<figure className={styles.result}>
							<img
								className={styles.picture}
								src={picture.url}
								alt={`The rendered picture, ${picture.width} × ${picture.height}`}
							/>

							<Button
								icon="download"
								onClick={() => downloadPicture(title, picture.blob, picture.width, picture.height)}
							>
								Save the picture
							</Button>
						</figure>
					) : (
						<Hint>{rendering ? "Rendering…" : "The picture shows here once it's rendered."}</Hint>
					)}
				</div>
			</div>
		</Dialog>
	);
};
