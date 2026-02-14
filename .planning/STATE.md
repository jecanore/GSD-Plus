# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Claude should know how a developer works so it doesn't start every conversation blind
**Current focus:** Phase 3 - Profile Activation

## Current Position

Phase: 3 of 9 (Profile Activation)
Plan: 1 of 3 in current phase
Status: Executing
Last activity: 2026-02-14 -- Completed 03-01 (command definition and orchestration workflow)

Progress: [████░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 4.5min
- Total execution time: 0.45 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 7min | 3.5min |
| 02 | 3 | 15min | 5min |
| 03 | 1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 01-02 (4min), 02-01 (5min), 02-02 (4min), 02-03 (6min), 03-01 (3min)
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
- profile-sample defaults to 150 messages (reduced from 300) for profiling efficiency
- Message truncation at 500 chars for profiling (reduced from 2000)
- Per-project session cap: max(5, floor(limit/projectCount)) for proportional sampling
- Recency threshold 30 days: recent sessions 10 msgs, older 3 msgs
- 11 sensitive content regex patterns for Layer 2 defense in depth filtering
- Evidence format: combined Signal+Example with ~100 char quotes and project attribution
- Confidence thresholds: HIGH 10+ signals across 2+ projects, MEDIUM 5-9, LOW <5, UNSCORED 0
- Context-dependent dimension splits reported rather than forced single rating
- Questionnaire confidence capped at MEDIUM/LOW (never HIGH) -- self-report vs observed behavior distinction
- CLAUDE_INSTRUCTIONS covers all 32 dimension/rating combinations with imperative directives
- Questionnaire dual-mode: interactive outputs questions JSON, answers mode produces analysis JSON
- Sequential artifact generation over parallel agents -- file I/O is fast, no user-visible benefit
- Consent gate skipped for --questionnaire path since no JSONL reading occurs
- Abbreviated consent for --refresh path -- brief reminder instead of full consent screen
- Split resolution keeps dominant rating with context_note for context-dependent choices

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 03-01-PLAN.md (command definition and orchestration workflow)
Resume file: None
