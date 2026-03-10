# CRM Type Safety Retrofit — Full-Stack Agent Brief

**From:** Solution Architect Agent
**To:** Full-Stack Coding Agent
**Date:** 2026-03-10
**Objective:** Clone PM CoE to a new "CRM" repo, then execute Phase A (Type Contracts) and Phase B (Canonical Models) to eliminate the systemic type safety deficiency.
**Progress tracker:** `packages/Architecture/PROGRESS.md` — update after every step.

**Risk mitigation:** All changes happen in the cloned repo. The production PM CoE app is never touched.

---

## Environment Setup

Before starting, ensure the following are available:

| Requirement | Purpose |
|-------------|---------|
| `$WORKSPACE` — parent directory for repo clone | Step 0.1 uses `$WORKSPACE` (set to your preferred path, e.g., `~/projects`) |
| GitHub CLI (`gh`) authenticated | Steps 0.2, B.1 |
| Node.js >= 18 + npm | All steps |
| `ANTHROPIC_API_KEY` env var | Step B.4 fill stage (AI-powered template filling) |

All paths in this plan use `$WORKSPACE` as the parent directory. Set it before starting:

```bash
export WORKSPACE=~/projects   # or your preferred location
```

---

## Background & Motivation

### The Type Safety Deficiency

Root cause analysis by the Solution Architect identified 138 `as any` / `: any` casts across ARIA tool files (39 casts, 14 files) and MCP tool files (99 casts, 16 files). These casts caused 25+ production defects across three failure modes:

- **Mode A** — Name vs UUID mismatch (tool passes name string where service expects UUID)
- **Mode B** — Wrong field name (tool reads `config.text` but service returns `config.buttonText`)
- **Mode C** — Wrong enum value (tool sends `"active"` but schema expects `"published"`)

5 Whys analysis traced the root cause to: **no enforcement mechanism for cross-layer type safety between services, ARIA tools, and MCP tools.**

### Why Two Phases?

**Phase A (Type Contracts)** creates ~80 hand-written interfaces derived from existing `format()` functions. These provide **immediate type safety** — TypeScript will catch field name mismatches, missing properties, and wrong types at compile time. This stops the bleeding.

**Phase B (Canonical Models)** replaces the hand-written interfaces with FABRIC-generated types derived from canonical domain models. This provides **structural type safety** — types are generated from a single source of truth, preventing drift between the database schema, service layer, and tool layer.

**Why not skip Phase A?** Phase B depends on canonical models authored by the Solution Architect (Step B.3), which takes time. Phase A delivers value immediately and serves as a **validation baseline**: when Phase B replaces hand-written interfaces with generated ones, any misalignment between the canonical model and the actual service behavior will surface as compile errors. Without Phase A, there would be no safety net to catch model authoring mistakes.

The Phase A interfaces are intentionally temporary scaffolding. They are replaced by re-exports from generated types in Step B.5, preserving import paths while switching the source of truth.

---

# Mode 1 — Feature Development

## Step 0: Clone the Codebase

### 0.1 Create the CRM Repository

```bash
cd $WORKSPACE
cp -R PMCOE-Platform CRM
cd CRM
rm -rf .git
git init
git add -A
git commit -m "Initial clone from PM CoE Platform for type safety retrofit"
```

### 0.2 Create GitHub Remote

```bash
gh repo create pmcoe-ai1/crm --private --source=. --push
```

### 0.3 Verify the Clone Works

```bash
npm install
npm run generate-types
npm run dev:backend   # confirm startup + migrations
npm test              # confirm all existing tests pass
```

**Gate:** Do NOT proceed until all existing tests pass. Record the baseline test count in PROGRESS.md.

### 0.4 Update Clone-Specific References

| File | Change |
|------|--------|
| `package.json` (root) | Change `name` to `crm-platform` |
| `packages/backend/package.json` | Change `name` to `@crm/backend` |
| `packages/frontend/package.json` | Change `name` to `@crm/frontend` |
| `packages/mcp-server/package.json` | Change `name` to `@crm/mcp-server` |
| `.mcp.json` | Update `PMCOE_BACKEND_URL` to localhost for local dev |

**Do NOT change:** tsconfig paths, import paths, database schema, API routes, or any runtime code.

---

## Step A.1: Create Service Return Type Interfaces

**Create:** `packages/backend/src/types/service-returns.ts`

Derive interfaces from the `format*()` functions in each service. The format function's return object literal IS the interface. Do not guess — read the function.

**Services and their format functions:**

