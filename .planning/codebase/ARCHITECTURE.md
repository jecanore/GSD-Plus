# Architecture

**Analysis Date:** 2026-02-12

## Pattern Overview

**Overall:** Modular command-driven orchestration system with decoupled agent-based subprocessing.

**Key Characteristics:**
- Declarative command definitions via markdown frontmatter (`.md` files in `commands/gsd/`)
- Multi-agent spawning for parallel subagent execution with minimal context transfer
- Centralized state management through `gsd-tools.js` CLI utility
- Workflow templates with documented process flows for orchestrators to execute
- Planning document hierarchy: PROJECT.md → ROADMAP.md → PLAN.md → SUMMARY.md
- Installation wrapper that supports multiple runtimes (Claude Code, OpenCode, Gemini)

## Layers

**Installation Layer:**
- Purpose: Bootstrap GSD into multiple runtime environments (Claude, OpenCode, Gemini)
- Location: `bin/install.js`
- Contains: Runtime detection, config directory resolution, setup orchestration
- Depends on: Package.json metadata, home directory config paths
- Used by: NPM install process (bin script in package.json)

**Command Definition Layer:**
- Purpose: Declare CLI commands with metadata (name, description, tools allowed, workflow context)
- Location: `commands/gsd/*.md` (31 command files)
- Contains: YAML frontmatter + execution_context references (@~/.claude/... paths)
- Depends on: Workflow files, reference materials, CLI orchestrator
- Used by: Claude Code/OpenCode to route commands and load context

**Agent Layer:**
- Purpose: Specialized agents spawned for specific tasks (planning, execution, debugging, verification)
- Location: `agents/*.md` (11 agent definitions)
- Contains: Role declarations, tool allowlists, process descriptions, templates
- Depends on: Codebase docs, command contexts, reference materials
- Used by: Orchestrator commands to execute work in parallel or sequentially

**Workflow Layer:**
- Purpose: Document step-by-step orchestration logic for commands to follow
- Location: `get-shit-done/workflows/*.md` (30+ workflow files)
- Contains: Numbered steps, decision gates, error handling, state transitions
- Depends on: Template files, tools, config from loaded STATE.md
- Used by: Command handlers to implement complex multi-step logic

**CLI Utility Layer:**
- Purpose: Centralize state/config parsing, model resolution, git operations, validation
- Location: `get-shit-done/bin/gsd-tools.js` (161KB single file)
- Contains: 40+ atomic commands for state mutation, phase management, verification
- Depends on: File system (CONFIG, STATE, ROADMAP), git, Node.js stdlib
- Used by: Workflows via `node gsd-tools.js <command>` invocations

**Template Layer:**
- Purpose: Pre-filled document templates for consistent planning and execution
- Location: `get-shit-done/templates/codebase/*.md` and `get-shit-done/templates/project.md`
- Contains: STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md templates
- Depends on: Nothing (static templates filled by agents)
- Used by: Mapper agents (codebase analysis), planner, executor

**Test Layer:**
- Purpose: Validate gsd-tools.js functionality
- Location: `get-shit-done/bin/gsd-tools.test.js` (76KB)
- Contains: Unit tests for atomic operations, edge cases
- Depends on: gsd-tools.js implementation
- Used by: npm test during development

**Hooks Layer:**
- Purpose: Post-install hooks and statusline utilities
- Location: `hooks/*.js` (built to `hooks/dist/` during publish)
- Contains: Update checking, statusline rendering for CLI
- Depends on: Nothing (runtime utilities)
- Used by: Shell integrations

## Data Flow

**Project Initialization Flow:**

1. User runs `/gsd:new-project`
2. Command definition (`commands/gsd/new-project.md`) loads workflow
3. Orchestrator executes `workflows/new-project.md` steps
4. Creates `.planning/` directory structure
5. Gathers requirements → calls `gsd-tools.js` to write PROJECT.md, ROADMAP.md, CONFIG.json, STATE.md
6. State persists between invocations via `.planning/STATE.md`

**Phase Planning Flow:**

1. User runs `/gsd:plan-phase 1`
2. Command loads `workflows/plan-phase.md` workflow
3. Orchestrator validates phase via `gsd-tools.js phase find-phase`
4. Optionally spawns `gsd-phase-researcher` for domain research (writes `research/RESEARCH.md`)
5. Spawns `gsd-planner` with codebase docs from `.planning/codebase/`
6. Planner writes `phases/01/PLAN.md` with task list
7. Spawns `gsd-plan-checker` to verify completeness
8. If fails: iterate (replan) until pass or max iterations
9. Commit via `gsd-tools.js commit`

**Phase Execution Flow:**

1. User runs `/gsd:execute-phase 1`
2. Orchestrator discovers all `phases/01/plans/*.md` files
3. Analyzes dependencies to group into execution waves
4. For each wave: spawn parallel `gsd-executor` subagents per plan
5. Each executor loads full context from PLAN.md + codebase docs
6. Executor writes code, runs tests, commits via `gsd-tools.js`
7. After wave completes: orchestrator collects results, updates STATE.md
8. Final wave: run `gsd-verifier` to check all deliverables
9. Route to next phase or completion

**Verification Flow:**

