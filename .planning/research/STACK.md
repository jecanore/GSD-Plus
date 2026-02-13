# Stack Research

**Domain:** Developer profiling system and workflow optimizations for a Claude Code skill framework
**Researched:** 2026-02-12
**Confidence:** HIGH (verified against actual session files on disk, running codebase, and Node.js runtime)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js built-ins only | >=16.7.0 (runtime: v22.17.0) | All new code goes in gsd-tools.js | Existing constraint: zero external dependencies. The codebase uses `fs`, `path`, `child_process.execSync`, `crypto`, `os`, and `readline`. No npm packages allowed. |
| Vanilla JavaScript (CommonJS) | ES2017+ | Language for all gsd-tools.js additions | Existing pattern: `require()` imports, no ESM, no TypeScript. The file is 4,597 lines of CJS. Breaking this pattern would fragment the codebase. |

### JSONL Session Parsing

| Approach | Implementation | Purpose | Why Recommended |
|----------|---------------|---------|-----------------|
| `fs.createReadStream` + `readline.createInterface` | Async line-by-line streaming | Parse session JSONL files (up to 7MB+) | **Memory-safe streaming** -- the largest observed session file is 3.6MB (`c5b88276...jsonl`). `fs.readFileSync` on a 7MB file allocates the entire string in memory, then `split('\n')` doubles it. Streaming via readline processes one line at a time. Proven in the codebase: `readline` is already imported in `bin/install.js` (line 6). |
| `JSON.parse()` per line with try/catch | Defensive parsing inside readline `line` event | Extract typed records from JSONL | Each JSONL line is a self-contained JSON object. Some lines may be malformed (incomplete writes on crash). Per-line try/catch is the only safe approach -- do NOT parse the entire file as one JSON array. |
| `sessions-index.json` as primary index | Read JSON file per project directory | Discover sessions and metadata without parsing JSONL | **Critical finding:** Claude Code maintains `sessions-index.json` in project directories (verified at `~/.claude/projects/-Users-...-Boomer-AI/sessions-index.json`). Contains `sessionId`, `fullPath`, `firstPrompt`, `summary`, `messageCount`, `created`, `modified`, `gitBranch`, `projectPath`, `isSidechain`. NOT all projects have this file (GSD project directory lacks it). Must handle both cases. |
| Direct JSONL directory listing as fallback | `fs.readdirSync` + filter `.jsonl` | Discover sessions when no index exists | Some project directories (like the GSD project itself) have JSONL files but no `sessions-index.json`. Fallback: list `*.jsonl` files, stat for size/mtime, and use the JSONL header lines for metadata. |

### Session JSONL Record Schema (Verified)

| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `type` | string | Record discriminator | Values observed: `"user"`, `"assistant"`, `"progress"`, `"system"`, `"file-history-snapshot"` |
| `message.role` | string | Message role | `"user"` or `"assistant"` |
| `message.content` | string or array | Message body | String for simple user messages; array of `{type, text}` objects for rich content |
| `sessionId` | string (UUID) | Session identifier | Consistent across all records in a file |
| `timestamp` | string (ISO 8601) | When the event occurred | Present on all records |
| `uuid` | string (UUID) | Record unique ID | Present on most records |
| `parentUuid` | string or null | Conversation threading | Links records into a tree structure |
| `isMeta` | boolean | Whether this is injected system content | `true` for command expansions (frontmatter-expanded commands) |
| `version` | string | Claude Code CLI version | e.g., `"2.1.37"` |
| `cwd` | string | Working directory at time of message | Absolute path |
| `gitBranch` | string | Active git branch | e.g., `"main"` |
| `userType` | string | Source of user message | `"external"` for actual user input |
| `message.model` | string | Model used (assistant only) | e.g., `"claude-opus-4-6"` |
| `subtype` | string | System record subtype | e.g., `"turn_duration"` with `durationMs` field |

