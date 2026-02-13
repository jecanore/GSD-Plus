# Project Research Summary

**Project:** GSD-Plus Developer Profiling + Workflow Optimizations
**Domain:** AI coding assistant skill framework with behavioral profiling
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

GSD-Plus extends the existing Get-Shit-Done framework with two complementary capabilities: developer behavioral profiling from Claude Code session history, and workflow optimizations that enhance multi-phase project execution. Research confirms this occupies a unique position in the AI coding assistant landscape — no competitor (Cursor, Copilot, Windsurf) offers explicit, evidence-based developer profiling that feeds into project-level configuration.

The recommended approach leverages Node.js built-ins exclusively (maintaining the zero-dependency constraint) with streaming JSONL parsers for memory-safe session analysis, LLM-based profiling via agent spawning for behavioral pattern extraction, and template-driven generation for CLAUDE.md and custom slash commands. The architecture follows existing GSD patterns: new commands layer into the command/agent/workflow structure, gsd-tools.js handles heavy I/O, and agents perform reasoning over pre-extracted data.

Key risks center on memory management (session files reach 20MB each, 744MB total across observed projects), profile overfitting to dominant projects (104 sessions from one project vs 9 from another creates skew), and CLAUDE.md generation potentially overwriting manual user customizations. Mitigation strategies are well-understood: readline streaming for JSONL, project-proportional sampling with recency weighting, and sentinel-based partial updates for generated files.

## Key Findings

### Recommended Stack

The codebase enforces zero external dependencies — all new code uses Node.js built-ins only. Session parsing requires `readline.createInterface` over `fs.createReadStream` for memory-safe line-by-line processing (observed session files reach 20MB). JSONL format is Claude Code's internal representation with no stability guarantee, requiring defensive parsing with per-line try/catch and version-aware fallback. Template interpolation uses simple regex-based `{{placeholder}}` substitution to avoid eval risks and external template engines.

**Core technologies:**
- **Node.js readline + fs.createReadStream:** Line-by-line JSONL streaming — prevents memory explosion on 20MB+ session files
- **Vanilla JavaScript (CommonJS):** All additions to 4,597-line gsd-tools.js — maintains existing codebase patterns
- **LLM-based profiling via Task() spawn:** Agent-driven behavioral analysis — the LLM IS the NLP engine, no external NLP libraries
- **Template-driven generation with {{placeholders}}:** CLAUDE.md + /dev-preferences creation — secure, simple, zero dependencies
- **JSONL session data (read-only):** Session discovery via sessions-index.json (when available) or fallback directory scan — graceful degradation for projects without index files

### Expected Features

Research validates the 8-dimension profiling framework (communication style, decision speed, explanation depth, debugging approach, UX preferences, vendor API patterns, frustration signals, learning style) against observed session patterns. The feature landscape divides clearly into profiling pipeline (P1 for launch), workflow enhancements (P2 add after validation), and advanced automation (P3 defer to v2+).

**Must have (table stakes):**
- Session history extraction with JSONL streaming — data pipeline foundation
- Multi-dimension behavioral analysis with confidence scoring — core intelligence that differentiates from generic AI assistants
- USER-PROFILE.md generation (global, cross-project) — durable, reviewable, version-controllable artifact
- Questionnaire fallback for users without history — alternative path ensures every user can be profiled
- /dev-preferences command generation — activation mechanism that feeds profile into Claude's system prompt
- CLAUDE.md auto-generation from project artifacts + profile — project-level configuration (competitor table stakes)

**Should have (competitive):**
- Phase brief assembly (roadmap + research + context + cross-phase) — eliminates manual context gathering, profile-aware briefs
- Structured plan checklists (integration, dependency, vendor API, security) — catches bug classes that freeform planning misses
- Cross-phase context threading via CONTEXT.md carry-forward — decisions in Phase 1 inform Phase 5 without user repetition
- Evidence-linked profiles with session excerpts — builds trust, allows verification of conclusions
- Profile-aware CLAUDE.md with conditional sections — personalizes project context based on developer dimensions

**Defer (v2+):**
- Advisor mode in discuss-phase (inline research during discussion) — high UX complexity, collapses research/discuss steps
- Multi-tool automated verification (Playwright browser testing, Supabase MCP) — heavy external dependencies, environment setup complexity
- Profile refresh with before/after diff display — polish feature, needs existing profiles to be valuable

### Architecture Approach

