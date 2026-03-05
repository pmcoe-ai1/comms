#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// codegen.js — DKCE Code Generator
// Reads an approved canonical model YAML and generates:
//   - TypeScript interfaces (generated/interfaces/)
//   - Prisma schema (generated/prisma/schema.prisma)
//   - OpenAPI 3.1 spec (generated/openapi/openapi.yaml)
//   - Rule stubs (generated/rules/)
//   - Gap flags report (generated/gapflags.json)
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ─── CLI argument parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);
let modelPath = null;
let outputDir = './generated';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output-dir' && args[i + 1]) {
    outputDir = args[i + 1];
    i++;
  } else if (args[i] === '--filled-dir' && args[i + 1]) {
    i++; // skip value, handled later
  } else if (!args[i].startsWith('--')) {
    modelPath = args[i];
  }
}

let filledDirs = [];

for (let j = 0; j < args.length; j++) {
  if (args[j] === '--filled-dir' && args[j + 1]) {
    filledDirs.push(args[j + 1]);
    j++;
  }
}

if (!modelPath) {
  console.error('Usage: node codegen.js <canonical-model.yaml> [--output-dir ./generated] [--filled-dir <dir>]');
  process.exit(1);
}

// BUG-007 fix: scan filled template directories and build ruleId -> status map
const filledTemplateStatus = {};
for (const dir of filledDirs) {
  if (!fs.existsSync(dir)) {
    console.warn('Warning: --filled-dir path does not exist: ' + dir);
    continue;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.filled.yaml'));
  for (const file of files) {
    try {
      const content = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (content && content._meta && content._meta.ruleId) {
        filledTemplateStatus[content._meta.ruleId] = {
          status: content._meta.status || 'unknown',
          file: path.join(dir, file),
        };
      }
    } catch (e) {
      console.warn('Warning: could not read filled template: ' + file);
    }
  }
}

// ─── Load canonical model ────────────────────────────────────────────────────

const modelRaw = fs.readFileSync(modelPath, 'utf8');
const model = yaml.load(modelRaw);
const version = model.meta.version;

// ─── Tracking ────────────────────────────────────────────────────────────────

const gapFlags = [];
const summary = {
  filesGenerated: 0,
  entitiesCovered: [],
  rulesStubbed: [],
  rulesBlocked: [],
  gapFlags: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeGenerated(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  summary.filesGenerated++;
}

function guardComment(version, ext) {
  const comment = ext === 'prisma' ? '//' : '//';
  return [
    `${comment} ─────────────────────────────────────────────────────────────────────────────`,
    `${comment} GENERATED FILE — do not edit manually.`,
    `${comment} Source: canonical-model.yaml v${version}`,
    `${comment} Generator: codegen.js`,
    `${comment} Regenerate: node codegen.js example.canonical-model.yaml`,
    `${comment} ─────────────────────────────────────────────────────────────────────────────`,
  ].join('\n');
}

function yamlGuardComment(version) {
  return [
    `# ─────────────────────────────────────────────────────────────────────────────`,
    `# GENERATED FILE — do not edit manually.`,
    `# Source: canonical-model.yaml v${version}`,
    `# Generator: codegen.js`,
    `# Regenerate: node codegen.js example.canonical-model.yaml`,
    `# ─────────────────────────────────────────────────────────────────────────────`,
  ].join('\n');
}

function toPascalCase(str) {
  return str
    .split(/[-_\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** Map canonical type to TypeScript type */
function tsType(field, entityName) {
  switch (field.type) {
    case 'uuid':
      return 'string';
    case 'string':
      return 'string';
    case 'integer':
      return 'number';
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'datetime':
      return 'Date';
    case 'enum':
      return `${entityName}${toPascalCase(field.name === 'status' ? 'Status' : field.name)}`;
    case 'object':
      return `${entityName}${toPascalCase(field.name)}`;
    case 'array':
      if (field.itemType === 'string') return 'string[]';
      if (field.itemType && field.itemType.startsWith('ref:')) {
        const refEntityId = field.itemType.split(':')[1];
        const refEntity = model.entities.find((e) => e.id === refEntityId);
        return refEntity ? `${refEntity.name}[]` : 'unknown[]';
      }
      return 'string[]';
    default:
      return 'unknown';
  }
}

/** Generate field comment showing canonical properties */
function fieldComment(field) {
  const parts = [field.type];
  if (field.immutable) parts.push('immutable');
  if (field.systemField) parts.push('system');
  if (field.refEntity) {
    const refEnt = model.entities.find((e) => e.id === field.refEntity);
    if (refEnt) parts.push(`FK → ${refEnt.name}`);
  }
  if (field.unique) parts.push('unique');
  if (field.validation) {
    const v = field.validation;
    const vParts = [];
    if (v.min !== undefined) vParts.push(`min:${v.min}`);
    if (v.max !== undefined) vParts.push(`max:${v.max}`);
    if (v.precision !== undefined) vParts.push(`precision:${v.precision}`);
    if (v.maxLength !== undefined) vParts.push(`maxLength:${v.maxLength}`);
    if (v.pattern) vParts.push(`pattern:${v.pattern}`);
    if (vParts.length) parts.push(`validation: {${vParts.join(', ')}}`);
  }
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    parts.push(`default: ${JSON.stringify(field.defaultValue)}`);
  }
  if (field.nullable) parts.push('nullable');
  return `// ${parts.join(', ')}`;
}

/** Find the first intent that references an entity */
function findIntentRef(entityId) {
  const refs = [];
  for (const intent of model.intents) {
    if (intent.glossaryRefs && intent.glossaryRefs.includes(entityId)) {
      refs.push(intent.id);
    }
  }
  // Also check rules
  for (const rule of model.rules) {
    if (rule.entityRef === entityId && rule.intentRef) {
      if (!refs.includes(rule.intentRef)) refs.push(rule.intentRef);
    }
  }
  // Also check operations
  for (const op of model.operations) {
    if (op.intentRef && !refs.includes(op.intentRef)) {
      if (op.outputEntity === entityId) {
        refs.push(op.intentRef);
      }
    }
  }
  if (refs.length === 0) return entityId;
  if (refs.length === 1) return refs[0];
  return 'multiple';
}

// ─── 1. Generate enums ──────────────────────────────────────────────────────

function generateEnums() {
  const lines = [guardComment(version, 'ts'), ''];

  for (const entity of model.entities) {
    for (const field of entity.fields) {
      if (field.type === 'enum' && field.enumValues) {
        const enumName = `${entity.name}${toPascalCase(field.name === 'status' ? 'Status' : field.name)}`;
        lines.push(`export type ${enumName} =`);
        const valueParts = field.enumValues.map((v) => `  | '${v}'`);
        lines.push(valueParts.join('\n') + ';');
        lines.push('');
      }
    }
  }

  writeGenerated(path.join(outputDir, 'interfaces', 'enums.ts'), lines.join('\n'));
}

// ─── 2. Generate TypeScript interfaces ───────────────────────────────────────

function generateInterfaces() {
  for (const entity of model.entities) {
    const lines = [];
    const imports = [];
    const entityName = entity.name;
    const entityId = entity.id;
    const intentRef = findIntentRef(entityId);

    // Check which enum types this entity uses
    const enumFields = entity.fields.filter((f) => f.type === 'enum' && f.enumValues);
    if (enumFields.length > 0) {
      const enumTypes = enumFields.map(
        (f) => `${entityName}${toPascalCase(f.name === 'status' ? 'Status' : f.name)}`
      );
      imports.push(`import type { ${enumTypes.join(', ')} } from './enums';`);
    }

    // Guard comment
    lines.push(guardComment(version, 'ts'));
    lines.push('');

    // Traceability
    lines.push(`// intentRef: ${intentRef}`);
    lines.push(`// canonicalModelVersion: ${version}`);
    lines.push(`// entityRef: ${entityId}`);
    lines.push('');

    // Imports
    if (imports.length > 0) {
      lines.push(imports.join('\n'));
      lines.push('');
    }

    // ── Main interface ──
    lines.push(`export interface ${entityName} {`);
    for (const field of entity.fields) {
      const readonly = field.immutable || field.systemField ? 'readonly ' : '';
      let type = tsType(field, entityName);
      if (field.nullable) type += ' | null';
      const comment = fieldComment(field);
      lines.push(`  ${readonly}${field.name}: ${type}; ${comment}`);
    }
    lines.push('}');
    lines.push('');

    // ── Embedded object interfaces ──
    for (const field of entity.fields) {
      if (field.type === 'object' && field.objectSchema) {
        const objName = `${entityName}${toPascalCase(field.name)}`;
        lines.push(`// Embedded object type for ${entityName}.${field.name}`);
        lines.push(`export interface ${objName} {`);
        for (const subField of field.objectSchema.fields) {
          let subType = 'string';
          switch (subField.type) {
            case 'string':
              subType = 'string';
              break;
            case 'integer':
              subType = 'number';
              break;
            case 'decimal':
              subType = 'number';
              break;
            case 'boolean':
              subType = 'boolean';
              break;
            default:
              subType = 'string';
          }
          if (subField.nullable) subType += ' | null';
          lines.push(`  ${subField.name}: ${subType};`);
        }
        lines.push('}');
        lines.push('');
      }
    }

    const hasLifecycle = !!entity.lifecycle;

    // ── CreateInput ──
    lines.push(`// Input type for creating ${entityName === 'OrderItem' ? 'an' : 'a'} ${entityName} (excludes system fields; immutable non-system fields are required)`);
    lines.push(`export interface Create${entityName}Input {`);
    for (const field of entity.fields) {
      if (field.systemField) continue; // exclude system fields
      // Lifecycle status field: exclude — set by lifecycle initialState on creation
      if (hasLifecycle && field.name === entity.lifecycle.statusField) continue;
      const type = tsType(field, entityName);
      const fullType = field.nullable ? `${type} | null` : type;
      // Immutable non-system fields are required in create (e.g., customerId, sku)
      const optional = (!field.required || field.defaultValue !== undefined) && !field.immutable ? '?' : '';
      lines.push(`  ${field.name}${optional}: ${fullType};`);
    }
    if (hasLifecycle) {
      lines.push(`  // status omitted — set by lifecycle initialState on creation`);
      lines.push(`  // use transition${entityName}Status() for all subsequent state changes`);
    }
    lines.push('}');
    lines.push('');

    // ── UpdateInput ──
    if (hasLifecycle) {
      lines.push(`// Input type for updating ${entityName === 'OrderItem' ? 'an' : 'a'} ${entityName} (only mutable, non-system fields)`);
      lines.push(`// Note: status changes must use transition${entityName}Status(), not this type directly.`);
    } else {
      lines.push(`// Input type for updating ${entityName === 'OrderItem' ? 'an' : 'a'} ${entityName} (only mutable, non-system fields)`);
    }
    lines.push(`export interface Update${entityName}Input {`);
    for (const field of entity.fields) {
      if (field.systemField) continue;
      if (field.immutable) continue;
      // Status field with lifecycle: exclude from UpdateInput
      if (hasLifecycle && field.name === entity.lifecycle.statusField) continue;
      const type = tsType(field, entityName);
      const fullType = field.nullable ? `${type} | null` : type;
      lines.push(`  ${field.name}?: ${fullType};`);
    }
    lines.push('}');
    lines.push('');

    // ── Lifecycle transition function ──
    if (hasLifecycle) {
      const lc = entity.lifecycle;
      const statusField = lc.statusField;
      const statusEnumType = `${entityName}${toPascalCase(statusField === 'status' ? 'Status' : statusField)}`;

      lines.push(`// Error class for invalid lifecycle transitions`);
      lines.push(`export class InvalidLifecycleTransition extends Error {`);
      lines.push(`  constructor(public readonly from: ${statusEnumType}, public readonly to: ${statusEnumType}) {`);
      lines.push(`    super(\`Invalid lifecycle transition: \${from} → \${to}\`);`);
      lines.push(`    this.name = 'InvalidLifecycleTransition';`);
      lines.push(`  }`);
      lines.push(`}`);
      lines.push('');

      // Build transition map from lifecycle transitions
      const transitionMap = {};
      const enumField = entity.fields.find((f) => f.name === statusField);
      if (enumField && enumField.enumValues) {
        for (const val of enumField.enumValues) {
          transitionMap[val] = [];
        }
      }
      for (const t of lc.transitions) {
        if (!transitionMap[t.from]) transitionMap[t.from] = [];
        if (!transitionMap[t.from].includes(t.to)) {
          transitionMap[t.from].push(t.to);
        }
      }

      lines.push(`// Lifecycle transition function — enforces valid state transitions`);
      lines.push(`// entityRef: ${entityId}`);
      lines.push(`export function transition${entityName}Status(`);
      lines.push(`  entity: ${entityName},`);
      lines.push(`  to: ${statusEnumType}`);
      lines.push(`): ${entityName} {`);
      lines.push(`  const validTransitions: Record<${statusEnumType}, ${statusEnumType}[]> = {`);
      for (const [fromState, toStates] of Object.entries(transitionMap)) {
        const toStr = toStates.map((s) => `'${s}'`).join(', ');
        const isTerminal = lc.terminalStates && lc.terminalStates.includes(fromState);
        lines.push(`    '${fromState}': [${toStr}],${isTerminal ? ' // terminal' : ''}`);
      }
      lines.push(`  };`);
      lines.push(`  const allowed = validTransitions[entity.${statusField}];`);
      lines.push(`  if (!allowed || !allowed.includes(to)) {`);
      lines.push(`    throw new InvalidLifecycleTransition(entity.${statusField}, to);`);
      lines.push(`  }`);
      lines.push(`  return { ...entity, ${statusField}: to };`);
      lines.push(`}`);
      lines.push('');
    }

    writeGenerated(path.join(outputDir, 'interfaces', `${entityName}.ts`), lines.join('\n'));
    summary.entitiesCovered.push(entityId);
  }
}

// ─── 3. Generate Prisma schema ───────────────────────────────────────────────

function generatePrisma() {
  const lines = [];

  lines.push(guardComment(version, 'prisma'));
  lines.push('');

  lines.push('generator client {');
  lines.push('  provider = "prisma-client-js"');
  lines.push('}');
  lines.push('');
  lines.push('datasource db {');
  lines.push('  provider = "postgresql"');
  lines.push('  url      = env("DATABASE_URL")');
  lines.push('}');
  lines.push('');

  // Generate enums first
  for (const entity of model.entities) {
    for (const field of entity.fields) {
      if (field.type === 'enum' && field.enumValues) {
        const enumName = `${entity.name}${toPascalCase(field.name === 'status' ? 'Status' : field.name)}`;
        lines.push(`enum ${enumName} {`);
        for (const val of field.enumValues) {
          if (val.includes("-")) {
            const safe = val.replace(/-/g, "_");
            lines.push(`  ${safe}    @map("${val}")`);
          } else {
            lines.push(`  ${val}`);
          }
        }
        lines.push('}');
        lines.push('');
      }
    }
  }

  // Generate models
  for (const entity of model.entities) {
    const entityId = entity.id;
    const intentRef = findIntentRef(entityId);

    lines.push(`/// intentRef: ${intentRef}`);
    lines.push(`/// canonicalModelVersion: ${version}`);
    lines.push(`/// entityRef: ${entityId}`);
    lines.push(`model ${entity.name} {`);

    for (const field of entity.fields) {
      let prismaType = '';
      let attrs = [];

      switch (field.type) {
        case 'uuid':
          prismaType = 'String';
          if (field.systemField && field.immutable && field.name === 'id') {
            attrs.push('@id', '@default(uuid())');
          }
          break;
        case 'string':
          prismaType = 'String';
          if (field.unique) attrs.push('@unique');
          break;
        case 'integer':
          prismaType = 'Int';
          break;
        case 'decimal': {
          prismaType = 'Decimal';
          const prec = field.validation && field.validation.precision !== undefined ? field.validation.precision : 2;
          attrs.push(`@db.Decimal(10, ${prec})`);
          break;
        }
        case 'boolean':
          prismaType = 'Boolean';
          break;
        case 'datetime':
          prismaType = 'DateTime';
          if (field.systemField && field.name === 'createdAt') {
            attrs.push('@default(now())');
          } else if (field.systemField && field.name === 'updatedAt') {
            attrs.push('@updatedAt');
          }
          break;
        case 'enum': {
          const enumName = `${entity.name}${toPascalCase(field.name === 'status' ? 'Status' : field.name)}`;
          prismaType = enumName;
          if (field.defaultValue !== undefined && field.defaultValue !== null) {
            const safeDefault = String(field.defaultValue).replace(/-/g, '_');
            attrs.push(`@default(${safeDefault})`);
          }
          break;
        }
        case 'object':
          prismaType = 'Json';
          break;
        case 'array':
          if (field.itemType === 'string') {
            prismaType = 'String[]';
          } else {
            prismaType = 'Json';
          }
          break;
        default:
          prismaType = 'String';
      }

      // Default values (non-enum)
      if (field.defaultValue !== undefined && field.defaultValue !== null && field.type !== 'enum') {
        if (field.type === 'decimal' || field.type === 'integer') {
          attrs.push(`@default(${field.defaultValue})`);
        } else if (field.type === 'string') {
          attrs.push(`@default("${field.defaultValue}")`);
        } else if (field.type === 'boolean') {
          attrs.push(`@default(${field.defaultValue})`);
        }
      }

      // Nullable
      const nullable = field.nullable ? '?' : '';

      const attrStr = attrs.length > 0 ? '  ' + attrs.join(' ') : '';
      const padding = Math.max(1, 16 - field.name.length);
      lines.push(`  ${field.name}${' '.repeat(padding)}${prismaType}${nullable}${attrStr}`);
    }

    // softDelete
    if (entity.softDelete) {
      lines.push(`  deletedAt         DateTime?  // softDelete: true`);
    }

    lines.push('');

    // Relations from explicit relation declarations
    if (entity.relations) {
      for (const rel of entity.relations) {
        if (rel.type === 'one-to-many') {
          const targetEntity = model.entities.find((e) => e.id === rel.targetEntity);
          if (targetEntity) {
            lines.push(`  ${toCamelCase(targetEntity.name)}s${' '.repeat(Math.max(1, 16 - toCamelCase(targetEntity.name).length - 1))}${targetEntity.name}[]`);
          }
        } else if (rel.type === 'many-to-one') {
          const targetEntity = model.entities.find((e) => e.id === rel.targetEntity);
          if (targetEntity) {
            const fromFieldObj = entity.fields.find((f) => f.id === rel.fromField);
            const fromFieldName = fromFieldObj ? fromFieldObj.name : rel.fromField;
            const toFieldObj = targetEntity.fields.find((f) => f.id === rel.toField);
            const toFieldName = toFieldObj ? toFieldObj.name : rel.toField;
            const relName = toCamelCase(targetEntity.name);
            const padding2 = Math.max(1, 16 - relName.length);
            lines.push(`  ${relName}${' '.repeat(padding2)}${targetEntity.name}  @relation(fields: [${fromFieldName}], references: [${toFieldName}])`);
          }
        }
      }
    }

    // Also add relation fields for uuid+refEntity that aren't covered by explicit relations
    for (const field of entity.fields) {
      if (field.refEntity && field.type === 'uuid') {
        const hasExplicitRelation =
          entity.relations &&
          entity.relations.some((r) => {
            const fromFieldObj = entity.fields.find((f) => f.id === r.fromField);
            return fromFieldObj && fromFieldObj.id === field.id;
          });
        if (!hasExplicitRelation) {
          const targetEntity = model.entities.find((e) => e.id === field.refEntity);
          if (targetEntity) {
            const relName = toCamelCase(targetEntity.name);
            const padding2 = Math.max(1, 16 - relName.length);
            lines.push(`  ${relName}${' '.repeat(padding2)}${targetEntity.name}  @relation(fields: [${field.name}], references: [id])`);
          }
        }
      }
    }

    // Add reverse relation fields for entities that are targets of FK references
    // but don't have an explicit one-to-many relation declared on this side
    for (const otherEntity of model.entities) {
      if (otherEntity.id === entity.id) continue;
      // Track which other entities already have a reverse relation via one-to-many
      const alreadyHasReverse = new Set();
      if (entity.relations) {
        for (const r of entity.relations) {
          if (r.type === 'one-to-many') alreadyHasReverse.add(r.targetEntity);
        }
      }
      for (const otherField of otherEntity.fields) {
        if (otherField.refEntity === entity.id && otherField.type === 'uuid') {
          if (!alreadyHasReverse.has(otherEntity.id)) {
            const revName = toCamelCase(otherEntity.name) + 's';
            const padding3 = Math.max(1, 16 - revName.length);
            lines.push(`  ${revName}${' '.repeat(padding3)}${otherEntity.name}[]`);
            alreadyHasReverse.add(otherEntity.id); // avoid duplicates
          }
        }
      }
    }

    lines.push('');

    // Indexes — skip redundant @@unique when single field already has @unique
    if (entity.indexes) {
      for (const idx of entity.indexes) {
        const fieldNames = idx.fields.map((fId) => {
          const f = entity.fields.find((ff) => ff.id === fId);
          return f ? f.name : fId;
        });
        if (idx.unique) {
          // Skip if single-field unique index and field already has @unique
          if (fieldNames.length === 1) {
            const fieldDef = entity.fields.find((f) => f.name === fieldNames[0] && f.unique);
            if (fieldDef) continue; // already has @unique on the field
          }
          lines.push(`  @@unique([${fieldNames.join(', ')}])`);
        } else {
          lines.push(`  @@index([${fieldNames.join(', ')}])`);
        }
      }
    }

    lines.push('}');
    lines.push('');
  }

  writeGenerated(path.join(outputDir, 'prisma', 'schema.prisma'), lines.join('\n'));
}

// ─── 4. Generate OpenAPI spec ────────────────────────────────────────────────

function generateOpenAPI() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: `${model.meta.domain} API`,
      version: model.meta.version,
      description: model.meta.description,
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };

  // Generate schemas for each entity
  for (const entity of model.entities) {
    const properties = {};
    const required = [];

    for (const field of entity.fields) {
      const prop = {};
      switch (field.type) {
        case 'uuid':
          prop.type = 'string';
          prop.format = 'uuid';
          break;
        case 'string':
          prop.type = 'string';
          if (field.validation) {
            if (field.validation.maxLength) prop.maxLength = field.validation.maxLength;
            if (field.validation.pattern) prop.pattern = field.validation.pattern;
          }
          break;
        case 'integer':
          prop.type = 'integer';
          if (field.validation) {
            if (field.validation.min !== undefined) prop.minimum = field.validation.min;
            if (field.validation.max !== undefined) prop.maximum = field.validation.max;
          }
          break;
        case 'decimal':
          prop.type = 'number';
          prop.format = 'decimal';
          if (field.validation) {
            if (field.validation.min !== undefined) prop.minimum = field.validation.min;
            if (field.validation.max !== undefined) prop.maximum = field.validation.max;
          }
          break;
        case 'boolean':
          prop.type = 'boolean';
          break;
        case 'datetime':
          prop.type = 'string';
          prop.format = 'date-time';
          break;
        case 'enum':
          prop.type = 'string';
          if (field.enumValues) prop.enum = field.enumValues;
          break;
        case 'object':
          prop.type = 'object';
          if (field.objectSchema && field.objectSchema.fields) {
            prop.properties = {};
            const objRequired = [];
            for (const sf of field.objectSchema.fields) {
              const sp = { type: sf.type === 'decimal' ? 'number' : sf.type || 'string' };
              prop.properties[sf.name] = sp;
              if (sf.required) objRequired.push(sf.name);
            }
            if (objRequired.length) prop.required = objRequired;
          }
          break;
        case 'array':
          prop.type = 'array';
          prop.items = { type: field.itemType === 'string' ? 'string' : 'string' };
          break;
        default:
          prop.type = 'string';
      }

      if (field.nullable) prop.nullable = true;
      if (field.defaultValue !== undefined) prop.default = field.defaultValue;

      properties[field.name] = prop;
      if (field.required) required.push(field.name);
    }

    spec.components.schemas[entity.name] = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };

    // CreateInput schema
    const createProps = {};
    const createRequired = [];
    for (const field of entity.fields) {
      if (field.systemField) continue;
      const prop = { ...properties[field.name] };
      createProps[field.name] = prop;
      if (field.required && field.defaultValue === undefined) createRequired.push(field.name);
    }
    spec.components.schemas[`Create${entity.name}Input`] = {
      type: 'object',
      properties: createProps,
      required: createRequired.length > 0 ? createRequired : undefined,
    };
  }

  // Paginated collection wrapper
  spec.components.schemas['PaginatedCollection'] = {
    type: 'object',
    properties: {
      data: { type: 'array', items: {} },
      cursor: { type: 'string', nullable: true },
      total: { type: 'integer' },
    },
  };

  // Error schema
  spec.components.schemas['ApiError'] = {
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      code: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['statusCode', 'code', 'message'],
  };

  // Generate paths from operations
  for (const op of model.operations) {
    const pathKey = op.path;
    if (!spec.paths[pathKey]) spec.paths[pathKey] = {};

    const method = op.method.toLowerCase();
    const operation = {
      operationId: op.name,
      summary: op.description || op.name,
      tags: [toPascalCase(op.outputEntity || op.id)],
    };

    // Path parameters
    if (op.pathParams) {
      operation.parameters = op.pathParams.map((p) => ({
        name: p.name,
        in: 'path',
        required: true,
        schema: { type: 'string', format: p.type === 'uuid' ? 'uuid' : undefined },
      }));
    }

    // Input
    if (op.inputMode === 'body' && op.inputEntity) {
      const inputEntity = model.entities.find((e) => e.id === op.inputEntity);
      const schemaName = inputEntity ? `Create${inputEntity.name}Input` : 'object';
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schemaName}` },
          },
        },
      };
    } else if (op.inputMode === 'query' && op.pagination) {
      if (!operation.parameters) operation.parameters = [];
      if (op.pagination.filterableFields) {
        for (const ff of op.pagination.filterableFields) {
          const fieldEntity = model.entities.find((e) => e.id === op.inputEntity || e.id === op.outputEntity);
          const fieldDef = fieldEntity ? fieldEntity.fields.find((f) => f.id === ff) : null;
          operation.parameters.push({
            name: fieldDef ? fieldDef.name : ff,
            in: 'query',
            required: false,
            schema: { type: 'string' },
          });
        }
      }
      operation.parameters.push(
        { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            default: op.pagination.defaultSize,
            maximum: op.pagination.maxSize,
          },
        }
      );
      if (op.pagination.sortableFields) {
        operation.parameters.push({
          name: 'sort',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: op.pagination.sortableFields },
        });
      }
    }

    // Output
    operation.responses = {};
    if (op.outputMode === 'single' && op.outputEntity) {
      const outputEntity = model.entities.find((e) => e.id === op.outputEntity);
      const schemaName = outputEntity ? outputEntity.name : 'object';
      // BUG-022 fix: POST creation endpoints return 201 Created
      const successCode = op.method === 'POST' ? '201' : '200';
      const successDesc = op.method === 'POST' ? 'Created' : 'Success';
      operation.responses[successCode] = {
        description: successDesc,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schemaName}` },
          },
        },
      };
    } else if (op.outputMode === 'collection' && op.outputEntity) {
      const outputEntity = model.entities.find((e) => e.id === op.outputEntity);
      const schemaName = outputEntity ? outputEntity.name : 'object';
      operation.responses['200'] = {
        description: 'Success',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${schemaName}` },
                },
                cursor: { type: 'string', nullable: true },
                total: { type: 'integer' },
              },
            },
          },
        },
      };
    } else if (op.outputMode === 'none') {
      operation.responses['204'] = { description: 'No Content' };
    }

    // Error responses
    if (op.errorResponses) {
      // Group errors by HTTP status code (BUG-021 fix)
      const errorsByStatus = {};
      for (const err of op.errorResponses) {
        const statusStr = String(err.statusCode);
        if (!errorsByStatus[statusStr]) errorsByStatus[statusStr] = [];
        errorsByStatus[statusStr].push(err);
      }

      const HTTP_STATUS_TEXT = {
        '400': 'Bad Request', '401': 'Unauthorized', '402': 'Payment Required',
        '403': 'Forbidden', '404': 'Not Found', '409': 'Conflict',
        '422': 'Unprocessable Entity', '429': 'Too Many Requests',
        '500': 'Internal Server Error',
      };

      for (const [statusStr, errors] of Object.entries(errorsByStatus)) {
        // Create a named component schema for each error code
        const refs = errors.map(err => {
          const schemaName = err.code
            .split(/[-_]+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join('') + 'Error';
          if (!spec.components.schemas[schemaName]) {
            spec.components.schemas[schemaName] = {
              type: 'object',
              properties: {
                statusCode: { type: 'integer', example: err.statusCode },
                code: { type: 'string', example: err.code },
                message: { type: 'string' },
              },
            };
          }
          return { $ref: `#/components/schemas/${schemaName}` };
        });

        if (errors.length === 1) {
          operation.responses[statusStr] = {
            description: errors[0].description || errors[0].code,
            content: {
              'application/json': {
                schema: refs[0],
              },
            },
          };
        } else {
          operation.responses[statusStr] = {
            description: HTTP_STATUS_TEXT[statusStr] || 'Error',
            content: {
              'application/json': {
                schema: {
                  oneOf: refs,
                },
              },
            },
          };
        }
      }
    }

    // Auth
    if (op.auth && op.auth.required) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Rate limit
    if (op.rateLimit) {
      operation['x-rate-limit'] = op.rateLimit;
    }

    spec.paths[pathKey][method] = operation;
  }

  const yamlContent = yamlGuardComment(version) + '\n\n' + yaml.dump(spec, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  writeGenerated(path.join(outputDir, 'openapi', 'openapi.yaml'), yamlContent);
}

