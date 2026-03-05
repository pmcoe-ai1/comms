#!/usr/bin/env node
/**
 * DKCE Template Generator
 * 
 * Reads a canonical model YAML and produces fill templates for every rule
 * with condition: null or action: null. Each template contains:
 *   - The rule's context (entity, intent, glossary terms, scenarios)
 *   - [REQUIRED] slots that AI fill must populate
 *   - Structural constraints derived from the canonical model
 *   - A machine-readable JSON output format for the AI fill stage
 * 
 * Usage:
 *   node template-generator.js <canonical-model.yaml> [--output-dir <dir>]
 *   node template-generator.js example.canonical-model.yaml --output-dir ./templates
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help') {
  console.log('Usage: node template-generator.js <canonical-model.yaml> [--output-dir <dir>]');
  process.exit(0);
}

const modelPath = args[0];
const outputDirIndex = args.indexOf('--output-dir');
const outputDir = outputDirIndex !== -1 ? args[outputDirIndex + 1] : './templates';

if (!fs.existsSync(modelPath)) {
  console.error(`Error: model file not found: ${modelPath}`);
  process.exit(1);
}

// ── Load model ────────────────────────────────────────────────────────────────

const model = yaml.load(fs.readFileSync(modelPath, 'utf8'));

// ── Index helpers — build lookup maps for O(1) access ────────────────────────

function buildIndex(arr, key = 'id') {
  return Object.fromEntries((arr || []).map(item => [item[key], item]));
}

const glossaryIndex   = buildIndex(model.glossary);
const intentIndex     = buildIndex(model.intents);
const entityIndex     = buildIndex(model.entities);
const scenarioIndex   = buildIndex(model.scenarios);
const eventIndex      = buildIndex(model.events || []);
const operationIndex  = buildIndex(model.operations || []);

function fieldIndex(entity) {
  return buildIndex(entity.fields || []);
}

// ── Find rules needing fill ───────────────────────────────────────────────────

const rulesNeedingFill = (model.rules || []).filter(
  r => r.condition === null || r.action === null
);

if (rulesNeedingFill.length === 0) {
  console.log('No rules with null condition or action found. Nothing to generate.');
  process.exit(0);
}

console.log(`Found ${rulesNeedingFill.length} rule(s) needing AI fill.`);

// ── Ensure output dir ─────────────────────────────────────────────────────────

fs.mkdirSync(outputDir, { recursive: true });

// ── Core builder functions ────────────────────────────────────────────────────

/**
 * Resolves all glossary terms relevant to a rule:
 * - From the rule's entity fields
 * - From the rule's intent
 * - From the entity's glossaryRef itself
 */
function resolveGlossaryContext(rule, entity) {
  const refs = new Set();

  // entity-level glossaryRef
  if (entity.glossaryRef) refs.add(entity.glossaryRef);

  // all field glossaryRefs
  for (const field of entity.fields || []) {
    if (field.glossaryRef) refs.add(field.glossaryRef);
  }

  // intent glossaryRefs
  const intent = intentIndex[rule.intentRef];
  if (intent) {
    for (const ref of intent.glossaryRefs || []) refs.add(ref);
  }

  return [...refs]
    .filter(id => glossaryIndex[id])
    .map(id => {
      const term = glossaryIndex[id];
      const out = {
        id: term.id,
        term: term.term,
        definition: term.definition.trim()
      };
      if (term.precision) out.precision = term.precision;
      if (term.counterexamples?.length) out.counterexamples = term.counterexamples;
      return out;
    });
}

/**
 * Builds the field manifest for a rule's entity.
 * This is what the AI uses to know what fields it can reference in conditions/actions.
 */
function buildFieldManifest(entity) {
  return (entity.fields || []).map(field => {
    const entry = {
      id:       field.id,
      name:     field.name,
      type:     field.type,
      required: field.required || false,
      nullable: field.nullable || false,
    };
    if (field.enumValues)   entry.enumValues   = field.enumValues;
    if (field.validation)   entry.validation   = field.validation;
    if (field.immutable)    entry.immutable     = true;
    if (field.systemField)  entry.systemField   = true;
    if (field.glossaryRef)  entry.glossaryRef   = field.glossaryRef;
    if (field.refEntity)    entry.refEntity     = field.refEntity;
    if (field.defaultValue !== undefined) entry.defaultValue = field.defaultValue;
    return entry;
  });
}

