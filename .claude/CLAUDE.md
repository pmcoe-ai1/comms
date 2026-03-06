# DKCE + FABRIC — Claude Code Session Instructions

This file loads automatically at the start of every Claude Code session.
Read every section before doing anything else.

---

## 1. TASKS.md is the single source of truth for all work

TASKS.md tracks every task, its status, its dependencies, its blockers,
and its verification evidence. This conversation and Claude Code stay
aligned through TASKS.md. If TASKS.md is not updated, work is invisible
to the next session and will be repeated.

The GitHub API URL for reading TASKS.md from Claude conversations is:
https://api.github.com/repos/pmcoe-ai1/comms/contents/TASKS.md
This URL must be provided at the start of every new conversation with
Claude so Claude can fetch current task status directly from GitHub.
The response is base64-encoded — Claude will decode it automatically.

---

## 2. Start of every session — mandatory, no exceptions

Before writing any code, running any command, or making any change:

1. Read **TASKS.md** — find the next task with status `✗ NOT DONE`
   that has no incomplete dependencies and no active blockers
2. Read **AGENTS.md** — hard rules for this codebase, non-negotiable
3. Read **PLAN.md** — current build status, tool status, decision log

Do not start work until all three files are read.
Do not assume the state is the same as the previous session.
Do not trust memory. Read the files.

---

## 3. End of every task — mandatory, no exceptions

After completing any task, in this exact order:

1. Open TASKS.md
2. Change the task status from `✗ NOT DONE` to `✅ DONE`
3. Update the notes column with verification evidence —
   exact file name and line number confirming the work is present
4. Update the `Last updated` date at the top of TASKS.md
5. If the completed task unblocks a dependent task, update that
   task's blocked status accordingly
6. Commit and push TASKS.md immediately:
   git add TASKS.md
   git commit -m "TASK-XX complete — <one line description>"
   git push origin main
7. Report back with this exact line:
   `TASKS.md updated: TASK-XX marked ✅ DONE — verified at <file>:<line> — pushed to main`

**A task is not complete until TASKS.md is committed and pushed.**

If the work cannot be verified — command failed, file missing, output
unexpected — do not mark the task done. Do not commit. Report what
happened and stop.

If the git push fails, report it immediately. Do not proceed to the
next task until TASKS.md is successfully pushed.

---

## 4. Adding new tasks

If you identify work not already in TASKS.md:

1. Add it to TASKS.md before starting it
2. Use the next available TASK-XX number
3. Fill in all columns: task, status, depends on, blocked on, notes
4. Report the addition before proceeding

---

## 5. Hard rules — apply to every task without exception

These rules have been established over multiple sessions. Violating
them produces drift, incorrect status, and compounding errors.

### Never assume. Never infer. Always verify.

If you do not know the current state of a file, read the file.
If you do not know whether a command passes, run the command.
Do not assume anything matches what you expect from a previous
session or from PLAN.md alone.

Before stating that something is done, verify it:
- Read the file and confirm the content is present at the expected location
- Run the relevant command and confirm exit code 0
- Report the exact file and line number as evidence

### Never state status without evidence

Do not say a task is complete because it was done in a previous session.
Do not say a file exists without checking.
Do not say a command passes without running it.
Every status claim requires a file read or command run to back it up.

### Report before fixing

If you discover something unexpected — a bug PLAN.md says is closed
but appears still present, a file in a different state than expected,
a test that was passing now failing — do not silently fix it.
Report it first. State the exact file and line number.
Wait for confirmation. Then fix.

### One task at a time

Complete one task fully — including the TASKS.md update — before
starting the next. Do not combine tasks unless explicitly instructed.
Each task needs its own checkpoint and its own verified result.

### Never modify canonical models without explicit instruction

`files/example.canonical-model.yaml` and
`files/subscription-billing.canonical-model.yaml` are human-authored.
Do not edit them unless the task explicitly says to and names the
exact change. If a change is needed, report what and why, and wait
for confirmation.

### Never modify generated/ by hand

Everything in `generated/` and `generated-subscription/` is owned
by codegen.js. If generated output is wrong, fix codegen.js and
regenerate. Do not patch generated files directly.

