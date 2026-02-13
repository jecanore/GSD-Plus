# Phase 1: Session Data Pipeline - Research

**Researched:** 2026-02-13
**Domain:** Node.js CLI / JSONL stream parsing / Claude Code session data
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Session Discovery
- Output shows detailed info per project: project name, session count, total size, date range, last active
- When sessions-index.json is missing, notify the user ("Index not found, scanning directory...") and proceed with directory scan fallback
- Table format for humans by default, `--json` flag for machine-readable output
- Summary view by default, `--verbose` flag to list individual sessions per project
- Auto-detect `~/.claude/projects/` directory, `--path` flag to override
- Friendly error when Claude Code isn't installed or no sessions directory exists: "No Claude Code sessions found at ~/.claude/projects. Is Claude Code installed?"
- No health checking of session files -- just report counts and sizes

#### Extraction Output
- Default to whole-project extraction, `--session` flag to target a single session
- `--limit N` flag to cap number of sessions processed (useful for testing or quick scans)

#### Memory Safety
- Show progress indicator during processing: "Processing session 3/12..."
- Corrupted or unreadable files: skip and warn, continue with the rest
- No memory usage stats in output -- 512MB cap is an internal constraint, not user-facing

#### CLI Invocation
- Subcommand pattern matching existing gsd-tools.js: `gsd-tools.js scan-sessions`, `gsd-tools.js extract-messages`
- Human-friendly error messages in plain English
- Standard exit codes: 0=success, 1=error, 2=partial success (some files skipped)
- No dry-run mode -- these are read-only operations, no risk of data loss

#### User Consent & Friendliness
- Two-layer consent: pipeline shows transparency note at runtime AND profile command (Phase 3) handles formal consent
- Reassuring tone at pipeline level: "Reading your session history (read-only, nothing is modified or sent anywhere)..."
- Extracted data written to temp file during processing, auto-cleaned after profiler consumes it -- respects sensitivity of conversation data

### Claude's Discretion
- Filtering/sorting of projects in scan-sessions output (sensible defaults)
- Extraction output format (JSONL vs JSON array -- choose based on memory-safety requirements)
- Fields included per extracted message (choose based on what profiling engine needs downstream)
- Output destination (stdout vs file -- choose based on downstream consumption patterns)

### Deferred Ideas (OUT OF SCOPE)
- Formal consent gate with opt-in/opt-out -- Phase 3 (Profile Activation)
- Questionnaire fallback when user opts out of session analysis -- Phase 2 (Profiling Engine)
</user_constraints>

## Summary

Phase 1 builds two new subcommands for the existing `gsd-tools.js` CLI: `scan-sessions` (discovery) and `extract-messages` (extraction). The primary domain is reading Claude Code's JSONL session files from `~/.claude/projects/`, filtering for genuine user messages, and outputting a structured stream for downstream profiling. The zero-dependency constraint means using only Node.js built-in modules (`fs`, `readline`, `path`, `os`).

Real-world investigation of the actual Claude Code session data on this machine revealed critical implementation details: session files are JSONL where each line is a self-contained JSON object; individual lines can be up to 633KB (assistant responses with large tool outputs); the `sessions-index.json` file is frequently stale (Boomer-AI has 91 files but only 4 indexed); and genuine user messages make up a small fraction of total records (173 user messages across 104 sessions / 242MB in the largest project). The `readline.createInterface` + `fs.createReadStream` pattern processes the entire 242MB housingbase project in 26MB heap memory, well within the 512MB constraint.

The most important design insight is that `sessions-index.json` cannot be trusted as a complete inventory. The directory scan fallback is not a degraded mode -- it is the reliable primary path. When the index exists, it provides useful metadata (summary, messageCount, created, modified, projectPath) that enriches the output, but file discovery must always come from the filesystem.