/**
 * Resolves scenarios for a rule and formats them as concrete examples.
 * These are the holdout set — they define what "correct" looks like.
 */
function resolveScenarios(rule) {
  return (rule.scenarioRefs || [])
    .filter(id => scenarioIndex[id])
    .map(id => {
      const s = scenarioIndex[id];
      const out = {
        id:           s.id,
        coverageType: s.coverageType,
        given:        s.given,
        when:         s.when,
        then:         s.then,
        priority:     s.priority || 'must-pass',
      };
      if (s.fieldRefs?.length) {
        // BUG-028 fix: preserve entityId for multi-entity scenario context
        out.fieldValues = s.fieldRefs.map(fr => ({
          entity: fr.entityId,
          field: fr.fieldId,
          value: fr.value
        }));
      }
      return out;
    });
}

/**
 * Describes the valid operators for a given field type.
 * Helps AI fill choose appropriate operators.
 */
function validOperatorsForType(fieldType) {
  const map = {
    string:   ['eq', 'neq', 'contains', 'starts-with', 'ends-with', 'is-null', 'is-not-null'],
    integer:  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not-in', 'is-null', 'is-not-null'],
    decimal:  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is-null', 'is-not-null'],
    boolean:  ['eq', 'neq'],
    datetime: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is-null', 'is-not-null'],
    date:     ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is-null', 'is-not-null'],
    uuid:     ['eq', 'neq', 'is-null', 'is-not-null'],
    enum:     ['eq', 'neq', 'in', 'not-in'],
    array:    ['contains', 'is-null', 'is-not-null'],
    object:   ['is-null', 'is-not-null'],
  };
  return map[fieldType] || ['eq', 'neq'];
}

/**
 * Describes the valid action types for a given field type.
 */
function validActionsForType(fieldType) {
  const map = {
    string:   ['set'],
    integer:  ['set'],
    decimal:  ['set'],
    boolean:  ['set'],
    datetime: ['set'],
    date:     ['set'],
    uuid:     ['set'],
    enum:     ['set'],
    array:    ['set', 'append', 'remove'],
    object:   ['set'],
  };
  return map[fieldType] || ['set'];
}

/**
 * Describes the value constraints for an action on a given field.
 * Returns what the AI fill must produce in the 'value' slot.
 */
function actionValueConstraints(field) {
  const base = {
    canBeLiteral:    true,
    canBeFieldRef:   true,
    canBeExpression: ['decimal', 'integer'].includes(field.type),
  };

  if (field.type === 'enum') {
    base.allowedLiterals = field.enumValues;
    base.canBeFieldRef = false;
    base.canBeExpression = false;
  }
  if (field.immutable) {
    base.note = 'IMMUTABLE: this field cannot be set after creation. Do not generate an action targeting it.';
  }
  if (field.systemField) {
    base.note = 'SYSTEM FIELD: managed automatically. Do not generate an action targeting it.';
  }
  if (field.validation) {
    base.validationConstraints = field.validation;
  }

  return base;
}

/**
 * Generates the condition slot specification.
 * Tells AI fill exactly what structure to produce.
 */
function conditionSlotSpec(entity, rule) {
  const fields = buildFieldManifest(entity);
  // BUG-027 fix: conditions READ fields, so include immutable fields (only exclude system fields)
  const conditionFields = fields.filter(f => !f.systemField);

  return {
    _slot: 'REQUIRED',
    _description: [
      'Fill this slot with a RuleCondition that correctly expresses the rule trigger.',
      'The condition operates on fields of entity: ' + entity.id,
      'Reference only field ids listed in entityFields below.',
      'You may compose conditions using: { and: [...] }, { or: [...] }, { not: {...} }',
      'Leaf condition form: { field: "<fieldId>", operator: "<op>", value: <value> }',
      'For is-null / is-not-null operators, omit value entirely.',
    ],
    _entityFields: conditionFields.map(f => ({
      id:             f.id,
      type:           f.type,
      enumValues:     f.enumValues,
      validOperators: validOperatorsForType(f.type),
      glossaryRef:    f.glossaryRef,
      validation:     f.validation,
    })),
    _scenarios: resolveScenarios(rule).map(s => ({
      given:       s.given,
      fieldValues: s.fieldValues || [],
      expected:    s.then,
    })),
    _outputFormat: {
      // Inlined schema summary for AI reference
      leafCondition:    '{ field: string, operator: string, value?: any }',
      andCondition:     '{ and: [RuleCondition, ...] }',
      orCondition:      '{ or: [RuleCondition, ...] }',
      notCondition:     '{ not: RuleCondition }',
    }
  };
}

