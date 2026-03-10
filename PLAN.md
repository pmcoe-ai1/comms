# CRM Type Safety Retrofit — Full-Stack Agent Brief

**From:** Solution Architect Agent
**To:** Full-Stack Coding Agent
**Date:** 2026-03-10
**Objective:** Clone PM CoE to a new "CRM" repo, then execute Phase A (Type Contracts) and Phase B (Canonical Models) to eliminate the systemic type safety deficiency.
**Progress tracker:** `packages/Architecture/PROGRESS.md` — update after every step.

**Risk mitigation:** All changes happen in the cloned repo. The production PM CoE app is never touched.

---

# Mode 1 — Feature Development

## Step 0: Clone the Codebase

### 0.1 Create the CRM Repository

```bash
cd /Users/alankwon/Documents/AI
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

## ⛔ STOP — MODE TRANSITION

**Commit all Mode 1 work.** Steps 0.1 through A.1 are complete.

Update PROGRESS.md with:
- Baseline test count
- Number of interfaces created
- Any issues encountered

**Next mode:** Mode 2 (Defect Fix) for steps A.2 through A.5.

**Trigger:** "Go to mode 2. Execute steps A.2 through A.5 from PLAN.md."

---

# Mode 2 — Defect Fix

**Evidence (already gathered by Solution Architect):**
- Root cause: 138 `as any` / `: any` casts across tool files caused 25+ production defects
- 5 Whys traced to: no enforcement mechanism for cross-layer type safety
- Three failure modes identified: Mode A (name vs UUID), Mode B (wrong field name), Mode C (wrong enum)
- Phase A.1 interfaces now exist — the typed contracts are in place

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

**Gate:** `grep -r "as any" packages/backend/src/services/aria/tools/` → 0 results. Update PROGRESS.md.

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

**Gate:** `grep -r ": any" packages/mcp-server/src/tools/` → 0 results. Update PROGRESS.md.

---

## ⛔ STOP — MODE TRANSITION

**Commit all Mode 2 work.** Steps A.2 through A.5 are complete.

Update PROGRESS.md with:
- Services annotated (should be 30/30)
- ARIA `as any` remaining (should be 0/39)
- MCP `: any` remaining (should be 0/99)
- Test count (should match baseline)

**Next mode:** Mode 1 (Feature Development) for step A.6.

**Trigger:** "Go to mode 1. Execute step A.6 from PLAN.md."

---

# Mode 1 — Feature Development

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
grep -r "as any" packages/backend/src/services/aria/tools/ | wc -l
# Expected: 0

# 2. Zero : any casts in MCP tools
grep -r ": any" packages/mcp-server/src/tools/ | wc -l
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

**Gate:** ALL 6 checks must pass. If any fail, switch to Mode 2, fix, then re-audit.

Update PROGRESS.md with final Phase A results. Mark Phase A as COMPLETE.

---

## ⛔ STOP — PHASE TRANSITION + HANDOFF

**Phase A is complete.** Commit, push, update PROGRESS.md.

**What happens next:**
1. Solution Architect Agent authors 6 canonical models (step B.3)
2. Full-Stack Agent receives the models and continues with B.1, B.2, B.4–B.7

**Do NOT proceed to Phase B until the Solution Architect has delivered the canonical models and updated PROGRESS.md with B.3 = DONE.**

**Trigger for next session:** "Go to mode 1. Execute steps B.1, B.2, B.4 from PLAN.md. The canonical models are ready in /models/."

---

# Mode 1 — Feature Development

**Prerequisite:** Phase A complete. Solution Architect has delivered 6 canonical models in `models/` directory. PROGRESS.md shows B.3 = DONE.

## Step B.1: Install FABRIC Tooling

```bash
# Copy FABRIC from sibling repo
cp -R /Users/alankwon/Documents/AI/FABRIC/lib ./fabric/lib
cp -R /Users/alankwon/Documents/AI/FABRIC/bin ./fabric/bin
cp -R /Users/alankwon/Documents/AI/FABRIC/schema ./fabric/schema
cp /Users/alankwon/Documents/AI/FABRIC/dkce.config.json ./fabric/dkce.config.json.example

chmod +x fabric/bin/dkce
```

Add to root `package.json` scripts:
```json
"dkce": "node fabric/bin/dkce"
```

**Gate:** `npm run dkce -- --version` works. Update PROGRESS.md.

## Step B.2: Create DKCE Config

**Create:** `dkce.config.json` at CRM monorepo root:

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
  },
  "signals": "dkce-signals.json",
  "scores": "dkce-confidence-scores.json"
}
```

