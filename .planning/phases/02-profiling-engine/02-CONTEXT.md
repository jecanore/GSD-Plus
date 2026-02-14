# Phase 2: Profiling Engine - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the LLM-based analysis engine that converts extracted session messages (from Phase 1's extract-messages output) into a scored behavioral profile across 8 dimensions, plus a questionnaire fallback. The engine produces analysis output AND writes USER-PROFILE.md. Phase 3 orchestrates WHEN this runs (consent, scan, activation artifacts).

</domain>

<decisions>
## Implementation Decisions

### Profile output & tone
- USER-PROFILE.md is written FOR Claude's consumption, not the developer's reading pleasure — it's an instruction document
- Structure: summary instructions block at top (behavioral directives Claude acts on immediately) + per-dimension detail below (evidence and reasoning)
- Evidence displayed inline under each dimension (no collapsed `<details>` tags, no separate files) — Claude reads everything in one pass
- LOW confidence dimensions produce hedging behavior from Claude ("Based on your profile, I'll try X — let me know if that's off")
- HIGH confidence dimensions can be acted on directly without hedging
- Use /technical-writing skill and sequential-thinking MCP when crafting the profile template and reference doc

### Thin data & uncertainty
- Hybrid approach for thin data: analyze whatever sessions exist, score each dimension with confidence, then supplement with questionnaire for gaps
- Threshold: below 50 genuine user messages across all projects = hybrid mode (analyze + questionnaire supplement)
- Above 50 messages = full analysis only (questionnaire optional)
- Contradictory signals across projects: profiler reports the split in analysis output (e.g., "context-dependent: terse in CLI projects, detailed in frontend") — Phase 3 orchestrator resolves by presenting the split to user with well-defined options
- Recent sessions weighted ~3x over older sessions — people's styles evolve, recent behavior is more accurate

### Questionnaire experience
- Thoughtful style: scenarios with descriptions that help the developer identify their actual pattern, not just pick "sounds good"
- Each question includes context framing ("Think about the last few times you...") before presenting options
- Self-report confidence: MEDIUM for strong definitive picks, LOW for "it varies" or ambiguous selections
- Hybrid merge strategy: if analysis and questionnaire agree, confidence goes up; if they disagree, note the split
- Questionnaire can supplement session analysis (fill gaps on LOW/unscored dimensions) or run standalone

### Evidence curation
- Combined format: technical signal description + curated supporting quote per evidence entry
  - Format: **Signal:** [pattern interpretation] / **Example:** "[trimmed quote]" — project: [name]
- 3 evidence quotes per dimension (sweet spot: triangulation without bloat — 24 quotes total, ~5KB)
- Project attribution included on each quote (helps developer verify, shows cross-project patterns)
- Sensitive content handling: defense in depth
  - Layer 1: Profiler agent instructed to never select quotes containing secrets (sk-, Bearer, password, tokens, full file paths)
  - Layer 2: gsd-tools.js write-profile runs post-processing regex filter before writing USER-PROFILE.md
  - Profiler reports what sensitive content was found and excluded as metadata — doubles as a security audit perk
- Aim for zero sensitive content remaining in the written profile

### Claude's Discretion
- Whether to allow "Other" free-text on questionnaire (AskUserQuestion adds it automatically — decide if it maps cleanly to ratings)
- Exact recency weighting formula (guideline: ~3x for last 30 days)
- How to handle session context dumps ("This session is being continued...") and log pastes in sampling
- Exact sensitive content regex patterns for the post-processing filter
- Quote truncation length (guideline: trim to behavioral signal, ~100 chars)

</decisions>

<specifics>
## Specific Ideas

- Profile as a Claude instruction document — "This developer provides structured context. Match with structured responses." not "You tend to provide structured context."
- The sensitive content scanner as a feature perk: "We scanned your sessions and found 0 sensitive data leaks" — value-add beyond just profiling
- Questionnaire questions should use the thoughtful format with scenario framing, e.g.: "Think about the last few times you asked Claude to build or change something. How did you frame the request?" followed by rich option descriptions
- When profiler detects contradictions (e.g., terse in CLI projects, detailed in frontend), report the context-dependent split rather than forcing a single rating — Phase 3 resolves with user

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-profiling-engine*
*Context gathered: 2026-02-13*
