#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// chain.js — DKCE Pipeline Audit Trail
// Append-only PostgreSQL hash chain with SHA-256.
// Foundation of FABRIC's audit trail.
//
// Schema: pipeline_run { id, stage, canonicalModelHash, prevHash, artifactHash,
//         timestamp, status }
//
// Usage:
//   node chain.js init                            — create table if not exists
//   node chain.js record <stage> <modelFile> <artifactDir> [--status pass|fail]
//   node chain.js verify                          — verify entire chain integrity
//   node chain.js history [--limit N]              — show recent pipeline runs
// ─────────────────────────────────────────────────────────────────────────────

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Set it in .env or environment.');
  process.exit(1);
}

// ── SQL ─────────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS pipeline_run (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage               TEXT NOT NULL,
  canonical_model_hash TEXT NOT NULL,
  prev_hash           TEXT,
  artifact_hash       TEXT NOT NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  model_version       TEXT,
  model_file          TEXT,
  artifact_dir        TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_recorded_at ON pipeline_run (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_run_stage ON pipeline_run (stage);
`;

// ── Hashing ─────────────────────────────────────────────────────────────────

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hashDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  const hash = crypto.createHash('sha256');
  const files = collectFiles(dirPath).sort();
  for (const file of files) {
    const relPath = path.relative(dirPath, file);
    hash.update(relPath);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function collectFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

// Compute chain hash: SHA-256(prevHash + canonicalModelHash + artifactHash + stage + status)
function computeChainHash(prevHash, canonicalModelHash, artifactHash, stage, status) {
  const payload = [prevHash || 'GENESIS', canonicalModelHash, artifactHash, stage, status].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ── Database helpers ────────────────────────────────────────────────────────

function createClient() {
  return new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') || DATABASE_URL.includes('neon') || DATABASE_URL.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

// ── Commands ────────────────────────────────────────────────────────────────

async function cmdInit() {
  const client = createClient();
  try {
    await client.connect();
    await client.query(CREATE_TABLE_SQL);
    console.log('✓ pipeline_run table created (or already exists)');
  } finally {
    await client.end();
  }
}

async function cmdRecord(stage, modelFile, artifactDir, status) {
  if (!stage) { console.error('Usage: node chain.js record <stage> <modelFile> <artifactDir> [--status pass|fail]'); process.exit(1); }
  if (!modelFile || !fs.existsSync(modelFile)) { console.error(`Model file not found: ${modelFile}`); process.exit(1); }
  if (!artifactDir || !fs.existsSync(artifactDir)) { console.error(`Artifact directory not found: ${artifactDir}`); process.exit(1); }
  if (!['pass', 'fail'].includes(status)) { console.error('Status must be pass or fail'); process.exit(1); }

  const canonicalModelHash = hashFile(modelFile);
  const artifactHash = hashDirectory(artifactDir);

  // Read model version from YAML header
  let modelVersion = null;
  try {
    const content = fs.readFileSync(modelFile, 'utf8');
    const match = content.match(/version:\s*["']?([\d.]+)["']?/);
    if (match) modelVersion = match[1];
  } catch (e) { /* ignore */ }

  const client = createClient();
  try {
    await client.connect();

    // Get previous hash (most recent record)
    const prevResult = await client.query(
      'SELECT artifact_hash FROM pipeline_run ORDER BY recorded_at DESC LIMIT 1'
    );
    const prevHash = prevResult.rows.length > 0 ? prevResult.rows[0].artifact_hash : null;

    // Compute chain hash that links to prevHash
    const chainHash = computeChainHash(prevHash, canonicalModelHash, artifactHash, stage, status);

    const insertResult = await client.query(
      `INSERT INTO pipeline_run (stage, canonical_model_hash, prev_hash, artifact_hash, status, model_version, model_file, artifact_dir)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, recorded_at`,
      [stage, canonicalModelHash, prevHash, chainHash, status, modelVersion, modelFile, artifactDir]
    );

    const row = insertResult.rows[0];
    console.log(`✓ Pipeline run recorded`);
    console.log(`  id:                  ${row.id}`);
    console.log(`  stage:               ${stage}`);
    console.log(`  status:              ${status}`);
    console.log(`  canonicalModelHash:  ${canonicalModelHash.substring(0, 16)}...`);
    console.log(`  artifactHash:        ${chainHash.substring(0, 16)}...`);
    console.log(`  prevHash:            ${prevHash ? prevHash.substring(0, 16) + '...' : 'GENESIS'}`);
    console.log(`  modelVersion:        ${modelVersion || 'unknown'}`);
    console.log(`  recordedAt:          ${row.recorded_at}`);
  } finally {
    await client.end();
  }
}

async function cmdVerify() {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.query(
      'SELECT id, stage, canonical_model_hash, prev_hash, artifact_hash, recorded_at, status FROM pipeline_run ORDER BY recorded_at ASC'
    );

    if (result.rows.length === 0) {
      console.log('No pipeline runs recorded. Chain is empty.');
      return;
    }

    let valid = true;

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const expectedPrevHash = i === 0 ? null : result.rows[i - 1].artifact_hash;

      if (row.prev_hash !== expectedPrevHash) {
        console.error(`✗ CHAIN BREAK at record ${i + 1} (id: ${row.id})`);
        console.error(`  Expected prevHash: ${expectedPrevHash ? expectedPrevHash.substring(0, 16) + '...' : 'null'}`);
        console.error(`  Actual prevHash:   ${row.prev_hash ? row.prev_hash.substring(0, 16) + '...' : 'null'}`);
        valid = false;
      }
    }

    if (valid) {
      console.log(`✓ Chain integrity verified — ${result.rows.length} records, no breaks`);
    } else {
      console.error('✗ Chain integrity FAILED — breaks detected');
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

async function cmdHistory(limit) {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.query(
      'SELECT id, stage, canonical_model_hash, prev_hash, artifact_hash, recorded_at, status, model_version FROM pipeline_run ORDER BY recorded_at DESC LIMIT $1',
      [limit]
    );

    if (result.rows.length === 0) {
      console.log('No pipeline runs recorded.');
      return;
    }

    console.log(`Pipeline run history (most recent ${result.rows.length}):`)
    console.log('─'.repeat(100));
    for (const row of result.rows) {
      console.log(`  ${row.recorded_at.toISOString()}  ${row.status.toUpperCase().padEnd(5)}  ${row.stage.padEnd(20)}  v${row.model_version || '?'}  ${row.artifact_hash.substring(0, 12)}...  prev:${row.prev_hash ? row.prev_hash.substring(0, 12) + '...' : 'GENESIS'}`);
    }
    console.log('─'.repeat(100));
  } finally {
    await client.end();
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'init':
        await cmdInit();
        break;
      case 'record': {
        const stage = args[1];
        const modelFile = args[2];
        const artifactDir = args[3];
        const statusIdx = args.indexOf('--status');
        const status = statusIdx !== -1 ? args[statusIdx + 1] : 'pass';
        await cmdRecord(stage, modelFile, artifactDir, status);
        break;
      }
      case 'verify':
        await cmdVerify();
        break;
      case 'history': {
        const limitIdx = args.indexOf('--limit');
        const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 20;
        await cmdHistory(limit);
        break;
      }
      default:
        console.log('Usage:');
        console.log('  node chain.js init                                          — create pipeline_run table');
        console.log('  node chain.js record <stage> <modelFile> <artifactDir> [--status pass|fail]  — record a pipeline run');
        console.log('  node chain.js verify                                        — verify chain integrity');
        console.log('  node chain.js history [--limit N]                           — show recent runs');
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
