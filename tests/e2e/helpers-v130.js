/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Opaque-box E2E helpers for v1.3.0 evolutions (R1-R5) — omni-animalia */
'use strict';

const fs = require('fs');
const helpers = require('./helpers');

const {
  openApp,
  reloadApp,
  goTab,
  openPet,
  openAnimalSection,
  submitForm,
  submitAnimalForm,
  submitGardeForm,
  confirmDialog,
  assertFieldError,
  uploadSamplePng,
  uploadFileBuffer,
  uploadJsonImport,
  rapidDoubleClick,
  loadDemoData,
  createPet,
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
  triggerBackgroundRelock,
  triggerBackupDownload,
  captureDownload,
  waitForSwReady,
  ensureSwControlled,
  setOfflineWithSw,
  getCachedPaths,
  openGarde,
  openArchives,
  openAnimalFromView,
  captureWindowOpen,
  unfoldIcs,
  isoDateOffset,
  frDate,
  createSamplePngBuffer,
  createCorruptPngBuffer,
  assert,
  assertEqual,
  assertIncludes,
  assertTruthy,
  assertMatch,
} = helpers;

/* ---------- Date Utilities ---------- */

function isoMonthsOffset(months, extraDays = 0) {
  const now = new Date();
  const anchor = now.getDate();
  let y = now.getFullYear();
  let m = now.getMonth() + months;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  const maxDay = new Date(y, m + 1, 0).getDate();
  const d = new Date(y, m, Math.min(anchor, maxDay));
  if (extraDays) d.setDate(d.getDate() + extraDays);
  const yy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/* ---------- Resilient Print Stub & Carnet Probe ---------- */

async function withPrintStubV130(page, fn) {
  if (typeof helpers.withPrintStub === 'function') {
    return helpers.withPrintStub(page, fn);
  }
  await page.evaluate(() => {
    window.__omniPrintOrig = window.print;
    window.__omniPrintCount = 0;
    window.print = () => {
      window.__omniPrintCount += 1;
    };
  });
  try {
    return await fn({
      getPrintCallCount: () => page.evaluate(() => window.__omniPrintCount || 0),
    });
  } finally {
    await page.evaluate(() => {
      if (Object.prototype.hasOwnProperty.call(window, '__omniPrintOrig')) {
        window.print = window.__omniPrintOrig;
        delete window.__omniPrintOrig;
      }
      delete window.__omniPrintCount;
    }).catch(() => {});
  }
}

async function probePrintViewV130(page, triggerFn, {
  carnetChildSelector = '> *',
  expectedTitleContains,
  expectedTitleRestore,
  onPrint,
} = {}) {
  const titleBefore = expectedTitleRestore !== undefined ? expectedTitleRestore : await page.title();
  return withPrintStubV130(page, async (stub) => {
    await triggerFn();
    await page.locator(`#carnet ${carnetChildSelector}`).first().waitFor({ state: 'attached', timeout: 10000 });
    assertEqual(await stub.getPrintCallCount(), 1, 'window.print() must be called once');
    if (expectedTitleContains) {
      assertIncludes(await page.title(), expectedTitleContains, 'document.title during print');
    }
    const screenDisplay = await page.locator('#carnet').evaluate((el) => getComputedStyle(el).display);
    assertEqual(screenDisplay, 'none', '#carnet must stay hidden in screen media');

    try {
      await page.emulateMedia({ media: 'print' });
      const styles = await page.evaluate(() => ({
        carnetDisplay: getComputedStyle(document.querySelector('#carnet')).display,
        principalDisplay: getComputedStyle(document.querySelector('#principal')).display,
      }));
      assertEqual(styles.carnetDisplay, 'block', '#carnet must be display:block in print media');
      assertEqual(styles.principalDisplay, 'none', '#principal must be display:none in print media');
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
    }, null, { timeout: 5000 });
    assertEqual(await page.title(), titleBefore, 'document.title restored after afterprint');
  });
}

/* ---------- Clipboard & Web Share Spies (Context-Isolated, Opaque-Box) ---------- */

