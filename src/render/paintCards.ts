/**
 * The data cards in a rendered picture (ADR-0084). The cards and their leader
 * lines are DOM over the canvas (ui/LabelLayer), so a picture of the canvas
 * leaves them out; this takes them as they're laid out for the picture
 * (LabelProjector places them for the canvas's size and camera every frame)
 * and paints them from their own computed styles: boxes with their colours,
 * borders, corners and shadows, text in its font, and the dashed leaders. Drawn
 * at the picture's scale, the text stays crisp at any size.
 */

interface IShadow {
	color: string;
	x: number;
	y: number;
	blur: number;
}

type TPaint =
	| {
			kind: "box";
			x: number;
			y: number;
			width: number;
			height: number;
			radius: number;
			fill: string | null;
			stroke: string | null;
			strokeWidth: number;
			shadows: IShadow[];
			opacity: number;
	  }
	| {
			kind: "text";
			x: number;
			y: number;
			height: number;
			text: string;
			font: string;
			color: string;
			letterSpacing: string;
			opacity: number;
	  }
	| {
			kind: "line";
			from: [number, number];
			to: [number, number];
			color: string;
			width: number;
			dash: number[];
			opacity: number;
	  };

/** Whether a computed colour paints anything. */
const paints = (color: string) =>
	color !== "" && color !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(color);

/** The element's opacity on screen: its own times its ancestors'. */
const opacityOf = (element: Element) => {
	let opacity = 1;
	for (let at: Element | null = element; at && at !== document.body; at = at.parentElement) {
		opacity *= Number(getComputedStyle(at).opacity);
	}
	return opacity;
};

/** Every shadow in a computed box-shadow ("rgba(…) 0px 4px 12px 0px, …"). */
const shadowsOf = (boxShadow: string): IShadow[] =>
	[...boxShadow.matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)].map(
		([, color, x, y, blur]) => ({ color, x: Number(x), y: Number(y), blur: Number(blur) }),
	);

/** A corner radius in pixels, from "8px" or "50%" of a box `height` tall. */
const radiusOf = (radius: string, height: number) => {
	const amount = Number.parseFloat(radius) || 0;
	return Math.min(radius.endsWith("%") ? (height * amount) / 100 : amount, height / 2);
};

/** Everything the cards and their leaders paint, in the canvas's CSS pixels, right now. */
export const takeCards = (canvas: HTMLCanvasElement): TPaint[] => {
	const layer = document.querySelector("[data-label-layer]");
	if (!layer) {
		return [];
	}
	const origin = canvas.getBoundingClientRect();
	const shown = (element: Element) => {
		const style = getComputedStyle(element);
		return style.display !== "none" && style.visibility !== "hidden";
	};
	const paintsOut: TPaint[] = [];

	// The leaders first, under the cards.
	for (const line of layer.querySelectorAll("line")) {
		const svg = line.ownerSVGElement;
		if (!svg || !shown(line)) {
			continue;
		}
		const style = getComputedStyle(line);
		const box = svg.getBoundingClientRect();
		const at = (name: string) => Number(line.getAttribute(name) ?? 0);
		paintsOut.push({
			kind: "line",
			from: [box.left - origin.left + at("x1"), box.top - origin.top + at("y1")],
			to: [box.left - origin.left + at("x2"), box.top - origin.top + at("y2")],
			color: style.stroke,
			width: Number.parseFloat(style.strokeWidth) || 1,
			dash:
				style.strokeDasharray === "none"
					? []
					: style.strokeDasharray.split(/[\s,]+/).map(Number.parseFloat),
			opacity: opacityOf(line) * (Number(style.strokeOpacity) || 1),
		});
	}

	const walk = (element: Element) => {
		if (!shown(element)) {
			return;
		}
		const style = getComputedStyle(element);
		const box = element.getBoundingClientRect();
		if (box.width === 0 || box.height === 0) {
			return;
		}
		const opacity = opacityOf(element);
		const borderWidth = Number.parseFloat(style.borderTopWidth) || 0;
		if (paints(style.backgroundColor) || (borderWidth > 0 && paints(style.borderTopColor))) {
			paintsOut.push({
				kind: "box",
				x: box.left - origin.left,
				y: box.top - origin.top,
				width: box.width,
				height: box.height,
				radius: radiusOf(style.borderTopLeftRadius, box.height),
				fill: paints(style.backgroundColor) ? style.backgroundColor : null,
				stroke: borderWidth > 0 && paints(style.borderTopColor) ? style.borderTopColor : null,
				strokeWidth: borderWidth,
				shadows: style.boxShadow === "none" ? [] : shadowsOf(style.boxShadow),
				opacity,
			});
		}
		for (const child of element.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				const text = child.textContent?.trim();
				if (!text) {
					continue;
				}
				const range = document.createRange();
				range.selectNodeContents(child);
				const place = range.getBoundingClientRect();
				paintsOut.push({
					kind: "text",
					x: place.left - origin.left,
					y: place.top - origin.top,
					height: place.height,
					text,
					// From its parts: the shorthand is empty when it can't say everything (tabular numbers).
					font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
					color: style.color,
					letterSpacing: style.letterSpacing === "normal" ? "0px" : style.letterSpacing,
					opacity,
				});
			} else if (child instanceof Element) {
				walk(child);
			}
		}
	};
	for (const anchor of layer.children) {
		if (!(anchor instanceof SVGElement)) {
			walk(anchor);
		}
	}
	return paintsOut;
};