### Behavioral Pattern Analysis

| Approach | Implementation | Purpose | Why Recommended |
|----------|---------------|---------|-----------------|
| Heuristic keyword/pattern matching | Regex + string operations on user messages | Detect communication style, frustration, preferences | LLM-based NLP is impossible without external deps. Heuristics work because the signal patterns are distinctive: ALL CAPS detection, question frequency, imperative vs. collaborative language, message length distribution. The plan's 8 dimensions map to concrete textual signals. |
| Statistical aggregation | Frequency counts, length distributions, timing gaps | Quantify behavioral patterns | Message length histogram reveals explanation preference. Response time gaps reveal decision speed. Command frequency reveals tool comfort. All computable with basic arithmetic. |
| Agent-based deep analysis | Spawn `gsd-user-profiler` agents via Task tool | Full natural language understanding of patterns | The gsd-tools.js extracts raw user messages; the LLM agent (running as Claude) does the actual NLP analysis. This is the correct split: gsd-tools.js handles I/O and filtering, the agent handles comprehension. No NLP library needed in Node.js. |
| Confidence scoring per dimension | Numeric 0.0-1.0 based on evidence count + consistency | Rate reliability of each profiling dimension | Simple formula: `(supporting_signals / total_signals) * (min(sample_size, 20) / 20)`. Implemented in vanilla JS. Dimensions with fewer than 3 signals get LOW confidence automatically. |

### Claude Code Command Discovery

| Mechanism | Implementation | Purpose | Why Recommended |
|-----------|---------------|---------|-----------------|
| `.md` files in `~/.claude/commands/{namespace}/` | Markdown with YAML frontmatter | Define custom slash commands | **Verified on disk**: `~/.claude/commands/gsd/` contains 30+ `.md` files. Each file has frontmatter with `name`, `description`, `argument-hint`, `allowed-tools`. Claude Code discovers these by directory scanning at startup -- placing a file there makes the command available immediately. |
| YAML frontmatter schema | `name`, `description`, `argument-hint`, `allowed-tools` | Command metadata | Verified from `commands/gsd/help.md` and `commands/gsd/new-project.md`. `allowed-tools` is an array of tool names (e.g., `[Read, Write, Bash, Task, AskUserQuestion]`). |
| `<command-message>` and `<command-name>` XML | Auto-injected by Claude Code | How commands appear in session logs | Verified: when user runs `/gsd:help`, the JSONL records `<command-message>gsd:help</command-message>\n<command-name>/gsd:help</command-name>` as user message content. The expanded command (from frontmatter) appears as a subsequent `isMeta: true` user message. |
| Skills directory `~/.claude/skills/` | Directory with `SKILL.md` + optional `references/` | Persistent knowledge modules | Verified: skills use a `SKILL.md` file with frontmatter (`name`, `description`). Skills are symlinked from `~/.agents/skills/` or created directly. A `/dev-preferences` skill would be a directory at `~/.claude/skills/dev-preferences/SKILL.md`. |

### MCP Tool Integration for Verification

