# GSD-Plus

## What This Is

An enhancement to the GSD (Get Shit Done) skill framework that adds developer profiling and workflow optimizations. GSD-Plus analyzes a developer's Claude Code session history to build a behavioral profile, then uses that profile to calibrate Claude's responses across all projects. It also adds advisor mode, phase briefs, structured plan checklists, multi-tool verification, and cross-phase context threading.

## Core Value

Claude should know how a developer works so it doesn't start every conversation blind — the profile system turns 82 sessions of manual pattern extraction into a single command that any GSD user can run.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Command-driven orchestration system with YAML frontmatter commands — existing
- ✓ Multi-agent spawning for parallel subagent execution — existing
- ✓ Centralized state management via gsd-tools.js CLI — existing
- ✓ Workflow templates with documented process flows — existing
- ✓ Planning document hierarchy (PROJECT → ROADMAP → PLAN → SUMMARY) — existing
- ✓ Multi-runtime installation (Claude Code, OpenCode, Gemini CLI) — existing
- ✓ Phase planning, execution, and verification pipeline — existing
- ✓ Codebase mapping with parallel mapper agents — existing
- ✓ Config system with model profiles (quality/balanced/budget) — existing
- ✓ Git-integrated atomic commits and state tracking — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Developer profiling via session history analysis (`/gsd:profile-user`)
- [ ] Questionnaire fallback for profiling when no session data exists
- [ ] USER-PROFILE.md generation with 8 analysis dimensions
- [ ] `/dev-preferences` command generation from profile
- [ ] CLAUDE.md auto-generation from project artifacts + profile
- [ ] Preferences interview in `/gsd:new-project` flow
- [ ] Advisor mode in discuss-phase (research + comparison tables)
- [ ] Phase brief assembly before planning
- [ ] Structured plan checklists (integration, dependency, vendor API, security)
- [ ] Multi-tool automated verification (Playwright, Supabase MCP)
- [ ] Cross-phase context threading via CONTEXT.md `<cross_phase>` section

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time profile updates during sessions — complexity outweighs value; profiles refresh on-demand
- Analyzing Claude's responses (only user messages) — privacy boundary
- Analyzing code content from sessions — privacy boundary; only user messages extracted
- Profile sharing/export between developers — single-developer tool
- Automated A/B testing of profile effectiveness — no infrastructure for measurement

## Context

- **Repo:** `/Users/canodevelopment/coding-portfolio/get-shit-done/` (fork: `github.com/jecanore/GSD-Plus.git`)
- **Installs to:** `~/.claude/` via `node bin/install.js --claude --global`
- **Runtime:** Node.js >=16.7.0, pure vanilla JS, no external dependencies
- **gsd-tools.js:** 4,597-line CLI utility — all new subcommands go here
- **Session data:** JSONL files at `~/.claude/projects/*/` with session indices
- **Prior work:** Manual session analysis across 82 sessions/6 projects proved the concept
- **Key mechanism:** Claude Code auto-loads CLAUDE.md from project root into system prompt — this is how profile-aware instructions persist across sessions

## Constraints

- **Privacy:** Session analysis is opt-in only; only user messages analyzed (not code, not Claude responses)
- **File size:** Some session JSONLs are 7MB+ — gsd-tools.js must extract user messages server-side before passing to agents (~200-500KB)
- **Pattern compatibility:** All new commands/agents must follow existing GSD patterns (YAML frontmatter, workflow steps, agent spawning)
- **Backwards compatibility:** Existing config.json files must merge cleanly with new `preferences` and `profile` keys via `loadConfig()` defaults
- **No external deps:** gsd-tools.js uses only Node.js built-ins; new features must do the same

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Profile stored at `~/.claude/get-shit-done/USER-PROFILE.md` | Global across projects, persists across installs | — Pending |
| `/dev-preferences` as `.md` command file at `~/.claude/commands/` | Claude Code discovers commands by file presence — no symlinks or lock files needed | — Pending |
| 8 analysis dimensions (communication, decision speed, explanation, debugging, UX, vendor, frustration, learning) | Covers the patterns discovered during manual 82-session analysis | — Pending |
| CLAUDE.md template with `{{placeholder}}` markers | Enables auto-generation from project artifacts while allowing manual customization | — Pending |
| Phase brief assembly at Step 7.5 of plan-phase (after research, before planner) | Research must complete before brief can include findings; planner needs brief for context | — Pending |
| Roadmap consolidation check in /gsd:new-project Step 8 | Roadmapper can over-segment; 6 inline heuristics catch thin phases, duplicates, and integration smells before approval | — Pending |

---
*Last updated: 2026-02-12 after initialization*