1. After execution, user runs `/gsd:verify-work 1`
2. Orchestrator spawns `gsd-verifier` agent
3. Verifier loads all SUMMARY.md files + VERIFICATION.md template
4. Checks artifacts, key links, regression tests
5. If gaps found: creates VERIFICATION.md with failures → spawns `gsd-debugger`
6. Debugger identifies root causes, proposes fixes
7. Creates gap-closure plans in same phase (plans with `gap_closure: true`)
8. Routes to `/gsd:execute-phase 1 --gaps-only`

**State Management:**

- Configuration stored in: `.planning/config.json` (model profile, branching strategy, workflow flags)
- Project state in: `.planning/STATE.md` (phase progress, decisions, blockers, session tracking)
- Codebase analysis in: `.planning/codebase/*.md` (7 documents from mapper agents)
- Phase documentation in: `.planning/phases/{N}/` (PLAN.md, SUMMARY.md, VERIFICATION.md, research/)
- Git commits log phase completions and state changes

## Key Abstractions

**Command Definition:**
- Purpose: Declarative metadata for CLI routing
- Files: `commands/gsd/*.md`
- Pattern: YAML frontmatter (name, description, allowed-tools, argument-hint) + text body with execution context
- Example: `commands/gsd/map-codebase.md` defines `/gsd:map-codebase` with tool allowlist and workflow reference

**Agent Definition:**
- Purpose: Specialized role with tools, process, templates
- Files: `agents/*.md`
- Pattern: YAML role declaration + markdown process steps + code examples inline
- Example: `agents/gsd-codebase-mapper.md` defines the mapper's role, tool boundaries, document templates

**Workflow Definition:**
- Purpose: Step-by-step orchestration logic
- Files: `get-shit-done/workflows/*.md`
- Pattern: Numbered steps, conditional branches, state mutations via gsd-tools.js, error recovery
- Example: `get-shit-done/workflows/plan-phase.md` orchestrates research → planning → verification loop

**Phase Structure:**
- Purpose: Organize deliverables by phase number
- Location: `.planning/phases/{N}/` (2-zero-padded or decimal phase numbers)
- Contains: PLAN.md, plans/ (individual task PLAN.md files), SUMMARY.md, VERIFICATION.md, research/
- Pattern: Each phase contains multiple executable plans, results collected in SUMMARY.md

**Planning Document:**
- Purpose: Executable specification for work
- Files: `.planning/phases/{N}/PLAN.md` or `.planning/phases/{N}/plans/{M}.md`
- Pattern: YAML frontmatter (phase, plan_number, type, tasks with assumptions) + markdown task descriptions
- Consumed by: gsd-executor, which spawns subagents per task

## Entry Points

**CLI Entry Point:**
- Location: `bin/install.js`
- Triggers: `npm install get-shit-done-cc` or `get-shit-done-cc --global`
- Responsibilities: Detect runtime, set up config directories, install to appropriate location

**Command Entry Point:**
- Location: `commands/gsd/*.md` (31 files)
- Triggers: `/gsd:command-name` in Claude Code/OpenCode chat
- Responsibilities: Parse arguments, load context, reference workflow, pass to orchestrator

**Workflow Entry Point:**
- Location: `get-shit-done/workflows/*.md`
- Triggers: Referenced by command via `@~/.claude/get-shit-done/workflows/...`
- Responsibilities: Orchestrate steps, call gsd-tools.js, spawn agents, handle gates

**Agent Entry Point:**
- Location: `agents/*.md`
- Triggers: Spawned by command or workflow via `<agent-name>` in System prompt
- Responsibilities: Load tools, follow role, write to `.planning/`, return confirmation

**gsd-tools.js Entry Point:**
- Location: `get-shit-done/bin/gsd-tools.js`
- Triggers: `node gsd-tools.js <command> [args]`
- Responsibilities: Parse command, execute operation (state load/save, phase management, validation), output JSON/text

## Error Handling

**Strategy:** Multi-layer validation with fallback to defaults

**Patterns:**
- Phase number normalization via `normalizePhaseName()`: handles both `01` and `1` syntax
- Safe file reads: `safeReadFile()` returns null on error, no throws
- Git operations wrapped: `execGit()` returns exit code + stdout/stderr, allows recovery
- YAML frontmatter parsing: defensive stack-based parser handles nested structures
- Config fallback: missing `.planning/config.json` loads defaults (model_profile='balanced', etc.)
- Path validation: `verify-path-exists` command checks file existence before operations
- Frontmatter validation: schema checking for required fields (phase, plan_number, type)

## Cross-Cutting Concerns

**Logging:** Console output via stdio; verbose mode via `--raw` flag on gsd-tools.js. Test suite uses Node.js test runner.

**Validation:** Frontmatter schemas (plan, summary, verification), phase numbering consistency, artifact verification, key link resolution via gsd-tools.js

**Authentication:** Handled per-runtime (Claude via Claude Code session, OpenCode via `.opencode/` config, Gemini via `.gemini/` config). No application-level auth.

**State Persistence:** All state written to filesystem under `.planning/` (config.json, STATE.md, ROADMAP.md, phases/). Git commits track history. Resumption via STATE.md session continuity fields.

---

*Architecture analysis: 2026-02-12*