**Primary recommendation:** Build on the existing gsd-tools.js patterns (subcommand dispatch, `output()`/`error()` functions, `loadConfig()` extension) using only Node.js builtins. Use `readline.createInterface` for line-by-line JSONL streaming. Output JSONL to a temp file (not stdout) for downstream consumption. Always discover sessions from the filesystem, using sessions-index.json only for metadata enrichment.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `readline` | Built-in (v22.17.0) | Line-by-line JSONL streaming | Zero-dependency, memory-efficient, processes 242MB in 26MB heap |
| Node.js `fs` | Built-in | File I/O, directory scanning, temp files | Zero-dependency constraint |
| Node.js `path` | Built-in | Cross-platform path joining | Zero-dependency constraint |
| Node.js `os` | Built-in | `os.tmpdir()` for temp file location, `os.homedir()` for `~/.claude` | Zero-dependency constraint |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `fs.createReadStream` | Built-in | Stream input for readline | Every JSONL file read |
| Node.js `fs.mkdtempSync` | Built-in | Create temp directory for extraction output | extract-messages output |
| Node.js `fs.statSync` | Built-in | File size and timestamps when index missing | Directory scan fallback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| readline | ndjson npm package | Would add a dependency; readline handles JSONL perfectly with zero deps |
| fs.appendFileSync for output | Writable stream | appendFileSync is simpler for sequential writes; streaming unnecessary since we write one line at a time |
| JSON.parse per line | Custom parser | JSON.parse is fast enough; lines are self-contained JSON objects |

**Installation:**
```bash
# No installation needed -- all built-in Node.js modules
```

## Architecture Patterns

### Recommended Code Structure
```
get-shit-done/bin/gsd-tools.js     # Add new commands to existing file
  +-- cmdScanSessions()            # Session discovery command
  +-- cmdExtractMessages()         # Message extraction command
  +-- helpers:
      +-- getSessionsDir()         # Resolve ~/.claude/projects/ with --path override
      +-- scanProjectDir()         # Enumerate JSONL files in a project directory
      +-- readSessionIndex()       # Parse sessions-index.json if present
      +-- mergeSessionMetadata()   # Combine index data with filesystem data
      +-- streamExtractMessages()  # readline-based JSONL line processor
      +-- isGenuineUserMessage()   # Filter logic for user messages
      +-- formatTable()            # Human-readable table output
```

### Pattern 1: Subcommand Registration
**What:** Add `scan-sessions` and `extract-messages` to the existing switch-case in `main()`.
**When to use:** All new CLI commands.
**Example:**
```javascript
// Source: Existing gsd-tools.js main() pattern at line 4227
case 'scan-sessions': {
  const jsonFlag = args.includes('--json');
  const verboseFlag = args.includes('--verbose');
  const pathIdx = args.indexOf('--path');
  const sessionsPath = pathIdx !== -1 ? args[pathIdx + 1] : null;
  await cmdScanSessions(sessionsPath, { json: jsonFlag, verbose: verboseFlag });
  break;
}

case 'extract-messages': {
  const sessionIdx = args.indexOf('--session');
  const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : null;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;
  const projectArg = args[1]; // First positional arg = project directory name
  await cmdExtractMessages(projectArg, { sessionId, limit });
  break;
}
```

### Pattern 2: JSONL Line-by-Line Streaming
**What:** Process JSONL files one line at a time using readline, never loading full file into memory.
**When to use:** All session file reading (both scan and extract).
**Example:**
```javascript
// Source: Node.js readline docs + verified on this machine
const fs = require('fs');
const readline = require('readline');

async function streamExtractMessages(filePath, filterFn) {
  const messages = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
    terminal: false,
  });

  for await (const line of rl) {
    try {
      const record = JSON.parse(line);
      if (filterFn(record)) {
        messages.push(record);
      }
    } catch {
      // Skip malformed lines silently
    }
  }
  return messages;
}
```

### Pattern 3: Output Function Convention
**What:** Use existing `output()` for JSON, `process.stdout.write()` for human-readable table.
**When to use:** All command outputs.
**Example:**
```javascript
// Source: Existing gsd-tools.js output() at line 466
// For --json flag:
output(result, raw);

// For human-readable table (like progress table format):
function formatProjectTable(projects) {
  let out = '';
  out += 'Project'.padEnd(35) + 'Sessions'.padEnd(10) + 'Size'.padEnd(10) + 'Last Active\n';
  out += '-'.repeat(65) + '\n';
  for (const p of projects) {
    out += p.name.padEnd(35) + String(p.sessions).padEnd(10) +
           p.sizeHuman.padEnd(10) + p.lastActive + '\n';
  }
  return out;
}
```

