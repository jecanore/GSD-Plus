---
phase: 02-profiling-engine
plan: 01
subsystem: profiling
tags: [behavioral-analysis, agent-design, reference-doc, heuristics, confidence-scoring]

# Dependency graph
requires:
  - phase: 01-session-pipeline
    provides: extract-messages command producing JSONL session data
provides:
  - 8-dimension behavioral detection heuristics reference document
  - gsd-user-profiler agent definition with structured JSON output
  - Model profile entry for gsd-user-profiler (opus/sonnet/sonnet)
affects: [02-02 (profile-sample sampling), 02-03 (questionnaire fallback), 03-profile-activation]

# Tech tracking
tech-stack:
  added: []
  patterns: [reference-guided-agent-analysis, structured-json-analysis-output, evidence-curation-with-sensitive-filtering]

key-files:
  created:
    - get-shit-done/references/user-profiling.md
    - agents/gsd-user-profiler.md
  modified:
    - get-shit-done/references/model-profiles.md

key-decisions:
  - "Profile output uses imperative claude_instruction directives, not descriptive statements"
  - "Evidence format is combined Signal+Example with ~100 char trimmed quotes and project attribution"
  - "Confidence thresholds: HIGH 10+ signals across 2+ projects, MEDIUM 5-9, LOW <5, UNSCORED 0"
  - "Context-dependent splits reported rather than forcing single rating -- Phase 3 resolves with user"
  - "Frustration triggers LOW confidence note clarifies that low count is positive (satisfied), not insufficient"

patterns-established:
  - "Reference-guided agent analysis: agent applies heuristics from reference doc, never invents its own"
  - "Structured analysis output: agent returns JSON in <analysis> tags for reliable programmatic extraction"
  - "Sensitive content Layer 1: profiler excludes quotes with sk-, Bearer, password, secret, token, api_key, full paths"
  - "Thin data thresholds: full >50 messages, hybrid 20-50, insufficient <20"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 2 Plan 1: Profiling Knowledge Artifacts Summary

**8-dimension behavioral profiling reference doc with detection heuristics, confidence scoring, and evidence curation rules; gsd-user-profiler agent with structured JSON output contract**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T07:27:56Z
- **Completed:** 2026-02-14T07:33:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created comprehensive user-profiling reference document defining detection heuristics for all 8 behavioral dimensions (communication style, decision speed, explanation depth, debugging approach, UX philosophy, vendor philosophy, frustration triggers, learning style)
- Each dimension includes rating spectrum, signal patterns, detection heuristics, confidence scoring thresholds, example quotes, and context-dependent pattern guidance
- Created gsd-user-profiler agent definition with role, input contract, 5-step process, output schema, and constraints
- Updated model-profiles.md with gsd-user-profiler entry (opus/sonnet/sonnet) and design rationale

## Task Commits

Each task was committed atomically:

1. **Task 1: Create user-profiling reference document** - `a006aab` (feat)
2. **Task 2: Create gsd-user-profiler agent and update model profiles** - `7f0fa7f` (feat)

## Files Created/Modified

- `get-shit-done/references/user-profiling.md` - 681-line reference document defining 8-dimension detection heuristics, confidence scoring rules, evidence curation guidelines, recency weighting, thin data handling, JSON output schema, and cross-project consistency assessment
- `agents/gsd-user-profiler.md` - Agent definition with YAML frontmatter, role, input/output specs, 5-step analysis process, reference to user-profiling.md rubric, and constraints
- `get-shit-done/references/model-profiles.md` - Added gsd-user-profiler row (opus/sonnet/sonnet) and rationale for Opus in quality tier

## Decisions Made

- **claude_instruction as imperative directive:** Profile is an instruction document for Claude's consumption. Instructions use imperative form ("Provide structured responses") not descriptive ("You tend to prefer structured responses"). Per user decision in 02-CONTEXT.md.
- **Combined evidence format:** Signal interpretation + trimmed quote (~100 chars) + project attribution. Balances evidence quality with profile size (~5KB for 24 quotes).
- **Frustration triggers confidence note:** LOW confidence for frustration triggers explicitly notes that low frustration count is positive (developer is satisfied), not that data is insufficient. Prevents misinterpretation.
- **Context-dependent splits over forced ratings:** When a dimension shows different patterns across projects, the profiler reports the split rather than averaging. Phase 3 resolves with user input.
- **Neutral fallback for UNSCORED dimensions:** "No strong preference detected. Ask the developer when this dimension is relevant." Prevents Claude from guessing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Reference doc and agent definition provide the foundation for Plan 02-02 (profile-sample subcommand implementing project-proportional sampling)
- Plan 02-03 (questionnaire fallback) can reference the same output schema and thin data thresholds defined here
- Phase 3 (profile activation) has the complete agent contract to orchestrate profiling workflows

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 02-profiling-engine*
*Completed: 2026-02-14*
