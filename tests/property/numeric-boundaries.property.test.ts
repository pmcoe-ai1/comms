// ---------------------------------------------------------------------------
// TASK-04: Property-based tests for numeric condition boundaries
//
// Tests that gate.js Pass 1 glossary precision checker correctly enforces
// numeric ranges defined in canonical model glossary terms.
//
// Uses fast-check to generate random values within and outside glossary
// precision ranges, then verifies gate.js produces correct errors/passes.
//
// Each test spawns gate.js as a subprocess with a minimal filled template.
// This is an integration test: it exercises the real gate.js code path.
// ---------------------------------------------------------------------------

import * as fc from 'fast-check';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// js-yaml has no @types installed — use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

// -- Paths ------------------------------------------------------------------

const GATE_JS = path.resolve(__dirname, '../../gate.js');
const ORDER_MODEL = path.resolve(__dirname, '../../files/example.canonical-model.yaml');
const SUB_MODEL = path.resolve(__dirname, '../../files/subscription-billing.canonical-model.yaml');

// -- Boundary specifications ------------------------------------------------
// Each entry maps a field with a glossaryRef to its glossary precision range.

interface BoundarySpec {
  name: string;
  modelPath: string;
  canonicalModelId: string;
  ruleId: string;
  entityId: string;
  fieldId: string;
  fieldType: 'integer' | 'decimal';
  operator: string;
  glossaryId: string;
  glossaryMin: number;
  glossaryMax: number;
  fieldValidationMax?: number;
}

const BOUNDARIES: BoundarySpec[] = [
  {
    name: 'order-item.quantity',
    modelPath: ORDER_MODEL,
    canonicalModelId: '550e8400-e29b-41d4-a716-446655440000',
    ruleId: 'check-stock-on-add-item',
    entityId: 'order-item',
    fieldId: 'quantity',
    fieldType: 'integer',
    operator: 'gte',
    glossaryId: 'order-item-quantity',
    glossaryMin: 1,
    glossaryMax: 9999,
  },
  {
    name: 'order.total',
    modelPath: ORDER_MODEL,
    canonicalModelId: '550e8400-e29b-41d4-a716-446655440000',
    ruleId: 'apply-high-value-discount',
    entityId: 'order',
    fieldId: 'total',
    fieldType: 'decimal',
    operator: 'gte',
    glossaryId: 'order-total',
    glossaryMin: 0,
    glossaryMax: 999999.99,
  },
  {
    name: 'order.discount',
    modelPath: ORDER_MODEL,
    canonicalModelId: '550e8400-e29b-41d4-a716-446655440000',
    ruleId: 'apply-high-value-discount',
    entityId: 'order',
    fieldId: 'discount',
    fieldType: 'decimal',
    operator: 'gte',
    glossaryId: 'discount',
    glossaryMin: 0,
    glossaryMax: 999999.99,
  },
  {
    name: 'subscription.dunning-attempts',
    modelPath: SUB_MODEL,
    canonicalModelId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    ruleId: 'handle-dunning-retry',
    entityId: 'subscription',
    fieldId: 'dunning-attempts',
    fieldType: 'integer',
    operator: 'gte',
    glossaryId: 'dunning',
    glossaryMin: 0,
    glossaryMax: 4,
    fieldValidationMax: 3,
  },
];

// -- Helpers ----------------------------------------------------------------

function buildTemplate(spec: BoundarySpec, value: number): string {
  return yaml.dump({
    _meta: {
      canonicalModelId: spec.canonicalModelId,
      ruleId: spec.ruleId,
      generatedBy: 'property-test',
      status: 'filled-pending-gate',
    },
    context: {
      entity: { id: spec.entityId },
    },
    fill: {
      condition: {
        field: spec.fieldId,
        operator: spec.operator,
        value: value,
      },
      action: null,
      elseAction: null,
    },
  }, { noRefs: true });
}