### Pattern 4: Temp File Output for Extraction
**What:** Write extracted messages to a temp file, return the path. Caller is responsible for cleanup.
**When to use:** extract-messages command output.
**Example:**
```javascript
// Source: Node.js fs.mkdtempSync docs + existing test pattern at gsd-tools.test.js line 33
const os = require('os');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pipeline-'));
const outputPath = path.join(tmpDir, 'extracted-messages.jsonl');

// Write messages as JSONL
for (const msg of messages) {
  fs.appendFileSync(outputPath, JSON.stringify(msg) + '\n');
}

// Return path in output for downstream consumption
output({ output_file: outputPath, message_count: messages.length, ... });
```

### Anti-Patterns to Avoid
- **Loading entire JSONL file with fs.readFileSync:** A single 7MB session file parsed with readFileSync + split would use ~50MB. Use readline streaming instead.
- **Trusting sessions-index.json as complete:** Real-world data shows Boomer-AI has 91 files but only 4 indexed. Always discover from filesystem.
- **Filtering only on `type === 'user'`:** Must also check `userType === 'external'`, `isMeta !== true`, and `isSidechain !== true`. Must also filter out `<local-command`, `<command-`, and `<task-notification` content prefixes.
- **Assuming message.content is always a string:** Content can be an array of objects (tool_result items). Array-content messages are system-generated tool responses and should be skipped for user message extraction.
- **Writing extracted data to a persistent location:** The CONTEXT.md specifies temp files for sensitivity. Use `os.tmpdir()`.

## Discretion Recommendations

These are areas where the CONTEXT.md gave Claude discretion. Here are researched recommendations.

### 1. Filtering/Sorting of Projects in scan-sessions Output

**Recommendation:** Sort by `lastActive` descending (most recently used first). No filtering by default -- show all projects. This matches the natural mental model: "What have I been working on?"

### 2. Extraction Output Format: JSONL

**Recommendation:** Use JSONL (one JSON object per line), not a JSON array. Reasons:
- **Memory safety:** JSONL can be written incrementally with `fs.appendFileSync`. A JSON array requires holding all messages in memory or complex bracket management.
- **Streaming compatibility:** Downstream profiler (Phase 2) can read JSONL line-by-line with the same readline pattern.
- **Consistency:** The source data is JSONL. Keeping the same format reduces cognitive overhead.

### 3. Fields Per Extracted Message

**Recommendation:** Include these fields per extracted message, which provide everything the profiling engine needs while keeping output compact:

```json
{
  "sessionId": "uuid",
  "projectPath": "/path/to/project",
  "timestamp": "ISO-8601",
  "content": "truncated user message (max 2000 chars per PIPE-05)"
}
```

Rationale:
- `sessionId`: Enables grouping by session for cross-session analysis
- `projectPath`: Enables per-project analysis and cross-project consistency scoring (PROF-02)
- `timestamp`: Enables recency weighting (PROF-06)
- `content`: The actual message text for behavioral analysis

Excluded fields (not needed for profiling): `uuid`, `parentUuid`, `isSidechain`, `isMeta`, `userType`, `cwd`, `version`, `gitBranch`, `slug`, `message.role`, `thinkingMetadata`, `permissionMode`, `toolUseResult`.

### 4. Output Destination: Temp File

**Recommendation:** Write to a temp file, return the path in JSON output. Reasons:
- **Memory safety:** Avoids buffering all extracted messages in memory for stdout.
- **Downstream consumption:** Phase 2 profiler agent reads a file path, not piped stdout.
- **Sensitivity:** Temp files are auto-cleaned by the OS. The calling workflow can also explicitly clean up.
- **CLI output stays clean:** Progress indicators go to stderr, JSON result goes to stdout with the temp file path.

Output format:
```json
{
  "output_file": "/tmp/gsd-pipeline-xxxx/extracted-messages.jsonl",
  "project": "project-name",
  "sessions_processed": 12,
  "sessions_skipped": 1,
  "messages_extracted": 173,
  "messages_truncated": 5
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL parsing | Custom line splitter or JSON5 parser | `readline.createInterface` + `JSON.parse` | readline handles line boundaries, backpressure, and encoding correctly |
| Temp file management | Custom temp directory with random names | `fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pipeline-'))` | OS-guaranteed unique names, proper permissions, standard cleanup location |
| CLI argument parsing | Custom flag parser | Existing gsd-tools.js `args.indexOf('--flag')` pattern | Consistency with 50+ existing commands; no new dependencies |
| File size formatting | Manual byte-to-human conversion | Simple helper: `(bytes / 1024 / 1024).toFixed(1) + 'MB'` or conditional KB/MB/GB | One-liner, not worth a library |
| UUID validation for session IDs | Regex-based UUID validator | Test with `sessionFile.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/)` | Session files are always UUID-named .jsonl files |

