# Roadmap: GSD-Plus

## Overview

GSD-Plus transforms Claude Code from a stateless assistant into a developer-aware partner by building a session analysis pipeline, behavioral profiling engine, and workflow optimizations on top of the existing GSD framework. The journey progresses from data extraction (making session history parseable) through intelligence (profiling developer behavior) to activation (making profiles affect Claude's responses across all projects), then fans out into parallel workflow enhancements before converging on integration and documentation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Session Data Pipeline** - Memory-safe extraction of user messages from Claude Code session history
- [ ] **Phase 2: Profiling Engine** - LLM-based behavioral analysis across 8 dimensions with confidence scoring
- [ ] **Phase 3: Profile Activation** - Command orchestration that turns profiles into Claude-discoverable artifacts
- [ ] **Phase 4: CLAUDE.md Generation** - Template-driven project configuration with profile-aware sections
- [ ] **Phase 5: Phase Brief Assembly** - Cross-phase context threading that eliminates manual context gathering
- [ ] **Phase 6: Advisor Mode** - Research-driven discussion enhancement with comparison tables
- [ ] **Phase 7: Structured Checklists & Verification** - Domain-specific plan validation and multi-tool execution verification
- [ ] **Phase 8: Integration** - Wiring profiling and workflow enhancements into existing GSD workflows
- [ ] **Phase 9: Documentation & Polish** - Help system updates, README, and changelog for release

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
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: CLAUDE.md Generation
**Goal**: Developer gets a project-specific CLAUDE.md populated from their profile and project artifacts, with safe update mechanisms that preserve manual customizations
**Depends on**: Phase 2 (needs USER-PROFILE.md)
**Requirements**: CLMD-01, CLMD-02, CLMD-03, CLMD-04, CLMD-05, CLMD-06
**Success Criteria** (what must be TRUE):
  1. CLAUDE.md template uses `{{placeholder}}` markers that resolve from PROJECT.md, codebase map, config.json, and USER-PROFILE.md
  2. When source data is missing (no profile, no codebase map), template sections render with meaningful fallback text instead of empty or broken markers
  3. Generated CLAUDE.md includes `<!-- Source: ... -->` comments enabling targeted section updates
  4. When a CLAUDE.md already exists, generation shows a diff and asks for confirmation before overwriting
  5. CLAUDE.md sections auto-update during phase transitions when stack or convention changes are detected
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Phase Brief Assembly
**Goal**: Planner and researcher agents receive curated, profile-aware context instead of ad-hoc file loading, and decisions carry forward across phases automatically
**Depends on**: Phase 2 (needs USER-PROFILE.md for developer preferences section)
**Requirements**: WKFL-03, WKFL-04, WKFL-08
**Success Criteria** (what must be TRUE):
  1. Phase brief assembles content from STATE.md, previous SUMMARY.md files, CONTEXT.md cross-phase references, and USER-PROFILE.md into a single document
  2. Planner and researcher agents receive the assembled brief as curated context instead of loading files ad-hoc
  3. CONTEXT.md template includes a `<cross_phase>` section where decisions tagged for future phases are captured and carried forward
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Advisor Mode
**Goal**: Developer gets research-backed options with tradeoff analysis during discuss-phase instead of unstructured conversation
**Depends on**: Phase 2 (needs profile for vendor_philosophy calibration)
**Requirements**: WKFL-01, WKFL-02
**Success Criteria** (what must be TRUE):
  1. Advisor mode in discuss-phase researches gray areas and presents comparison tables with columns for Options, Pros, Cons, Complexity, and Recommendation
  2. Advisor research depth adjusts based on the developer's `preferences.vendor_philosophy` setting (more research for cautious developers, faster recommendations for opinionated developers)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Structured Checklists & Verification
**Goal**: Plans are validated against domain-specific checklists before execution, and verification uses all available tools with graceful fallback
**Depends on**: Phase 1 (needs gsd-tools.js patterns established)
**Requirements**: WKFL-05, WKFL-06, WKFL-07
**Success Criteria** (what must be TRUE):
  1. gsd-plan-checker validates 4 dimensions: integration (connects with prior phases), dependency (library version compatibility), vendor API (current patterns), and security basics (auth, input validation, secrets)
  2. gsd-verifier detects available MCP tools and applies verification matched to phase type (UI, database, API, auth, deployment) with graceful fallback to file-based verification when no MCP tools are available
  3. verify-work workflow includes human testing reminders with `/gsd:quick` and `/gsd:debug` suggestions
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

### Phase 8: Integration
**Goal**: Profiling and workflow enhancements are wired into existing GSD workflows so they activate automatically during normal project lifecycle
**Depends on**: Phases 3, 4, 5 (needs profile activation, CLAUDE.md generation, and brief assembly complete)
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05
**Success Criteria** (what must be TRUE):
  1. `/gsd:new-project` includes a preferences interview step that pre-populates from USER-PROFILE.md when it exists
  2. Preferences interview results persist in config.json under the `preferences` key
  3. Phase transition workflow auto-updates CLAUDE.md sections when stack or convention changes are detected
  4. resume-project workflow loads USER-PROFILE.md into developer preference context when available
  5. Model profiles reference maps gsd-user-profiler agent to appropriate model tier (quality: opus, balanced: sonnet, budget: haiku)
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: Documentation & Polish
**Goal**: GSD-Plus capabilities are discoverable through help, settings, README, and changelog so users know what exists and how to use it
**Depends on**: Phases 3, 4, 5, 6, 7, 8 (documents what was built)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:help` shows `/gsd:profile-user` command with usage examples and flag descriptions
  2. Running `/gsd:settings` cross-references that developer preferences are managed via `/gsd:profile-user` and the new-project preferences interview
  3. README.md includes a section on developer profiling capability with setup instructions
  4. CHANGELOG.md includes a complete entry covering all GSD-Plus features
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

## Progress

**Execution Order:**
Phases 1-3 execute serially (pipeline dependency). Phases 4, 5, 6, 7 can execute in parallel after their dependencies are met. Phase 8 converges. Phase 9 finalizes.

Recommended order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
Parallel opportunities: {4, 5, 6, 7} can overlap after Phase 3 completes (Phase 7 only needs Phase 1)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Session Data Pipeline | 0/2 | Planned | - |
| 2. Profiling Engine | 0/3 | Not started | - |
| 3. Profile Activation | 0/3 | Not started | - |
| 4. CLAUDE.md Generation | 0/3 | Not started | - |
| 5. Phase Brief Assembly | 0/2 | Not started | - |
| 6. Advisor Mode | 0/2 | Not started | - |
| 7. Structured Checklists & Verification | 0/3 | Not started | - |
| 8. Integration | 0/3 | Not started | - |
| 9. Documentation & Polish | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-12*
*Last updated: 2026-02-12*