/**
 * Generates the action slot specification.
 */
function actionSlotSpec(entity, rule) {
  const fields = buildFieldManifest(entity);
  const writableFields = fields.filter(f => !f.systemField && !f.immutable);
  const declaredEvents = (rule.condition?.then || [])
    .concat([])
    .filter(a => a?.event)
    .map(a => a.event);

  // Collect events that exist in the event registry for this entity
  const relevantEvents = Object.values(eventIndex)
    .filter(e => e.entityRef === entity.id)
    .map(e => ({ id: e.id, description: e.description || e.name }));

  // Collect all declared operation IDs from the canonical model
  const declaredOperationIds = Object.keys(operationIndex);

  return {
    _slot: 'REQUIRED',
    _description: [
      'Fill this slot with a RuleAction that correctly implements the rule effect.',
      'The action operates on fields of entity: ' + entity.id,
      'Reference only field ids listed in writableFields below.',
      'type: set — assign a value. value can be a literal, { $field } reference, or { $field, $op, $value } expression.',
      'type: append / remove — for array fields.',
      'type: emit-event — emit a domain event. Use "event" property with an id from registeredEvents.',
      'type: call-operation — invoke another operation. Use "operation" property. Must be one of the declared operations: ' + declaredOperationIds.join(', '),
      'Chain multiple actions using the "then" array.',
    ],
    _writableFields: writableFields.map(f => ({
      id:              f.id,
      type:            f.type,
      enumValues:      f.enumValues,
      validActions:    validActionsForType(f.type),
      valueConstraints:actionValueConstraints(f),
      glossaryRef:     f.glossaryRef,
    })),
    _registeredEvents: relevantEvents,
    _declaredOperations: declaredOperationIds,
    _scenarios: resolveScenarios(rule).map(s => ({
      given:       s.given,
      fieldValues: s.fieldValues || [],
      expected:    s.then,
    })),
    _outputFormat: {
      setLiteral:     '{ type: "set", field: string, value: literal }',
      setFieldRef:    '{ type: "set", field: string, value: { $field: string } }',
      setExpression:  '{ type: "set", field: string, value: { $field: string, $op: string, $value: number } }',
      emitEvent:      '{ type: "emit-event", event: string }',
      callOperation:  '{ type: "call-operation", operation: string }  # Must be one of the following declared operations: ' + declaredOperationIds.join(', '),
      chain:          'Add "then": [RuleAction, ...] to any action to chain further actions.',
    }
  };
}

// ── Main template builder ─────────────────────────────────────────────────────