async function setupClipboardSpy(page, { failWrite = false } = {}) {
  await page.evaluate(({ shouldFail }) => {
    window.__omniClipboardTexts = [];
    window.__omniHadOwnClipboard = Object.prototype.hasOwnProperty.call(navigator, 'clipboard');
    window.__omniOrigClipboardDesc = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    window.__omniOrigExecCommand = document.execCommand;
    const fakeClipboard = {
      writeText: async (text) => {
        if (shouldFail) {
          throw new DOMException('Clipboard write denied', 'NotAllowedError');
        }
        window.__omniClipboardTexts.push(String(text));
      },
      readText: async () => (
        window.__omniClipboardTexts.length
          ? window.__omniClipboardTexts[window.__omniClipboardTexts.length - 1]
          : ''
      ),
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => fakeClipboard,
    });
    document.execCommand = (cmd) => {
      if (cmd === 'copy') {
        if (shouldFail) return false;
        const active = document.activeElement;
        if (active && typeof active.value === 'string') {
          window.__omniClipboardTexts.push(active.value);
          return true;
        }
      }
      if (typeof window.__omniOrigExecCommand === 'function') {
        try {
          return window.__omniOrigExecCommand.call(document, cmd);
        } catch (e) {
          return false;
        }
      }
      return false;
    };
  }, { shouldFail: !!failWrite });

  return {
    async getTexts() {
      return page.evaluate(() => (Array.isArray(window.__omniClipboardTexts) ? window.__omniClipboardTexts.slice() : []));
    },
    async lastText() {
      const texts = await this.getTexts();
      return texts.length ? texts[texts.length - 1] : '';
    },
    async restore() {
      await page.evaluate(() => {
        if (Object.prototype.hasOwnProperty.call(window, '__omniHadOwnClipboard')) {
          if (window.__omniHadOwnClipboard && window.__omniOrigClipboardDesc) {
            Object.defineProperty(navigator, 'clipboard', window.__omniOrigClipboardDesc);
          } else {
            delete navigator.clipboard;
          }
          delete window.__omniHadOwnClipboard;
          delete window.__omniOrigClipboardDesc;
        }
        if (Object.prototype.hasOwnProperty.call(window, '__omniOrigExecCommand')) {
          document.execCommand = window.__omniOrigExecCommand;
          delete window.__omniOrigExecCommand;
        }
        delete window.__omniClipboardTexts;
      }).catch(() => {});
    },
  };
}

async function setupShareSpy(page, {
  mode = 'resolve',
  errorName = 'AbortError',
  canShare = true,
  exposeShare = true,
} = {}) {
  await page.evaluate(({ m, errName, can, expose }) => {
    window.__omniShareCalls = [];
    window.__omniHadShare = Object.prototype.hasOwnProperty.call(navigator, 'share');
    window.__omniOrigShareDesc = Object.getOwnPropertyDescriptor(navigator, 'share');
    window.__omniHadCanShare = Object.prototype.hasOwnProperty.call(navigator, 'canShare');
    window.__omniOrigCanShareDesc = Object.getOwnPropertyDescriptor(navigator, 'canShare');

    if (!expose) {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
      return;
    }

    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      writable: true,
      value: () => Boolean(can),
    });

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: async (data) => {
        window.__omniShareCalls.push({
          title: data && data.title !== undefined ? String(data.title) : '',
          text: data && data.text !== undefined ? String(data.text) : '',
          filesCount: data && Array.isArray(data.files) ? data.files.length : 0,
        });
        if (m === 'reject') {
          throw new DOMException('Share rejected', errName);
        }
      },
    });
  }, { m: mode, errName: errorName, can: canShare, expose: exposeShare });

  return {
    async getCalls() {
      return page.evaluate(() => (Array.isArray(window.__omniShareCalls) ? window.__omniShareCalls.slice() : []));
    },
    async restore() {
      await page.evaluate(() => {
        if (window.__omniHadShare && window.__omniOrigShareDesc) {
          Object.defineProperty(navigator, 'share', window.__omniOrigShareDesc);
        } else {
          delete navigator.share;
        }
        if (window.__omniHadCanShare && window.__omniOrigCanShareDesc) {
          Object.defineProperty(navigator, 'canShare', window.__omniOrigCanShareDesc);
        } else {
          delete navigator.canShare;
        }
        delete window.__omniHadShare;
        delete window.__omniOrigShareDesc;
        delete window.__omniHadCanShare;
        delete window.__omniOrigCanShareDesc;
        delete window.__omniShareCalls;
      }).catch(() => {});
    },
  };
}

