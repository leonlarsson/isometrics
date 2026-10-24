#!/usr/bin/env node
/**
 * Saves a template as an earlier version of the app made it, for the
 * old-world tests (src/scene/oldWorlds.test.ts, ADR-0056). Checks the commit
 * out into a temporary git worktree, runs that commit's own code to create the
 * template, and writes it, compact like a browser save, to
 * src/scene/fixtures/old-worlds/<template>-<commit>.json.
 *
 *   pnpm fixture:old-world <commit> <template id>
 *   pnpm fixture:old-world HEAD brightwater     the world as it is now, before changing the format
 *
 * Run it on the commit before a change to the world format, then make the change:
 * the tests check that the saved world still opens with nothing lost.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "src/scene/fixtures/old-worlds");
const [commit, template] = process.argv.slice(2);

if (!commit || !template) {
	console.error("Usage: pnpm fixture:old-world <commit> <template id>, e.g. HEAD brightwater");
	process.exit(1);
}

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const sha = git("rev-parse", "--short", `${commit}^{commit}`);
const target = join(OUT, `${template}-${sha}.json`);
if (existsSync(target)) {
	console.error(`${target} already exists; old worlds are never rewritten.`);
	process.exit(1);
}

const worktree = mkdtempSync(join(tmpdir(), "old-world-"));
rmSync(worktree, { recursive: true });
git("worktree", "add", "--detach", worktree, sha);
try {
	symlinkSync(join(ROOT, "node_modules"), join(worktree, "node_modules"));
	const generator = join(worktree, "src/zz-old-world-fixture.test.ts");
	writeFileSync(
		generator,
		`import { writeFileSync } from "node:fs";
import { it } from "vitest";

import { TEMPLATES } from "#/templates";

it("saves the template", () => {
	const template = TEMPLATES.find((t) => t.id === ${JSON.stringify(template)});
	if (!template) {
		throw new Error("No template " + ${JSON.stringify(template)} + " at this commit: " + TEMPLATES.map((t) => t.id).join(", "));
	}
	writeFileSync(${JSON.stringify(target)}, JSON.stringify(template.create()));
});
`,
	);
	execFileSync(
		join(worktree, "node_modules/.bin/vitest"),
		["run", "src/zz-old-world-fixture.test.ts"],
		{
			cwd: worktree,
			stdio: "inherit",
		},
	);
	console.log(`Saved ${target}`);
} finally {
	git("worktree", "remove", "--force", worktree);
}
