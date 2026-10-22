/** Minimal stroke icon set (24×24 viewBox). Add paths here as needed. */
const PATHS = {
	undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
	grid: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",
	play: "M7 4v16l13-8z",
	pause: "M7 4h3v16H7zM14 4h3v16h-3z",
	focus: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 12h6M12 9v6",
	sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
	moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
	system: "M3 4h18v12H3zM8 20h8M12 16v4",
	download: "M12 3v12M7 10l5 5 5-5M4 21h16",
	upload: "M12 21V9M7 14l5-5 5 5M4 3h16",
	trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
	copy: "M8 8h12v12H8zM4 16V4h12",
	lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
	unlock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2",
	rotateLeft: "M4 4v6h6M4.5 10A8 8 0 1 1 6 16",
	rotateRight: "M20 4v6h-6M19.5 10A8 8 0 1 0 18 16",
	plus: "M12 5v14M5 12h14",
	close: "M6 6l12 12M18 6 6 18",
	edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
	eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
	reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
	cut: "M6 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.5 8.5 20 20M8.5 15.5 20 4",
	join: "M4 12h6M14 12h6M10 9l3 3-3 3M14 9l-3 3 3 3",
	chevronDown: "m6 9 6 6 6-6",
	chevronUp: "m6 15 6-6 6 6",
	chevronRight: "m9 6 6 6-6 6",
	file: "M6 3h8l4 4v14H6zM14 3v4h4",
	folder: "M3 6h6l2 2h10v11H3z",
	layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5",
	check: "m5 12.5 4.5 4.5L19 7",
	scrub: "M8 8l-4 4 4 4M16 8l4 4-4 4M4 12h16",
	search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
	grip: "M9 5.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 5.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM9 11.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 11.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM9 17.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 17.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2z",
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