| Service | Format Function(s) | Return Fields |
|---------|-------------------|---------------|
| LeadService | `formatLead(row)` | id, email, firstName, lastName, primaryCourseId, status, score, source, region, enrolledCourses, tags, properties, hubspotProperties, createdAt, updatedAt |
| LeadService | `formatExecution(row)` | id, journeyId, journeyName, status, currentNodeId, startedAt, completedAt |
| LeadService | `formatEnrollment(row)` | id, courseId, courseName, status, enrolledAt, completedAt |
| LeadService | `formatScoringEvent(row)` | id, signalName, points, eventType, createdAt |
| LeadService | `formatPayment(row)` | id, amount, currency, status, paidAt |
| JourneyService | `formatJourney(row, includeSteps?)` | id, name, description, triggerType, courseId, status, definition, audienceFilter, nodeCount, scheduledFor, totalRecipients, sent, opened, clicked, bounced, unsubscribed, createdAt, sentAt |
| SurveyService | `formatSurvey(row, questions, totalResponses)` | id, title, name, description, status, courseId, questions, totalResponses, createdAt, updatedAt |
| SurveyService | `formatQuestion(row)` | id, surveyId, questionType, questionText, options, isRequired, sortOrder |
| TemplateService | `formatTemplate(row)` | id, name, subject, bodyHtml, bodyText, variables, categoryId, createdAt, updatedAt, sentCount?, openedCount?, openRate? |
| AlertService | `formatAlert(r)` | id, name, description, alertType, conditions, channels, recipients, isActive, cooldownMinutes, lastTriggeredAt, createdAt, updatedAt |
| ScoringService | `formatSignal(row)` | id, name, description, eventType, points, isActive, createdAt |
| ScoringService | `formatScoringEvent(row)` | id, leadId, signalId, signalName, points, eventType, metadata, createdAt |
| ReplyService | `formatReply(row)` | id, journeyId, journeyName, journeyStepNumber, journeyNodeId, surveyId, leadId, firstName, lastName, fromEmail, email, subject, body, classification, confidence, reasoning, summary, sentiment, status, receivedAt, respondedAt |
| PaymentService | `formatPayment(row)` | id, leadId, email, amount, currency, status, stripeSessionId, stripePaymentIntent, paidAt, refundedAt, metadata, createdAt |
| PromoCodeService | `formatPromoCode(row)` | id, code, courseId, discountType, discountValue, maxUses, currentUses, isActive, expiresAt, createdAt |
| EnrollmentService | `formatEnrollment(row)` | id, leadId, courseId, courseName, status, enrolledAt, completedAt, source, createdAt |
| ExecutionService | `formatExecution(row, computed?)` | id, journeyId, journeyName, leadId, leadEmail, status, currentNodeId, startedAt, completedAt, error, createdAt |
| ExecutionService | `formatExecutionStep(row)` | id, executionId, nodeId, nodeType, status, input, output, error, startedAt, completedAt |
| ExecutionService | `formatExecutionEvent(row)` | id, executionId, eventType, nodeId, payload, createdAt |
| DefinitionService | `formatDefinition(row)` | id, name, version, description, status, definition, createdAt, updatedAt |
| UserService | `formatUser(row)` | id, username, email, role, region, createdAt, updatedAt |
| AuthService | `formatUser(row)` | id, username, email, role, region, createdAt |
| SchedulerService | `formatAction(r)` | id, executionId, stepId, actionType, scheduledFor, status, payload |
| TemplateCategoryService | `formatCategory(row)` | id, name, description, sortOrder, createdAt |
| ServiceRequestService | `formatServiceRequest(r)` | id, requestedBy, triggerContext, capabilityDescription, specification, specSchemaVersion, status, reviewedBy, reviewNotes, createdAt, updatedAt |
| WidgetService | `formatConfig(row, isCustom)` | courseId, courseName, heading, subheading, buttonText, primaryColor, successMessage, showLastName, enabled, isCustom, updatedAt |
| WidgetService | `formatFullConfig(row)` | id, courseId, heading, subheading, buttonText, primaryColor, successMessage, showLastName, enabled, createdAt, updatedAt |

**For services WITHOUT format functions** (inline formatting), read the return statement in each method:
- CourseService (list, listPublic)
- ContactSyncService (list, importContacts, pushToHubSpot, syncHubSpot)
- EmailService (send, sendBulk, getGmailTokens, etc.)
- SettingsService (getEmailConfig, getNotificationSettings, etc.)
- SuppressionService (list, export, etc.)
- TagService (list)
- WebhookService (processStripeEvent, processSendGridEvents)
- NotificationService (send)
- RegistryService (list, getByName)
- ExtractionService (extractContacts)
- JourneyExecutor (run, resume — both void)
- AIService (listPrompts, createPrompt, deletePrompt)

**Also create:**
- `packages/backend/src/types/service-inputs.ts` — input/filter types for service method parameters (LeadFilters, JourneyFilters, SurveyFilters, ExecutionFilters, CreateTemplateInput, UpdateTemplateInput, CreateSurveyInput, etc.)
- List/paginated response wrappers:

```typescript
export interface PaginatedResponse<T> {
  items: T[];
  meta: { total: number; limit: number; offset: number };
}

export interface ListLeadsResponse {
  leads: FormattedLead[];
  meta: { total: number; limit: number; offset: number };
}
```

**Estimated output:** ~80 interfaces covering all 196 methods.

**Gate:** File exists, `npx tsc --noEmit` passes. Update PROGRESS.md.

---

## ⛔ CHECKPOINT — COMMIT

**Commit all work so far.** Steps 0.1 through A.1 are complete.

Update PROGRESS.md with:
- Baseline test count
- Number of interfaces created
- Any issues encountered

**Continue in Mode 1** for steps A.2 through A.5.

