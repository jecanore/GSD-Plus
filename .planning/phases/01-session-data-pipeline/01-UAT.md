---
status: diagnosed
phase: 01-session-data-pipeline
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-02-13T08:00:00Z
updated: 2026-02-13T08:12:00Z
---

## Current Test

[testing complete]

## Tests

### 1. scan-sessions human-readable table
expected: Running `node get-shit-done/bin/gsd-tools.js scan-sessions` displays a table of your Claude Code projects with columns for Project name, Sessions count, Size, and Last Active date. Projects are sorted most-recently-used first.
result: pass

### 2. scan-sessions JSON output
expected: Running `node get-shit-done/bin/gsd-tools.js scan-sessions --json` outputs valid JSON with an array of project objects, each containing name, sessionCount, totalSize, lastActive, and dateRange fields.
result: pass

### 3. scan-sessions verbose mode
expected: Running `node get-shit-done/bin/gsd-tools.js scan-sessions --verbose` lists individual sessions per project with Session ID, Size, and Modified date.
result: pass

### 4. scan-sessions missing directory error
expected: Running `node get-shit-done/bin/gsd-tools.js scan-sessions --path /tmp/nonexistent-gsd-test` shows a friendly error message like "No Claude Code sessions found" instead of a crash or stack trace.
result: issue
reported: "Error message says ~/.claude/projects when --path /tmp/nonexistent-gsd-test was passed. Should reference the actual path used, and 'Is Claude Code installed?' doesn't make sense for custom paths."
severity: minor
fix: "56585ef - show actual path in error when --path flag used"

### 5. extract-messages basic extraction
expected: Running `node get-shit-done/bin/gsd-tools.js extract-messages <project>` (using a project name from scan-sessions) displays a progress indicator on stderr, then outputs JSON with an output_file path, sessions_processed count, and messages_extracted count. The output_file exists and contains JSONL.
result: pass

### 6. extract-messages content filtering
expected: Reading the extracted JSONL output file shows only genuine user messages — plain text content, no XML system tags (no `<local-command`, `<command-`, `<task-notification`), no assistant responses, no meta records. Each line is valid JSON with sessionId, projectPath, timestamp, and content fields.
result: pass

### 7. extract-messages fuzzy matching
expected: Running `node get-shit-done/bin/gsd-tools.js extract-messages nonexistent-project-xyz` shows an error listing available projects. Running with a partial project name (case-insensitive substring) matches the correct project.
result: pass

### 8. All tests pass
expected: Running `node --test get-shit-done/bin/gsd-tools.test.js` completes with all 89 tests passing and exit code 0.
result: pass

## Summary

total: 8
passed: 7
issues: 1 (fixed)
pending: 0
skipped: 0

## Gaps

- truth: "Error message references the actual path passed via --path flag"
  status: fixed
  reason: "User reported: Error message says ~/.claude/projects when --path /tmp/nonexistent-gsd-test was passed. Should reference the actual path used, and 'Is Claude Code installed?' doesn't make sense for custom paths."
  severity: minor
  test: 4
  root_cause: "Hardcoded error message in cmdScanSessions and cmdExtractMessages always showed ~/.claude/projects regardless of --path override"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.js"
      issue: "Hardcoded path string in error() call"
  missing:
    - "Use overridePath in error message when provided"
  fix_commit: "56585ef"
