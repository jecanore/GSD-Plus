# External Integrations

**Analysis Date:** 2026-02-12

## APIs & External Services

**Package Registry:**
- npm registry - Package hosting and version lookup
  - Used for: Version checks, installation via `npx`
  - Query: `npm view get-shit-done-cc version` executed via `child_process.execSync()`
  - File: `hooks/gsd-check-update.js` line 45

**Web Search (Optional):**
- Brave Search API - Optional enhanced web search
  - SDK/Client: Native fetch via Node.js
  - Auth: Environment variable `BRAVE_API_KEY`
  - Fallback: If not configured, agents fall back to built-in WebSearch tool
  - File: `get-shit-done/bin/gsd-tools.js` - `cmdWebsearch()` function
  - Parameters: query, limit, country (us), search_lang (en)
  - Status: Optional - silent skip if not configured

## Data Storage

**Databases:**
- None detected - Project uses file-based storage only

**File Storage:**
- Local filesystem only
- Storage locations:
  - `~/.claude/` - Claude Code runtime config (Linux/Mac/Windows)
  - `~/.config/opencode/` - OpenCode config (XDG compliant)
  - `~/.gemini/` - Gemini CLI config
- Files stored:
  - `commands/gsd/` - Command definitions (Markdown)
  - `agents/gsd-*.md` - Agent prompts
  - `get-shit-done/` - Core reference materials
  - `hooks/` - Lifecycle hooks (JavaScript)
  - `CHANGELOG.md` - Version history

**Caching:**
- Local cache directory: `~/.claude/cache/` (Claude Code)
- Update check cache: `gsd-update-check.json`
- Manifest: `gsd-file-manifest.json` for file integrity tracking
- Backup location: `gsd-local-patches/` for user modifications

## Authentication & Identity

**Auth Provider:**
- Custom - No centralized auth provider
- Per-runtime configuration stored in:
  - Claude Code: `~/.claude/settings.json`
  - OpenCode: `~/.config/opencode/opencode.json`
  - Gemini: `~/.gemini/settings.json`

**Permission Model:**
- OpenCode: Explicit `permission.read` and `permission.external_directory` entries in `opencode.json`
- Claude Code: Implicit via installed directory
- Gemini: Implicit via installed directory

## Monitoring & Observability

**Error Tracking:**
- None detected - Built-in logging only

**Logs:**
- Console output via colored terminal messages
- Colors: cyan, green, yellow, red, dim, reset (ANSI codes)
- No persistent log files
- Hook execution: Subprocess output suppressed (`stdio: 'ignore'`)
- File: `bin/install.js` lines 9-14 define color constants

## CI/CD & Deployment

**Hosting:**
- npm registry - Primary distribution
- GitHub - Source repository, releases

**CI Pipeline:**
- Not detected in codebase
- Publishing: Manual via npm (configured in `package.json` prepublishOnly hook)
- Test: `npm test` runs `node --test get-shit-done/bin/gsd-tools.test.js`

## Environment Configuration

**Required env vars:**
- None strictly required for basic operation

**Optional env vars:**
- `BRAVE_API_KEY` - Brave Search API key (string)
- `CLAUDE_CONFIG_DIR` - Override Claude config directory
- `OPENCODE_CONFIG_DIR` - Override OpenCode config directory
- `GEMINI_CONFIG_DIR` - Override Gemini config directory
- `XDG_CONFIG_HOME` - XDG Base Directory for OpenCode (Linux)

**Secrets location:**
- None detected - Project does not handle secrets
- Secrets stored in: Runtime-specific `settings.json` files (user-managed)
- Note: `.env` files not committed (present in `.gitignore`)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Hook execution via `child_process.spawn()` for background tasks
- Lifecycle hooks registered in `settings.json`:
  - `hooks.SessionStart` - Runs update check on session start
  - `statusLine` - Statusline command executed per session
- File: `bin/install.js` lines 1437-1502 configure hooks

## Manifest & File Integrity

**File Manifest System:**
- SHA256-based integrity checking
- Purpose: Detect user modifications for patch backup during updates
- Storage: `gsd-file-manifest.json` in config directory
- Contains:
  - Package version
  - Timestamp
  - Files dictionary with filename: hash mappings
- Functions:
  - `generateManifest()` - Recursively hash all GSD files
  - `saveLocalPatches()` - Backup modified files to `gsd-local-patches/`
  - `writeManifest()` - Record file hashes after installation
- File: `bin/install.js` lines 1143-1200

## CLI Argument Processing

**Installation flags:**
- `--global` / `-g` - Install to global config directory
- `--local` / `-l` - Install to local project directory
- `--claude`, `--opencode`, `--gemini`, `--all` - Select runtimes
- `--config-dir` / `-c` - Override config directory path
- `--uninstall` / `-u` - Remove GSD files
- `--force-statusline` - Force statusline replacement
- `--help` / `-h` - Show help

## Inter-Runtime Compatibility

**Frontmatter Conversion:**
- Claude Code → OpenCode: `convertClaudeToOpencodeFrontmatter()`
  - Tool mappings: `allowed-tools` YAML array → `tools` object
  - Color conversion: Color names to hex codes
  - Command prefixes: `/gsd:` → `/gsd-` for flat structure
  - File: `bin/install.js` lines 441-543

- Claude Code → Gemini: `convertClaudeToGeminiAgent()`
  - Tool names: Map to snake_case built-ins
  - Format: YAML array (required by Gemini)
  - Exclusions: MCP tools and Task tool filtered out
  - HTML stripping: `<sub>` tags converted to `*(text)*`
  - File: `bin/install.js` lines 371-439

**Tool Name Mappings:**
- Claude Code standard tools → OpenCode:
  - `AskUserQuestion` → `question`
  - `SlashCommand` → `skill`
  - `TodoWrite` → `todowrite`
  - All others → lowercase
  - File: `bin/install.js` lines 288-327

- Claude Code standard tools → Gemini:
  - `Read` → `read_file`
  - `Write` → `write_file`
  - `Edit` → `replace`
  - `Bash` → `run_shell_command`
  - `Grep` → `search_file_content`
  - `WebSearch` → `google_web_search`
  - `WebFetch` → `web_fetch`
  - File: `bin/install.js` lines 296-309

## Version Checking

**Update Detection:**
- Background process spawned on SessionStart
- Compares installed version (from VERSION file) with npm registry
- Writes result to `~/.claude/cache/gsd-update-check.json`
- No auto-update - Only notification capability
- Timeout: 10 seconds
- File: `hooks/gsd-check-update.js`

## License & Attribution

**Commit Attribution:**
- Optional: Configure custom `Co-Authored-By` line in commits
- Settings: Per-runtime in `settings.json` → `attribution.commit`
- Values:
  - `undefined` or missing - Keep default attribution
  - `""` (empty string) - Remove attribution entirely
  - Custom string - Replace with custom text
- File: `bin/install.js` lines 200-261

---

*Integration audit: 2026-02-12*