---

## Step A.2: Add Return Type Annotations to Service Methods

Edit each of the 30 service files. Add `Promise<ReturnType>` annotation to every public method.

```typescript
// Before
async list(filters: LeadFilters, pagination: PaginationQuery) { ... }

// After
async list(filters: LeadFilters, pagination: PaginationQuery): Promise<ListLeadsResponse> { ... }
```

**Priority order** (by defect count and tool usage):
1. LeadService (7 methods) — most historical defects
2. JourneyService (13 methods) — most methods
3. SurveyService (13 methods)
4. WidgetService (6 methods) — newest, most `as any` in tools
5. ScoringService (11 methods)
6. ExecutionService (9 methods)
7. ReplyService (9 methods)
8. TemplateService (7 methods)
9. AlertService (7 methods)
10. All remaining services

**Gate after each service:** Run `npm test`. Type annotations are additive — they should not break anything. Update PROGRESS.md after each service.

## Step A.3: Remove `as any` from ARIA Tools

Remove all 39 `as any` casts from 14 ARIA tool files.

**Pattern 1 — Argument casts (21 occurrences):**
```typescript
// Before
const result = await leadService.list(filters as any, { limit: 20, offset: 0 });

// After — use the input types from service-inputs.ts
const result = await leadService.list(filters, { limit: 20, offset: 0 });
```

**Pattern 2 — Return value casts (11) + field access (7):**
```typescript
// Before
const config = await widgetService.getConfig(resolved.id!) as any;
content: `Button text: "${config.buttonText}"\n`

// After — typed return means TypeScript validates field access
const config = await widgetService.getConfig(resolved.id!);
content: `Button text: "${config.buttonText}"\n`
```

**Files and cast counts:**

| File | Casts | Primary Service |
|------|-------|----------------|
| widget-tools.ts | 5 | WidgetService |
| survey-tools.ts | 4 | SurveyService |
| enrollment-tools.ts | 3 | EnrollmentService |
| template-tools.ts | 3 | TemplateService |
| lead-tools.ts | 3 | LeadService |
| scoring-tools.ts | 3 | ScoringService |
| promo-tools.ts | 3 | PromoCodeService |
| journey-tools.ts | 3 | JourneyService |
| reply-tools.ts | 3 | ReplyService |
| alert-tools.ts | 2 | AlertService |
| payment-tools.ts | 2 | PaymentService |
| execution-tools.ts | 2 | ExecutionService |
| user-tools.ts | 1 | UserService |
| ui-tools.ts | 0 | (already clean) |

**Gate:** `grep -rn "as any" packages/backend/src/services/aria/tools/` → 0 results. Update PROGRESS.md.

## Step A.4: Type the MCP HTTP Client

**Edit:** `packages/mcp-server/src/client.ts`

```typescript
// Before (5 methods all returning Promise<any>)
async get(path: string, params?: Record<string, unknown>): Promise<any>
async post(path: string, body?: unknown): Promise<any>
async put(path: string, body?: unknown): Promise<any>
async delete(path: string): Promise<any>
private async request(...): Promise<any>

// After — generic type parameter
async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T>
async post<T = unknown>(path: string, body?: unknown): Promise<T>
async put<T = unknown>(path: string, body?: unknown): Promise<T>
async delete<T = unknown>(path: string): Promise<T>
private async request<T = unknown>(...): Promise<T>
```

Also fix error handler:
```typescript
// Before (line 83)
const errBody: any = await res.json().catch(...)

// After
const errBody: { error?: string; message?: string } = await res.json().catch(...)
```

**Gate:** Client compiles cleanly. Update PROGRESS.md.

## Step A.5: Remove `: any` from MCP Tools

**99 casts across 16 files.** Two patterns:

**Pattern 1 — Error handlers (82 occurrences, 83%):**

Create a shared utility first:
```typescript
// packages/mcp-server/src/utils/error.ts
export function formatToolError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

Then replace every `catch (err: any)`:
```typescript
// Before
catch (err: any) {
  return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
}

// After
catch (err: unknown) {
  return { content: [{ type: "text", text: `Error: ${formatToolError(err)}` }], isError: true };
}
```

**Pattern 2 — Data map casts (17 occurrences, 17%):**
```typescript
// Before
leads.map((l: any) => `${l.firstName} ${l.lastName}`)

// After — use typed client
import type { components } from '../../../../shared/types/api';
type Lead = components['schemas']['Lead'];

