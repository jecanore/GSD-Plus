# Phase 1: Session Data Pipeline - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Memory-safe extraction of user messages from Claude Code session history into a structured data stream. Covers session discovery (`scan-sessions`) and message extraction (`extract-messages`). Profiling, analysis, and profile generation are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Session Discovery
- Output shows detailed info per project: project name, session count, total size, date range, last active
- When sessions-index.json is missing, notify the user ("Index not found, scanning directory...") and proceed with directory scan fallback
- Table format for humans by default, `--json` flag for machine-readable output
- Summary view by default, `--verbose` flag to list individual sessions per project
- Auto-detect `~/.claude/projects/` directory, `--path` flag to override
- Friendly error when Claude Code isn't installed or no sessions directory exists: "No Claude Code sessions found at ~/.claude/projects. Is Claude Code installed?"
- No health checking of session files — just report counts and sizes

### Extraction Output
- Default to whole-project extraction, `--session` flag to target a single session
- `--limit N` flag to cap number of sessions processed (useful for testing or quick scans)

### Memory Safety
- Show progress indicator during processing: "Processing session 3/12..."
- Corrupted or unreadable files: skip and warn, continue with the rest
- No memory usage stats in output — 512MB cap is an internal constraint, not user-facing

### CLI Invocation
- Subcommand pattern matching existing gsd-tools.js: `gsd-tools.js scan-sessions`, `gsd-tools.js extract-messages`
- Human-friendly error messages in plain English
- Standard exit codes: 0=success, 1=error, 2=partial success (some files skipped)
- No dry-run mode — these are read-only operations, no risk of data loss

### User Consent & Friendliness
- Two-layer consent: pipeline shows transparency note at runtime AND profile command (Phase 3) handles formal consent
- Reassuring tone at pipeline level: "Reading your session history (read-only, nothing is modified or sent anywhere)..."
- Extracted data written to temp file during processing, auto-cleaned after profiler consumes it — respects sensitivity of conversation data

### Claude's Discretion
- Filtering/sorting of projects in scan-sessions output (sensible defaults)
- Extraction output format (JSONL vs JSON array — choose based on memory-safety requirements)
- Fields included per extracted message (choose based on what profiling engine needs downstream)
- Output destination (stdout vs file — choose based on downstream consumption patterns)

</decisions>

<specifics>
## Specific Ideas

- User wants the tool to feel approachable to beginners — no assumed CLI knowledge
- Match existing gsd-tools.js patterns for consistency (subcommands, not flags)
- "Read-only, nothing is modified or sent anywhere" messaging is important for trust
- Temp file for extracted data (not persistent) reflects that session content is more sensitive than planning artifacts

</specifics>

<deferred>
## Deferred Ideas

- Formal consent gate with opt-in/opt-out — Phase 3 (Profile Activation)
- Questionnaire fallback when user opts out of session analysis — Phase 2 (Profiling Engine)

</deferred>

---

*Phase: 01-session-data-pipeline*
*Context gathered: 2026-02-12*