interface GateResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runGate(templateYaml: string, modelPath: string): GateResult {
  const tmpFile = path.join(
    '/tmp',
    `gate-prop-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`
  );
  fs.writeFileSync(tmpFile, templateYaml);
  try {
    const stdout = execSync(`node "${GATE_JS}" "${tmpFile}" --model "${modelPath}"`, {
      encoding: 'utf8',
      timeout: 15000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}

function hasGlossaryError(stdout: string): boolean {
  return stdout.includes('outside glossary precision range');
}

function hasFieldValidationError(stdout: string): boolean {
  return stdout.includes('exceeds maximum') || stdout.includes('below minimum');
}

// -- Generator helpers ------------------------------------------------------

function inRangeArb(spec: BoundarySpec): fc.Arbitrary<number> {
  if (spec.fieldType === 'integer') {
    return fc.integer({ min: Math.ceil(spec.glossaryMin), max: Math.floor(spec.glossaryMax) });
  }
  return fc.double({ min: spec.glossaryMin, max: spec.glossaryMax, noNaN: true });
}

function belowMinArb(spec: BoundarySpec): fc.Arbitrary<number> | null {
  if (spec.fieldType === 'integer') {
    const maxBelow = Math.ceil(spec.glossaryMin) - 1;
    if (maxBelow < -1000000) return null;
    return fc.integer({ min: maxBelow - 1000, max: maxBelow });
  }
  const maxBelow = spec.glossaryMin - 0.01;
  if (maxBelow < -1000000) return null;
  return fc.double({ min: spec.glossaryMin - 1000, max: maxBelow, noNaN: true });
}

function aboveMaxArb(spec: BoundarySpec): fc.Arbitrary<number> {
  if (spec.fieldType === 'integer') {
    const minAbove = Math.floor(spec.glossaryMax) + 1;
    return fc.integer({ min: minAbove, max: minAbove + 1000 });
  }
  return fc.double({
    min: spec.glossaryMax + 0.01,
    max: spec.glossaryMax + 1000,
    noNaN: true,
  });
}

// -- Tests ------------------------------------------------------------------

const NUM_RUNS = 10; // keep low - each run spawns a gate.js subprocess

describe('Glossary precision boundary property tests (TASK-04)', () => {
  // Increase timeout: subprocess-based tests are slower than in-process
  jest.setTimeout(120_000);

  for (const spec of BOUNDARIES) {
    describe(`${spec.name} (glossary: ${spec.glossaryId}, range: [${spec.glossaryMin}, ${spec.glossaryMax}])`, () => {

      it('accepts exact minimum boundary value', () => {
        const result = runGate(buildTemplate(spec, spec.glossaryMin), spec.modelPath);
        expect(hasGlossaryError(result.stdout)).toBe(false);
      });

      it('accepts exact maximum boundary value', () => {
        const result = runGate(buildTemplate(spec, spec.glossaryMax), spec.modelPath);
        expect(hasGlossaryError(result.stdout)).toBe(false);
      });

      it('accepts values within glossary range (property)', () => {
        fc.assert(
          fc.property(inRangeArb(spec), (value) => {
            const result = runGate(buildTemplate(spec, value), spec.modelPath);
            return !hasGlossaryError(result.stdout);
          }),
          { numRuns: NUM_RUNS },
        );
      });

      const belowArb = belowMinArb(spec);
      if (belowArb) {
        it('rejects values below glossary minimum (property)', () => {
          fc.assert(
            fc.property(belowArb, (value) => {
              const result = runGate(buildTemplate(spec, value), spec.modelPath);
              return hasGlossaryError(result.stdout);
            }),
            { numRuns: NUM_RUNS },
          );
        });
      }

      it('rejects values above glossary maximum (property)', () => {
        fc.assert(
          fc.property(aboveMaxArb(spec), (value) => {
            const result = runGate(buildTemplate(spec, value), spec.modelPath);
            return hasGlossaryError(result.stdout);
          }),
          { numRuns: NUM_RUNS },
        );
      });
    });
  }

  // -- Consistency test (BUG-018 resolved) -----------------------------------
  // dunning-attempts: field validation.max=4 and glossary precision.max=4
  // Previously inconsistent (field max=3, glossary max=4). Fixed by BUG-018.

  describe('dunning-attempts: validation/glossary consistency (BUG-018 resolved)', () => {
    const dunning = BOUNDARIES.find(b => b.glossaryId === 'dunning')!;

    it('value 4 passes both glossary check (max=4) and field validation (max=4)', () => {
      const result = runGate(buildTemplate(dunning, 4), dunning.modelPath);
      // Both glossary and field validation max=4: value 4 is within range
      expect(hasGlossaryError(result.stdout)).toBe(false);
      expect(hasFieldValidationError(result.stdout)).toBe(false);
    });

    it('value 3 passes both glossary check and field validation', () => {
      const result = runGate(buildTemplate(dunning, 3), dunning.modelPath);
      expect(hasGlossaryError(result.stdout)).toBe(false);
      expect(hasFieldValidationError(result.stdout)).toBe(false);
    });

    it('value 5 fails both glossary check (max=4) and field validation (max=4)', () => {
      const result = runGate(buildTemplate(dunning, 5), dunning.modelPath);
      expect(hasGlossaryError(result.stdout)).toBe(true);
      expect(hasFieldValidationError(result.stdout)).toBe(true);
    });
  });
});