/* ---------- R1 Helpers: Garde Share, Lost Pet Sheet, Emergency Vet ---------- */

async function captureShareBaseline(page) {
  return page.evaluate(() => {
    const ann = document.querySelector('#annonce');
    return {
      shareCount: Array.isArray(window.__omniShareCalls) ? window.__omniShareCalls.length : 0,
      clipCount: Array.isArray(window.__omniClipboardTexts) ? window.__omniClipboardTexts.length : 0,
      annonce: ann ? ann.textContent : '',
    };
  });
}

async function waitForShareOutcome(page, before, timeout = 5000) {
  await page.waitForFunction((prev) => {
    const shareCount = Array.isArray(window.__omniShareCalls) ? window.__omniShareCalls.length : 0;
    const clipCount = Array.isArray(window.__omniClipboardTexts) ? window.__omniClipboardTexts.length : 0;
    const ann = document.querySelector('#annonce');
    const annText = ann ? ann.textContent : '';
    return shareCount > prev.shareCount || clipCount > prev.clipCount || (annText !== prev.annonce && annText.trim().length > 0);
  }, before, { timeout });
}

async function clickGardeShare(page) {
  const btn = page.locator('#garde-contenu').getByRole('button', { name: /Partager\s*\/\s*Copier/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  const before = await captureShareBaseline(page);
  await btn.click();
  await waitForShareOutcome(page, before, 5000);
}

async function triggerLostPetSheet(page, { closeDialogIfShown = true } = {}) {
  const btn = page.locator('#animal-contenu').getByRole('button', { name: /Fiche animal perdu/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  const before = await captureShareBaseline(page);
  await btn.click();

  const dlg = page.locator('dialog#dialogue[open]');
  const dlgP = dlg.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'dialog');
  const outcomeP = waitForShareOutcome(page, before, 5000).then(() => 'acted');
  let outcome;
  try {
    outcome = await Promise.race([dlgP, outcomeP]);
  } finally {
    dlgP.catch(() => {});
    outcomeP.catch(() => {});
  }

  let dialogText = null;
  if (outcome === 'dialog') {
    dialogText = await dlg.textContent();
    const copyBtn = dlg.locator('.dialogue-boutons').getByRole('button', { name: /Partager|Copier/i }).first();
    if (await copyBtn.count()) {
      const beforeCopy = await captureShareBaseline(page);
      await copyBtn.click();
      await Promise.all([
        page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 }).catch(() => {}),
        waitForShareOutcome(page, beforeCopy, 5000),
      ]);
    } else if (closeDialogIfShown) {
      const closeBtn = dlg.locator('.dialogue-boutons button').first();
      if (await closeBtn.count()) {
        await closeBtn.click();
        await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      }
    }
  }
  return { dialogText };
}

function getEmergencyVetBlock(page) {
  return page.locator(
    '.vue[data-vue="veterinaires"] #veto-urgence, ' +
    '.vue[data-vue="veterinaires"] #vetos-urgence, ' +
    '.vue[data-vue="veterinaires"] .bloc-urgence, ' +
    '.vue[data-vue="veterinaires"] .carte-urgence'
  ).first();
}

async function findEmergencyVetContainer(page) {
  const explicit = getEmergencyVetBlock(page);
  if ((await explicit.count()) > 0) return explicit;
  return page
    .locator('.vue[data-vue="veterinaires"] section, .vue[data-vue="veterinaires"] article, .vue[data-vue="veterinaires"] .bloc')
    .filter({ hasText: /urgence|24\s*h/i })
    .first();
}

async function openEmergencyVetForm(page) {
  const vetoVisible = await page.locator('.vue[data-vue="veterinaires"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!vetoVisible) {
    await goTab(page, 'veterinaires');
  }
  const container = await findEmergencyVetContainer(page);
  let btn = container.getByRole('button', { name: /Configurer|Ajouter|Modifier|Renseigner|Urgence/i }).first();
  if ((await btn.count()) === 0) {
    btn = page
      .locator('.vue[data-vue="veterinaires"]')
      .getByRole('button', { name: /vétérinaire d[’']urgence|clinique 24|urgence/i })
      .first();
  }
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
}

async function configureEmergencyVet(page, data = {}, { expectErrors = false } = {}) {
  await openEmergencyVetForm(page);
  const champs = [
    ['nom', '#champ-nom'],
    ['clinique', '#champ-clinique'],
    ['telephone', '#champ-telephone'],
    ['adresse', '#champ-adresse'],
    ['notes', '#champ-notes'],
  ];
  for (const [key, sel] of champs) {
    if (data[key] !== undefined) {
      const input = page.locator(sel);
      assert((await input.count()) > 0, `Missing emergency vet field "${sel}" for "${key}"`);
      await input.fill(String(data[key]));
    }
  }
  const prevUrgChild = !expectErrors && (await page.locator('#veto-urgence > *').count()) > 0
    ? await page.locator('#veto-urgence > *').first().elementHandle().catch(() => null)
    : (!expectErrors && (await page.locator('#vetos-liste > *').count()) > 0
      ? await page.locator('#vetos-liste > *').first().elementHandle().catch(() => null)
      : null);
  try {
    await submitForm(page, { expectErrors });
    if (!expectErrors) {
      await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
      if (prevUrgChild) {
        await page.waitForFunction((el) => !el.isConnected, prevUrgChild, { timeout: 10000 });
      }
      await page.locator('#veto-urgence').waitFor({ state: 'visible', timeout: 10000 });
      await page.locator('#veto-urgence h2').waitFor({ state: 'visible', timeout: 10000 });
    }
  } finally {
    if (prevUrgChild) await prevUrgChild.dispose().catch(() => {});
  }
}

async function clearEmergencyVet(page) {
  const vetoVisible = await page.locator('.vue[data-vue="veterinaires"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!vetoVisible) {
    await goTab(page, 'veterinaires');
  }
  const container = await findEmergencyVetContainer(page);
  const delBtn = container.getByRole('button', { name: /Supprimer|Effacer|Retirer/i }).first();
  if ((await delBtn.count()) > 0) {
    await delBtn.click();
    const dlg = page.locator('dialog#dialogue[open]');
    if (await dlg.waitFor({ state: 'visible', timeout: 700 }).then(() => true).catch(() => false)) {
      const yesBtn = dlg.locator('.dialogue-boutons').getByRole('button', { name: /Supprimer|Effacer|Retirer|Confirmer/i }).first();
      await yesBtn.click();
      await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 });
    }
    await delBtn.waitFor({ state: 'detached', timeout: 10000 });
    return;
  }
  await configureEmergencyVet(page, { nom: '', clinique: '', telephone: '', adresse: '', notes: '' });
}

/* ---------- R2 Helpers: Encrypted Backup Export & Restore ---------- */

async function exportBackupWithPassword(page, password, {
  checkEncryptionBox = true,
  expectPasswordError = false,
} = {}) {
  const reglagesVisible = await page.locator('.vue[data-vue="reglages"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!reglagesVisible) {
    await goTab(page, 'reglages');
  }

  const checkbox = page.locator('#sauvegarde-chiffree').or(
    page.locator('#reglages-contenu').getByLabel(/Protéger la sauvegarde par mot de passe/i)
  ).first();
  await checkbox.waitFor({ state: 'visible', timeout: 10000 });
  if (checkEncryptionBox && !(await checkbox.isChecked())) {
    await checkbox.check();
  } else if (!checkEncryptionBox && (await checkbox.isChecked())) {
    await checkbox.uncheck();
  }

  if (!checkEncryptionBox) {
    return triggerBackupDownload(page);
  }

  await page.locator('#bouton-sauvegarder').click();
  const dlg = page.locator('dialog#dialogue[open]');
  await dlg.waitFor({ state: 'visible', timeout: 10000 });

  const mdpInput = dlg.locator('#dialogue-mdp, input[type="password"]').first();
  await mdpInput.waitFor({ state: 'visible', timeout: 5000 });
  await mdpInput.fill(password);

  const confInput = dlg.locator('#dialogue-mdp-conf');
  if ((await confInput.count()) > 0) {
    await confInput.fill(password);
  } else {
    const allPwd = dlg.locator('input[type="password"]');
    if ((await allPwd.count()) > 1) {
      await allPwd.nth(1).fill(password);
    }
  }

  const submitBtn = dlg.locator('button[type="submit"], .dialogue-boutons button.principal').first();
  if (expectPasswordError) {
    await submitBtn.click();
    const errEl = dlg.locator('#dialogue-mdp-erreur:not([hidden]), .message-erreur:not([hidden])').first();
    await errEl.waitFor({ state: 'visible', timeout: 5000 });
    const errText = await errEl.textContent();
    const cancelBtn = dlg.locator('.dialogue-boutons').getByRole('button', { name: 'Annuler', exact: true });
    if (await cancelBtn.count()) {
      await cancelBtn.click();
      await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 });
    }
    return { errorText: errText };
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await submitBtn.click();

  const dlChoiceBtn = page.locator('dialog#dialogue[open] .dialogue-boutons').getByRole('button', { name: 'Télécharger', exact: true });
  const outcome = await Promise.race([
    downloadPromise.then((download) => ({ kind: 'download', download })),
    dlChoiceBtn
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => ({ kind: 'choice' }), () => new Promise(() => {})),
  ]);

  let download;
  if (outcome.kind === 'download') {
    download = outcome.download;
  } else {
    await dlChoiceBtn.click();
    download = await downloadPromise;
    await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 10000 });
  }

  const stream = await download.createReadStream();
  let raw;
  if (stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } else {
    raw = fs.readFileSync(await download.path(), 'utf8');
  }

  return {
    filename: download.suggestedFilename(),
    raw,
    data: JSON.parse(raw),
  };
}