| Pattern | Implementation | Purpose | Why Recommended |
|---------|---------------|---------|-----------------|
| Playwright plugin (official) | Enabled via `settings.json` `enabledPlugins` | UI verification (screenshots, element checks) | **Verified enabled** on this machine: `"playwright@claude-plugins-official": true` in `~/.claude/settings.json`. Plugin installed at `~/.claude/plugins/cache/claude-plugins-official/playwright/27d2b86d72da`. Use for visual regression and UI element verification in `gsd-verifier.md`. |
| `.mcp.json` per project | JSON file in project root | Project-specific MCP server configuration | **Verified pattern**: Swaggie project has `.mcp.json` with Supabase (`"type": "http"`, `"url": "https://mcp.supabase.com/mcp"`), Playwright (`"type": "stdio"`, `"command": "npx"`, `"args": ["-y", "@executeautomation/playwright-mcp-server"]`), and Context7. This is the standard pattern for project-level MCP configuration. |
| Supabase MCP (HTTP) | `"type": "http"` with URL | Database verification (schema, RLS, edge functions) | Available as remote MCP server. NOT universally installed -- only present in projects with Supabase. Verification agent must detect MCP availability before attempting use. |
| Graceful MCP detection | Check `.mcp.json` existence + parse available servers | Determine which verification tools are available | **No global MCP config verified.** MCP servers are project-scoped. gsd-tools.js should expose a `detect-mcp` subcommand that reads `.mcp.json` from project root and returns available server names. Verification agent adapts strategy based on what is available. |
| Tool name convention | `mcp__servername__toolname` | How MCP tools appear in Claude Code | Observed pattern: `mcp__context7__resolve-library-id`, `mcp__context7__query-docs`. Playwright tools follow same convention. Agent markdown should reference tools by this pattern. |

### Template Interpolation for CLAUDE.md Generation

| Approach | Implementation | Purpose | Why Recommended |
|----------|---------------|---------|-----------------|
| `{{placeholder}}` markers with `String.replace()` | Simple regex-based template interpolation | Populate CLAUDE.md from project artifacts | The plan specifies `{{placeholder}}` syntax. The codebase already uses `{phase}`, `{slug}`, `{milestone}` interpolation in branch templates (lines 3604-3609 of gsd-tools.js). Use double-braces `{{...}}` to avoid collision with the existing single-brace pattern. Implementation: `template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || fallbacks[key] || '')`. |
| Section-level fallbacks | Default text per template section | Handle missing data sources gracefully | If `research/STACK.md` does not exist, the `{{stack_section}}` placeholder should resolve to a default like `_Stack information not yet available. Run /gsd:research-phase to populate._`. Implement as a `fallbacks` map passed alongside `data`. |
| Source comments (`<!-- Source: ... -->`) | Static HTML comments in template | Enable targeted section updates on phase transitions | Already specified in the plan's CLAUDE.md template. These comments are not interpolated -- they survive generation as-is. The transition workflow reads these comments to know which source files to re-read when updating. |
| Template stored as `.md` file | `get-shit-done/templates/claude-md.md` | Source template for CLAUDE.md generation | Consistent with existing template pattern: `templates/summary-standard.md`, `templates/context.md`, etc. Read via `fs.readFileSync`, interpolate, write to project root. |

### Supporting Node.js Built-in Patterns

| Library | Module | Purpose | When to Use |
|---------|--------|---------|-------------|
| `fs` | `node:fs` | All file I/O (sync and stream) | Reading JSONL (streaming), reading/writing templates (sync), checking file existence |
| `readline` | `node:readline` | Line-by-line JSONL streaming | Parsing large session files. Already used in `install.js`. Create interface on `fs.createReadStream(path)`. |
| `path` | `node:path` | Path manipulation | Joining `~/.claude/projects/*/` paths, resolving home directory. Use `os.homedir()` for `~` expansion. |
| `os` | `node:os` | Home directory resolution | `os.homedir()` to resolve `~/.claude/`. Already used in `install.js`. |
| `child_process` | `node:child_process` | Running external commands | `execSync` for git operations (already used extensively). NOT needed for JSONL parsing. |
| `crypto` | `node:crypto` | Hash generation | Already used in `install.js` for file integrity. Could be used for profile versioning/fingerprinting. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` | Built-in test runner | Already configured: `"test": "node --test get-shit-done/bin/gsd-tools.test.js"`. Add new test cases for profile subcommands here. |
| `esbuild` | Hook bundling (dev dependency only) | Only used for `scripts/build-hooks.js`. Not relevant to gsd-tools.js additions. |

## Installation

```bash
# No new packages needed. Zero external dependencies.
# All new code goes into existing files:
#   - get-shit-done/bin/gsd-tools.js (new subcommands)
#   - commands/gsd/profile-user.md (new command file)
#   - agents/gsd-user-profiler.md (new agent file)
#   - get-shit-done/templates/*.md (new template files)
#   - get-shit-done/references/user-profiling.md (new reference doc)

