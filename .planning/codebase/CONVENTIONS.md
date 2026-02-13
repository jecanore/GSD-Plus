# Coding Conventions

**Analysis Date:** 2026-02-12

## Naming Patterns

**Files:**
- Executable scripts use `.js` extension with `#!/usr/bin/env node` shebang: `gsd-tools.js`, `gsd-statusline.js`, `gsd-check-update.js`
- Markdown documentation uses `.md` extension, typically lowercase with hyphens: `verification-report.md`, `verification-patterns.md`
- Test files follow Node.js convention: `gsd-tools.test.js` (using `.test.js` suffix)
- Configuration files are named precisely: `config.json`, `settings.json`, `package.json`

**Functions:**
- camelCase for regular functions: `loadConfig()`, `execGit()`, `extractFrontmatter()`, `reconstructFrontmatter()`, `parseIncludeFlag()`
- PascalCase for classes/constructors (not prevalent in codebase)
- Helper functions prefixed with lowercase descriptive verb: `safeReadFile()`, `expandTilde()`, `buildHookCommand()`, `verifyInstalled()`
- Private-like functions (not exported) use camelCase with no prefix: `cleanupOrphanedFiles()`, `handleStatusline()`, `reportLocalPatches()`

**Variables:**
- camelCase for all variables: `tmpDir`, `isGlobal`, `selectedRuntimes`, `configPath`, `targetDir`, `settingsPath`
- Boolean flags prefixed with `is`, `has`, `should`: `isGlobal`, `hasGlobal`, `shouldInstallStatusline`, `hasOrphaned`, `isOpencode`
- Array variables use plural: `runtimes`, `orphanedHooks`, `modified`, `failures`, `results`
- Constants use UPPER_SNAKE_CASE: `MODEL_PROFILES`, `PATCHES_DIR_NAME`, `MANIFEST_NAME`
- Map/Set objects named descriptively: `attributionCache`, `colorNameToHex`, `claudeToOpencodeTools`, `claudeToGeminiTools`

**Types/Paths:**
- Phase identifiers with padded numbers: `01`, `02`, `03` (see `normalizePhaseName()` function)
- Decimal phases: `06.1`, `06.2` (for inserted phases)
- Directory slugs use lowercase with hyphens: `01-foundation`, `02-api`, `03-feature` (phase names derived from `generateSlug()`)
- Environment variable names use UPPER_SNAKE_CASE: `CLAUDE_CONFIG_DIR`, `GEMINI_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG`

## Code Style

**Formatting:**
- No linting or formatting tool configured (eslint, prettier, etc. not present)
- Indentation: 2 spaces consistently throughout all files
- Line endings: Unix (LF) format in `.js` files
- Line length: ~100 characters (some longer lines for complex logic, but generally kept readable)

**Linting:**
- Not applicable—no linting config present (`package.json` contains no eslint/prettier devDependencies)
- Code follows conventional Node.js practices:
  - const/let (no var)
  - Standard error handling (try/catch)
  - Consistent arrow function usage
  - Template literals for string interpolation

**Comments:**
- JSDoc-style block comments at function definitions: `/** * Description here */`
- Inline comments with `//` for complex logic sections
- Section separators using `// ─── Section Name ───────────────────────────────`
- File headers with `/**...*/` describing module purpose and command list: See `gsd-tools.js` header (lines 1–117)
- No TypeScript or JSDoc type annotations (runtime validation used instead)

## Import Organization

**Order:**
1. Node.js built-in modules first: `const fs = require('fs');`, `const path = require('path');`, `const { execSync } = require('child_process');`
2. Relative local imports (none in bin scripts, internal functions loaded inline)
3. All imports at top of file, no lazy requires

**Path Aliases:**
- Not used (no `tsconfig.json` or bundler config)
- Relative paths use standard Node.js: `path.join(__dirname, '..')`, `path.join(cwd, '.planning')`
- Absolute paths with `path.join(os.homedir(), '.claude')` for user home directory

## Error Handling

**Patterns:**
- try/catch blocks wrap risky operations (file I/O, JSON parsing, exec calls): See `loadConfig()` (lines 173–207)
- Catch blocks silently return defaults/null rather than throw: `} catch { return null; }`
- Functions return structured error objects with `{ exitCode, stdout, stderr }`: See `execGit()` (lines 222–241)
- Process exit codes: `process.exit(0)` for success, `process.exit(1)` for failure
- Error messages use terminal color codes: `${yellow}Error message${reset}`
- No console logging in library functions (logged in callers/CLIs only)
- Validation returns boolean: `verifyInstalled()`, `verifyFileInstalled()` return true/false

