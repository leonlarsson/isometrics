/** Minimal stroke icon set (24×24 viewBox). Add paths here as needed. */
const PATHS = {
	undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
	grid: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",
	play: "M7 4v16l13-8z",
	pause: "M7 4h3v16H7zM14 4h3v16h-3z",
	focus: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 12h6M12 9v6",
	video: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5",
	user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
	sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
	moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
	system: "M3 4h18v12H3zM8 20h8M12 16v4",
	download: "M12 3v12M7 10l5 5 5-5M4 21h16",
	upload: "M12 21V9M7 14l5-5 5 5M4 3h16",
	trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
	copy: "M8 8h12v12H8zM4 16V4h12",
	paste: "M9 3h6v3H9zM8 4.5H5V21h14V4.5h-3",
	cloud: "M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z",
	// A framed picture with hills and a sun: Render a picture… (ADR-0084).
	picture: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01",
	// The shading switcher's orbs (ADR-0080): wireframe, then Standard, Nice and Ultra, more lit each.
	shadeWire:
		"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c-3.5 3-3.5 15 0 18M12 3c3.5 3 3.5 15 0 18",
	shadeStandard: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
	shadeNice: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM16.5 6.5a7.5 7.5 0 0 1 0 11",
	shadeUltra:
		"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM16.5 6.5a7.5 7.5 0 0 1 0 11M14 15a7.5 7.5 0 0 0 2.5-4M8.5 8.5h.01",
	lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
	unlock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2",
	rotateLeft: "M4 4v6h6M4.5 10A8 8 0 1 1 6 16",
	rotateRight: "M20 4v6h-6M19.5 10A8 8 0 1 0 18 16",
	plus: "M12 5v14M5 12h14",
	close: "M6 6l12 12M18 6 6 18",
	edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
	eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
	eyeOff:
		"M2 12s4-7 10-7c1.9 0 3.6.7 5 1.6M22 12s-4 7-10 7c-1.9 0-3.6-.7-5-1.6M9.9 14.1A3 3 0 0 1 14.1 9.9M4 20 20 4",
	reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
	cut: "M6 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.5 8.5 20 20M8.5 15.5 20 4",
	join: "M4 12h6M14 12h6M10 9l3 3-3 3M14 9l-3 3 3 3",
	chevronDown: "m6 9 6 6 6-6",
	chevronUp: "m6 15 6-6 6 6",
	chevronRight: "m9 6 6 6-6 6",
	chevronLeft: "m15 6-6 6 6 6",
	camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
	file: "M6 3h8l4 4v14H6zM14 3v4h4",
	folder: "M3 6h6l2 2h10v11H3z",
	layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5",
	perspective: "M3 7l6-3h6l6 3v10l-6 3H9l-6-3zM9 4v16M15 4v16M3 7l6 2h6l6-2",
	check: "m5 12.5 4.5 4.5L19 7",
	boxSelect:
		"M3 3h2M8 3h3M14 3h3M3 3v2M3 8v3M3 14v3M3 20h2M8 20h2M20 3v2M20 8v2M12 12l9 3.5-4 1.5-1.5 4z",
	star: "M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z",
	more: "M5 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM19 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
	scrub: "M8 8l-4 4 4 4M16 8l4 4-4 4M4 12h16",
	search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
	grip: "M9 5.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 5.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM9 11.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 11.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM9 17.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 17.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2z",
	globe:
		"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9",
	cube: "M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
	palette:
		"M12 3a9 9 0 0 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 0 1 1.3-2.9H17a4 4 0 0 0 4-4c0-4.5-4-8.2-9-8.2zM7.5 10.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM10.5 6.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM15.5 7.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
	tag: "M3 3h8.5l9.5 9.5-8.5 8.5L3 11.5zM7.5 6.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
	route:
		"M6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15",
	spline:
		"M5 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM19 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM5 16c0-6 4-7 7-7.5s7-1.5 7-1",
	car: "M5 16H3v-4l2-5h14l2 5v4h-2M9 16h6M3 12h18M7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
	chart: "M3 20h18M6 16v-5M11 16V5M16 16V9M20 16v-3",
	road: "M8 3 4.5 21M16 3l3.5 18M12 4v3M12 10.5v3M12 17v3",
	area: "M5 8.5 12 4l8 5-2.5 10.5h-11z",
	building: "M4 21V5l8-3v19M12 9h8v12M2 21h20M7.5 7.5h1M7.5 11.5h1M7.5 15.5h1M15.5 13h1M15.5 17h1",
	tree: "M12 2 6 11h3l-4 6h14l-4-6h3zM12 17v5",
	cone: "M10 3h4l4.5 15h-13zM4 21h16M8.6 9h6.8M7.4 13.5h9.2",
	pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
	plusSquare: "M4 4h16v16H4zM12 8v8M8 12h8",
	sidebars: "M3 4h18v16H3zM8.5 4v16M15.5 4v16",
	alert: "M12 3.5 2.5 20h19zM12 10v4.5M12 17.5v.5",
	list: "M9 6h11M9 12h11M9 18h11M4.5 5.5h.5v1h-.5zM4.5 11.5h.5v1h-.5zM4.5 17.5h.5v1h-.5z",
	clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
	bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
	move: "M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5",
	info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
	bridge: "M2 9h20M2 9v11M22 9v11M7 9v4M12 9v4M17 9v4M2 16c3-4 17-4 20 0",
	traffic:
		"M9.5 2h5A2.5 2.5 0 0 1 17 4.5v10a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 14.5v-10A2.5 2.5 0 0 1 9.5 2zM12 17v5M7 5H4l3 3M17 5h3l-3 3M7 11H4l3 3M17 11h3l-3 3M12 6.5h.01M12 12.5h.01",
} as const;

export type TIconName = keyof typeof PATHS;

export const Icon = ({ name, size = 18 }: { name: TIconName; size?: number }) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={PATHS[name]} />
		</svg>
	);
};
