/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Opaque-box E2E Playwright helpers, monitors, and assertions for omni-animalia */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (err) {
    const searchDirs = (process.env.NODE_PATH || '')
      .split(path.delimiter)
      .filter(Boolean);
    for (const dir of searchDirs) {
      const candidate = path.join(dir, 'playwright');
      if (fs.existsSync(candidate)) {
        return require(candidate);
      }
    }
    throw err;
  }
}

/* ---------- Assertions ---------- */

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertIncludes(haystack, needle, message) {
  const str = String(haystack === undefined || haystack === null ? '' : haystack);
  if (!str.includes(needle)) {
    throw new Error(
      `${message ? message + ': ' : ''}expected ${JSON.stringify(str)} to include ${JSON.stringify(needle)}`
    );
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(`${message ? message + ': ' : ''}expected truthy value, got ${JSON.stringify(value)}`);
  }
}

function assertMatch(value, regex, message) {
  const str = String(value === undefined || value === null ? '' : value);
  if (!regex.test(str)) {
    throw new Error(
      `${message ? message + ': ' : ''}expected ${JSON.stringify(str)} to match ${String(regex)}`
    );
  }
}

/* ---------- Date & Binary Utilities ---------- */

function isoDateOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function frDate(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createSamplePngBuffer(width = 8, height = 8) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      raw[px] = 108;     // R
      raw[px + 1] = 92;  // G
      raw[px + 2] = 231; // B
      raw[px + 3] = 255; // A
    }
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createCorruptPngBuffer() {
  return Buffer.from('not-a-valid-png-image', 'utf8');
}

/* ---------- Browser & Context Lifecycle ---------- */

async function launchBrowser(overrides = {}) {
  const { chromium } = loadPlaywright();
  return chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...overrides,
  });
}

async function waitForReady(page) {
  await page.locator('#chargement').waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForFunction(
    () => {
      const err = document.querySelector('#erreur-fatale');
      if (err && !err.hidden) return true;
      const lock = document.querySelector('#verrou');
      if (lock && !lock.hidden) return true;
      const main = document.querySelector('#principal');
      if (!main || main.hidden) return false;
      const vue = main.querySelector('.vue:not([hidden])');
      if (!vue) return false;
      const name = vue.dataset.vue;
      if (name === 'accueil') return !!vue.querySelector('#accueil-liste > *');
      if (name === 'archives') return !!vue.querySelector('#archives-liste > *');
      if (name === 'animal') {
        return !!vue.querySelector('#animal-contenu .pile-boutons, #animal-contenu .encart.vide, #animal-contenu p[aria-live="polite"], #animal-contenu .carte-fiche');
      }
      if (name === 'garde') {
        return !!vue.querySelector('#garde-contenu .fiche-garde') && !!vue.querySelector('#garde-contenu .pile-boutons');
      }
      if (name === 'rappels') return !!vue.querySelector('#rappels-liste > *');
      if (name === 'veterinaires') return !!vue.querySelector('#vetos-liste > *');
      if (name === 'reglages') return !!vue.querySelector('#reglages-contenu > section.bloc');
      return true;
    },
    { timeout: 15000 }
  );
  const fatalHidden = await page.locator('#erreur-fatale').evaluate((el) => el.hidden);
  if (!fatalHidden) {
    const fatalText = await page.locator('#erreur-fatale-texte').textContent();
    throw new Error(`Fatal error screen displayed: ${fatalText}`);
  }
}

async function dismissWelcome(page, { optional = false } = {}) {
  const dlg = page.locator('dialog#dialogue[open]');
  const btn = dlg.getByRole('button', { name: 'J’ai compris', exact: true });
  if (optional) {
    const visible = await dlg.isVisible().catch(() => false);
    if (!visible) return false;
    const title = await dlg.locator('#dialogue-titre').textContent().catch(() => '');
    if (!title || !title.includes('Bienvenue')) return false;
  } else {
    await dlg.waitFor({ state: 'visible', timeout: 10000 });
    const title = await dlg.locator('#dialogue-titre').textContent();
    assertIncludes(title, 'Bienvenue', 'Welcome modal title');
  }
  await btn.click();
  await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 });
  // Allow App.demarrer() to finish persisting avertissementVu = true in IndexedDB
  await page.waitForTimeout(50);
  return true;
}

async function openApp(page, baseUrl, options = {}) {
  const targetUrl = options.url || baseUrl;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await waitForReady(page);
  const lockHidden = await page.locator('#verrou').evaluate((el) => el.hidden);
  if (lockHidden && options.dismissWelcome !== false) {
    await dismissWelcome(page, { optional: !!options.welcomeOptional });
  }
}

async function reloadApp(page, options = {}) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);
  const lockHidden = await page.locator('#verrou').evaluate((el) => el.hidden);
  if (lockHidden && options.dismissWelcome === true) {
    await dismissWelcome(page, { optional: !!options.welcomeOptional });
  }
}

