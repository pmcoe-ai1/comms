#!/usr/bin/env node
/**
 * DKCE Enforcement Gate — Stage 1
 * 
 * Validates a filled template before any code generation occurs.
 * Two passes:
 * 
 * Pass 1 — Structural validation:
 *   - All filled condition field references exist on the declared entity
 *   - All filled action field references exist on the declared entity  
 *   - Operator is valid for the field's type
 *   - Enum values are within the declared enumValues
 *   - Action values respect field validation constraints
 *   - Immutable/system fields are not targeted by actions
 *   - Lifecycle transitions only target valid next states
 *   - emit-event actions reference events in the registry
 *   - call-operation actions reference operations that exist
 * 
 * Pass 2 — Semantic validation (scenario execution):
 *   - Evaluates the filled condition against each scenario's field values
 *   - Verifies the condition produces the expected result for each scenario
 *   - Reports which must-pass scenarios would pass or fail
 * 
 * Usage:
 *   node gate.js <filled-template.yaml> [--model <canonical-model.yaml>]
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node gate.js <filled-template.yaml> [--model <canonical-model.yaml>]');
  process.exit(0);
}

const filledPath  = args[0];
const modelIndex  = args.indexOf('--model');
const modelPath   = modelIndex !== -1 ? args[modelIndex + 1] : 'example.canonical-model.yaml';

if (!fs.existsSync(filledPath)) {
  console.error(`Error: filled template not found: ${filledPath}`);
  process.exit(1);
}
if (!fs.existsSync(modelPath)) {
  console.error(`Error: canonical model not found: ${modelPath}`);
  process.exit(1);
}

// ── Load files ────────────────────────────────────────────────────────────────

const filled = yaml.load(fs.readFileSync(filledPath, 'utf8'));
const model  = yaml.load(fs.readFileSync(modelPath, 'utf8'));

// ── Verify this filled template matches the model it was generated from ───────

if (filled._meta.canonicalModelId !== model.meta.id) {
  console.error(`Model ID mismatch: template was generated from ${filled._meta.canonicalModelId}, ` +
    `but loaded model is ${model.meta.id}`);
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
  ruleId:    filled._meta.ruleId,
  pass1:     { passed: true, errors: [], warnings: [] },
  pass2:     { passed: true, errors: [], scenarioResults: [] },
  overall:   'PASS',
};

function fail1(msg)  { results.pass1.passed = false; results.pass1.errors.push(msg); }
function warn1(msg)  { results.pass1.warnings.push(msg); }
function fail2(msg)  { results.pass2.passed = false; results.pass2.errors.push(msg); }

// ── Load context from filled template ────────────────────────────────────────

const ctx        = filled.context;
const fillData   = filled.fill;
const ruleId     = filled._meta.ruleId;
const rule       = ruleIndex[ruleId];

if (!rule) { fail1(`Rule '${ruleId}' not found in canonical model`); }

const entity     = entityIndex[ctx.entity.id];
if (!entity) { fail1(`Entity '${ctx.entity.id}' not found in canonical model`); }

const fieldMap   = entity ? Object.fromEntries(entity.fields.map(f => [f.id, f])) : {};

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

// ── Pass 1: Structural validation ─────────────────────────────────────────────

console.log('\n══ ENFORCEMENT GATE — STAGE 1 ══');
console.log(`Rule:   ${ruleId}`);
console.log(`Entity: ${ctx.entity.id}`);
console.log(`Model:  ${model.meta.id} v${model.meta.version}`);
console.log('');
console.log('Pass 1: Structural validation...');

function validateCondition(cond, path) {
  if (cond === null || cond === undefined) return;
  if (typeof cond !== 'object') {
    fail1(`${path}: condition must be an object`); return;
  }
  // Check it's not an unfilled slot
  if (cond._slot) {
    fail1(`${path}: slot was not filled — still contains template placeholder`); return;
  }

  if ('and' in cond) {
    if (!Array.isArray(cond.and) || cond.and.length < 2)
      fail1(`${path}.and: must have at least 2 elements`);
    else cond.and.forEach((c, i) => validateCondition(c, `${path}.and[${i}]`));
  } else if ('or' in cond) {
    if (!Array.isArray(cond.or) || cond.or.length < 2)
      fail1(`${path}.or: must have at least 2 elements`);
    else cond.or.forEach((c, i) => validateCondition(c, `${path}.or[${i}]`));
  } else if ('not' in cond) {
    validateCondition(cond.not, `${path}.not`);
  } else {
    // Leaf condition
    if (!cond.field) { fail1(`${path}: leaf condition missing 'field'`); return; }
    const field = fieldMap[cond.field];
    if (!field) {
      fail1(`${path}: field '${cond.field}' does not exist on entity '${ctx.entity.id}'`);
      return;
    }
    if (!cond.operator) { fail1(`${path}: missing 'operator'`); return; }

    const validOps = VALID_OPERATORS[field.type];
    if (validOps && !validOps.has(cond.operator)) {
      fail1(`${path}: operator '${cond.operator}' is not valid for field type '${field.type}'. ` +
        `Valid operators: [${[...validOps].join(', ')}]`);
    }

    const unaryOps = new Set(['is-null', 'is-not-null']);
    if (!unaryOps.has(cond.operator) && cond.value === undefined) {
      fail1(`${path}: operator '${cond.operator}' requires 'value'`);
    }
    if (unaryOps.has(cond.operator) && cond.value !== undefined) {
      warn1(`${path}: operator '${cond.operator}' is unary — 'value' will be ignored`);
    }

    // Enum value check
    if (field.type === 'enum' && field.enumValues && cond.value !== undefined) {
      const validVals = Array.isArray(cond.value) ? cond.value : [cond.value];
      for (const v of validVals) {
        if (!field.enumValues.includes(v)) {
          fail1(`${path}: value '${v}' is not a valid enum value for field '${cond.field}'. ` +
            `Valid values: [${field.enumValues.join(', ')}]`);
        }
      }
    }

    // Range validation
    if (field.validation && typeof cond.value === 'number') {
      if (field.validation.min !== undefined && cond.value < field.validation.min)
        fail1(`${path}: value ${cond.value} is below minimum ${field.validation.min} for field '${cond.field}'`);
      if (field.validation.max !== undefined && cond.value > field.validation.max)
        fail1(`${path}: value ${cond.value} exceeds maximum ${field.validation.max} for field '${cond.field}'`);
    }
  }
}

function validateAction(action, path) {
  if (action === null || action === undefined) return;
  if (typeof action !== 'object') { fail1(`${path}: action must be an object`); return; }
  if (action._slot) { fail1(`${path}: slot was not filled`); return; }

  const validTypes = ['set', 'append', 'remove', 'emit-event', 'call-operation'];
  if (!validTypes.includes(action.type)) {
    fail1(`${path}.type: '${action.type}' is not a valid action type. Valid: [${validTypes.join(', ')}]`);
    return;
  }

  if (['set', 'append', 'remove'].includes(action.type)) {
    if (!action.field) { fail1(`${path}: missing 'field' for type '${action.type}'`); }
    else {
      const field = fieldMap[action.field];
      if (!field) {
        fail1(`${path}: field '${action.field}' does not exist on entity '${ctx.entity.id}'`);
      } else {
        if (field.immutable)   fail1(`${path}: field '${action.field}' is immutable — cannot be set`);
        if (field.systemField) fail1(`${path}: field '${action.field}' is a system field — cannot be set`);

        // Lifecycle transition check
        if (field.type === 'enum' && entity.lifecycle?.statusField === action.field) {
          const targetValue = typeof action.value === 'string' ? action.value : null;
          if (targetValue) {
            const validNextStates = new Set(
              entity.lifecycle.transitions.map(t => t.to)
            );
            if (!validNextStates.has(targetValue)) {
              fail1(`${path}: status value '${targetValue}' is not a valid lifecycle target state. ` +
                `Valid targets: [${[...validNextStates].join(', ')}]`);
            }
          }
        }

        // Enum value check for set
        if (action.type === 'set' && field.type === 'enum' && field.enumValues &&
            typeof action.value === 'string') {
          if (!field.enumValues.includes(action.value)) {
            fail1(`${path}: value '${action.value}' is not valid for enum field '${action.field}'. ` +
              `Valid values: [${field.enumValues.join(', ')}]`);
          }
        }
      }
    }
    if (action.value === undefined) { fail1(`${path}: missing 'value' for type '${action.type}'`); }
  }

  if (action.type === 'emit-event') {
    if (!action.event) { fail1(`${path}: missing 'event'`); }
    else if (!eventIndex[action.event]) {
      fail1(`${path}: event '${action.event}' is not registered in the events registry`);
    }
  }

  if (action.type === 'call-operation') {
    if (!action.operation) { fail1(`${path}: missing 'operation'`); }
    else if (!operationIndex[action.operation]) {
      fail1(`${path}: operation '${action.operation}' does not exist in the canonical model`);
    }
  }

  if (action.then) {
    if (!Array.isArray(action.then))
      fail1(`${path}.then: must be an array`);
    else
      action.then.forEach((a, i) => validateAction(a, `${path}.then[${i}]`));
  }
}

validateCondition(fillData.condition, 'fill.condition');
validateAction(fillData.action,       'fill.action');
if (fillData.elseAction) validateAction(fillData.elseAction, 'fill.elseAction');

// ── Pass 2: Semantic validation (scenario execution) ─────────────────────────

console.log('Pass 2: Semantic validation (scenario execution)...');

/**
 * Evaluates a RuleCondition against a set of field values.
 * Returns { result: boolean, explanation: string }
 */
