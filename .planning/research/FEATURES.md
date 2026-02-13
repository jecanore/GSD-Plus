# Feature Research

**Domain:** Developer profiling and AI workflow optimization for Claude Code skill frameworks
**Researched:** 2026-02-12
**Confidence:** MEDIUM (web tools unavailable; findings based on codebase analysis + training data; competitor features may have evolved)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session history extraction | Without reading session data, there is nothing to profile. Users will ask "where does the data come from?" | HIGH | JSONL parsing of 7MB+ files; must extract only user messages (privacy boundary). Needs `gsd-tools.js` subcommand to pre-process server-side so agents receive ~200-500KB. |
| Multi-dimension behavioral analysis | A profile that captures one or two traits feels shallow. Users expect a nuanced picture. 8 dimensions (communication, decision speed, explanation depth, debugging approach, UX preference, vendor API handling, frustration signals, learning style) was validated across 82 manual sessions. | HIGH | Each dimension needs its own extraction heuristics. LLM-based scoring against dimension rubrics. Must handle sparse data gracefully (some dimensions may have zero signal in a given history). |
| Confidence scoring per dimension | Users need to know which dimensions are well-supported by evidence vs thin guesses. A profile without confidence signals feels like fortune-telling. | MEDIUM | Per-dimension confidence = (sample count, signal clarity, consistency). Display as HIGH/MEDIUM/LOW per dimension in USER-PROFILE.md. |
| Questionnaire fallback | Not all users have session history (new users, privacy-conscious users, different machine). Asking targeted questions is the expected alternative. | MEDIUM | 8-15 questions mapping to the same 8 dimensions. Must produce equivalent profile format. AskUserQuestion pattern already exists in GSD. |
| USER-PROFILE.md generation | The profile needs a durable, readable artifact. Users expect to review, edit, and version-control their profile. Markdown is the GSD standard. | LOW | Template with dimension sections, scores, evidence snippets, confidence levels. Write to `~/.claude/get-shit-done/USER-PROFILE.md` (global). |
| `/dev-preferences` command generation | The profile only has value if it feeds into Claude's behavior. A slash command that Claude auto-discovers is the mechanism. Users expect the profile to "do something." | MEDIUM | Generate `~/.claude/commands/dev-preferences.md` that contains system-prompt-level instructions derived from profile. Claude Code loads these on every session start. |
| CLAUDE.md auto-generation | Project-level AI configuration (like .cursorrules) is table stakes in the AI coding assistant ecosystem. Every competing tool has this. Users expect GSD to create it from project context. | MEDIUM | Combine project artifacts (.planning/codebase/*, USER-PROFILE.md, config.json) into a CLAUDE.md with `{{placeholder}}` markers. Must not overwrite manual customizations. |
| Profile refresh/update | Profiles go stale. Users expect to re-run profiling as they evolve. "Run it again with my latest sessions." | LOW | Re-run same analysis, diff against existing profile, merge or replace. Show what changed. |

### Differentiators (Competitive Advantage)

Features that set GSD-Plus apart from generic AI coding assistants. Not required, but deliver outsized value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Advisor mode in discuss-phase | Current discuss-phase captures decisions; advisor mode adds research-backed comparison tables and recommendations DURING discussion, not after. No other framework does this -- it collapses the "research then discuss" gap into one step. | HIGH | Spawns mini-researcher inside discuss-phase flow. Must produce comparison tables inline (not as separate files). Needs careful UX so discussion flow is not interrupted by research latency. |
| Phase brief assembly | Automatically compile all relevant context (profile, project state, research, cross-phase decisions) into a brief BEFORE the planner runs. Eliminates the manual "gather context" step that plagues multi-session projects. | MEDIUM | New step (7.5 in plan-phase) that reads from multiple sources and assembles a structured brief. Key innovation: profile-aware briefs mean plans are calibrated to developer style. |
| Structured plan checklists (integration, dependency, vendor API, security) | Plans currently have freeform tasks. Adding domain-specific checklists catches classes of bugs that freeform planning misses. "Did you check for rate limits?" "Did you handle auth token refresh?" | MEDIUM | Checklist templates per domain. gsd-plan-checker validates presence. Not every plan needs every checklist -- detection logic must match plan content to relevant checklists. |
| Multi-tool automated verification | Current verification is grep-based stub detection + human testing. Adding Playwright for browser testing and Supabase MCP for database verification closes the gap between "code exists" and "feature works." | HIGH | Must handle tool installation, environment setup, and graceful degradation when tools are unavailable. Playwright tests need to be generated from plan verification criteria. |
| Cross-phase context threading | Decisions made in Phase 1 should inform Phase 5 without the user repeating themselves. `<cross_phase>` section in CONTEXT.md carries forward. | MEDIUM | Write cross-phase notes during execution. Read them at discuss-phase and plan-phase for subsequent phases. Must not bloat context -- prune irrelevant threads as phases complete. |
| Preferences interview in new-project | During `/gsd:new-project`, ask 3-5 preference questions that seed the profile for users who have never run `/gsd:profile-user`. First-run experience that immediately personalizes behavior. | LOW | Lightweight subset of the full questionnaire. Results merge into USER-PROFILE.md with LOW confidence scores (will be overridden by session analysis later). |
| Profile-aware CLAUDE.md | CLAUDE.md that adapts its instructions based on developer profile dimensions. Verbose developers get different instructions than terse ones. Debugging-first developers get different verification emphasis. | MEDIUM | Template system with conditional sections. Profile dimensions map to CLAUDE.md directives. The key differentiator: CLAUDE.md is not just project context -- it is personalized project context. |
| Evidence-linked profiles | Profile dimensions backed by actual session excerpts ("You tend to ask for explanations before proceeding -- based on sessions 14, 27, 38"). Builds trust and allows users to verify/correct. | MEDIUM | During analysis, store representative quotes per dimension. Include in USER-PROFILE.md as collapsible evidence sections. Privacy-safe: only user messages, never code content. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time profile updates during sessions | "Profile should learn as I work" | Adds massive complexity (file watching, incremental analysis, profile invalidation). Profile drift during a session could cause inconsistent behavior. The PROJECT.md already lists this as out of scope. | On-demand refresh via `/gsd:profile-user --refresh`. Users control when profiles update. |
| Analyzing Claude's responses | "See how Claude adapts to me" | Privacy boundary violation. Analyzing AI responses creates a feedback loop where the profile system judges itself. Also massively increases data volume. | Profile only user messages. Claude's response quality is measured through verification outcomes, not response analysis. |
| Analyzing code content from sessions | "Profile my coding style from actual code" | Privacy boundary. Code may contain secrets, proprietary logic, or patterns from copied code. Also conflates coding style (a language/framework property) with developer behavior (a human property). | Profile behavioral signals from conversation patterns. Coding style preferences captured through questionnaire dimensions. |
| Profile sharing/export between developers | "Team profiles for consistent AI behavior" | GSD is a single-developer tool. Team dynamics require consensus on preferences, which is a social problem, not a technical one. Shared profiles would create lowest-common-denominator instructions. | Each developer maintains their own profile. Team conventions go in project-level CLAUDE.md. |
| Automated A/B testing of profile effectiveness | "Prove the profile makes Claude better" | No infrastructure for controlled measurement. AI output quality is subjective and context-dependent. Building measurement infrastructure is a whole product, not a feature. | Trust signals: confidence scores on profile dimensions, before/after comparison in CLAUDE.md diffs. |
| Full IDE analytics (keystroke tracking, time-on-task, editor telemetry) | "WakaTime-style metrics would make profiles richer" | Requires runtime integration outside Claude Code session boundaries. Introduces persistent background processes. Privacy and consent concerns multiply. Complexity far exceeds value for profile generation. | Session history JSONL is rich enough. Behavioral patterns emerge from conversation structure without needing IDE telemetry. |
| Automatic profile application without user review | "Just apply it, I trust the system" | Users must maintain agency over how AI behaves toward them. Silent profile application creates a "black box" feel. If the profile is wrong, the user has no recourse. | Generate USER-PROFILE.md and `/dev-preferences` as reviewable artifacts. User edits before the profile takes effect. |
| Complex ML model for profile inference | "Use embeddings or fine-tuning for better profiles" | Adds external dependencies (Python, ML libraries) to a zero-dependency Node.js project. Model training requires data pipelines. Maintenance burden for marginal accuracy gain over LLM-based analysis. | Use Claude itself (via agent spawning) for profile analysis. The LLM is the model. Prompt engineering over ML engineering. |

## Feature Dependencies

```
[Session History Extraction]
    |
    +--requires--> [Multi-dimension Behavioral Analysis]
    |                   |
    |                   +--requires--> [Confidence Scoring]
    |                   |
    |                   +--requires--> [USER-PROFILE.md Generation]
    |                                       |
    |                                       +--requires--> [/dev-preferences Command Generation]
    |                                       |
    |                                       +--requires--> [Profile-aware CLAUDE.md]
    |                                       |
    |                                       +--enhances--> [Phase Brief Assembly]
    |                                       |
    |                                       +--enhances--> [Evidence-linked Profiles]
    |
    +--alternative--> [Questionnaire Fallback]
                           |
                           +--requires--> [USER-PROFILE.md Generation]

[CLAUDE.md Auto-generation]
    |
    +--requires--> existing .planning/codebase/* (from /gsd:map-codebase)
    +--enhances--> [Profile-aware CLAUDE.md]

[Preferences Interview in new-project]
    |
    +--requires--> [Questionnaire Fallback] (subset of same questions)
    +--feeds-into--> [USER-PROFILE.md Generation] (with LOW confidence)

[Advisor Mode in discuss-phase]
    |
    +--requires--> existing discuss-phase workflow
    +--independent-of--> profile system (works without profile)

[Structured Plan Checklists]
    |
    +--requires--> existing plan-phase workflow
    +--enhances--> existing gsd-plan-checker
    +--independent-of--> profile system

[Multi-tool Automated Verification]
    |
    +--requires--> existing verification patterns
    +--requires--> tool detection and graceful degradation
    +--independent-of--> profile system

[Cross-phase Context Threading]
    |
    +--requires--> existing CONTEXT.md pattern
    +--enhances--> [Phase Brief Assembly]
    +--independent-of--> profile system
```

### Dependency Notes

- **Session History Extraction requires nothing upstream:** It is the foundation. gsd-tools.js must have a `profile extract-sessions` subcommand before any analysis can happen.
- **Multi-dimension Analysis requires Session Extraction:** Cannot analyze what has not been extracted.
- **USER-PROFILE.md requires Analysis OR Questionnaire:** These are parallel paths to the same artifact; at least one must exist.
- **`/dev-preferences` requires USER-PROFILE.md:** The command file is generated FROM the profile. No profile means no command.
- **Profile-aware CLAUDE.md requires both CLAUDE.md auto-gen AND USER-PROFILE.md:** It merges project context with developer preferences.
- **Advisor mode, structured checklists, and multi-tool verification are INDEPENDENT of the profile system:** They enhance workflow quality regardless of whether a user profile exists. This is critical for phase ordering -- they can be built in parallel with or before the profile system.
- **Cross-phase context threading enhances phase briefs:** If cross-phase context exists, briefs are richer. But briefs work without it (just with less context).
- **Preferences interview (in new-project) is a lightweight version of the questionnaire fallback:** Build the full questionnaire first, then extract a subset for the new-project flow.

## MVP Definition

### Launch With (v1)

Minimum viable features to validate the concept of developer profiling + workflow optimization.

- [ ] **Session history extraction** -- The data pipeline. Without this, no profiling exists. Must handle large JSONL files efficiently in Node.js with zero external deps.
- [ ] **Multi-dimension behavioral analysis** -- The core intelligence. 8 dimensions with LLM-based scoring via agent spawning.
- [ ] **Confidence scoring** -- Trust calibration. Users must know which dimensions are solid vs speculative.
- [ ] **USER-PROFILE.md generation** -- The durable artifact. Reviewable, editable, version-controllable.
- [ ] **Questionnaire fallback** -- The alternative path. Ensures every user can get a profile regardless of session history.
- [ ] **`/dev-preferences` command generation** -- The activation mechanism. Turns the profile into Claude-discoverable instructions.
- [ ] **CLAUDE.md auto-generation** -- The project-level configuration. Combines codebase map + profile into persistent AI instructions.

### Add After Validation (v1.x)

Features to add once the core profiling pipeline is working and users confirm value.

- [ ] **Phase brief assembly** -- Add when users report context loss between phases. Trigger: users saying "Claude forgot what we decided."
- [ ] **Structured plan checklists** -- Add when plan quality issues are observed (missed integrations, forgotten security checks). Trigger: recurring verification failures in specific domains.
- [ ] **Cross-phase context threading** -- Add when multi-phase projects show decision drift. Trigger: users repeating decisions across phases.
- [ ] **Preferences interview in new-project** -- Add after questionnaire fallback is stable. Trigger: new users asking "why doesn't Claude know my style yet?"
- [ ] **Profile-aware CLAUDE.md** -- Add after both CLAUDE.md auto-gen and USER-PROFILE.md are stable. Trigger: users manually editing CLAUDE.md to add preference-related instructions.
- [ ] **Evidence-linked profiles** -- Add when users question profile accuracy. Trigger: "why does it think I prefer X?"

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Advisor mode in discuss-phase** -- Requires significant UX work to integrate research into discussion flow without disrupting it. Defer until discuss-phase is proven essential to user workflows.
- [ ] **Multi-tool automated verification (Playwright, Supabase MCP)** -- Heavy external dependency management. Defer until basic verification patterns are exhausted and users need deeper automation.
- [ ] **Profile refresh with diff display** -- Nice polish feature. Defer until users have profiles old enough to need refreshing.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Session history extraction | HIGH | HIGH | P1 |
| Multi-dimension behavioral analysis | HIGH | HIGH | P1 |
| Confidence scoring per dimension | HIGH | MEDIUM | P1 |
| USER-PROFILE.md generation | HIGH | LOW | P1 |
| Questionnaire fallback | HIGH | MEDIUM | P1 |
| `/dev-preferences` command generation | HIGH | MEDIUM | P1 |
| CLAUDE.md auto-generation | HIGH | MEDIUM | P1 |
| Phase brief assembly | MEDIUM | MEDIUM | P2 |
| Structured plan checklists | MEDIUM | MEDIUM | P2 |
| Cross-phase context threading | MEDIUM | MEDIUM | P2 |
| Preferences interview in new-project | MEDIUM | LOW | P2 |
| Profile-aware CLAUDE.md | MEDIUM | MEDIUM | P2 |
| Evidence-linked profiles | MEDIUM | MEDIUM | P2 |
| Advisor mode in discuss-phase | MEDIUM | HIGH | P3 |
| Multi-tool automated verification | HIGH | HIGH | P3 |
| Profile refresh with diff | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch -- the profiling pipeline end-to-end
- P2: Should have, add when possible -- workflow enhancements that leverage the profile
- P3: Nice to have, future consideration -- ambitious features with high implementation cost

## Competitor Feature Analysis

| Feature | Cursor (.cursorrules) | GitHub Copilot (instructions) | Windsurf (memories) | Claude Code (CLAUDE.md) | GSD-Plus (proposed) |
|---------|----------------------|------------------------------|---------------------|------------------------|-------------------|
| Project-level AI config | .cursorrules file, manual creation | .github/copilot-instructions.md, manual | Cascade memories, auto-collected | CLAUDE.md at project root, manual | Auto-generated from codebase map + profile |
| Developer preferences | None (project-only) | None | Implicit from conversation memory | None (can add to CLAUDE.md manually) | Explicit 8-dimension profile from session history |
| Behavioral analysis | None | None | Basic conversation memory | None | Deep multi-session analysis with confidence scores |
| Questionnaire for setup | None | None | None | None | Fallback questionnaire covering all 8 dimensions |
| Evidence/attribution | None | None | None | None | Session excerpts linked to each dimension |
| Workflow optimization | None | None | Basic flow memory | None | Phase briefs, structured checklists, advisor mode, cross-phase context |
| Privacy controls | N/A (manual file) | N/A (manual file) | Opt-in memories | N/A (manual file) | Opt-in analysis, user messages only, review before activation |

**Key insight from competitive analysis:** No existing tool automatically profiles a developer from their interaction history. All current approaches are either manual (write your own rules file) or implicit (opaque conversation memory). GSD-Plus occupies a unique position: explicit, evidence-based, user-reviewable profiling that feeds into project-level AI configuration.

**Confidence note:** Competitor features are based on training data (up to May 2025). Cursor, Copilot, and Windsurf may have added profiling features since then. LOW confidence on competitor current state. The architectural insight (explicit vs implicit profiling) holds regardless.

## Sources

- GSD codebase analysis: `/Users/canodevelopment/coding-portfolio/get-shit-done/` -- HIGH confidence (primary source, read directly)
- PROJECT.md requirements and constraints: `/Users/canodevelopment/coding-portfolio/get-shit-done/.planning/PROJECT.md` -- HIGH confidence (authoritative project definition)
- Existing GSD workflows (discuss-phase, plan-phase, new-project, verification-patterns): HIGH confidence (read directly)
- Claude Code CLAUDE.md mechanism: MEDIUM confidence (training data, verified by PROJECT.md reference to "Claude Code auto-loads CLAUDE.md from project root")
- Cursor .cursorrules, GitHub Copilot instructions, Windsurf memories: LOW confidence (training data only, could not verify current state with web tools)
- Developer profiling / behavioral analysis patterns: MEDIUM confidence (established domain from IDE analytics tools like WakaTime, Code Climate, LinearB, but applied differently here)

---
*Feature research for: Developer profiling and AI workflow optimization (GSD-Plus)*
*Researched: 2026-02-12*