async function withAppContext(browser, baseUrl, fn, options = {}) {
  const contextOptions = {
    viewport: options.viewport || { width: 390, height: 844 },
    locale: options.locale || 'fr-FR',
    timezoneId: options.timezoneId || 'Europe/Paris',
    acceptDownloads: options.acceptDownloads !== undefined ? options.acceptDownloads : true,
    ...(options.contextOptions || {}),
  };

  const monitors = {
    pageErrors: [],
    consoleErrors: [],
    cspViolations: [],
    failedRequests: [],
    badResponses: [],
    externalRequests: [],
  };

  const context = await browser.newContext(contextOptions);
  await context.exposeFunction('__omniReportCsp', (entry) => {
    monitors.cspViolations.push(entry);
  });
  await context.addInitScript(() => {
    window.__cspViolations = window.__cspViolations || [];
    document.addEventListener('securitypolicyviolation', (e) => {
      const entry = {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        effectiveDirective: e.effectiveDirective,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber,
      };
      if (typeof window.__omniReportCsp === 'function') {
        try {
          window.__omniReportCsp(entry);
          return;
        } catch (err) {
          // Fall back to window.__cspViolations
        }
      }
      window.__cspViolations.push(entry);
    });
  });

  const page = await context.newPage();

  page.on('pageerror', (err) => {
    monitors.pageErrors.push(err && (err.stack || err.message) ? (err.stack || err.message) : String(err));
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      monitors.consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    monitors.failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: (req.failure() && req.failure().errorText) || 'failed',
    });
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      monitors.badResponses.push({
        url: res.url(),
        status: res.status(),
      });
    }
  });

  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseUrl) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      monitors.externalRequests.push({
        url,
        method: req.method(),
        resourceType: req.resourceType(),
      });
    }
  });

  async function syncCspViolations() {
    try {
      const fallback = await page.evaluate(() => {
        const collected = Array.isArray(window.__cspViolations) ? window.__cspViolations.slice() : [];
        window.__cspViolations = [];
        return collected;
      });
      if (fallback.length) {
        monitors.cspViolations.push(...fallback);
      }
    } catch (e) {
      // Page may be mid-navigation or closed; retain previous array
    }
  }

  async function assertNoRuntimeErrors(checkOpts = {}) {
    await syncCspViolations();
    const problems = [];
    if (!checkOpts.allowPageErrors && monitors.pageErrors.length) {
      problems.push(`pageErrors=${JSON.stringify(monitors.pageErrors)}`);
    }
    if (!checkOpts.allowConsoleErrors && monitors.consoleErrors.length) {
      problems.push(`consoleErrors=${JSON.stringify(monitors.consoleErrors)}`);
    }
    if (!checkOpts.allowCspViolations && monitors.cspViolations.length) {
      problems.push(`cspViolations=${JSON.stringify(monitors.cspViolations)}`);
    }
    if (!checkOpts.allowFailedRequests && monitors.failedRequests.length) {
      problems.push(`failedRequests=${JSON.stringify(monitors.failedRequests)}`);
    }
    if (!checkOpts.allowBadResponses && monitors.badResponses.length) {
      problems.push(`badResponses=${JSON.stringify(monitors.badResponses)}`);
    }
    if (!checkOpts.allowExternalRequests && monitors.externalRequests.length) {
      problems.push(`externalRequests=${JSON.stringify(monitors.externalRequests)}`);
    }
    if (problems.length) {
      throw new Error(`Runtime monitor violations detected: ${problems.join('; ')}`);
    }
  }

  async function cleanupSwOffline() {
    const state = swOfflineSessions.get(context);
    if (!state) return;
    swOfflineSessions.delete(context);
    for (const sessionId of state.attached) {
      await state.bcdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
    }
    await state.bcdp.detach().catch(() => {});
  }

  try {
    if (options.autoNavigate !== false) {
      await openApp(page, baseUrl, options);
    }
    return await fn({ browser, page, context, monitors, baseUrl, assertNoRuntimeErrors, syncCspViolations });
  } finally {
    await cleanupSwOffline().catch(() => {});
    await context.close();
  }
}

/* ---------- Opaque-Box UI Navigation & Interaction Helpers ---------- */

const TAB_CONTAINERS = {
  accueil: { container: '#accueil-liste', allReady: ['#accueil-liste > *', '#accueil-actions > *'] },
  archives: { container: '#archives-liste', allReady: ['#archives-liste > *'] },
  rappels: { container: '#rappels-liste', allReady: ['#rappels-liste > *'] },
  veterinaires: { container: '#vetos-liste', allReady: ['#vetos-liste > *', '#vetos-actions > *'] },
  reglages: { container: '#reglages-contenu', allReady: ['#reglages-contenu > section.bloc'] },
  apropos: null,
};

async function goTab(page, onglet) {
  const spec = TAB_CONTAINERS[onglet];
  const alreadyVisible = await page.locator(`.vue[data-vue="${onglet}"]`).evaluate((el) => !el.hidden).catch(() => false);
  const childLoc = spec ? page.locator(`${spec.container} > *`) : null;
  const prevChild = (!alreadyVisible && childLoc && (await childLoc.count()) > 0)
    ? await childLoc.first().elementHandle().catch(() => null)
    : null;
  try {
    await page.locator(`#barre-nav button[data-onglet="${onglet}"]`).click();
    await page.locator(`.vue[data-vue="${onglet}"]:not([hidden])`).waitFor({ state: 'visible', timeout: 10000 });
    if (prevChild) {
      await page.waitForFunction((el) => !el.isConnected, prevChild, { timeout: 10000 });
    }
  } finally {
    if (prevChild) await prevChild.dispose().catch(() => {});
  }
  if (spec) {
    for (const sel of spec.allReady) {
      await page.locator(sel).first().waitFor({ state: 'visible', timeout: 10000 });
    }
  }
}

const ANIMAL_SECTION_TITLES = {
  identite: 'Identité',
  poids: 'Poids',
  vaccins: 'Vaccins',
  antiparasitaires: 'Vermifuges et antiparasitaires',
  traitements: 'Traitements et médicaments',
  rdv: 'Rendez-vous vétérinaires',
  notes: 'Notes de santé',
  alimentation: 'Alimentation',
  taches: 'Choses à faire',
};