async function restoreMaybeEncryptedBackup(page, filename, contentOrObj, {
  password,
  mode = 'remplacer',
  cancelPassword = false,
  expectDecryptError = false,
  expectFileRejected = false,
} = {}) {
  await uploadJsonImport(page, filename, contentOrObj);

  const dlg = page.locator('dialog#dialogue[open]');
  await dlg.waitFor({ state: 'visible', timeout: 10000 });

  if (expectFileRejected) {
    await dlg.locator('#dialogue-titre').filter({ hasText: 'Fichier refusé' }).waitFor({ state: 'visible', timeout: 10000 });
    const msg = await dlg.textContent();
    await confirmDialog(page, 'J’ai compris');
    return { rejected: true, message: msg };
  }

  const hasPwdPrompt = (await dlg.locator('#dialogue-mdp, input[type="password"]').count()) > 0;
  if (hasPwdPrompt) {
    if (cancelPassword) {
      await dlg.locator('.dialogue-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();
      await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 });
      return { cancelled: true };
    }

    await dlg.locator('#dialogue-mdp, input[type="password"]').first().fill(password || '');
    const decryptBtn = dlg.locator('button[type="submit"], .dialogue-boutons button.principal').first();
    await decryptBtn.click();

    if (expectDecryptError) {
      const errEl = dlg.locator('#dialogue-mdp-erreur:not([hidden]), .message-erreur:not([hidden])').first();
      await errEl.waitFor({ state: 'visible', timeout: 10000 });
      const errorText = await errEl.textContent();
      await dlg.locator('.dialogue-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();
      await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 });
      return { decryptError: errorText };
    }

    await dlg.locator('#dialogue-titre').filter({ hasText: /Restaurer cette sauvegarde/i }).waitFor({ state: 'visible', timeout: 15000 });
  }

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
  return { restored: true, promptedPassword: hasPwdPrompt };
}