// ─── 5. Generate rule stubs ──────────────────────────────────────────────────

function formatCondition(cond, indent) {
  if (!cond) return `${indent}(condition pending AI fill)`;
  const lines = [];
  if (cond.and) {
    lines.push(`${indent}AND [`);
    for (const sub of cond.and) {
      lines.push(formatCondition(sub, indent + '  ') + ',');
    }
    lines.push(`${indent}]`);
  } else if (cond.not) {
    lines.push(`${indent}NOT (`);
    lines.push(formatCondition(cond.not, indent + '  '));
    lines.push(`${indent})`);
  } else if (cond.or) {
    lines.push(`${indent}OR [`);
    for (const sub of cond.or) {
      lines.push(formatCondition(sub, indent + '  ') + ',');
    }
    lines.push(`${indent}]`);
  } else if (cond.field) {
    // BUG-013 fix: JSON.stringify for object values; BUG-016 fix: omit undefined for unary ops
    const valStr = cond.value !== undefined ? ' ' + JSON.stringify(cond.value) : '';
    lines.push(`${indent}${cond.field} ${cond.operator}${valStr}`);
  }
  return lines.join('\n');
}

function formatAction(action, indent) {
  if (!action) return `${indent}(action pending AI fill)`;
  const lines = [];
  if (action.type === 'set') {
    let valueStr;
    if (action.value && typeof action.value === 'object' && action.value.$field) {
      valueStr = `${action.value.$field} ${action.value.$op} ${action.value.$value}`;
    } else {
      valueStr = JSON.stringify(action.value);
    }
    lines.push(`${indent}set ${action.field} = ${valueStr}`);
  } else if (action.type === 'call-operation') {
    // BUG-006 fix: render call-operation actions
    lines.push(`${indent}call-operation ${action.operation || '(unknown)'}`);
  } else if (action.type === 'emit-event') {
    // BUG-006 fix: render emit-event actions
    lines.push(`${indent}emit-event ${action.event || '(unknown)'}`);
  } else if (action.type === 'append' || action.type === 'remove') {
    // BUG-006 fix: render append/remove actions
    lines.push(`${indent}${action.type} ${action.field} ${JSON.stringify(action.value)}`);
  }
  // Render chained then actions for all action types
  if (action.then) {
    for (const t of action.then) {
      lines.push(formatAction(t, indent + '  '));
    }
  }
  return lines.join('\n');
}