const ANIMAL_TITLE_TO_SECTION = Object.fromEntries(
  Object.entries(ANIMAL_SECTION_TITLES).map(([k, v]) => [v, k])
);

const ANIMAL_SECTION_READY = {
  identite: '#animal-contenu .pile-boutons',
  alimentation: '#animal-contenu .encart.vide, #animal-contenu .carte-fiche',
  poids: '#animal-contenu .encart.vide, #animal-contenu .carte-fiche',
  vaccins: '#animal-contenu .encart.vide, #animal-contenu .carte-fiche',
  antiparasitaires: '#animal-contenu .encart.vide, #animal-contenu .carte-fiche',
  traitements: '#animal-contenu .encart.vide, #animal-contenu .carte-fiche',
  rdv: '#animal-contenu .encart.vide, #animal-contenu .carte-fiche',
  notes: '#animal-contenu .encart.vide, #animal-contenu p[aria-live="polite"]',
  taches: '#animal-contenu .encart.vide, #animal-contenu .carte-fiche',
};

const ANY_ANIMAL_SECTION_READY = Object.values(ANIMAL_SECTION_READY).join(', ');

async function openPet(page, petName, section = 'identite') {
  const accueilVisible = await page.locator('.vue[data-vue="accueil"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!accueilVisible) {
    await goTab(page, 'accueil');
  }
  const card = page
    .locator('#accueil-liste button.carte-animal')
    .filter({ has: page.locator('.carte-titre', { hasText: petName }) })
    .first();
  await card.waitFor({ state: 'visible', timeout: 10000 });
  const prevHeading = (await page.locator('#animal-contenu h2').count()) > 0
    ? await page.locator('#animal-contenu h2').first().elementHandle().catch(() => null)
    : null;
  try {
    await card.click();
    await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevHeading) {
      await page.waitForFunction((el) => !el.isConnected, prevHeading, { timeout: 10000 });
    }
  } finally {
    if (prevHeading) await prevHeading.dispose().catch(() => {});
  }
  await page.locator('#animal-titre').filter({ hasText: petName }).waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#animal-sections button[data-section="identite"][aria-current="true"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#animal-contenu h2').filter({ hasText: 'Identité' }).waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#animal-contenu .pile-boutons').waitFor({ state: 'visible', timeout: 10000 });
  if (section && section !== 'identite') {
    await openAnimalSection(page, section);
  }
}

async function openAnimalSection(page, section) {
  const expectedTitle = ANIMAL_SECTION_TITLES[section];
  await page.locator('#animal-contenu h2').first().waitFor({ state: 'visible', timeout: 10000 });
  const prevHeading = (await page.locator('#animal-contenu h2').count()) > 0
    ? await page.locator('#animal-contenu h2').first().elementHandle().catch(() => null)
    : null;
  const btn = page.locator(`#animal-sections button[data-section="${section}"]`);
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  try {
    await btn.click();
    await page.locator(`#animal-sections button[data-section="${section}"][aria-current="true"]`).waitFor({ state: 'visible', timeout: 10000 });
    if (prevHeading) {
      await page.waitForFunction((el) => !el.isConnected, prevHeading, { timeout: 10000 });
    }
  } finally {
    if (prevHeading) await prevHeading.dispose().catch(() => {});
  }
  if (expectedTitle) {
    await page.locator('#animal-contenu h2').filter({ hasText: expectedTitle }).waitFor({ state: 'visible', timeout: 10000 });
  } else {
    await page.locator('#animal-contenu h2').waitFor({ state: 'visible', timeout: 10000 });
  }
  const readySel = ANIMAL_SECTION_READY[section] || ANY_ANIMAL_SECTION_READY;
  await page.locator(readySel).first().waitFor({ state: 'visible', timeout: 10000 });
}

async function submitForm(page, { expectErrors = false } = {}) {
  await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
  if (expectErrors) {
    await page.locator('#formulaire-erreurs:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });
  } else {
    await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });
  }
}

async function confirmDialog(page, buttonLabel, { inputText, expectNextDialog = false } = {}) {
  const dlg = page.locator('dialog#dialogue[open]');
  await dlg.waitFor({ state: 'visible', timeout: 10000 });
  if (inputText !== undefined) {
    await dlg.locator('#dialogue-saisie').fill(inputText);
  }
  await page.evaluate(() => {
    const dlgEl = document.querySelector('dialog#dialogue');
    if (!dlgEl || !dlgEl.open) {
      window.__omniDialogClosed = Promise.resolve();
      return;
    }
    window.__omniDialogClosed = new Promise((resolve) => {
      dlgEl.addEventListener('close', () => resolve(), { once: true });
    });
  });
  try {
    await dlg.locator('.dialogue-boutons').getByRole('button', { name: buttonLabel, exact: true }).click();
    await page.evaluate(async () => {
      const p = window.__omniDialogClosed;
      if (p) {
        let timer;
        await Promise.race([
          p,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Timed out waiting for dialog#dialogue close event')), 10000);
          }),
        ]).finally(() => clearTimeout(timer));
      }
      await new Promise((r) => setTimeout(r, 0));
    });
    if (!expectNextDialog) {
      await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 10000 });
    }
  } finally {
    await page.evaluate(() => {
      delete window.__omniDialogClosed;
    }).catch(() => {});
  }
}