**Key insight:** This phase uses zero external dependencies. Every capability needed is available in Node.js builtins. The existing gsd-tools.js has established patterns for CLI args, output formatting, error handling, and testing. Follow those patterns exactly.

## Common Pitfalls

### Pitfall 1: sessions-index.json is Incomplete
**What goes wrong:** Code relies on the index for session discovery and misses 50-90% of actual sessions.
**Why it happens:** Claude Code only writes the index intermittently. Real-world data shows Boomer-AI has 91 JSONL files but only 4 entries in sessions-index.json.
**How to avoid:** Always discover sessions by scanning the filesystem for `*.jsonl` files. Use sessions-index.json only to enrich metadata (summary, messageCount, created, modified, projectPath) for sessions that happen to be indexed.
**Warning signs:** Test with a project that has no sessions-index.json (like the GSD project itself) and one with an incomplete index.

### Pitfall 2: message.content Can Be an Array
**What goes wrong:** Code assumes `message.content` is always a string. Crashes or silently skips messages.
**Why it happens:** When Claude uses tools, the response cycle creates messages where `content` is an array of `{type: 'tool_result', ...}` objects. These are system-generated, not user-written text.
**How to avoid:** Check `typeof content === 'string'` before processing. Skip array-content messages -- they are tool responses, not genuine user input. Real data shows 89 array-content vs 11 genuine user messages in a single session.
**Warning signs:** `TypeError: content.startsWith is not a function`.

### Pitfall 3: User Messages That Aren't Genuine User Input
**What goes wrong:** Extracting all `type=user` messages includes system-injected messages like command outputs, meta-context, and task notifications.
**Why it happens:** Claude Code wraps many system events as `type=user` messages with `userType=external`. The distinguishing fields are `isMeta`, content prefixes, and `isSidechain`.
**How to avoid:** Apply this filter chain:
1. `type === 'user'` AND `userType === 'external'`
2. `isMeta !== true`
3. `isSidechain !== true`
4. `typeof content === 'string'` (skip array content)
5. Content does NOT start with `<local-command`
6. Content does NOT start with `<command-`
7. Content does NOT start with `<task-notification`
8. Content does NOT start with `<local-command-stdout`
**Warning signs:** Extracted messages contain XML-wrapped system content instead of natural language.

### Pitfall 4: Directory Name to Project Name Mapping is Lossy
**What goes wrong:** Code tries to reconstruct the original project path from the directory name by replacing hyphens with slashes, but hyphens in project names (e.g., `Boomer-AI`, `apartment-property-scraper`) make this ambiguous.
**Why it happens:** Claude Code encodes `/Users/foo/my-project` as `-Users-foo-my-project`, making path separators and literal hyphens indistinguishable.
**How to avoid:** Get the project name from `sessions-index.json` `originalPath` when available. For directory-scan fallback, use the full directory name as the identifier and extract the last segment after the last known path prefix as a display name. Alternatively, read the `cwd` or `projectPath` field from the first JSONL record.
**Warning signs:** Projects with hyphens in their name display incorrectly.

### Pitfall 5: Large Lines Causing Memory Spikes
**What goes wrong:** A single JSONL line can be up to 633KB (assistant responses with tool outputs). Parsing this with `JSON.parse` creates a temporary object that size.
**Why it happens:** Claude Code stores complete tool call results inline in JSONL records.
**How to avoid:** The readline approach already handles this correctly -- it processes one line at a time and discards it. The 512MB limit is safe: even with a 633KB line, `JSON.parse` overhead is ~2-3x the string size, well under limits. For extract-messages, we only keep the filtered user messages, which are small. Verified: processing 242MB (104 files) uses only 26MB heap.
**Warning signs:** None expected with readline approach. Would only matter if using `fs.readFileSync` + `split`.

### Pitfall 6: Exit Code 2 for Partial Success
**What goes wrong:** All errors treated as exit code 1, losing the distinction between total failure and partial success with warnings.
**Why it happens:** The existing `error()` function always exits with code 1.
**How to avoid:** Add a `partialSuccess(result, warnings)` output function that writes to stdout (result) and stderr (warnings) then exits with code 2. This is a locked decision from CONTEXT.md.
**Warning signs:** When processing 10 sessions and 1 is corrupted, the tool exits 1 instead of 2 with results from the other 9.

