import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),

		tanstackStart(),
		viteReact(),
		// React Compiler: components and hooks memoised for us, so what didn't change isn't drawn again.
		babel({ presets: [reactCompilerPreset()] }),
	],
});

export default config;
