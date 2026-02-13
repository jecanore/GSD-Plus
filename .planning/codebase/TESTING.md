# Testing Patterns

**Analysis Date:** 2026-02-12

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`)
- Config: None (Node.js native, no config file required)
- Available since Node.js 18.0.0, used for compatibility with Node >=16.7.0 via explicit require

**Assertion Library:**
- `node:assert` (built-in, `assert` and `assert.deepStrictEqual()`)

**Run Commands:**
```bash
npm test                    # Run all tests (invokes get-shit-done/bin/gsd-tools.test.js)
node --test get-shit-done/bin/gsd-tools.test.js  # Run test file directly
```

**Package.json test script:**
```json
{
  "test": "node --test get-shit-done/bin/gsd-tools.test.js"
}
```

## Test File Organization

**Location:**
- Tests co-located with source: `get-shit-done/bin/gsd-tools.test.js` alongside `get-shit-done/bin/gsd-tools.js`
- Test file naming: `*.test.js` suffix (Node.js convention)

**Structure:**
```
get-shit-done/bin/
├── gsd-tools.js          # Main CLI implementation (~2000 lines)
└── gsd-tools.test.js     # Tests (~2034 lines)
```

## Test Structure

**Suite Organization:**
```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('feature-name', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('should do something specific', () => {
    // Arrange
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '...');

    // Act
    const result = runGsdTools('history-digest', tmpDir);

    // Assert
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
  });
});
```

**Key Patterns Observed:**

**Setup/Teardown:**
- `beforeEach()`: Creates temporary directory structure for each test
- `afterEach()`: Cleans up temporary directory with `fs.rmSync(tmpDir, { recursive: true, force: true })`
- Temp directory created via `fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'))`
- All tests isolated in clean filesystem state

**Assertion Pattern:**
```javascript
const result = runGsdTools('command', tmpDir);
assert.ok(result.success, `Command failed: ${result.error}`);

const digest = JSON.parse(result.output);
assert.deepStrictEqual(digest.phases['01'].provides, ['Auth system', 'Database schema']);
assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions');
assert.ok(digest.decisions.some(d => d.decision === 'Use Prisma'), 'Should contain decision');
```

**Test Organization (15 describe blocks):**
1. `history-digest command` - YAML parsing and aggregation
2. `phases list command` - Phase directory enumeration
3. `roadmap get-phase command` - Phase section extraction
4. `phase next-decimal command` - Decimal phase calculation
5. `phase-plan-index command` - Plan indexing and wave grouping
6. `state-snapshot command` - STATE.md parsing
7. `summary-extract command` - SUMMARY.md field extraction
8. `init commands with --include flag` - Context inclusion
9. `roadmap analyze command` - Full roadmap analysis
10. `phase add command` - Adding new phases
11. `phase insert command` - Inserting decimal phases
12. `phase remove command` - Removing and renumbering phases
13. `phase complete command` - Marking phases complete
14. `milestone complete command` - Milestone archiving
15. `validate consistency command` - Consistency checking
16. `progress command` - Progress rendering
17. `todo complete command` - Todo state transitions
18. `scaffold command` - Template generation

## Test Helper Functions