### Never throw undeclared error codes

Every error thrown in `src/rules/` or `src/operations/` must be
declared in the canonical model's errorResponses. If a new error
condition is needed, add it to the canonical model first.

### Never skip the gate

Filled templates must pass gate.js before codegen runs against them.
A template with status `filled-pending-gate` is not ready for codegen.
Gate failures must be re-filled, not bypassed.

### Never invent domain objects

If a field, entity, rule, or operation seems missing, output a GapFlag
and stop. Do not add it to generated code or to src/. The canonical
model is the only place new domain objects are introduced, and only
by humans.

### Never defer without documenting

If a task cannot be completed — blocked, failing, or out of scope —
do not silently skip it. Add a note to TASKS.md explaining why it
was not completed, what is blocking it, and what is needed to unblock.

### Never use verified_modify_file to update TASKS.md

verified_modify_file silently fails on this codebase — it reports
success but does not write the content. This has been observed and
confirmed in session.

When updating TASKS.md:
1. Read the current TASKS.md in full
2. Construct the complete updated file contents in memory
3. Write the entire file using: cat > TASKS.md << 'EOF' ... EOF
4. Immediately re-read TASKS.md and verify the change is present
5. If the change is not present, report the failure — do not mark
   the task done

Apply this same approach to any file where verified_modify_file
has failed or may fail. When in doubt, use the heredoc method and
verify the result.

---

## 6. Known state discrepancy — read before touching BUGS.md

**BUGS.md is out of date.** The project BUGS.md shows every bug as
`Status: OPEN`. This is an old snapshot. PLAN.md is the authoritative
source of bug closure status. PLAN.md confirms 34 bugs closed:
BUG-000 through BUG-032 plus DESIGN-001, DESIGN-002, DESIGN-003.

**Do not reopen or re-fix bugs that PLAN.md marks as closed.**

If BUGS.md and PLAN.md contradict each other, PLAN.md wins.

If you discover a bug that PLAN.md marks closed is actually still
present in the code:
1. Do not silently fix it
2. Report it with exact file and line number
3. Add a new bug entry to BUGS.md with a new BUG-XXX number
4. Add a new TASK to TASKS.md for the fix
5. Wait for confirmation before fixing

---

## 7. Known blockers — do not attempt blocked tasks

| Blocker | Tasks blocked |
|---|---|
| ANTHROPIC_API_KEY not available in environment | TASK-11 (activate-on-trial-start refill) |
| PostgreSQL instance not available | TASK-16 (chain.js), TASK-17 (Prisma triggers), TASK-26 (registry) |

If a blocker has been resolved, verify by attempting the blocked task
and confirming the result before updating TASKS.md.

---

## 8. Open verification items — resolve before proceeding with affected tasks

| ID | Item | Impact |
|---|---|---|
| VERIFY-03 | meta.version bump policy undefined. Neither PLAN.md nor AGENTS.md defines when meta.version should be bumped on a canonical model. Both models are at 1.0.0 despite content changes during bug sweep. prevHash is null on both. | Must be resolved before TASK-16 (chain.js) is built. Add version bump policy to AGENTS.md as part of TASK-16 work. |

---

## 9. Current task sequence

Read TASKS.md for full detail. Summary of current position:

**Immediately actionable — no dependencies, no blockers:**
- TASK-01a — fix dunning glossary description line 76 in subscription-billing.canonical-model.yaml: change "Maximum 3 retry attempts" to "Maximum 4 retry attempts"
- TASK-01b — fix dunning glossary precision.max line 80 in subscription-billing.canonical-model.yaml: change max: 3 to max: 4
- TASK-03 — extend gate.js Pass 1 with glossary precision checker (Gap 5)
- TASK-04 — write fast-check property-based tests for numeric condition boundaries (Gap 9)
- TASK-05 — write Schemathesis OpenAPI tests against generated spec (Gap 9)

**Blocked on ANTHROPIC_API_KEY:**
- TASK-11 — re-fill activate-on-trial-start template