/* ---------- R3 Helpers: Tab Dots & Rappels Filter ---------- */

function getAnimalTabDot(page, section) {
  return page.locator(
    `#animal-sections button[data-section="${section}"] .pastille-section, ` +
    `#animal-sections button[data-section="${section}"] .pastille, ` +
    `#animal-sections button[data-section="${section}"] [data-pastille]`
  );
}

async function filterRappelsByAnimal(page, animalNameOrAll) {
  const rappelsVisible = await page.locator('.vue[data-vue="rappels"]').evaluate((el) => !el.hidden).catch(() => false);
  if (!rappelsVisible) {
    await goTab(page, 'rappels');
  }
  const select = page.locator('.vue[data-vue="rappels"] select').first();
  if ((await select.count()) > 0) {
    const isAll = !animalNameOrAll || /^tous$/i.test(animalNameOrAll);
    if (isAll) {
      await select.selectOption({ index: 0 });
    } else {
      await select.selectOption({ label: animalNameOrAll }).catch(async () => {
        const val = await select.evaluate((el, target) => {
          const opt = [...el.options].find((o) => (o.textContent || '').includes(target));
          return opt ? opt.value : '';
        }, animalNameOrAll);
        assertTruthy(val, `Animal option "${animalNameOrAll}" in Rappels filter`);
        await select.selectOption(val);
      });
    }
    await page.waitForTimeout(50);
    return;
  }
  const labelRegex = (!animalNameOrAll || /^tous$/i.test(animalNameOrAll))
    ? /Tous/i
    : new RegExp(animalNameOrAll.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const btn = page.locator('.vue[data-vue="rappels"]').getByRole('button', { name: labelRegex }).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  await page.waitForTimeout(50);
}

/* ---------- R4 Helpers: Keyword Search, Chronologie, Ideal Weight ---------- */

async function searchAnimalKeyword(page, query) {
  const input = page.locator('.vue[data-vue="animal"] input[type="search"]').or(
    page.locator('.vue[data-vue="animal"]').getByRole('searchbox')
  ).first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(query);
  await page.waitForTimeout(60);
  return input;
}

async function openChronologieTab(page) {
  const btn = page.locator('#animal-sections button[data-section="chronologie"]').or(
    page.locator('#animal-sections').getByRole('button', { name: /Chronologie/i })
  ).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  const prevHeading = (await page.locator('#animal-contenu h2').count()) > 0
    ? await page.locator('#animal-contenu h2').first().elementHandle().catch(() => null)
    : null;
  try {
    await btn.click();
    await btn.locator('xpath=self::*[@aria-current="true"]').waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    if (prevHeading) {
      await page.waitForFunction((el) => !el.isConnected, prevHeading, { timeout: 10000 });
    }
  } finally {
    if (prevHeading) await prevHeading.dispose().catch(() => {});
  }
  await page.locator('#animal-contenu h2').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function configureIdealWeight(page, { min, max, expectErrors = false } = {}) {
  const btn = page.locator('#animal-contenu').getByRole('button', { name: /poids idéal|fourchette/i }).first();
  if ((await btn.count()) > 0) {
    await btn.click();
    const formVisible = await page.locator('.vue[data-vue="formulaire"]:not([hidden])').isVisible().catch(() => false);
    if (formVisible) {
      const minEl = page.locator('#champ-poidsIdealMin');
      const maxEl = page.locator('#champ-poidsIdealMax');
      if (min !== undefined) {
        assert((await minEl.count()) > 0, 'Missing ideal weight field "#champ-poidsIdealMin"');
        await minEl.fill(String(min));
      }
      if (max !== undefined) {
        assert((await maxEl.count()) > 0, 'Missing ideal weight field "#champ-poidsIdealMax"');
        await maxEl.fill(String(max));
      }
      if (expectErrors) {
        await submitForm(page, { expectErrors: true });
      } else {
        await submitAnimalForm(page, 'Poids');
      }
      return;
    }
    const dlg = page.locator('dialog#dialogue[open]');
    if (await dlg.isVisible().catch(() => false)) {
      const inputs = dlg.locator('input');
      if (min !== undefined && (await inputs.count()) >= 1) await inputs.nth(0).fill(String(min));
      if (max !== undefined && (await inputs.count()) >= 2) await inputs.nth(1).fill(String(max));
      await dlg.locator('button[type="submit"], .dialogue-boutons button.principal').first().click();
      if (!expectErrors) {
        await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 });
      }
      return;
    }
  }

  // Fallback: inline inputs directly in Poids section
  const minInline = page.locator('#animal-contenu #champ-poidsIdealMin, #animal-contenu input[name*="poidsIdealMin"], #animal-contenu').getByLabel(/min/i).first();
  const maxInline = page.locator('#animal-contenu #champ-poidsIdealMax, #animal-contenu input[name*="poidsIdealMax"], #animal-contenu').getByLabel(/max/i).first();
  if (min !== undefined) await minInline.fill(String(min));
  if (max !== undefined) await maxInline.fill(String(max));
  const saveInline = page.locator('#animal-contenu').getByRole('button', { name: /Enregistrer|Valider|Appliquer/i }).first();
  if ((await saveInline.count()) > 0) {
    await saveInline.click();
  }
}