/** Paints what takeCards took onto a picture `scale` times the canvas's CSS size. */
export const paintCards = (
	context: CanvasRenderingContext2D,
	paintsIn: TPaint[],
	scale: number,
) => {
	context.save();
	context.scale(scale, scale);
	for (const paint of paintsIn) {
		context.globalAlpha = paint.opacity;
		if (paint.kind === "line") {
			context.setLineDash(paint.dash);
			context.strokeStyle = paint.color;
			context.lineWidth = paint.width;
			context.beginPath();
			context.moveTo(...paint.from);
			context.lineTo(...paint.to);
			context.stroke();
			context.setLineDash([]);
		} else if (paint.kind === "box") {
			const outline = () => {
				context.beginPath();
				context.roundRect(paint.x, paint.y, paint.width, paint.height, paint.radius);
			};
			if (paint.fill) {
				for (const shadow of paint.shadows) {
					context.save();
					context.shadowColor = shadow.color;
					context.shadowOffsetX = shadow.x * scale;
					context.shadowOffsetY = shadow.y * scale;
					context.shadowBlur = shadow.blur * scale;
					outline();
					context.fillStyle = paint.fill;
					context.fill();
					context.restore();
				}
				outline();
				context.fillStyle = paint.fill;
				context.fill();
			}
			if (paint.stroke) {
				const inset = paint.strokeWidth / 2;
				context.beginPath();
				context.roundRect(
					paint.x + inset,
					paint.y + inset,
					paint.width - paint.strokeWidth,
					paint.height - paint.strokeWidth,
					Math.max(0, paint.radius - inset),
				);
				context.strokeStyle = paint.stroke;
				context.lineWidth = paint.strokeWidth;
				context.stroke();
			}
		} else {
			context.font = paint.font;
			context.fillStyle = paint.color;
			context.letterSpacing = paint.letterSpacing;
			context.textBaseline = "alphabetic";
			const metrics = context.measureText(paint.text);
			const ascent = metrics.fontBoundingBoxAscent;
			const descent = metrics.fontBoundingBoxDescent;
			context.fillText(
				paint.text,
				paint.x,
				paint.y + (paint.height - ascent - descent) / 2 + ascent,
			);
		}
	}
	context.restore();
};

export type TCardPaints = TPaint[];
