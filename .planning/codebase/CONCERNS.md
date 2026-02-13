# Codebase Concerns

**Analysis Date:** 2026-02-12

## Tech Debt

**gsd-verifier missing Write tool (Fixed in unreleased):**
- Issue: `agents/gsd-verifier.md` frontmatter declares `tools: Read, Bash, Grep, Glob` but instructions require creating VERIFICATION.md reports
- Files: `agents/gsd-verifier.md` (line 4)
- Impact: Without Write tool, agent falls back to Bash heredoc (`cat > file << 'EOF'`), which corrupts editor permission files when user approves the output. Settings.local.json receives the entire 200+ line markdown as a single field value, breaking subsequent Claude Code startup with "Settings Error"
- Root cause: Day-one bug in initial agent creation (commit f3f6707, Jan 15, 2026), not a regression
- Fix approach: Add Write to frontmatter tools list. **Note: Fix already staged in unreleased changelog (line 10: "gsd-verifier agent now declares the Write tool...")**
- Severity: HIGH — Blocks phase verification workflow, corrupts editor config

**gsd-tools.js monolithic design:**
- Issue: Single 4,597-line file (`get-shit-done/bin/gsd-tools.js`) handles 60+ commands across state management, phase operations, verification, frontmatter CRUD, templating, and git operations
- Files: `get-shit-done/bin/gsd-tools.js`
- Impact: Difficult to test, debug, and maintain. New command additions risk side effects. No clear separation of concerns
- Fix approach: Break into modules: `lib/state.js`, `lib/phase-ops.js`, `lib/verification.js`, `lib/frontmatter.js`, each with focused 200-400 line scope. Main file becomes router

**Bash heredoc compatibility across platforms:**
- Issue: Heredoc syntax (`cat > file << 'EOF'`) differs between shells and has platform quirks (Windows line endings, shell availability in Docker/CI)
- Files: `bin/install.js` (addressed in v1.18.0 with literal newlines per changelog line 19), but other files may still use heredoc
- Impact: Installation failures on non-standard environments, CI/CD flakiness
- Fix approach: Audit all `.md` and `.js` files for heredoc patterns, replace with `fs.writeFileSync()` in Node.js code and proper shell escaping in bash

**Model profile table lacks opacity/rationale:**
- Issue: `gsd-tools.js` lines 125-137 define MODEL_PROFILES with three tiers (quality, balanced, budget) but no comments explaining selection criteria
- Files: `get-shit-done/bin/gsd-tools.js` (lines 125-137)
- Impact: Maintainers can't easily update profiles for new model releases (e.g., Claude Opus 4.6, future releases). No clear cost/quality trade-off guidance
- Fix approach: Add inline comment block explaining tier selection logic (e.g., "quality: use best available for reasoning-heavy tasks", "budget: use cheapest for simple pattern matching")

---

## Known Bugs

**State file race condition in concurrent phase execution:**
- Symptoms: If two agents call `state advance-plan` simultaneously, both read the same counter value and increment to same number, creating duplicate phase state
- Files: `get-shit-done/bin/gsd-tools.js` (state advance-plan command), `.planning/STATE.md` (shared state)
- Trigger: Rare under normal usage (sequential phase execution), but possible with manual parallel execution or resume workflows
- Current mitigation: Execution orchestrator serializes phases (execute-phase is single-threaded)
- Improvement path: Implement atomic read-modify-write with file locking (Node.js `fs.open()` with 'r+' + flock, or use `.lock` file with CAS pattern)
- Severity: MEDIUM — Unlikely in practice, but causes data corruption if it happens

**DEBUG_DIR cleanup not implemented:**
- Symptoms: `.planning/debug/` directory grows unbounded with old debug sessions after repeated `/gsd:debug` invocations
- Files: `agents/gsd-debugger.md` (defines DEBUG_DIR path but no cleanup logic), workflow that uses it
- Trigger: After 20+ debug sessions, directory may exceed 10MB with repetitive markdown files
- Current mitigation: Manual cleanup required
- Improvement path: Add `gsd-tools debug-cleanup --keep N` command to retain last N sessions, delete others. Call from `/gsd:resume` workflow
- Severity: LOW — Gradual accumulation, no functional impact