function generateRuleStubs() {
  for (const rule of model.rules) {
    const ruleId = rule.id;
    const ruleName = rule.name;
    const entityRef = rule.entityRef;
    const intentRef = rule.intentRef;
    const scenarioRefs = rule.scenarioRefs || [];

    // ── Change A: block stub generation for unfilled rules ──
    const conditionNull = rule.condition === null || rule.condition === undefined;
    const actionNull = rule.action === null || rule.action === undefined;

    if (conditionNull || actionNull) {
      // Record gap flag — do NOT generate stub
      const missingSlots = [];
      if (conditionNull) missingSlots.push('condition');
      if (actionNull) missingSlots.push('action');

      gapFlags.push({
        type: 'UNFILLED_RULE',
        ruleId: ruleId,
        entityRef: entityRef,
        intentRef: intentRef,
        missingSlots: missingSlots,
        message: 'Rule has null condition or action — fill.js must run before codegen can generate this stub.',
        resolution: `Run: node fill.js templates/${ruleId}.fill-template.yaml then re-run codegen.`,
      });

      summary.rulesBlocked.push(ruleId);

      // Remove any previously generated stub file for this rule (clean slate)
      const stubPath = path.join(outputDir, 'rules', `${ruleId}.ts`);
      if (fs.existsSync(stubPath)) {
        fs.unlinkSync(stubPath);
      }

      continue; // skip stub generation
    }

    // BUG-007 fix: check _meta.status from filled template if --filled-dir was provided
    if (filledDirs.length > 0) {
      const templateInfo = filledTemplateStatus[ruleId];
      if (templateInfo) {
        if (templateInfo.status !== 'gate-passed-ready-for-codegen') {
          gapFlags.push({
            type: 'UNGATED_RULE',
            ruleId: ruleId,
            entityRef: entityRef,
            intentRef: intentRef,
            currentStatus: templateInfo.status,
            filledTemplate: templateInfo.file,
            message: 'Filled template has not passed the enforcement gate. Current status: ' + templateInfo.status,
            resolution: 'Run: node gate.js ' + templateInfo.file + ' --model <canonical-model.yaml> then re-run codegen.',
          });
          summary.rulesBlocked.push(ruleId);
          // Remove any previously generated stub file
          const stubPath = path.join(outputDir, 'rules', ruleId + '.ts');
          if (fs.existsSync(stubPath)) {
            fs.unlinkSync(stubPath);
          }
          continue; // skip stub generation for ungated rule
        }
      }
    }

    // ── Rule is fully specified — generate stub normally ──
    const lines = [];
    const entity = model.entities.find((e) => e.id === entityRef);
    const entityName = entity ? entity.name : toPascalCase(entityRef);

    // Pascal case function type name
    const fnTypeName = toPascalCase(ruleId) + 'Fn';

    lines.push(guardComment(version, 'ts'));
    lines.push('');
    lines.push(`// intentRef: ${intentRef}`);
    lines.push(`// canonicalModelVersion: ${version}`);
    lines.push(`// entityRef: ${entityRef}`);
    lines.push(`// scenarioRefs: [${scenarioRefs.join(', ')}]`);
    lines.push(`//`);
    lines.push(`// Canonical condition:`);
    lines.push(formatCondition(rule.condition, '//   '));
    lines.push(`//`);
    lines.push(`// Canonical action:`);
    lines.push(formatAction(rule.action, '//   '));
    lines.push(`//`);
    lines.push(`// IMPLEMENT THIS STUB in: src/rules/${ruleId}.ts`);
    lines.push(`// Do not modify this file. Changes here will be overwritten by codegen.`);
    lines.push('');
    lines.push(`import type { ${entityName} } from '../interfaces/${entityName}';`);
    lines.push('');
    lines.push(`export type ${fnTypeName} = (${toCamelCase(entityName)}: ${entityName}) => ${entityName};`);
    lines.push('');

    // Scenario descriptions
    lines.push(`// The implementation must satisfy these scenarios:`);
    for (const scenId of scenarioRefs) {
      const scenario = model.scenarios.find((s) => s.id === scenId);
      if (scenario) {
        let desc = '';
        if (scenario.fieldRefs && scenario.fieldRefs.length > 0) {
          const fieldParts = scenario.fieldRefs.map((fr) => `${fr.fieldId}=${fr.value}`);
          desc = ` — ${fieldParts.join(', ')}`;
        }
        lines.push(`// ✓ ${scenId}${' '.repeat(Math.max(1, 40 - scenId.length))}${desc}`);
      } else {
        lines.push(`// ✓ ${scenId}`);
      }
    }
    lines.push('');

    writeGenerated(path.join(outputDir, 'rules', `${ruleId}.ts`), lines.join('\n'));
    summary.rulesStubbed.push(ruleId);
  }
}

