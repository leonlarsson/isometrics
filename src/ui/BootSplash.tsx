import { APP_NAME } from "#/lib/app";

/**
 * What the editor's address shows before its code has loaded: the server can't draw the editor
 * (WebGL and storage only), so without this the page would be blank for the seconds the code
 * takes. The app replaces it once it starts. Its styles are in styles.css, which the page links
 * before any code runs; it says so when scripts are off.
 */
export const BootSplash = () => (
	<div className="boot-splash">
		{/*
		 * The rounded diamond, orange over blue, drawn as shapes rather than clipped to it: a clip
		 * found by its id now and then didn't apply while the page loaded (the server's splash and
		 * the app's for a moment, with one id), and the mark showed as a plain square.
		 */}
		<svg className="boot-splash-mark" viewBox="0 0 32 32" aria-hidden="true">
			<g transform="rotate(45 16 16)">
				<rect x="6" y="6" width="20" height="20" rx="6" fill="#3d4fd6" />

				{/* Its top half: the side of the diagonal through its left and right corners. */}
				<path
					d="M7.757 24.243A6 6 0 0 1 6 20V12A6 6 0 0 1 12 6H20A6 6 0 0 1 24.243 7.757Z"
					fill="#d9643a"
				/>
			</g>
		</svg>

		<p className="boot-splash-name">{APP_NAME}</p>

		<p className="boot-splash-note boot-splash-loading">Loading…</p>

		<noscript>
			{/* With scripts off nothing is loading: say why instead. */}
			<style>{".boot-splash-loading { display: none; }"}</style>

			<p className="boot-splash-note">
				{APP_NAME} draws 3D worlds in your browser: it needs JavaScript turned on.
			</p>
		</noscript>
	</div>
);
