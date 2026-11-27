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
const VALID_SUITES = ['all', 'baseline', 'v130'];
const MAX_TESTS_PER_BROWSER = 15;
const TRANSIENT_TRANSPORT_ERRORS = [
  'net::ERR_NO_BUFFER_SPACE',
  'net::ERR_INSUFFICIENT_RESOURCES',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_ABORTED',
  'net::ERR_SOCKET_NOT_CONNECTED',
  'net::ERR_EMPTY_RESPONSE',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasTransientTransportString(text) {
  if (!text) return false;
  const str = String(text);
  return TRANSIENT_TRANSPORT_ERRORS.some((code) => str.includes(code));
}

function isTransientTransportError(err) {
  if (!err) return false;
  const monitors = err.monitors;
  if (monitors) {
    if ((monitors.badResponses && monitors.badResponses.length > 0) ||
        (monitors.cspViolations && monitors.cspViolations.length > 0)) {
      return false;
    }
    if (Array.isArray(monitors.failedRequests) && monitors.failedRequests.length > 0) {
      return monitors.failedRequests.some((req) => hasTransientTransportString(req && req.failure));
    }
    return false;
  }
  const msg = err.message ? err.message : String(err);
  if (msg.includes('badResponses=') || msg.includes('cspViolations=')) {
    return false;
  }
  return hasTransientTransportString(msg);
}

function parseArgs(argv) {
  const opts = {
    tiers: null,
    suite: 'all',
    filter: null,
    list: false,
    json: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--list') {
      opts.list = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg.startsWith('--suite=')) {
      const rawSuite = arg.slice('--suite='.length).trim().toLowerCase();
      if (!VALID_SUITES.includes(rawSuite)) {
        throw new Error(`Invalid --suite value "${rawSuite}". Expected all, baseline, or v130.`);
      }
      opts.suite = rawSuite;
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

function loadTiers(requestedTiers, suite = 'all') {
  if (!VALID_SUITES.includes(suite)) {
    throw new Error(`Unsupported suite "${suite}". Expected all, baseline, or v130.`);
  }
  const explicit = Array.isArray(requestedTiers);
  const targets = explicit ? requestedTiers : VALID_TIERS;
  const dirEntries = fs.readdirSync(__dirname);
  const loaded = [];

  for (const tierNum of targets) {
    const candidates = [];
    const baseName = `tier${tierNum}.js`;
    if ((suite === 'all' || suite === 'baseline') && fs.existsSync(path.join(__dirname, baseName))) {
      candidates.push(baseName);
    }
    if (suite === 'all' || suite === 'v130') {
      const extPattern = new RegExp(`^tier${tierNum}-.+\\.js$`);
      const extFiles = dirEntries
        .filter((name) => extPattern.test(name))
        .sort((a, b) => a.localeCompare(b));
      candidates.push(...extFiles);
    }

    if (!candidates.length) {
      if (explicit) {
        throw new Error(`Requested tier ${tierNum} module not found for suite "${suite}" in ${__dirname}`);
      }
      continue;
    }

    for (const fileName of candidates) {
      const modPath = path.join(__dirname, fileName);
      const mod = require(modPath);
      if (!mod || !Array.isArray(mod.tests)) {
        throw new Error(`Invalid tier module ${modPath}: expected { tier, name, tests: [...] }`);
      }
      if (mod.tier !== undefined && mod.tier !== tierNum) {
        throw new Error(`Tier mismatch in ${fileName}: expected tier ${tierNum}, got ${mod.tier}`);
      }
      loaded.push({
        tier: mod.tier !== undefined ? mod.tier : tierNum,
        name: mod.name || `Tier ${tierNum}`,
        file: fileName,
        tests: mod.tests,
      });
    }
  }

  if (!loaded.length) {
    throw new Error(`No tier test modules found for suite "${suite}" in tests/e2e/.`);
  }

  const seenIds = new Map();
  for (const tm of loaded) {
    for (const test of tm.tests) {
      if (!test || typeof test.id !== 'string' || !test.id) {
        throw new Error(`Invalid test entry in ${tm.file}: missing test.id`);
      }
      if (seenIds.has(test.id)) {
        throw new Error(`Duplicate test ID "${test.id}" (in ${tm.file} and ${seenIds.get(test.id)})`);
      }
      seenIds.set(test.id, tm.file);
    }
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
    if (process.argv.slice(2).includes('--json')) {
      console.log(JSON.stringify({ error: err.message, summary: { total: 0, passed: 0, failed: 0 } }, null, 2));
    } else {
      console.error(`[ERROR] ${err.message}`);
    }
    process.exit(1);
    return;
  }

  if (opts.help) {
    console.log('Usage: node tests/e2e/runner.js [--tier=1|2|3|4|1,2] [--suite=all|baseline|v130] [--filter=<substr>] [--list] [--json]');
    process.exit(0);
    return;
  }

  let tierModules;
  try {
    tierModules = loadTiers(opts.tiers, opts.suite);
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
      plan.push({ tier: tm.tier, tierName: tm.name, tierFile: tm.file, test });
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

  if (opts.list) {
    if (opts.json) {
      console.log(JSON.stringify({
        summary: { total: plan.length, suite: opts.suite },
        tests: plan.map((item) => ({
          tier: item.tier,
          tierName: item.tierName,
          file: item.tierFile,
          id: item.test.id,
          feature: item.test.feature,
          title: item.test.title,
        })),
      }, null, 2));
    } else {
      for (const item of plan) {
        console.log(`${item.test.id} (${item.test.feature}) [${item.tierFile}] - ${item.test.title}`);
      }
      console.log(`\nTOTAL: ${plan.length} test(s) listed (suite=${opts.suite})`);
    }
    process.exit(0);
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

    if (!opts.json) {
      console.log(`Static server listening at ${server.url}`);
      console.log(`Executing ${plan.length} E2E test(s)...\n`);
    }

    let currentTier = null;
    let testsInBrowser = 0;

    for (const item of plan) {
      const { tier, tierName, test } = item;
      const browserDisconnected = browser && typeof browser.isConnected === 'function' && !browser.isConnected();
      if (!browser || browserDisconnected || tier !== currentTier || testsInBrowser >= MAX_TESTS_PER_BROWSER) {
        if (browser) {
          await browser.close().catch(() => {});
          browser = null;
          await sleep(250);
        }
        browser = await launchBrowser();
        currentTier = tier;
        testsInBrowser = 0;
      }
      testsInBrowser += 1;

      const tStart = Date.now();
      let passed = false;
      let errorInfo = null;

      for (let attempt = 0; attempt < 2; attempt++) {
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
          errorInfo = null;
          break;
        } catch (err) {
          if (attempt === 0 && isTransientTransportError(err)) {
            if (!opts.json) {
              const summary = err && err.message ? err.message.split('\n')[0] : String(err || '');
              console.log(`[RETRY] ${test.id} (${test.feature}) - transient transport error (${summary}); recycling browser & server`);
            }
            if (browser) {
              await browser.close().catch(() => {});
              browser = null;
            }
            if (server) {
              await server.close().catch(() => {});
              server = null;
            }
            await sleep(1000);
            server = await startStaticServer(repoRoot);
            browser = await launchBrowser();
            currentTier = tier;
            testsInBrowser = 1;
            continue;
          }
          passed = false;
          errorInfo = {
            message: err && err.message ? err.message : String(err),
            stack: err && err.stack ? err.stack : String(err),
          };
          break;
        }
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

      await sleep(25);
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
