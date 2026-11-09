#!/bin/bash
# Run one AI-loop job through the real Build with AI dialog: run-job.sh <absolute path to job.json>
# Needs the harness copied to e2e/ai-loop.spec.ts and a dev server (it uses :3000 if one answers).
# On a bare WSL machine without Chromium's libraries, set CHROMIUM_LIBS to a folder holding
# libnspr4, libnss3 and libasound2t64 (see SKILL.md, "Setup").
set -euo pipefail
JOB="$1"
case "$JOB" in /*) ;; *) echo "give the job's absolute path" >&2; exit 1 ;; esac
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
LD_LIBRARY_PATH="${CHROMIUM_LIBS:-}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" AI_JOB="$JOB" \
	timeout 400 pnpm e2e e2e/ai-loop.spec.ts --project=chromium --reporter=line 2>&1 | grep -vE "^\s*$" | tail -25