const data = await client.get<{ leads: Lead[]; meta: PaginationMeta }>('/leads', args);
data.leads.map((l) => `${l.firstName} ${l.lastName}`)
```

**Files and cast counts:**

| File | Total | Error | Data Map |
|------|-------|-------|----------|
| journeys.ts | 13 | 12 | 1 |
| scoring.ts | 9 | 8 | 1 |
| surveys.ts | 9 | 8 | 1 |
| widgets.ts | 9 | 8 | 1 |
| leads.ts | 8 | 7 | 1 |
| templates.ts | 7 | 6 | 1 |
| users.ts | 6 | 5 | 1 |
| alerts.ts | 6 | 5 | 1 |
| enrollments.ts | 5 | 3 | 2 |
| promo-codes.ts | 5 | 4 | 1 |
| replies.ts | 5 | 4 | 1 |
| definitions.ts | 4 | 3 | 1 |
| executions.ts | 4 | 3 | 1 |
| contacts.ts | 3 | 3 | 0 |
| payments.ts | 3 | 2 | 1 |
| settings.ts | 3 | 3 | 0 |

**Gate:** Run the precise `: any` check (excludes legitimate uses like `Record<string, any>`):

```bash
# Match only the patterns being eliminated:
#   catch (err: any)     — error handler casts
#   ): any               — untyped return values
#   => any               — untyped arrow returns
#   const/let x: any     — untyped variable declarations
#   as any               — type assertion casts
#   (param: any)         — untyped parameters in callbacks
grep -rn -P "(catch\s*\(\w+:\s*any\)|\):\s*any\b|=>\s*any\b|(const|let|var)\s+\w+:\s*any\b|as\s+any\b|\(\w+:\s*any\))" packages/mcp-server/src/tools/
# Expected: 0 results

# Sanity check — confirm Record<string, any> is NOT matched:
echo "Record<string, any>" | grep -P "(catch\s*\(\w+:\s*any\)|\):\s*any\b|=>\s*any\b|(const|let|var)\s+\w+:\s*any\b|as\s+any\b|\(\w+:\s*any\))"
# Expected: no match (correctly excluded)
```

Update PROGRESS.md.

---

## ⛔ CHECKPOINT — COMMIT

**Commit all work.** Steps A.2 through A.5 are complete.

Update PROGRESS.md with:
- Services annotated (should be 30/30)
- ARIA `as any` remaining (should be 0/39)
- MCP `: any` remaining (should be 0/99)
- Test count (should match baseline)

**Continue in Mode 1** for step A.6.

---

## Step A.6: Add Lint Rules to Prevent Regression

**Create:** `packages/backend/src/services/aria/tools/tsconfig.json`
```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "noImplicitAny": true
  },
  "include": ["./**/*.ts"]
}
```

**Create:** `packages/mcp-server/src/tools/tsconfig.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "noImplicitAny": true
  },
  "include": ["./**/*.ts"]
}
```

Add to `.github/workflows/ci.yml`:
```yaml
- name: Check tool type safety
  run: |
    npx tsc --project packages/backend/src/services/aria/tools/tsconfig.json --noEmit
    npx tsc --project packages/mcp-server/src/tools/tsconfig.json --noEmit
```

**Gate:** Both `tsc --project` commands pass. Update PROGRESS.md.

---

## ⛔ STOP — MODE TRANSITION

**Commit Mode 1 work.** Step A.6 is complete.

**Next mode:** Mode 0 (Static Audit) for step A.7.

**Trigger:** "Go to mode 0. Execute step A.7 from PLAN.md — full Phase A verification audit."

---

# Mode 0 — Static Audit

## Step A.7: Full Phase A Verification

Run the complete verification suite:

```bash
# 1. Zero as any casts in ARIA tools
grep -rn "as any" packages/backend/src/services/aria/tools/ | wc -l
# Expected: 0

# 2. Zero problematic : any casts in MCP tools (precise check)
grep -rn -P "(catch\s*\(\w+:\s*any\)|\):\s*any\b|=>\s*any\b|(const|let|var)\s+\w+:\s*any\b|as\s+any\b|\(\w+:\s*any\))" packages/mcp-server/src/tools/ | wc -l
# Expected: 0

# 3. All tests pass
npm test
# Expected: same count as baseline (Step 0.3)

# 4. TypeScript compiles cleanly
npx tsc --noEmit
# Expected: 0 errors

# 5. noImplicitAny enforced
npx tsc --project packages/backend/src/services/aria/tools/tsconfig.json --noEmit
npx tsc --project packages/mcp-server/src/tools/tsconfig.json --noEmit
# Expected: 0 errors