// ─── 6. Write gapflags.json ──────────────────────────────────────────────────

function writeGapFlags() {
  const gapFlagsDoc = {
    generatedAt: new Date().toISOString(),
    canonicalModelVersion: version,
    gapFlags: gapFlags,
  };

  const content = JSON.stringify(gapFlagsDoc, null, 2) + '\n';
  writeGenerated(path.join(outputDir, 'gapflags.json'), content);
}

// ─── Main execution ──────────────────────────────────────────────────────────

function main() {
  console.log(`\nDKCE codegen — reading ${modelPath}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Canonical model version: ${version}`);
  console.log('');

  // Generate in order: enums → interfaces → Prisma → OpenAPI → rules → gapflags
  console.log('1. Generating enums...');
  generateEnums();

  console.log('2. Generating TypeScript interfaces...');
  generateInterfaces();

  console.log('3. Generating Prisma schema...');
  generatePrisma();

  console.log('4. Generating OpenAPI spec...');
  generateOpenAPI();

  console.log('5. Generating rule stubs...');
  generateRuleStubs();

  console.log('6. Writing gapflags.json...');
  writeGapFlags();

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CODEGEN SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Files generated:    ${summary.filesGenerated}`);
  console.log(`  Entities covered:   ${summary.entitiesCovered.length} (${summary.entitiesCovered.join(', ')})`);
  console.log(`  Rules stubbed:      ${summary.rulesStubbed.length} (${summary.rulesStubbed.join(', ')})`);

  // ── Change C: print gap flag summary ──
  console.log('');
  console.log(`  Gap Flags: ${gapFlags.length}`);
  if (gapFlags.length > 0) {
    for (const gf of gapFlags) {
      if (gf.type === "UNFILLED_RULE") {
        console.log("    \u2717 " + gf.ruleId + " \u2014 " + gf.type + " (" + gf.missingSlots.join(", ") + ")");
      } else if (gf.type === "UNGATED_RULE") {
        console.log("    \u2717 " + gf.ruleId + " \u2014 " + gf.type + " (status: " + gf.currentStatus + ")");
      } else {
        console.log("    \u2717 " + gf.ruleId + " \u2014 " + gf.type);
      }
      console.log(`      Resolution: ${gf.resolution}`);
    }
    console.log('');
    console.log(`  Stub generation: BLOCKED for ${gapFlags.length} rule(s) until gaps are resolved.`);
  } else {
    console.log(`    — all rules fully specified.`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

main();