## Code Examples

Verified patterns from investigation of actual session data on this machine.

### Session File Discovery (Filesystem)
```javascript
// Source: Verified against ~/.claude/projects/ directory structure
function discoverSessions(projectDir) {
  const entries = fs.readdirSync(projectDir);
  const sessions = [];

  for (const entry of entries) {
    // Session files are UUID.jsonl
    if (!entry.endsWith('.jsonl')) continue;
    const sessionId = entry.replace('.jsonl', '');

    const filePath = path.join(projectDir, entry);
    const stat = fs.statSync(filePath);

    sessions.push({
      sessionId,
      filePath,
      size: stat.size,
      modified: stat.mtime,
    });
  }

  return sessions;
}
```

### Session Index Enrichment
```javascript
// Source: Verified against actual sessions-index.json in Boomer-AI project
function enrichFromIndex(sessions, indexPath) {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return sessions; // Index missing or corrupt, return as-is
  }

  const indexMap = new Map();
  for (const entry of (index.entries || [])) {
    indexMap.set(entry.sessionId, entry);
  }

  return {
    originalPath: index.originalPath || null,
    sessions: sessions.map(s => {
      const indexed = indexMap.get(s.sessionId);
      return indexed ? { ...s,
        summary: indexed.summary,
        messageCount: indexed.messageCount,
        created: indexed.created,
        projectPath: indexed.projectPath,
      } : s;
    }),
  };
}
```

### User Message Filter Function
```javascript
// Source: Verified against actual JSONL data across 5 projects
function isGenuineUserMessage(record) {
  if (record.type !== 'user') return false;
  if (record.userType !== 'external') return false;
  if (record.isMeta) return false;
  if (record.isSidechain) return false;

  const content = record.message?.content;
  if (typeof content !== 'string') return false; // Skip array content (tool results)
  if (content.length === 0) return false;

  // Skip system-injected messages
  if (content.startsWith('<local-command')) return false;
  if (content.startsWith('<command-')) return false;
  if (content.startsWith('<task-notification')) return false;

  return true;
}
```

### Message Truncation (PIPE-05)
```javascript
// Source: PIPE-05 requirement - 2000 char limit per message, 300 per batch
function truncateContent(content, maxLen = 2000) {
  if (content.length <= maxLen) return content;
  return content.substring(0, maxLen) + '... [truncated]';
}
```

### Progress Indicator (stderr)
```javascript
// Source: CONTEXT.md locked decision - "Processing session 3/12..."
function showProgress(current, total, sessionId) {
  process.stderr.write(`\rProcessing session ${current}/${total}...`);
}

// Clear progress line when done
function clearProgress() {
  process.stderr.write('\r' + ' '.repeat(50) + '\r');
}
```

### Extract Project Name from Directory or JSONL
```javascript
// Source: Verified against actual data - directory names are lossy
function getProjectName(projectDirName, indexData, firstRecord) {
  // Prefer sessions-index.json originalPath
  if (indexData?.originalPath) {
    return path.basename(indexData.originalPath);
  }

  // Fallback: read from first JSONL record's cwd field
  if (firstRecord?.cwd) {
    return path.basename(firstRecord.cwd);
  }

  // Last resort: use directory name as-is (lossy)
  return projectDirName;
}
```

### loadConfig Extension (PIPE-06)
```javascript
// Source: Existing loadConfig() pattern at gsd-tools.js line 157
// Add to defaults object:
const defaults = {
  // ... existing defaults ...
  preferences: {},
  profile: {
    path: null,
    generated: null,
  },
};

// Add to return object:
return {
  // ... existing fields ...
  preferences: get('preferences') ?? defaults.preferences,
  profile: get('profile') ?? defaults.profile,
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.readFileSync` + `split('\n')` | `readline.createInterface` + `for await...of` | Node.js 10+ (2018), async iterator support Node 12+ | Memory stays flat regardless of file size |
| `fs.mkdtemp` callback | `fs.mkdtempSync` | Available since Node.js 6 | Simpler synchronous temp dir creation |
| Custom arg parsing | Pattern-match with `args.indexOf` | Existing GSD convention | Zero-dependency, consistent with codebase |