# 6. Drift detection — rename a field in any format() function, confirm tsc catches it
# (manual test, then revert)
```

**Gate:** ALL 6 checks must pass. If any fail, switch to Mode 1, fix, then re-audit.

Update PROGRESS.md with final Phase A results. Mark Phase A as COMPLETE.

---

## ⛔ STOP — PHASE TRANSITION + HANDOFF

**Phase A is complete.** Commit, push, update PROGRESS.md.

**What happens next:**
1. Solution Architect Agent authors 6 canonical models (step B.3)
2. Full-Stack Agent receives the models and continues with B.1, B.2, B.4–B.7

**Do NOT proceed to Phase B until the Solution Architect has delivered the canonical models and updated PROGRESS.md with B.3 = DONE.**

**Trigger for next session:** "Go to mode 1. Execute steps B.1, B.2, B.4 from PLAN.md. The canonical models are ready in models/."

---

## Step B.3: Canonical Model Authoring (Solution Architect)

*This step is performed by the Solution Architect Agent, not the Full-Stack Agent. It is included here for completeness and to define acceptance criteria.*

### Target

Author 6 canonical models in FABRIC schema v3.6.0 format. Each model is a YAML file placed in `models/` at the CRM repo root.

### Domains and Sources of Truth

| Domain | Canonical Model File | Primary Service Files | Database Tables | Format Functions |
|--------|---------------------|-----------------------|-----------------|-----------------|
| lead-management | `models/lead-management.canonical-model.yaml` | LeadService.ts, ContactSyncService.ts | leads, lead_tags, lead_properties | formatLead, formatExecution, formatEnrollment, formatScoringEvent, formatPayment |
| journey-engine | `models/journey-engine.canonical-model.yaml` | JourneyService.ts, ExecutionService.ts, JourneyExecutor.ts, SchedulerService.ts | journeys, journey_executions, execution_steps, execution_events, scheduled_actions | formatJourney, formatExecution, formatExecutionStep, formatExecutionEvent, formatAction |
| survey-feedback | `models/survey-feedback.canonical-model.yaml` | SurveyService.ts, ReplyService.ts | surveys, survey_questions, survey_responses, replies | formatSurvey, formatQuestion, formatReply |
| monetization | `models/monetization.canonical-model.yaml` | PaymentService.ts, PromoCodeService.ts, EnrollmentService.ts | payments, promo_codes, enrollments | formatPayment, formatPromoCode, formatEnrollment |
| scoring-alerts | `models/scoring-alerts.canonical-model.yaml` | ScoringService.ts, AlertService.ts | scoring_signals, scoring_events, alerts | formatSignal, formatScoringEvent, formatAlert |
| platform | `models/platform.canonical-model.yaml` | UserService.ts, AuthService.ts, TemplateService.ts, TemplateCategoryService.ts, SettingsService.ts, DefinitionService.ts, RegistryService.ts, WidgetService.ts | users, email_templates, template_categories, course_definitions, widget_configs | formatUser, formatTemplate, formatCategory, formatDefinition, formatConfig, formatFullConfig |

### Derivation Process

For each domain:
1. Read the database tables in `docs/schema_v3_2.sql` — these define the persisted fields
2. Read the `format*()` functions in the service files — these define the API-facing shape
3. Read the Phase A interfaces in `service-returns.ts` — these are the typed contracts from Step A.1
4. Author the canonical model YAML with entities, fields, enums, and relationships that cover all three layers

### Validation

After authoring each model:

```bash
npm run fabric -- validate --domain <domain-name>
```

The model must pass validation with 0 errors and 0 gap flags.

### Cross-Check

For each model, compare its entity fields against the corresponding `format()` function return fields from the Phase A interfaces:

- Every field in the Phase A interface must have a corresponding field in the canonical model
- Field types must be compatible (e.g., `string` in TypeScript maps to `string` in the model)
- Enum values must match the database CHECK constraints or application-level enums

### Acceptance Criteria

All of the following must be true before marking B.3 as DONE:
1. All 6 model files exist in `models/` directory
2. All 6 pass `fabric validate` with 0 errors and 0 gap flags
3. Every field in every Phase A interface has a corresponding canonical model field
4. Enum values match the database schema and service-level enums
5. PROGRESS.md updated with entity count, field count, and scenario count per domain

---

# Mode 1 — Feature Development

**Prerequisite:** Phase A complete. Solution Architect has delivered 6 canonical models in `models/` directory. PROGRESS.md shows B.3 = DONE.

## Step B.1: Install FABRIC Tooling

Add FABRIC as a git submodule pinned to a specific commit:

```bash
git submodule add https://github.com/pmcoe-ai1/FABRIC.git fabric
cd fabric
git checkout <commit-hash>   # Pin to the latest stable commit
cd ..
git add .gitmodules fabric
git commit -m "Add FABRIC as git submodule at <commit-hash>"
```

Verify the binary works:
```bash
chmod +x fabric/bin/fabric
node fabric/bin/fabric --version
```

Add to root `package.json` scripts:
```json
"fabric": "node fabric/bin/fabric"
```

**Gate:** `npm run fabric -- --version` works. Update PROGRESS.md.

### Updating FABRIC

To pull a newer version of FABRIC in the future:

```bash
cd fabric
git fetch origin
git checkout <new-commit-or-tag>
cd ..
git add fabric
git commit -m "Update FABRIC submodule to <new-commit-or-tag>"
```

To check which version is currently pinned:
```bash
git submodule status
```

## Step B.2: Create FABRIC Config

**Create:** `fabric.config.json` at CRM monorepo root:

```json
{
  "version": "1.0.0",
  "domains": {
    "lead-management": {
      "model": "models/lead-management.canonical-model.yaml",
      "outputDir": "packages/backend/src/generated/lead-management",
      "filledDir": "models/templates/lead-management",
      "rulesDir": "packages/backend/src/rules/lead-management"
    },
    "journey-engine": {
      "model": "models/journey-engine.canonical-model.yaml",
      "outputDir": "packages/backend/src/generated/journey-engine",
      "filledDir": "models/templates/journey-engine",
      "rulesDir": "packages/backend/src/rules/journey-engine"
    },
    "survey-feedback": {
      "model": "models/survey-feedback.canonical-model.yaml",
      "outputDir": "packages/backend/src/generated/survey-feedback",
      "filledDir": "models/templates/survey-feedback",
      "rulesDir": "packages/backend/src/rules/survey-feedback"
    },
    "monetization": {
      "model": "models/monetization.canonical-model.yaml",
      "outputDir": "packages/backend/src/generated/monetization",
      "filledDir": "models/templates/monetization",
      "rulesDir": "packages/backend/src/rules/monetization"
    },
    "scoring-alerts": {
      "model": "models/scoring-alerts.canonical-model.yaml",
      "outputDir": "packages/backend/src/generated/scoring-alerts",
      "filledDir": "models/templates/scoring-alerts",
      "rulesDir": "packages/backend/src/rules/scoring-alerts"
    },
    "platform": {
      "model": "models/platform.canonical-model.yaml",
      "outputDir": "packages/backend/src/generated/platform",
      "filledDir": "models/templates/platform",
      "rulesDir": "packages/backend/src/rules/platform"
    }
  }
}
```

**Note on signals and scores:** The FABRIC pipeline supports optional `signals` and `scores` config keys for the signal-collector and confidence-score modules. These are **not used in the initial retrofit** because:
- Signal collection requires runtime event instrumentation not yet in place
- Confidence scores are derived from signal data

These will be added in a future phase when the CRM has runtime signal collection. For now, omitting them from the config causes the pipeline to skip those stages gracefully.

**Gate:** Config file exists and is valid JSON. Update PROGRESS.md.

## Step B.4: Run the Full FABRIC Pipeline

For each of the 6 domains, run the complete pipeline in order. **Do not skip stages** — each depends on the output of the previous.

### Stage 1: Validate

```bash
npm run fabric -- validate --domain lead-management
```

Confirms the canonical model conforms to schema v3.6.0.

### Stage 2: Generate Fill Templates

```bash
# Create filledDir directories
mkdir -p models/templates/lead-management
mkdir -p models/templates/journey-engine
mkdir -p models/templates/survey-feedback
mkdir -p models/templates/monetization
mkdir -p models/templates/scoring-alerts
mkdir -p models/templates/platform