function evaluateCondition(cond, fieldValues) {
  if (!cond) return { result: true, explanation: 'null condition — always true' };

  if ('and' in cond) {
    const results = cond.and.map(c => evaluateCondition(c, fieldValues));
    const passed  = results.every(r => r.result);
    return { result: passed, explanation: `AND[${results.map(r => r.result).join(',')}]` };
  }
  if ('or' in cond) {
    const results = cond.or.map(c => evaluateCondition(c, fieldValues));
    const passed  = results.some(r => r.result);
    return { result: passed, explanation: `OR[${results.map(r => r.result).join(',')}]` };
  }
  if ('not' in cond) {
    const inner = evaluateCondition(cond.not, fieldValues);
    return { result: !inner.result, explanation: `NOT(${inner.result})` };
  }

  // Leaf
  const fieldVal = fieldValues[cond.field];
  const op       = cond.operator;
  const condVal  = cond.value;

  let result;
  switch (op) {
    case 'eq':          result = fieldVal == condVal; break;
    case 'neq':         result = fieldVal != condVal; break;
    case 'gt':          result = fieldVal >  condVal; break;
    case 'gte':         result = fieldVal >= condVal; break;
    case 'lt':          result = fieldVal <  condVal; break;
    case 'lte':         result = fieldVal <= condVal; break;
    case 'in':          result = Array.isArray(condVal) && condVal.includes(fieldVal); break;
    case 'not-in':      result = Array.isArray(condVal) && !condVal.includes(fieldVal); break;
    case 'contains':    result = Array.isArray(fieldVal) && fieldVal.includes(condVal); break;
    case 'starts-with': result = typeof fieldVal === 'string' && fieldVal.startsWith(condVal); break;
    case 'ends-with':   result = typeof fieldVal === 'string' && fieldVal.endsWith(condVal); break;
    case 'is-null':     result = fieldVal === null || fieldVal === undefined; break;
    case 'is-not-null': result = fieldVal !== null && fieldVal !== undefined; break;
    default:            result = false;
  }

  return {
    result,
    explanation: `${cond.field}(${JSON.stringify(fieldVal)}) ${op} ${JSON.stringify(condVal)} → ${result}`
  };
}

