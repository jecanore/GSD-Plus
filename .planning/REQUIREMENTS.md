# Requirements: GSD-Plus

**Defined:** 2026-02-12
**Core Value:** Claude should know how a developer works so it doesn't start every conversation blind

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session Data Pipeline

- [ ] **PIPE-01**: gsd-tools.js can scan all Claude Code project directories and return session metadata (count, size, project, timestamps)
- [ ] **PIPE-02**: gsd-tools.js can stream-parse JSONL session files up to 20MB without exceeding 512MB process memory
- [ ] **PIPE-03**: gsd-tools.js extracts only user messages from JSONL (type=user, userType=external), skipping meta/sidechain/assistant/progress records
- [ ] **PIPE-04**: gsd-tools.js discovers sessions via sessions-index.json when available, falling back to directory scan when index is missing
- [ ] **PIPE-05**: Extracted user messages are truncated to 2000 chars each and limited to 300 messages per batch
- [ ] **PIPE-06**: Config template includes new `preferences` and `profile` keys with backward-compatible defaults in `loadConfig()`

### Developer Profiling

- [ ] **PROF-01**: gsd-user-profiler agent analyzes user messages across 8 behavioral dimensions (communication style, decision speed, explanation depth, debugging approach, UX philosophy, vendor philosophy, frustration triggers, learning style)
- [ ] **PROF-02**: Each dimension receives a confidence score (HIGH/MEDIUM/LOW) based on evidence count, signal clarity, and cross-project consistency
- [ ] **PROF-03**: Profile includes evidence excerpts (representative quotes) linked to each dimension for user verification
- [ ] **PROF-04**: USER-PROFILE.md is generated at `~/.claude/get-shit-done/USER-PROFILE.md` with dimension sections, confidence scores, evidence, and actionable Claude instructions
- [ ] **PROF-05**: Questionnaire fallback presents 8 AskUserQuestion prompts mapping to the 8 dimensions when user opts out of session analysis or has no sessions
- [ ] **PROF-06**: Profiling uses project-proportional sampling (max sessions per project capped) with recency weighting to prevent overfitting to dominant projects
- [ ] **PROF-07**: User-profiling reference doc defines detection heuristics, signal patterns, example quotes, and confidence scoring rules for all 8 dimensions

### Profile Activation

- [ ] **ACTV-01**: `/gsd:profile-user` command orchestrates the full flow: consent gate, session scan, parallel agent analysis, synthesis, profile generation
- [ ] **ACTV-02**: `/gsd:profile-user --questionnaire` skips session analysis and uses questionnaire-only path
- [ ] **ACTV-03**: `/gsd:profile-user --refresh` rebuilds profile even if one already exists
- [ ] **ACTV-04**: `/dev-preferences` command file is generated at `~/.claude/commands/dev-preferences.md` from profile, readable by Claude Code at session start
- [ ] **ACTV-05**: Profile-user workflow presents artifact selection (AskUserQuestion multiSelect) for generating CLAUDE.md, /dev-preferences, or global CLAUDE.md
- [ ] **ACTV-06**: Session analysis requires explicit opt-in consent before reading any JSONL files

### CLAUDE.md Generation

- [ ] **CLMD-01**: CLAUDE.md template uses `{{placeholder}}` markers populated from PROJECT.md, codebase map, config.json, and USER-PROFILE.md
- [ ] **CLMD-02**: Each template section has fallback text when source data doesn't exist
- [ ] **CLMD-03**: Template includes source comments (`<!-- Source: ... -->`) enabling targeted section updates during phase transitions
- [ ] **CLMD-04**: Generation detects existing CLAUDE.md and shows diff before overwriting, asks for confirmation
- [ ] **CLMD-05**: CLAUDE.md is auto-generated during `/gsd:new-project` after roadmap creation (Step 8.5)
- [ ] **CLMD-06**: CLAUDE.md sections are auto-updated during phase transitions when stack/convention changes are detected

### Workflow Optimizations

- [ ] **WKFL-01**: Advisor mode in discuss-phase researches gray areas and presents comparison tables (Options | Pros | Cons | Complexity | Recommendation) before user decides
- [ ] **WKFL-02**: Advisor research depth is calibrated by `preferences.vendor_philosophy` setting
- [ ] **WKFL-03**: Phase brief is assembled at plan-phase Step 7.5 from STATE.md, previous SUMMARY.md files, CONTEXT.md cross-phase references, and USER-PROFILE.md
- [ ] **WKFL-04**: Phase brief is passed to planner/researcher agents as curated context replacing ad-hoc file loading
- [ ] **WKFL-05**: gsd-plan-checker validates 4 new dimensions: integration (connects with prior phases), dependency (library version compatibility), vendor API (current patterns via Context7), security basics (auth, input validation, secrets)
- [ ] **WKFL-06**: gsd-verifier detects all available MCP tools (from `.mcp.json` + `settings.json` plugins) and applies read-only verification matched to phase type: UI/frontend (browser screenshots, element checks, navigation), database/backend (schema, RLS, data integrity), API (endpoint availability, response shape), auth (login flows, session handling), deployment (health checks, service availability) — with graceful fallback to file-based verification when no MCP tools are available
- [ ] **WKFL-07**: verify-work workflow includes human testing reminders with `/gsd:quick` and `/gsd:debug` suggestions
- [ ] **WKFL-08**: CONTEXT.md template includes `<cross_phase>` section for tagging decisions that affect future phases

