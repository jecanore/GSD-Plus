# Architecture Research

**Domain:** Developer profiling and workflow optimization for an AI coding assistant skill framework
**Researched:** 2026-02-12
**Confidence:** HIGH

## Standard Architecture

### System Overview

The GSD-Plus extension adds a profiling subsystem and four workflow enhancements that layer on top of the existing GSD architecture. The design principle: new components plug into existing layers (command, agent, workflow, CLI utility, template) rather than creating parallel infrastructure.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Command Layer                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ profile-user │ │dev-preferences│ │discuss-phase │ │  plan-phase  │   │
│  │  (new cmd)   │ │  (generated) │ │  (modified)  │ │  (modified)  │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
├─────────┴────────────────┴────────────────┴────────────────┴───────────┤
│                         Agent Layer                                     │
│  ┌──────────────┐                                                       │
│  │gsd-user-     │  (read-only, parallel analysis of session data)       │
│  │profiler      │                                                       │
│  └──────┬───────┘                                                       │
├─────────┴──────────────────────────────────────────────────────────────┤
│                         Workflow Layer                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │profile-user  │ │discuss-phase │ │  plan-phase  │ │execute-phase │   │
│  │  (new)       │ │  (advisor +) │ │  (brief +)   │ │(checklist +) │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
├─────────┴────────────────┴────────────────┴────────────────┴───────────┤
│                         CLI Utility Layer                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  gsd-tools.js  (+6 new subcommands)                             │    │
│  │  init profile-user | profile scan-sessions | profile extract-   │    │
│  │  messages | profile load | generate claude-md | assemble-brief  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────────────────┤
│                         Template Layer                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐              │
│  │user-     │ │claude-   │ │dev-preferences│ │phase-    │              │
│  │profile   │ │md        │ │-command       │ │brief     │              │
│  └──────────┘ └──────────┘ └───────────────┘ └──────────┘              │
├────────────────────────────────────────────────────────────────────────┤
│                         Data Layer                                      │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐   │
│  │ GLOBAL (per-user)     │  │ PROJECT (per-repo)                    │   │
│  │ ~/.claude/get-shit-   │  │ .planning/config.json                 │   │
│  │   done/USER-PROFILE.md│  │ .planning/phases/XX/XX-BRIEF.md       │   │
│  │ ~/.claude/commands/   │  │ .planning/phases/XX/XX-CONTEXT.md     │   │
│  │   dev-preferences.md  │  │ ./CLAUDE.md                           │   │
│  │ ~/.claude/projects/   │  │                                       │   │
│  │   */  (session JSONL) │  │                                       │   │
│  └───────────────────────┘  └───────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `/gsd:profile-user` command | Entry point: invoke profiling workflow | `commands/gsd/profile-user.md` with YAML frontmatter referencing `workflows/profile-user.md` |
| `gsd-user-profiler` agent | Analyze extracted messages against 8 dimensions, synthesize findings | `agents/gsd-user-profiler.md` with Read, Bash, Grep, Glob tools (read-only, no Write) |
| `profile-user` workflow | Orchestrate: consent, scan, extract, analyze, synthesize, generate | `get-shit-done/workflows/profile-user.md` with numbered steps, consent gate |
| `gsd-tools.js profile` subcommands | Server-side session data extraction (heavy I/O, keep out of agent context) | New functions in `gsd-tools.js`: `cmdProfileScanSessions()`, `cmdProfileExtractMessages()`, `cmdProfileLoad()` |
| `gsd-tools.js generate claude-md` | Assemble CLAUDE.md from profile + project artifacts | New function: `cmdGenerateClaudeMd()` |
| `gsd-tools.js assemble-brief` | Build phase brief from roadmap + research + context + cross-phase | New function: `cmdAssembleBrief()` |
| USER-PROFILE.md | Persistent developer behavioral profile (global, cross-project) | Markdown file at `~/.claude/get-shit-done/USER-PROFILE.md` |
| `/dev-preferences` command | Claude Code slash command that loads profile into session | Generated `.md` file at `~/.claude/commands/dev-preferences.md` |
| CLAUDE.md | Project-level instructions auto-loaded by Claude Code | Generated at project root from template + profile + project context |
| Phase brief | Assembled context document for planner (research + decisions + cross-phase) | `XX-BRIEF.md` in phase directory |

## Recommended Project Structure

New files within the existing GSD repository structure:

```
get-shit-done/                       # Existing repo root
├── agents/
│   └── gsd-user-profiler.md         # NEW: profiling agent definition
├── commands/gsd/
│   └── profile-user.md              # NEW: profiling command
├── get-shit-done/
│   ├── bin/
│   │   └── gsd-tools.js             # MODIFIED: +6 new subcommands
│   ├── templates/
│   │   ├── user-profile.md          # NEW: USER-PROFILE.md template
│   │   ├── claude-md.md             # NEW: CLAUDE.md generation template
│   │   ├── dev-preferences-cmd.md   # NEW: /dev-preferences command template
│   │   └── phase-brief.md           # NEW: phase brief assembly template
│   ├── workflows/
│   │   ├── profile-user.md          # NEW: profiling orchestration workflow
│   │   ├── discuss-phase.md         # MODIFIED: advisor mode additions
│   │   └── plan-phase.md            # MODIFIED: brief assembly at step 7.5
│   └── references/
│       └── user-profiling.md        # NEW: 8 analysis dimensions reference doc
```

Files generated at runtime (user's system):

```
~/.claude/
├── get-shit-done/
│   └── USER-PROFILE.md              # GENERATED: global developer profile
├── commands/
│   └── dev-preferences.md           # GENERATED: slash command from profile

[project-root]/
├── CLAUDE.md                        # GENERATED: project-level instructions
└── .planning/
    ├── config.json                  # MODIFIED: new preferences + profile keys
    └── phases/XX-name/
        └── XX-BRIEF.md              # GENERATED: assembled phase brief
```

### Structure Rationale

- **`agents/gsd-user-profiler.md`:** Follows existing pattern of one file per agent in the agents directory. Agent is read-only because it only analyzes pre-extracted data -- it never writes to session files or modifies user data.
- **Templates in `get-shit-done/templates/`:** Consistent with existing template location. Templates use `{{placeholder}}` markers that workflows fill during generation.
- **Profile at `~/.claude/get-shit-done/USER-PROFILE.md`:** Global scope because developer preferences persist across projects. Stored within the GSD installation directory (not `~/.claude/` root) because GSD manages its own namespace.
- **`/dev-preferences` command at `~/.claude/commands/`:** Claude Code auto-discovers commands by file presence in this directory. A generated `.md` file makes the profile accessible via `/dev-preferences` in any session.
- **Phase brief in phase directory:** Follows existing pattern of phase artifacts alongside PLAN.md, CONTEXT.md, RESEARCH.md. Naming convention: `XX-BRIEF.md` (e.g., `01-BRIEF.md`).

## Architectural Patterns

### Pattern 1: Heavy Lifting in gsd-tools.js, Reasoning in Agents

**What:** Session data extraction (scanning JSONL files, parsing messages, computing statistics) happens in `gsd-tools.js` as Node.js operations. The agent receives only the extracted, size-reduced output for analysis.

**When to use:** Any time raw data exceeds what fits in agent context (~200KB threshold). Session JSONL files can be 3-7MB each.

**Trade-offs:**
- Pro: Agents get clean, right-sized data. No context window waste on raw JSON parsing.
- Pro: Node.js handles file I/O natively (synchronous reads matching existing patterns).
- Con: More code in the already-large gsd-tools.js monolith.
- Con: Two-step process (extract then analyze) rather than direct agent access.

**Example:**

```javascript
// In gsd-tools.js - cmdProfileScanSessions()
function cmdProfileScanSessions(cwd, raw) {
  const homedir = require('os').homedir();
  const projectsDir = path.join(homedir, '.claude', 'projects');

  // Scan all project directories for session JSONL files
  const projects = [];
  try {
    const dirs = fs.readdirSync(projectsDir);
    for (const dir of dirs) {
      const fullDir = path.join(projectsDir, dir);
      const stat = fs.statSync(fullDir);
      if (!stat.isDirectory()) continue;

      const jsonlFiles = fs.readdirSync(fullDir)
        .filter(f => f.endsWith('.jsonl'));

      projects.push({
        project_key: dir,
        session_count: jsonlFiles.length,
        total_bytes: jsonlFiles.reduce((sum, f) => {
          return sum + fs.statSync(path.join(fullDir, f)).size;
        }, 0),
      });
    }
  } catch {}

  output({
    projects,
    total_sessions: projects.reduce((s, p) => s + p.session_count, 0),
    total_bytes: projects.reduce((s, p) => s + p.total_bytes, 0),
  }, raw);
}

// In gsd-tools.js - cmdProfileExtractMessages()
function cmdProfileExtractMessages(cwd, projectKey, sessionId, raw) {
  const homedir = require('os').homedir();
  const sessionPath = path.join(
    homedir, '.claude', 'projects', projectKey, sessionId + '.jsonl'
  );

  const messages = [];
  const content = safeReadFile(sessionPath);
  if (!content) { output({ error: 'session not found' }, raw); return; }

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'user' && obj.message?.content) {
        const text = typeof obj.message.content === 'string'
          ? obj.message.content
          : obj.message.content
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('\n');

        // Privacy: only extract user messages, strip tool outputs
        messages.push({
          timestamp: obj.timestamp,
          text: text.slice(0, 2000), // Truncate very long messages
        });
      }
    } catch {}
  }

  output({ session_id: sessionId, message_count: messages.length, messages }, raw);
}
```

### Pattern 2: Global-then-Project Configuration Layering

**What:** Profile data lives globally at `~/.claude/get-shit-done/USER-PROFILE.md`. Project-specific overrides or preferences live in `.planning/config.json` under a `preferences` key. When generating CLAUDE.md or assembling briefs, both layers merge with project-level taking precedence.

**When to use:** Any setting that has a sensible global default but may need per-project override (e.g., explanation depth, commit message style).

**Trade-offs:**
- Pro: New projects inherit existing profile without re-running profiling.
- Pro: Project-specific context (like "this project uses TDD") overrides global defaults.
- Con: Two-layer merge logic adds complexity to `loadConfig()`.

**Example:**

```javascript
// Extended loadConfig() pattern - add preferences merging
function loadProfilePreferences(cwd) {
  const homedir = require('os').homedir();
  const globalProfile = path.join(homedir, '.claude', 'get-shit-done', 'USER-PROFILE.md');
  const projectConfig = path.join(cwd, '.planning', 'config.json');

  // Load global profile (markdown frontmatter or extracted sections)
  const profile = safeReadFile(globalProfile);

  // Load project preferences
  let projectPrefs = {};
  try {
    const config = JSON.parse(fs.readFileSync(projectConfig, 'utf-8'));
    projectPrefs = config.preferences || {};
  } catch {}

  return {
    profile_exists: !!profile,
    profile_path: globalProfile,
    project_preferences: projectPrefs,
    // Merged values: project overrides global
    explanation_depth: projectPrefs.explanation_depth || 'from-profile',
    commit_style: projectPrefs.commit_style || 'from-profile',
  };
}
```

### Pattern 3: Template-Driven Generation with Placeholder Substitution

**What:** CLAUDE.md and `/dev-preferences` are generated from templates with `{{placeholder}}` markers. gsd-tools.js reads the template, substitutes values from profile + project context, writes the output file.

**When to use:** Any generated file that mixes static structure with dynamic content. Templates live in `get-shit-done/templates/`, generated files live at their target location.

**Trade-offs:**
- Pro: Users can customize templates before generation (fork the template).
- Pro: Clear separation between structure (template) and data (profile/config).
- Con: Placeholder syntax must be documented and validated.

**Example:**

```javascript
// In gsd-tools.js - cmdGenerateClaudeMd()
function cmdGenerateClaudeMd(cwd, raw) {
  const homedir = require('os').homedir();
  const templatePath = path.join(homedir, '.claude', 'get-shit-done', 'templates', 'claude-md.md');
  const profilePath = path.join(homedir, '.claude', 'get-shit-done', 'USER-PROFILE.md');
  const projectPath = path.join(cwd, '.planning', 'PROJECT.md');

  const template = safeReadFile(templatePath);
  const profile = safeReadFile(profilePath);
  const project = safeReadFile(projectPath);

  if (!template) { output({ error: 'template not found' }, raw); return; }

  // Extract profile sections for substitution
  const substitutions = {
    '{{communication_style}}': extractSection(profile, 'Communication Style') || '',
    '{{explanation_depth}}': extractSection(profile, 'Explanation Depth') || '',
    '{{project_name}}': extractField(project, 'name') || path.basename(cwd),
    '{{tech_stack}}': extractSection(project, 'Stack') || '',
    // ... more substitutions
  };

  let output_content = template;
  for (const [key, value] of Object.entries(substitutions)) {
    output_content = output_content.replace(new RegExp(escapeRegex(key), 'g'), value);
  }

  fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), output_content, 'utf-8');
  output({ generated: true, path: path.join(cwd, 'CLAUDE.md') }, raw);
}
```

### Pattern 4: Phase Brief Assembly (Context Threading)

**What:** Before the planner receives phase context, a brief is assembled from multiple sources: roadmap phase description, research findings, CONTEXT.md decisions, and cross-phase context from previous phases. This assembled brief replaces the current ad-hoc context loading in `plan-phase.md` step 7.

**When to use:** The brief assembly step runs at step 7.5 of `plan-phase.md` (after research completes, before planner spawns). It also runs in `execute-phase.md` to give executors relevant cross-phase context.

**Trade-offs:**
- Pro: Single document gives planner complete, curated context rather than raw file dumps.
- Pro: Cross-phase threading happens here (not in agent prompts), keeping agent prompts stable.
- Con: Another generated file in the phase directory.
- Con: Must be re-assembled if upstream docs change.

**Example:**

```javascript
// In gsd-tools.js - cmdAssembleBrief()
function cmdAssembleBrief(cwd, phaseNum, raw) {
  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) { output({ error: 'phase not found' }, raw); return; }

  const phaseDirFull = path.join(cwd, phaseInfo.directory);

  // Gather sources
  const roadmap = safeReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
  const phaseSection = extractPhaseSection(roadmap, phaseNum);

  const contextFile = findFileByPattern(phaseDirFull, '*-CONTEXT.md');
  const contextContent = contextFile ? safeReadFile(contextFile) : null;

  const researchFile = findFileByPattern(phaseDirFull, '*-RESEARCH.md');
  const researchContent = researchFile ? safeReadFile(researchFile) : null;

  // Cross-phase context: scan previous phase summaries for carry-forward items
  const crossPhase = gatherCrossPhaseContext(cwd, phaseNum);

  // Profile preferences (if available)
  const homedir = require('os').homedir();
  const profile = safeReadFile(path.join(homedir, '.claude', 'get-shit-done', 'USER-PROFILE.md'));
  const profileSummary = profile ? extractSection(profile, 'Summary') : null;

  // Assemble brief
  const brief = assembleBriefContent({
    phase_number: phaseNum,
    phase_name: phaseInfo.phase_name,
    phase_goal: phaseSection,
    context_decisions: contextContent,
    research_findings: researchContent,
    cross_phase: crossPhase,
    developer_preferences: profileSummary,
  });

  const briefPath = path.join(phaseDirFull,
    `${phaseInfo.phase_number.padStart(2, '0')}-BRIEF.md`);
  fs.writeFileSync(briefPath, brief, 'utf-8');

  output({ generated: true, path: briefPath, sources_used: {
    roadmap: !!phaseSection,
    context: !!contextContent,
    research: !!researchContent,
    cross_phase: crossPhase.length > 0,
    profile: !!profileSummary,
  }}, raw);
}
```

## Data Flow

### Profiling Flow

```
User runs /gsd:profile-user
    │
    ▼
profile-user workflow (consent gate)
    │
    ├─── gsd-tools.js profile scan-sessions
    │    │
    │    ▼
    │    Scan ~/.claude/projects/*/
    │    Return: { projects[], total_sessions, total_bytes }
    │
    ├─── gsd-tools.js profile extract-messages (per session)
    │    │
    │    ▼
    │    Parse JSONL → extract type="user" messages only
    │    Truncate to ~200KB per session
    │    Return: { messages[], message_count }
    │
    ├─── Spawn gsd-user-profiler agent (parallel analysis)
    │    │
    │    ▼
    │    Analyze extracted messages against 8 dimensions:
    │    communication, decision speed, explanation depth,
    │    debugging, UX preferences, vendor patterns,
    │    frustration signals, learning style
    │    │
    │    ▼
    │    Write USER-PROFILE.md → ~/.claude/get-shit-done/
    │
    ├─── Generate /dev-preferences command
    │    │
    │    ▼
    │    Fill dev-preferences-cmd.md template with profile
    │    Write → ~/.claude/commands/dev-preferences.md
    │
    └─── Optionally generate CLAUDE.md
         │
         ▼
         gsd-tools.js generate claude-md
         Fill claude-md.md template with profile + project context
         Write → ./CLAUDE.md
```

### CLAUDE.md Generation Flow

```
gsd-tools.js generate claude-md
    │
    ├── Read template:     ~/.claude/get-shit-done/templates/claude-md.md
    ├── Read profile:      ~/.claude/get-shit-done/USER-PROFILE.md
    ├── Read project:      .planning/PROJECT.md
    ├── Read config:       .planning/config.json
    ├── Read stack:         .planning/codebase/STACK.md (if exists)
    ├── Read conventions:  .planning/codebase/CONVENTIONS.md (if exists)
    │
    ▼
    Substitute {{placeholders}} with extracted values
    │
    ▼
    Write → ./CLAUDE.md (project root)
    │
    ▼
    Claude Code auto-loads CLAUDE.md into system prompt on next session
```

### Phase Brief Assembly Flow

```
plan-phase workflow step 7.5 (after research, before planner)
    │
    ▼
gsd-tools.js assemble-brief --phase N
    │
    ├── Read ROADMAP.md → extract phase section
    ├── Read XX-CONTEXT.md → user decisions from discuss-phase
    ├── Read XX-RESEARCH.md → research findings
    ├── Scan previous phases → cross-phase carry-forward
    │   │
    │   ▼
    │   For each completed prior phase:
    │     Read SUMMARY.md → extract decisions, patterns discovered
    │     Filter for items tagged as "carry-forward" or "affects future"
    │     Include only items relevant to current phase scope
    │
    ├── Read USER-PROFILE.md → developer preferences summary
    │
    ▼
    Assemble XX-BRIEF.md with sections:
    ├── Phase Goal (from roadmap)
    ├── User Decisions (from CONTEXT.md)
    ├── Research Findings (from RESEARCH.md)
    ├── Cross-Phase Context (from prior SUMMARY.md files)
    └── Developer Preferences (from USER-PROFILE.md)
    │
    ▼
    Write → .planning/phases/XX-name/XX-BRIEF.md
    │
    ▼
    Planner receives brief content in prompt (step 8)
```

### Advisor Mode Flow (discuss-phase enhancement)

```
/gsd:discuss-phase N
    │
    ▼
Existing flow: identify gray areas, present to user
    │
    ├── User selects "Advisor mode" for a gray area
    │   │
    │   ▼
    │   Orchestrator triggers research on the specific question:
    │   1. Spawn gsd-phase-researcher with focused query
    │   2. Researcher returns comparison data
    │   3. Present comparison table inline:
    │      ┌─────────┬──────────┬──────────┐
    │      │ Option  │ Pros     │ Cons     │
    │      ├─────────┼──────────┼──────────┤
    │      │ A       │ ...      │ ...      │
    │      │ B       │ ...      │ ...      │
    │      └─────────┴──────────┴──────────┘
    │   4. User picks option → captured in CONTEXT.md
    │
    └── Continue with standard discuss-phase flow
```

### Key Data Flows

1. **Profile creation:** Session JSONL (raw, 3-7MB) → gsd-tools.js extraction (200-500KB) → agent analysis → USER-PROFILE.md (10-20KB)
2. **Profile consumption:** USER-PROFILE.md → CLAUDE.md template substitution → CLAUDE.md (auto-loaded by Claude Code)
3. **Brief assembly:** ROADMAP + CONTEXT + RESEARCH + prior SUMMARY files → assembled BRIEF.md → planner prompt
4. **Cross-phase threading:** Previous phase SUMMARY.md files → filtered carry-forward items → current phase BRIEF.md → planner/executor context
5. **Config extension:** Existing `loadConfig()` → new `preferences` and `profile` keys → backward-compatible merge with defaults

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-20 sessions | Full session extraction, single profiler agent run. Simple, fast (~30s total). |
| 20-100 sessions | Batch extraction with sampling. Extract most recent 50 sessions fully, skim older ones for patterns. Profile refresh takes ~2 minutes. |
| 100+ sessions | Incremental profiling: keep previous profile, only analyze sessions since last profile date. gsd-tools.js tracks `last_profiled_at` timestamp. Profile refresh takes ~1 minute (delta only). |

### Scaling Priorities

1. **First bottleneck: Session extraction I/O.** With 100+ sessions at 3-7MB each, reading all JSONL files takes 5-10 seconds. Mitigation: `profile scan-sessions` returns metadata (size, count, last modified) so the workflow can intelligently sample rather than extracting all sessions.

2. **Second bottleneck: Agent context window.** Even after extraction, 100 sessions x 50 messages each = 5,000 messages. Cannot fit in one agent context. Mitigation: Extract statistical summaries in gsd-tools.js (word frequency, message length distribution, command usage patterns) and pass summaries to agent rather than raw messages. Agent receives patterns, not transcripts.

3. **Third bottleneck: Cross-phase context accumulation.** After 20+ phases, prior SUMMARY.md files could total 100KB+. Mitigation: `assemble-brief` uses `history-digest` (existing gsd-tools.js command) to get structured phase summaries, then filters to only carry-forward items relevant to the current phase.

## Anti-Patterns

### Anti-Pattern 1: Agent Reads Raw Session Files

**What people do:** Give the profiler agent direct Read access to `~/.claude/projects/*/` and let it parse JSONL itself.
**Why it's wrong:** Session files are 3-7MB. JSONL parsing in an agent context wastes tokens on JSON structure rather than content analysis. One 7MB file would consume the entire context window before analysis begins.
**Do this instead:** Extract user messages server-side in gsd-tools.js (`profile extract-messages`). Pass only the extracted text (200-500KB) to the agent. The agent's job is behavioral analysis, not data extraction.

### Anti-Pattern 2: Storing Profile in .planning/

**What people do:** Put USER-PROFILE.md in `.planning/` (project-scoped) because that's where all other GSD state lives.
**Why it's wrong:** The profile describes the developer, not the project. A developer's communication style doesn't change between projects. If stored per-project, users must re-profile for every new project.
**Do this instead:** Store at `~/.claude/get-shit-done/USER-PROFILE.md` (global). Allow per-project overrides via `.planning/config.json` `preferences` key for project-specific deviations.

### Anti-Pattern 3: Injecting Full Profile into Every Agent Prompt

**What people do:** Pass the entire USER-PROFILE.md (10-20KB) into every agent spawn (planner, executor, researcher, verifier).
**Why it's wrong:** Most agents don't need full behavioral profile. The planner needs to know explanation depth and commit style. The executor needs to know coding conventions. Injecting full profile into every agent wastes 10-20KB of context per spawn across a workflow that may spawn 15+ agents.
**Do this instead:** CLAUDE.md provides session-wide defaults (loaded once by Claude Code). For agent-specific needs, extract only the relevant section via `gsd-tools.js profile load --section communication` and include the 200-500 byte extract in the prompt.

### Anti-Pattern 4: Mutable Cross-Phase Context File

**What people do:** Create a single `CROSS-PHASE-CONTEXT.md` file that accumulates all decisions across phases, growing unboundedly.
**Why it's wrong:** After 20 phases, this file becomes 50KB+ and mostly irrelevant. Earlier phase decisions get stale. The file becomes a second STATE.md with worse organization.
**Do this instead:** Cross-phase context is assembled on-demand by `assemble-brief`. It reads prior SUMMARY.md files, filters for carry-forward items, and includes only what's relevant to the current phase. No persistent accumulation file.

### Anti-Pattern 5: Profile Updates During Active Sessions

**What people do:** Try to update USER-PROFILE.md in real-time as the user works (observing patterns live).
**Why it's wrong:** The project context states this is out of scope for good reason. Real-time profiling adds complexity (file locking, race conditions with multiple sessions) without proportional value. Profiles are stable over weeks/months, not minutes.
**Do this instead:** Profiles refresh on-demand via `/gsd:profile-user`. The user decides when to update. Incremental profiling (delta analysis since last profile) handles efficiency.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Code session storage | Read-only access to `~/.claude/projects/*/` | JSONL files are Claude Code's internal format; no guarantee of stability across versions. Parse defensively with try/catch per line. |
| Claude Code CLAUDE.md loading | Write to `./CLAUDE.md` at project root | Auto-loaded into system prompt. File must exist at project root (not `.planning/`). Claude Code reads on session start. |
| Claude Code commands discovery | Write `.md` to `~/.claude/commands/` | Claude Code auto-discovers slash commands by file presence. Name becomes command name. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Workflow → gsd-tools.js | JSON over stdout (`node gsd-tools.js <cmd>`) | All new subcommands follow existing pattern: function takes `(cwd, args, raw)`, outputs via `output(result, raw)`. |
| Workflow → Agent | Task() spawn with prompt string | Agent receives pre-extracted data in prompt, not file references (files won't resolve across Task() boundary). |
| Agent → Filesystem | Write to specific output path | Profiler writes USER-PROFILE.md; pattern matches existing agent outputs (planners write PLAN.md, mappers write ARCHITECTURE.md). |
| Profile → Config | `preferences` key in `.planning/config.json` | New key alongside existing keys. `loadConfig()` returns defaults if key missing — backward compatible. |
| Brief → Planner | Brief content passed in planner prompt | Replaces ad-hoc context loading. Brief content substituted at step 8 of `plan-phase.md` where `{context_content}` currently goes. |

### Config Extension

New keys added to `.planning/config.json`:

```json
{
  "existing_keys": "...",
  "preferences": {
    "explanation_depth": "concise|standard|detailed",
    "commit_style": "conventional|descriptive|minimal",
    "code_comments": "minimal|standard|verbose"
  },
  "profile": {
    "enabled": true,
    "last_profiled": "2026-02-12T00:00:00Z",
    "session_count_at_profile": 82,
    "profile_path": "~/.claude/get-shit-done/USER-PROFILE.md"
  }
}
```

### MODEL_PROFILES Extension

New entry in gsd-tools.js `MODEL_PROFILES`:

```javascript
const MODEL_PROFILES = {
  // ... existing entries ...
  'gsd-user-profiler': { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
};
```

Rationale: Profiling is a reasoning-heavy task (behavioral pattern extraction from text). Opus for quality tier, Sonnet for balanced/budget because profiling runs infrequently and Sonnet handles text analysis well.

## Build Order Implications

Components have clear dependencies that dictate build sequence:

```
Phase 1: Foundation (no dependencies)
├── gsd-tools.js profile subcommands (scan-sessions, extract-messages)
├── user-profiling.md reference doc (8 dimensions)
└── user-profile.md template

Phase 2: Profiling Pipeline (depends on Phase 1)
├── gsd-user-profiler agent definition
├── profile-user workflow
├── /gsd:profile-user command
└── dev-preferences-cmd.md template + generation

Phase 3: CLAUDE.md Generation (depends on Phase 2)
├── claude-md.md template
├── gsd-tools.js generate claude-md subcommand
└── Integration into new-project workflow (preferences interview)

Phase 4: Workflow Enhancements (depends on Phase 2, parallel with Phase 3)
├── Advisor mode in discuss-phase
├── Phase brief assembly (assemble-brief subcommand + plan-phase integration)
├── Structured plan checklists
└── Cross-phase context threading in assemble-brief

Phase 5: Integration Testing & Polish
├── End-to-end: profile → CLAUDE.md → plan-phase with brief
├── Backward compatibility validation (existing projects without profile)
└── Documentation updates
```

**Key dependency:** Phase 2 depends on Phase 1 because the profiling workflow calls `gsd-tools.js profile` subcommands. Phase 3 and Phase 4 can run in parallel because CLAUDE.md generation and workflow enhancements both consume the profile but don't depend on each other.

**Critical path:** Phase 1 → Phase 2 → Phase 4 (brief assembly). CLAUDE.md generation (Phase 3) is valuable but not on the critical path for workflow improvements.

## Sources

- Source code analysis: `/Users/canodevelopment/coding-portfolio/get-shit-done/` (direct codebase examination)
- Existing architecture docs: `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `CONCERNS.md`, `STACK.md`
- Project specification: `.planning/PROJECT.md` (requirements, constraints, key decisions)
- Workflow patterns: `get-shit-done/workflows/new-project.md`, `plan-phase.md`, `discuss-phase.md`, `execute-phase.md`
- Config patterns: `get-shit-done/bin/gsd-tools.js` (loadConfig, MODEL_PROFILES, init commands)
- Session data format: Direct examination of `~/.claude/projects/*/` JSONL files (verified message structure: `{type, userType, message: {content, role}, timestamp}`)
- Claude Code integration: Settings at `~/.claude/settings.json`, commands at `~/.claude/commands/`, CLAUDE.md at project root

**Confidence notes:**
- HIGH confidence on existing architecture patterns (verified by direct code examination)
- HIGH confidence on session JSONL format (verified by parsing actual files)
- HIGH confidence on gsd-tools.js extension patterns (following existing code conventions)
- MEDIUM confidence on Claude Code CLAUDE.md auto-loading behavior (verified by training data knowledge + project context states it works this way, but did not verify in official docs due to WebSearch unavailability)
- MEDIUM confidence on `~/.claude/commands/` auto-discovery (project context asserts this, consistent with training data, but not independently verified)

---
*Architecture research for: GSD-Plus developer profiling and workflow optimizations*
*Researched: 2026-02-12*