function buildTemplate(rule) {
  const entity = entityIndex[rule.entityRef];
  if (!entity) {
    console.warn(`  Warning: entity '${rule.entityRef}' not found for rule '${rule.id}'. Skipping.`);
    return null;
  }

  const intent = intentIndex[rule.intentRef];
  const scenarios = resolveScenarios(rule);
  const glossaryContext = resolveGlossaryContext(rule, entity);

  // The template has two sections:
  //   context — everything the AI needs to understand the rule (read-only)
  //   fill — the slots the AI must populate (write here)

  const template = {
    _meta: {
      generatedAt:        new Date().toISOString(),
      generatedBy:        'dkce-template-generator',
      canonicalModelId:   model.meta.id,
      canonicalModelVersion: model.meta.version,
      ruleId:             rule.id,
      purpose: [
        'This template is an AI fill request produced by the DKCE Template Generator.',
        'The AI fill stage (Claude API) must populate every slot marked _slot: REQUIRED.',
        'Filled output is passed to the Enforcement Gate Stage 1 before any code generation.',
        'The scenarios in context are the holdout set — AI cannot modify them.',
        'Fill only the slots in the "fill" section. Do not modify the "context" section.',
      ]
    },

    context: {
      rule: {
        id:          rule.id,
        name:        rule.name,
        description: rule.description || null,
        priority:    rule.priority || 0,
        enabled:     rule.enabled !== false,
        tags:        rule.tags || [],
      },
      intent: intent ? {
        id:          intent.id,
        name:        intent.name,
        description: intent.description.trim(),
        priority:    intent.priority,
        rationale:   intent.rationale || null,
      } : null,
      entity: {
        id:          entity.id,
        name:        entity.name,
        description: entity.description || null,
        fields:      buildFieldManifest(entity),
        lifecycle:   entity.lifecycle ? {
          statusField:    entity.lifecycle.statusField,
          initialState:   entity.lifecycle.initialState,
          terminalStates: entity.lifecycle.terminalStates || [],
          transitions:    entity.lifecycle.transitions.map(t => ({
            from:    t.from,
            to:      t.to,
            trigger: t.trigger || null,
            guard:   t.guard || null,
          }))
        } : null,
      },
      glossary:  glossaryContext,
      scenarios: {
        _purpose: 'These are the holdout set. The filled rule must satisfy ALL must-pass scenarios.',
        items:    scenarios,
      },
      knownLimitations: [
        'LeafCondition can only reference fields on this entity. Cross-entity checks belong at the operation layer.',
        'ArithmeticExpression is single-operator only: field op literal. Decompose complex calculations into chained actions.',
      ],
    },

    fill: {
      _instructions: [
        '1. Read the context section completely before filling.',
        '2. For each REQUIRED slot, replace the slot object with a valid value.',
        '3. Your fill must satisfy every scenario in context.scenarios.items where priority is must-pass.',
        '4. Reference only field ids listed in context.entity.fields.',
        '5. For enum fields, use only values listed in field.enumValues.',
        '6. For lifecycle transitions, only set status values that are reachable per context.entity.lifecycle.transitions.',
        '7. Return this entire document with the fill section completed. Do not modify the context section.',
      ],
      condition: rule.condition === null
        ? conditionSlotSpec(entity, rule)
        : rule.condition,
      action: rule.action === null
        ? actionSlotSpec(entity, rule)
        : rule.action,
      elseAction: rule.elseAction === null
        ? { _slot: 'OPTIONAL', _description: 'Fill if the rule should have an else branch. Omit or set to null if not needed.' }
        : (rule.elseAction || null),
    }
  };

  return template;
}

// ── Generate one template file per rule ──────────────────────────────────────

const summary = [];

for (const rule of rulesNeedingFill) {
  process.stdout.write(`  Generating template for rule: ${rule.id} ... `);

  const template = buildTemplate(rule);
  if (!template) {
    console.log('SKIPPED');
    continue;
  }

  const slots = [];
  if (rule.condition === null) slots.push('condition');
  if (rule.action === null)    slots.push('action');

  const outputPath = path.join(outputDir, `${rule.id}.fill-template.yaml`);
  fs.writeFileSync(outputPath, yaml.dump(template, {
    indent:          2,
    lineWidth:       120,
    noRefs:          true,
    quotingType:     '"',
  }));

  console.log(`OK → ${outputPath}`);
  summary.push({ ruleId: rule.id, slots, outputPath });
}

// ── Write manifest — machine-readable list of all generated templates ─────────

const manifestPath = path.join(outputDir, '_fill-manifest.json');
const manifest = {
  generatedAt:            new Date().toISOString(),
  canonicalModelId:       model.meta.id,
  canonicalModelVersion:  model.meta.version,
  canonicalModelDomain:   model.meta.domain,
  totalRulesNeedingFill:  rulesNeedingFill.length,
  templates:              summary.map(s => ({
    ruleId:     s.ruleId,
    slots:      s.slots,
    template:   s.outputPath,
    filled:     false,         // fill stage updates this to true
    filledAt:   null,
    filledBy:   null,
    gateResult: null,          // enforcement gate updates this
  }))
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// ── Print summary ─────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────');
console.log(`Template generation complete`);
console.log(`  Templates generated : ${summary.length}`);
console.log(`  Output directory    : ${outputDir}`);
console.log(`  Manifest            : ${manifestPath}`);
console.log('\nNext step: pass each template to the AI fill stage (fill.js)');
console.log('  node fill.js <template.yaml>');
console.log('─────────────────────────────────────────────────────────────');