async function clearIdealWeight(page) {
  const clearBtn = page.locator('#animal-contenu').getByRole('button', { name: /Effacer.*poids idéal|Supprimer.*fourchette|Retirer.*fourchette/i }).first();
  if ((await clearBtn.count()) > 0) {
    const prevHeading = (await page.locator('#animal-contenu h2').count()) > 0
      ? await page.locator('#animal-contenu h2').first().elementHandle().catch(() => null)
      : null;
    try {
      await clearBtn.click();
      const dlg = page.locator('dialog#dialogue[open]');
      if (await dlg.waitFor({ state: 'visible', timeout: 500 }).then(() => true).catch(() => false)) {
        await dlg.locator('.dialogue-boutons button.principal, .dialogue-boutons button.danger').first().click();
        await page.locator('dialog#dialogue:not([open])').waitFor({ state: 'attached', timeout: 5000 });
      }
      if (prevHeading) {
        await page.waitForFunction((el) => !el.isConnected, prevHeading, { timeout: 10000 });
      }
      await page.locator('#animal-contenu h2').filter({ hasText: 'Poids' }).waitFor({ state: 'visible', timeout: 10000 });
    } finally {
      if (prevHeading) await prevHeading.dispose().catch(() => {});
    }
    return;
  }
  await configureIdealWeight(page, { min: '', max: '' });
}

