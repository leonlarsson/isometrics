import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (ADR-0069): the editor in headless Chromium, against the
 * dev server (the one already running on :3000, else one started here). The
 * full Chromium build in its new headless mode (`channel: "chromium"`), not
 * the headless shell, which crashes on Pointer Lock; SwiftShader draws WebGL.
 * E2E_BASE_URL points them at another dev server, e.g. a worktree's on :3002.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
	testDir: "e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	// Software WebGL is heavy: a few browsers at once.
	workers: process.env.CI ? 2 : 3,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL,
		viewport: { width: 1280, height: 800 },
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 800 },
				channel: "chromium",
				launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
			},
		},
	],
	webServer: {
		command: "pnpm dev",
		url: baseURL,
		reuseExistingServer: true,
		timeout: 120_000,
	},
});
