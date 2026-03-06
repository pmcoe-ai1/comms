// ---------------------------------------------------------------------------
// TASK-05: OpenAPI spec validation tests
//
// Validates both generated OpenAPI specs using swagger-cli validate
// (subprocess) plus structural assertions.
//
// Specs validated:
//   - generated/openapi/openapi.yaml        (order-management)
//   - generated-subscription/openapi/openapi.yaml (subscription-billing)
// ---------------------------------------------------------------------------

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// js-yaml has no @types installed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

// -- Paths ------------------------------------------------------------------

const ORDER_SPEC = path.resolve(__dirname, '../../generated/openapi/openapi.yaml');
const SUB_SPEC = path.resolve(__dirname, '../../generated-subscription/openapi/openapi.yaml');
const SWAGGER_CLI = path.resolve(__dirname, '../../node_modules/.bin/swagger-cli');

// -- Helpers ----------------------------------------------------------------

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, unknown>; security?: unknown[] }>>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

function loadSpec(specPath: string): OpenAPISpec {
  const content = fs.readFileSync(specPath, 'utf8');
  return yaml.load(content) as OpenAPISpec;
}

function getOperationIds(spec: OpenAPISpec): string[] {
  const ids: string[] = [];
  for (const pathObj of Object.values(spec.paths)) {
    for (const methodObj of Object.values(pathObj)) {
      if (typeof methodObj === 'object' && methodObj !== null && 'operationId' in methodObj) {
        const op = methodObj as { operationId?: string };
        if (op.operationId) ids.push(op.operationId);
      }
    }
  }
  return ids;
}

function getSchemaRefs(spec: OpenAPISpec): string[] {
  const refs: string[] = [];
  function walk(obj: unknown): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    const record = obj as Record<string, unknown>;
    if (typeof record['$ref'] === 'string') refs.push(record['$ref']);
    Object.values(record).forEach(walk);
  }
  walk(spec.paths);
  return refs;
}

function validateWithSwaggerCli(specPath: string): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`"${SWAGGER_CLI}" validate "${specPath}"`, {
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
  }
}

// -- Tests ------------------------------------------------------------------

describe('OpenAPI spec validation (TASK-05)', () => {
  jest.setTimeout(30_000);

  describe('order-management spec', () => {
    it('spec file exists', () => {
      expect(fs.existsSync(ORDER_SPEC)).toBe(true);
    });

    it('passes swagger-cli validate', () => {
      const result = validateWithSwaggerCli(ORDER_SPEC);
      expect(result.stdout + result.stderr).not.toContain('error');
      expect(result.exitCode).toBe(0);
    });

    it('declares OpenAPI version 3.1.0', () => {
      const spec = loadSpec(ORDER_SPEC);
      expect(spec.openapi).toBe('3.1.0');
    });

    it('has correct title and version', () => {
      const spec = loadSpec(ORDER_SPEC);
      expect(spec.info.title).toBe('order-management API');
      expect(spec.info.version).toBe('1.1.0');
    });

    it('has at least one path defined', () => {
      const spec = loadSpec(ORDER_SPEC);
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });

    it('has unique operationIds', () => {
      const spec = loadSpec(ORDER_SPEC);
      const ids = getOperationIds(spec);
      expect(ids.length).toBeGreaterThan(0);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('all $ref targets resolve to defined schemas', () => {
      const spec = loadSpec(ORDER_SPEC);
      const refs = getSchemaRefs(spec);
      const schemaNames = Object.keys(spec.components?.schemas ?? {});
      for (const ref of refs) {
        const match = ref.match(/^#\/components\/schemas\/(.+)$/);
        if (match) {
          expect(schemaNames).toContain(match[1]);
        }
      }
    });

    it('all operations have security defined', () => {
      const spec = loadSpec(ORDER_SPEC);
      for (const [pathKey, pathObj] of Object.entries(spec.paths)) {
        for (const [method, methodObj] of Object.entries(pathObj)) {
          if (typeof methodObj === 'object' && methodObj !== null && 'operationId' in methodObj) {
            const op = methodObj as { security?: unknown[]; operationId?: string };
            expect(op.security).toBeDefined();
            expect(Array.isArray(op.security)).toBe(true);
          }
        }
      }
    });

    it('has expected operations from canonical model', () => {
      const spec = loadSpec(ORDER_SPEC);
      const ids = getOperationIds(spec);
      // These operations are defined in example.canonical-model.yaml
      expect(ids).toContain('applyDiscountToOrder');
      expect(ids).toContain('confirmOrder');
      expect(ids).toContain('addOrderItem');
      expect(ids).toContain('listOrders');
      expect(ids).toContain('cancelOrder');
    });

    it('has securitySchemes defined', () => {
      const spec = loadSpec(ORDER_SPEC);
      expect(spec.components?.securitySchemes).toBeDefined();
      expect(spec.components?.securitySchemes).toHaveProperty('bearerAuth');
    });
  });

  describe('subscription-billing spec', () => {
    it('spec file exists', () => {
      expect(fs.existsSync(SUB_SPEC)).toBe(true);
    });

    it('passes swagger-cli validate', () => {
      const result = validateWithSwaggerCli(SUB_SPEC);
      expect(result.stdout + result.stderr).not.toContain('error');
      expect(result.exitCode).toBe(0);
    });

    it('declares OpenAPI version 3.1.0', () => {
      const spec = loadSpec(SUB_SPEC);
      expect(spec.openapi).toBe('3.1.0');
    });

    it('has correct title and version', () => {
      const spec = loadSpec(SUB_SPEC);
      expect(spec.info.title).toBe('subscription-billing API');
      expect(spec.info.version).toBe('1.1.0');
    });

    it('has at least one path defined', () => {
      const spec = loadSpec(SUB_SPEC);
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });

    it('has unique operationIds', () => {
      const spec = loadSpec(SUB_SPEC);
      const ids = getOperationIds(spec);
      expect(ids.length).toBeGreaterThan(0);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('all $ref targets resolve to defined schemas', () => {
      const spec = loadSpec(SUB_SPEC);
      const refs = getSchemaRefs(spec);
      const schemaNames = Object.keys(spec.components?.schemas ?? {});
      for (const ref of refs) {
        const match = ref.match(/^#\/components\/schemas\/(.+)$/);
        if (match) {
          expect(schemaNames).toContain(match[1]);
        }
      }
    });

    it('all operations have security defined', () => {
      const spec = loadSpec(SUB_SPEC);
      for (const [pathKey, pathObj] of Object.entries(spec.paths)) {
        for (const [method, methodObj] of Object.entries(pathObj)) {
          if (typeof methodObj === 'object' && methodObj !== null && 'operationId' in methodObj) {
            const op = methodObj as { security?: unknown[]; operationId?: string };
            expect(op.security).toBeDefined();
            expect(Array.isArray(op.security)).toBe(true);
          }
        }
      }
    });

    it('has expected operations from canonical model', () => {
      const spec = loadSpec(SUB_SPEC);
      const ids = getOperationIds(spec);
      // These operations are defined in subscription-billing.canonical-model.yaml
      expect(ids).toContain('subscribeToPlan');
      expect(ids).toContain('renewSubscription');
      expect(ids).toContain('cancelSubscription');
    });

    it('has securitySchemes defined', () => {
      const spec = loadSpec(SUB_SPEC);
      expect(spec.components?.securitySchemes).toBeDefined();
      expect(spec.components?.securitySchemes).toHaveProperty('bearerAuth');
    });
  });
});