async function uploadSamplePng(page, fileInputLocator, filename = 'sample.png', waitZoneSelector = '.champ-photo-zone .aide', expectedText = 'Photo prête') {
  const buffer = createSamplePngBuffer(12, 12);
  await fileInputLocator.setInputFiles({
    name: filename,
    mimeType: 'image/png',
    buffer,
  });
  if (waitZoneSelector && expectedText) {
    await page.locator(waitZoneSelector).filter({ hasText: expectedText }).waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function loadDemoData(page) {
  await goTab(page, 'reglages');
  const btn = page.locator('#bouton-exemple');
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  await page.locator('#bouton-exemple', { hasText: 'Supprimer l’exemple' }).waitFor({ state: 'visible', timeout: 10000 });
}

async function createPet(page, data = {}) {
  const accueilVisible = await page.locator('.vue[data-vue="accueil"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!accueilVisible) {
    await goTab(page, 'accueil');
  }
  await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });

  if (data.nom !== undefined) await page.locator('#champ-nom').fill(data.nom);
  if (data.espece !== undefined) await page.locator('#champ-espece').fill(data.espece);
  if (data.race !== undefined) await page.locator('#champ-race').fill(data.race);
  if (data.sexe !== undefined) {
    await page.locator(`[data-champ="sexe"] input[type="radio"][value="${data.sexe}"]`).check();
  }
  if (data.couleur !== undefined) await page.locator('#champ-couleur').fill(data.couleur);
  if (data.naissance !== undefined) await page.locator('#champ-naissance').fill(data.naissance);
  if (data.naissanceApprox) await page.locator('#champ-naissanceApprox').check();
  if (data.puce !== undefined) await page.locator('#champ-puce').fill(data.puce);
  if (data.tatouage !== undefined) await page.locator('#champ-tatouage').fill(data.tatouage);
  if (data.sterilise) {
    await page.locator('#champ-sterilise').check();
    if (data.dateSterilisation !== undefined) {
      await page.locator('#champ-dateSterilisation').waitFor({ state: 'visible', timeout: 5000 });
      await page.locator('#champ-dateSterilisation').fill(data.dateSterilisation);
    }
  }
  if (data.unitePoids !== undefined) {
    await page.locator(`[data-champ="unitePoids"] input[type="radio"][value="${data.unitePoids}"]`).check();
  }
  if (data.vetoId !== undefined) {
    await page.locator('#champ-vetoId').selectOption(data.vetoId);
  }
  if (data.vetoLabel !== undefined) {
    await page.locator('#champ-vetoId').selectOption({ label: data.vetoLabel });
  }
  if (data.withPhoto) {
    const fileInput = page.locator('[data-champ="photo"] input[type="file"]:not([capture])');
    await uploadSamplePng(page, fileInput, data.photoName || 'pet.png', '[data-champ="photo"] .aide', 'Photo prête');
  }
  if (data.notes !== undefined) await page.locator('#champ-notes').fill(data.notes);

  const expectedNom = data.nom && data.nom.trim()
    ? (await page.locator('#champ-nom').inputValue()).trim()
    : '';
  const prevChild = (await page.locator('#accueil-liste > *').count()) > 0
    ? await page.locator('#accueil-liste > *').first().elementHandle().catch(() => null)
    : null;
  try {
    await submitForm(page);
    await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevChild) {
      await page.waitForFunction((el) => !el.isConnected, prevChild, { timeout: 10000 });
    }
  } finally {
    if (prevChild) await prevChild.dispose().catch(() => {});
  }
  await page.locator('#accueil-liste > *').first().waitFor({ state: 'visible', timeout: 10000 });
  if (expectedNom) {
    await page.locator('#accueil-liste .carte-animal .carte-titre').filter({ hasText: expectedNom }).first().waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function readDownloadToString(download) {
  const stream = await download.createReadStream();
  if (!stream) {
    const filePath = await download.path();
    return fs.readFileSync(filePath, 'utf8');
  }
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function triggerBackupDownload(page) {
  const reglagesVisible = await page.locator('.vue[data-vue="reglages"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!reglagesVisible) {
    await goTab(page, 'reglages');
  }

  const prevBloc = (await page.locator('#reglages-contenu > section.bloc').count()) > 0
    ? await page.locator('#reglages-contenu > section.bloc').first().elementHandle().catch(() => null)
    : null;

  try {
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#bouton-sauvegarder').click();

    const dlg = page.locator('dialog#dialogue[open]');
    const dlBtn = dlg.locator('.dialogue-boutons').getByRole('button', { name: 'Télécharger', exact: true });

    const outcome = await Promise.race([
      downloadPromise.then((download) => ({ kind: 'download', download })),
      dlBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => ({ kind: 'dialog' })).catch(() => null),
    ]);

    let download;
    if (outcome && outcome.kind === 'download') {
      download = outcome.download;
    } else {
      await dlBtn.click();
      download = await downloadPromise;
      await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 10000 });
    }

    const raw = await readDownloadToString(download);
    const data = JSON.parse(raw);

    if (prevBloc) {
      await page.waitForFunction((el) => !el.isConnected, prevBloc, { timeout: 10000 });
      await page.locator('#reglages-contenu > section.bloc').first().waitFor({ state: 'visible', timeout: 10000 });
    }

    return {
      filename: download.suggestedFilename(),
      raw,
      data,
    };
  } finally {
    if (prevBloc) await prevBloc.dispose().catch(() => {});
  }
}

async function captureDownload(page, triggerFn) {
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await triggerFn();
  const download = await downloadPromise;
  const content = await readDownloadToString(download);
  return {
    filename: download.suggestedFilename(),
    content,
  };
}