/* ---------- R5 Helpers: Identité Passport/Insurance & Carnet Print Options ---------- */

async function editAnimalIdentity(page, fields = {}, { expectErrors = false } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’identité', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });

  const map = {
    nom: '#champ-nom',
    espece: '#champ-espece',
    race: '#champ-race',
    couleur: '#champ-couleur',
    puce: '#champ-puce',
    tatouage: '#champ-tatouage',
    notes: '#champ-notes',
    passeport: '#champ-passeport',
    assuranceCompagnie: '#champ-assuranceCompagnie',
    assuranceContrat: '#champ-assuranceContrat',
    assuranceTelephone: '#champ-assuranceTelephone',
  };
  for (const [k, sel] of Object.entries(map)) {
    if (fields[k] !== undefined) {
      const input = page.locator(sel);
      assert((await input.count()) > 0, `Missing animal identity field "${sel}" for "${k}"`);
      await input.fill(String(fields[k]));
    }
  }
  if (fields.unitePoids !== undefined) {
    await page.locator(`[data-champ="unitePoids"] input[type="radio"][value="${fields.unitePoids}"]`).check();
  }

  if (expectErrors) {
    await submitForm(page, { expectErrors: true });
  } else {
    await submitAnimalForm(page, 'Identité');
  }
}

