# Roadmap: GSD-Plus

## Overview

GSD-Plus transforms Claude Code from a stateless assistant into a developer-aware partner by building a session analysis pipeline, behavioral profiling engine, and workflow optimizations on top of the existing GSD framework. The journey progresses from data extraction (making session history parseable) through intelligence (profiling developer behavior) to activation (making profiles affect Claude's responses across all projects), then fans out into context generation and advisor mode before converging on quality assurance and documentation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Session Data Pipeline** - Memory-safe extraction of user messages from Claude Code session history
- [x] **Phase 2: Profiling Engine** - LLM-based behavioral analysis across 8 dimensions with confidence scoring
- [ ] **Phase 3: Profile Activation** - Command orchestration that turns profiles into Claude-discoverable artifacts
- [ ] **Phase 4: Context Generation** - Project-specific CLAUDE.md, phase briefs, and workflow integration from profile + project artifacts
- [ ] **Phase 5: Advisor Mode** - Research-driven discussion enhancement with comparison tables
- [ ] **Phase 6: Quality & Documentation** - Plan validation checklists, multi-tool verification, and documentation for release

## Phase Details

### Phase 1: Session Data Pipeline
**Goal**: Developer can extract their own session history into a structured, memory-safe data stream that downstream agents can consume
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd-tools.js scan-sessions` returns a list of all Claude Code projects with session counts, sizes, and timestamps
  2. Running `gsd-tools.js extract-messages` on a 20MB session file completes without exceeding 512MB process memory
  3. Extracted output contains only user messages (type=user, userType=external) with no assistant, progress, or meta records
  4. Session discovery works both with sessions-index.json present and when index is missing (fallback to directory scan)
  5. Config template loads cleanly with new `preferences` and `profile` keys, and existing config.json files without these keys still load via backward-compatible defaults
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md -- Session discovery infrastructure, helpers, scan-sessions command, loadConfig extension
- [ ] 01-02-PLAN.md -- Message extraction pipeline, extract-messages command, tests for all Phase 1 functionality

### Phase 2: Profiling Engine
**Goal**: Developer's behavioral patterns are analyzed into an evidence-backed profile with calibrated confidence across 8 dimensions
**Depends on**: Phase 1
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07
**Success Criteria** (what must be TRUE):
  1. gsd-user-profiler agent produces dimension ratings for all 8 behavioral dimensions (communication style, decision speed, explanation depth, debugging approach, UX philosophy, vendor philosophy, frustration triggers, learning style)
  2. Each dimension includes a confidence score (HIGH/MEDIUM/LOW) that reflects evidence count, signal clarity, and cross-project consistency
  3. Profile includes representative quotes from actual sessions linked to each dimension
  4. USER-PROFILE.md is written to `~/.claude/get-shit-done/USER-PROFILE.md` with all sections populated
  5. When user opts out of session analysis or has no sessions, questionnaire fallback presents 8 prompts and produces the same profile structure
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- User-profiling reference document, gsd-user-profiler agent definition, model profiles update
- [x] 02-02-PLAN.md -- profile-sample subcommand, user-profile template, write-profile subcommand
- [x] 02-03-PLAN.md -- Questionnaire fallback subcommand, tests for all Phase 2 gsd-tools functionality

### Phase 3: Profile Activation
**Goal**: Developer can run a single command to generate their profile and produce Claude-discoverable artifacts that affect future sessions
**Depends on**: Phase 2
**Requirements**: ACTV-01, ACTV-02, ACTV-03, ACTV-04, ACTV-05, ACTV-06
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:profile-user` walks through consent gate, session scan, analysis, and profile generation in one flow
  2. Running `/gsd:profile-user --questionnaire` skips session analysis entirely and uses interactive prompts
  3. Running `/gsd:profile-user --refresh` rebuilds the profile even when one already exists
  4. `/dev-preferences` command file appears at `~/.claude/commands/dev-preferences.md` and is readable by Claude Code
  5. Artifact selection lets developer choose which outputs to generate (CLAUDE.md, /dev-preferences, global CLAUDE.md)
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md -- Command definition and orchestration workflow (/gsd:profile-user command + 10-step workflow)
- [ ] 03-02-PLAN.md -- Artifact generation subcommands (generate-dev-preferences, generate-claude-profile, dev-preferences template)
- [ ] 03-03-PLAN.md -- Tests for artifact generation subcommands (17 test cases)

### Phase 4: Context Generation
**Goal**: Generate project-specific CLAUDE.md and curated phase briefs from profile + project artifacts, with workflow integration that makes context automatic
**Depends on**: Phase 3
**Requirements**: CLMD-01, CLMD-02, CLMD-03, CLMD-04, CLMD-05, CLMD-06, WKFL-03, WKFL-04, WKFL-08, INTG-01, INTG-02, INTG-04
**Success Criteria** (what must be TRUE):
  1. CLAUDE.md template uses `{{placeholder}}` markers that resolve from PROJECT.md, codebase map, config.json, and USER-PROFILE.md
  2. When source data is missing (no profile, no codebase map), template sections render with meaningful fallback text instead of empty or broken markers
  3. Generated CLAUDE.md includes `<!-- Source: ... -->` comments enabling targeted section updates
  4. When a CLAUDE.md already exists, generation shows a diff and asks for confirmation before overwriting
  5. CLAUDE.md is auto-generated during `/gsd:new-project` after roadmap creation (Step 8.5)
  6. CLAUDE.md sections auto-update during phase transitions when stack or convention changes are detected
  7. Phase brief assembles content from STATE.md, previous SUMMARY.md files, CONTEXT.md cross-phase references, and USER-PROFILE.md into a single document
  8. Planner and researcher agents receive the assembled brief as curated context instead of loading files ad-hoc
  9. CONTEXT.md template includes a `<cross_phase>` section where decisions tagged for future phases are captured and carried forward
  10. `/gsd:new-project` includes a preferences interview step that pre-populates from USER-PROFILE.md when it exists
  11. Preferences interview results persist in config.json under the `preferences` key
  12. resume-project workflow loads USER-PROFILE.md into developer preference context when available
**Plans**: 4-5 plans (TBD)

Plans:
- [ ] 04-01: Template system + CLAUDE.md generation subcommand
- [ ] 04-02: Phase brief assembly + cross-phase threading (CONTEXT.md `<cross_phase>`)
- [ ] 04-03: Workflow integration (new-project preferences interview, resume-project profile loading, phase transition auto-updates)
- [ ] 04-04: Tests
- [ ] 04-05: TBD (if needed)

### Phase 5: Advisor Mode
**Goal**: Developer gets research-backed options with tradeoff analysis during discuss-phase instead of unstructured conversation
**Depends on**: Phase 2 (needs profile for vendor_philosophy calibration)
**Requirements**: WKFL-01, WKFL-02
**Success Criteria** (what must be TRUE):
  1. Advisor mode in discuss-phase researches gray areas and presents comparison tables with columns for Options, Pros, Cons, Complexity, and Recommendation
  2. Advisor research depth adjusts based on the developer's `preferences.vendor_philosophy` setting (more research for cautious developers, faster recommendations for opinionated developers)
**Plans**: 2 plans (TBD)

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Quality & Documentation
**Goal**: Plans are validated against domain-specific checklists before execution, verification uses all available tools with graceful fallback, and all GSD-Plus capabilities are documented for release
**Depends on**: Phase 1 (gsd-tools patterns), Phases 4-5 (documents all features)
**Requirements**: WKFL-05, WKFL-06, WKFL-07, DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. gsd-plan-checker validates 4 dimensions: integration (connects with prior phases), dependency (library version compatibility), vendor API (current patterns), and security basics (auth, input validation, secrets)
  2. gsd-verifier detects available MCP tools and applies verification matched to phase type (UI, database, API, auth, deployment) with graceful fallback to file-based verification when no MCP tools are available
  3. verify-work workflow includes human testing reminders with `/gsd:quick` and `/gsd:debug` suggestions
  4. Running `/gsd:help` shows `/gsd:profile-user` command with usage examples and flag descriptions
  5. Running `/gsd:settings` cross-references that developer preferences are managed via `/gsd:profile-user` and the new-project preferences interview
  6. README.md includes a section on developer profiling capability with setup instructions
  7. CHANGELOG.md includes a complete entry covering all GSD-Plus features
**Plans**: 4-5 plans (TBD)

Plans:
- [ ] 06-01: Plan checker agent + checklist definitions
- [ ] 06-02: Verifier MCP tool detection + fallback logic
- [ ] 06-03: Help/settings updates + README section + CHANGELOG
- [ ] 06-04: Tests
- [ ] 06-05: TBD (if needed)

## Progress

**Execution Order:**
Phases 1-3 execute serially (pipeline dependency). Phases 4 and 5 can execute in parallel (Phase 5 only needs Phase 2). Phase 6 waits for both 4 and 5 to complete (documents all features).

```
Phase 1 ✓ → Phase 2 ✓ → Phase 3 (finishing) → Phase 4 ──→ Phase 6
                                                Phase 5 ──↗
```

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Session Data Pipeline | 2/2 | ✓ Complete | 2026-02-13 |
| 2. Profiling Engine | 3/3 | ✓ Complete | 2026-02-14 |
| 3. Profile Activation | 0/3 | Planned | - |
| 4. Context Generation | 0/5 | Not started | - |
| 5. Advisor Mode | 0/2 | Not started | - |
| 6. Quality & Documentation | 0/5 | Not started | - |

---
*Roadmap created: 2026-02-12*
*Last updated: 2026-02-14*