**Context window degradation not measurable in real-time:**
- Symptoms: `gsd-planner.md` documents quality degradation curve (lines 74-81: "0-30% PEAK, 30-50% GOOD, 50-70% DEGRADING, 70%+ POOR") but no mechanism to measure actual context usage during execution
- Files: `agents/gsd-planner.md` (lines 74-81), `agents/gsd-executor.md` (task execution)
- Impact: Planner can't validate quality expectations during planning. If Claude exceeds 50%, quality degrades silently
- Fix approach: Add token counting via Claude API usage endpoint (if available) or estimate via character count heuristic (roughly 1 token per 4 chars for English). Report actual vs planned in SUMMARY.md
- Severity: MEDIUM — Affects plan quality but no immediate failure

---

## Security Considerations

**Secrets in .env files not protected by default:**
- Risk: `.env` files in project root are gitignored but may leak if `git add .` used carelessly. GSD doesn't validate .gitignore presence
- Files: `bin/install.js` (installer should validate), workflows that may use `git add .` (gsd-executor.md cautions against it line 246, good)
- Current mitigation: Executor explicitly warns against `git add .` (line 246: "NEVER git add . or git add -A"), uses file-by-file staging
- Recommendations: (1) Installer should verify `.env` in .gitignore or warn if missing, (2) Add pre-commit hook that blocks commits containing `sk-` or `OPENAI_API_KEY=` patterns
- Severity: MEDIUM — Depends on user discipline

**Path traversal risk in gsd-tools file operations:**
- Risk: `gsd-tools.js` accepts file paths from CLI arguments and constructs paths with `path.join()`. No validation that paths stay within project directory
- Files: `get-shit-done/bin/gsd-tools.js` (multiple commands accept `--file`, `--path` args)
- Current mitigation: Execution context is always within project directory (phase paths are enumerated), reducing attack surface
- Recommendations: (1) Add `validateProjectPath(inputPath)` helper that checks `path.relative()` doesn't start with `../`, (2) Never use user paths with `eval()` or shell execution
- Severity: LOW — Requires malicious input, controlled environment

**Credential exposure in gsd-tools websearch:**
- Risk: `gsd-tools.js` line 29 mentions websearch via "Brave API (if configured)". API key likely in env var, could leak in process args or error logs
- Files: `get-shit-done/bin/gsd-tools.js` (websearch command, not yet fully examined)
- Current mitigation: Likely passed via env var (BRAVE_API_KEY or similar), not logged
- Recommendations: Verify websearch never logs raw API key in error output, always mask with `***` in debug output
- Severity: LOW — Standard env var handling

---

## Performance Bottlenecks

**gsd-tools.js file I/O is synchronous:**
- Problem: All file reads use `fs.readFileSync()` (blocking), including large CHANGELOG.md, phase histories in history-digest command
- Files: `get-shit-done/bin/gsd-tools.js` (throughout, especially history-digest line ~200+)
- Cause: Sync I/O simpler to reason about, but blocks entire process. When loading 50+ SUMMARY.md files, perceivable delay (100-500ms)
- Improvement path: (1) Profile current baseline with `time gsd-tools history-digest`, (2) Convert file reads to `fs.promises` for commands that read many files, (3) Batch reads with Promise.all() where safe
- Severity: LOW — Workflow remains responsive (sub-1s), but noticeable on large projects

**Verification scanning for artifacts/key-links uses repeated grep:**
- Problem: `gsd-verifier.md` Step 4-5 (lines 116-217) verifies each artifact/link via grep. With 10+ artifacts, runs 20+ grep commands serially
- Files: `agents/gsd-verifier.md` (verification loops)
- Cause: No aggregation — each artifact checked independently rather than scanning codebase once and matching all patterns
- Improvement path: Aggregate patterns, scan entire codebase once, match all artifacts in one pass. Store results in temporary JSON
- Severity: LOW — Acceptable for typical projects (10-20s max), but scales poorly to 50+ artifacts

