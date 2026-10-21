#!/usr/bin/env node
/**
 * Enforces a blank line between sibling JSX children (elements, fragments and
 * {expressions}) that sit on separate lines. Text runs are left alone, so inline
 * content like `<Icon /> Add` is unaffected. Biome has no rule for this, so it
 * runs as part of `pnpm check` / `pnpm check:fix`. See ADR-0014.
 *
 *   node scripts/jsx-spacing.mjs          report violations (exit 1 if any)
 *   node scripts/jsx-spacing.mjs --fix    insert the missing blank lines
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const fix = process.argv.includes("--fix");

/** Children that count as "blocks"; plain text runs are left alone. */
const BLOCK_KINDS = new Set([
	ts.SyntaxKind.JsxElement,
	ts.SyntaxKind.JsxSelfClosingElement,
	ts.SyntaxKind.JsxFragment,
	ts.SyntaxKind.JsxExpression,
]);

const listFiles = (dir) => {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			return listFiles(path);
		}

		return path.endsWith(".tsx") ? [path] : [];
	});
};

/** Returns insertion offsets (positions right after a child) that need a blank line. */
const findViolations = (source) => {
	const offsets = [];
	const lineOf = (pos) => source.getLineAndCharacterOfPosition(pos).line;

	const visit = (node) => {
		if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
			const children = node.children.filter(
				(child) => !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces),
			);
			for (let i = 0; i < children.length - 1; i++) {
				const a = children[i];
				const b = children[i + 1];
				if (!BLOCK_KINDS.has(a.kind) || !BLOCK_KINDS.has(b.kind)) {
					continue;
				}

				const gap = lineOf(b.getStart(source)) - lineOf(a.getEnd());
				if (gap === 1) {
					offsets.push(a.getEnd());
				}
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(source);
	return offsets;
};

let total = 0;
for (const file of listFiles(SRC)) {
	const text = readFileSync(file, "utf8");
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const offsets = findViolations(source);
	if (offsets.length === 0) {
		continue;
	}

	total += offsets.length;
	if (fix) {
		let next = text;
		for (const offset of [...offsets].sort((x, y) => y - x)) {
			next = `${next.slice(0, offset)}\n${next.slice(offset)}`;
		}
		writeFileSync(file, next);
	} else {
		for (const offset of offsets) {
			const { line } = source.getLineAndCharacterOfPosition(offset);
			console.error(`${relative(ROOT, file)}:${line + 1}  add a blank line after this JSX block`);
		}
	}
}

if (fix) {
	console.log(`jsx-spacing: inserted ${total} blank line(s)`);
} else if (total > 0) {
	console.error(`jsx-spacing: ${total} problem(s). Run \`pnpm check:fix\`.`);
	process.exit(1);
} else {
	console.log("jsx-spacing: ok");
}