**Blocked on PostgreSQL:**
- TASK-16 — write chain.js (hash chain)
- TASK-17 — write Prisma trigger migration scripts

**Blocked on TASK-03, TASK-04, TASK-05, TASK-11 through TASK-17:**
- TASK-18 — write .github/workflows/dkce.yml CI pipeline

**After TASK-19 (CI pipeline + oasdiff complete), FABRIC Phase 2 begins:**
- TASK-23 — extend schema to v2.0.0
- TASK-24 — author platform.canonical-model.yaml
- TASK-25 — run DKCE pipeline against platform.canonical-model.yaml

---

## 10. Pipeline reference

The DKCE pipeline runs in this exact order. No stage may skip the one before it.

```
files/canonical-model.yaml
  ↓ validate.js                 validates model against JSON Schema
  ↓ template-generator.js       produces fill templates for null rules
  ↓ fill.js                     calls Claude API to fill rule slots
  ↓ gate.js Pass 1              structural validation of filled template
  ↓ gate.js Pass 2              semantic validation against scenarios
  ↓ gate.js Pass 3              throw-checker: all error codes declared
  ↓ gate.js Pass 4              operation contract validation
  ↓ codegen.js                  generates all artifacts into generated/
  ↓ tsc --noEmit                compiler drift wall
  ↓ Jest scenario runner        Gate Stage 2 against rule implementations
  ↓ chain.js                    records pipeline run (TASK-16 — NOT YET BUILT)
```

---

## 11. What is verified complete this session

The following was verified by direct file read and command run during
the session that produced this file. Do not re-verify unless a task
requires it.

| Item | Verified evidence |
|---|---|
| generated/gapflags.json | Empty array — 0 GapFlags |
| generated-subscription/gapflags.json | 1 GapFlag — activate-on-trial-start UNGATED_RULE |
| src/rules/check-stock-on-add-item.ts | Real implementation, 39 lines, imports from generated stub |
| generated/rules/check-stock-on-add-item.ts | Real generated stub, 29 lines |
| gate.js --model files/example.canonical-model.yaml | Exit 0, Pass 3 ✓, Pass 4 ✓ |
| npx jest tests/scenarios/scenario-runner.test.ts | Exit 0, 7 tests passing |
| npx tsc --noEmit | Exit 0, clean |
| subscription-billing.canonical-model.yaml line 76 | Says "Maximum 3 retry attempts" — needs updating to 4 (TASK-01a) |
| subscription-billing.canonical-model.yaml line 80 | Says precision.max: 3 — needs updating to 4 (TASK-01b) |

---

## 12. Key file locations

| File | Purpose | May Claude Code edit? |
|---|---|---|
| TASKS.md | Authoritative task tracker | Yes — must update after every task |
| AGENTS.md | Hard rules — non-negotiable | Only to add documented policy (e.g. VERIFY-03) |
| PLAN.md | Build status and decisions | Only to update tool status table when a tool changes |
| BUGS.md | Bug log — see section 6 re: out of date | Only to add new bugs with new BUG-XXX numbers |
| canonical-model.schema.json | JSON Schema v2.1.0 | Only with explicit instruction — version bump required |
| files/example.canonical-model.yaml | Order-management canonical model | Only with explicit instruction naming exact change |
| files/subscription-billing.canonical-model.yaml | Subscription-billing canonical model | Only with explicit instruction naming exact change |
| gate.js | Enforcement gate Pass 1-4 | Yes — for gate extension tasks |
| codegen.js | Code generator | Yes — for codegen extension tasks |
| fill.js | AI fill via Claude API | Only with explicit instruction |
| generated/ | Codegen output — order-management | Never edit directly |
| generated-subscription/ | Codegen output — subscription-billing | Never edit directly |
| src/rules/ | Rule implementations | Yes — for rule implementation tasks |
| tests/scenarios/ | Scenario runner tests | Never edit directly — owned by canonical model + codegen |
| chain.js | Hash chain — NOT YET BUILT | Build in TASK-16 |
| .github/workflows/dkce.yml | CI pipeline — NOT YET BUILT | Build in TASK-18 |