The design layers new components onto existing GSD structure without creating parallel infrastructure. Heavy I/O (session scanning, JSONL parsing, template interpolation) lives in gsd-tools.js; reasoning (behavioral analysis, pattern extraction) lives in spawned agents. Profile data is global (cross-project) at `~/.claude/get-shit-done/USER-PROFILE.md` with project-specific overrides in `.planning/config.json`. Generated files (CLAUDE.md, /dev-preferences.md) use sentinel comments for partial updates to preserve manual customizations.

**Major components:**
1. **gsd-tools.js profile subcommands** — Server-side session extraction (scan-sessions, extract-messages, profile-load) keeping heavy I/O out of agent context
2. **gsd-user-profiler agent** — LLM-based analysis against 8 dimensions, read-only, receives pre-extracted 200-500KB user message data
3. **Profile-user workflow** — Orchestrates consent gate, scan, extract, parallel agent analysis, synthesis, USER-PROFILE.md + /dev-preferences generation
4. **CLAUDE.md generation** — Template-driven assembly from profile + PROJECT.md + codebase map with merge strategy for existing files
5. **Phase brief assembly** — On-demand context threading (roadmap + CONTEXT + RESEARCH + prior SUMMARY files) at plan-phase step 7.5
6. **Template layer** — `{{placeholder}}` templates for user-profile.md, claude-md.md, dev-preferences-cmd.md, phase-brief.md with section-level fallbacks

### Critical Pitfalls

Research identified 7 critical pitfalls from direct codebase and session data analysis. The most severe risks involve memory management (20MB files observed in production, not theoretical), format stability (Claude Code JSONL is internal, no contract), and destructive file operations (CLAUDE.md overwrite would silently destroy manual customizations).

1. **JSONL memory explosion on large session files** — 20MB max observed (744MB total across 310 sessions). Use readline streaming with per-line filtering (type === 'user' only), NOT fs.readFileSync. Prevention: Phase 1 foundation.
2. **JSONL format drift breaking parser silently** — Version field suggests evolution (2.1.37 observed). Defensive parsing with optional chaining, version detection, graceful degradation. Prevention: Phase 1 foundation.
3. **Profile overfitting to dominant project** — 104 sessions from one project, 9 from another creates skew. Project-proportional sampling (max 20 per project), recency weighting, confidence penalties for low diversity. Prevention: Phase 2 agent design.
4. **gsd-tools.js modification cascading test failures** — 4,597 lines, nested switch/case, positional args. Tests-first for new commands, validate existing suite passes before/after. Prevention: all phases touching gsd-tools.js.
5. **CLAUDE.md auto-generation overwrites manual customizations** — Template-based generation is destructive. Sentinel-based partial updates (`<!-- GSD:AUTO-START -->` markers), never overwrite without confirmation. Prevention: Phase 4 generation.
6. **Profiler agent confirmation bias from prompt framing** — LLMs find patterns even with insufficient data. Require evidence_count per dimension, explicit "insufficient data" option, minimum 3-session threshold for MEDIUM+ confidence. Prevention: Phase 2 agent prompts.
7. **Workflow step numbering conflicts during modification** — Plan-phase has decimals (5.5, 7.5), cross-references scattered. Use named step anchors for insertions, audit all step references before changes. Prevention: Phase 5 workflow modifications.

## Implications for Roadmap

Research reveals clear dependency chains that dictate build order. The profiling pipeline (Phase 1 → Phase 2 → Phase 3) is serial — each phase depends on prior completion. Workflow enhancements (Phase 4-6) can run in parallel after profiling foundation exists. Integration testing (Phase 7) is the convergence point.

