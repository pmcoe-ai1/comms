#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// generate-immutable-triggers.js — DKCE Immutability Enforcement
// Reads a canonical model and generates PostgreSQL trigger SQL that prevents
// UPDATE on any field marked immutable: true.
//
// This closes Gap 8: immutability is compile-time only (TypeScript readonly).
// These triggers enforce immutability at the database level.
//
// Usage:
//   node generate-immutable-triggers.js <model.yaml> [--output <path>]
//   node generate-immutable-triggers.js <model.yaml> --apply  (applies directly to DATABASE_URL)
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── Load .env if present ────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toSnakeCase(str) {
  return str.replace(/[-]/g, '_').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function toPascalCase(str) {
  return str
    .split(/[-_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

// ── Main ────────────────────────────────────────────────────────────────────

function generateTriggerSQL(modelPath) {
  const content = fs.readFileSync(modelPath, 'utf8');
  const model = yaml.load(content);

  if (!model.entities || model.entities.length === 0) {
    console.error('No entities found in canonical model.');
    process.exit(1);
  }

  const version = model.meta?.version || 'unknown';
  const lines = [];

  lines.push('-- ─────────────────────────────────────────────────────────────────────────────');
  lines.push(`-- GENERATED: Immutability triggers for ${path.basename(modelPath)} v${version}`);
  lines.push('-- Source: generate-immutable-triggers.js');
  lines.push(`-- Generated at: ${new Date().toISOString()}`);
  lines.push('--');
  lines.push('-- These triggers enforce immutable: true fields at the database level.');
  lines.push('-- TypeScript readonly only prevents compile-time mutation.');
  lines.push('-- These triggers prevent runtime mutation via direct SQL or ORM bypass.');
  lines.push('-- ─────────────────────────────────────────────────────────────────────────────');
  lines.push('');

  // Generic trigger function (idempotent — CREATE OR REPLACE)
  lines.push('-- Generic immutability enforcement function');
  lines.push('-- Takes immutable column names as TG_ARGV and raises if any changed.');
  lines.push('CREATE OR REPLACE FUNCTION enforce_immutable_fields()');
  lines.push('RETURNS TRIGGER AS $$');
  lines.push('DECLARE');
  lines.push('  col_name TEXT;');
  lines.push('  old_val TEXT;');
  lines.push('  new_val TEXT;');
  lines.push('BEGIN');
  lines.push('  FOR i IN 0 .. TG_NARGS - 1 LOOP');
  lines.push('    col_name := TG_ARGV[i];');
  lines.push("    EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', col_name, col_name)");
  lines.push('      USING OLD, NEW');
  lines.push('      INTO old_val, new_val;');
  lines.push('    IF old_val IS DISTINCT FROM new_val THEN');
  lines.push("      RAISE EXCEPTION 'IMMUTABLE_FIELD_VIOLATION: Cannot update immutable field \"%.%\" (old=%, new=%)',");
  lines.push('        TG_TABLE_NAME, col_name, old_val, new_val;');
  lines.push('    END IF;');
  lines.push('  END LOOP;');
  lines.push('  RETURN NEW;');
  lines.push('END;');
  lines.push('$$ LANGUAGE plpgsql;');
  lines.push('');

  let triggerCount = 0;
  let fieldCount = 0;

  for (const entity of model.entities) {
    const immutableFields = (entity.fields || []).filter(f => f.immutable === true);
    if (immutableFields.length === 0) continue;

    const tableName = toPascalCase(entity.id);
    const triggerName = `trg_immutable_${toSnakeCase(entity.id)}`;
    const columnArgs = immutableFields.map(f => `'${f.name}'`).join(', ');

    lines.push(`-- Entity: ${entity.name} (${entity.id})`);
    lines.push(`-- Immutable fields: ${immutableFields.map(f => f.name).join(', ')}`);
    lines.push(`DROP TRIGGER IF EXISTS ${triggerName} ON "${tableName}";`);
    lines.push(`CREATE TRIGGER ${triggerName}`);
    lines.push(`  BEFORE UPDATE ON "${tableName}"`);
    lines.push(`  FOR EACH ROW`);
    lines.push(`  EXECUTE FUNCTION enforce_immutable_fields(${columnArgs});`);
    lines.push('');

    triggerCount++;
    fieldCount += immutableFields.length;
  }

  lines.push(`-- Summary: ${triggerCount} triggers for ${model.entities.length} entities`);
  lines.push(`-- Total immutable fields enforced: ${fieldCount}`);

  return lines.join('\n');
}

// ── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const modelPath = args[0];

  if (!modelPath) {
    console.log('Usage:');
    console.log('  node generate-immutable-triggers.js <model.yaml> [--output <path>]');
    console.log('  node generate-immutable-triggers.js <model.yaml> --apply');
    process.exit(1);
  }

  if (!fs.existsSync(modelPath)) {
    console.error(`Model file not found: ${modelPath}`);
    process.exit(1);
  }

  const sql = generateTriggerSQL(modelPath);

  const outputIdx = args.indexOf('--output');
  const applyFlag = args.includes('--apply');

  if (outputIdx !== -1 && args[outputIdx + 1]) {
    const outputPath = args[outputIdx + 1];
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, sql);
    console.log(`✓ Trigger SQL written to ${outputPath}`);
  } else if (applyFlag) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      console.error('ERROR: DATABASE_URL not set for --apply mode.');
      process.exit(1);
    }
    const { Client } = require('pg');
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('railway') || DATABASE_URL.includes('neon') || DATABASE_URL.includes('supabase')
        ? { rejectUnauthorized: false }
        : undefined,
    });
    try {
      await client.connect();
      await client.query(sql);
      console.log('✓ Immutability triggers applied to database');
    } finally {
      await client.end();
    }
  } else {
    // Output to stdout
    console.log(sql);
  }
}

main();
