#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// oasdiff-check.js — DKCE Breaking Change Detector (Gap 7)
// Compares current generated OpenAPI specs against the last committed versions
// in git using openapi-diff (pure JS — no Go binary required).
//
// Usage:
//   node oasdiff-check.js                          # checks both domains
//   node oasdiff-check.js --domain order-management
//   node oasdiff-check.js --domain subscription-billing
// ─────────────────────────────────────────────────────────────────────────────

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Domain configuration ────────────────────────────────────────────────────

const DOMAINS = {
  'order-management': {
    specPath: 'generated/openapi/openapi.yaml',
    label: 'order-management',
  },
  'subscription-billing': {
    specPath: 'generated-subscription/openapi/openapi.yaml',
    label: 'subscription-billing',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the base spec content from git HEAD.
 * Returns null if the file is not tracked in git (first run).
 */
function getBaseSpecFromGit(specPath) {
  try {
    const content = execSync(`git show HEAD:${specPath}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return content;
  } catch {
    // File not tracked in git — first run
    return null;
  }
}

/**
 * Run openapi-diff comparing base → revision.
 * Returns the diff result object.
 */
async function diffSpecs(baseContent, revisionContent) {
  // openapi-diff expects file paths or inline specs
  // Write base to a temp file since it comes from git
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const basePath = path.join(tmpDir, '_oasdiff_base.yaml');
  const revPath = path.join(tmpDir, '_oasdiff_revision.yaml');

  try {
    fs.writeFileSync(basePath, baseContent);
    fs.writeFileSync(revPath, revisionContent);

    const openApiDiff = require('openapi-diff');
    const result = await openApiDiff.diffSpecs({
      sourceSpec: {
        content: baseContent,
        location: basePath,
        format: 'openapi3',
      },
      destinationSpec: {
        content: revisionContent,
        location: revPath,
        format: 'openapi3',
      },
    });

    return result;
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(basePath); } catch {}
    try { fs.unlinkSync(revPath); } catch {}
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function checkDomain(domainKey) {
  const domain = DOMAINS[domainKey];
  if (!domain) {
    console.error(`Unknown domain: ${domainKey}`);
    console.error(`Available: ${Object.keys(DOMAINS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n─── Checking ${domain.label} ───`);

  // Check if revision spec exists on disk
  const revisionPath = path.join(__dirname, domain.specPath);
  if (!fs.existsSync(revisionPath)) {
    console.log(`  ⚠ Spec not found on disk: ${domain.specPath} — skipping`);
    return { domain: domainKey, status: 'skipped', reason: 'no-spec-on-disk' };
  }

  // Get base from git
  const baseContent = getBaseSpecFromGit(domain.specPath);
  if (baseContent === null) {
    console.log(`  ⚠ No previous spec in git — first run, skipping diff`);
    return { domain: domainKey, status: 'skipped', reason: 'first-run' };
  }

  // Get revision from disk
  const revisionContent = fs.readFileSync(revisionPath, 'utf8');

  // Quick check — if identical, no diff needed
  if (baseContent === revisionContent) {
    console.log(`  ✓ No changes detected`);
    return { domain: domainKey, status: 'no-changes' };
  }

  // Run diff
  const result = await diffSpecs(baseContent, revisionContent);

  // Analyze results
  const breakingDifferences = result.breakingDifferencesFound;

  if (breakingDifferences) {
    console.log(`  ✗ BREAKING CHANGES DETECTED:`);
    if (result.breakingDifferences) {
      for (const diff of result.breakingDifferences) {
        console.log(`    • [${diff.type}] ${diff.action} ${diff.sourceSpecEntityDetails && diff.sourceSpecEntityDetails.length > 0 ? diff.sourceSpecEntityDetails.map(d => d.location).join(', ') : ''}`);
        if (diff.details) {
          for (const detail of diff.details) {
            console.log(`      → ${detail}`);
          }
        }
      }
    }
    return { domain: domainKey, status: 'breaking', differences: result.breakingDifferences };
  }

  // Non-breaking changes
  const nonBreaking = result.nonBreakingDifferences || [];
  const unclassified = result.unclassifiedDifferences || [];

  if (nonBreaking.length > 0 || unclassified.length > 0) {
    console.log(`  ✓ Non-breaking changes detected (${nonBreaking.length} non-breaking, ${unclassified.length} unclassified)`);
    for (const diff of nonBreaking) {
      console.log(`    • [non-breaking] ${diff.type}: ${diff.action}`);
    }
    for (const diff of unclassified) {
      console.log(`    • [unclassified] ${diff.type}: ${diff.action}`);
    }
  } else {
    console.log(`  ✓ No changes detected`);
  }

  return { domain: domainKey, status: 'ok', nonBreaking: nonBreaking.length, unclassified: unclassified.length };
}

async function main() {
  const args = process.argv.slice(2);
  const domainIdx = args.indexOf('--domain');
  const selectedDomain = domainIdx !== -1 ? args[domainIdx + 1] : null;

  console.log('═══ DKCE OpenAPI Breaking Change Check (Gap 7) ═══');

  const domainsToCheck = selectedDomain
    ? [selectedDomain]
    : Object.keys(DOMAINS);

  const results = [];
  let hasBreaking = false;

  for (const domainKey of domainsToCheck) {
    try {
      const result = await checkDomain(domainKey);
      results.push(result);
      if (result.status === 'breaking') hasBreaking = true;
    } catch (err) {
      console.error(`  ✗ Error checking ${domainKey}: ${err.message}`);
      results.push({ domain: domainKey, status: 'error', error: err.message });
      hasBreaking = true;
    }
  }

  // Summary
  console.log('\n═══ Summary ═══');
  for (const r of results) {
    const icon = r.status === 'breaking' ? '✗' : r.status === 'error' ? '✗' : '✓';
    console.log(`  ${icon} ${r.domain}: ${r.status}`);
  }

  if (hasBreaking) {
    console.log('\n✗ BREAKING CHANGES FOUND — review before merging');
    process.exit(1);
  } else {
    console.log('\n✓ No breaking changes');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