/* ---------- Service Worker, Offline, Validation & Concurrency Helpers ---------- */

async function waitForSwReady(page, { requireController = false, timeout = 15000 } = {}) {
  const readSw = async () => page.evaluate(async (ms) => {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker ready timeout')), ms)),
    ]);
    return {
      scope: reg ? reg.scope : '',
      activeScriptURL: reg && reg.active ? reg.active.scriptURL : '',
      controlled: !!navigator.serviceWorker.controller,
    };
  }, timeout);

  let info = await readSw();
  if (requireController && !info.controlled) {
    await reloadApp(page);
    info = await readSw();
    assertTruthy(info.controlled, 'Page must be controlled by Service Worker after online reload');
  }
  return info;
}

async function ensureSwControlled(page, { timeout = 15000 } = {}) {
  return waitForSwReady(page, { requireController: true, timeout });
}

const swOfflineSessions = new WeakMap();

async function setOfflineWithSw(browser, context, page, offline) {
  const isOffline = !!offline;
  await context.setOffline(isOffline);

  const existing = swOfflineSessions.get(context);
  if (!isOffline) {
    if (existing) {
      swOfflineSessions.delete(context);
      try {
        for (const sessionId of existing.attached) {
          await existing.bcdp.send('Target.sendMessageToTarget', {
            sessionId,
            message: JSON.stringify({
              id: 3,
              method: 'Network.emulateNetworkConditions',
              params: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
            }),
          }).catch(() => {});
          await existing.bcdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
        }
      } finally {
        await existing.bcdp.detach().catch(() => {});
      }
    }
    await page.waitForFunction(() => navigator.onLine === true, { timeout: 5000 });
    return;
  }

  if (existing) {
    swOfflineSessions.delete(context);
    for (const sessionId of existing.attached) {
      await existing.bcdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
    }
    await existing.bcdp.detach().catch(() => {});
  }

  const pageUrl = page.url();
  const origin = pageUrl && pageUrl.startsWith('http') ? new URL(pageUrl).origin : null;
  const bcdp = await browser.newBrowserCDPSession();
  const attached = [];
  try {
    const { targetInfos } = await bcdp.send('Target.getTargets');
    const swTargets = targetInfos.filter(
      (t) => t.type === 'service_worker' && (!origin || !t.url || t.url.startsWith(origin))
    );
    for (const t of swTargets) {
      const { sessionId } = await bcdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: false });
      attached.push(sessionId);
      await bcdp.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({ id: 1, method: 'Network.enable' }),
      });
      await bcdp.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({
          id: 2,
          method: 'Network.emulateNetworkConditions',
          params: {
            offline: true,
            latency: 0,
            downloadThroughput: 0,
            uploadThroughput: 0,
          },
        }),
      });
    }
    swOfflineSessions.set(context, { bcdp, attached });
  } catch (err) {
    for (const sessionId of attached) {
      await bcdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
    }
    await bcdp.detach().catch(() => {});
    throw err;
  }

  await page.waitForFunction(() => navigator.onLine === false, { timeout: 5000 });
}

async function getCachedPaths(page) {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const omniKeys = keys.filter((k) => k.startsWith('omni-animalia-'));
    const pathSet = new Set();
    for (const k of omniKeys) {
      const cache = await caches.open(k);
      const reqs = await cache.keys();
      for (const r of reqs) {
        pathSet.add(new URL(r.url).pathname);
      }
    }
    return Array.from(pathSet).sort();
  });
}

async function assertFieldError(page, champNom, expectedText, { isRadio = false } = {}) {
  const summary = page.locator('#formulaire-erreurs:not([hidden])');
  await summary.waitFor({ state: 'visible', timeout: 5000 });
  const fieldBlock = page.locator(`.vue[data-vue="formulaire"] [data-champ="${champNom}"]`);
  const errMsg = fieldBlock.locator('.message-erreur:not([hidden])');
  await errMsg.waitFor({ state: 'visible', timeout: 5000 });
  if (expectedText) {
    assertIncludes(await errMsg.textContent(), expectedText, `Field error for ${champNom}`);
  }
  if (isRadio) {
    const fieldsetInvalid = await fieldBlock.locator('fieldset.groupe-radios').getAttribute('aria-invalid');
    assertEqual(fieldsetInvalid, 'true', `fieldset[aria-invalid] for ${champNom}`);
    const radios = fieldBlock.locator('input[type="radio"]');
    const count = await radios.count();
    assert(count > 0, `Expected radio inputs inside [data-champ="${champNom}"]`);
    for (let i = 0; i < count; i++) {
      assertEqual(await radios.nth(i).getAttribute('aria-invalid'), 'true', `radio[${i}][aria-invalid] for ${champNom}`);
    }
  } else {
    const input = fieldBlock.locator('input:not([type="hidden"]), select, textarea').first();
    assertEqual(await input.getAttribute('aria-invalid'), 'true', `input[aria-invalid] for ${champNom}`);
  }
}

async function uploadFileBuffer(page, locator, { name, mimeType, buffer }) {
  await locator.setInputFiles({
    name,
    mimeType,
    buffer,
  });
}

async function uploadJsonImport(page, filename, contentOrObj) {
  const reglagesVisible = await page.locator('.vue[data-vue="reglages"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!reglagesVisible) {
    await goTab(page, 'reglages');
  }
  const text = typeof contentOrObj === 'string' ? contentOrObj : JSON.stringify(contentOrObj);
  const mimeType = filename.toLowerCase().endsWith('.txt') ? 'text/plain' : 'application/json';
  await page.locator('#fichier-import').setInputFiles({
    name: filename,
    mimeType,
    buffer: Buffer.from(text, 'utf8'),
  });
}

