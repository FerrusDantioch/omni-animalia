#!/usr/bin/env node
/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Opaque-box E2E CLI runner & reporter for omni-animalia */
'use strict';

const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('./server');
const { launchBrowser, withAppContext } = require('./helpers');

const VALID_TIERS = [1, 2, 3, 4];

function parseArgs(argv) {
  const opts = {
    tiers: null,
    filter: null,
    json: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg.startsWith('--tier=')) {
      const raw = arg.slice('--tier='.length).trim();
      if (!raw) {
        throw new Error('Empty --tier value. Expected 1, 2, 3, 4 or comma-separated list.');
      }
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      const parsed = [];
      for (const p of parts) {
        if (!/^\d+$/.test(p)) {
          throw new Error(`Invalid tier number "${p}". Expected 1..4.`);
        }
        const n = Number(p);
        if (!VALID_TIERS.includes(n)) {
          throw new Error(`Unsupported tier "${n}". Expected 1..4.`);
        }
        if (!parsed.includes(n)) parsed.push(n);
      }
      opts.tiers = parsed;
    } else if (arg.startsWith('--filter=')) {
      opts.filter = arg.slice('--filter='.length).trim().toLowerCase();
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  return opts;
}

function loadTiers(requestedTiers) {
  const explicit = Array.isArray(requestedTiers);
  const targets = explicit ? requestedTiers : VALID_TIERS;
  const loaded = [];

  for (const tierNum of targets) {
    const modPath = path.join(__dirname, `tier${tierNum}.js`);
    if (!fs.existsSync(modPath)) {
      if (explicit) {
        throw new Error(`Requested tier ${tierNum} module not found: ${modPath}`);
      }
      continue;
    }
    const mod = require(modPath);
    if (!mod || !Array.isArray(mod.tests)) {
      throw new Error(`Invalid tier module ${modPath}: expected { tier, name, tests: [...] }`);
    }
    loaded.push({
      tier: mod.tier || tierNum,
      name: mod.name || `Tier ${tierNum}`,
      tests: mod.tests,
    });
  }

  if (!loaded.length) {
    throw new Error('No tier test modules found in tests/e2e/.');
  }
  return loaded;
}

function formatSummaryLine(label, stats) {
  return `  ${label.padEnd(10)} total=${stats.total}  passed=${stats.passed}  failed=${stats.failed}  duration=${stats.durationMs}ms`;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
    return;
  }

  if (opts.help) {
    console.log('Usage: node tests/e2e/runner.js [--tier=1|2|3|4|1,2] [--filter=<substr>] [--json]');
    process.exit(0);
    return;
  }

  let tierModules;
  try {
    tierModules = loadTiers(opts.tiers);
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ error: err.message, summary: { total: 0, passed: 0, failed: 0 } }, null, 2));
    } else {
      console.error(`[ERROR] ${err.message}`);
    }
    process.exit(1);
    return;
  }

  const plan = [];
  for (const tm of tierModules) {
    for (const test of tm.tests) {
      if (opts.filter) {
        const hay = `${test.id} ${test.feature} ${test.title}`.toLowerCase();
        if (!hay.includes(opts.filter)) continue;
      }
      plan.push({ tier: tm.tier, tierName: tm.name, test });
    }
  }

  if (!plan.length) {
    const msg = opts.filter
      ? `No tests matched filter "${opts.filter}".`
      : 'No tests found to run.';
    if (opts.json) {
      console.log(JSON.stringify({ error: msg, summary: { total: 0, passed: 0, failed: 0 } }, null, 2));
    } else {
      console.error(`[ERROR] ${msg}`);
    }
    process.exit(1);
    return;
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  let server = null;
  let browser = null;

  const results = [];
  const tierStats = {};
  const featureStats = {};

  const startAll = Date.now();

  try {
    server = await startStaticServer(repoRoot);
    browser = await launchBrowser();

    if (!opts.json) {
      console.log(`Static server listening at ${server.url}`);
      console.log(`Executing ${plan.length} E2E test(s)...\n`);
    }

    for (const item of plan) {
      const { tier, tierName, test } = item;
      const tStart = Date.now();
      let passed = false;
      let errorInfo = null;

      try {
        await withAppContext(
          browser,
          server.url,
          async (ctx) => {
            await test.run(ctx);
            if (!test.skipAutoRuntimeCheck) {
              await ctx.assertNoRuntimeErrors(test.runtimeCheckOptions || {});
            }
          },
          test.options || {}
        );
        passed = true;
      } catch (err) {
        passed = false;
        errorInfo = {
          message: err && err.message ? err.message : String(err),
          stack: err && err.stack ? err.stack : String(err),
        };
      }

      const durationMs = Date.now() - tStart;
      const record = {
        tier,
        tierName,
        id: test.id,
        feature: test.feature,
        title: test.title,
        passed,
        durationMs,
        error: errorInfo,
      };
      results.push(record);

      if (!tierStats[tier]) {
        tierStats[tier] = { tier, name: tierName, total: 0, passed: 0, failed: 0, durationMs: 0 };
      }
      tierStats[tier].total += 1;
      tierStats[tier].durationMs += durationMs;
      if (passed) tierStats[tier].passed += 1;
      else tierStats[tier].failed += 1;

      if (!featureStats[test.feature]) {
        featureStats[test.feature] = { feature: test.feature, total: 0, passed: 0, failed: 0, durationMs: 0 };
      }
      featureStats[test.feature].total += 1;
      featureStats[test.feature].durationMs += durationMs;
      if (passed) featureStats[test.feature].passed += 1;
      else featureStats[test.feature].failed += 1;

      if (!opts.json) {
        const tag = passed ? '[PASS]' : '[FAIL]';
        console.log(`${tag} ${test.id} (${test.feature}) - ${test.title} (${durationMs}ms)`);
        if (!passed && errorInfo) {
          console.log(`       ${errorInfo.stack.split('\n').join('\n       ')}`);
        }
      }
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (server) {
      await server.close().catch(() => {});
    }
  }

  const totalDurationMs = Date.now() - startAll;
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  const featureKeys = Object.keys(featureStats).sort((a, b) => {
    const na = parseInt(a.replace(/\D+/g, ''), 10) || 0;
    const nb = parseInt(b.replace(/\D+/g, ''), 10) || 0;
    return na - nb || a.localeCompare(b);
  });

  if (opts.json) {
    const payload = {
      summary: { total, passed, failed, durationMs: totalDurationMs },
      tiers: Object.values(tierStats).sort((a, b) => a.tier - b.tier),
      features: featureKeys.map((k) => featureStats[k]),
      results,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log('\n--- Summary by Tier ---');
    for (const t of Object.values(tierStats).sort((a, b) => a.tier - b.tier)) {
      console.log(formatSummaryLine(`Tier ${t.tier}`, t));
    }
    console.log('\n--- Summary by Feature ---');
    for (const k of featureKeys) {
      console.log(formatSummaryLine(k, featureStats[k]));
    }
    console.log(`\nTOTAL: ${passed}/${total} passed, ${failed} failed (${totalDurationMs}ms)`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`[FATAL] ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
