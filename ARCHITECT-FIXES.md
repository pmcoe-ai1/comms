# CRM Type Safety Retrofit — Mandatory Plan Fixes

**From:** Review Agent
**To:** Solution Architect Agent
**Date:** 2026-03-10
**Subject:** PLAN.md has been reviewed and contains issues that must be fixed before execution begins. All items below are mandatory. Do not skip, defer, or deprioritize any item.

**Source:** PLAN.md in this repo contains the current plan. Read it in full before making changes.

---

## Instructions

Revise PLAN.md to fix every issue listed below. Each fix must be reflected in the updated plan text — not just acknowledged in a comment or footnote. When you are done, commit and push the updated PLAN.md to this repo (comms, main branch).

Do not change the overall Phase A / Phase B structure. Do not remove existing steps. Add, modify, or restructure steps as needed to address each issue.

---

## Issue 1: Pipeline stages skipped in Step B.4

**Problem:** Step B.4 runs `validate → codegen` but the FABRIC pipeline requires `validate → template-generator → fill → gate → codegen`. Template generation, AI fill, and all gate passes are missing. Without filled templates, codegen will either fail or produce empty rule stubs with no validation.

**Required fix:** Rewrite Step B.4 to run the full FABRIC pipeline for each domain: validate → template-generator → fill → gate (Pass 1–4) → codegen. Include the commands for each stage. Add a note that the fill stage requires `ANTHROPIC_API_KEY` and document what happens if it is not available (gate cannot run on unfilled templates, codegen cannot proceed).

---

## Issue 2: FABRIC was renamed — all CLI references are wrong

**Problem:** The FABRIC repo renamed from DKCE to FABRIC. The package is `@fabric/cli` with the binary at `bin/fabric`. The plan references `dkce` in:
- Step B.1: `cp bin/dkce`, `chmod +x fabric/bin/dkce`
- Step B.2: `"dkce": "node fabric/bin/dkce"` in package.json scripts
- Steps B.4, B.6, B.7: `npm run dkce -- validate`, `npm run dkce -- codegen`
- Step B.2 config filename: `dkce.config.json`
- Step B.2 signals/scores files: `dkce-signals.json`, `dkce-confidence-scores.json`

**Required fix:** Replace every occurrence of `dkce` with `fabric` throughout the plan. This includes CLI binary name, npm script name, config filename, and all command invocations. Verify no `dkce` references remain after the fix.

---

## Issue 3: No filled templates directory or fill step

**Problem:** The config in Step B.2 declares `filledDir` paths (e.g., `models/templates/lead-management`) but no step creates these directories, generates fill templates, or runs the AI fill stage. Without filled templates, codegen has nothing to generate rules from.

**Required fix:** Add a step (or extend B.4) that:
1. Creates the `filledDir` directories for all 6 domains
2. Runs template-generator to produce fill templates
3. Runs fill.js to populate rule slots (requires `ANTHROPIC_API_KEY`)
4. Runs gate passes on filled templates before proceeding to codegen

---

## Issue 4: Copying FABRIC as raw files creates an unversioned fork

**Problem:** Step B.1 does `cp -R` of FABRIC's `lib/`, `bin/`, `schema/` into the CRM repo. This creates a snapshot with no version tracking. When FABRIC updates, the CRM copy silently drifts. There is no way to know which version of FABRIC the CRM is using or pull updates.

**Required fix:** Replace the raw file copy with a versioned dependency mechanism. Options include:
- Git submodule pointing to `pmcoe-ai1/FABRIC` at a specific commit/tag
- npm dependency (if FABRIC is published or installable via git URL)
- At minimum: record the exact FABRIC commit hash in a `FABRIC_VERSION` file and document the update procedure

Choose one approach, update Step B.1 accordingly, and add a "Updating FABRIC" section to the plan that documents how to pull new versions.

---

## Issue 5: No Prisma/database schema reconciliation

**Problem:** FABRIC codegen generates Prisma schemas. The CRM already has its own database schema (`schema_v3_2.sql`). The plan does not address what happens when generated Prisma models conflict with the existing database. This will surface as runtime errors or migration failures.

**Required fix:** Add a reconciliation step (between B.4 and B.5 or as part of B.4) that:
1. Compares generated Prisma schemas against the existing database schema
2. Documents the strategy: will generated Prisma schemas replace, supplement, or be ignored in favour of the existing schema?
3. If generated Prisma schemas are used, adds a migration plan
4. If generated Prisma schemas are not used (types-only extraction), explicitly excludes Prisma from codegen output or documents that generated Prisma files are reference-only

---

## Issue 6: Canonical model authoring (Step B.3) has no spec

**Problem:** Step B.3 is a black box — "Solution Architect authors 6 canonical models." There is no guidance on:
- Which canonical model schema version to target (FABRIC is at v3.6.0)
- How to derive models from the existing services and database
- How to validate that models match existing `format()` function return shapes
- What the acceptance criteria are for each model

**Required fix:** Expand Step B.3 into a full specification that includes:
1. The target schema version (v3.6.0)
2. The source of truth for each model (which service files, database tables, and format functions to derive from)
3. A validation step: after authoring each model, run `fabric validate` against it before marking B.3 as done
4. A cross-check step: compare each model's entity fields against the corresponding `format()` function return fields from Step A.1 to ensure alignment
5. Acceptance criteria: all 6 models pass `fabric validate`, and every field in the Phase A interfaces has a corresponding field in the canonical model

---

## Issue 7: `grep ": any"` gate check in Step A.5 is too broad