async function rapidDoubleClick(locator) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.evaluate((el) => {
    el.click();
    el.click();
  });
}

/* ---------- Additional Opaque-Box UI, Print, Lock & Export Helpers ---------- */

async function submitAnimalForm(page, expectedHeading) {
  const prevHeading = (await page.locator('#animal-contenu h2').count()) > 0
    ? await page.locator('#animal-contenu h2').first().elementHandle().catch(() => null)
    : null;
  try {
    await submitForm(page);
    await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevHeading) {
      await page.waitForFunction((el) => !el.isConnected, prevHeading, { timeout: 10000 });
    }
  } finally {
    if (prevHeading) await prevHeading.dispose().catch(() => {});
  }
  if (expectedHeading) {
    await page.locator('#animal-contenu h2').filter({ hasText: expectedHeading }).waitFor({ state: 'visible', timeout: 10000 });
  } else {
    await page.locator('#animal-contenu h2').waitFor({ state: 'visible', timeout: 10000 });
  }
  const sectionKey = expectedHeading ? ANIMAL_TITLE_TO_SECTION[expectedHeading] : null;
  const readySel = (sectionKey && ANIMAL_SECTION_READY[sectionKey]) || ANY_ANIMAL_SECTION_READY;
  await page.locator(readySel).first().waitFor({ state: 'visible', timeout: 10000 });
}