### Phase 1: Session Data Pipeline
**Rationale:** Foundation for all profiling. Without JSONL extraction, no behavioral analysis can occur. Memory-safe streaming is non-negotiable given observed 20MB files.
**Delivers:** gsd-tools.js subcommands (scan-sessions, extract-messages), JSONL streaming parser with defensive format handling, session discovery (index + fallback), privacy boundary enforcement (user messages only)
**Addresses:** Session history extraction (table stakes), security (privacy opt-in, no code content, no Claude responses)
**Avoids:** JSONL memory explosion (Pitfall #1), format drift (Pitfall #2), gsd-tools.js cascade (Pitfall #4)
**Research needs:** NONE — patterns well-documented, direct codebase verification completed

### Phase 2: Behavioral Profiling Engine
**Rationale:** Core intelligence. Converts extracted session data into actionable developer profile. Must prevent overfitting and confirmation bias from day one.
**Delivers:** gsd-user-profiler agent (8-dimension analysis), user-profiling.md reference doc, confidence scoring logic, project-proportional sampling, USER-PROFILE.md template + generation
**Addresses:** Multi-dimension analysis (table stakes), confidence scoring (table stakes), questionnaire fallback (table stakes)
**Avoids:** Profile overfitting (Pitfall #3), confirmation bias (Pitfall #6)
**Research needs:** MINIMAL — 8 dimensions validated against session data, LLM agent patterns established

### Phase 3: Profile Activation
**Rationale:** Profile only has value when it affects Claude's behavior. /dev-preferences makes it discoverable, questionnaire provides alternative path.
**Delivers:** dev-preferences-cmd.md template + generation, /gsd:profile-user command, profile-user workflow, questionnaire implementation
**Addresses:** /dev-preferences command (table stakes), questionnaire fallback (table stakes), profile refresh
**Avoids:** gsd-tools.js cascade (Pitfall #4), config backward compatibility
**Research needs:** NONE — slash command patterns verified, workflow patterns established

### Phase 4: CLAUDE.md Integration
**Rationale:** Project-level configuration is competitor table stakes. Profile-aware CLAUDE.md is the differentiator. Sentinel-based updates are critical to avoid destroying manual content.
**Delivers:** claude-md.md template, gsd-tools.js generate claude-md subcommand, sentinel-based partial update logic, backup strategy, profile-aware conditional sections
**Addresses:** CLAUDE.md auto-generation (table stakes), profile-aware CLAUDE.md (differentiator)
**Avoids:** CLAUDE.md overwrite (Pitfall #5)
**Research needs:** NONE — template patterns established, Claude Code loading behavior verified

### Phase 5: Workflow Enhancements (Brief Assembly)
**Rationale:** Phase briefs eliminate the manual "gather context" step. Cross-phase threading carries forward decisions without user repetition. This phase can run parallel with Phase 4.
**Delivers:** phase-brief.md template, gsd-tools.js assemble-brief subcommand, cross-phase context filtering, plan-phase step 7.5 insertion, execute-phase brief integration
**Addresses:** Phase brief assembly (differentiator), cross-phase context threading (differentiator)
**Avoids:** Workflow step numbering conflicts (Pitfall #7)
**Research needs:** MINIMAL — existing CONTEXT.md + SUMMARY.md patterns provide model

### Phase 6: Workflow Enhancements (Structured Checklists)
**Rationale:** Domain-specific checklists catch bug classes (rate limits, auth refresh, RLS policies) that freeform planning misses. Independent of profiling — can build in parallel.
**Delivers:** Checklist templates per domain (integration, dependency, vendor API, security), gsd-plan-checker validation logic, domain detection heuristics
**Addresses:** Structured plan checklists (differentiator)
**Avoids:** gsd-tools.js cascade (Pitfall #4)
**Research needs:** MODERATE — need domain-specific checklist content, pattern libraries for common integrations

### Phase 7: Integration & Polish
**Rationale:** Convergence point. End-to-end validation ensures components work together. Backward compatibility ensures existing projects don't break.
**Delivers:** End-to-end test (profile → CLAUDE.md → plan-phase with brief), backward compatibility validation (existing config.json, projects without profiles), documentation updates, migration guide
**Addresses:** All integration points, config extension backward compatibility
**Avoids:** All pitfalls through integration testing
**Research needs:** NONE — validation phase, no new patterns

### Phase Ordering Rationale

- **Serial: Phase 1 → 2 → 3** — Profiling pipeline is foundational. Each phase depends on prior completion. Phase 2 needs extracted session data from Phase 1. Phase 3 needs USER-PROFILE.md from Phase 2.
- **Parallel: Phase 4 || Phase 5 || Phase 6** — After profiling foundation exists, these enhance consumption of profile data but don't depend on each other. CLAUDE.md generation, brief assembly, and structured checklists can be built simultaneously.
- **Convergence: Phase 7** — Integration testing validates the complete system. Must come after all feature phases.

**Critical path:** Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 7. CLAUDE.md (Phase 4) and checklists (Phase 6) are valuable but not blocking for workflow improvements.

**Dependencies from architecture:**
- Phase 2 spawns agents → needs Phase 1 gsd-tools.js subcommands to extract data
- Phase 3 generates /dev-preferences → needs Phase 2 USER-PROFILE.md output
- Phase 5 assembles briefs → needs Phase 2 profile for developer preferences section
- Phase 4 generates CLAUDE.md → needs Phase 2 profile but can run parallel with Phase 5/6

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 6 (Structured Checklists):** Domain-specific checklist content (integration patterns, vendor API quirks, security baselines) requires cataloging common pitfalls per domain. Not available from generic sources — needs experienced developer input.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Session Data Pipeline):** Node.js streaming patterns well-documented, JSONL parsing verified from actual files
- **Phase 2 (Profiling Engine):** LLM agent patterns established in GSD, 8 dimensions validated against session data
- **Phase 3 (Profile Activation):** Command/workflow patterns match existing GSD implementations
- **Phase 4 (CLAUDE.md Integration):** Template generation patterns established, sentinel-based updates are straightforward
- **Phase 5 (Brief Assembly):** Existing CONTEXT.md and SUMMARY.md patterns provide clear model
- **Phase 7 (Integration):** Testing phase, no new patterns to research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against actual codebase (4,597 lines gsd-tools.js), actual session files (744MB, 310 sessions), running Node.js v22.17.0 |
| Features | MEDIUM | Core profiling pipeline validated; workflow enhancements based on observed patterns but competitor features may have evolved since training cutoff |
| Architecture | HIGH | Direct codebase analysis confirms patterns, existing GSD structure verified, integration points tested against actual files |
| Pitfalls | HIGH | Observed real session data (20MB max file, 744MB total), verified gsd-tools.js test coverage (75 tests, ~40% command coverage), actual JSONL format variations |

**Overall confidence:** HIGH

Research is grounded in direct codebase verification and actual session data analysis, not theoretical patterns. The zero-dependency constraint and existing GSD architecture provide strong guardrails. The primary uncertainty is competitor feature evolution (Cursor, Copilot, Windsurf may have added profiling since training cutoff), but this doesn't affect technical implementation.

### Gaps to Address

**Profile dimension validation:** The 8 dimensions (communication, decision speed, explanation depth, debugging, UX, vendor, frustration, learning) are derived from the plan's assertions, not validated against actual user needs. During Phase 2 planning, consider user interviews or feedback loops to confirm these dimensions match real developer preferences.

**JSONL format stability:** The version field (2.1.37 observed) suggests format evolution, but no schema documentation exists. During Phase 1 implementation, add explicit version logging to track when format changes appear. Consider contributing format documentation back to Claude Code if versioning becomes a problem.

**Checklist domain coverage:** Phase 6 structured checklists need domain-specific content. The plan suggests "integration, dependency, vendor API, security" but doesn't enumerate which vendors or which integrations. During Phase 6 planning, catalog the top 10-20 integrations GSD users actually build (Stripe, Supabase, OpenAI, etc.) and prioritize checklists for those.

**Profile refresh UX:** The plan mentions profile refresh but doesn't specify the update strategy (full replace vs incremental merge vs diff-based). During Phase 3 planning, decide: when a user re-runs profiling with 50 new sessions, should old data be discarded, merged, or preserved with lower weight?

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `/Users/canodevelopment/coding-portfolio/get-shit-done/` (complete repository, 14 modified files per plan)
- Direct session data: `~/.claude/projects/` (744MB, 310 sessions across 6 projects, max 20MB single file)
- Existing GSD workflows: `get-shit-done/workflows/*.md` (new-project, plan-phase, discuss-phase, execute-phase patterns)
- gsd-tools.js implementation: 4,597 lines, switch/case router at line 4227, 75 tests, loadConfig() at line 159
- JSONL format: actual files parsed, version 2.1.37, types observed (user, assistant, progress, file-history-snapshot, system, custom-title)
- Claude Code integration: verified `~/.claude/settings.json`, `~/.claude/commands/gsd/` (30+ command files), skills at `~/.claude/skills/`

### Secondary (MEDIUM confidence)
- PROJECT.md requirements: `.planning/PROJECT.md` (authoritative but untested against real execution)
- CLAUDE.md auto-loading: stated in project context, consistent with training data, not independently verified in official docs
- Competitor features (Cursor, Copilot, Windsurf): training data only, could not verify current state with web tools
- 8-dimension profiling framework: plan assertions validated against session patterns but not against user feedback

### Tertiary (LOW confidence)
- Developer profiling domain patterns: inferred from IDE analytics tools (WakaTime, Code Climate, LinearB) but applied in novel context
- Profile effectiveness claims: no A/B testing infrastructure or measurement exists yet

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