# Testing:
npm test
# or directly:
node --test get-shit-done/bin/gsd-tools.test.js
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `readline` streaming for JSONL | `fs.readFileSync` + `split('\n')` | Only for files known to be < 100KB. The smallest session JSONL observed is 11KB (`879f8af9...jsonl`), but most are 100KB-3.6MB. Streaming is safer for all cases. |
| `sessions-index.json` for discovery | Parsing every JSONL file header | Only if index does not exist. Index gives `messageCount`, `summary`, `created`, `modified` without opening JSONL files at all -- massive I/O savings when scanning 100+ sessions across 6+ projects. |
| Heuristic + Agent hybrid for profiling | Pure heuristic analysis | Never for full profiling. Heuristics in gsd-tools.js pre-filter and extract; the LLM agent does actual behavioral analysis. Pure heuristics cannot understand nuanced communication style from message text alone. |
| `{{double-brace}}` template syntax | `${template-literal}` or Handlebars | Never. Template literals require `eval()` or `new Function()` -- security risk. Handlebars is an external dependency. Double-brace regex replacement is simple, safe, and collision-free with existing `{single-brace}` patterns. |
| `.mcp.json` detection per project | Global MCP configuration check | Always check project-level `.mcp.json` first. No evidence of a global MCP config file was found in `~/.claude/`. MCP configuration is project-scoped. |
| Playwright plugin (official) | `@executeautomation/playwright-mcp-server` (npm) | The official plugin is already enabled globally via `settings.json`. The npm package version seen in Swaggie's `.mcp.json` is an alternative for per-project setup. Use whichever is available; detect both. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| External NLP libraries (natural, compromise, etc.) | Violates zero-dependency constraint. Would add npm dependencies to a package with `"dependencies": {}`. | Heuristic pre-filtering in gsd-tools.js + LLM agent analysis via Task tool. The LLM IS the NLP engine. |
| `fs.readFileSync` for large JSONL | Memory explosion risk on 3.6MB+ files. readFileSync loads entire file as string, then `split('\n')` creates another copy. Peak memory: ~3x file size. | `fs.createReadStream` + `readline.createInterface` for line-by-line streaming. Peak memory: one line at a time (~2KB typical). |
| `eval()` or `new Function()` for template interpolation | Security vulnerability. Templates may contain user-generated content from profiles. | Simple `String.replace(/\{\{(\w+)\}\}/g, ...)` regex substitution. |
| `sessions-index.json` as sole discovery mechanism | Not all project directories have this file (confirmed: GSD project directory lacks it). Newer or less-used projects may never generate one. | Primary: read `sessions-index.json`. Fallback: `fs.readdirSync` for `*.jsonl` files with `fs.statSync` for metadata. |
| Synchronous JSONL parsing in main thread | Would block the CLI for seconds on large session files. Some session files have 100+ JSONL lines each with embedded content. | Async readline streaming wrapped in a Promise. The `cmdTemplateFill` pattern in gsd-tools.js is sync, but JSONL parsing is a new async-appropriate workload. The CLI `main()` is already `async function main()`. |
| Global `~/.claude/config.json` for MCP detection | File does not exist. There is `settings.json` and `settings.local.json` but neither contains MCP server definitions. | Read `.mcp.json` from project root for MCP server availability. Check `settings.json` `enabledPlugins` for global plugins like Playwright. |
| Handlebars, Mustache, or any template engine | External dependency. Overkill for the simple `{{key}}` replacement needed. | Vanilla JS regex replacement. 3 lines of code vs. adding a dependency. |
| TypeScript | No TypeScript in the codebase. gsd-tools.js is pure JS. No tsconfig. No build step for the main CLI. | Continue with vanilla JS. JSDoc comments if type hints are wanted. |