**Deprecated/outdated:**
- `readline.createInterface` with event-based `rl.on('line')` pattern: Still works but `for await...of` is cleaner and auto-closes. Both are valid; `for await` is preferred for new code.

## Real-World Data Profile

Key statistics from investigating the actual session data on this machine. This informs implementation limits and test data.

| Metric | Value | Source |
|--------|-------|--------|
| Total projects | 6 | `~/.claude/projects/` directory scan |
| Largest project (by size) | housingbase: 242.4MB, 104 sessions | File system measurement |
| Largest project (by sessions) | housingbase: 104 sessions | File system measurement |
| Largest single session file | 7.0MB | Boomer-AI project |
| Largest single JSONL line | 633KB | apartment-property-scraper project |
| Max genuine user messages in one project | 173 | housingbase (104 sessions) |
| Memory usage for full project extraction | 26MB heap / 112MB RSS | Measured with Node.js v22.17.0 |
| Index completeness (worst case) | 4/91 = 4.4% | Boomer-AI project |
| Index completeness (best case) | 69/74 = 93.2% | apartment-property-scraper |
| Projects without sessions-index.json | 2/6 (33%) | Directory scan |

## Open Questions

1. **How should extract-messages identify which project to extract from?**
   - What we know: Projects are identified by their directory name (e.g., `-Users-canodevelopment-coding-portfolio-Boomer-AI`). The directory name is lossy for display but unique for identification.
   - What's unclear: Should the user pass the full directory name, a partial match, or a project index number?
   - Recommendation: Accept a positional argument that is fuzzy-matched against directory names. If ambiguous, list matches and ask user to be more specific. For `--json` mode, require exact match. This matches the beginner-friendly goal.

2. **Should scan-sessions also report the first JSONL record's timestamp when index is missing?**
   - What we know: Without sessions-index.json, we only have `fs.statSync().mtime` for last-modified. The index provides `created` and `modified` timestamps.
   - What's unclear: Reading the first line of every JSONL file to get a creation timestamp is I/O-expensive for large projects.
   - Recommendation: For the summary view, use `fs.statSync().mtime` as "last active". For `--verbose` mode, optionally read the first JSONL line per session to get the creation timestamp. This balances speed with completeness.

3. **How does the profiler (Phase 2) consume the temp file?**
   - What we know: extract-messages writes JSONL to a temp file and returns the path. Phase 2 profiler needs to read this file.
   - What's unclear: Whether the profiler reads the file directly or whether Phase 3's orchestrator manages the lifecycle.
   - Recommendation: Document the contract: extract-messages outputs `{ output_file: "path" }` in its JSON result. The caller is responsible for reading the file and cleaning up the temp directory. The temp directory name includes `gsd-pipeline-` prefix for identifiability.

## Sources

### Primary (HIGH confidence)
- **Actual Claude Code session data** - Directly examined `~/.claude/projects/` on this machine. Verified JSONL format, message types, field names, file sizes, directory structure, and sessions-index.json format. All code examples verified against real data.
- **Existing gsd-tools.js** - Read the entire source file. Verified CLI patterns (subcommand dispatch, `output()`/`error()` functions, `loadConfig()`, argument parsing, test structure).
- **Node.js readline documentation** - https://nodejs.org/api/readline.html - Verified `createInterface` API, `for await...of` pattern, `crlfDelay: Infinity` option, memory behavior.
- **Node.js fs documentation** - `mkdtempSync`, `createReadStream`, `statSync`, `appendFileSync` APIs verified.

### Secondary (MEDIUM confidence)
- **Node.js JSONL streaming patterns** - Multiple verified sources confirm `readline.createInterface` + `fs.createReadStream` as the standard zero-dependency approach for JSONL processing.
- **Temp file best practices** - `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` pattern verified across multiple Node.js documentation sources.

### Tertiary (LOW confidence)
- None. All findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Node.js builtins, verified against actual runtime (v22.17.0)
- Architecture: HIGH - Follows verified existing gsd-tools.js patterns exactly
- Session data format: HIGH - Directly examined actual JSONL files on this machine
- Pitfalls: HIGH - Every pitfall discovered from real data investigation, not hypothetical
- Memory safety: HIGH - Measured actual memory usage (26MB heap for 242MB input)

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- Node.js builtins don't change; Claude Code session format is unlikely to change drastically)