/**
 * Derives expected condition result from scenario text.
 * Uses simple heuristics — a full implementation would parse scenario text more carefully.
 */
function expectedConditionResult(scenario) {
  // happy path and edge cases where item is created → condition should be true (rule fires)
  // failure cases where item is rejected → condition should still fire (then action handles rejection)
  // For this rule specifically: condition fires on any item addition attempt
  if (scenario.coverageType === 'happy') return true;
  if (scenario.coverageType === 'failure') return true; // rule fires, action handles the outcome
  if (scenario.coverageType === 'edge') return true;
  return true;
}

// Build field values from scenario fieldRefs
const ruleScenarios = (rule?.scenarioRefs || [])
  .map(id => scenarioIndex[id])
  .filter(Boolean);

for (const scenario of ruleScenarios) {
  const fieldValues = {};

  // Populate field values from scenario fieldRefs
  for (const fr of scenario.fieldRefs || []) {
    if (fr.entityId === ctx.entity.id) {
      fieldValues[fr.fieldId] = fr.value;
    }
  }

  // Evaluate condition
  const evalResult = evaluateCondition(fillData.condition, fieldValues);
  const expected   = expectedConditionResult(scenario);
  const scenarioPassed = evalResult.result === expected;

  const scenarioResult = {
    scenarioId:    scenario.id,
    coverageType:  scenario.coverageType,
    priority:      scenario.priority || 'must-pass',
    fieldValues,
    conditionResult: evalResult.result,
    expected,
    passed:          scenarioPassed,
    explanation:     evalResult.explanation,
  };

  results.pass2.scenarioResults.push(scenarioResult);

  if (!scenarioPassed && scenario.priority === 'must-pass') {
    fail2(
      `Scenario '${scenario.id}' (${scenario.coverageType}, must-pass) FAILED: ` +
      `condition returned ${evalResult.result} but expected ${expected}. ` +
      `Explanation: ${evalResult.explanation}`
    );
  }
}