## Stack Patterns by Variant

**If session files are small (< 100KB):**
- Can use `fs.readFileSync` + `split('\n')` for simplicity
- Still wrap `JSON.parse` per line in try/catch
- Because: simpler code path, no async complexity

**If session files are large (> 500KB, common case):**
- Must use `readline` streaming approach
- Return a Promise that resolves when stream ends
- Because: memory safety, non-blocking I/O

**If `sessions-index.json` exists:**
- Read and parse it directly (`fs.readFileSync` + `JSON.parse`, index files are small)
- Use `entries` array for session metadata (messageCount, summary, created, modified)
- Because: avoids opening every JSONL file just to count messages

**If `sessions-index.json` does NOT exist:**
- List `*.jsonl` files in project directory
- Read first 5 lines of each to extract `sessionId`, `version`, `timestamp`
- Use `fs.statSync` for file size and modification time
- Because: graceful degradation for projects without index

**If Playwright MCP is available:**
- Agent adds screenshot-based verification steps
- Read-only: navigate, screenshot, check element presence
- Because: visual regression detection, UI verification without manual testing

**If no MCP tools available:**
- Agent falls back to file-based verification (check file existence, content patterns)
- Log "MCP tools not available, using file-based verification" in verification report
- Because: verification must work everywhere, MCP is an enhancement not a requirement

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| Node.js `readline` API | Node.js >= 12.0.0 | Well within the >=16.7.0 requirement. `readline.createInterface` on `fs.createReadStream` is stable API since Node 0.x. |
| `fs.createReadStream` | Node.js >= 0.1.x | Core API. No compatibility concerns. |
| `JSON.parse` | All Node.js | JSONL lines are standard JSON. No special parser needed. |
| `sessions-index.json` v1 | Claude Code >= ~2.x | Schema version field: `"version": 1`. Check version field for forward compatibility. If version > 1, log warning but attempt parse. |
| Claude Code JSONL schema | Claude Code 2.1.37 (verified) | Session records include `type`, `message`, `sessionId`, `timestamp`, `uuid`. Schema may evolve -- defensive parsing is essential. |
| `.mcp.json` format | Claude Code >= ~2.x | Supports `"type": "stdio"`, `"type": "http"`, `"type": "sse"`. Standard across MCP ecosystem. |
| YAML frontmatter in `.md` commands | Claude Code >= ~1.x | Standard command discovery mechanism. Stable pattern. |

## Critical Implementation Details

### JSONL Parsing Pipeline

```javascript
// Recommended pattern for gsd-tools.js
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const os = require('os');

async function extractUserMessages(sessionPath, limit = 300) {
  const messages = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(sessionPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (messages.length >= limit) break;
    try {
      const record = JSON.parse(line);
      if (record.type !== 'user') continue;
      if (record.isMeta) continue; // Skip command expansions
      const content = extractContent(record.message);
      if (!content || content.length < 10) continue;
      messages.push({
        content: content.slice(0, 2000),
        timestamp: record.timestamp,
      });
    } catch {
      // Malformed line -- skip silently
    }
  }
  return messages;
}

function extractContent(message) {
  if (!message || !message.content) return null;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
  }
  return null;
}
```

### Session Discovery Pipeline

