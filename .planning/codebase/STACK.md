# Technology Stack

**Analysis Date:** 2026-02-12

## Languages

**Primary:**
- JavaScript (Node.js) - All CLI, installation, and hook scripts
- Markdown - Agent prompts, command definitions, documentation

**Secondary:**
- Bash - Optional shell scripting for manual operations

## Runtime

**Environment:**
- Node.js >=16.7.0

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- No framework dependencies - Pure Node.js
- System is built on vanilla JavaScript using Node built-ins

**Build/Dev:**
- esbuild ^0.24.0 - Hook bundling

## Key Dependencies

**Critical:**
- `child_process` (Node built-in) - Process execution for hooks and subprocess management
- `fs` (Node built-in) - File system operations for config management
- `path` (Node built-in) - Path resolution across platforms
- `crypto` (Node built-in) - SHA256 hashing for file manifest integrity checks
- `readline` (Node built-in) - Interactive CLI prompts during installation
- `os` (Node built-in) - OS detection, home directory resolution

**Build:**
- esbuild ^0.24.0 - Bundles hooks from source to `hooks/dist/`

## Configuration

**Environment:**
- `.env` patterns detected but NOT required for basic operation
- Optional: `BRAVE_API_KEY` - For Brave Search API integration (optional web search)
- Optional: `CLAUDE_CONFIG_DIR` - Custom Claude Code config directory
- Optional: `OPENCODE_CONFIG_DIR` - Custom OpenCode config directory
- Optional: `GEMINI_CONFIG_DIR` - Custom Gemini CLI config directory
- Optional: `XDG_CONFIG_HOME` - Linux XDG Base Directory spec (used by OpenCode)

**Build:**
- Build process defined in `/Scripts/build-hooks.js`
- Run: `npm run build:hooks` before publish
- Hooks source: `hooks/gsd-check-update.js`, `hooks/gsd-statusline.js`
- Output: `hooks/dist/` (bundled, then distributed)

## Platform Requirements

**Development:**
- Node.js >=16.7.0
- npm (for development and testing)

**Installation:**
- Mac, Windows, Linux support confirmed
- Cross-platform path handling: Uses forward slashes with `path.replace(/\\/g, '/')`
- Special handling for each runtime:
  - Claude Code: `~/.claude/`
  - OpenCode: `~/.config/opencode/` (XDG compliant)
  - Gemini CLI: `~/.gemini/`

**Production Deployment:**
- npm registry: Published as `get-shit-done-cc` package
- Installation: `npx get-shit-done-cc@latest`
- No external service dependencies for core functionality
- Optional: Brave Search API for enhanced web search

## Key Integrations with Runtimes

**Claude Code:**
- Config directory: `~/.claude/`
- Hooks registered via `settings.json` → `hooks.SessionStart`
- Statusline: Custom command output via `settings.statusLine`
- Commands: `commands/gsd/*.md` nested structure
- Agents: `agents/gsd-*.md` with Claude Code frontmatter format

**OpenCode:**
- Config directory: `~/.config/opencode/` (XDG Base Directory)
- Hooks not used (OpenCode has different hook system)
- Permissions: `opencode.json` with `permission.read` and `permission.external_directory`
- Commands: `command/gsd-*.md` flat structure (converted from nested)
- Agents: Converted to OpenCode format with `tools: {toolname: true}` object notation
- Config parsing: JSONC (JSON with Comments) support via inline parser

**Gemini CLI:**
- Config directory: `~/.gemini/`
- Hooks registered via `settings.json` → `hooks.SessionStart`
- Commands: `commands/gsd/*.md` converted to `.toml` format
- Agents: Converted to Gemini format with `tools: [array]` structure
- Tool names: Mapped to snake_case built-in names (`read_file`, `run_shell_command`, etc.)
- Experimental: `settings.experimental.enableAgents = true` required

## Data Persistence

**Local Configuration:**
- `settings.json` - Per-runtime settings, hooks, statusline config
- File manifest: `gsd-file-manifest.json` - SHA256 hashes for integrity checks
- Local patches: `gsd-local-patches/` - Backup of user-modified GSD files during updates

**Cache:**
- Update check: `~/.claude/cache/gsd-update-check.json` - Version comparison results
- TTL: Implicit (re-checked on session start)

## Version Management

**Package versioning:**
- Defined in `package.json` - Version 1.18.0 at analysis time
- VERSION file written to each runtime config: `{config}/get-shit-done/VERSION`
- Update check: Background process queries `npm view get-shit-done-cc version`
- Patch persistence: User modifications backed up before clean install

## Build and Distribution

**Published to:**
- npm registry as `get-shit-done-cc`
- Installation via: `npx get-shit-done-cc@latest`

**Files included in distribution:**
- `bin/install.js` - Main installer
- `commands/gsd/` - Command definitions
- `agents/` - GSD agent prompts
- `get-shit-done/` - Core skill/reference material
- `hooks/dist/` - Compiled hooks
- `scripts/` - Build utilities
- `CHANGELOG.md` - Version history

---

*Stack analysis: 2026-02-12*
