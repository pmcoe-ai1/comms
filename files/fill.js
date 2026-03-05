#!/usr/bin/env node
/**
 * DKCE AI Fill Stage
 * 
 * Takes a fill template produced by template-generator.js, calls the Claude API
 * to populate every [REQUIRED] slot, validates the output structure, and writes
 * the filled template back to disk ready for Enforcement Gate Stage 1.
 * 
 * Usage:
 *   node fill.js <template.yaml> [--output <filled-template.yaml>]
 *   node fill.js templates/check-stock-on-add-item.fill-template.yaml
 * 
 * Requires: ANTHROPIC_API_KEY in environment (or passed via Claude.ai infrastructure)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node fill.js <template.yaml> [--output <path>]');
  process.exit(0);
}

const templatePath = args[0];
const outputIndex  = args.indexOf('--output');
const outputPath   = outputIndex !== -1
  ? args[outputIndex + 1]
  : templatePath.replace('.fill-template.yaml', '.filled.yaml');

if (!fs.existsSync(templatePath)) {
  console.error(`Error: template file not found: ${templatePath}`);
  process.exit(1);
}

// ── Load template ─────────────────────────────────────────────────────────────

const template = yaml.load(fs.readFileSync(templatePath, 'utf8'));
const ruleId   = template._meta.ruleId;

// Validate that there are actually slots to fill
const needsConditionFill = template.fill.condition?._slot === 'REQUIRED';
const needsActionFill    = template.fill.action?._slot === 'REQUIRED';

if (!needsConditionFill && !needsActionFill) {
  console.log(`Rule '${ruleId}' has no REQUIRED slots. Nothing to fill.`);
  process.exit(0);
}

const slotsNeeded = [];
if (needsConditionFill) slotsNeeded.push('condition');
if (needsActionFill)    slotsNeeded.push('action');

console.log(`Filling rule: ${ruleId}`);
console.log(`Slots needed: ${slotsNeeded.join(', ')}`);

// ── Build the prompt ──────────────────────────────────────────────────────────
// The prompt contains:
// 1. Role and task framing
// 2. The full context section (read-only)
// 3. The fill instructions and slot specs
// 4. Strict output format requirement (JSON only, no prose)

function buildPrompt(template) {
  const ctx  = template.context;
  const fill = template.fill;

  const entityFieldsSummary = ctx.entity.fields
    .filter(f => !f.systemField && !f.immutable)
    .map(f => {
      let line = `  - ${f.id} (${f.type})`;
      if (f.enumValues)  line += ` — valid values: [${f.enumValues.join(', ')}]`;
      if (f.validation)  line += ` — validation: ${JSON.stringify(f.validation)}`;
      if (f.glossaryRef) line += ` — defined as: ${ctx.glossary.find(g => g.id === f.glossaryRef)?.definition?.slice(0,80) || f.glossaryRef}`;
      return line;
    }).join('\n');

  const glossarySummary = ctx.glossary.map(g => {
    let line = `  ${g.term}: ${g.definition.trim().slice(0, 120)}`;
    if (g.precision?.type === 'range') line += ` [${g.precision.min}–${g.precision.max} ${g.precision.unit || ''}]`;
    if (g.precision?.type === 'enum')  line += ` [${g.precision.values.join(', ')}]`;
    return line;
  }).join('\n');

  const scenarioSummary = ctx.scenarios.items.map((s, i) =>
    `  Scenario ${i+1} (${s.coverageType}, ${s.priority}):\n` +
    `    Given: ${s.given}\n` +
    `    When:  ${s.when}\n` +
    `    Then:  ${s.then}` +
    (s.fieldValues?.length
      ? `\n    Field values in scope: ${s.fieldValues.map(fv => `${fv.field}=${JSON.stringify(fv.value)}`).join(', ')}`
      : '')
  ).join('\n\n');

  const lifecycleSummary = ctx.entity.lifecycle
    ? `  Status field: ${ctx.entity.lifecycle.statusField}\n` +
      `  Initial state: ${ctx.entity.lifecycle.initialState}\n` +
      `  Valid transitions:\n` +
      ctx.entity.lifecycle.transitions.map(t =>
        `    ${t.from} → ${t.to}${t.guard ? ` (guard: ${t.guard})` : ''}`
      ).join('\n')
    : '  No lifecycle defined.';

  const conditionSpec = needsConditionFill
    ? `\nCONDITION SLOT:\nFill the "condition" property with a RuleCondition object.\n` +
      `Available fields to reference (entity: ${ctx.entity.id}):\n${entityFieldsSummary}\n\n` +
      `Compound forms allowed:\n` +
      `  { and: [RuleCondition, RuleCondition, ...] }  — all must be true\n` +
      `  { or: [RuleCondition, RuleCondition, ...] }   — at least one must be true\n` +
      `  { not: RuleCondition }                         — negation\n` +
      `Leaf form: { field: "<fieldId>", operator: "<op>", value: <literal> }\n` +
      `Omit "value" for is-null / is-not-null operators.\n` +
      `\nKNOWN LIMITATION: you can only reference fields on entity ${ctx.entity.id}.\n` +
      `Cross-entity checks (e.g. checking product.stockLevel) belong at the operation layer.\n` +
      `Fill the condition based only on fields this entity has at the point the rule runs.`
    : '';

  const actionSpec = needsActionFill
    ? `\nACTION SLOT:\nFill the "action" property with a RuleAction object.\n` +
      `Writable fields:\n${
        fill.action._writableFields.map(f =>
          `  - ${f.id} (${f.type})` +
          (f.enumValues ? ` — valid values: [${f.enumValues.join(', ')}]` : '') +
          (f.valueConstraints?.validationConstraints ? ` — ${JSON.stringify(f.valueConstraints.validationConstraints)}` : '')
        ).join('\n')
      }\n` +
      `Action types:\n` +
      `  set:            { type: "set", field: "<id>", value: <literal|{$field}|{$field,$op,$value}> }\n` +
      `  append:         { type: "append", field: "<array-field-id>", value: <element> }\n` +
      `  remove:         { type: "remove", field: "<array-field-id>", value: <element> }\n` +
      `  emit-event:     { type: "emit-event", event: "<event-id>" }\n` +
      `  call-operation: { type: "call-operation", operation: "<operation-id>" }\n` +
      `Chain: add "then": [RuleAction, ...] to any action.\n` +
      (fill.action._registeredEvents?.length
        ? `Registered events for this entity: ${fill.action._registeredEvents.map(e => e.id).join(', ')}\n`
        : '')
    : '';

  return `You are the AI fill stage of the Domain Knowledge Crystallisation Engine (DKCE).
Your task is to fill rule slots in a canonical model based on business intent and scenarios.

RULE TO FILL:
  id:          ${ctx.rule.id}
  name:        ${ctx.rule.name}
  description: ${ctx.rule.description || '(none)'}
  entity:      ${ctx.entity.id} (${ctx.entity.name})
  intent:      ${ctx.intent?.name || '(none)'}

INTENT:
  ${ctx.intent?.description?.trim() || '(none)'}
  Priority: ${ctx.intent?.priority || 'unknown'}
  ${ctx.intent?.rationale ? `Rationale: ${ctx.intent.rationale.trim()}` : ''}

GLOSSARY (domain terms in scope):
${glossarySummary}

ENTITY LIFECYCLE:
${lifecycleSummary}

SCENARIOS (these are the holdout set — your fill MUST satisfy all must-pass scenarios):
${scenarioSummary}
${conditionSpec}
${actionSpec}

OUTPUT REQUIREMENTS:
- Respond with ONLY a JSON object. No prose, no explanation, no markdown.
- The JSON must contain exactly these keys: ${slotsNeeded.map(s => `"${s}"`).join(', ')}
- Each value must be a valid RuleCondition or RuleAction as described above.
- Do not include any _slot, _description, _entityFields, or other template metadata keys.

Example of valid JSON output for a rule that checks total >= 1000 and sets discount:
{
  "condition": { "field": "total", "operator": "gte", "value": 1000 },
  "action": { "type": "set", "field": "discount", "value": { "$field": "total", "$op": "multiply", "$value": 0.1 } }
}

Now fill the slots for rule "${ctx.rule.id}". Return only the JSON object.`;
}

// ── Call Claude API ───────────────────────────────────────────────────────────

async function callClaudeAPI(prompt) {
  console.log('Calling Claude API...');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(process.env.ANTHROPIC_API_KEY ? { "x-api-key": process.env.ANTHROPIC_API_KEY } : {}),
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return text;
}

// ── Parse and validate AI response ───────────────────────────────────────────

function parseFilledSlots(rawText, slotsNeeded) {
  // Strip any markdown code fences the model might add despite instructions
  const clean = rawText
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    throw new Error(`AI response was not valid JSON.\nRaw response:\n${rawText}\nParse error: ${e.message}`);
  }

  // Verify all required slots are present
  for (const slot of slotsNeeded) {
    if (!(slot in parsed)) {
      throw new Error(`AI response missing required slot: "${slot}". Got keys: ${Object.keys(parsed).join(', ')}`);
    }
    if (parsed[slot] === null || (typeof parsed[slot] === 'object' && parsed[slot]._slot)) {
      throw new Error(`Slot "${slot}" was not filled — still contains template placeholder.`);
    }
  }

  return parsed;
}

// ── Merge filled slots back into template ─────────────────────────────────────

function mergeFilledSlots(template, filledSlots) {
  const filled = JSON.parse(JSON.stringify(template)); // deep clone

  if (filledSlots.condition !== undefined) {
    filled.fill.condition = filledSlots.condition;
  }
  if (filledSlots.action !== undefined) {
    filled.fill.action = filledSlots.action;
  }

  // Mark as filled in metadata
  filled._meta.filledAt = new Date().toISOString();
  filled._meta.filledBy = 'claude-sonnet-4-20250514';
  filled._meta.status   = 'filled-pending-gate';

  return filled;
}

// ── Structural pre-validation before writing ──────────────────────────────────
// Light checks here — deep validation is the Enforcement Gate's job.
// We just ensure the filled values are structurally plausible.


// BUG-030 fix: operator validity by field type (matches gate.js VALID_OPERATORS)
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

function preValidate(filledSlots, template) {
  const ctx          = template.context;
  const entityFields = new Set(ctx.entity.fields.map(f => f.id));
  const errors       = [];

  function checkCondition(cond, path) {
    if (!cond || typeof cond !== 'object') {
      errors.push(`${path}: must be an object`); return;
    }
    if ('and' in cond) {
      if (!Array.isArray(cond.and) || cond.and.length < 2)
        errors.push(`${path}.and: must be an array with at least 2 elements`);
      else cond.and.forEach((c, i) => checkCondition(c, `${path}.and[${i}]`));
    } else if ('or' in cond) {
      if (!Array.isArray(cond.or) || cond.or.length < 2)
        errors.push(`${path}.or: must be array with at least 2 elements`);
      else cond.or.forEach((c, i) => checkCondition(c, `${path}.or[${i}]`));
    } else if ('not' in cond) {
      checkCondition(cond.not, `${path}.not`);
    } else {
      // leaf
      if (!cond.field) errors.push(`${path}: leaf condition missing 'field'`);
      else if (!entityFields.has(cond.field))
        errors.push(`${path}: field '${cond.field}' not found on entity '${ctx.entity.id}'`);
      if (!cond.operator) errors.push(`${path}: leaf condition missing 'operator'`);
      // BUG-030 fix: check operator validity for field type
      if (cond.field && cond.operator) {
        const fieldDef = ctx.entity.fields.find(f => f.id === cond.field);
        if (fieldDef) {
          const validOps = VALID_OPERATORS[fieldDef.type];
          if (validOps && !validOps.has(cond.operator)) {
            errors.push(`${path}: operator '${cond.operator}' is not valid for field type '${fieldDef.type}'. Valid: [${[...validOps].join(', ')}]`);
          }
        }
      }
    }
  }

  function checkAction(action, path) {
    if (!action || typeof action !== 'object') {
      errors.push(`${path}: must be an object`); return;
    }
    const validTypes = ['set', 'append', 'remove', 'emit-event', 'call-operation'];
    if (!validTypes.includes(action.type))
      errors.push(`${path}.type: '${action.type}' not a valid action type`);

    if (['set', 'append', 'remove'].includes(action.type)) {
      if (!action.field) errors.push(`${path}: missing 'field' for type '${action.type}'`);
      else if (!entityFields.has(action.field))
        errors.push(`${path}: field '${action.field}' not found on entity '${ctx.entity.id}'`);
      if (action.value === undefined) errors.push(`${path}: missing 'value'`);
    }
    if (action.type === 'emit-event' && !action.event)
      errors.push(`${path}: missing 'event'`);
    if (action.type === 'call-operation' && !action.operation)
      errors.push(`${path}: missing 'operation'`);
    if (action.then) {
      if (!Array.isArray(action.then))
        errors.push(`${path}.then: must be an array`);
      else action.then.forEach((a, i) => checkAction(a, `${path}.then[${i}]`));
    }
  }

  if (filledSlots.condition) checkCondition(filledSlots.condition, 'condition');
  if (filledSlots.action)    checkAction(filledSlots.action,    'action');

  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const prompt = buildPrompt(template);

  // Show a condensed version of the prompt for visibility
  console.log('\nPrompt summary:');
  console.log(`  Rule:   ${template.context.rule.id}`);
  console.log(`  Entity: ${template.context.entity.id}`);
  console.log(`  Slots:  ${slotsNeeded.join(', ')}`);
  console.log(`  Scenarios: ${template.context.scenarios.items.length} (holdout set)`);
  console.log('');

  let rawResponse;
  try {
    rawResponse = await callClaudeAPI(prompt);
  } catch (err) {
    console.error(`API call failed: ${err.message}`);
    process.exit(1);
  }

  console.log('Raw AI response:');
  console.log(rawResponse);
  console.log('');

  let filledSlots;
  try {
    filledSlots = parseFilledSlots(rawResponse, slotsNeeded);
  } catch (err) {
    console.error(`Parse failed: ${err.message}`);
    process.exit(1);
  }

  const preErrors = preValidate(filledSlots, template);
  if (preErrors.length > 0) {
    console.error('Pre-validation errors (structural check before gate):');
    preErrors.forEach(e => console.error(`  ✗ ${e}`));
    console.error('\nFilled slots rejected. Fix the above issues before proceeding to the gate.');
    process.exit(1);
  }

  const filledTemplate = mergeFilledSlots(template, filledSlots);

  fs.writeFileSync(outputPath, yaml.dump(filledTemplate, {
    indent:      2,
    lineWidth:   120,
    noRefs:      true,
    quotingType: '"',
  }));


  // BUG-011 fix: update _fill-manifest.json if it exists
  const manifestPath = path.join(path.dirname(outputPath), '_fill-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const ruleId = filledTemplate._meta?.ruleId || filledTemplate.context?.rule?.id;
      if (manifest.templates && ruleId) {
        const entry = manifest.templates.find(t => t.ruleId === ruleId);
        if (entry) {
          entry.filled = true;
          entry.filledAt = new Date().toISOString();
          entry.filledBy = filledTemplate._meta?.filledBy || 'unknown';
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
          console.log('Manifest updated for rule: ' + ruleId);
        }
      }
    } catch (e) {
      console.warn('Warning: could not update manifest:', e.message);
    }
  }

  console.log('Pre-validation: PASSED');
  console.log(`Filled template written to: ${outputPath}`);
  console.log('');
  console.log('Filled slots:');
  console.log(JSON.stringify(filledSlots, null, 2));
  console.log('');
  console.log('Next step: run Enforcement Gate Stage 1');
  console.log(`  node gate.js ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
