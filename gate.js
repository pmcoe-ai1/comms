#!/usr/bin/env node
/**
 * DKCE Enforcement Gate
 *
 * Validates filled templates and source code against the canonical model.
 * Three passes:
 *
 * Pass 1 — Structural validation (requires filled template):
 *   - Field references, operator validity, enum values, immutability, lifecycle checks
 *
 * Pass 2 — Semantic validation (requires filled template):
 *   - Evaluates filled conditions against scenario field values
 *
 * Pass 3 — Throw-checker (always runs):
 *   - Scans src/rules/ and src/operations/ for throw statements
 *   - Verifies thrown error codes are declared in canonical model errorResponses
 *
 * Usage:
 *   node gate.js                                    — runs Pass 3 only
 *   node gate.js <filled-template.yaml>             — runs Pass 1, 2, 3
 *   node gate.js <filled-template.yaml> --model <m> — runs Pass 1, 2, 3 with custom model
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const modelIndex = args.indexOf('--model');
const modelArg   = modelIndex !== -1 ? args[modelIndex + 1] : null;
const rulesDirIndex = args.indexOf('--rules-dir');
const rulesDirArg   = rulesDirIndex !== -1 ? args[rulesDirIndex + 1] : null;

// Separate positional args from flags
const positionalArgs = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  if (i > 0 && args[i - 1].startsWith('--')) return false;
  return true;
});

const filledPath      = positionalArgs.length > 0 ? positionalArgs[0] : null;
const runTemplateGate = filledPath !== null;

// Find canonical model
function findModel() {
  if (modelArg) {
    if (fs.existsSync(modelArg)) return modelArg;
    console.error(`Error: canonical model not found: ${modelArg}`);
    process.exit(1);
  }
  if (runTemplateGate) {
    console.error('Error: --model is required when running template gate. Pass --model <path-to-canonical-model.yaml>');
    process.exit(1);
  }
  const candidates = [
    'files/example.canonical-model.yaml',
    'example.canonical-model.yaml',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  console.error(`Error: canonical model not found. Tried: ${candidates.join(', ')}`);
  process.exit(1);
}

const modelPath = findModel();

if (runTemplateGate && !fs.existsSync(filledPath)) {
  console.error(`Error: filled template not found: ${filledPath}`);
  process.exit(1);
}

// ── Load files ────────────────────────────────────────────────────────────────

const model  = yaml.load(fs.readFileSync(modelPath, 'utf8'));
const filled = runTemplateGate ? yaml.load(fs.readFileSync(filledPath, 'utf8')) : null;

if (runTemplateGate && filled._meta.canonicalModelId !== model.meta.id) {
  console.error(`Model ID mismatch: template from ${filled._meta.canonicalModelId}, model is ${model.meta.id}`);
  process.exit(1);
}

// ── Build indexes ─────────────────────────────────────────────────────────────

function buildIndex(arr, key = 'id') {
  return Object.fromEntries((arr || []).map(item => [item[key], item]));
}

const entityIndex    = buildIndex(model.entities);
const eventIndex     = buildIndex(model.events || []);
const operationIndex = buildIndex(model.operations || []);
const scenarioIndex  = buildIndex(model.scenarios);
const ruleIndex      = buildIndex(model.rules);

// ── Gate result tracker ───────────────────────────────────────────────────────

const results = {
  ruleId:  runTemplateGate ? filled._meta.ruleId : null,
  pass1:   { passed: true, errors: [], warnings: [] },
  pass2:   { passed: true, errors: [], scenarioResults: [] },
  pass3:   { passed: true, errors: [], warnings: [], checks: [] },
  pass4:   { passed: true, errors: [], warnings: [] },
  overall: 'PASS',
};

function fail1(msg) { results.pass1.passed = false; results.pass1.errors.push(msg); }
function warn1(msg) { results.pass1.warnings.push(msg); }
function fail2(msg) { results.pass2.passed = false; results.pass2.errors.push(msg); }
function fail3(msg) { results.pass3.passed = false; results.pass3.errors.push(msg); }
function warn3(msg) { results.pass3.warnings.push(msg); }
function fail4(msg) { results.pass4.passed = false; results.pass4.errors.push(msg); }
function warn4(msg) { results.pass4.warnings.push(msg); }

const passIcon = p => p ? '✓' : '✗';
const bar = '─────────────────────────────────────────';

// ── Header ────────────────────────────────────────────────────────────────────

console.log('');
console.log('══ ENFORCEMENT GATE ══');
console.log(`Model: ${model.meta.id} v${model.meta.version}`);
if (runTemplateGate) {
  console.log(`Rule:  ${filled._meta.ruleId}`);
  console.log(`Entity: ${filled.context.entity.id}`);
}
console.log('');

// ── Operator validity by type ─────────────────────────────────────────────────

const VALID_OPERATORS = {
  string:   new Set(['eq', 'neq', 'contains', 'starts-with', 'ends-with', 'is-null', 'is-not-null']),
  integer:  new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not-in', 'is-null', 'is-not-null']),
  decimal:  new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is-null', 'is-not-null']),
  boolean:  new Set(['eq', 'neq']),
  datetime: new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is-null', 'is-not-null']),
  date:     new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is-null', 'is-not-null']),
  uuid:     new Set(['eq', 'neq', 'is-null', 'is-not-null']),
  enum:     new Set(['eq', 'neq', 'in', 'not-in']),
  array:    new Set(['contains', 'is-null', 'is-not-null']),
  object:   new Set(['is-null', 'is-not-null']),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Pass 1 — Structural validation (requires filled template)
// ═══════════════════════════════════════════════════════════════════════════════

if (runTemplateGate) {
  console.log(bar);
  console.log('Pass 1 — Structural');
  console.log(bar);

  const ctx      = filled.context;
  const fillData = filled.fill;
  const ruleId   = filled._meta.ruleId;
  const rule     = ruleIndex[ruleId];

  if (!rule) fail1(`Rule '${ruleId}' not found in canonical model`);

  const entity   = entityIndex[ctx.entity.id];
  if (!entity) fail1(`Entity '${ctx.entity.id}' not found in canonical model`);

  const fieldMap = entity ? Object.fromEntries(entity.fields.map(f => [f.id, f])) : {};

  // ── Glossary precision index (TASK-03) ──
  const glossaryIndex = Object.fromEntries((model.glossary || []).map(g => [g.id, g]));
  const intent = (model.intents || []).find(i => i.id === (rule ? rule.intentRef : null));
  const intentGlossaryRefs = intent ? (intent.glossaryRefs || []) : [];

  // BUG-023 fix: extract source states from condition tree for per-source lifecycle validation
  function extractSourceStates(condition, statusField) {
    if (!condition) return [];
    if (condition.and) {
      return condition.and.flatMap(c => extractSourceStates(c, statusField));
    }
    if (condition.or) {
      return condition.or.flatMap(c => extractSourceStates(c, statusField));
    }
    if (condition.not) {
      return []; // NOT does not establish a source state
    }
    // Leaf condition: field eq <value> on the status field
    if (condition.field === statusField && condition.operator === 'eq') {
      return typeof condition.value === 'string' ? [condition.value] : [];
    }
    return [];
  }

  function validateCondition(cond, condPath) {
    if (cond === null || cond === undefined) return;
    if (typeof cond !== 'object') { fail1(`${condPath}: condition must be an object`); return; }
    if (cond._slot) { fail1(`${condPath}: slot was not filled — still contains template placeholder`); return; }

    if ('and' in cond) {
      if (!Array.isArray(cond.and) || cond.and.length < 2)
        fail1(`${condPath}.and: must have at least 2 elements`);
      else cond.and.forEach((c, i) => validateCondition(c, `${condPath}.and[${i}]`));
    } else if ('or' in cond) {
      if (!Array.isArray(cond.or) || cond.or.length < 2)
        fail1(`${condPath}.or: must have at least 2 elements`);
      else cond.or.forEach((c, i) => validateCondition(c, `${condPath}.or[${i}]`));
    } else if ('not' in cond) {
      validateCondition(cond.not, `${condPath}.not`);
    } else {
      if (!cond.field) { fail1(`${condPath}: leaf condition missing 'field'`); return; }
      const field = fieldMap[cond.field];
      if (!field) {
        fail1(`${condPath}: field '${cond.field}' does not exist on entity '${ctx.entity.id}'`);
        return;
      }
      if (!cond.operator) { fail1(`${condPath}: missing 'operator'`); return; }
      const validOps = VALID_OPERATORS[field.type];
      if (validOps && !validOps.has(cond.operator)) {
        fail1(`${condPath}: operator '${cond.operator}' is not valid for field type '${field.type}'. ` +
          `Valid operators: [${[...validOps].join(', ')}]`);
      }
      const unaryOps = new Set(['is-null', 'is-not-null']);
      if (!unaryOps.has(cond.operator) && cond.value === undefined) {
        fail1(`${condPath}: operator '${cond.operator}' requires 'value'`);
      }
      if (unaryOps.has(cond.operator) && cond.value !== undefined) {
        warn1(`${condPath}: operator '${cond.operator}' is unary — 'value' will be ignored`);
      }
      if (field.type === 'enum' && field.enumValues && cond.value !== undefined) {
        const validVals = Array.isArray(cond.value) ? cond.value : [cond.value];
        for (const v of validVals) {
          if (!field.enumValues.includes(v)) {
            fail1(`${condPath}: value '${v}' is not a valid enum value for field '${cond.field}'. ` +
              `Valid values: [${field.enumValues.join(', ')}]`);
          }
        }
      }
      if (field.validation && typeof cond.value === 'number') {
        if (field.validation.min !== undefined && cond.value < field.validation.min)
          fail1(`${condPath}: value ${cond.value} is below minimum ${field.validation.min} for field '${cond.field}'`);
        if (field.validation.max !== undefined && cond.value > field.validation.max)
          fail1(`${condPath}: value ${cond.value} exceeds maximum ${field.validation.max} for field '${cond.field}'`);
      }

      // ── Glossary precision check (TASK-03) ──
      // Level A: field → glossaryRef → glossary term precision
      if (field.glossaryRef) {
        const glossaryTerm = glossaryIndex[field.glossaryRef];
        if (glossaryTerm && glossaryTerm.precision) {
          const prec = glossaryTerm.precision;
          if (prec.type === 'range' && typeof cond.value === 'number') {
            if (prec.min !== undefined && cond.value < prec.min)
              fail1(`${condPath}: value ${cond.value} is outside glossary precision range [${prec.min}, ${prec.max}] for field '${cond.field}' (glossary: '${glossaryTerm.id}', conceptVersion: ${glossaryTerm.conceptVersion})`);
            if (prec.max !== undefined && cond.value > prec.max)
              fail1(`${condPath}: value ${cond.value} is outside glossary precision range [${prec.min}, ${prec.max}] for field '${cond.field}' (glossary: '${glossaryTerm.id}', conceptVersion: ${glossaryTerm.conceptVersion})`);
          }
          if (prec.type === 'enum' && prec.values) {
            const checkVals = Array.isArray(cond.value) ? cond.value : (typeof cond.value === 'string' ? [cond.value] : []);
            for (const v of checkVals) {
              if (typeof v === 'string' && !prec.values.includes(v))
                fail1(`${condPath}: value '${v}' is not in glossary precision values [${prec.values.join(', ')}] for glossary term '${glossaryTerm.id}' (conceptVersion: ${glossaryTerm.conceptVersion})`);
            }
          }
        }
      }
      // Level B: intent → glossaryRefs → glossary terms precision (warning only)
      if (typeof cond.value === 'number') {
        const fieldGlossaryId = field.glossaryRef || null;
        for (const gRefId of intentGlossaryRefs) {
          if (gRefId === fieldGlossaryId) continue; // already checked at Level A
          const glossaryTerm = glossaryIndex[gRefId];
          if (!glossaryTerm || !glossaryTerm.precision) continue;
          const prec = glossaryTerm.precision;
          if (prec.type === 'range' && prec.min !== undefined && prec.max !== undefined) {
            if (cond.value < prec.min || cond.value > prec.max)
              warn1(`${condPath}: value ${cond.value} may conflict with glossary term '${glossaryTerm.id}' precision [${prec.min}, ${prec.max}] (referenced by intent '${rule.intentRef}', conceptVersion: ${glossaryTerm.conceptVersion})`);
          }
        }
      }
    }
  }

  function validateAction(action, actionPath) {
    if (action === null || action === undefined) return;
    if (typeof action !== 'object') { fail1(`${actionPath}: action must be an object`); return; }
    if (action._slot) { fail1(`${actionPath}: slot was not filled`); return; }
    const validTypes = ['set', 'append', 'remove', 'emit-event', 'call-operation'];
    if (!validTypes.includes(action.type)) {
      fail1(`${actionPath}.type: '${action.type}' is not a valid action type. Valid: [${validTypes.join(', ')}]`);
      return;
    }
    if (['set', 'append', 'remove'].includes(action.type)) {
      if (!action.field) { fail1(`${actionPath}: missing 'field' for type '${action.type}'`); }
      else {
        const field = fieldMap[action.field];
        if (!field) {
          fail1(`${actionPath}: field '${action.field}' does not exist on entity '${ctx.entity.id}'`);
        } else {
          if (field.immutable)   fail1(`${actionPath}: field '${action.field}' is immutable — cannot be set`);
          if (field.systemField) fail1(`${actionPath}: field '${action.field}' is a system field — cannot be set`);
          // Glossary precision check on action values (TASK-03)
          if (field.glossaryRef && action.value !== undefined && typeof action.value === 'number') {
            const glossaryTerm = glossaryIndex[field.glossaryRef];
            if (glossaryTerm && glossaryTerm.precision && glossaryTerm.precision.type === 'range') {
              const prec = glossaryTerm.precision;
              if (prec.min !== undefined && action.value < prec.min)
                fail1(`${actionPath}: value ${action.value} is outside glossary precision range [${prec.min}, ${prec.max}] for field '${action.field}' (glossary: '${glossaryTerm.id}', conceptVersion: ${glossaryTerm.conceptVersion})`);
              if (prec.max !== undefined && action.value > prec.max)
                fail1(`${actionPath}: value ${action.value} is outside glossary precision range [${prec.min}, ${prec.max}] for field '${action.field}' (glossary: '${glossaryTerm.id}', conceptVersion: ${glossaryTerm.conceptVersion})`);
            }
          }
          if (field.type === 'enum' && entity.lifecycle?.statusField === action.field) {
            const targetValue = typeof action.value === 'string' ? action.value : null;
            if (targetValue) {
              // BUG-023 fix: per-source lifecycle validation
              const sourceStates = extractSourceStates(fillData.condition, action.field);
              let validNextStates;
              if (sourceStates.length > 0) {
                // Filter transitions to only those from the condition's source state(s)
                validNextStates = new Set(
                  entity.lifecycle.transitions
                    .filter(t => sourceStates.includes(t.from))
                    .map(t => t.to)
                );
              } else {
                // No source state in condition — fall back to global check
                validNextStates = new Set(entity.lifecycle.transitions.map(t => t.to));
              }
              if (!validNextStates.has(targetValue)) {
                const fromClause = sourceStates.length > 0 ? ` from '${sourceStates.join("', '")}'` : '';
                fail1(`${actionPath}: status value '${targetValue}' is not a valid lifecycle target state${fromClause}. ` +
                  `Valid targets: [${[...validNextStates].join(', ')}]`);
              }
            }
          }
          if (action.type === 'set' && field.type === 'enum' && field.enumValues &&
              typeof action.value === 'string') {
            if (!field.enumValues.includes(action.value)) {
              fail1(`${actionPath}: value '${action.value}' is not valid for enum field '${action.field}'. ` +
                `Valid values: [${field.enumValues.join(', ')}]`);
            }
          }
        }
      }
      if (action.value === undefined) { fail1(`${actionPath}: missing 'value' for type '${action.type}'`); }
    }
    if (action.type === 'emit-event') {
      if (!action.event) { fail1(`${actionPath}: missing 'event'`); }
      else if (!eventIndex[action.event]) {
        fail1(`${actionPath}: event '${action.event}' is not registered in the events registry`);
      }
    }
    if (action.type === 'call-operation') {
      if (!action.operation) { fail1(`${actionPath}: missing 'operation'`); }
      else if (!operationIndex[action.operation]) {
        fail1(`${actionPath}: operation '${action.operation}' does not exist in the canonical model`);
      }
    }
    if (action.then) {
      if (!Array.isArray(action.then))
        fail1(`${actionPath}.then: must be an array`);
      else
        action.then.forEach((a, i) => validateAction(a, `${actionPath}.then[${i}]`));
    }
  }

  validateCondition(fillData.condition, 'fill.condition');
  validateAction(fillData.action,       'fill.action');
  if (fillData.elseAction) validateAction(fillData.elseAction, 'fill.elseAction');

  console.log(`Result: ${results.pass1.passed ? 'PASS' : 'FAIL'}`);
  if (results.pass1.errors.length) {
    results.pass1.errors.forEach(e => console.log(`  ✗ ${e}`));
  }
  if (results.pass1.warnings.length) {
    results.pass1.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pass 2 — Semantic validation (requires filled template)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('');
  console.log(bar);
  console.log('Pass 2 — Semantic (scenario execution)');
  console.log(bar);

  // BUG-009 fix: resolve temporal values before comparison
  function resolveValue(val, fieldValues) {
    if (val === null || val === undefined) return val;
    // Legacy string workaround: $now as plain string
    if (typeof val === "string" && val === "$now") return new Date();
    if (typeof val === "object" && !Array.isArray(val)) {
      // New structured temporal: { $temporal: "now" | "today" }
      if (val.$temporal === "now") return new Date();
      if (val.$temporal === "today") {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }
      // Date arithmetic: { $dateAdd: { $field, offset, unit } }
      if (val.$dateAdd) {
        const base = fieldValues ? fieldValues[val.$dateAdd.$field] : undefined;
        if (base === undefined || base === null) return val; // cannot resolve
        let baseDate = base instanceof Date ? base : new Date(base);
        if (isNaN(baseDate.getTime())) return val; // invalid date
        const offset = val.$dateAdd.offset || 0;
        const unit = val.$dateAdd.unit;
        switch (unit) {
          case "minutes": baseDate = new Date(baseDate.getTime() + offset * 60000); break;
          case "hours":   baseDate = new Date(baseDate.getTime() + offset * 3600000); break;
          case "days":    baseDate = new Date(baseDate.getTime() + offset * 86400000); break;
          case "months":
            baseDate = new Date(baseDate);
            baseDate.setMonth(baseDate.getMonth() + offset);
            break;
        }
        return baseDate;
      }
      // Legacy AI fill format: { $now: true }
      if (val.$now === true) return new Date();
    }
    return val;
  }

  function evaluateCondition(cond, fieldValues) {
    if (!cond) return { result: true, explanation: 'null condition — always true' };
    if ('and' in cond) {
      const res = cond.and.map(c => evaluateCondition(c, fieldValues));
      return { result: res.every(r => r.result), explanation: `AND[${res.map(r => r.result).join(',')}]` };
    }
    if ('or' in cond) {
      const res = cond.or.map(c => evaluateCondition(c, fieldValues));
      return { result: res.some(r => r.result), explanation: `OR[${res.map(r => r.result).join(',')}]` };
    }
    if ('not' in cond) {
      const inner = evaluateCondition(cond.not, fieldValues);
      return { result: !inner.result, explanation: `NOT(${inner.result})` };
    }
    const fieldVal = fieldValues[cond.field];
    const op       = cond.operator;
    const condVal  = cond.value;

    // BUG-009 fix: resolve temporal values and coerce for comparison
    const resolvedCondVal = resolveValue(condVal, fieldValues);

    // Coerce types for temporal comparison
    let compFieldVal = fieldVal;
    let compCondVal = resolvedCondVal;
    if (compCondVal instanceof Date && typeof compFieldVal === "string") {
      const d = new Date(compFieldVal);
      if (!isNaN(d.getTime())) compFieldVal = d;
    }
    if (compFieldVal instanceof Date && typeof compCondVal === "string") {
      const d = new Date(compCondVal);
      if (!isNaN(d.getTime())) compCondVal = d;
    }

    let result;
    switch (op) {
      case "eq":          result = compFieldVal === compCondVal; break;
      case "neq":         result = compFieldVal !== compCondVal; break;
      case "gt":          result = compFieldVal >  compCondVal; break;
      case "gte":         result = compFieldVal >= compCondVal; break;
      case "lt":          result = compFieldVal <  compCondVal; break;
      case "lte":         result = compFieldVal <= compCondVal; break;
      case "in":          result = Array.isArray(compCondVal) && compCondVal.includes(compFieldVal); break;
      case "not-in":      result = Array.isArray(compCondVal) && !compCondVal.includes(compFieldVal); break;
      case "contains":    result = Array.isArray(compFieldVal) && compFieldVal.includes(compCondVal); break;
      case "starts-with": result = typeof compFieldVal === "string" && compFieldVal.startsWith(compCondVal); break;
      case "ends-with":   result = typeof compFieldVal === "string" && compFieldVal.endsWith(compCondVal); break;
      case "is-null":     result = compFieldVal === null || compFieldVal === undefined; break;
      case "is-not-null": result = compFieldVal !== null && compFieldVal !== undefined; break;
      default:            result = false;
    }
    return {
      result,
      explanation: `${cond.field}(${JSON.stringify(fieldVal)}) ${op} ${JSON.stringify(condVal)} → ${result}`
    };
  }

  // BUG-008 fix: read expectedResult directly instead of inferring from coverageType
  function expectedConditionResult(scenario) {
    return scenario.expectedResult;
  }

  // BUG-019 fix: apply rule action to field values and return output
  function applyAction(action, fieldValues) {
    const result = { ...fieldValues };
    if (!action || action.type !== 'set') return result;
    if (typeof action.value === 'object' && action.value !== null && '$field' in action.value) {
      const sourceVal = fieldValues[action.value.$field];
      const opVal = action.value.$value;
      if (sourceVal !== undefined && opVal !== undefined) {
        switch (action.value.$op) {
          case 'multiply': result[action.field] = sourceVal * opVal; break;
          case 'add':      result[action.field] = sourceVal + opVal; break;
          case 'subtract': result[action.field] = sourceVal - opVal; break;
          case 'divide':   result[action.field] = sourceVal / opVal; break;
        }
      }
    } else {
      result[action.field] = action.value;
    }
    return result;
  }

  const ruleScenarios = (rule?.scenarioRefs || [])
    .map(id => scenarioIndex[id])
    .filter(Boolean);

  for (const scenario of ruleScenarios) {
    const fieldValues = {};
    for (const fr of scenario.fieldRefs || []) {
      if (fr.entityId === ctx.entity.id) {
        fieldValues[fr.fieldId] = fr.value;
      }
    }
    const evalResult     = evaluateCondition(fillData.condition, fieldValues);
    const expected       = expectedConditionResult(scenario);
    const scenarioPassed = evalResult.result === expected;


    // BUG-019 fix: check outputFieldRefs when condition fires and action is set
    let outputErrors = [];
    if (evalResult.result && scenario.outputFieldRefs && scenario.outputFieldRefs.length > 0
        && fillData.action && fillData.action.type === 'set') {
      const outputValues = applyAction(fillData.action, fieldValues);
      for (const outRef of scenario.outputFieldRefs) {
        if (outRef.entityId === ctx.entity.id) {
          const actual = outputValues[outRef.fieldId];
          const expectedOut = outRef.value;
          if (actual !== expectedOut) {
            const msg = `Scenario '${scenario.id}': output field '${outRef.fieldId}' expected ${JSON.stringify(expectedOut)} but got ${JSON.stringify(actual)}`;
            outputErrors.push(msg);
            fail2(msg);
          }
        }
      }
    }
    results.pass2.scenarioResults.push({
      scenarioId:    scenario.id,
      coverageType:  scenario.coverageType,
      priority:      scenario.priority || 'must-pass',
      fieldValues,
      conditionResult: evalResult.result,
      expected,
      passed:          scenarioPassed,
      explanation:     evalResult.explanation,
      outputErrors,
    });

    if (!scenarioPassed && scenario.priority === 'must-pass') {
      fail2(
        `Scenario '${scenario.id}' (${scenario.coverageType}, must-pass) FAILED: ` +
        `condition returned ${evalResult.result} but expected ${expected}. ` +
        `Explanation: ${evalResult.explanation}`
      );
    }
  }

  for (const sr of results.pass2.scenarioResults) {
    const icon = sr.passed ? '✓' : '✗';
    const priority = sr.priority === 'must-pass' ? '[MUST]' : '[SHOULD]';
    console.log(`  ${icon} ${sr.scenarioId} ${priority} (${sr.coverageType})`);
    console.log(`      fields: ${JSON.stringify(sr.fieldValues)}`);
    console.log(`      condition → ${sr.conditionResult} (expected ${sr.expected}): ${sr.explanation}`);
    if (sr.outputErrors && sr.outputErrors.length > 0) {
      sr.outputErrors.forEach(e => console.log(`      \u2717 ${e}`));
    }
  }
  console.log(`Result: ${results.pass2.passed ? 'PASS' : 'FAIL'}`);
  if (results.pass2.errors.length) {
    results.pass2.errors.forEach(e => console.log(`  ✗ ${e}`));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pass 3 — Throw-checker (always runs)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(bar);
console.log('Pass 3 — Throw-checker');
console.log(bar);

// ── Build rule-to-operations mapping for errorResponse inheritance ─────────

const ruleToOperations = {};
for (const op of Object.values(operationIndex)) {
  for (const ruleRef of op.ruleRefs || []) {
    if (!ruleToOperations[ruleRef]) ruleToOperations[ruleRef] = [];
    ruleToOperations[ruleRef].push(op);
  }
}

// ── Scan directories ──────────────────────────────────────────────────────────

const rulesDir = rulesDirArg ? path.resolve(rulesDirArg) : path.join(process.cwd(), 'src', 'rules');
const opsDir   = path.join(process.cwd(), 'src', 'operations');

const rulesDirExists = fs.existsSync(rulesDir);
const opsDirExists   = fs.existsSync(opsDir);

const scanTargets = [];

if (rulesDirExists) {
  const files = fs.readdirSync(rulesDir, { recursive: true }).filter(f => f.endsWith('.ts'));
  scanTargets.push({ dir: rulesDir, files, type: 'rules' });
}
if (opsDirExists) {
  const files = fs.readdirSync(opsDir, { recursive: true }).filter(f => f.endsWith('.ts'));
  scanTargets.push({ dir: opsDir, files, type: 'operations' });
}

// Print scan summary
const scanParts = [];
if (rulesDirExists) {
  const count = scanTargets.find(t => t.type === 'rules').files.length;
  scanParts.push(`src/rules/ (${count} file${count !== 1 ? 's' : ''})`);
} else {
  scanParts.push('src/rules/ — not found, skipped');
}
if (opsDirExists) {
  const count = scanTargets.find(t => t.type === 'operations').files.length;
  scanParts.push(`src/operations/ (${count} file${count !== 1 ? 's' : ''})`);
} else {
  scanParts.push('src/operations/ — not found, skipped (will be scanned when directory exists)');
}
console.log(`Scanned: ${scanParts.join(', ')}`);

// ── Scan files for throw statements ───────────────────────────────────────────

const allThrows = [];

for (const { dir, files, type } of scanTargets) {
  for (const file of files) {
    const filePath = path.join(dir, file);
    const relPath  = path.relative(process.cwd(), filePath);
    const content  = fs.readFileSync(filePath, 'utf8');
    const lines    = content.split('\n');
    const canonicalId = path.basename(file).replace(/\.ts$/, '');

    for (let i = 0; i < lines.length; i++) {
      const line    = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Skip comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      // Must contain throw keyword
      if (!/\bthrow\b/.test(trimmed)) continue;

      // Check for template literal with interpolation → dynamic (cannot verify)
      if (/throw\s+new\s+\w+\(.*?`[^`]*\$\{/.test(trimmed)) {
        warn3(`dynamic throw in ${relPath} at line ${lineNum} — cannot statically verify error code`);
        allThrows.push({ type: 'dynamic', relPath, lineNum });
        continue;
      }

      // Try to extract error code string from throw expression
      let match = null;

      // throw new SomeError('CODE') or throw new SomeError(num, 'CODE')
      match = trimmed.match(/throw\s+new\s+\w+\(.*?'([^']+)'\s*\)/);
      if (!match) match = trimmed.match(/throw\s+new\s+\w+\(.*?"([^"]+)"\s*\)/);

      // throw new SomeError(`CODE`) — template literal without interpolation
      if (!match) {
        const tmplMatch = trimmed.match(/throw\s+new\s+\w+\(.*?`([^`]+)`\s*\)/);
        if (tmplMatch) match = tmplMatch;
      }

      // throw 'CODE' or throw "CODE"
      if (!match) match = trimmed.match(/throw\s+'([^']+)'/);
      if (!match) match = trimmed.match(/throw\s+"([^"]+)"/);

      if (match) {
        allThrows.push({
          type: 'static',
          errorCode: match[1],
          relPath,
          lineNum,
          canonicalId,
          sourceType: type,
        });
      }
      // If no match (e.g. throw someVariable, throw new SomeClass(a, b)) — skip silently
    }
  }
}

// ── Verify each static throw against canonical model errorResponses ───────────

const staticThrows = allThrows.filter(t => t.type === 'static');

for (const t of staticThrows) {
  // Collect all declared error codes for this file's canonical entity
  let declaredCodes = [];
  let ownerLabel    = '';
  let declaredInLabel = '';

  if (t.sourceType === 'rules') {
    const rule = ruleIndex[t.canonicalId];
    if (!rule) {
      warn3(`${t.relPath} has no matching rule in canonical model — throw on line ${t.lineNum} unverifiable`);
      continue;
    }

    // Check rule's own errorResponses
    if (rule.errorResponses && rule.errorResponses.length > 0) {
      declaredCodes.push(...rule.errorResponses.map(er => er.code));
      ownerLabel = `rule ${t.canonicalId}`;
    }

    // Inherit from parent operations via ruleRefs
    const parentOps = ruleToOperations[t.canonicalId] || [];
    for (const op of parentOps) {
      if (op.errorResponses) {
        declaredCodes.push(...op.errorResponses.map(er => er.code));
      }
    }

    // Build labels for output
    if (!ownerLabel) ownerLabel = `rule ${t.canonicalId}`;
    if (parentOps.length > 0) {
      ownerLabel += ` or its parent operation${parentOps.length > 1 ? 's' : ''} ${parentOps.map(o => o.id).join(', ')}`;
    }

    // Find which entity actually declares the code (for the ✓ line)
    for (const op of parentOps) {
      if (op.errorResponses && op.errorResponses.some(er => er.code === t.errorCode)) {
        declaredInLabel = `${op.id} errorResponses via inheritance`;
        break;
      }
    }
    if (!declaredInLabel && rule.errorResponses) {
      const ruleErr = rule.errorResponses.find(er => er.code === t.errorCode);
      if (ruleErr) declaredInLabel = `${t.canonicalId} errorResponses`;
    }

  } else {
    // operations
    const op = operationIndex[t.canonicalId];
    if (!op) {
      warn3(`${t.relPath} has no matching operation in canonical model — throw on line ${t.lineNum} unverifiable`);
      continue;
    }
    declaredCodes = (op.errorResponses || []).map(er => er.code);
    ownerLabel = `operation ${t.canonicalId}`;
    declaredInLabel = `${t.canonicalId} errorResponses`;
  }

  const isDeclared = declaredCodes.includes(t.errorCode);

  if (isDeclared) {
    results.pass3.checks.push({
      passed: true,
      relPath: t.relPath,
      lineNum: t.lineNum,
      errorCode: t.errorCode,
      declaredIn: declaredInLabel,
    });
  } else {
    // Build resolution message
    const parentOps = (t.sourceType === 'rules') ? (ruleToOperations[t.canonicalId] || []) : [];
    const targetEntity = parentOps.length > 0 ? parentOps[0].id : t.canonicalId;
    const resolution =
      `Add { statusCode: 4xx, code: ${t.errorCode} } to the\n` +
      `  canonical model errorResponses for ${targetEntity}, then re-run codegen.`;

    fail3(
      `FAIL [Pass 3 — Throw-checker]\n` +
      `  ${t.relPath}:${t.lineNum}\n` +
      `  Thrown error code: ${t.errorCode}\n` +
      `  Not declared in errorResponses for ${ownerLabel}\n` +
      `  Resolution: ${resolution}`
    );

    results.pass3.checks.push({
      passed: false,
      relPath: t.relPath,
      lineNum: t.lineNum,
      errorCode: t.errorCode,
      ownerLabel,
      resolution,
    });
  }
}

// ── Print Pass 3 results ──────────────────────────────────────────────────────

console.log(`Throws found: ${staticThrows.length}`);
for (const check of results.pass3.checks) {
  if (check.passed) {
    console.log(`  ${passIcon(true)} ${check.relPath}:${check.lineNum} — ${check.errorCode} (declared in ${check.declaredIn})`);
  } else {
    console.log(`  ${passIcon(false)} ${check.relPath}:${check.lineNum} — ${check.errorCode} (NOT declared)`);
  }
}
console.log(`Warnings: ${results.pass3.warnings.length}`);
for (const w of results.pass3.warnings) {
  console.log(`  ⚠ ${w}`);
}
console.log(`Result: ${results.pass3.passed ? 'PASS' : 'FAIL'}`);
if (!results.pass3.passed) {
  console.log('');
  for (const e of results.pass3.errors) {
    console.log(e);
  }
}



// ═══════════════════════════════════════════════════════════════════════════════
// Pass 4 — Operation Contract Validation (always runs)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(bar);
console.log('Pass 4 — Operation Contract Validation');
console.log(bar);

const opsWithContracts    = (model.operations || []).filter(op => op.operationContract);
const opsWithoutContracts = (model.operations || []).filter(op => !op.operationContract);

const withNames    = opsWithContracts.map(op => op.id).join(', ');

console.log(`Operations with contracts: ${opsWithContracts.length} (${withNames})`);
console.log(`Operations without contracts: ${opsWithoutContracts.length} (skipped)`);

for (const op of opsWithContracts) {
  const contract = op.operationContract;
  const steps    = contract.steps || [];
  console.log(`  ${op.id} (${steps.length} steps)`);

  for (const step of steps) {
    if (step.type === 'apply-rule') {
      if (!step.ruleRef) {
        fail4('FAIL [Pass 4 — Operation Contracts]\n  Operation: ' + op.id + ', Step: ' + step.id + '\n  Missing ruleRef for apply-rule step.\n  Resolution: Add a ruleRef to the step.');
        console.log(`    ✗ ${step.id} — ruleRef: missing`);
      } else if (!ruleIndex[step.ruleRef]) {
        fail4('FAIL [Pass 4 — Operation Contracts]\n  Operation: ' + op.id + ', Step: ' + step.id + '\n  ruleRef \'' + step.ruleRef + '\' not found in canonical model rules.\n  Resolution: Add the rule to the canonical model or correct the ruleRef.');
        console.log(`    ✗ ${step.id} — ruleRef: ${step.ruleRef} (NOT FOUND)`);
      } else {
        console.log(`    ✓ ${step.id} — ruleRef: ${step.ruleRef} (resolved)`);
      }
    }

    if (step.type === 'emit-event') {
      if (!step.eventRef) {
        fail4('FAIL [Pass 4 — Operation Contracts]\n  Operation: ' + op.id + ', Step: ' + step.id + '\n  Missing eventRef for emit-event step.');
        console.log(`    ✗ ${step.id} — eventRef: missing`);
      } else if (!eventIndex[step.eventRef]) {
        fail4('FAIL [Pass 4 — Operation Contracts]\n  Operation: ' + op.id + ', Step: ' + step.id + '\n  eventRef \'' + step.eventRef + '\' not found in canonical model events.\n  Resolution: Add the event to the events registry or correct the eventRef.');
        console.log(`    ✗ ${step.id} — eventRef: ${step.eventRef} (NOT FOUND)`);
      } else {
        console.log(`    ✓ ${step.id} — eventRef: ${step.eventRef} (resolved)`);
      }
    }

    if (step.type === 'db-write') {
      console.log(`    ✓ ${step.id} — db-write`);
    }

    if (step.type === 'call-operation') {
      if (step.target && !operationIndex[step.target]) {
        warn4('WARN [Pass 4 — Operation Contracts]\n  Operation: ' + op.id + ', Step: ' + step.id + '\n  target \'' + step.target + '\' not found in this canonical model.\n  This may be a cross-object reference — verify manually.');
        console.log(`    ⚠ ${step.id} — call-operation: ${step.target} (not found — may be cross-object)`);
      } else if (step.target) {
        console.log(`    ✓ ${step.id} — call-operation: ${step.target} (resolved)`);
      } else {
        console.log(`    ✓ ${step.id} — call-operation`);
      }
    }

    if (step.onFailure) {
      if (step.onFailure.throw) {
        const errorCode    = step.onFailure.throw;
        const declaredCodes = (op.errorResponses || []).map(er => er.code);
        if (declaredCodes.includes(errorCode)) {
          console.log(`      onFailure: ${errorCode} (declared in ${op.id} errorResponses ✓)`);
        } else {
          fail4('FAIL [Pass 4 — Operation Contracts]\n  Operation: ' + op.id + ', Step: ' + step.id + '\n  onFailure throws \'' + errorCode + '\' but this code is not declared in\n  ' + op.id + ' errorResponses.\n  Resolution: Add { statusCode: 4xx, code: ' + errorCode + ' } to\n  ' + op.id + ' errorResponses in the canonical model.');
          console.log(`      onFailure: ${errorCode} (NOT declared in ${op.id} errorResponses ✗)`);
        }
      }
      if (step.onFailure.log) {
        const continueStr = step.onFailure.continue ? ' + continue' : '';
        console.log(`      onFailure: log ${step.onFailure.log}${continueStr} (no throw to verify)`);
      }
    }

    if (step.compensatedBy) {
      if (step.compensatedBy.type === 'call-operation' && step.compensatedBy.target) {
        if (!operationIndex[step.compensatedBy.target]) {
          warn4('WARN [Pass 4 — Operation Contracts]\n  Operation: ' + op.id + ', Step: ' + step.id + '\n  compensatedBy.target \'' + step.compensatedBy.target + '\' not found in this canonical model.\n  This may be a cross-object reference — verify manually.');
        }
      }
    }
  }
}

console.log(`Warnings: ${results.pass4.warnings.length}`);
for (const w of results.pass4.warnings) {
  console.log(`  ⚠ ${w}`);
}
console.log(`Result: ${results.pass4.passed ? 'PASS' : 'FAIL'}`);
if (!results.pass4.passed) {
  console.log('');
  for (const e of results.pass4.errors) {
    console.log(e);
  }
}

// ── Determine overall result ──────────────────────────────────────────────────

const passesRun = ['pass3', 'pass4'];
if (runTemplateGate) passesRun.unshift('pass1', 'pass2');

const allPassed = passesRun.every(p => results[p].passed);
results.overall = allPassed ? 'PASS' : 'FAIL';

// ── Print overall summary ─────────────────────────────────────────────────────

console.log('');
console.log(bar);
console.log(`GATE RESULT: ${results.overall === 'PASS' ? '✓ PASS' : '✗ FAIL'}`);
if (runTemplateGate) {
  console.log(`  Pass 1 — Structural:  ${passIcon(results.pass1.passed)}`);
  console.log(`  Pass 2 — Semantic:    ${passIcon(results.pass2.passed)}`);
}
console.log(`  Pass 3 — Throw-checker: ${passIcon(results.pass3.passed)}`);
console.log(`  Pass 4 — Operation Contracts: ${passIcon(results.pass4.passed)}`);
console.log(bar);

// ── Write gate result to filled template (if provided) ────────────────────────

if (runTemplateGate) {
  const updatedFilled = yaml.load(fs.readFileSync(filledPath, 'utf8'));
  updatedFilled._meta.gateResult = results.overall;
  updatedFilled._meta.gateRunAt  = new Date().toISOString();
  updatedFilled._meta.gatePass1  = results.pass1.passed;
  updatedFilled._meta.gatePass2  = results.pass2.passed;
  updatedFilled._meta.gatePass3  = results.pass3.passed;
  updatedFilled._meta.gatePass4  = results.pass4.passed;
  updatedFilled._meta.status     = results.overall === 'PASS'
    ? 'gate-passed-ready-for-codegen'
    : 'gate-failed-needs-refill';

  fs.writeFileSync(filledPath, yaml.dump(updatedFilled, {
    indent: 2, lineWidth: 120, noRefs: true, quotingType: '"'
  }));

  // BUG-011 fix: update _fill-manifest.json with gate result
  const manifestPath = path.join(path.dirname(filledPath), '_fill-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const ruleId = updatedFilled._meta?.ruleId;
      if (manifest.templates && ruleId) {
        const entry = manifest.templates.find(t => t.ruleId === ruleId);
        if (entry) {
          entry.gateResult = results.overall === 'PASS' ? 'pass' : 'fail';
          entry.gateAt = new Date().toISOString();
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
          console.log('Manifest updated with gate result for rule: ' + ruleId);
        }
      }
    } catch (e) {
      console.warn('Warning: could not update manifest:', e.message);
    }
  }
}

if (results.overall === 'PASS') {
  console.log('Gate passed. All checks verified against canonical model.');
} else {
  console.log('Gate FAILED. Resolve errors before proceeding.');
}
console.log('');

process.exit(results.overall === 'PASS' ? 0 : 1);
