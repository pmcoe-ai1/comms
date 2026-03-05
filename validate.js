// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE.JS — Canonical model schema validator
// Validates a canonical model YAML file against canonical-model.schema.json
// using AJV (draft 2020-12).
//
// Usage:
//   node validate.js                                     # default file
//   node validate.js path/to/other.canonical-model.yaml  # specific file
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;

// ── Resolve paths ───────────────────────────────────────────────────────────

const schemaPath = path.resolve(__dirname, 'files', 'canonical-model.schema.json');
const modelArg = process.argv[2] || 'files/example.canonical-model.yaml';
const modelPath = path.resolve(__dirname, modelArg);

// ── Load schema ─────────────────────────────────────────────────────────────

let schema;
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
} catch (err) {
  console.error(`Failed to load schema: ${schemaPath}`);
  console.error(err.message);
  process.exit(2);
}

// ── Load canonical model ────────────────────────────────────────────────────

let model;
try {
  const raw = fs.readFileSync(modelPath, 'utf8');
  model = yaml.load(raw);
} catch (err) {
  console.error(`Failed to load canonical model: ${modelPath}`);
  console.error(err.message);
  process.exit(2);
}

// ── Validate ────────────────────────────────────────────────────────────────

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(model);

// ── Extract schema version from $id ─────────────────────────────────────────

const schemaVersion = schema.$id
  ? schema.$id.match(/v([0-9]+\.[0-9]+\.[0-9]+)/)?.[0] || 'unknown'
  : 'unknown';

// ── Output ──────────────────────────────────────────────────────────────────

const displayModelPath = path.relative(process.cwd(), modelPath) || modelPath;
const displaySchemaPath = path.relative(process.cwd(), schemaPath) || schemaPath;

console.log('');
console.log('\u2550\u2550 CANONICAL MODEL VALIDATION \u2550\u2550');
console.log(`File: ${displayModelPath}`);
console.log(`Schema: ${displaySchemaPath}`);



// ── BUG-015 fix: Cross-reference validation ────────────────────────────────
// Validates that rule actions referencing operations and events point to
// declared entries in the canonical model. AJV schema validation only checks
// structure, not cross-references between sections.

function runCrossRefValidation(model) {
  const operationIds = new Set((model.operations || []).map(op => op.id));
  const eventIds = new Set((model.events || []).map(ev => ev.id));
  const crossRefErrors = [];

  function checkActionRefs(action, ruleId) {
    if (!action || typeof action !== 'object') return;
    if (action.type === 'call-operation' && action.operation) {
      if (!operationIds.has(action.operation)) {
        crossRefErrors.push(
          `Rule '${ruleId}': action references operation '${action.operation}' which does not exist in the model`
        );
      }
    }
    if (action.type === 'emit-event' && action.event) {
      if (!eventIds.has(action.event)) {
        crossRefErrors.push(
          `Rule '${ruleId}': action references event '${action.event}' which does not exist in the model`
        );
      }
    }
    if (Array.isArray(action.then)) {
      for (const chained of action.then) {
        checkActionRefs(chained, ruleId);
      }
    }
  }

  for (const rule of model.rules || []) {
    checkActionRefs(rule.action, rule.id);
    if (rule.elseAction) checkActionRefs(rule.elseAction, rule.id);
  }

  return crossRefErrors;
}

if (valid) {
  // BUG-015 fix: run cross-reference validation after schema passes
  const crossRefErrors = runCrossRefValidation(model);
  if (crossRefErrors.length > 0) {
    console.log(`Result: \u2717 FAIL \u2014 ${crossRefErrors.length} cross-reference error(s)`);
    crossRefErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
    console.log('');
    console.log('Resolution: Fix the cross-reference errors above, then re-run.');
    console.log('');
    process.exit(1);
  }
  console.log(`Result: \u2713 PASS`);
  console.log(`Model is valid against schema ${schemaVersion}`);
  console.log('');
  process.exit(0);
} else {
  const errors = validate.errors || [];
  console.log(`Result: \u2717 FAIL \u2014 ${errors.length} error(s)`);

  errors.forEach((err, i) => {
    const instancePath = err.instancePath || '/';
    let message = err.message || 'unknown error';

    // Enhance additionalProperties error with the offending property name
    if (err.keyword === 'additionalProperties' && err.params?.additionalProperty) {
      message += ` \u2014 '${err.params.additionalProperty}' is not allowed`;
    }

    console.log(`  ${i + 1}. ${instancePath}`);
    console.log(`     ${message}`);
  });

  console.log('');
  console.log('Resolution: Fix the errors above in the canonical model, then re-run.');
  console.log('');
  process.exit(1);
}
