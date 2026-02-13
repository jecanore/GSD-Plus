# Phase 2: Profiling Engine - Research

**Researched:** 2026-02-13
**Domain:** LLM-based behavioral profiling, agent prompt design, markdown document generation, questionnaire UX
**Confidence:** HIGH

## Summary

Phase 2 builds the profiling engine that converts extracted session messages (from Phase 1's `extract-messages` output) into an evidence-backed developer profile stored at `~/.claude/get-shit-done/USER-PROFILE.md`. The engine has three deliverables: (1) a `gsd-user-profiler` agent that analyzes user messages across 8 behavioral dimensions with confidence scoring, (2) a reference document (`user-profiling.md`) that defines detection heuristics, signal patterns, example quotes, and scoring rules for all 8 dimensions, and (3) a questionnaire fallback path that produces the same profile structure when session data is unavailable.

The core design insight is that the LLM IS the analysis engine. There is no NLP library, no embedding model, no ML pipeline. The profiler agent receives pre-extracted JSONL messages (up to 300 messages, each truncated to 2000 chars -- roughly 200-500KB total) and applies the heuristics defined in `user-profiling.md` to score each dimension. This is a prompt engineering problem, not a machine learning problem. The reference document is the critical artifact because it encodes what the agent looks for, how it scores confidence, and what constitutes evidence -- making profiling reproducible and auditable.

The second insight is about sampling bias. Real-world session data on this machine shows 104 sessions from housingbase, 92 from Boomer-AI, but only 1 from the home directory project. Without project-proportional sampling and recency weighting, the profile would reflect housingbase/Boomer-AI patterns disproportionately. PROF-06 addresses this by capping sessions per project and weighting recent sessions higher. The Phase 1 `extract-messages` command already sorts sessions by `modified` descending and caps at 300 messages total, but project-proportional sampling must be implemented as a layer on top (either in a new gsd-tools.js subcommand or in the orchestrating workflow).

**Primary recommendation:** Build three artifacts: (1) `get-shit-done/references/user-profiling.md` as the dimension reference doc with detection heuristics, (2) `agents/gsd-user-profiler.md` as the agent definition that references the doc, (3) a `profile-sample` or similar gsd-tools.js subcommand that implements project-proportional sampling with recency weighting before feeding data to the profiler. The questionnaire fallback is a set of 8 AskUserQuestion prompts that produce the same JSON structure the agent outputs. USER-PROFILE.md is written by the orchestrating workflow (Phase 3), not by this phase -- Phase 2 produces the analysis output, Phase 3 writes the file.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | Built-in (v22.17.0) | Read/write USER-PROFILE.md, read extracted JSONL | Zero-dependency constraint |
| Node.js `path` | Built-in | Path resolution for profile location | Zero-dependency constraint |
| Node.js `os` | Built-in | `os.homedir()` for `~/.claude/get-shit-done/` | Zero-dependency constraint |
| Node.js `readline` | Built-in | Read extracted JSONL from Phase 1 temp file | Already imported in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `streamExtractMessages()` | Phase 1 | Read JSONL messages from temp file | When profiler needs to read Phase 1 output |
| Existing `scanProjectDir()` | Phase 1 | Enumerate sessions per project for sampling | Project-proportional sampling |
| Existing `getProjectName()` | Phase 1 | Resolve project names for cross-project analysis | Profile evidence attribution |
| Existing `loadConfig()` | Phase 1 | Read `preferences` and `profile` keys | Check existing profile state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LLM-based analysis via agent | NLP library (compromise, natural) | Would add external dependencies; LLM handles nuanced behavioral analysis better than keyword matching |
| Markdown USER-PROFILE.md | JSON profile | Markdown is human-readable, editable, and follows GSD convention; JSON would need a renderer |
| AskUserQuestion for questionnaire | CLI readline prompts | AskUserQuestion is the established GSD pattern; readline would break the agent interaction model |
| Single profiler agent run | Multiple parallel agent runs per dimension | Single run is simpler, cheaper; parallel only needed if context window is insufficient for all 300 messages |

**Installation:**
```bash
# No installation needed -- all built-in Node.js modules and existing Phase 1 functions
```

## Architecture Patterns

### Recommended Project Structure
```
agents/
  gsd-user-profiler.md           # NEW: profiler agent definition
get-shit-done/
  bin/
    gsd-tools.js                 # MODIFIED: +profile-sample subcommand
    gsd-tools.test.js            # MODIFIED: +profiling tests
  references/
    user-profiling.md            # NEW: 8-dimension detection heuristics reference doc
  templates/
    user-profile.md              # NEW: USER-PROFILE.md template with sections
```

### Pattern 1: Reference-Guided Agent Analysis
**What:** The profiler agent is given a reference document (`user-profiling.md`) that defines exactly what to look for per dimension. The agent applies the heuristics, does not invent its own.
**When to use:** Any LLM-based analysis that must be reproducible and auditable.
**Why this matters:** Without a reference doc, the LLM will hallucinate patterns, apply inconsistent scoring, and produce different results on re-runs. The reference doc acts as the "rubric" -- same rubric, same data, comparable results.

**Example reference doc structure (per dimension):**
```markdown
### Dimension 1: Communication Style

**What we're measuring:** How the developer phrases requests, instructions, and feedback to Claude.

**Signal patterns:**
- **Terse/Direct:** Short messages (<50 words), imperative mood ("fix this", "add X"), minimal context
- **Conversational:** Medium messages (50-200 words), questions mixed with instructions, thinking out loud
- **Detailed/Structured:** Long messages (200+ words), numbered lists, explicit context, pre-analysis

**Detection heuristics:**
1. Average message length across all sessions
2. Ratio of imperative sentences to questions
3. Presence of structured formatting (numbered lists, headers, code blocks)
4. Context-providing preamble before requests

**Confidence scoring:**
- HIGH: 10+ messages showing consistent pattern, same pattern across 2+ projects
- MEDIUM: 5-9 messages or pattern consistent within 1 project only
- LOW: <5 messages or mixed signals (some terse, some detailed)

**Example quotes (what each style looks like):**
- Terse: "fix the auth bug" / "add dark mode" / "this is broken"
- Conversational: "I'm thinking we should probably add dark mode. What do you think about using Tailwind's dark: prefix?"
- Detailed: "## Context\nThe auth flow currently uses...\n## Problem\n...\n## What I've tried\n..."
```

### Pattern 2: Structured Analysis Output
**What:** The profiler agent outputs a structured JSON analysis (not free-form markdown), which the orchestrator then renders into USER-PROFILE.md using a template.
**When to use:** When agent output needs to be consumed programmatically by a downstream step.
**Why this matters:** Free-form markdown from an LLM is unreliable for parsing. JSON output with defined schema ensures the orchestrator can reliably populate the profile template. The agent uses the existing output format convention (structured data returned to orchestrator).

**Example agent output structure:**
```json
{
  "dimensions": {
    "communication_style": {
      "rating": "detailed-structured",
      "confidence": "HIGH",
      "evidence_count": 23,
      "evidence_quotes": [
        {
          "quote": "## Context\nThe auth flow currently uses JWT...",
          "session_id": "abc123",
          "project": "Boomer-AI",
          "signal": "Uses markdown headers and structured context before requests"
        }
      ],
      "summary": "Consistently provides structured context with headers, numbered lists, and explicit problem statements before requests.",
      "claude_instruction": "Match this developer's structured communication: use headers for sections, numbered lists for steps, and always acknowledge their provided context before responding."
    }
  }
}
```

### Pattern 3: Project-Proportional Sampling
**What:** Before feeding messages to the profiler, sample from each project proportionally, capped per-project, with recency weighting.
**When to use:** Any cross-project analysis where one project could dominate.
**Why this matters:** housingbase has 104 sessions but Swaggie has 35. Without proportional sampling, housingbase patterns overwhelm everything else. The batch limit is 300 messages total (PIPE-05).

**Sampling algorithm:**
```
Input: projects[] with session lists, batchLimit = 300
1. Sort projects by lastActive descending
2. Calculate per-project cap: max(5, floor(batchLimit / projectCount))
3. For each project:
   a. Sort sessions by modified descending (most recent first)
   b. Extract messages from sessions until hitting per-project cap
   c. Apply recency weighting: recent sessions get full message extraction,
      older sessions get summary/sample only
4. Combine all messages, cap at batchLimit total
5. Output as JSONL to temp file
```

### Pattern 4: Questionnaire-to-Profile Mapping
**What:** Each questionnaire question maps directly to one dimension. The answer determines the rating for that dimension. All questionnaire-generated dimensions get confidence: LOW (because self-report, not observed behavior).
**When to use:** When user opts out of session analysis or has no sessions.
**Why this matters:** The questionnaire must produce the exact same profile structure as session analysis. Downstream consumers (CLAUDE.md generation, /dev-preferences, phase briefs) should not care whether the profile came from analysis or questionnaire.

**Example question-to-dimension mapping:**
```markdown
Question: "When you ask Claude to build something, how much context do you typically provide?"
Dimension: communication_style
Options:
  A) "Just tell it what to build -- 'add dark mode', 'fix the bug'" -> terse-direct
  B) "I explain what I want and why, usually a paragraph or two" -> conversational
  C) "I write detailed specs with context, problem statement, and constraints" -> detailed-structured
  D) "It varies -- depends on the task complexity" -> mixed (confidence: LOW)
```

### Anti-Patterns to Avoid

- **Letting the agent invent dimensions:** The 8 dimensions are fixed. The reference doc defines them. The agent scores against them, not beyond them.
- **Free-form agent output:** Agent must return structured data (JSON or structured markdown), not a prose essay about the developer. Prose is unreliable for downstream consumption.
- **Profiling from a single project:** Even if one project has 100 sessions, the profile should reflect cross-project behavior. Single-project evidence gets lower confidence.
- **Storing raw quotes with sensitive content:** Evidence quotes should be curated. Quotes containing API keys, passwords, or proprietary code should be excluded. The filter in Phase 1 already excludes code content, but agent should double-check.
- **Making the profile prescriptive:** The profile describes observed behavior. It does not tell the developer how to behave. "You tend to..." not "You should..."
- **Overconfidence from self-report:** Questionnaire answers are self-perception, not observed behavior. Always mark questionnaire-derived dimensions as LOW confidence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Behavioral NLP analysis | Custom keyword matching, sentiment analysis, regex patterns | LLM agent with reference doc heuristics | LLM handles nuance (sarcasm, context, implicit signals) that rules-based systems miss |
| Message sampling across projects | Custom random sampling algorithm | Deterministic proportional sampling with `scanProjectDir()` output | Reproducible sampling ensures same data produces same profile |
| Profile template rendering | Custom markdown string concatenation | Template file with `{{placeholder}}` substitution | Existing GSD pattern, separates structure from data, enables user customization |
| Dimension scoring | Custom scoring function with weighted averages | LLM judgment guided by reference doc rubric | Scoring requires contextual reasoning (is "fix this" terse or just appropriate for a bug report?) |
| AskUserQuestion implementation | Custom readline prompts | Existing GSD `AskUserQuestion` pattern | Established interaction model, works across Claude Code/OpenCode/Gemini |

**Key insight:** The LLM IS the analysis engine. The reference document IS the model. The template IS the renderer. Everything else is data plumbing that uses existing Phase 1 infrastructure.

## Common Pitfalls

### Pitfall 1: Confirmation Bias in LLM Analysis
**What goes wrong:** The LLM finds patterns even when there is insufficient data. It over-fits to a few messages and reports HIGH confidence.
**Why it happens:** LLMs are trained to be helpful and find patterns. When asked "what is this developer's communication style?", the LLM will always answer -- even from 2 messages.
**How to avoid:** The reference doc must define minimum evidence thresholds per confidence level. HIGH requires 10+ consistent signals across 2+ projects. MEDIUM requires 5-9. LOW requires fewer. The agent prompt must explicitly state: "If evidence is insufficient, report confidence: LOW and note 'insufficient data' -- do not guess."
**Warning signs:** All 8 dimensions rated HIGH from a user with 10 total messages. Or all dimensions showing the same confidence level regardless of evidence count.

### Pitfall 2: Profile Overfitting to Dominant Project
**What goes wrong:** Profile reflects patterns from the project with the most sessions (104 sessions from housingbase) and ignores smaller projects.
**Why it happens:** Without proportional sampling, 104/300 batch messages come from one project. That project's domain (real estate) shapes the profile: "developer uses structured specs" might just be "developer uses structured specs for real estate projects."
**How to avoid:** PROF-06 requires project-proportional sampling. Cap sessions per project (e.g., max 20 per project). Weight recent sessions higher. Include messages from ALL projects that have sessions, not just the largest. The profiler should note cross-project consistency in its confidence scoring.
**Warning signs:** Profile evidence quotes all come from one project. Cross-project consistency field shows "single project only."

### Pitfall 3: Questionnaire Produces Incompatible Profile Structure
**What goes wrong:** The questionnaire path generates a profile with different fields, missing sections, or incompatible ratings compared to the session analysis path.
**Why it happens:** Two code paths producing the same output is a classic divergence bug. Session analysis generates rich evidence; questionnaire generates self-report. If the template/schema diverge, downstream consumers break.
**How to avoid:** Both paths must produce the exact same JSON schema. Define the schema in the reference doc. Both the profiler agent and the questionnaire logic populate the same fields. The only difference: session analysis has `evidence_quotes` with actual messages; questionnaire has `evidence_quotes` with the user's self-description. Session analysis confidence can be HIGH/MEDIUM/LOW; questionnaire confidence is always LOW.
**Warning signs:** CLAUDE.md generation works with session-derived profiles but fails with questionnaire-derived profiles (or vice versa).

### Pitfall 4: Agent Context Window Overflow
**What goes wrong:** 300 messages at 2000 chars each = 600KB of content. Plus the reference doc (~5-10KB), agent instructions (~5KB), and output formatting instructions. Total prompt may exceed agent context limits.
**Why it happens:** The 300-message batch limit (PIPE-05) was designed for the pipeline, not for a single agent prompt. Some models have 200K context but effective reasoning degrades in very long contexts.
**How to avoid:** The sampling subcommand should provide a "profile-ready" output that is smaller than raw extraction. Options: (1) Extract summary statistics in gsd-tools.js and pass stats + representative samples to agent, (2) Cap at a lower message count for profiling (e.g., 100 representative messages), (3) If 300 messages is needed, chunk analysis into per-project runs and synthesize. The recommended approach: extract at most 100 representative messages (across all projects, proportionally sampled), each truncated to 500 chars for the profiler. The profiler focuses on patterns, not individual message content.
**Warning signs:** Agent output is truncated or incomplete. Agent fails to score all 8 dimensions. Agent "forgets" earlier messages when scoring later dimensions.

### Pitfall 5: USER-PROFILE.md Location Conflicts
**What goes wrong:** `~/.claude/get-shit-done/` directory does not exist because GSD was installed differently, or permissions prevent writing.
**Why it happens:** GSD installs to `~/.claude/get-shit-done/` via the installer, but some users may have custom paths. The `get-shit-done` directory is the GSD namespace within Claude's config.
**How to avoid:** Before writing USER-PROFILE.md, verify `~/.claude/get-shit-done/` exists. If not, create it with `fs.mkdirSync(dir, { recursive: true })`. This is the same pattern used by the installer. Use `loadConfig()` profile.path if set, falling back to the default location.
**Warning signs:** `ENOENT: no such file or directory` error when writing USER-PROFILE.md.

### Pitfall 6: Evidence Quotes Leak Sensitive Information
**What goes wrong:** Representative quotes in USER-PROFILE.md contain API keys, passwords, file paths with usernames, or proprietary business logic.
**Why it happens:** User messages sometimes include log output, error messages with credentials, or pasted code. Phase 1's `isGenuineUserMessage` filter excludes system messages but not sensitive content within genuine messages.
**How to avoid:** The profiler agent's reference doc must include evidence curation guidelines: (1) Never include quotes with patterns matching API keys, tokens, passwords, or secrets. (2) Truncate quotes to the behavioral signal, not the full message. (3) Prefer quotes that demonstrate communication style over technical content. (4) When quoting, include only the first 200 characters or the relevant sentence, not the full 2000-char message.
**Warning signs:** USER-PROFILE.md contains strings like `sk-`, `Bearer`, `password`, `secret`, or full file paths with usernames.

## Code Examples

### Project-Proportional Sampling Subcommand
```javascript
// Source: Based on existing cmdExtractMessages pattern + PROF-06 requirement
async function cmdProfileSample(overridePath, options, raw) {
  const sessionsDir = getSessionsDir(overridePath);
  if (!sessionsDir) {
    error('No Claude Code sessions found at ~/.claude/projects. Is Claude Code installed?');
  }

  // Get all projects
  const projectDirs = fs.readdirSync(sessionsDir).filter(entry => {
    try { return fs.statSync(path.join(sessionsDir, entry)).isDirectory(); }
    catch { return false; }
  });

  // Calculate per-project session cap
  const batchLimit = options.limit || 300;
  const maxPerProject = Math.max(5, Math.floor(batchLimit / projectDirs.length));

  const allMessages = [];

  for (const dirName of projectDirs) {
    const projectPath = path.join(sessionsDir, dirName);
    const sessions = scanProjectDir(projectPath); // Already sorted by modified desc (most recent first)
    const cappedSessions = sessions.slice(0, maxPerProject);
    const indexData = readSessionIndex(projectPath);
    const projectName = getProjectName(dirName, indexData);

    const remaining = batchLimit - allMessages.length;
    if (remaining <= 0) break;

    for (const session of cappedSessions) {
      if (allMessages.length >= batchLimit) break;
      try {
        const msgs = await streamExtractMessages(
          session.filePath,
          isGenuineUserMessage,
          Math.min(remaining, 50) // Cap per-session too
        );
        for (const msg of msgs) {
          msg.projectName = projectName; // Enrich with project name
          allMessages.push(msg);
        }
      } catch { /* skip corrupted sessions */ }
    }
  }

  // Write to temp file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-profile-'));
  const outputPath = path.join(tmpDir, 'profile-sample.jsonl');
  for (const msg of allMessages) {
    fs.appendFileSync(outputPath, JSON.stringify(msg) + '\n');
  }

  output({
    output_file: outputPath,
    projects_sampled: projectDirs.length,
    messages_sampled: allMessages.length,
    per_project_cap: maxPerProject,
  }, raw);
}
```

### Profiler Agent Output Schema
```json
{
  "profile_version": "1.0",
  "analyzed_at": "2026-02-13T00:00:00Z",
  "data_source": "session_analysis",
  "projects_analyzed": ["Boomer-AI", "housingbase", "Swaggie"],
  "messages_analyzed": 150,
  "dimensions": {
    "communication_style": {
      "rating": "detailed-structured",
      "confidence": "HIGH",
      "evidence_count": 23,
      "cross_project_consistent": true,
      "evidence_quotes": [
        {
          "quote": "## Context\nThe auth flow currently uses JWT...",
          "session_id": "abc123",
          "project": "Boomer-AI",
          "signal": "Uses markdown headers and structured context"
        }
      ],
      "summary": "Consistently provides structured context with headers and explicit problem statements.",
      "claude_instruction": "Match structured communication: use headers, numbered lists, acknowledge provided context."
    },
    "decision_speed": { "..." : "same structure" },
    "explanation_depth": { "..." : "same structure" },
    "debugging_approach": { "..." : "same structure" },
    "ux_philosophy": { "..." : "same structure" },
    "vendor_philosophy": { "..." : "same structure" },
    "frustration_triggers": { "..." : "same structure" },
    "learning_style": { "..." : "same structure" }
  }
}
```

### USER-PROFILE.md Template Structure
```markdown
# Developer Profile

**Generated:** {{generated_at}}
**Source:** {{data_source}}
**Projects Analyzed:** {{projects_list}}
**Messages Analyzed:** {{message_count}}

---

## Communication Style

**Rating:** {{communication_style.rating}}
**Confidence:** {{communication_style.confidence}}

{{communication_style.summary}}

**Claude Instructions:**
{{communication_style.claude_instruction}}

<details>
<summary>Evidence ({{communication_style.evidence_count}} signals)</summary>

{{communication_style.evidence_quotes_formatted}}

</details>

---

## Decision Speed
[... same structure for each of 8 dimensions ...]

---

## Profile Metadata

| Field | Value |
|-------|-------|
| Profile Version | {{profile_version}} |
| Generated | {{generated_at}} |
| Source | {{data_source}} |
| Projects | {{projects_count}} |
| Messages | {{message_count}} |
| Dimensions Scored | {{dimensions_scored}}/8 |
| High Confidence | {{high_confidence_count}} |
| Medium Confidence | {{medium_confidence_count}} |
| Low Confidence | {{low_confidence_count}} |
```

### Questionnaire Fallback - Question Definitions
```javascript
// Source: PROF-05 requirement - 8 AskUserQuestion prompts
const PROFILING_QUESTIONS = [
  {
    dimension: 'communication_style',
    header: 'Communication Style',
    question: 'When you ask Claude to build something, how much context do you typically provide?',
    options: [
      { label: 'Minimal -- "fix the bug", "add dark mode"', rating: 'terse-direct' },
      { label: 'Some context -- explain what and why in a paragraph', rating: 'conversational' },
      { label: 'Detailed specs -- headers, numbered lists, problem analysis', rating: 'detailed-structured' },
      { label: 'It depends on the task', rating: 'mixed' },
    ],
  },
  {
    dimension: 'decision_speed',
    header: 'Decision Making',
    question: 'When Claude presents you with multiple options (e.g., library choices), how do you typically decide?',
    options: [
      { label: 'Pick quickly based on gut or experience', rating: 'fast-intuitive' },
      { label: 'Ask for a comparison, then decide', rating: 'deliberate-informed' },
      { label: 'Research independently before deciding', rating: 'research-first' },
      { label: 'Let Claude recommend, I trust the suggestion', rating: 'delegator' },
    ],
  },
  {
    dimension: 'explanation_depth',
    header: 'Explanation Preferences',
    question: 'When Claude explains something, how much detail do you want?',
    options: [
      { label: 'Just the code, minimal explanation', rating: 'code-only' },
      { label: 'Brief explanation with code', rating: 'concise' },
      { label: 'Detailed walkthrough of the approach and code', rating: 'detailed' },
      { label: 'Deep dive -- teach me the concepts behind it', rating: 'educational' },
    ],
  },
  {
    dimension: 'debugging_approach',
    header: 'Debugging Style',
    question: 'When something breaks, how do you typically approach debugging with Claude?',
    options: [
      { label: 'Paste the error and say "fix it"', rating: 'fix-first' },
      { label: 'Share error + context, ask for diagnosis', rating: 'diagnostic' },
      { label: 'Investigate myself first, then ask Claude about specific theories', rating: 'hypothesis-driven' },
      { label: 'Walk through the code together step by step', rating: 'collaborative' },
    ],
  },
  {
    dimension: 'ux_philosophy',
    header: 'UX Philosophy',
    question: 'When building user-facing features, what do you prioritize?',
    options: [
      { label: 'Get it working first, polish later', rating: 'function-first' },
      { label: 'Basic usability from the start, nothing ugly', rating: 'pragmatic' },
      { label: 'Design and UX are as important as functionality', rating: 'design-conscious' },
      { label: 'I mostly build backend/CLI -- UX is minimal', rating: 'backend-focused' },
    ],
  },
  {
    dimension: 'vendor_philosophy',
    header: 'Library & Vendor Choices',
    question: 'When choosing libraries or services, what is your typical approach?',
    options: [
      { label: 'Use what Claude suggests -- speed matters', rating: 'pragmatic-fast' },
      { label: 'Prefer well-known, battle-tested options', rating: 'conservative' },
      { label: 'Research alternatives, read docs, compare', rating: 'thorough-evaluator' },
      { label: 'Strong opinions -- I know what I like', rating: 'opinionated' },
    ],
  },
  {
    dimension: 'frustration_triggers',
    header: 'Frustration Triggers',
    question: 'What frustrates you most when working with AI coding assistants?',
    options: [
      { label: 'Doing things I did not ask for', rating: 'scope-creep' },
      { label: 'Not following instructions precisely', rating: 'instruction-adherence' },
      { label: 'Over-explaining or being too verbose', rating: 'verbosity' },
      { label: 'Breaking working code while fixing something else', rating: 'regression' },
    ],
  },
  {
    dimension: 'learning_style',
    header: 'Learning Preferences',
    question: 'When you encounter something new in your codebase, how do you prefer to learn about it?',
    options: [
      { label: 'Read the code directly -- I figure it out', rating: 'self-directed' },
      { label: 'Ask Claude to explain the relevant parts', rating: 'guided' },
      { label: 'Read official docs and tutorials first', rating: 'documentation-first' },
      { label: 'See a working example, then modify it', rating: 'example-driven' },
    ],
  },
];
```

### Dimension Definitions for Reference Doc
```markdown
## 8 Behavioral Dimensions

### 1. Communication Style
How the developer phrases requests and provides context.
Spectrum: terse-direct | conversational | detailed-structured | mixed
Signals: message length, formatting, context preambles, imperative vs interrogative

### 2. Decision Speed
How quickly the developer makes choices when presented with options.
Spectrum: fast-intuitive | deliberate-informed | research-first | delegator
Signals: time between option presentation and selection, request for comparisons, "just pick one" language

### 3. Explanation Depth
How much explanation the developer wants with code.
Spectrum: code-only | concise | detailed | educational
Signals: "just show me the code", "explain why", "teach me", "I know this part"

### 4. Debugging Approach
How the developer approaches problems and errors.
Spectrum: fix-first | diagnostic | hypothesis-driven | collaborative
Signals: error-paste-only, "why is this happening?", "I think the issue is...", "let's walk through this"

### 5. UX Philosophy
How the developer prioritizes user experience in builds.
Spectrum: function-first | pragmatic | design-conscious | backend-focused
Signals: mentions of UI polish, design requirements, "just make it work", accessibility mentions

### 6. Vendor Philosophy
How the developer approaches library and service selection.
Spectrum: pragmatic-fast | conservative | thorough-evaluator | opinionated
Signals: "just use whatever", "is X the standard?", comparing alternatives, strong preferences stated

### 7. Frustration Triggers
What causes visible frustration in developer messages.
Spectrum: scope-creep | instruction-adherence | verbosity | regression
Signals: repeated corrections, "I said...", "don't...", "why did you...", emotional language shifts

### 8. Learning Style
How the developer prefers to understand new concepts.
Spectrum: self-directed | guided | documentation-first | example-driven
Signals: "show me an example", "link me the docs", "explain this", code-reading requests
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rule-based NLP for text classification | LLM-as-analyzer with reference rubrics | 2023-2024 | Eliminates need for training data, handles nuance and context |
| Fixed questionnaires only (Myers-Briggs style) | Behavioral observation from interaction history | 2024-2025 | Moves from self-report to observed behavior, higher accuracy |
| Monolithic profile (single overall rating) | Multi-dimensional profile with per-dimension confidence | Current | Acknowledges that dimensions are independent and evidence varies |

**Deprecated/outdated:**
- Sentiment analysis for developer profiling: Too coarse. "Fix this bug" has neutral sentiment but reveals terse communication style.
- Word frequency analysis: Misses context entirely. "I want detailed explanations" counted as one signal vs. message structure analysis.

## Open Questions

1. **Should the profiler agent run once with all messages, or per-project then synthesize?**
   - What we know: 300 messages at 2000 chars = 600KB. Plus reference doc + instructions = potentially 650KB+ prompt. Within model limits but at the edge of effective reasoning.
   - What's unclear: Whether analysis quality degrades with very long prompts for this specific task.
   - Recommendation: Start with a single agent run using a reduced sample (100-150 representative messages, truncated to 500 chars each for profiling). This keeps the prompt under 200KB. If analysis quality is insufficient, switch to per-project analysis with a synthesis step. Test with actual data during implementation.

2. **Who writes USER-PROFILE.md -- Phase 2 or Phase 3?**
   - What we know: PROF-04 says "USER-PROFILE.md is generated at ~/.claude/get-shit-done/USER-PROFILE.md." Phase 3 (Profile Activation) orchestrates the full workflow including consent, scan, analyze, and generate.
   - What's unclear: Whether Phase 2 should produce the file as a standalone capability, or just produce the analysis JSON that Phase 3 renders.
   - Recommendation: Phase 2 should produce the analysis output AND write USER-PROFILE.md, because success criterion #4 says "USER-PROFILE.md is written...with all sections populated." Phase 3 then orchestrates WHEN this runs (consent, scan, etc.) and adds the activation artifacts (/dev-preferences). The profiler agent or the gsd-tools.js subcommand writes the file; Phase 3 calls that capability.

3. **How should the profiler handle messages that are clearly session context dumps (not natural interaction)?**
   - What we know: Actual extracted messages include session continuations ("This session is being continued from a previous conversation...") and pasted log output. These are genuine user messages per the filter but are not natural communication -- they are artifacts of tool usage.
   - What's unclear: Whether to filter these in the sampling step or instruct the profiler to deprioritize them.
   - Recommendation: Add content-type heuristics in the sampling step: messages starting with "This session is being continued" are session context (skip or flag). Messages that are >80% log output (detected by patterns like timestamps, repeated format strings, [DEBUG], [INFO]) should be flagged as "log paste" and deprioritized. The profiler reference doc should instruct: "weight natural language messages higher than pasted logs or context dumps."

4. **What is the minimum session count for a meaningful profile?**
   - What we know: The questionnaire fallback exists for users with no sessions. But what about users with 3 sessions? Is session analysis even useful then?
   - What's unclear: At what threshold session analysis becomes more accurate than the questionnaire.
   - Recommendation: If total genuine user messages across all projects < 20, recommend the questionnaire fallback. Between 20-50, produce a profile but mark all dimensions as LOW confidence and suggest the questionnaire to supplement. Above 50, full analysis. Document these thresholds in the reference doc.

## Sources

### Primary (HIGH confidence)
- **Actual extracted message data** - Ran `extract-messages` against Boomer-AI project, examined actual JSONL output format, verified message content characteristics. Messages range from 1-word commands to 2000-char structured specs.
- **Phase 1 implementation** - Read `gsd-tools.js` source for `streamExtractMessages()`, `isGenuineUserMessage()`, `truncateContent()`, `cmdExtractMessages()`. Verified output schema: `{ sessionId, projectPath, timestamp, content }`.
- **Session metadata** - Ran `scan-sessions --json` to get actual project counts: 6 projects, 319 total sessions, 555MB total. Largest: housingbase (104 sessions, 242MB), Boomer-AI (92 sessions, 111MB).
- **Existing GSD agent patterns** - Read `agents/gsd-codebase-mapper.md`, `agents/gsd-executor.md` for agent definition conventions (YAML frontmatter, role, process steps, tools).
- **Existing GSD reference doc patterns** - Read `get-shit-done/references/questioning.md`, `model-profiles.md` for reference doc conventions.
- **Model profiles reference** - Verified agent-to-model mapping pattern. Planned entry: `gsd-user-profiler: { quality: opus, balanced: sonnet, budget: sonnet }`.
- **Research architecture doc** - Read `.planning/research/ARCHITECTURE.md` for profiling subsystem design, data flow diagrams, anti-patterns.

### Secondary (MEDIUM confidence)
- **8-dimension framework** - Dimensions derived from plan assertions and validated against actual session patterns from the extracted messages. The framework is sound but has not been validated with user feedback.
- **AskUserQuestion pattern** - Verified across multiple GSD workflows (`discuss-phase.md`, `new-project.md`, `questioning.md` reference). The pattern is well-established but questionnaire-specific usage (sequential dimension mapping) is novel.
- **Project research FEATURES.md** - Read `.planning/research/FEATURES.md` for feature prioritization matrix, competitor analysis, anti-feature rationale.

### Tertiary (LOW confidence)
- **LLM-as-analyzer pattern reliability** - Based on training knowledge of LLM-based text classification. No formal benchmarks for behavioral profiling specifically. The reference doc rubric approach is a mitigation, but actual profiling accuracy must be validated during implementation.
- **Context window effectiveness at 600KB+** - Training knowledge suggests degradation for very long prompts. The reduced sampling recommendation (100-150 messages, 500 chars) is a conservative mitigation, not empirically validated for this use case.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Node.js builtins, reuses Phase 1 infrastructure, follows existing GSD patterns
- Architecture: HIGH - Follows established agent/reference-doc/template pattern verified across existing GSD agents
- Dimension framework: MEDIUM - 8 dimensions validated against actual messages but not against user feedback; detection heuristics are educated estimates
- Sampling algorithm: HIGH - Project counts and session distributions verified from actual data
- Questionnaire design: MEDIUM - Question-to-dimension mapping is logical but untested with real users
- Pitfalls: HIGH - Confirmation bias, overfitting, and context overflow are well-documented LLM problems with concrete mitigations

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- agent patterns don't change rapidly; dimension framework may evolve based on user feedback)
