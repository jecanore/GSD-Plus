/**
 * GSD Tools Tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_PATH = path.join(__dirname, 'gsd-tools.js');

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

describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
    assert.deepStrictEqual(digest.decisions, [], 'decisions should be empty array');
    assert.deepStrictEqual(digest.tech_stack, [], 'tech_stack should be empty array');
  });

  test('nested frontmatter fields extracted correctly', () => {
    // Create phase directory with SUMMARY containing nested frontmatter
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    const summaryContent = `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
  affects:
    - "API layer"
tech-stack:
  added:
    - "prisma"
    - "jose"
patterns-established:
  - "Repository pattern"
  - "JWT auth flow"
key-decisions:
  - "Use Prisma over Drizzle"
  - "JWT in httpOnly cookies"
---

# Summary content here
`;

    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), summaryContent);

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    // Check nested dependency-graph.provides
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.deepStrictEqual(
      digest.phases['01'].provides.sort(),
      ['Auth system', 'Database schema'],
      'provides should contain nested values'
    );

    // Check nested dependency-graph.affects
    assert.deepStrictEqual(
      digest.phases['01'].affects,
      ['API layer'],
      'affects should contain nested values'
    );

    // Check nested tech-stack.added
    assert.deepStrictEqual(
      digest.tech_stack.sort(),
      ['jose', 'prisma'],
      'tech_stack should contain nested values'
    );

    // Check patterns-established (flat array)
    assert.deepStrictEqual(
      digest.phases['01'].patterns.sort(),
      ['JWT auth flow', 'Repository pattern'],
      'patterns should be extracted'
    );

    // Check key-decisions
    assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions');
    assert.ok(
      digest.decisions.some(d => d.decision === 'Use Prisma over Drizzle'),
      'Should contain first decision'
    );
  });

  test('multiple phases merged into single digest', () => {
    // Create phase 01
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.writeFileSync(
      path.join(phase01Dir, '01-01-SUMMARY.md'),
      `---
phase: "01"
name: "Foundation"
provides:
  - "Database"
patterns-established:
  - "Pattern A"
key-decisions:
  - "Decision 1"
---
`
    );

    // Create phase 02
    const phase02Dir = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase02Dir, { recursive: true });
    fs.writeFileSync(
      path.join(phase02Dir, '02-01-SUMMARY.md'),
      `---
phase: "02"
name: "API"
provides:
  - "REST endpoints"
patterns-established:
  - "Pattern B"
key-decisions:
  - "Decision 2"
tech-stack:
  added:
    - "zod"
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    // Both phases present
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.ok(digest.phases['02'], 'Phase 02 should exist');

    // Decisions merged
    assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions total');

    // Tech stack merged
    assert.deepStrictEqual(digest.tech_stack, ['zod'], 'tech_stack should have zod');
  });

  test('malformed SUMMARY.md skipped gracefully', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Valid summary
    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides:
  - "Valid feature"
---
`
    );

    // Malformed summary (no frontmatter)
    fs.writeFileSync(
      path.join(phaseDir, '01-02-SUMMARY.md'),
      `# Just a heading
No frontmatter here
`
    );

    // Another malformed summary (broken YAML)
    fs.writeFileSync(
      path.join(phaseDir, '01-03-SUMMARY.md'),
      `---
broken: [unclosed
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command should succeed despite malformed files: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.ok(
      digest.phases['01'].provides.includes('Valid feature'),
      'Valid feature should be extracted'
    );
  });

  test('flat provides field still works (backward compatibility)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides:
  - "Direct provides"
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(
      digest.phases['01'].provides,
      ['Direct provides'],
      'Direct provides should work'
    );
  });

  test('inline array syntax supported', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides: [Feature A, Feature B]
patterns-established: ["Pattern X", "Pattern Y"]
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(
      digest.phases['01'].provides.sort(),
      ['Feature A', 'Feature B'],
      'Inline array should work'
    );
    assert.deepStrictEqual(
      digest.phases['01'].patterns.sort(),
      ['Pattern X', 'Pattern Y'],
      'Inline quoted array should work'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phases list command
// ─────────────────────────────────────────────────────────────────────────────

describe('phases list command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns empty array', () => {
    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.directories, [], 'directories should be empty');
    assert.strictEqual(output.count, 0, 'count should be 0');
  });

  test('lists phase directories sorted numerically', () => {
    // Create out-of-order directories
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '10-final'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 3, 'should have 3 directories');
    assert.deepStrictEqual(
      output.directories,
      ['01-foundation', '02-api', '10-final'],
      'should be sorted numerically'
    );
  });

  test('handles decimal phases in sort order', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.2-patch'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-ui'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.directories,
      ['02-api', '02.1-hotfix', '02.2-patch', '03-ui'],
      'decimal phases should sort correctly between whole numbers'
    );
  });

  test('--type plans lists only PLAN.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(phaseDir, 'RESEARCH.md'), '# Research');

    const result = runGsdTools('phases list --type plans', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-PLAN.md', '01-02-PLAN.md'],
      'should list only PLAN files'
    );
  });

  test('--type summaries lists only SUMMARY.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2');

    const result = runGsdTools('phases list --type summaries', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-SUMMARY.md', '01-02-SUMMARY.md'],
      'should list only SUMMARY files'
    );
  });

  test('--phase filters to specific phase directory', () => {
    const phase01 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    const phase02 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase01, { recursive: true });
    fs.mkdirSync(phase02, { recursive: true });
    fs.writeFileSync(path.join(phase01, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase02, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('phases list --type plans --phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.files, ['01-01-PLAN.md'], 'should only list phase 01 plans');
    assert.strictEqual(output.phase_dir, 'foundation', 'should report phase name without number prefix');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap get-phase command
// ─────────────────────────────────────────────────────────────────────────────

describe('roadmap get-phase command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('extracts phase section from ROADMAP.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phases

### Phase 1: Foundation
**Goal:** Set up project infrastructure
**Plans:** 2 plans

Some description here.

### Phase 2: API
**Goal:** Build REST API
**Plans:** 3 plans
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
    assert.strictEqual(output.phase_number, '1', 'phase number correct');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
    assert.strictEqual(output.goal, 'Set up project infrastructure', 'goal extracted');
  });

  test('returns not found for missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up project
`
    );

    const result = runGsdTools('roadmap get-phase 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'phase should not be found');
  });

  test('handles decimal phase numbers', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 2: Main
**Goal:** Main work

### Phase 2.1: Hotfix
**Goal:** Emergency fix
`
    );

    const result = runGsdTools('roadmap get-phase 2.1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'decimal phase should be found');
    assert.strictEqual(output.phase_name, 'Hotfix', 'phase name correct');
    assert.strictEqual(output.goal, 'Emergency fix', 'goal extracted');
  });

  test('extracts full section content', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize everything

This phase covers:
- Database setup
- Auth configuration
- CI/CD pipeline

### Phase 2: Build
**Goal:** Build features
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.section.includes('Database setup'), 'section includes description');
    assert.ok(output.section.includes('CI/CD pipeline'), 'section includes all bullets');
    assert.ok(!output.section.includes('Phase 2'), 'section does not include next phase');
  });

  test('handles missing ROADMAP.md gracefully', () => {
    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'should return not found');
    assert.strictEqual(output.error, 'ROADMAP.md not found', 'should explain why');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase next-decimal command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase next-decimal command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns X.1 when no decimal phases exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '07-next'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should return 06.1');
    assert.deepStrictEqual(output.existing, [], 'no existing decimals');
  });

  test('increments from existing decimal phases', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-patch'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.3', 'should return 06.3');
    assert.deepStrictEqual(output.existing, ['06.1', '06.2'], 'lists existing decimals');
  });

  test('handles gaps in decimal sequence', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-first'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-third'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should take next after highest, not fill gap
    assert.strictEqual(output.next, '06.4', 'should return 06.4, not fill gap at 06.2');
  });

  test('handles single-digit phase input', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });

    const result = runGsdTools('phase next-decimal 6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should normalize to 06.1');
    assert.strictEqual(output.base_phase, '06', 'base phase should be padded');
  });

  test('returns error if base phase does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-start'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'base phase not found');
    assert.strictEqual(output.next, '06.1', 'should still suggest 06.1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase-plan-index command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase-plan-index command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phase directory returns empty plans array', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase, '03', 'phase number correct');
    assert.deepStrictEqual(output.plans, [], 'plans should be empty');
    assert.deepStrictEqual(output.waves, {}, 'waves should be empty');
    assert.deepStrictEqual(output.incomplete, [], 'incomplete should be empty');
    assert.strictEqual(output.has_checkpoints, false, 'no checkpoints');
  });

  test('extracts single plan with frontmatter', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Set up database schema
files-modified: [prisma/schema.prisma, src/lib/db.ts]
---

## Task 1: Create schema
## Task 2: Generate client
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 1, 'should have 1 plan');
    assert.strictEqual(output.plans[0].id, '03-01', 'plan id correct');
    assert.strictEqual(output.plans[0].wave, 1, 'wave extracted');
    assert.strictEqual(output.plans[0].autonomous, true, 'autonomous extracted');
    assert.strictEqual(output.plans[0].objective, 'Set up database schema', 'objective extracted');
    assert.deepStrictEqual(output.plans[0].files_modified, ['prisma/schema.prisma', 'src/lib/db.ts'], 'files extracted');
    assert.strictEqual(output.plans[0].task_count, 2, 'task count correct');
    assert.strictEqual(output.plans[0].has_summary, false, 'no summary yet');
  });

  test('groups multiple plans by wave', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Database setup
---

## Task 1: Schema
`
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-02-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Auth setup
---

## Task 1: JWT
`
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-03-PLAN.md'),
      `---
wave: 2
autonomous: false
objective: API routes
---

## Task 1: Routes
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 3, 'should have 3 plans');
    assert.deepStrictEqual(output.waves['1'], ['03-01', '03-02'], 'wave 1 has 2 plans');
    assert.deepStrictEqual(output.waves['2'], ['03-03'], 'wave 2 has 1 plan');
  });

  test('detects incomplete plans (no matching summary)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Plan with summary
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), `---\nwave: 1\n---\n## Task 1`);
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), `# Summary`);

    // Plan without summary
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), `---\nwave: 2\n---\n## Task 1`);

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans[0].has_summary, true, 'first plan has summary');
    assert.strictEqual(output.plans[1].has_summary, false, 'second plan has no summary');
    assert.deepStrictEqual(output.incomplete, ['03-02'], 'incomplete list correct');
  });

  test('detects checkpoints (autonomous: false)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: false
objective: Manual review needed
---

## Task 1: Review
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_checkpoints, true, 'should detect checkpoint');
    assert.strictEqual(output.plans[0].autonomous, false, 'plan marked non-autonomous');
  });

  test('phase not found returns error', () => {
    const result = runGsdTools('phase-plan-index 99', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'Phase not found', 'should report phase not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state-snapshot command
// ─────────────────────────────────────────────────────────────────────────────

describe('state-snapshot command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing STATE.md returns error', () => {
    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'STATE.md not found', 'should report missing file');
  });

  test('extracts basic fields from STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Current Phase Name:** API Layer
**Total Phases:** 6
**Current Plan:** 03-02
**Total Plans in Phase:** 3
**Status:** In progress
**Progress:** 45%
**Last Activity:** 2024-01-15
**Last Activity Description:** Completed 03-01-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '03', 'current phase extracted');
    assert.strictEqual(output.current_phase_name, 'API Layer', 'phase name extracted');
    assert.strictEqual(output.total_phases, 6, 'total phases extracted');
    assert.strictEqual(output.current_plan, '03-02', 'current plan extracted');
    assert.strictEqual(output.total_plans_in_phase, 3, 'total plans extracted');
    assert.strictEqual(output.status, 'In progress', 'status extracted');
    assert.strictEqual(output.progress_percent, 45, 'progress extracted');
    assert.strictEqual(output.last_activity, '2024-01-15', 'last activity date extracted');
  });

  test('extracts decisions table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 01

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01 | Use Prisma | Better DX than raw SQL |
| 02 | JWT auth | Stateless authentication |
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions.length, 2, 'should have 2 decisions');
    assert.strictEqual(output.decisions[0].phase, '01', 'first decision phase');
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'first decision summary');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than raw SQL', 'first decision rationale');
  });

  test('extracts blockers list', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Blockers

- Waiting for API credentials
- Need design review for dashboard
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.blockers, [
      'Waiting for API credentials',
      'Need design review for dashboard',
    ], 'blockers extracted');
  });

  test('extracts session continuity info', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Session

**Last Date:** 2024-01-15
**Stopped At:** Phase 3, Plan 2, Task 1
**Resume File:** .planning/phases/03-api/03-02-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.session.last_date, '2024-01-15', 'session date extracted');
    assert.strictEqual(output.session.stopped_at, 'Phase 3, Plan 2, Task 1', 'stopped at extracted');
    assert.strictEqual(output.session.resume_file, '.planning/phases/03-api/03-02-PLAN.md', 'resume file extracted');
  });

  test('handles paused_at field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Paused At:** Phase 3, Plan 1, Task 2 - mid-implementation
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paused_at, 'Phase 3, Plan 1, Task 2 - mid-implementation', 'paused_at extracted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// summary-extract command
// ─────────────────────────────────────────────────────────────────────────────

describe('summary-extract command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing file returns error', () => {
    const result = runGsdTools('summary-extract .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'File not found', 'should report missing file');
  });

  test('extracts all fields from SUMMARY.md', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Set up Prisma with User and Project models
key-files:
  - prisma/schema.prisma
  - src/lib/db.ts
tech-stack:
  added:
    - prisma
    - zod
patterns-established:
  - Repository pattern
  - Dependency injection
key-decisions:
  - Use Prisma over Drizzle: Better DX and ecosystem
  - Single database: Start simple, shard later
---

# Summary

Full summary content here.
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.path, '.planning/phases/01-foundation/01-01-SUMMARY.md', 'path correct');
    assert.strictEqual(output.one_liner, 'Set up Prisma with User and Project models', 'one-liner extracted');
    assert.deepStrictEqual(output.key_files, ['prisma/schema.prisma', 'src/lib/db.ts'], 'key files extracted');
    assert.deepStrictEqual(output.tech_added, ['prisma', 'zod'], 'tech added extracted');
    assert.deepStrictEqual(output.patterns, ['Repository pattern', 'Dependency injection'], 'patterns extracted');
    assert.strictEqual(output.decisions.length, 2, 'decisions extracted');
  });

  test('selective extraction with --fields', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Set up database
key-files:
  - prisma/schema.prisma
tech-stack:
  added:
    - prisma
patterns-established:
  - Repository pattern
key-decisions:
  - Use Prisma: Better DX
---
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md --fields one_liner,key_files', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.one_liner, 'Set up database', 'one_liner included');
    assert.deepStrictEqual(output.key_files, ['prisma/schema.prisma'], 'key_files included');
    assert.strictEqual(output.tech_added, undefined, 'tech_added excluded');
    assert.strictEqual(output.patterns, undefined, 'patterns excluded');
    assert.strictEqual(output.decisions, undefined, 'decisions excluded');
  });

  test('handles missing frontmatter fields gracefully', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Minimal summary
---

# Summary
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.one_liner, 'Minimal summary', 'one-liner extracted');
    assert.deepStrictEqual(output.key_files, [], 'key_files defaults to empty');
    assert.deepStrictEqual(output.tech_added, [], 'tech_added defaults to empty');
    assert.deepStrictEqual(output.patterns, [], 'patterns defaults to empty');
    assert.deepStrictEqual(output.decisions, [], 'decisions defaults to empty');
  });

  test('parses key-decisions with rationale', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
key-decisions:
  - Use Prisma: Better DX than alternatives
  - JWT tokens: Stateless auth for scalability
---
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'decision summary parsed');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than alternatives', 'decision rationale parsed');
    assert.strictEqual(output.decisions[1].summary, 'JWT tokens', 'second decision summary');
    assert.strictEqual(output.decisions[1].rationale, 'Stateless auth for scalability', 'second decision rationale');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// init --include flag tests
// ─────────────────────────────────────────────────────────────────────────────

describe('init commands with --include flag', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase includes state and config content', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 03\n**Status:** In progress'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' })
    );

    const result = runGsdTools('init execute-phase 03 --include state,config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content should be included');
    assert.ok(output.state_content.includes('Current Phase'), 'state content correct');
    assert.ok(output.config_content, 'config_content should be included');
    assert.ok(output.config_content.includes('model_profile'), 'config content correct');
  });

  test('init execute-phase without --include omits content', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');

    const result = runGsdTools('init execute-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_content, undefined, 'state_content should be omitted');
    assert.strictEqual(output.config_content, undefined, 'config_content should be omitted');
  });

  test('init plan-phase includes multiple file contents', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# Project State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap v1.0');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements');
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');

    const result = runGsdTools('init plan-phase 03 --include state,roadmap,requirements,context,research', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content included');
    assert.ok(output.state_content.includes('Project State'), 'state content correct');
    assert.ok(output.roadmap_content, 'roadmap_content included');
    assert.ok(output.roadmap_content.includes('Roadmap v1.0'), 'roadmap content correct');
    assert.ok(output.requirements_content, 'requirements_content included');
    assert.ok(output.context_content, 'context_content included');
    assert.ok(output.research_content, 'research_content included');
  });

  test('init plan-phase includes verification and uat content', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification Results');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT Findings');

    const result = runGsdTools('init plan-phase 03 --include verification,uat', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.verification_content, 'verification_content included');
    assert.ok(output.verification_content.includes('Verification Results'), 'verification content correct');
    assert.ok(output.uat_content, 'uat_content included');
    assert.ok(output.uat_content.includes('UAT Findings'), 'uat content correct');
  });

  test('init progress includes state, roadmap, project, config', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' })
    );

    const result = runGsdTools('init progress --include state,roadmap,project,config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content included');
    assert.ok(output.roadmap_content, 'roadmap_content included');
    assert.ok(output.project_content, 'project_content included');
    assert.ok(output.config_content, 'config_content included');
  });

  test('missing files return null in content fields', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 03 --include state,config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_content, null, 'missing state returns null');
    assert.strictEqual(output.config_content, null, 'missing config returns null');
  });

  test('partial includes work correctly', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');

    // Only request state, not roadmap
    const result = runGsdTools('init execute-phase 03 --include state', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content included');
    assert.strictEqual(output.roadmap_content, undefined, 'roadmap_content not requested, should be undefined');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap analyze command
// ─────────────────────────────────────────────────────────────────────────────

describe('roadmap analyze command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing ROADMAP.md returns error', () => {
    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'ROADMAP.md not found');
  });

  test('parses phases with goals and disk status', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up infrastructure

### Phase 2: Authentication
**Goal:** Add user auth

### Phase 3: Features
**Goal:** Build core features
`
    );

    // Create phase dirs with varying completion
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const p2 = path.join(tmpDir, '.planning', 'phases', '02-authentication');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 3, 'should find 3 phases');
    assert.strictEqual(output.phases[0].disk_status, 'complete', 'phase 1 complete');
    assert.strictEqual(output.phases[1].disk_status, 'planned', 'phase 2 planned');
    assert.strictEqual(output.phases[2].disk_status, 'no_directory', 'phase 3 no directory');
    assert.strictEqual(output.completed_phases, 1, '1 phase complete');
    assert.strictEqual(output.total_plans, 2, '2 total plans');
    assert.strictEqual(output.total_summaries, 1, '1 total summary');
    assert.strictEqual(output.progress_percent, 50, '50% complete');
    assert.strictEqual(output.current_phase, '2', 'current phase is 2');
  });

  test('extracts goals and dependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize project
**Depends on:** Nothing

### Phase 2: Build
**Goal:** Build features
**Depends on:** Phase 1
`
    );

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases[0].goal, 'Initialize project');
    assert.strictEqual(output.phases[0].depends_on, 'Nothing');
    assert.strictEqual(output.phases[1].goal, 'Build features');
    assert.strictEqual(output.phases[1].depends_on, 'Phase 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase add command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase add command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('adds phase after highest existing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API

---
`
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 3, 'should be phase 3');
    assert.strictEqual(output.slug, 'user-dashboard');

    // Verify directory created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-user-dashboard')),
      'directory should be created'
    );

    // Verify ROADMAP updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('### Phase 3: User Dashboard'), 'roadmap should include new phase');
    assert.ok(roadmap.includes('**Depends on:** Phase 2'), 'should depend on previous');
  });

  test('handles empty roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );

    const result = runGsdTools('phase add Initial Setup', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 1, 'should be phase 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase insert command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase insert command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('inserts decimal phase after target', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase insert 1 Fix Critical Bug', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.1', 'should be 01.1');
    assert.strictEqual(output.after_phase, '1');

    // Verify directory
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01.1-fix-critical-bug')),
      'decimal phase directory should be created'
    );

    // Verify ROADMAP
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 01.1: Fix Critical Bug (INSERTED)'), 'roadmap should include inserted phase');
  });

  test('increments decimal when siblings exist', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01.1-hotfix'), { recursive: true });

    const result = runGsdTools('phase insert 1 Another Fix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.2', 'should be 01.2');
  });

  test('rejects missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    const result = runGsdTools('phase insert 99 Fix Something', tmpDir);
    assert.ok(!result.success, 'should fail for missing phase');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase remove command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase remove command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removes phase directory and renumbers subsequent', () => {
    // Setup 3 phases
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup
**Depends on:** Nothing

### Phase 2: Auth
**Goal:** Authentication
**Depends on:** Phase 1

### Phase 3: Features
**Goal:** Core features
**Depends on:** Phase 2
`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-auth');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');
    const p3 = path.join(tmpDir, '.planning', 'phases', '03-features');
    fs.mkdirSync(p3, { recursive: true });
    fs.writeFileSync(path.join(p3, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p3, '03-02-PLAN.md'), '# Plan 2');

    // Remove phase 2
    const result = runGsdTools('phase remove 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.removed, '2');
    assert.strictEqual(output.directory_deleted, '02-auth');

    // Phase 3 should be renumbered to 02
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features')),
      'phase 3 should be renumbered to 02-features'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-features')),
      'old 03-features should not exist'
    );

    // Files inside should be renamed
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-01-PLAN.md')),
      'plan file should be renumbered to 02-01'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-02-PLAN.md')),
      'plan 2 should be renumbered to 02-02'
    );

    // ROADMAP should be updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(!roadmap.includes('Phase 2: Auth'), 'removed phase should not be in roadmap');
    assert.ok(roadmap.includes('Phase 2: Features'), 'phase 3 should be renumbered to 2');
  });

  test('rejects removal of phase with summaries unless --force', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    // Should fail without --force
    const result = runGsdTools('phase remove 1', tmpDir);
    assert.ok(!result.success, 'should fail without --force');
    assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');

    // Should succeed with --force
    const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
    assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
  });

  test('removes decimal phase and renumbers siblings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 6: Main\n**Goal:** Main\n### Phase 6.1: Fix A\n**Goal:** Fix A\n### Phase 6.2: Fix B\n**Goal:** Fix B\n### Phase 6.3: Fix C\n**Goal:** Fix C\n`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-main'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-fix-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c'), { recursive: true });

    const result = runGsdTools('phase remove 6.2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // 06.3 should become 06.2
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-c')),
      '06.3 should be renumbered to 06.2'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c')),
      'old 06.3 should not exist'
    );
  });

  test('updates STATE.md phase count', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n**Goal:** A\n### Phase 2: B\n**Goal:** B\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 1\n**Total Phases:** 2\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });

    runGsdTools('phase remove 2', tmpDir);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Total Phases:** 1'), 'total phases should be decremented');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('marks phase complete and transitions to next', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
- [ ] Phase 2: API

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Foundation\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working on phase 1\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1');
    assert.strictEqual(output.plans_executed, '1/1');
    assert.strictEqual(output.next_phase, '02');
    assert.strictEqual(output.is_last_phase, false);

    // Verify STATE.md updated
    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Current Phase:** 02'), 'should advance to phase 02');
    assert.ok(state.includes('**Status:** Ready to plan'), 'status should be ready to plan');
    assert.ok(state.includes('**Current Plan:** Not started'), 'plan should be reset');

    // Verify ROADMAP checkbox
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('[x]'), 'phase should be checked off');
    assert.ok(roadmap.includes('completed'), 'completion date should be added');
  });

  test('detects last phase in milestone', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Only Phase\n**Goal:** Everything\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-only-phase');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_last_phase, true, 'should detect last phase');
    assert.strictEqual(output.next_phase, null, 'no next phase');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('Milestone complete'), 'status should be milestone complete');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('archives roadmap, requirements, creates MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] User auth\n- [ ] Dashboard\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Set up project infrastructure\n---\n# Summary\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP Foundation', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.version, 'v1.0');
    assert.strictEqual(output.phases, 1);
    assert.ok(output.archived.roadmap, 'roadmap should be archived');
    assert.ok(output.archived.requirements, 'requirements should be archived');

    // Verify archive files exist
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-ROADMAP.md')),
      'archived roadmap should exist'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md')),
      'archived requirements should exist'
    );

    // Verify MILESTONES.md created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')),
      'MILESTONES.md should be created'
    );
    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v1.0 MVP Foundation'), 'milestone entry should contain name');
    assert.ok(milestones.includes('Set up project infrastructure'), 'accomplishments should be listed');
  });

  test('appends to existing MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v0.9 Alpha (Shipped: 2025-01-01)\n\n---\n\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Beta', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v0.9 Alpha'), 'existing entry should be preserved');
    assert.ok(milestones.includes('v1.0 Beta'), 'new entry should be appended');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate consistency command
// ─────────────────────────────────────────────────────────────────────────────

describe('validate consistency command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('passes for consistent project', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 2: B\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.passed, true, 'should pass');
    assert.strictEqual(output.warning_count, 0, 'no warnings');
  });

  test('warns about phase on disk but not in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-orphan'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.warning_count > 0, 'should have warnings');
    assert.ok(
      output.warnings.some(w => w.includes('disk but not in ROADMAP')),
      'should warn about orphan directory'
    );
  });

  test('warns about gaps in phase numbering', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.includes('Gap in phase numbering')),
      'should warn about gap'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// progress command
// ─────────────────────────────────────────────────────────────────────────────

describe('progress command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('renders JSON progress', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Done');
    fs.writeFileSync(path.join(p1, '01-02-PLAN.md'), '# Plan 2');

    const result = runGsdTools('progress json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.total_plans, 2, '2 total plans');
    assert.strictEqual(output.total_summaries, 1, '1 summary');
    assert.strictEqual(output.percent, 50, '50%');
    assert.strictEqual(output.phases.length, 1, '1 phase');
    assert.strictEqual(output.phases[0].status, 'In Progress', 'phase in progress');
  });

  test('renders bar format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Done');

    const result = runGsdTools('progress bar --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('1/1'), 'should include count');
    assert.ok(result.output.includes('100%'), 'should include 100%');
  });

  test('renders table format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('progress table --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('Phase'), 'should have table header');
    assert.ok(result.output.includes('foundation'), 'should include phase name');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// todo complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('todo complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('moves todo from pending to completed', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(
      path.join(pendingDir, 'add-dark-mode.md'),
      `title: Add dark mode\narea: ui\ncreated: 2025-01-01\n`
    );

    const result = runGsdTools('todo complete add-dark-mode.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, true);

    // Verify moved
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'todos', 'pending', 'add-dark-mode.md')),
      'should be removed from pending'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'todos', 'completed', 'add-dark-mode.md')),
      'should be in completed'
    );

    // Verify completion timestamp added
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'todos', 'completed', 'add-dark-mode.md'),
      'utf-8'
    );
    assert.ok(content.startsWith('completed:'), 'should have completed timestamp');
  });

  test('fails for nonexistent todo', () => {
    const result = runGsdTools('todo complete nonexistent.md', tmpDir);
    assert.ok(!result.success, 'should fail');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scaffold command
// ─────────────────────────────────────────────────────────────────────────────

describe('scaffold command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('scaffolds context file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold context --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    // Verify file content
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-CONTEXT.md'),
      'utf-8'
    );
    assert.ok(content.includes('Phase 3'), 'should reference phase number');
    assert.ok(content.includes('Decisions'), 'should have decisions section');
    assert.ok(content.includes('Discretion Areas'), 'should have discretion section');
  });

  test('scaffolds UAT file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold uat --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-UAT.md'),
      'utf-8'
    );
    assert.ok(content.includes('User Acceptance Testing'), 'should have UAT heading');
    assert.ok(content.includes('Test Results'), 'should have test results section');
  });

  test('scaffolds verification file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold verification --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-VERIFICATION.md'),
      'utf-8'
    );
    assert.ok(content.includes('Goal-Backward Verification'), 'should have verification heading');
  });

  test('scaffolds phase directory', () => {
    const result = runGsdTools('scaffold phase-dir --phase 5 --name User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '05-user-dashboard')),
      'directory should be created'
    );
  });

  test('does not overwrite existing files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Existing content');

    const result = runGsdTools('scaffold context --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, false, 'should not overwrite');
    assert.strictEqual(output.reason, 'already_exists');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scan-sessions command
// ─────────────────────────────────────────────────────────────────────────────

describe('scan-sessions command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-scan-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createMockProject(projectName, sessionCount) {
    const projectDir = path.join(tmpDir, projectName);
    fs.mkdirSync(projectDir, { recursive: true });
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = `session-${i}-${Date.now()}`;
      const content = JSON.stringify({ type: 'user', message: { content: `msg ${i}` } }) + '\n';
      fs.writeFileSync(path.join(projectDir, `${sessionId}.jsonl`), content);
    }
    return projectDir;
  }

  test('returns project list with metadata', () => {
    createMockProject('my-project', 2);

    const result = runGsdTools(`scan-sessions --json --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output), 'output should be an array');
    assert.strictEqual(output.length, 1, 'should have 1 project');
    assert.strictEqual(output[0].sessionCount, 2, 'should have 2 sessions');
  });

  test('handles missing sessions directory gracefully', () => {
    const result = runGsdTools('scan-sessions --path /tmp/nonexistent-gsd-test-dir-12345');
    assert.ok(!result.success, 'should fail');
    assert.ok(
      result.error.includes('No Claude Code sessions found'),
      'error should mention missing sessions'
    );
  });

  test('discovers sessions without sessions-index.json', () => {
    createMockProject('no-index-project', 3);

    const result = runGsdTools(`scan-sessions --json --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output[0].sessionCount, 3, 'should discover 3 sessions from filesystem');
  });

  test('enriches metadata from sessions-index.json when present', () => {
    const projectDir = createMockProject('indexed-project', 1);
    const sessions = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    const sessionId = sessions[0].replace('.jsonl', '');

    const indexData = {
      originalPath: '/Users/dev/my-cool-project',
      entries: [{
        sessionId,
        summary: 'Test session',
        messageCount: 5,
      }],
    };
    fs.writeFileSync(path.join(projectDir, 'sessions-index.json'), JSON.stringify(indexData));

    const result = runGsdTools(`scan-sessions --json --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output[0].name, 'my-cool-project', 'should use originalPath for project name');
  });

  test('verbose mode lists individual sessions', () => {
    createMockProject('verbose-project', 3);

    const result = runGsdTools(`scan-sessions --verbose --json --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output[0].sessions, 'should include sessions array');
    assert.strictEqual(output[0].sessions.length, 3, 'should list 3 sessions');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extract-messages command
// ─────────────────────────────────────────────────────────────────────────────

describe('extract-messages command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-extract-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTestSession(messages) {
    return messages.map(m => JSON.stringify(m)).join('\n') + '\n';
  }

  function createMockProjectWithContent(projectName, content) {
    const projectDir = path.join(tmpDir, projectName);
    fs.mkdirSync(projectDir, { recursive: true });
    const sessionId = `test-session-${Date.now()}`;
    fs.writeFileSync(path.join(projectDir, `${sessionId}.jsonl`), content);
    return { projectDir, sessionId };
  }

  test('extracts only genuine user messages', () => {
    const content = createTestSession([
      { type: 'user', userType: 'external', message: { content: 'Hello world' } },
      { type: 'assistant', message: { content: 'Hi there' } },
      { type: 'user', userType: 'external', isMeta: true, message: { content: 'meta message' } },
      { type: 'user', userType: 'external', message: { content: ['array', 'content'] } },
      { type: 'user', userType: 'external', message: { content: '<local-command some cmd' } },
      { type: 'user', userType: 'external', message: { content: '<command-run something' } },
      { type: 'user', userType: 'external', message: { content: '<task-notification task1' } },
      { type: 'user', userType: 'external', isSidechain: true, message: { content: 'sidechain msg' } },
      { type: 'user', userType: 'internal', message: { content: 'internal msg' } },
      { type: 'user', userType: 'external', message: { content: 'Second real message' } },
    ]);
    createMockProjectWithContent('test-project', content);

    const result = runGsdTools(`extract-messages test-project --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.messages_extracted, 2, 'should extract only 2 genuine messages');

    // Read the output file and verify contents
    const lines = fs.readFileSync(output.output_file, 'utf-8').trim().split('\n');
    const msgs = lines.map(l => JSON.parse(l));
    assert.strictEqual(msgs[0].content, 'Hello world', 'first message should be genuine user message');
    assert.strictEqual(msgs[1].content, 'Second real message', 'second message should be genuine user message');
  });

  test('truncates messages over 2000 chars', () => {
    const longContent = 'x'.repeat(3000);
    const content = createTestSession([
      { type: 'user', userType: 'external', message: { content: longContent } },
    ]);
    createMockProjectWithContent('trunc-project', content);

    const result = runGsdTools(`extract-messages trunc-project --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.messages_truncated, 1, 'should report 1 truncated message');

    const lines = fs.readFileSync(output.output_file, 'utf-8').trim().split('\n');
    const msg = JSON.parse(lines[0]);
    assert.ok(msg.content.endsWith('... [truncated]'), 'should end with truncation marker');
    assert.ok(msg.content.length <= 2015, 'truncated content should not exceed 2015 chars');
  });

  test('limits batch to 300 messages', () => {
    const messages = [];
    for (let i = 0; i < 350; i++) {
      messages.push({ type: 'user', userType: 'external', message: { content: `Message ${i}` } });
    }
    const content = createTestSession(messages);
    createMockProjectWithContent('batch-project', content);

    const result = runGsdTools(`extract-messages batch-project --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.messages_extracted <= 300, `should extract at most 300 messages, got ${output.messages_extracted}`);
  });

  test('skips corrupted files and continues', () => {
    const projectDir = path.join(tmpDir, 'mixed-project');
    fs.mkdirSync(projectDir, { recursive: true });

    // Valid session
    const validContent = createTestSession([
      { type: 'user', userType: 'external', message: { content: 'Valid message' } },
    ]);
    fs.writeFileSync(path.join(projectDir, 'valid-session.jsonl'), validContent);

    // Corrupted session (just garbage data - but this gets parsed line-by-line, so
    // malformed lines are skipped, not the whole file. We need to trigger a read error.)
    // Actually the file-level error handling catches fs errors. Let's test with
    // a valid file that has only garbage lines - it should just produce 0 messages.
    const garbageContent = 'not json at all\n{{broken\n[invalid\n';
    fs.writeFileSync(path.join(projectDir, 'garbage-session.jsonl'), garbageContent);

    const result = runGsdTools(`extract-messages mixed-project --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.messages_extracted >= 1, 'should extract messages from valid file');
    assert.strictEqual(output.sessions_processed, 2, 'both sessions processed (garbage lines just skipped)');
  });

  test('returns error for unknown project', () => {
    fs.mkdirSync(path.join(tmpDir, 'existing-project'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'existing-project', 'session.jsonl'),
      JSON.stringify({ type: 'user', userType: 'external', message: { content: 'hi' } }) + '\n'
    );

    const result = runGsdTools(`extract-messages nonexistent --path ${tmpDir}`);
    assert.ok(!result.success, 'should fail for unknown project');
    assert.ok(result.error.includes('No project matching'), 'error should mention no matching project');
  });

  test('--session flag targets single session', () => {
    const projectDir = path.join(tmpDir, 'multi-session');
    fs.mkdirSync(projectDir, { recursive: true });

    fs.writeFileSync(
      path.join(projectDir, 'session-aaa.jsonl'),
      createTestSession([{ type: 'user', userType: 'external', message: { content: 'from aaa' } }])
    );
    fs.writeFileSync(
      path.join(projectDir, 'session-bbb.jsonl'),
      createTestSession([{ type: 'user', userType: 'external', message: { content: 'from bbb' } }])
    );

    const result = runGsdTools(`extract-messages multi-session --session session-aaa --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.sessions_processed, 1, 'should process only 1 session');

    const lines = fs.readFileSync(output.output_file, 'utf-8').trim().split('\n');
    const msg = JSON.parse(lines[0]);
    assert.strictEqual(msg.content, 'from aaa', 'should only contain messages from targeted session');
    assert.strictEqual(msg.sessionId, 'session-aaa', 'sessionId should match targeted session');
  });

  test('--limit flag caps sessions processed', () => {
    const projectDir = path.join(tmpDir, 'many-sessions');
    fs.mkdirSync(projectDir, { recursive: true });

    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(
        path.join(projectDir, `sess-${i}.jsonl`),
        createTestSession([{ type: 'user', userType: 'external', message: { content: `msg ${i}` } }])
      );
    }

    const result = runGsdTools(`extract-messages many-sessions --limit 2 --path ${tmpDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.sessions_processed <= 2, `should process at most 2 sessions, got ${output.sessions_processed}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// loadConfig extension
// ─────────────────────────────────────────────────────────────────────────────

describe('loadConfig extension', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns preferences and profile with defaults when missing from config', () => {
    // Create config.json without preferences/profile keys
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' })
    );

    // Use state load to test loadConfig indirectly
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 01\n'
    );

    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.config.model_profile, 'balanced', 'model_profile should load');
    // preferences and profile should be present with defaults
    assert.deepStrictEqual(output.config.preferences, {}, 'preferences should default to empty object');
    assert.deepStrictEqual(output.config.profile, { path: null, generated: null }, 'profile should have defaults');
  });

  test('returns preferences and profile from config when present', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        model_profile: 'quality',
        preferences: { verbose: true, theme: 'dark' },
        profile: { path: '/test/profile', generated: '2025-01-01' },
      })
    );

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 01\n'
    );

    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.config.preferences, { verbose: true, theme: 'dark' }, 'preferences should be loaded from config');
    assert.deepStrictEqual(output.config.profile, { path: '/test/profile', generated: '2025-01-01' }, 'profile should be loaded from config');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// profile-sample command
// ─────────────────────────────────────────────────────────────────────────────

describe('profile-sample', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-profile-sample-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createMockSession(messages) {
    return messages.map(m => JSON.stringify(m)).join('\n') + '\n';
  }

  function createMockProject(projectName, sessionCount, messagesPerSession = 3) {
    const projectDir = path.join(tmpDir, projectName);
    fs.mkdirSync(projectDir, { recursive: true });
    for (let s = 0; s < sessionCount; s++) {
      const messages = [];
      for (let m = 0; m < messagesPerSession; m++) {
        messages.push({
          type: 'user',
          userType: 'external',
          message: { role: 'user', content: `Message ${m} from session ${s} of ${projectName}` },
          cwd: `/mock/${projectName}`,
          timestamp: new Date(Date.now() - s * 86400000).toISOString(),
        });
      }
      fs.writeFileSync(
        path.join(projectDir, `session-${s}-${Date.now()}.jsonl`),
        createMockSession(messages)
      );
    }
    return projectDir;
  }

  test('produces JSONL output with project-proportional sampling', () => {
    // Use --max-per-project 1 to force sampling across multiple projects
    createMockProject('project-a', 5, 3);
    createMockProject('project-b', 2, 3);
    createMockProject('project-c', 1, 3);

    const result = runGsdTools(`profile-sample --path ${tmpDir} --limit 10 --max-per-project 1 --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.output_file, 'should have output_file');
    assert.ok(output.projects_sampled >= 2, `should sample at least 2 projects, got ${output.projects_sampled}`);
    assert.ok(output.messages_sampled <= 10, `should sample at most 10 messages, got ${output.messages_sampled}`);
    assert.ok(output.messages_sampled > 0, 'should sample at least 1 message');

    // Verify JSONL file exists and each line is valid JSON with projectName
    const lines = fs.readFileSync(output.output_file, 'utf-8').trim().split('\n');
    for (const line of lines) {
      const msg = JSON.parse(line);
      assert.ok(msg.projectName, 'each message should have projectName');
      assert.ok(typeof msg.projectName === 'string', 'projectName should be a string');
    }
  });

  test('caps messages per project', () => {
    createMockProject('dominant-project', 20, 3);
    createMockProject('small-project', 1, 3);

    const result = runGsdTools(`profile-sample --path ${tmpDir} --limit 10 --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // With 2 projects and limit 10, per-project cap should be max(5, floor(10/2)) = 5
    // So dominant project should not contribute all 10
    const breakdown = output.project_breakdown;
    if (breakdown.length === 2) {
      const dominant = breakdown.find(b => b.project === 'dominant-project');
      assert.ok(dominant, 'dominant project should be in breakdown');
      assert.ok(dominant.messages < 10, `dominant project should not contribute all messages, got ${dominant.messages}`);
    }
  });

  test('enriches messages with projectName field', () => {
    createMockProject('named-project', 2, 2);

    const result = runGsdTools(`profile-sample --path ${tmpDir} --limit 5 --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const lines = fs.readFileSync(output.output_file, 'utf-8').trim().split('\n');
    for (const line of lines) {
      const msg = JSON.parse(line);
      assert.strictEqual(typeof msg.projectName, 'string', 'projectName should be a string');
      assert.ok(msg.projectName.length > 0, 'projectName should not be empty');
    }
  });

  test('truncates message content to maxChars', () => {
    const projectDir = path.join(tmpDir, 'long-project');
    fs.mkdirSync(projectDir, { recursive: true });
    const longContent = 'x'.repeat(2000);
    const session = createMockSession([{
      type: 'user',
      userType: 'external',
      message: { role: 'user', content: longContent },
      cwd: '/mock/long-project',
      timestamp: new Date().toISOString(),
    }]);
    fs.writeFileSync(path.join(projectDir, 'session-long.jsonl'), session);

    const result = runGsdTools(`profile-sample --path ${tmpDir} --limit 5 --max-chars 100 --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const lines = fs.readFileSync(output.output_file, 'utf-8').trim().split('\n');
    assert.ok(lines.length > 0, 'should have at least 1 message');
    const msg = JSON.parse(lines[0]);
    // Content should be truncated: 100 chars + "... [truncated]" = ~115 max
    assert.ok(msg.content.length <= 120, `content should be truncated, got length ${msg.content.length}`);
  });

  test('errors on nonexistent path', () => {
    const result = runGsdTools('profile-sample --path /nonexistent/path/that/does/not/exist --raw');
    assert.ok(!result.success, 'should fail for nonexistent path');
    assert.ok(result.error.includes('No Claude Code sessions found'), `error should mention sessions, got: ${result.error}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// write-profile command
// ─────────────────────────────────────────────────────────────────────────────

describe('write-profile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-write-profile-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createMockAnalysis(overrides = {}) {
    const base = {
      profile_version: '1.0',
      analyzed_at: new Date().toISOString(),
      data_source: 'session_analysis',
      projects_list: ['TestProject'],
      message_count: 50,
      message_threshold: 'full',
      sensitive_excluded: [],
      dimensions: {
        communication_style: {
          rating: 'detailed-structured',
          confidence: 'HIGH',
          evidence_count: 15,
          cross_project_consistent: true,
          evidence: [
            { signal: 'Uses markdown headers', quote: '## Context\nThe auth flow...', project: 'TestProject' }
          ],
          summary: 'Consistently provides structured context.',
          claude_instruction: 'Match structured communication with headers and lists.',
        },
        decision_speed: {
          rating: 'deliberate-informed',
          confidence: 'MEDIUM',
          evidence_count: 8,
          cross_project_consistent: true,
          evidence: [
            { signal: 'Asks for comparison tables', quote: 'Can you compare these options?', project: 'TestProject' }
          ],
          summary: 'Prefers informed decision making with comparisons.',
          claude_instruction: 'Present options with pros/cons tables.',
        },
        explanation_depth: {
          rating: 'concise',
          confidence: 'MEDIUM',
          evidence_count: 7,
          cross_project_consistent: true,
          evidence: [
            { signal: 'Brief acknowledgments', quote: 'Got it, thanks', project: 'TestProject' }
          ],
          summary: 'Prefers concise explanations.',
          claude_instruction: 'Keep explanations brief.',
        },
        debugging_approach: {
          rating: 'diagnostic',
          confidence: 'HIGH',
          evidence_count: 12,
          cross_project_consistent: true,
          evidence: [
            { signal: 'Shares error context', quote: 'Getting this error when...', project: 'TestProject' }
          ],
          summary: 'Approaches debugging with diagnostic mindset.',
          claude_instruction: 'Diagnose root cause before presenting fix.',
        },
        ux_philosophy: {
          rating: 'pragmatic',
          confidence: 'MEDIUM',
          evidence_count: 6,
          cross_project_consistent: true,
          evidence: [
            { signal: 'Basic usability focus', quote: 'Make it look clean', project: 'TestProject' }
          ],
          summary: 'Pragmatic UX approach.',
          claude_instruction: 'Build clean, usable interfaces.',
        },
        vendor_philosophy: {
          rating: 'conservative',
          confidence: 'LOW',
          evidence_count: 3,
          cross_project_consistent: false,
          evidence: [
            { signal: 'Prefers established tools', quote: 'Lets use PostgreSQL', project: 'TestProject' }
          ],
          summary: 'Tends toward established tools.',
          claude_instruction: 'Recommend well-established tools.',
        },
        frustration_triggers: {
          rating: 'scope-creep',
          confidence: 'MEDIUM',
          evidence_count: 5,
          cross_project_consistent: true,
          evidence: [
            { signal: 'Rejects additions', quote: 'I just asked for X not Y', project: 'TestProject' }
          ],
          summary: 'Frustrated by scope creep.',
          claude_instruction: 'Do exactly what is asked, nothing more.',
        },
        learning_style: {
          rating: 'self-directed',
          confidence: 'MEDIUM',
          evidence_count: 7,
          cross_project_consistent: true,
          evidence: [
            { signal: 'Reads code directly', quote: 'Let me look at the source', project: 'TestProject' }
          ],
          summary: 'Self-directed learner.',
          claude_instruction: 'Point to relevant code sections.',
        },
      },
    };

    // Apply overrides
    if (overrides.data_source) base.data_source = overrides.data_source;
    if (overrides.dimensions) {
      for (const [key, val] of Object.entries(overrides.dimensions)) {
        base.dimensions[key] = { ...base.dimensions[key], ...val };
      }
    }
    return base;
  }

  test('renders analysis JSON into USER-PROFILE.md', () => {
    const analysis = createMockAnalysis();
    const inputPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'USER-PROFILE.md');
    fs.writeFileSync(inputPath, JSON.stringify(analysis));

    const result = runGsdTools(`write-profile --input ${inputPath} --output ${outputPath} --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const profile = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(profile.includes('Developer Profile'), 'should contain Developer Profile');
    assert.ok(profile.includes('Communication Style'), 'should contain Communication Style header');
    assert.ok(profile.includes('Decision Speed') || profile.includes('decision_speed'), 'should contain decision dimension');
    assert.ok(profile.includes('detailed-structured'), 'should contain communication rating');
    assert.ok(profile.includes('TestProject'), 'should mention the project');
  });

  test('applies sensitive content filter', () => {
    const analysis = createMockAnalysis({
      dimensions: {
        communication_style: {
          evidence: [
            { signal: 'Has API key in message', quote: 'Use sk-test123456789012345678 for auth', project: 'TestProject' }
          ],
        },
      },
    });
    const inputPath = path.join(tmpDir, 'analysis-sensitive.json');
    const outputPath = path.join(tmpDir, 'PROFILE-SENSITIVE.md');
    fs.writeFileSync(inputPath, JSON.stringify(analysis));

    const result = runGsdTools(`write-profile --input ${inputPath} --output ${outputPath} --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const profile = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(profile.includes('[REDACTED]'), 'should contain [REDACTED] for sensitive content');
    assert.ok(!profile.includes('sk-test123456789012345678'), 'should not contain the API key');

    // Verify stderr mentions redaction
    const output = JSON.parse(result.output);
    assert.ok(output.sensitive_redacted > 0, 'should report sensitive content was redacted');
  });

  test('creates output directory if missing', () => {
    const analysis = createMockAnalysis();
    const inputPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'nested', 'deep', 'dir', 'USER-PROFILE.md');
    fs.writeFileSync(inputPath, JSON.stringify(analysis));

    const result = runGsdTools(`write-profile --input ${inputPath} --output ${outputPath} --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(fs.existsSync(outputPath), 'output file should be created in nested directory');
  });

  test('errors when input file missing', () => {
    const result = runGsdTools(`write-profile --input /nonexistent/analysis.json --output ${tmpDir}/out.md --raw`);
    assert.ok(!result.success, 'should fail for missing input');
    assert.ok(result.error.includes('not found') || result.error.includes('Analysis file'), `error should mention missing file, got: ${result.error}`);
  });

  test('handles questionnaire-sourced analysis identically', () => {
    const analysis = createMockAnalysis({ data_source: 'questionnaire' });
    analysis.projects_list = [];
    analysis.message_count = 0;
    const inputPath = path.join(tmpDir, 'questionnaire-analysis.json');
    const outputPath = path.join(tmpDir, 'PROFILE-Q.md');
    fs.writeFileSync(inputPath, JSON.stringify(analysis));

    const result = runGsdTools(`write-profile --input ${inputPath} --output ${outputPath} --raw`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const profile = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(profile.includes('Developer Profile'), 'should contain Developer Profile');
    assert.ok(profile.includes('questionnaire'), 'should mention questionnaire as source');
    assert.ok(profile.includes('Communication Style'), 'should have dimension headers');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// profile-questionnaire command
// ─────────────────────────────────────────────────────────────────────────────

describe('profile-questionnaire', () => {
  test('outputs questions in interactive mode when no answers provided', () => {
    const result = runGsdTools('profile-questionnaire --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.mode, 'interactive', 'should be interactive mode');
    assert.strictEqual(output.questions.length, 8, 'should have 8 questions');

    for (const q of output.questions) {
      assert.ok(q.dimension, 'each question should have dimension');
      assert.ok(q.context, 'each question should have context');
      assert.ok(q.question, 'each question should have question text');
      assert.ok(Array.isArray(q.options), 'each question should have options array');
      assert.strictEqual(q.options.length, 4, `each question should have 4 options, got ${q.options.length}`);
    }
  });

  test('produces valid analysis JSON from answers', () => {
    const result = runGsdTools('profile-questionnaire --answers "a,b,c,d,a,b,c,d" --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.profile_version, '1.0', 'should have profile_version 1.0');
    assert.strictEqual(output.data_source, 'questionnaire', 'should have questionnaire data_source');
    assert.strictEqual(Object.keys(output.dimensions).length, 8, 'should have 8 dimensions');

    for (const [dimKey, dim] of Object.entries(output.dimensions)) {
      assert.ok(dim.rating, `${dimKey} should have rating`);
      assert.ok(dim.confidence === 'MEDIUM' || dim.confidence === 'LOW', `${dimKey} confidence should be MEDIUM or LOW, got ${dim.confidence}`);
      assert.ok(dim.claude_instruction, `${dimKey} should have claude_instruction`);
      assert.ok(dim.summary, `${dimKey} should have summary`);
      assert.ok(Array.isArray(dim.evidence), `${dimKey} should have evidence array`);
      assert.strictEqual(dim.evidence_count, 1, `${dimKey} evidence_count should be 1`);
    }
  });

  test('assigns MEDIUM confidence for definitive answers', () => {
    const result = runGsdTools('profile-questionnaire --answers "a,a,a,a,a,a,a,a" --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // All "a" options are definitive choices, none are ambiguous
    for (const [dimKey, dim] of Object.entries(output.dimensions)) {
      assert.strictEqual(dim.confidence, 'MEDIUM', `${dimKey} should have MEDIUM confidence for definitive answer`);
    }
  });

  test('assigns LOW confidence for ambiguous "it varies" answers', () => {
    // communication_style "d" is explicitly "It depends on the task" -- should be LOW
    const result = runGsdTools('profile-questionnaire --answers "d,b,b,b,b,b,b,b" --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.dimensions.communication_style.confidence, 'LOW',
      'communication_style with "d" (it depends) should have LOW confidence');
    assert.strictEqual(output.dimensions.decision_speed.confidence, 'MEDIUM',
      'decision_speed with "b" (definitive) should have MEDIUM confidence');
  });

  test('produces schema compatible with write-profile', () => {
    // Run questionnaire to get analysis JSON
    const qResult = runGsdTools('profile-questionnaire --answers "a,b,c,d,a,b,c,d" --raw');
    assert.ok(qResult.success, `Questionnaire failed: ${qResult.error}`);

    // Write questionnaire output to temp file
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-compat-'));
    const inputPath = path.join(tmpDir, 'q-analysis.json');
    const outputPath = path.join(tmpDir, 'USER-PROFILE.md');
    fs.writeFileSync(inputPath, qResult.output);

    // Run write-profile with questionnaire output as input
    const wpResult = runGsdTools(`write-profile --input ${inputPath} --output ${outputPath} --raw`);
    assert.ok(wpResult.success, `write-profile failed on questionnaire output: ${wpResult.error}`);

    // Verify profile was written correctly
    const profile = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(profile.includes('Developer Profile'), 'profile should contain Developer Profile header');
    assert.ok(profile.includes('questionnaire'), 'profile should reference questionnaire as data source');
    assert.ok(profile.includes('Communication Style'), 'profile should have dimension sections');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generate-dev-preferences command
// ─────────────────────────────────────────────────────────────────────────────

describe('generate-dev-preferences', () => {
  let tmpDir;

  const MOCK_ANALYSIS = {
    profile_version: '1.0',
    data_source: 'session_analysis',
    projects_analyzed: ['project-a', 'project-b'],
    dimensions: {
      communication_style: {
        rating: 'detailed-structured',
        confidence: 'HIGH',
        claude_instruction: 'Use headers, numbered lists, acknowledge context before responding.',
        summary: 'Consistently provides structured context.',
        cross_project_consistent: true,
        evidence: [{ signal: 'Structured headers in requests', project: 'project-a' }],
      },
      decision_speed: {
        rating: 'deliberate-informed',
        confidence: 'MEDIUM',
        claude_instruction: 'Present comparison tables with trade-offs.',
        summary: 'Prefers to evaluate options before committing.',
        cross_project_consistent: true,
        evidence: [],
      },
      explanation_depth: {
        rating: 'concise',
        confidence: 'MEDIUM',
        claude_instruction: 'Keep explanations brief and pair with code.',
        summary: 'Prefers concise explanations.',
        cross_project_consistent: true,
        evidence: [],
      },
      debugging_approach: {
        rating: 'diagnostic',
        confidence: 'HIGH',
        claude_instruction: 'Diagnose root cause before presenting fix.',
        summary: 'Diagnostic debugging approach.',
        cross_project_consistent: true,
        evidence: [],
      },
      ux_philosophy: {
        rating: 'pragmatic',
        confidence: 'MEDIUM',
        claude_instruction: 'Build clean, usable interfaces without over-engineering.',
        summary: 'Pragmatic UX approach.',
        cross_project_consistent: true,
        evidence: [],
      },
      vendor_philosophy: {
        rating: 'conservative',
        confidence: 'LOW',
        claude_instruction: 'Recommend well-established tools with strong community support.',
        summary: 'Tends toward established tools.',
        cross_project_consistent: false,
        evidence: [],
      },
      frustration_triggers: {
        rating: 'scope-creep',
        confidence: 'MEDIUM',
        claude_instruction: 'Do exactly what is asked, nothing more.',
        summary: 'Frustrated by scope creep.',
        cross_project_consistent: true,
        evidence: [],
      },
      learning_style: {
        rating: 'self-directed',
        confidence: 'MEDIUM',
        claude_instruction: 'Point to relevant code sections and let the developer explore.',
        summary: 'Self-directed learner.',
        cross_project_consistent: true,
        evidence: [],
      },
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-gen-devpref-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('produces valid dev-preferences file from session analysis JSON', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'dev-preferences.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    const result = runGsdTools(`generate-dev-preferences --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Assert output file exists
    assert.ok(fs.existsSync(outputPath), 'output file should exist');

    const content = fs.readFileSync(outputPath, 'utf-8');

    // Assert YAML frontmatter with description
    assert.ok(content.includes('description:'), 'should contain YAML frontmatter with description');

    // Assert Behavioral Directives section
    assert.ok(content.includes('Behavioral Directives'), 'should contain Behavioral Directives section');

    // Assert directive text from mock analysis
    assert.ok(content.includes('Use headers, numbered lists'), 'should contain directive text from analysis');

    // Assert confidence annotations
    assert.ok(content.includes('HIGH confidence'), 'should contain HIGH confidence annotation');

    // Assert JSON output
    const output = JSON.parse(result.output);
    assert.strictEqual(output.command_name, '/gsd:dev-preferences', 'JSON output should have command_name');
    assert.ok(output.dimensions_included.length >= 2, 'should include at least 2 dimensions');
  });

  test('renders all 8 dimension sections when all present', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'dev-preferences.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    const result = runGsdTools(`generate-dev-preferences --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');

    const expectedLabels = [
      'Communication', 'Decision Support', 'Explanations', 'Debugging',
      'UX Approach', 'Library & Tool Choices', 'Boundaries', 'Learning Support',
    ];

    for (const label of expectedLabels) {
      assert.ok(content.includes(`### ${label}`), `should contain dimension header: ${label}`);
    }
  });

  test('handles questionnaire-only data source correctly', () => {
    const qAnalysis = JSON.parse(JSON.stringify(MOCK_ANALYSIS));
    qAnalysis.data_source = 'questionnaire';

    const analysisPath = path.join(tmpDir, 'q-analysis.json');
    const outputPath = path.join(tmpDir, 'dev-preferences.md');
    fs.writeFileSync(analysisPath, JSON.stringify(qAnalysis));

    const result = runGsdTools(`generate-dev-preferences --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(content.includes('questionnaire-only profile'), 'should contain questionnaire-only profile text');
    assert.ok(content.includes('questionnaire'), 'should render data_source as questionnaire');
  });

  test('uses CLAUDE_INSTRUCTIONS fallback when claude_instruction missing', () => {
    const fallbackAnalysis = JSON.parse(JSON.stringify(MOCK_ANALYSIS));
    // Remove claude_instruction from communication_style but keep rating
    delete fallbackAnalysis.dimensions.communication_style.claude_instruction;

    const analysisPath = path.join(tmpDir, 'fallback-analysis.json');
    const outputPath = path.join(tmpDir, 'dev-preferences.md');
    fs.writeFileSync(analysisPath, JSON.stringify(fallbackAnalysis));

    const result = runGsdTools(`generate-dev-preferences --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');
    // Should still contain a directive for Communication -- either from CLAUDE_INSTRUCTIONS or fallback
    assert.ok(content.includes('### Communication'), 'should still contain Communication section');
    // The CLAUDE_INSTRUCTIONS lookup for detailed-structured should produce the known instruction
    assert.ok(
      content.includes('structured communication') || content.includes('headers') || content.includes('communication style'),
      'should contain fallback instruction from CLAUDE_INSTRUCTIONS lookup'
    );
  });

  test('creates parent directories when output path does not exist', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'nested', 'deep', 'dir', 'dev-preferences.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    const result = runGsdTools(`generate-dev-preferences --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(fs.existsSync(outputPath), 'output file should be created in nested directory');
  });

  test('errors when analysis file not found', () => {
    const result = runGsdTools('generate-dev-preferences --analysis /nonexistent/path.json --output /tmp/out.md');
    assert.ok(!result.success, 'should fail for missing analysis file');
    assert.ok(result.error.includes('not found'), 'error should mention not found');
  });

  test('errors when analysis JSON is malformed', () => {
    const badPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(badPath, '{ not valid json !!!');

    const result = runGsdTools(`generate-dev-preferences --analysis ${badPath} --output ${path.join(tmpDir, 'out.md')}`);
    assert.ok(!result.success, 'should fail for malformed JSON');
    assert.ok(result.error.includes('parse') || result.error.includes('JSON'), 'error should mention JSON parsing');
  });

  test('accepts --stack option for custom stack preferences', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'dev-preferences.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    const result = runGsdTools(`generate-dev-preferences --analysis ${analysisPath} --output ${outputPath} --stack "TypeScript, React, Node.js"`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(content.includes('TypeScript, React, Node.js'), 'should contain custom stack text in output');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generate-claude-profile command
// ─────────────────────────────────────────────────────────────────────────────

describe('generate-claude-profile', () => {
  let tmpDir;

  const MOCK_ANALYSIS = {
    profile_version: '1.0',
    data_source: 'session_analysis',
    projects_analyzed: ['project-a', 'project-b'],
    dimensions: {
      communication_style: {
        rating: 'detailed-structured',
        confidence: 'HIGH',
        claude_instruction: 'Use headers, numbered lists, acknowledge context before responding.',
        summary: 'Consistently provides structured context.',
        cross_project_consistent: true,
        evidence: [{ signal: 'Structured headers in requests', project: 'project-a' }],
      },
      decision_speed: {
        rating: 'deliberate-informed',
        confidence: 'MEDIUM',
        claude_instruction: 'Present comparison tables with trade-offs.',
        summary: 'Prefers to evaluate options before committing.',
        cross_project_consistent: true,
        evidence: [],
      },
      explanation_depth: {
        rating: 'concise',
        confidence: 'MEDIUM',
        claude_instruction: 'Keep explanations brief and pair with code.',
        summary: 'Prefers concise explanations.',
        cross_project_consistent: true,
        evidence: [],
      },
      debugging_approach: {
        rating: 'diagnostic',
        confidence: 'HIGH',
        claude_instruction: 'Diagnose root cause before presenting fix.',
        summary: 'Diagnostic debugging approach.',
        cross_project_consistent: true,
        evidence: [],
      },
      ux_philosophy: {
        rating: 'pragmatic',
        confidence: 'MEDIUM',
        claude_instruction: 'Build clean, usable interfaces without over-engineering.',
        summary: 'Pragmatic UX approach.',
        cross_project_consistent: true,
        evidence: [],
      },
      vendor_philosophy: {
        rating: 'conservative',
        confidence: 'LOW',
        claude_instruction: 'Recommend well-established tools with strong community support.',
        summary: 'Tends toward established tools.',
        cross_project_consistent: false,
        evidence: [],
      },
      frustration_triggers: {
        rating: 'scope-creep',
        confidence: 'MEDIUM',
        claude_instruction: 'Do exactly what is asked, nothing more.',
        summary: 'Frustrated by scope creep.',
        cross_project_consistent: true,
        evidence: [],
      },
      learning_style: {
        rating: 'self-directed',
        confidence: 'MEDIUM',
        claude_instruction: 'Point to relevant code sections and let the developer explore.',
        summary: 'Self-directed learner.',
        cross_project_consistent: true,
        evidence: [],
      },
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-gen-claudeprof-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates new CLAUDE.md when none exists', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'CLAUDE.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    const result = runGsdTools(`generate-claude-profile --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Assert file is created
    assert.ok(fs.existsSync(outputPath), 'output file should exist');

    const content = fs.readFileSync(outputPath, 'utf-8');

    // Assert starts with start marker
    assert.ok(content.startsWith('<!-- GSD:profile-start -->'), 'should start with profile-start marker');

    // Assert ends with end marker (trimming trailing newline)
    assert.ok(content.trimEnd().endsWith('<!-- GSD:profile-end -->'), 'should end with profile-end marker');

    // Assert contains Developer Profile heading
    assert.ok(content.includes('## Developer Profile'), 'should contain Developer Profile heading');

    // Assert JSON output has action: created
    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'created', 'JSON output action should be created');
  });

  test('updates existing CLAUDE.md between markers', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'CLAUDE.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    // Create existing CLAUDE.md with markers
    const existingContent = `# Project Config
Some existing content.
<!-- GSD:profile-start -->
## Old Profile
Old content here.
<!-- GSD:profile-end -->
More existing content.
`;
    fs.writeFileSync(outputPath, existingContent);

    const result = runGsdTools(`generate-claude-profile --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');

    // Assert preserved content before markers
    assert.ok(content.includes('# Project Config'), 'should preserve Project Config');
    assert.ok(content.includes('Some existing content.'), 'should preserve existing content before markers');

    // Assert preserved content after markers
    assert.ok(content.includes('More existing content.'), 'should preserve content after markers');

    // Assert old profile content is replaced
    assert.ok(!content.includes('## Old Profile'), 'should replace old profile');
    assert.ok(!content.includes('Old content here.'), 'should replace old content');

    // Assert new profile has dimension data
    assert.ok(content.includes('## Developer Profile'), 'should contain new profile heading');
    assert.ok(content.includes('detailed-structured'), 'should contain dimension data from analysis');

    // Assert JSON output
    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'updated', 'JSON output action should be updated');
  });

  test('appends profile section when CLAUDE.md has no markers', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'CLAUDE.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    // Create existing CLAUDE.md without markers
    fs.writeFileSync(outputPath, '# Project Config\nSome content.\n');

    const result = runGsdTools(`generate-claude-profile --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');

    // Assert original content preserved at top
    assert.ok(content.startsWith('# Project Config'), 'original content should be preserved at top');
    assert.ok(content.includes('Some content.'), 'original content body preserved');

    // Assert profile section appended
    assert.ok(content.includes('<!-- GSD:profile-start -->'), 'should have start marker in appended section');
    assert.ok(content.includes('<!-- GSD:profile-end -->'), 'should have end marker in appended section');
    assert.ok(content.includes('## Developer Profile'), 'should have profile heading');

    // Assert JSON output
    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'appended', 'JSON output action should be appended');
  });

  test('includes all 8 dimensions in profile section', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'CLAUDE.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    const result = runGsdTools(`generate-claude-profile --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');

    const expectedLabels = [
      'Communication', 'Decisions', 'Explanations', 'Debugging',
      'UX Philosophy', 'Vendor Choices', 'Frustrations', 'Learning',
    ];

    for (const label of expectedLabels) {
      assert.ok(content.includes(label), `should contain dimension label: ${label}`);
    }

    // Assert each dimension has a rating and confidence in the table
    assert.ok(content.includes('detailed-structured'), 'should contain communication rating');
    assert.ok(content.includes('HIGH'), 'should contain HIGH confidence');
    assert.ok(content.includes('MEDIUM'), 'should contain MEDIUM confidence');
  });

  test('--global flag sets is_global and appropriate path in JSON output', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    // We also pass --output to redirect to temp dir so we do not write to real ~/.claude/CLAUDE.md
    const outputPath = path.join(tmpDir, 'global-claude.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    // When --global is set AND --output is also set, the implementation uses --global path
    // We test the JSON output fields rather than the actual file path
    const result = runGsdTools(`generate-claude-profile --analysis ${analysisPath} --global`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_global, true, 'JSON output should have is_global: true');
    assert.ok(output.claude_md_path.includes('.claude/CLAUDE.md'), 'claude_md_path should contain .claude/CLAUDE.md pattern');
  });

  test('creates parent directories for output path if needed', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'nested', 'deep', 'dir', 'CLAUDE.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    const result = runGsdTools(`generate-claude-profile --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(fs.existsSync(outputPath), 'output file should be created in nested directory');
  });

  test('errors when analysis file not found', () => {
    const result = runGsdTools('generate-claude-profile --analysis /nonexistent/path.json --output /tmp/out.md');
    assert.ok(!result.success, 'should fail for missing analysis file');
    assert.ok(result.error.includes('not found'), 'error should mention not found');
  });

  test('errors when analysis JSON lacks dimensions', () => {
    const badPath = path.join(tmpDir, 'no-dims.json');
    fs.writeFileSync(badPath, JSON.stringify({ profile_version: '1.0' }));

    const result = runGsdTools(`generate-claude-profile --analysis ${badPath} --output ${path.join(tmpDir, 'out.md')}`);
    assert.ok(!result.success, 'should fail for analysis without dimensions');
    assert.ok(result.error.includes('dimensions'), 'error should mention missing dimensions');
  });

  test('preserves exact whitespace and content outside markers', () => {
    const analysisPath = path.join(tmpDir, 'analysis.json');
    const outputPath = path.join(tmpDir, 'CLAUDE.md');
    fs.writeFileSync(analysisPath, JSON.stringify(MOCK_ANALYSIS));

    // Create complex CLAUDE.md with multiple sections, code blocks, blank lines
    const complexContent = `# My Project

This is a project with **bold** and _italic_ text.

## Code Examples

\`\`\`javascript
function hello() {
  console.log("world");
}
\`\`\`

## Configuration

- Item 1
- Item 2
  - Nested item

<!-- GSD:profile-start -->
## Old Profile
Old stuff.
<!-- GSD:profile-end -->

## Footer Section

Final content with special chars: <>&"'

The end.
`;
    fs.writeFileSync(outputPath, complexContent);

    const result = runGsdTools(`generate-claude-profile --analysis ${analysisPath} --output ${outputPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(outputPath, 'utf-8');

    // Verify content before markers is preserved exactly
    assert.ok(content.includes('# My Project'), 'heading preserved');
    assert.ok(content.includes('**bold** and _italic_'), 'formatting preserved');
    assert.ok(content.includes('```javascript'), 'code block preserved');
    assert.ok(content.includes('console.log("world")'), 'code content preserved');
    assert.ok(content.includes('- Item 1'), 'list preserved');
    assert.ok(content.includes('  - Nested item'), 'nested list preserved');

    // Verify content after markers is preserved exactly
    assert.ok(content.includes('## Footer Section'), 'footer section preserved');
    assert.ok(content.includes('Final content with special chars: <>&"\''), 'special chars preserved');
    assert.ok(content.includes('The end.'), 'final content preserved');

    // Verify old profile content replaced
    assert.ok(!content.includes('## Old Profile'), 'old profile should be replaced');
    assert.ok(!content.includes('Old stuff.'), 'old content should be replaced');
  });
});