# Generate fill templates from the canonical model
npm run fabric -- template-generator --domain lead-management
```

This produces template YAML files in the `filledDir` with empty rule slots ready for the fill stage.

### Stage 3: AI Fill

```bash
npm run fabric -- fill --domain lead-management
```

**Requires `ANTHROPIC_API_KEY` environment variable.** The fill stage uses Claude to populate rule slots in the templates based on the canonical model's entity definitions and scenarios.

**If `ANTHROPIC_API_KEY` is not available:** The fill stage will fail. You cannot proceed to gate or codegen without filled templates. Set the key and retry:
```bash
export ANTHROPIC_API_KEY=<your-key>
npm run fabric -- fill --domain lead-management
```

### Stage 4: Gate Passes

```bash
npm run fabric -- gate --domain lead-management --pass 1
npm run fabric -- gate --domain lead-management --pass 2
npm run fabric -- gate --domain lead-management --pass 3
npm run fabric -- gate --domain lead-management --pass 4
```

Gate passes validate the filled templates for completeness (Pass 1), consistency (Pass 2), correctness (Pass 3), and coverage (Pass 4). All 4 passes must succeed before codegen.

### Stage 5: Codegen

```bash
npm run fabric -- codegen --domain lead-management
```

Generates TypeScript interfaces, operation stubs, rule stubs, OpenAPI specs, and Prisma schemas in the `outputDir`.

### Stage 6: Verify

```bash
npx tsc --noEmit
npm test
```

### Repeat for all domains

Run Stages 1–6 for: lead-management, journey-engine, survey-feedback, monetization, scoring-alerts, platform.

**Gate:** All 6 domains pass all stages. `tsc --noEmit` passes. `npm test` passes. Update PROGRESS.md.

## Step B.4.5: Artifact Integration & Schema Reconciliation

FABRIC codegen produces several artifact types per domain. This step documents how each is used in the CRM.

### Generated Artifact Strategy

| Artifact | Location | Strategy |
|----------|----------|----------|
| **TypeScript interfaces** | `<outputDir>/interfaces/` | **USED** — Re-exported in Step B.5 to replace hand-written Phase A types |
| **Operation stubs** | `<outputDir>/operations/` | **Reference-only** — The existing service layer (`packages/backend/src/services/*.ts`) remains the implementation. Generated operation stubs serve as documentation of what the canonical model expects. Do NOT wire them into the service layer. |
| **Rule stubs** | `<rulesDir>/` | **Reference-only** — No business rules engine exists in the CRM yet. Rule stubs document validation and business logic implied by the canonical model. They may be implemented in a future phase. |
| **OpenAPI specs** | `<outputDir>/openapi/` | **Reference-only** — The existing `docs/api-spec_v5.yaml` remains the authoritative API contract. Generated OpenAPI specs can be compared against it to identify gaps but do NOT replace it. |
| **Prisma schemas** | `<outputDir>/prisma/` | **Reference-only** — See reconciliation below. |

### Prisma / Database Schema Reconciliation

The CRM uses raw SQL migrations (`docs/schema_v3_2.sql` + `packages/backend/migrations/`), not Prisma. Generated Prisma schemas are **reference-only** and will NOT be used for database migrations.

**Reconciliation check** — after codegen, compare generated Prisma models against the existing database:

```bash
# For each domain, diff generated Prisma entity fields against schema_v3_2.sql
# Look for:
#   1. Fields in Prisma but not in SQL → canonical model has extra fields (fix model)
#   2. Fields in SQL but not in Prisma → canonical model is missing fields (fix model)
#   3. Type mismatches (e.g., Prisma String vs SQL INTEGER)
```

If discrepancies are found:
1. Report them to the Solution Architect
2. The architect updates the canonical model
3. Re-run the pipeline for the affected domain
4. Do NOT modify the database schema to match generated Prisma — the SQL schema is the source of truth for persistence

**Gate:** All reconciliation checks pass (no unexpected discrepancies). Update PROGRESS.md.

---

## ⛔ STOP — COMMIT

**Commit Mode 1 work.** Steps B.1, B.2, B.4, B.4.5 are complete.

**Continue in Mode 1** for step B.5 — replacing hand-written types with generated types.

**Trigger:** "Continue mode 1. Execute step B.5 from PLAN.md."

---

## Step B.5: Replace Hand-Written Types with Generated Types

```typescript
// Before (Phase A — hand-written in service-returns.ts)
export interface FormattedLead {
  id: string;
  email: string;
  // ...
}

// After (Phase B — re-export from generated)
export type { Lead as FormattedLead } from '../generated/lead-management/interfaces/Lead';
export type { LeadStatus } from '../generated/lead-management/interfaces/enums';
```

**Strategy:** Re-export generated types from `service-returns.ts` using type aliases. This preserves the import paths used by ARIA/MCP tools (from Phase A) while switching the source of truth to the canonical model.

Do this for all 6 domains. After each domain:
1. Replace hand-written interfaces with re-exports
2. Run `npx tsc --noEmit`
3. Run `npm test`
4. If types don't match, compare generated interface vs format() function field-by-field

**Gate:** All hand-written interfaces replaced. `tsc` passes. `npm test` passes. Update PROGRESS.md.

---

## ⛔ STOP — COMMIT

**Commit work.** Step B.5 is complete.

**Continue in Mode 1** for step B.6.

**Trigger:** "Continue mode 1. Execute step B.6 from PLAN.md."

---

## Step B.6: Add FABRIC to CI

Add to `.github/workflows/ci.yml`:

```yaml
- name: FABRIC Validate
  run: npm run fabric -- validate

- name: FABRIC Gate (models — Pass 3-4)
  run: |
    for domain in lead-management journey-engine survey-feedback monetization scoring-alerts platform; do
      npm run fabric -- gate --domain $domain --pass 3
      npm run fabric -- gate --domain $domain --pass 4
    done

- name: FABRIC Gate (filled templates — Pass 1-4)
  run: |
    for domain in lead-management journey-engine survey-feedback monetization scoring-alerts platform; do
      npm run fabric -- gate --domain $domain --pass 1
      npm run fabric -- gate --domain $domain --pass 2
      npm run fabric -- gate --domain $domain --pass 3
      npm run fabric -- gate --domain $domain --pass 4
    done

- name: FABRIC Codegen
  run: npm run fabric -- codegen

- name: TypeScript Check (includes generated types)
  run: npx tsc --noEmit
```

**Intentionally excluded from CI:**
- **template-generator** and **fill** — These are authoring-time tools, not build-time checks. Templates are generated once during model authoring and committed to the repo. CI verifies the committed templates via gate passes.
- **Scenario tests** — Not yet applicable. Will be added when the CRM implements runtime rule evaluation from generated rule stubs.

**Gate:** CI workflow updated. All steps pass. Update PROGRESS.md.

---

## ⛔ STOP — MODE TRANSITION

**Commit Mode 1 work.** Step B.6 is complete.

**Next mode:** Mode 0 (Static Audit) for step B.7.

**Trigger:** "Go to mode 0. Execute step B.7 from PLAN.md — full Phase B verification audit."

---

# Mode 0 — Static Audit

## Step B.7: Full Phase B Verification

```bash
# 1. All canonical models validate
npm run fabric -- validate
# Expected: 0 errors, 0 gap flags for all 6 domains

# 2. All gate passes succeed on filled templates
for domain in lead-management journey-engine survey-feedback monetization scoring-alerts platform; do
  npm run fabric -- gate --domain $domain --pass 1
  npm run fabric -- gate --domain $domain --pass 2
  npm run fabric -- gate --domain $domain --pass 3
  npm run fabric -- gate --domain $domain --pass 4
done
# Expected: all pass

# 3. Generated types are in use (no hand-written interfaces remain)
grep -c "export interface" packages/backend/src/types/service-returns.ts
# Expected: 0 (all should be re-exports)

# 4. All tests pass
npm test
# Expected: same count as Phase A gate

# 5. TypeScript compiles with generated types
npx tsc --noEmit
# Expected: 0 errors

# 6. Drift detection — edit a canonical model (rename a field) → re-run codegen → tsc fails
# (manual test, then revert)

# 7. Phase A checks still pass
grep -rn "as any" packages/backend/src/services/aria/tools/ | wc -l
# Expected: 0
grep -rn -P "(catch\s*\(\w+:\s*any\)|\):\s*any\b|=>\s*any\b|(const|let|var)\s+\w+:\s*any\b|as\s+any\b|\(\w+:\s*any\))" packages/mcp-server/src/tools/ | wc -l
# Expected: 0
```

**Gate:** ALL 7 checks must pass. Update PROGRESS.md. Mark Phase B as COMPLETE.

---

# Execution Summary

```
MODE 1 (Feature)     0.1 → 0.2 → 0.3 → 0.4 → A.1
                     ⛔ CHECKPOINT — commit, update progress

MODE 1 (Feature)     A.2 → A.3 → A.4 → A.5
                     ⛔ CHECKPOINT — commit, update progress

MODE 1 (Feature)     A.6
                     ⛔ STOP — MODE TRANSITION — commit, update progress

MODE 0 (Audit)       A.7
                     ⛔ STOP — PHASE A COMPLETE — HANDOFF TO ARCHITECT

  ┌──────────────────────────────────────────────────────┐
  │  ARCHITECT: Author 6 canonical models (step B.3)     │
  │  Schema version: v3.6.0                              │
  │  Delivers: models/*.canonical-model.yaml             │
  │  Validates: fabric validate per domain               │
  │  Cross-checks: vs Phase A interfaces                 │
  │  Updates PROGRESS.md: B.3 = DONE                     │
  └──────────────────────────────────────────────────────┘

MODE 1 (Feature)     B.1 → B.2 → B.4 → B.4.5
                     ⛔ CHECKPOINT — commit, update progress

MODE 1 (Feature)     B.5
                     ⛔ CHECKPOINT — commit, update progress

MODE 1 (Feature)     B.6
                     ⛔ STOP — MODE TRANSITION — commit, update progress

MODE 0 (Audit)       B.7
                     ⛔ DONE — PHASE B COMPLETE
```

---

# Files Created

## Phase A
| File | Purpose |
|------|---------|
| `packages/backend/src/types/service-returns.ts` | ~80 interfaces for all service return types |
| `packages/backend/src/types/service-inputs.ts` | Input/filter types for service method parameters |
| `packages/mcp-server/src/utils/error.ts` | Shared error handler utility (replaces 82 `err: any`) |
| `packages/backend/src/services/aria/tools/tsconfig.json` | `noImplicitAny` enforcement for ARIA tools |
| `packages/mcp-server/src/tools/tsconfig.json` | `noImplicitAny` enforcement for MCP tools |

## Phase B
| File | Purpose |
|------|---------|
| `.gitmodules` | FABRIC submodule reference |
| `fabric/` | FABRIC tooling (git submodule) |
| `fabric.config.json` | FABRIC domain configuration |
| `models/*.canonical-model.yaml` | 6 canonical domain models (authored by architect) |
| `models/templates/*/` | Filled templates for each domain |
| `packages/backend/src/generated/` | All codegen output (6 domain subdirectories) |
| `packages/backend/src/rules/` | Generated rule stubs (reference-only) |

# Files Modified

## Phase A
| Files | Count | Change |
|-------|-------|--------|
| `packages/backend/src/services/*.ts` | 30 | Add return type annotations |
| `packages/backend/src/services/aria/tools/*.ts` | 14 | Remove `as any` casts |
| `packages/mcp-server/src/client.ts` | 1 | Add generic type parameters |
| `packages/mcp-server/src/tools/*.ts` | 16 | Replace `: any` with typed imports |
| `.github/workflows/ci.yml` | 1 | Add tool type safety check |

## Phase B
| Files | Count | Change |
|-------|-------|--------|
| `packages/backend/src/types/service-returns.ts` | 1 | Re-export generated types |
| `.github/workflows/ci.yml` | 1 | Add FABRIC validate + gate + codegen steps |

---

# Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Type annotations break existing tests | Medium | Run `npm test` after EACH service file (A.2) |
| Hand-written interfaces don't match runtime | High | Derive from format() functions, not guessing |
| Clone has stale dependencies | Low | Run `npm install` fresh in clone |
| FABRIC codegen doesn't match service returns | Medium | Compare generated vs Phase A interfaces field-by-field |
| Canonical model disagrees with production schema | High | Author model FROM schema_v3_2.sql; reconcile in B.4.5 |
| CI takes too long with FABRIC steps | Low | Run FABRIC only on changed domains |
| Phase B re-export breaks ARIA/MCP imports | Medium | Use type aliases to preserve import paths |
| `ANTHROPIC_API_KEY` not available for fill stage | High | Document requirement in Environment Setup; fill cannot be skipped |
| FABRIC submodule version drifts | Low | Pin to specific commit; document update procedure |
| Generated Prisma conflicts with existing schema | Medium | Prisma is reference-only; SQL schema is source of truth (B.4.5) |
| Generated operation/rule stubs unused | Low | Explicitly documented as reference-only; no dead code in service layer |

---

*End of Brief*