**Examples from codebase:**

```javascript
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function loadConfig(cwd) {
  const defaults = { /* ... */ };
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // ... extraction logic
    return parsed;
  } catch {
    return defaults;
  }
}

function execGit(cwd, args) {
  try {
    const escaped = args.map(a => /* ... */);
    const stdout = execSync('git ' + escaped.join(' '), { /* ... */ });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}
```

## Logging

**Framework:** console (built-in, no external logger)

**Patterns:**
- Console output uses ANSI color codes:
  - `cyan = '\x1b[36m'` for section headers
  - `green = '\x1b[32m'` for success messages
  - `yellow = '\x1b[33m'` for warnings
  - `dim = '\x1b[2m'` for secondary text
  - `reset = '\x1b[0m'` to reset styling
- Format: `console.log(`  ${color}symbol${reset} message`);`
- Structured output for CLI commands: JSON when `--raw` flag used, formatted text otherwise
- All terminal output prefixed with 2 spaces for alignment: `  ${green}✓${reset} Message`

**Examples:**
```javascript
console.log(`  ${green}✓${reset} Installed ${count} commands to command/`);
console.log(`  ${yellow}⚠${reset} Skipping statusline (already configured)`);
console.log(`  ${dim}${f}${reset}`);
```

## Function Design

**Size:**
- Functions typically 20–40 lines (reasonable boundaries)
- Large functions broken into logical sections with comments
- Example: `install()` function is ~220 lines (acceptable for CLI setup code)
- Utility functions kept to 10–20 lines

**Parameters:**
- Positional parameters for required inputs: `function install(isGlobal, runtime)`
- Options objects used for flag parsing: `parseIncludeFlag(args)` extracts flags from array
- Named parameters via object destructuring not used (simple parameter lists preferred)

**Return Values:**
- Primitives (boolean, string, number): single-value returns
- Structured data: return objects with named fields: `{ exitCode, stdout, stderr }`
- Null for missing resources: `return null` when file not found
- Arrays for collections: `return modified` (array of file paths)

## Module Design

**Exports:**
- No explicit module.exports in bin scripts (scripts run as CLI entry points)
- Functions are script-scoped, not exported (monolithic bin files, ~2000 lines each)
- Each bin script is self-contained: `gsd-tools.js`, `install.js`, `gsd-check-update.js`, `gsd-statusline.js`

**Patterns within files:**
- Constants at top (MODEL_PROFILES, colorNameToHex, mappings)
- Helper functions next (utilities like safeReadFile, expandTilde)
- Complex logic functions grouped by feature (loadConfig, execGit, frontmatter parsing)
- Main entry point at end (CLI argument parsing and function dispatch)

**Architectural approach:**
- Single-file modules with all related functions (no separation into multiple files for CLI tools)
- Rationale: These are installed globally/locally as complete units
- Libraries are self-documenting at top (example: `gsd-tools.js` header lists all commands)

## Frontmatter Handling

**YAML parsing:**
- Custom YAML parser implemented inline (lines 252–325 in `gsd-tools.js`)
- Supports nested objects and arrays without external dependency
- Handles edge cases: empty values, inline arrays, indentation-based nesting
- Returns plain objects (not typed)

**Reconstruction:**
- Custom YAML generator (lines 327–389 in `gsd-tools.js`)
- Preserves formatting (inline arrays for short lists, block arrays for long)
- Quotes values containing `:` or `#` (YAML special characters)

## Platform Compatibility

**Cross-platform considerations:**
- Path separators handled via `path` module (Windows backslash → forward slash)
- Forward slashes used in command strings: `path.replace(/\\/g, '/')`
- Environment variables checked with `process.env`
- Process spawning uses `detached: true` on Windows for proper cleanup
- Terminal output works on all platforms (ANSI codes supported)

**Node.js version:**
- `package.json` specifies `engines: { "node": ">=16.7.0" }`
- Uses modern ES2020+ features safely (const/let, destructuring, async/await not heavily used)
- No ES modules (CommonJS require used throughout)