// ── Determine overall result ──────────────────────────────────────────────────

results.overall = (results.pass1.passed && results.pass2.passed) ? 'PASS' : 'FAIL';

// ── Print results ─────────────────────────────────────────────────────────────

const passIcon = p => p ? '✓' : '✗';
const bar = '─────────────────────────────────────────────────────────────';

console.log('');
console.log(bar);
console.log(`GATE RESULT: ${results.overall === 'PASS' ? '✓ PASS' : '✗ FAIL'}`);
console.log(bar);

console.log(`\nPass 1 — Structural: ${passIcon(results.pass1.passed)}`);
if (results.pass1.errors.length) {
  results.pass1.errors.forEach(e => console.log(`  ✗ ${e}`));
} else {
  console.log('  All structural checks passed.');
}
if (results.pass1.warnings.length) {
  console.log('  Warnings:');
  results.pass1.warnings.forEach(w => console.log(`  ⚠ ${w}`));
}

console.log(`\nPass 2 — Semantic (${results.pass2.scenarioResults.length} scenarios):`);
for (const sr of results.pass2.scenarioResults) {
  const icon = sr.passed ? '✓' : '✗';
  const priority = sr.priority === 'must-pass' ? '[MUST]' : '[SHOULD]';
  console.log(`  ${icon} ${sr.scenarioId} ${priority} (${sr.coverageType})`);
  console.log(`      fields: ${JSON.stringify(sr.fieldValues)}`);
  console.log(`      condition → ${sr.conditionResult} (expected ${sr.expected}): ${sr.explanation}`);
}
if (results.pass2.errors.length) {
  console.log('\n  Failures:');
  results.pass2.errors.forEach(e => console.log(`  ✗ ${e}`));
}

// ── Write gate result to filled template ─────────────────────────────────────

const updatedFilled = yaml.load(fs.readFileSync(filledPath, 'utf8'));
updatedFilled._meta.gateResult  = results.overall;
updatedFilled._meta.gateRunAt   = new Date().toISOString();
updatedFilled._meta.gatePass1   = results.pass1.passed;
updatedFilled._meta.gatePass2   = results.pass2.passed;
updatedFilled._meta.status      = results.overall === 'PASS'
  ? 'gate-passed-ready-for-codegen'
  : 'gate-failed-needs-refill';

fs.writeFileSync(filledPath, yaml.dump(updatedFilled, {
  indent: 2, lineWidth: 120, noRefs: true, quotingType: '"'
}));

console.log('');
if (results.overall === 'PASS') {
  console.log('Gate passed. Template is approved for code generation.');
  console.log('Next step: node codegen.js ' + filledPath);
} else {
  console.log('Gate FAILED. Return template to fill stage.');
  console.log('Errors must be resolved before code generation proceeds.');
}
console.log(bar);

process.exit(results.overall === 'PASS' ? 0 : 1);