**History-digest parses all SUMMARY.md files sequentially:**
- Problem: `gsd-tools.js` history-digest iterates through all phase directories, reads each SUMMARY.md, parses frontmatter. No parallelization
- Files: `get-shit-done/bin/gsd-tools.js` (history-digest command, around lines 200-250)
- Cause: Sequential file reads + YAML parsing. On projects with 30+ phases, could take 5-10 seconds
- Improvement path: Use Promise.all() to read all phase directories in parallel, then parse frontmatter in parallel batches
- Severity: LOW — Runs during planning (acceptable latency), but user perceives slowdown during long projects

---

## Fragile Areas

**Frontmatter parsing without schema validation:**
- Files: `agents/gsd-planner.md`, `agents/gsd-executor.md`, `agents/gsd-verifier.md` (all parse PLAN/SUMMARY/VERIFICATION frontmatter)
- Why fragile: Frontmatter format is documented informally (markdown code blocks), not validated against schema. If user or Claude writes malformed YAML, parsers fail silently or crash
- Safe modification: (1) Define schema files (plan.schema.json, summary.schema.json, verification.schema.json), (2) All parsers use `gsd-tools frontmatter validate --schema plan` before reading, (3) Explicit error on validation failure
- Test coverage: No tests for malformed frontmatter (only happy-path tests in gsd-tools.test.js lines 53-90)
- Severity: MEDIUM — Breaks workflows when frontmatter corrupt

**Agent continuation logic depends on exact git output parsing:**
- Files: `agents/gsd-executor.md` (lines 217-225 continuation handling), commit hash verification
- Why fragile: Continuation agents verify previous commits by parsing `git log --oneline -5` output. If git output format changes or commits are rebased, parser breaks
- Safe modification: Use `git rev-list --format=format:%H --count=1 HASH` instead of parsing output string
- Test coverage: No tests for continuation edge cases (branch rebased, commits squashed, force-pushed)
- Severity: MEDIUM — Rare but breaks phase continuation workflows

**gsd-verifier re-verification loop assumes deterministic must-haves:**
- Files: `agents/gsd-verifier.md` (lines 30-50 re-verification mode, lines 63-97 must-haves)
- Why fragile: Re-verification assumes PLAN frontmatter must_haves don't change. If user updates PLAN after partial verification, verifier re-runs but compares against stale expectations
- Safe modification: Version must_haves in VERIFICATION.md with hash of PLAN section. If plan changed, restart full verification instead of re-verify mode
- Test coverage: No tests for re-verification with plan changes
- Severity: LOW — Requires manual plan edits mid-verification (unusual)

**Installation state not atomic:**
- Files: `bin/install.js` (entire installation flow, lines 1-1739)
- Why fragile: Installation creates directories, writes files, updates git hooks. If process crashes mid-install, leaves partial state (some files written, some not). No uninstall to rollback
- Safe modification: (1) Use transaction log (write manifest of files created before start), (2) On error, rollback using manifest, (3) Add `--force-clean` flag to remove partial installs
- Test coverage: No tests for crash scenarios or partial installs
- Severity: MEDIUM — Users must manually clean up after installation failure

---

## Scaling Limits

**Phase numbering doesn't scale beyond 99.99 phases:**
- Current capacity: Decimal numbering up to 99 main phases, 99 sub-phases each (e.g., 01.01, 01.99, 02.01), max 9,801 phases
- Limit: Roadmapper sorts phases as strings, not numbers. "02.1" sorts after "01.99" correctly, but "10" sorts before "2" (lexicographic), causing breakage at phase 10+
- Scaling path: (1) Change roadmap storage to use numeric sort keys (pad with zeros: "02.01" not "2.1"), (2) Update all phase parsing to handle full range, (3) Test with 100+ phases
- Severity: LOW — Unlikely to hit in practice (99 phases = 6+ months development at typical pace)

**gsd-tools frontmatter merge doesn't handle deep nesting:**
- Current capacity: Frontmatter merge (line ~600 in gsd-tools.js) uses shallow Object.assign(). Nested YAML like `dependency-graph.provides` may not merge correctly with multiple updates
- Limit: After 3-4 phase merges with nested fields, structure corruption possible
- Scaling path: Use deep merge library (lodash.merge or custom recursive merge), validate schema after each merge
- Severity: LOW — Rare in practice (multiple frontmatter merges unusual)