**Gate:** Config file exists and is valid JSON. Update PROGRESS.md.

## Step B.4: Run the Pipeline

For each of the 6 domains:

```bash
npm run dkce -- validate --domain lead-management
npm run dkce -- codegen --domain lead-management
npx tsc --noEmit
npm test
```

Repeat for: journey-engine, survey-feedback, monetization, scoring-alerts, platform.

**Gate:** All 6 domains validate and generate. `tsc --noEmit` passes. `npm test` passes. Update PROGRESS.md.

---

## ⛔ STOP — MODE TRANSITION

**Commit Mode 1 work.** Steps B.1, B.2, B.4 are complete.

**Next mode:** Mode 2 (Defect Fix) for step B.5 — replacing drift-prone hand-written types with generated types.

**Trigger:** "Go to mode 2. Execute step B.5 from PLAN.md."

---

# Mode 2 — Defect Fix

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

## ⛔ STOP — MODE TRANSITION

**Commit Mode 2 work.** Step B.5 is complete.

**Next mode:** Mode 1 (Feature Development) for step B.6.

**Trigger:** "Go to mode 1. Execute step B.6 from PLAN.md."

---

# Mode 1 — Feature Development

## Step B.6: Add DKCE to CI

Add to `.github/workflows/ci.yml`:

```yaml
- name: DKCE Validate
  run: npm run dkce -- validate

- name: DKCE Codegen
  run: npm run dkce -- codegen

- name: TypeScript Check (includes generated types)
  run: npx tsc --noEmit
```

**Gate:** CI workflow updated. Update PROGRESS.md.

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
npm run dkce -- validate
# Expected: 0 errors, 0 gap flags for all 6 domains

# 2. Generated types are in use (no hand-written interfaces remain)
grep -c "export interface" packages/backend/src/types/service-returns.ts
# Expected: 0 (all should be re-exports)

# 3. All tests pass
npm test
# Expected: same count as Phase A gate

# 4. TypeScript compiles with generated types
npx tsc --noEmit
# Expected: 0 errors

# 5. Drift detection — edit a canonical model (rename a field) → re-run codegen → tsc fails
# (manual test, then revert)

# 6. Phase A checks still pass
grep -r "as any" packages/backend/src/services/aria/tools/ | wc -l
# Expected: 0
grep -r ": any" packages/mcp-server/src/tools/ | wc -l
# Expected: 0
```

**Gate:** ALL 6 checks must pass. Update PROGRESS.md. Mark Phase B as COMPLETE.

---

# Execution Summary

```
MODE 1 (Feature)     0.1 → 0.2 → 0.3 → 0.4 → A.1
                     ⛔ STOP — commit, update progress

MODE 2 (Defect Fix)  A.2 → A.3 → A.4 → A.5
                     ⛔ STOP — commit, update progress

MODE 1 (Feature)     A.6
                     ⛔ STOP — commit, update progress

MODE 0 (Audit)       A.7
                     ⛔ STOP — PHASE A COMPLETE — HANDOFF TO ARCHITECT

  ┌──────────────────────────────────────────────────────┐
  │  ARCHITECT: Author 6 canonical models (step B.3)     │
  │  Delivers: models/*.canonical-model.yaml             │
  │  Updates PROGRESS.md: B.3 = DONE                     │
  └──────────────────────────────────────────────────────┘

MODE 1 (Feature)     B.1 → B.2 → B.4
                     ⛔ STOP — commit, update progress

MODE 2 (Defect Fix)  B.5
                     ⛔ STOP — commit, update progress

MODE 1 (Feature)     B.6
                     ⛔ STOP — commit, update progress

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
| `dkce.config.json` | DKCE domain configuration |
| `packages/backend/src/generated/` | All codegen output (6 domain subdirectories) |

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
| `.github/workflows/ci.yml` | 1 | Add DKCE validate + codegen steps |

---

# Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Type annotations break existing tests | Medium | Run `npm test` after EACH service file (A.2) |
| Hand-written interfaces don't match runtime | High | Derive from format() functions, not guessing |
| Clone has stale dependencies | Low | Run `npm install` fresh in clone |
| FABRIC codegen doesn't match service returns | Medium | Compare generated vs Phase A interfaces field-by-field |
| Canonical model disagrees with production schema | High | Author model FROM schema_v3_2.sql |
| CI takes too long with DKCE steps | Low | Run DKCE only on changed domains |
| Phase B re-export breaks ARIA/MCP imports | Medium | Use type aliases to preserve import paths |

---

*End of Brief*
