import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Render lab: LAB_WEBGPU=1 runs the whole app on three's WebGPU build.
const webgpu = Boolean(process.env.LAB_WEBGPU);

const config = defineConfig({
	define: { __LAB_WEBGPU__: JSON.stringify(webgpu) },
	resolve: {
		tsconfigPaths: true,
		alias: webgpu
			? [
					{
						find: /^three$/,
						replacement: new URL("./src/lab/three-hybrid.js", import.meta.url).pathname,
					},
				]
			: [],
	},
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),

		tanstackStart(),
		viteReact(),
	],
});

export default config;