**Verification spans unbounded file scan:**
- Current capacity: Verification grep patterns scale O(n) with codebase size. Large monorepos (100k+ lines) see 10+ second verification times
- Limit: Beyond 500k lines, verification timeout possible (script-level, 30s limit in some environments)
- Scaling path: (1) Add codebase-size check, warn if > 200k lines, (2) Implement Codebase Mapper integration to use existing ARCHITECTURE.md file structure to narrow search scope, (3) Cache grep results
- Severity: LOW — Affects large monorepos, acceptable latency acceptable

---

## Dependencies at Risk

**No runtime dependencies, but dev dependency esbuild can become stale:**
- Risk: `package.json` devDependencies has only `esbuild: ^0.24.0`. Future esbuild versions may have breaking changes to build output
- Impact: Build hooks (gsd-statusline.js, gsd-check-update.js) may fail to compile
- Migration plan: (1) Pin esbuild to specific version (0.24.0 exact), (2) Add CI test that builds hooks on every commit, (3) Quarterly audit for esbuild updates
- Severity: LOW — Compile-time only, caught by CI

**Node.js version requirement is loose:**
- Risk: `package.json` engines requires `node >= 16.7.0` (from 2021). Modern features in gsd-tools.js (e.g., fs.promises used in future refactor) require Node 14+, but async fs requires 15.10+
- Impact: Users on Node 16 LTS (support ending Oct 2023) may hit issues
- Migration plan: (1) Bump minimum to `node >= 18.0.0` (current LTS), (2) Test on CI against both 18 and 20
- Severity: LOW — Supported versions work, but approaching end-of-life

---

## Missing Critical Features

**No automatic rollback for failed phases:**
- Problem: If phase execution fails partway through, user must manually undo commits and file changes. No rollback command
- Blocks: Recovery workflows, rapid iteration on broken phases
- Workaround: Manual `git reset --hard HEAD~N` + file deletion, error-prone
- Priority: MEDIUM — Affects user recovery experience

**No cross-platform testing for agent workflows:**
- Problem: GSD agents tested on macOS in development, Windows behavior may differ (path separators, shell commands, line endings)
- Blocks: Windows/Linux users hit unexpected failures
- Workaround: Manual testing on each platform before release
- Priority: MEDIUM — Affects user experience on non-macOS

**No monitoring/observability for long-running agents:**
- Problem: When executing large phases (100+ tasks), no progress reporting. User sees blank terminal for 30+ minutes
- Blocks: User confidence, perception of hangs
- Workaround: None (users assume it crashed, kill process)
- Priority: MEDIUM — Affects perceived reliability

---

## Test Coverage Gaps

**gsd-tools frontmatter operations lack error path tests:**
- What's not tested: Malformed YAML, missing required fields, schema validation failures
- Files: `get-shit-done/bin/gsd-tools.test.js` (has happy-path tests lines 53-90, no error tests)
- Risk: Production failures when users provide malformed input
- Priority: HIGH

**Agent continuation workflows not tested:**
- What's not tested: Resume after checkpoint, commit hash verification, multi-phase continuation
- Files: `agents/gsd-executor.md` (lines 217-225 define logic, no test coverage)
- Risk: Critical workflow breaks for users who need to resume mid-project
- Priority: HIGH

**Cross-platform installation not tested:**
- What's not tested: Windows path handling, OpenCode config directory resolution, Gemini CLI hooks
- Files: `bin/install.js` (supports three runtimes, only tested on macOS)
- Risk: Installation fails on Windows/Linux
- Priority: MEDIUM

**Verification re-verification mode not tested:**
- What's not tested: Second verification run with gaps, re-verification with plan changes
- Files: `agents/gsd-verifier.md` (lines 30-50 define re-verification, no tests)
- Risk: Verification gaps go undetected or create infinite loops
- Priority: MEDIUM

---

*Concerns audit: 2026-02-12*
