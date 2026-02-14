# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Claude should know how a developer works so it doesn't start every conversation blind
**Current focus:** Phase 2 - Profiling Engine

## Current Position

Phase: 2 of 9 (Profiling Engine)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-14 -- Completed 02-01 (profiling knowledge artifacts)

Progress: [███░░░░░░░] 17%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 4min
- Total execution time: 0.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 7min | 3.5min |
| 02 | 1 | 5min | 5min |

**Recent Trend:**
- Last 5 plans: 01-01 (3min), 01-02 (4min), 02-01 (5min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Profile stored at `~/.claude/get-shit-done/USER-PROFILE.md` (global across projects)
- `/dev-preferences` as `.md` command file at `~/.claude/commands/`
- 8 analysis dimensions covering patterns from 82-session manual analysis
- CLAUDE.md template with `{{placeholder}}` markers for auto-generation
- Phase brief assembly at plan-phase Step 7.5
- Sort scan-sessions projects by lastActive descending (most recently used first)
- Transparency note on stderr, not mixed with JSON output
- Index-missing notification suppressed in --json mode
- Fuzzy project matching: exact-first then case-insensitive substring
- Batch limit of 300 messages across all sessions (PIPE-05)
- Exit code 2 for partial success when some sessions skipped
- Session ID derived from filename (path.basename without .jsonl)
- Profile claude_instruction uses imperative directives, not descriptive statements
- Evidence format: combined Signal+Example with ~100 char quotes and project attribution
- Confidence thresholds: HIGH 10+ signals across 2+ projects, MEDIUM 5-9, LOW <5, UNSCORED 0
- Context-dependent dimension splits reported rather than forced single rating

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 02-01-PLAN.md (profiling knowledge artifacts -- reference doc, agent, model profiles)
Resume file: None