async function createVet(page, data = {}) {
  await goTab(page, 'veterinaires');
  await page.locator('#vetos-actions').getByRole('button', { name: 'Ajouter un vétérinaire', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (data.nom !== undefined) await page.locator('#champ-nom').fill(data.nom);
  if (data.clinique !== undefined) await page.locator('#champ-clinique').fill(data.clinique);
  if (data.telephone !== undefined) await page.locator('#champ-telephone').fill(data.telephone);
  if (data.adresse !== undefined) await page.locator('#champ-adresse').fill(data.adresse);
  if (data.notes !== undefined) await page.locator('#champ-notes').fill(data.notes);
  const expectedNom = data.nom !== undefined
    ? (await page.locator('#champ-nom').inputValue()).trim()
    : null;
  const prevChild = (await page.locator('#vetos-liste > *').count()) > 0
    ? await page.locator('#vetos-liste > *').first().elementHandle().catch(() => null)
    : null;
  try {
    await submitForm(page);
    await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevChild) {
      await page.waitForFunction((el) => !el.isConnected, prevChild, { timeout: 10000 });
    }
  } finally {
    if (prevChild) await prevChild.dispose().catch(() => {});
  }
  await page.locator('#vetos-liste > *').first().waitFor({ state: 'visible', timeout: 10000 });
  if (expectedNom) {
    await page.locator('#vetos-liste .carte-fiche .carte-titre').filter({ hasText: expectedNom }).first().waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function addWeighIn(page, { date, valeur, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (valeur !== undefined) await page.locator('#champ-valeur').fill(String(valeur));
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Poids');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function addVaccine(page, { nom, date, rappel, veterinaire, lot, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un vaccin', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (nom !== undefined) await page.locator('#champ-nom').fill(nom);
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (rappel !== undefined) await page.locator('#champ-rappel').fill(rappel);
  if (veterinaire !== undefined) await page.locator('#champ-veterinaire').fill(veterinaire);
  if (lot !== undefined) await page.locator('#champ-lot').fill(lot);
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Vaccins');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function addAntiparasitic(page, { type, produit, date, prochaine, dose, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une prise', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (type !== undefined) await page.locator(`[data-champ="type"] input[type="radio"][value="${type}"]`).check();
  if (produit !== undefined) await page.locator('#champ-produit').fill(produit);
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (prochaine !== undefined) await page.locator('#champ-prochaine').fill(prochaine);
  if (dose !== undefined) await page.locator('#champ-dose').fill(dose);
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Vermifuges et antiparasitaires');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function addTreatment(page, { nom, dose, frequence, prisesParJour, debut, fin, statut, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un traitement', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (nom !== undefined) await page.locator('#champ-nom').fill(nom);
  if (dose !== undefined) await page.locator('#champ-dose').fill(dose);
  if (frequence !== undefined) await page.locator('#champ-frequence').fill(frequence);
  if (prisesParJour !== undefined) await page.locator('#champ-prisesParJour').fill(String(prisesParJour));
  if (debut !== undefined) await page.locator('#champ-debut').fill(debut);
  if (fin !== undefined) await page.locator('#champ-fin').fill(fin);
  if (statut !== undefined) await page.locator(`[data-champ="statut"] input[type="radio"][value="${statut}"]`).check();
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Traitements et médicaments');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function addAppointment(page, { date, heure, motif, veterinaire, compteRendu, cout } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (heure !== undefined) await page.locator('#champ-heure').fill(heure);
  if (motif !== undefined) await page.locator('#champ-motif').fill(motif);
  if (veterinaire !== undefined) await page.locator('#champ-veterinaire').fill(veterinaire);
  if (compteRendu !== undefined) await page.locator('#champ-compteRendu').fill(compteRendu);
  if (cout !== undefined) await page.locator('#champ-cout').fill(String(cout));
  await submitAnimalForm(page, 'Rendez-vous vétérinaires');
  await page.locator('#animal-contenu h3.sous-titre').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function addTask(page, { titre, echeance, repete, recN, recUnite, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (titre !== undefined) await page.locator('#champ-titre').fill(titre);
  if (echeance !== undefined) await page.locator('#champ-echeance').fill(echeance);
  if (repete !== undefined) {
    await page.locator(`[data-champ="repete"] input[type="radio"][value="${repete}"]`).check();
  }
  if (repete === 'oui') {
    if (recN !== undefined) await page.locator('#champ-recN').fill(String(recN));
    if (recUnite !== undefined) await page.locator('#champ-recUnite').selectOption(recUnite);
  }
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Choses à faire');
  await page.locator('#animal-contenu h3.sous-titre').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function addNote(page, { date, categorie, texte, withDocument, docName } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (categorie !== undefined) await page.locator('#champ-categorie').selectOption(categorie);
  if (texte !== undefined) await page.locator('#champ-texte').fill(texte);
  if (withDocument) {
    const fileInput = page.locator('[data-champ="pieces"] input[type="file"]:not([capture])');
    await uploadSamplePng(page, fileInput, docName || 'doc.png', '[data-champ="pieces"] .aide', 'Document ajouté');
  }
  await submitAnimalForm(page, 'Notes de santé');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function activatePassword(page, password) {
  await goTab(page, 'reglages');
  await page.locator('#reglages-contenu').getByRole('button', { name: 'Activer un mot de passe', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#champ-nouveau').fill(password);
  await page.locator('#champ-confirmation').fill(password);
  await submitForm(page);
  await page.locator('.vue[data-vue="reglages"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#reglages-contenu').filter({ hasText: 'Le verrouillage par mot de passe est activé.' }).waitFor({ state: 'visible', timeout: 10000 });
}

async function unlockApp(page, password) {
  await page.locator('#verrou:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#verrou-mdp').fill(password);
  await page.locator('#verrou-form button[type="submit"]').click();
  await page.locator('#verrou').waitFor({ state: 'hidden', timeout: 15000 });
  await waitForReady(page);
}

async function restoreBackup(page, filename, contentOrObj, mode = 'remplacer') {
  await uploadJsonImport(page, filename, contentOrObj);
  const prevBloc = (await page.locator('#reglages-contenu > section.bloc').count()) > 0
    ? await page.locator('#reglages-contenu > section.bloc').first().elementHandle().catch(() => null)
    : null;
  try {
    if (mode === 'remplacer') {
      await confirmDialog(page, 'Remplacer', { expectNextDialog: true });
      await confirmDialog(page, 'Remplacer');
    } else {
      await confirmDialog(page, 'Fusionner');
    }
    await page.locator('#annonce').filter({ hasText: 'Restauration terminée' }).waitFor({ state: 'visible', timeout: 10000 });
    if (prevBloc) {
      await page.waitForFunction((el) => !el.isConnected, prevBloc, { timeout: 10000 });
    }
  } finally {
    if (prevBloc) await prevBloc.dispose().catch(() => {});
  }
  await page.locator('#reglages-contenu > section.bloc').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function wipeAllData(page) {
  await goTab(page, 'reglages');
  const prevBloc = (await page.locator('#reglages-contenu > section.bloc').count()) > 0
    ? await page.locator('#reglages-contenu > section.bloc').first().elementHandle().catch(() => null)
    : null;
  try {
    await page.locator('#reglages-contenu').getByRole('button', { name: 'Supprimer toutes les données', exact: true }).click();
    await confirmDialog(page, 'Continuer', { expectNextDialog: true });
    await confirmDialog(page, 'Tout supprimer', { inputText: 'SUPPRIMER' });
    await page.locator('#annonce').filter({ hasText: 'Toutes les données ont été supprimées.' }).waitFor({ state: 'visible', timeout: 10000 });
    if (prevBloc) {
      await page.waitForFunction((el) => !el.isConnected, prevBloc, { timeout: 10000 });
    }
  } finally {
    if (prevBloc) await prevBloc.dispose().catch(() => {});
  }
  await page.locator('#reglages-contenu > section.bloc').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function openGarde(page) {
  const prevChild = (await page.locator('#garde-contenu > *').count()) > 0
    ? await page.locator('#garde-contenu > *').first().elementHandle().catch(() => null)
    : null;
  try {
    await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
    await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevChild) {
      await page.waitForFunction((el) => !el.isConnected, prevChild, { timeout: 10000 });
    }
  } finally {
    if (prevChild) await prevChild.dispose().catch(() => {});
  }
  await page.locator('#garde-contenu .fiche-garde').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#garde-contenu .pile-boutons').waitFor({ state: 'visible', timeout: 10000 });
}

async function submitGardeForm(page) {
  const prevFiche = (await page.locator('#garde-contenu .fiche-garde').count()) > 0
    ? await page.locator('#garde-contenu .fiche-garde').first().elementHandle().catch(() => null)
    : null;
  try {
    await submitForm(page);
    await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevFiche) {
      await page.waitForFunction((el) => !el.isConnected, prevFiche, { timeout: 10000 });
    }
  } finally {
    if (prevFiche) await prevFiche.dispose().catch(() => {});
  }
  await page.locator('#garde-contenu .fiche-garde').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#garde-contenu .pile-boutons').waitFor({ state: 'visible', timeout: 10000 });
}

async function openArchives(page) {
  const prevChild = (await page.locator('#archives-liste > *').count()) > 0
    ? await page.locator('#archives-liste > *').first().elementHandle().catch(() => null)
    : null;
  try {
    await page.locator('#accueil-actions').getByRole('button', { name: /Animaux archivés/ }).click();
    await page.locator('.vue[data-vue="archives"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevChild) {
      await page.waitForFunction((el) => !el.isConnected, prevChild, { timeout: 10000 });
    }
  } finally {
    if (prevChild) await prevChild.dispose().catch(() => {});
  }
  await page.locator('#archives-liste > *').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function openAnimalFromView(page, triggerLocatorOrFn) {
  const prevHeading = (await page.locator('#animal-contenu h2').count()) > 0
    ? await page.locator('#animal-contenu h2').first().elementHandle().catch(() => null)
    : null;
  try {
    if (typeof triggerLocatorOrFn === 'function') {
      await triggerLocatorOrFn();
    } else {
      await triggerLocatorOrFn.click();
    }
    await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    if (prevHeading) {
      await page.waitForFunction((el) => !el.isConnected, prevHeading, { timeout: 10000 });
    }
  } finally {
    if (prevHeading) await prevHeading.dispose().catch(() => {});
  }
  await page.locator('#animal-contenu h2').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator(ANY_ANIMAL_SECTION_READY).first().waitFor({ state: 'visible', timeout: 10000 });
}

function unfoldIcs(content) {
  return String(content || '').replace(/\r\n /g, '');
}

async function captureWindowOpen(page, triggerFn) {
  await page.evaluate(() => {
    window.__omniOrigOpen = window.open;
    window.__omniOpenCalls = [];
    window.open = (url, target, features) => {
      window.__omniOpenCalls.push({
        url: url === undefined ? '' : String(url),
        target: target === undefined ? '' : String(target),
        features: features === undefined ? '' : String(features),
      });
      return null;
    };
  });
  try {
    await triggerFn();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    return await page.evaluate(() => (Array.isArray(window.__omniOpenCalls) ? window.__omniOpenCalls.slice() : []));
  } finally {
    await page.evaluate(() => {
      if (Object.prototype.hasOwnProperty.call(window, '__omniOrigOpen')) {
        window.open = window.__omniOrigOpen;
        delete window.__omniOrigOpen;
      }
      delete window.__omniOpenCalls;
    }).catch(() => {});
  }
}

async function probePrintView(page, triggerFn, { carnetChildSelector = '> *', expectedTitleContains, expectedTitleRestore, onPrint } = {}) {
  const titleBefore = expectedTitleRestore !== undefined ? expectedTitleRestore : await page.title();
  await triggerFn();
  await page.locator(`#carnet ${carnetChildSelector}`).first().waitFor({ state: 'attached', timeout: 10000 });

  if (expectedTitleContains) {
    assertIncludes(await page.title(), expectedTitleContains, 'document.title during print');
  }
  const screenDisplay = await page.locator('#carnet').evaluate((el) => getComputedStyle(el).display);
  assertEqual(screenDisplay, 'none', '#carnet must be hidden on screen media');

  try {
    await page.emulateMedia({ media: 'print' });
    const printStyles = await page.evaluate(() => ({
      carnetDisplay: getComputedStyle(document.querySelector('#carnet')).display,
      principalDisplay: getComputedStyle(document.querySelector('#principal')).display,
    }));
    assertEqual(printStyles.carnetDisplay, 'block', '#carnet must be visible (block) in print media');
    assertEqual(printStyles.principalDisplay, 'none', '#principal must be hidden in print media');
    if (typeof onPrint === 'function') {
      await onPrint(page);
    }
  } finally {
    await page.emulateMedia({ media: 'screen' });
  }

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.waitForFunction(() => {
    const c = document.querySelector('#carnet');
    return !c || c.children.length === 0;
  }, { timeout: 5000 });
  assertEqual(await page.title(), titleBefore, 'document.title restored after print');
}

async function triggerBackgroundRelock(page, elapsedMs = 305000) {
  await page.evaluate((ms) => {
    const origDesc = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const origDateNow = Date.now;
    let fakeState = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => fakeState,
    });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      const shifted = origDateNow() + ms;
      Date.now = () => shifted;
      fakeState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    } finally {
      Date.now = origDateNow;
      if (origDesc) Object.defineProperty(document, 'visibilityState', origDesc);
      else delete document.visibilityState;
    }
  }, elapsedMs);
  await page.locator('#verrou:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
}

module.exports = {
  loadPlaywright,
  launchBrowser,
  withAppContext,
  openApp,
  reloadApp,
  waitForReady,
  dismissWelcome,
  goTab,
  openPet,
  openAnimalSection,
  loadDemoData,
  createPet,
  submitForm,
  confirmDialog,
  uploadSamplePng,
  triggerBackupDownload,
  captureDownload,
  createSamplePngBuffer,
  createCorruptPngBuffer,
  isoDateOffset,
  frDate,
  assert,
  assertEqual,
  assertIncludes,
  assertTruthy,
  assertMatch,
  waitForSwReady,
  ensureSwControlled,
  setOfflineWithSw,
  getCachedPaths,
  assertFieldError,
  uploadFileBuffer,
  uploadJsonImport,
  rapidDoubleClick,
  submitAnimalForm,
  createVet,
  addWeighIn,
  addVaccine,
  addAntiparasitic,
  addTreatment,
  addAppointment,
  addTask,
  addNote,
  activatePassword,
  unlockApp,
  restoreBackup,
  wipeAllData,
  unfoldIcs,
  captureWindowOpen,
  probePrintView,
  triggerBackgroundRelock,
  openGarde,
  submitGardeForm,
  openArchives,
  openAnimalFromView,
};