async function applyCarnetOptionsInScope(scope, { periode, annexe, strict = false } = {}) {
  let periodeApplied = false;
  let annexeApplied = false;

  if (periode !== undefined) {
    const is12m = /12/i.test(String(periode));
    const targetRadio = is12m
      ? scope.getByLabel(/12 derniers mois/i).first()
      : scope.getByLabel(/Tout l[’']historique|Tout\b/i).first();
    if ((await targetRadio.count()) > 0) {
      const tag = await targetRadio.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      assertEqual(tag, 'input', `Expected input element for carnet period "${periode}"`);
      await targetRadio.check();
      periodeApplied = true;
    } else {
      const select = scope.locator('select').first();
      if ((await select.count()) > 0) {
        await select.selectOption({ value: is12m ? '12mois' : 'tout' }).catch(async () => {
          const val = await select.evaluate((el, want12) => {
            const opt = [...el.options].find((o) => want12 ? /12/i.test(o.textContent || o.value) : /tout/i.test(o.textContent || o.value));
            return opt ? opt.value : '';
          }, is12m);
          assertTruthy(val, `Carnet period option "${periode}" in select`);
          await select.selectOption(val);
        });
        periodeApplied = true;
      }
    }
    if (strict) {
      assert(periodeApplied, `Carnet period control not found for periode="${periode}"`);
    }
  }

  if (annexe !== undefined) {
    const annexeBox = scope.getByLabel(/annexe|photos|ordonnances|documents/i).first();
    if ((await annexeBox.count()) > 0) {
      const checked = await annexeBox.isChecked();
      if (annexe && !checked) await annexeBox.check();
      else if (!annexe && checked) await annexeBox.uncheck();
      annexeApplied = true;
    }
    if (strict) {
      assert(annexeApplied, `Carnet appendix control not found for annexe=${annexe}`);
    }
  }

  return { periodeApplied, annexeApplied };
}

async function printCarnetWithOptions(page, {
  periode,
  annexe,
  expectedTitleContains,
  onPrint,
} = {}) {
  const titleBefore = await page.title();
  return withPrintStubV130(page, async (stub) => {
    let applied = await applyCarnetOptionsInScope(page.locator('#animal-contenu'), { periode, annexe });

    await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();

    const carnetWait = page.locator('#carnet .carnet-entete').waitFor({ state: 'attached', timeout: 8000 }).then(() => 'carnet');
    const dlgWait = page.locator('dialog#dialogue[open]').waitFor({ state: 'visible', timeout: 8000 }).then(() => 'dialog');
    const formWait = page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible', timeout: 8000 }).then(() => 'form');

    let first;
    try {
      first = await Promise.race([carnetWait, dlgWait, formWait]);
    } finally {
      carnetWait.catch(() => {});
      dlgWait.catch(() => {});
      formWait.catch(() => {});
    }
    if (first === 'dialog') {
      const dlg = page.locator('dialog#dialogue[open]');
      const dlgApplied = await applyCarnetOptionsInScope(dlg, { periode, annexe });
      applied = {
        periodeApplied: applied.periodeApplied || dlgApplied.periodeApplied,
        annexeApplied: applied.annexeApplied || dlgApplied.annexeApplied,
      };
      const goBtn = dlg.locator('button[type="submit"], .dialogue-boutons button.principal').or(
        dlg.locator('.dialogue-boutons').getByRole('button', { name: /Imprimer|Continuer|PDF|Générer/i })
      ).first();
      await goBtn.click();
      await page.locator('#carnet .carnet-entete').waitFor({ state: 'attached', timeout: 10000 });
    } else if (first === 'form') {
      const formVue = page.locator('.vue[data-vue="formulaire"]:not([hidden])');
      const formApplied = await applyCarnetOptionsInScope(formVue, { periode, annexe });
      applied = {
        periodeApplied: applied.periodeApplied || formApplied.periodeApplied,
        annexeApplied: applied.annexeApplied || formApplied.annexeApplied,
      };
      await formVue.locator('form.formulaire button[type="submit"]').click();
      await page.locator('#carnet .carnet-entete').waitFor({ state: 'attached', timeout: 10000 });
    }

    if (periode !== undefined) {
      assert(applied.periodeApplied, `Carnet period control not found for periode="${periode}"`);
    }
    if (annexe !== undefined) {
      assert(applied.annexeApplied, `Carnet appendix control not found for annexe=${annexe}`);
    }

    assertEqual(await stub.getPrintCallCount(), 1, 'window.print() must be called once for carnet');
    if (expectedTitleContains) {
      assertIncludes(await page.title(), expectedTitleContains);
    }

    try {
      await page.emulateMedia({ media: 'print' });
      const styles = await page.evaluate(() => ({
        carnetDisplay: getComputedStyle(document.querySelector('#carnet')).display,
        principalDisplay: getComputedStyle(document.querySelector('#principal')).display,
      }));
      assertEqual(styles.carnetDisplay, 'block', '#carnet display:block in print');
      assertEqual(styles.principalDisplay, 'none', '#principal display:none in print');
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
    }, null, { timeout: 5000 });
    assertEqual(await page.title(), titleBefore, 'document.title restored after carnet print');
  });
}

module.exports = {
  ...helpers,
  isoMonthsOffset,
  withPrintStubV130,
  probePrintViewV130,
  setupClipboardSpy,
  setupShareSpy,
  clickGardeShare,
  triggerLostPetSheet,
  getEmergencyVetBlock,
  findEmergencyVetContainer,
  openEmergencyVetForm,
  configureEmergencyVet,
  clearEmergencyVet,
  exportBackupWithPassword,
  restoreMaybeEncryptedBackup,
  getAnimalTabDot,
  filterRappelsByAnimal,
  searchAnimalKeyword,
  openChronologieTab,
  configureIdealWeight,
  clearIdealWeight,
  editAnimalIdentity,
  printCarnetWithOptions,
};