**Problem:** The gate check `grep -r ": any" packages/mcp-server/src/tools/` matches legitimate patterns like `Record<string, any>`, type parameters, and comments. This will produce false positives.

**Required fix:** Replace the grep pattern with a more precise check that targets only the patterns being eliminated:
- `catch (err: any)` — the error handler pattern
- `): any` or `=> any` — untyped return values
- `as any` — type assertion casts
- Variable declarations like `const x: any`

Exclude legitimate uses like `Record<string, any>` and generic type parameters. Provide the exact grep/regex pattern in the plan.

---

## Issue 8: Missing `signals` and `scores` config files

**Problem:** The config in Step B.2 references `"signals": "dkce-signals.json"` and `"scores": "dkce-confidence-scores.json"` (which should also be renamed per Issue 2). No step creates these files. The pipeline's signal-collector and confidence-score modules will look for them.

**Required fix:** Add a step that creates these files with valid initial content (empty signal set and default confidence thresholds), or remove them from the config if they are optional and document that they are not used in the initial retrofit.

---

## Issue 9: Phase A types are throwaway work

**Problem:** Phase A creates ~80 hand-written interfaces in `service-returns.ts`. Phase B replaces all of them with re-exports from generated types. The entire A.1 deliverable is temporary scaffolding that gets discarded.

**Required fix:** Address this inefficiency in the plan. Options:
- Justify the two-phase approach explicitly (e.g., Phase A provides immediate type safety while waiting for canonical models, and the interfaces serve as a validation baseline for Phase B)
- Restructure so Phase A uses lightweight placeholder types (e.g., `unknown` or minimal interfaces) that are cheaper to write and replace
- Keep the current approach but add a note explaining why the throwaway work is acceptable

Whichever option is chosen, document the rationale in the plan.

---

## Issue 10: CI pipeline in Step B.6 is incomplete

**Problem:** Step B.6 only adds `validate` and `codegen` to CI. It does not add gate passes, scenario tests, or chain recording — all stages that FABRIC's own CI workflow runs.

**Required fix:** Update Step B.6 to add the full FABRIC pipeline to CI, matching the stages in FABRIC's own `.github/workflows/fabric.yml`:
1. Validate
2. Gate (Pass 1–4 on filled templates, Pass 3–4 on models)
3. Codegen
4. TypeScript check (including generated types)
5. Jest (including scenario tests if applicable)

Document any stages that are intentionally excluded and why.

---

## Issue 11: No OpenAPI or Prisma output integration plan

**Problem:** FABRIC generates OpenAPI specs and Prisma schemas for each domain. The plan does not address:
- What happens to the 6 generated OpenAPI specs (merge into one? serve separately? ignore?)
- How generated Prisma schemas relate to the existing CRM database and migrations
- Whether generated operation stubs will be used or only the type interfaces

**Required fix:** Add a section (after B.4 or as part of B.5) that documents the integration strategy for each generated artifact type:
- **Interfaces**: used (re-exported in B.5) — already covered
- **Operation stubs**: state whether they will be wired into the existing service layer or ignored
- **Rule stubs**: state whether they will be implemented or ignored
- **OpenAPI specs**: state the integration plan (merge, serve, or reference-only)
- **Prisma schemas**: covered by Issue 5 above

---

## Issue 12: Mode classification is wrong for Steps A.2–A.5

**Problem:** Steps A.2–A.5 are classified as Mode 2 (Defect Fix). Adding return type annotations (A.2) and removing `as any` casts (A.3–A.5) are additive improvements, not bug fixes. The "evidence gathered" section cites root cause analysis, but the actual work is preventive enhancement.

**Required fix:** Reclassify Steps A.2–A.5 as Mode 1 (Feature Development). Move the root cause analysis and 5 Whys evidence to a "Background" or "Motivation" section rather than using it as a Mode 2 trigger. Update the mode transition stops accordingly.

---

## Issue 13: Hardcoded machine-specific paths

**Problem:** Step B.1 uses `/Users/alankwon/Documents/AI/FABRIC/...` and Step 0.1 uses `/Users/alankwon/Documents/AI`. These are machine-specific paths that will not work on other machines or in CI.

**Required fix:** Replace all hardcoded paths with:
- A variable or placeholder (e.g., `$FABRIC_REPO` or `<path-to-fabric-repo>`)
- A note at the top of the plan documenting the required environment setup (where repos should be cloned)
- If using a git submodule or npm dependency (per Issue 4), the paths become irrelevant — remove them

---

## Verification

After making all fixes, verify the updated plan by checking:
1. No occurrences of `dkce` remain (Issue 2)
2. No hardcoded `/Users/alankwon/` paths remain (Issue 13)
3. Step B.4 includes all pipeline stages: validate, template-generator, fill, gate, codegen (Issues 1, 3)
4. Step B.3 has a full specification with schema version and acceptance criteria (Issue 6)
5. Step B.6 CI includes gate passes and scenario tests (Issue 10)
6. Every generated artifact type (interfaces, operations, rules, OpenAPI, Prisma) has a documented integration strategy (Issues 5, 11)
7. The grep patterns in A.5 and A.7 gates are precise enough to avoid false positives (Issue 7)
8. Signal and score config files are either created or explicitly excluded (Issue 8)
9. Mode classifications match the actual work being done (Issue 12)
10. FABRIC dependency is versioned, not a raw file copy (Issue 4)
11. The Phase A throwaway work rationale is documented (Issue 9)

Commit and push the updated PLAN.md when all checks pass.

---

*End of fixes prompt*
