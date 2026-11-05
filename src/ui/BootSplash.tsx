import { APP_NAME } from "#/lib/app";

/**
 * What the editor's address shows before its code has loaded: the server can't draw the editor
 * (WebGL and storage only), so without this the page would be blank for the seconds the code
 * takes. The app replaces it once it starts. Its styles are in styles.css, which the page links
 * before any code runs; it says so when scripts are off.
 */
export const BootSplash = () => (
	<div className="boot-splash">
		<svg className="boot-splash-mark" viewBox="0 0 32 32" aria-hidden="true">
			<defs>
				<clipPath id="boot-splash-diamond">
					<rect x="6" y="6" width="20" height="20" rx="6" transform="rotate(45 16 16)" />
				</clipPath>
			</defs>

			<g clipPath="url(#boot-splash-diamond)">
				<rect width="32" height="32" fill="#3d4fd6" />

				<rect width="32" height="16" fill="#d9643a" />
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