**Test Infrastructure:**
```javascript
// Helper to run gsd-tools command
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create temp directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

## Test Coverage

**Scope:**
- `gsd-tools.js` commands: All major command families covered
- File I/O operations: YAML parsing, frontmatter extraction, file system state
- Edge cases: Malformed files, missing files, gaps in numbering, backward compatibility
- Integration: Multi-phase workflows, renumbering cascades, state synchronization

**Not Tested:**
- Git operations (execGit is mocked implicitly via command isolation)
- Network operations (brave-search not tested)
- Interactive prompts (install.js prompts not covered)
- Hooks (gsd-check-update.js, gsd-statusline.js not tested)
- OpenCode/Gemini conversion logic (complex transformation code in install.js)

**Test Count:** ~70 test cases across 18 describe blocks

**Running Coverage:**
```bash
npm test  # Output shows pass/fail count, test names, and any assertion failures
```

## Test Types

**Unit Tests:**
- Command parsing and YAML extraction: `extractFrontmatter()`, `extractFrontmatter()` indirectly tested
- Output formatting: `progress json`, `progress bar`, `progress table`
- Phase numbering: `phase next-decimal`, `normalizePhaseName()`
- Path operations: phase slugs, phase number padding

**Integration Tests:**
- Multi-command workflows: `phase add` → `roadmap analyze` → `phase remove`
- State synchronization: `phase complete` updates STATE.md and ROADMAP.md
- File system state: Creating phases, adding files, renumbering cascades
- Milestone transitions: `milestone complete` archives and creates MILESTONES.md

**Behavioral Tests:**
- Backward compatibility: Flat arrays vs. nested arrays in frontmatter
- Graceful degradation: Malformed files skipped without crashing
- Consistency checking: Warnings for gaps, orphans, mismatches
- Decimal phase handling: Increments correctly, renumbers siblings

## Common Test Patterns

**Template Pattern:**
```javascript
test('feature behavior', () => {
  // Setup phase directory
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
  fs.mkdirSync(phaseDir, { recursive: true });

  // Create test file with content
  fs.writeFileSync(
    path.join(phaseDir, '01-01-SUMMARY.md'),
    `---
one-liner: Set up Prisma
key-files:
  - prisma/schema.prisma
tech-stack:
  added:
    - prisma
---

# Summary Content
`
  );

  // Execute command
  const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);

  // Assert
  assert.ok(result.success, `Command failed: ${result.error}`);
  const output = JSON.parse(result.output);
  assert.strictEqual(output.one_liner, 'Set up Prisma');
  assert.deepStrictEqual(output.tech_added, ['prisma']);
});
```

**Malformed Input Pattern:**
```javascript
test('malformed SUMMARY.md skipped gracefully', () => {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
  fs.mkdirSync(phaseDir, { recursive: true });

  // Valid file
  fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), `---\nvalid: data\n---\n`);

  // Malformed file (no frontmatter)
  fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), `# Just a heading\n`);

  // Broken YAML
  fs.writeFileSync(path.join(phaseDir, '01-03-SUMMARY.md'), `---\nbroken: [unclosed\n---\n`);

  // Execute — should not crash
  const result = runGsdTools('history-digest', tmpDir);
  assert.ok(result.success, `Command should succeed despite malformed files`);

  const digest = JSON.parse(result.output);
  assert.ok(digest.phases['01'], 'Valid phase should exist');
});
```

**Multi-file State Pattern:**
```javascript
test('removes phase directory and renumbers subsequent', () => {
  // Create 3 phases with files
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `
### Phase 1: Foundation
### Phase 2: Auth
### Phase 3: Features
`);

  const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
  const p2 = path.join(tmpDir, '.planning', 'phases', '02-auth');
  fs.mkdirSync(p1, { recursive: true });
  fs.mkdirSync(p2, { recursive: true });
  fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');

  // Remove phase 2
  const result = runGsdTools('phase remove 2', tmpDir);
  assert.ok(result.success);

  // Verify phase 3 was renumbered to 02
  assert.ok(
    fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features')),
    'phase 3 should be renumbered to 02'
  );
  assert.ok(
    fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-01-PLAN.md')),
    'files should be renumbered'
  );
});
```

## Assertions Used

**Core assertions (from node:assert):**
- `assert.ok(value, message)` - Truthy check
- `assert.strictEqual(actual, expected, message)` - Strict equality (===)
- `assert.deepStrictEqual(actual, expected, message)` - Deep object/array equality
- `assert.throws(fn, message)` - Expects function to throw

**Common assertion patterns:**
```javascript
assert.ok(result.success, `Command failed: ${result.error}`);
assert.strictEqual(output.phase_number, 1, 'phase number correct');
assert.deepStrictEqual(output.directories, ['01-foundation', '02-api'], 'sorted list');
assert.ok(output.includes('text'), 'output contains text');
assert.ok(!fs.existsSync(path), 'file should not exist');
```

## Test Isolation

**Temporal Isolation:**
- Each test gets fresh temp directory (beforeEach)
- No shared state between tests
- Tests can run in any order

**File System Isolation:**
- Uses `os.tmpdir()` for isolated test directories
- Cleans up after each test (afterEach)
- No modification of project files

**Process Isolation:**
- Each command execution via `execSync()` with isolated cwd
- Tests run serially (Node.js test runner default)

## Known Test Limitations

1. **Git operations not tested** - execGit() function in gsd-tools.js is never executed in tests (commands run in isolated temp dirs with no .git)
2. **Interactive prompts not tested** - install.js uses readline for user input, not testable without TTY simulation
3. **Hook execution not tested** - gsd-check-update.js and gsd-statusline.js are separate entry points, not tested
4. **External API calls not tested** - websearch command (Brave API) not tested due to network dependency
5. **OpenCode/Gemini conversion not tested** - install.js conversion logic complex but untested (high risk area)

## Adding New Tests

**Template for new test:**
```javascript
describe('new feature', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('should handle normal case', () => {
    // Setup files
    fs.writeFileSync(path.join(tmpDir, '.planning', 'TEST.md'), 'content');

    // Execute
    const result = runGsdTools('command args', tmpDir);

    // Assert
    assert.ok(result.success, `Failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.field, 'expected value');
  });

  test('should handle edge case', () => {
    // Setup edge case
    // Execute
    // Assert
  });
});
```

**Run after adding:**
```bash
npm test  # Should pass new tests
```