```javascript
function discoverSessions(claudeDir) {
  const projectsDir = path.join(claudeDir, 'projects');
  const projects = fs.readdirSync(projectsDir).filter(d => {
    return fs.statSync(path.join(projectsDir, d)).isDirectory();
  });

  const allSessions = [];
  for (const proj of projects) {
    const projDir = path.join(projectsDir, proj);
    const indexPath = path.join(projDir, 'sessions-index.json');

    if (fs.existsSync(indexPath)) {
      // Fast path: use index
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        for (const entry of (index.entries || [])) {
          allSessions.push({ ...entry, project: proj, source: 'index' });
        }
      } catch { /* corrupted index -- fall through to scan */ }
    } else {
      // Slow path: scan JSONL files
      const files = fs.readdirSync(projDir).filter(f => f.endsWith('.jsonl'));
      for (const f of files) {
        const fp = path.join(projDir, f);
        const stat = fs.statSync(fp);
        allSessions.push({
          sessionId: path.basename(f, '.jsonl'),
          fullPath: fp,
          messageCount: null, // Unknown without parsing
          created: stat.birthtime.toISOString(),
          modified: stat.mtime.toISOString(),
          project: proj,
          source: 'scan',
        });
      }
    }
  }

  return allSessions.sort((a, b) =>
    new Date(b.modified) - new Date(a.modified)
  );
}
```

### Template Interpolation

```javascript
function interpolateTemplate(template, data, fallbacks = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (data[key] !== undefined && data[key] !== null) return data[key];
    if (fallbacks[key] !== undefined) return fallbacks[key];
    return match; // Leave unresolved placeholders for visibility
  });
}
```

### MCP Detection

```javascript
function detectMcpTools(projectRoot) {
  const mcpPath = path.join(projectRoot, '.mcp.json');
  const tools = { playwright: false, supabase: false, servers: [] };

  // Check project-level MCP
  if (fs.existsSync(mcpPath)) {
    try {
      const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      const servers = mcp.mcpServers || {};
      tools.servers = Object.keys(servers);
      tools.playwright = 'playwright' in servers;
      tools.supabase = 'supabase' in servers;
    } catch { /* malformed .mcp.json */ }
  }

  // Check global Playwright plugin
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const plugins = settings.enabledPlugins || {};
      if (plugins['playwright@claude-plugins-official']) {
        tools.playwright = true;
      }
    } catch { /* malformed settings */ }
  }

  return tools;
}
```

## Sources

- **Session JSONL format** -- Verified by reading actual session files at `~/.claude/projects/-Users-canodevelopment-coding-portfolio-get-shit-done/*.jsonl` (files: `879f8af9...jsonl`, `c13a5d3a...jsonl`). HIGH confidence.
- **sessions-index.json schema** -- Verified by reading `~/.claude/projects/-Users-canodevelopment-coding-portfolio-Boomer-AI/sessions-index.json`. Contains version 1 schema with `entries` array. HIGH confidence.
- **sessions-index.json absence** -- Verified: `~/.claude/projects/-Users-canodevelopment-coding-portfolio-get-shit-done/` has JSONL files but no `sessions-index.json`. Fallback discovery is required. HIGH confidence.
- **Command discovery mechanism** -- Verified by reading `commands/gsd/help.md` and `commands/gsd/new-project.md` frontmatter, and observing `~/.claude/commands/gsd/` directory with 30+ command files. HIGH confidence.
- **Skills directory structure** -- Verified by reading `~/.claude/skills/SEO-GEO-writing/SKILL.md` with frontmatter. HIGH confidence.
- **MCP configuration** -- Verified by reading `~/.claude/settings.json` (Playwright plugin enabled), and `.mcp.json` files in Swaggie and Housing-Base projects. HIGH confidence.
- **Existing codebase patterns** -- Verified by reading `gsd-tools.js` (4,597 lines), `package.json` (zero dependencies), `install.js` (readline usage), and template fill implementation. HIGH confidence.
- **Node.js built-in availability** -- Verified by running `node -e` checks for `readline.createInterface` and `fs.createReadStream`. HIGH confidence.
- **GSD-Plus plan** -- Read from `~/.claude/plans/spicy-sleeping-zephyr.md` (374 lines). Used as requirements source, not as verified technical reference. MEDIUM confidence (plan assumptions need validation during implementation).

---
*Stack research for: GSD-Plus Developer Profiling + Workflow Optimizations*
*Researched: 2026-02-12*