### Integration

- [ ] **INTG-01**: `/gsd:new-project` includes Step 5.5 preferences interview (involvement, explanation, vendor selection, verification) with profile pre-population when USER-PROFILE.md exists
- [ ] **INTG-02**: Preferences interview results are stored in config.json `preferences` key
- [ ] **INTG-03**: Phase transition workflow auto-updates CLAUDE.md sections when stack/convention changes are detected
- [ ] **INTG-04**: resume-project workflow loads USER-PROFILE.md into developer preference context when it exists
- [ ] **INTG-05**: Model profiles reference includes gsd-user-profiler agent mapping (quality: opus, balanced: sonnet, budget: haiku)

### Documentation

- [ ] **DOCS-01**: Help workflow documents `/gsd:profile-user` command with usage examples
- [ ] **DOCS-02**: Settings workflow cross-references that developer preferences are managed via `/gsd:profile-user` and new-project preferences interview
- [ ] **DOCS-03**: README.md mentions developer profiling capability
- [ ] **DOCS-04**: CHANGELOG.md includes entry for GSD-Plus features

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Profiling

- **ADVP-01**: Profile refresh with before/after diff display showing what changed
- **ADVP-02**: Incremental profiling analyzing only sessions since last profile date
- **ADVP-03**: Profile effectiveness metrics (before/after comparison in CLAUDE.md diffs)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time profile updates during sessions | Complexity outweighs value; profiles refresh on-demand |
| Analyzing Claude's responses | Privacy boundary; creates feedback loop where profile system judges itself |
| Analyzing code content from sessions | Privacy boundary; code may contain secrets or proprietary logic |
| Profile sharing/export between developers | GSD is a single-developer tool; team conventions go in project CLAUDE.md |
| Automated A/B testing of profile effectiveness | No infrastructure for controlled measurement |
| Full IDE analytics (keystroke tracking, telemetry) | Requires runtime integration outside Claude Code session boundaries |
| Complex ML model for profile inference | Violates zero-dependency constraint; the LLM IS the model |
| Automatic profile application without user review | Users must maintain agency; generated artifacts are reviewable first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 1 | Complete |
| PIPE-02 | Phase 1 | Complete |
| PIPE-03 | Phase 1 | Complete |
| PIPE-04 | Phase 1 | Complete |
| PIPE-05 | Phase 1 | Complete |
| PIPE-06 | Phase 1 | Complete |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| PROF-05 | Phase 2 | Complete |
| PROF-06 | Phase 2 | Complete |
| PROF-07 | Phase 2 | Complete |
| ACTV-01 | Phase 3 | Pending |
| ACTV-02 | Phase 3 | Pending |
| ACTV-03 | Phase 3 | Pending |
| ACTV-04 | Phase 3 | Pending |
| ACTV-05 | Phase 3 | Pending |
| ACTV-06 | Phase 3 | Pending |
| CLMD-01 | Phase 4 | Pending |
| CLMD-02 | Phase 4 | Pending |
| CLMD-03 | Phase 4 | Pending |
| CLMD-04 | Phase 4 | Pending |
| CLMD-05 | Phase 4 | Pending |
| CLMD-06 | Phase 4 | Pending |
| WKFL-01 | Phase 5 | Pending |
| WKFL-02 | Phase 5 | Pending |
| WKFL-03 | Phase 4 | Pending |
| WKFL-04 | Phase 4 | Pending |
| WKFL-05 | Phase 6 | Pending |
| WKFL-06 | Phase 6 | Pending |
| WKFL-07 | Phase 6 | Pending |
| WKFL-08 | Phase 4 | Pending |
| INTG-01 | Phase 4 | Pending |
| INTG-02 | Phase 4 | Pending |
| INTG-03 | Phase 4 | Duplicate of CLMD-06 |
| INTG-04 | Phase 4 | Pending |
| INTG-05 | Phase 2 | Complete |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |
| DOCS-03 | Phase 6 | Pending |
| DOCS-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 40 active + 1 duplicate (INTG-03 = CLMD-06) + 1 already complete (INTG-05)
- Unmapped: 0

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-14 after roadmap consolidation (9 → 6 phases)*
