/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 2 — R1-R5 Boundary, Corner-Case & Negative Tests
   (50 opaque-box tests across E2E-F16..E2E-F25, 5 per feature area) */
'use strict';

const {
  assert,
  assertEqual,
  assertIncludes,
  assertTruthy,
  assertMatch,
  reloadApp,
  goTab,
  openPet,
  openAnimalSection,
  openGarde,
  submitGardeForm,
  submitAnimalForm,
  submitForm,
  confirmDialog,
  assertFieldError,
  uploadSamplePng,
  uploadJsonImport,
  rapidDoubleClick,
  createPet,
  addWeighIn,
  addVaccine,
  addAntiparasitic,
  addTreatment,
  addAppointment,
  addTask,
  addNote,
  activatePassword,
  triggerBackgroundRelock,
  wipeAllData,
  isoDateOffset,
  isoMonthsOffset,
  setupClipboardSpy,
  setupShareSpy,
  clickGardeShare,
  triggerLostPetSheet,
  openEmergencyVetForm,
  configureEmergencyVet,
  exportBackupWithPassword,
  restoreMaybeEncryptedBackup,
  getAnimalTabDot,
  filterRappelsByAnimal,
  searchAnimalKeyword,
  openChronologieTab,
  configureIdealWeight,
  editAnimalIdentity,
  printCarnetWithOptions,
  withPrintStubV130,
} = require('./helpers-v130');

const tests = [
  /* =========================================================================
     E2E-F16-T2 — R1: Garde Share Boundaries
     ========================================================================= */
  {
    id: 'E2E-F16-T2-01',
    feature: 'E2E-F16',
    title: 'Handle navigator.share AbortError silently without error toast',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const share = await setupShareSpy(page, { mode: 'reject', errorName: 'AbortError' });
      try {
        await createPet(page, { nom: 'Moka', espece: 'Chat' });
        await openPet(page, 'Moka', 'identite');
        await openGarde(page);

        await clickGardeShare(page);
        await page.waitForFunction(() => Array.isArray(window.__omniShareCalls) && window.__omniShareCalls.length === 1);
        await page.waitForTimeout(80);
        assertEqual(await page.locator('#annonce.erreur').count(), 0, 'AbortError must not trigger error toast');
      } finally {
        await share.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-T2-02',
    feature: 'E2E-F16',
    title: 'Fall back to clipboard copy when navigator.share rejects with non-abort error',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const share = await setupShareSpy(page, { mode: 'reject', errorName: 'NotAllowedError' });
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Nala', espece: 'Chat' });
        await openPet(page, 'Nala', 'identite');
        await openGarde(page);

        await clickGardeShare(page);
        await page.locator('#annonce').filter({ hasText: /copié/i }).waitFor({ state: 'visible', timeout: 5000 });
        assertIncludes(await clip.lastText(), 'Nala');
      } finally {
        await clip.restore();
        await share.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-T2-03',
    feature: 'E2E-F16',
    title: 'Handle long multiline consignesGarde, alimEviter, and XSS/special chars safely in Garde share text',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        const longText = 'Ligne 1 : éàù « guillemets » & <script>window.__xss=1</script>\n' + 'A'.repeat(900);
        await createPet(page, { nom: 'Léo', espece: 'Chien' });
        await openPet(page, 'Léo', 'alimentation');
        await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-alimEviter').fill('<img src=x onerror=window.__xss=2> & Chocolat');
        await submitAnimalForm(page, 'Alimentation');

        await openAnimalSection(page, 'identite');
        await openGarde(page);
        await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter des consignes', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-consignesGarde').fill(longText);
        await submitGardeForm(page);

        await clickGardeShare(page);
        const copied = await clip.lastText();
        assertIncludes(copied, '<script>window.__xss=1</script>');
        assertIncludes(copied, '<img src=x onerror=window.__xss=2> & Chocolat');
        assert(!copied.includes('&lt;script&gt;'), 'Plain-text summary must not double-escape HTML entities');
        assertEqual(await page.evaluate(() => window.__xss), undefined, 'XSS payload must not execute');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-T2-04',
    feature: 'E2E-F16',
    title: 'Exclude terminated treatments and >30-day reminders from Garde shared text',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Bounty', espece: 'Chien' });
        await openPet(page, 'Bounty', 'traitements');
        await addTreatment(page, { nom: 'MedActif', debut: isoDateOffset(0), statut: 'en-cours' });
        await addTreatment(page, { nom: 'MedTermine', debut: isoDateOffset(-10), fin: isoDateOffset(-2), statut: 'termine' });

        await openAnimalSection(page, 'vaccins');
        await addVaccine(page, { nom: 'Vaccin30j', date: isoDateOffset(-335), rappel: isoDateOffset(30) });
        await addVaccine(page, { nom: 'Vaccin31j', date: isoDateOffset(-334), rappel: isoDateOffset(31) });

        await openAnimalSection(page, 'identite');
        await openGarde(page);
        await clickGardeShare(page);

        const text = await clip.lastText();
        assertIncludes(text, 'MedActif');
        assertIncludes(text, 'Vaccin30j');
        assert(!text.includes('MedTermine'), 'Terminated treatment excluded from Garde share');
        assert(!text.includes('Vaccin31j'), '>30-day reminder excluded from Garde share');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-T2-05',
    feature: 'E2E-F16',
    title: 'Handle clipboard write failure gracefully without uncaught error',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const share = await setupShareSpy(page, { exposeShare: false });
      const clip = await setupClipboardSpy(page, { failWrite: true });
      try {
        await createPet(page, { nom: 'Kiwi', espece: 'Lapin' });
        await openPet(page, 'Kiwi', 'identite');
        await openGarde(page);

        await clickGardeShare(page);
        await page.locator('#annonce').waitFor({ state: 'visible', timeout: 5000 });
        const msg = await page.locator('#annonce').textContent();
        assertTruthy(msg && msg.trim().length > 0, 'Graceful announcement shown when clipboard fails');
      } finally {
        await clip.restore();
        await share.restore();
      }
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F17-T2 — R1: Emergency Vet Boundaries
     ========================================================================= */
  {
    id: 'E2E-F17-T2-01',
    feature: 'E2E-F17',
    title: 'Reject invalid emergency vet phone characters in form validation',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await configureEmergencyVet(
        page,
        { nom: 'Urgence', clinique: 'CHV', telephone: 'abc<script>' },
        { expectErrors: true }
      );
      await assertFieldError(page, 'telephone');
      await page.locator('.vue[data-vue="formulaire"] button.retour').click();
      await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-T2-02',
    feature: 'E2E-F17',
    title: 'Neutralize non-digit or javascript: emergency phone imported via JSON backup',
    run: async ({ page, assertNoRuntimeErrors }) => {
      for (const badTel of ['javascript:alert(1)', '---']) {
        const crafted = {
          format: 'omni-animaux-sauvegarde',
          versionFormat: 1,
          reglages: {
            vetoUrgence: { nom: 'Urgence Test', clinique: 'CHV', telephone: badTel },
          },
          donnees: { animaux: [], veterinaires: [] },
        };
        await uploadJsonImport(page, 'bad-urgence-tel.json', crafted);
        const dlg = page.locator('dialog#dialogue[open]');
        await dlg.waitFor({ state: 'visible', timeout: 10000 });
        const title = await dlg.locator('#dialogue-titre').textContent();
        if (title === 'Fichier refusé') {
          await confirmDialog(page, 'J’ai compris');
        } else {
          await confirmDialog(page, 'Remplacer', { expectNextDialog: true });
          await confirmDialog(page, 'Remplacer');
          await page.locator('#annonce').filter({ hasText: 'Restauration terminée' }).waitFor({ state: 'visible' });
          await goTab(page, 'veterinaires');
          assertEqual(await page.locator('.vue[data-vue="veterinaires"] a[href^="javascript:"]').count(), 0);
          assertEqual(await page.locator('.vue[data-vue="veterinaires"] a[href^="tel:"]').count(), 0);
        }
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-T2-03',
    feature: 'E2E-F17',
    title: 'Reject malformed vetoUrgence types or prototype pollution keys in backup import',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const badArrayJson = JSON.stringify({
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        reglages: { vetoUrgence: ['invalid'] },
        donnees: {},
      });
      await restoreMaybeEncryptedBackup(page, 'bad-urgence-arr.json', badArrayJson, { expectFileRejected: true });

      const protoJson = `{
        "format": "omni-animaux-sauvegarde",
        "versionFormat": 1,
        "reglages": {
          "vetoUrgence": {
            "__proto__": { "__omniPolluted": true },
            "nom": "Urgence Safe",
            "telephone": "01 40 00 11 22"
          }
        },
        "donnees": {}
      }`;
      await restoreMaybeEncryptedBackup(page, 'proto-urgence.json', protoJson, { mode: 'remplacer' });
      const polluted = await page.evaluate(() => ({
        plain: ({}).__omniPolluted,
        proto: Object.prototype.__omniPolluted,
      }));
      assertEqual(polluted.plain, undefined);
      assertEqual(polluted.proto, undefined);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-T2-04',
    feature: 'E2E-F17',
    title: 'Enforce max lengths on emergency vet fields without UI breakage',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await openEmergencyVetForm(page);
      const longStr = 'X'.repeat(600);
      await page.locator('#champ-nom').fill(longStr);
      await page.locator('#champ-clinique').fill(longStr);
      await page.locator('#champ-telephone').fill('0'.repeat(100));
      await page.locator('#champ-adresse').fill(longStr);

      const nomVal = await page.locator('#champ-nom').inputValue();
      const telVal = await page.locator('#champ-telephone').inputValue();
      assert(nomVal.length <= 200, `Emergency vet nom length bounded (got ${nomVal.length})`);
      assert(telVal.length <= 40, `Emergency vet telephone length bounded (got ${telVal.length})`);
      await submitForm(page);
      await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-T2-05',
    feature: 'E2E-F17',
    title: 'Handle clinic-only or required name contract cleanly on emergency vet form',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await openEmergencyVetForm(page);
      await page.locator('#champ-nom').fill('');
      await page.locator('#champ-clinique').fill('Clinique 24h');
      await page.locator('#champ-telephone').fill('01 55 44 33 22');
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();

      const hasErrors = await page.locator('#formulaire-erreurs:not([hidden])').isVisible().catch(() => false);
      if (hasErrors) {
        await assertFieldError(page, 'nom');
        await page.locator('#champ-nom').fill('Urgences 24h');
        await submitForm(page);
      } else {
        await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible' });
      }
      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0155443322"]').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F18-T2 — R1: Lost Pet Sheet Boundaries
     ========================================================================= */
  {
    id: 'E2E-F18-T2-01',
    feature: 'E2E-F18',
    title: 'Generate lost pet sheet cleanly when pet has no microchip, tattoo, color, or owner phone',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Flocon' });
        await openPet(page, 'Flocon', 'identite');
        const { dialogText } = await triggerLostPetSheet(page);
        const text = (await clip.lastText()) || dialogText || '';
        assertIncludes(text, 'Flocon');
        assert(!/\bundefined\b|\bNaN\b|\bnull\b/i.test(text), 'Minimal lost pet sheet has no undefined/NaN/null');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-T2-02',
    feature: 'E2E-F18',
    title: 'Handle navigator.share AbortError cleanly on Fiche animal perdu',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const share = await setupShareSpy(page, { mode: 'reject', errorName: 'AbortError' });
      try {
        await createPet(page, { nom: 'Gribouille', espece: 'Chat' });
        await openPet(page, 'Gribouille', 'identite');
        await triggerLostPetSheet(page);
        await page.waitForTimeout(80);
        assertEqual(await page.locator('#annonce.erreur').count(), 0, 'AbortError must not trigger error banner');
      } finally {
        await share.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-T2-03',
    feature: 'E2E-F18',
    title: 'Neutralize XSS strings in pet nom, couleur, and race when generating Fiche animal perdu',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        const xss = '<img src=x onerror=window.__xss=1>';
        await createPet(page, { nom: xss, espece: 'Chat', race: xss, couleur: xss });
        await openPet(page, xss, 'identite');
        const { dialogText } = await triggerLostPetSheet(page);
        const text = (await clip.lastText()) || dialogText || '';
        assertIncludes(text, xss);
        assertEqual(await page.evaluate(() => window.__xss), undefined, 'XSS payload must not execute');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-T2-04',
    feature: 'E2E-F18',
    title: 'Include normalized microchip spacing and tattoo in Fiche animal perdu',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, {
          nom: 'Simba',
          espece: 'Chien',
          puce: '250  2696  00001',
          tatouage: 'TAT-99',
        });
        await openPet(page, 'Simba', 'identite');
        const { dialogText } = await triggerLostPetSheet(page);
        const text = (await clip.lastText()) || dialogText || '';
        assertIncludes(text, '250 2696 00001');
        assertIncludes(text, 'TAT-99');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-T2-05',
    feature: 'E2E-F18',
    title: 'Reflect contactGarde deletion immediately in Fiche animal perdu',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Max', espece: 'Chien' });
        await openPet(page, 'Max', 'identite');
        await openGarde(page);
        await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('Alice');
        await page.locator('#champ-telephone').fill('06 12 34 56 78');
        await submitGardeForm(page);

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        await triggerLostPetSheet(page);
        assertIncludes(await clip.lastText(), '06 12 34 56 78');

        await openGarde(page);
        await page.locator('#garde-contenu').getByRole('button', { name: /Modifier mon contact/ }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('');
        await page.locator('#champ-telephone').fill('');
        await submitGardeForm(page);

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        await triggerLostPetSheet(page);
        assert(!((await clip.lastText()).includes('06 12 34 56 78')), 'Deleted contact phone must not remain in lost pet sheet');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F19-T2 — R2: Encrypted Backup Boundaries & Security
     ========================================================================= */
  {
    id: 'E2E-F19-T2-01',
    feature: 'E2E-F19',
    title: 'Reject wrong password on encrypted backup restore without altering existing data',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'OtherPet', espece: 'Chat' });
      const backup = await exportBackupWithPassword(page, 'GoodPass2026');
      await wipeAllData(page);

      await createPet(page, { nom: 'SafePet', espece: 'Chien' });
      const res = await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, {
        password: 'WrongPassword!',
        expectDecryptError: true,
      });
      assertIncludes(res.decryptError, 'Mot de passe incorrect');

      await goTab(page, 'accueil');
      const home = await page.locator('#accueil-liste').textContent();
      assertIncludes(home, 'SafePet');
      assert(!home.includes('OtherPet'), 'Failed decryption must not import OtherPet');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-T2-02',
    feature: 'E2E-F19',
    title: 'Reject empty, whitespace-only, or short password when encryption option is enabled during export',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'TestPet', espece: 'Chat' });
      for (const badPwd of ['', '    ', 'abc']) {
        const res = await exportBackupWithPassword(page, badPwd, { expectPasswordError: true });
        assertTruthy(res.errorText && res.errorText.trim().length > 0, `Expected error for password "${badPwd}"`);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-T2-03',
    feature: 'E2E-F19',
    title: 'Handle user cancelling the decrypt password prompt cleanly',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'TempPet', espece: 'Chat' });
      const backup = await exportBackupWithPassword(page, 'CancelTest26');
      await wipeAllData(page);
      await createPet(page, { nom: 'StayPet', espece: 'Chien' });

      const res = await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, { cancelPassword: true });
      assertEqual(res.cancelled, true);

      await goTab(page, 'accueil');
      const home = await page.locator('#accueil-liste').textContent();
      assertIncludes(home, 'StayPet');
      assert(!home.includes('TempPet'));
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-T2-04',
    feature: 'E2E-F19',
    title: 'Reject tampered ciphertext, invalid base64 iv, and out-of-range KDF iterations',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'VaultPet', espece: 'Chien' });
      const backup = await exportBackupWithPassword(page, 'VaultKey2026');

      // 1. Flip 1 char inside AES-GCM ciphertext
      const tamperedCipher = structuredClone(backup.data);
      const last = tamperedCipher.donnees.slice(-1);
      tamperedCipher.donnees = tamperedCipher.donnees.slice(0, -1) + (last === 'A' ? 'B' : 'A');
      const r1 = await restoreMaybeEncryptedBackup(page, 'tampered.json', tamperedCipher, {
        password: 'VaultKey2026',
        expectDecryptError: true,
      });
      assertIncludes(r1.decryptError, 'Mot de passe incorrect ou sauvegarde abîmée');

      // 2. Invalid base64 iv
      const badIv = structuredClone(backup.data);
      badIv.iv = '!!!not-base64!!!';
      await restoreMaybeEncryptedBackup(page, 'bad-iv.json', badIv, { expectFileRejected: true });

      // 3. Invalid KDF iterations (excessive & zero)
      for (const iters of [10000000, 0]) {
        const badIter = structuredClone(backup.data);
        badIter.iterations = iters;
        await restoreMaybeEncryptedBackup(page, 'bad-iter.json', badIter, { expectFileRejected: true });
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-T2-05',
    feature: 'E2E-F19',
    title: 'Support Unicode/emoji password and produce distinct salt and IV across exports',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'EmojiPet', espece: 'Chat' });
      const pwd = 'Chien & Chat 🐾 2026';
      const b1 = await exportBackupWithPassword(page, pwd);
      const b2 = await exportBackupWithPassword(page, pwd);

      assert(b1.data.sel !== b2.data.sel, 'Two encrypted backups must use distinct random salts');
      assert(b1.data.iv !== b2.data.iv, 'Two encrypted backups must use distinct random IVs');

      await wipeAllData(page);
      const badSpace = await restoreMaybeEncryptedBackup(page, b1.filename, b1.raw, {
        password: pwd + ' ',
        expectDecryptError: true,
      });
      assertIncludes(badSpace.decryptError, 'Mot de passe incorrect');

      const ok = await restoreMaybeEncryptedBackup(page, b2.filename, b2.raw, {
        password: pwd,
        mode: 'remplacer',
      });
      assertEqual(ok.restored, true);
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'EmojiPet');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F20-T2 — R3: Daily Dose Badge & Tab Notification Dots Boundaries
     ========================================================================= */
  {
    id: 'E2E-F20-T2-01',
    feature: 'E2E-F20',
    title: 'Exclude future-start, expired, and terminated treatments from home daily dose badge',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bibi', espece: 'Chien' });
      await openPet(page, 'Bibi', 'traitements');
      await addTreatment(page, { nom: 'FuturMed', prisesParJour: 2, debut: isoDateOffset(2), statut: 'en-cours' });
      await addTreatment(page, { nom: 'ExpireMed', prisesParJour: 2, debut: isoDateOffset(-10), fin: isoDateOffset(-1), statut: 'en-cours' });
      await addTreatment(page, { nom: 'FiniMed', prisesParJour: 2, debut: isoDateOffset(-5), statut: 'termine' });

      await goTab(page, 'accueil');
      const cardText = await page.locator('#accueil-liste .carte-animal').textContent();
      assert(!/prise[s]?\s+à noter/i.test(cardText), 'Future/expired/terminated treatments must not show daily dose badge');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-T2-02',
    feature: 'E2E-F20',
    title: 'Exclude archived animals from home dose badges and nav badge calculations',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'ArchMed', espece: 'Chat' });
      await openPet(page, 'ArchMed', 'traitements');
      await addTreatment(page, { nom: 'Insuline', prisesParJour: 2, debut: isoDateOffset(-5), fin: '', statut: 'en-cours' });

      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="confié"]').check();
      await submitAnimalForm(page, 'Identité');

      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Aucun animal pour l’instant.');
      assertEqual(await page.locator('#nav-pastille').evaluate((el) => el.hidden), true);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-T2-03',
    feature: 'E2E-F20',
    title: 'Handle extra dose logged beyond prisesParJour without negative badge count',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Pixel', espece: 'Chat' });
      await openPet(page, 'Pixel', 'traitements');
      await addTreatment(page, { nom: 'Sirop', prisesParJour: 2, debut: isoDateOffset(0), statut: 'en-cours' });

      for (let i = 0; i < 2; i++) {
        await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      }
      await page.locator('.encart.prises.complet').waitFor({ state: 'visible' });
      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await confirmDialog(page, 'Noter une prise de plus');
      await page.locator('.encart.prises').filter({ hasText: '3 prises sur 2' }).waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      const cardText = await page.locator('#accueil-liste .carte-animal').textContent();
      assert(!/-\d+\s+prise/i.test(cardText), 'Negative dose count must never appear');
      assert(!/prise[s]?\s+à noter/i.test(cardText), 'Completed+extra doses must hide dose badge');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-T2-04',
    feature: 'E2E-F20',
    title: 'Do not show tab dots when next due dates are strictly in the future',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'FuturePet', espece: 'Chien' });
      await openPet(page, 'FuturePet', 'vaccins');
      await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-10), rappel: isoDateOffset(1) });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-10), prochaine: isoDateOffset(3) });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Cure', debut: isoDateOffset(-1), fin: isoDateOffset(5), statut: 'en-cours' });
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Tâche demain', echeance: isoDateOffset(1), repete: 'non' });

      for (const sec of ['vaccins', 'antiparasitaires', 'traitements', 'taches']) {
        assertEqual(await getAnimalTabDot(page, sec).count(), 0, `Future-only ${sec} must not show tab dot`);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-T2-05',
    feature: 'E2E-F20',
    title: 'Show Traitements tab dot for chronic treatment without fin and toggle dynamically on dose log/undo',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'ChronPet', espece: 'Chat' });
      await openPet(page, 'ChronPet', 'traitements');
      await addTreatment(page, { nom: 'Cardio', prisesParJour: 1, debut: isoDateOffset(-15), fin: '', statut: 'en-cours' });

      assert(await getAnimalTabDot(page, 'traitements').count() > 0, 'Traitements tab dot visible for chronic daily dose');

      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises.complet').waitFor({ state: 'visible' });
      assertEqual(await getAnimalTabDot(page, 'traitements').count(), 0, 'Traitements tab dot cleared after logging dose');

      await page.locator('.encart.prises').getByRole('button', { name: 'Annuler la dernière prise', exact: true }).click();
      await confirmDialog(page, 'Retirer la prise');
      await page.locator('.encart.prises').filter({ hasText: 'aucune prise notée' }).waitFor({ state: 'visible' });
      assert(await getAnimalTabDot(page, 'traitements').count() > 0, 'Traitements tab dot returns after undoing dose');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F21-T2 — R3: Rappels Filter & Quick Actions Boundaries
     ========================================================================= */
  {
    id: 'E2E-F21-T2-01',
    feature: 'E2E-F21',
    title: 'Display empty filtered state cleanly when selected animal has zero reminders or meds',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', espece: 'Chien' });
      await openPet(page, 'Rex', 'taches');
      await addTask(page, { titre: 'Tâche urgente', echeance: isoDateOffset(-1), repete: 'non' });
      await createPet(page, { nom: 'Vide', espece: 'Chat' });

      await goTab(page, 'rappels');
      await filterRappelsByAnimal(page, 'Vide');
      const text = await page.locator('#rappels-liste').textContent();
      assert(!text.includes('Tâche urgente'), 'Other pet reminders must not leak when filtered to empty animal');
      assert(/aucun|0/i.test(text), 'Clean empty state shown for animal with zero reminders');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-T2-02',
    feature: 'E2E-F21',
    title: 'Cancelling Noter le rappel fait from Rappels leaves reminder unchanged without duplicates',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Simba', espece: 'Chat' });
      await openPet(page, 'Simba', 'vaccins');
      await addVaccine(page, { nom: 'Coryza', date: isoDateOffset(-365), rappel: isoDateOffset(0) });

      await goTab(page, 'rappels');
      await page.locator('#rappels-liste').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('.vue[data-vue="formulaire"]').getByRole('button', { name: 'Annuler', exact: true }).click();

      await goTab(page, 'rappels');
      assertIncludes(await page.locator('#rappels-liste').textContent(), 'Coryza');
      await openPet(page, 'Simba', 'vaccins');
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 1, 'No duplicate vaccine created on cancel');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-T2-03',
    feature: 'E2E-F21',
    title: 'Only latest vaccine/antiparasitic per key triggers quick action on Rappels',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bella', espece: 'Chien' });
      await openPet(page, 'Bella', 'vaccins');
      await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-400), rappel: isoDateOffset(-5) });
      await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-1), rappel: isoDateOffset(364) });

      await goTab(page, 'rappels');
      const text = await page.locator('#rappels-liste').textContent();
      assert(!text.includes('En retard (1)'), 'Superseded Rage reminder must not appear as overdue');
      assertEqual(await page.locator('#rappels-liste').getByRole('button', { name: 'Noter le rappel fait', exact: true }).count(), 0);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-T2-04',
    feature: 'E2E-F21',
    title: 'Rapid filter toggling and double-click on Rappels quick action causes zero errors or duplicates',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'PetA', espece: 'Chien' });
      await openPet(page, 'PetA', 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Drontal', date: isoDateOffset(-90), prochaine: isoDateOffset(0) });
      await createPet(page, { nom: 'PetB', espece: 'Chat' });

      await goTab(page, 'rappels');
      await filterRappelsByAnimal(page, 'PetB');
      await filterRappelsByAnimal(page, 'PetA');
      await filterRappelsByAnimal(page, 'tous');

      const btn = page.locator('#rappels-liste').getByRole('button', { name: 'Noter la prise suivante', exact: true }).first();
      await rapidDoubleClick(btn);
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-prochaine').fill(isoDateOffset(90));
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });

      await openPet(page, 'PetA', 'antiparasitaires');
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 2, 'Exactly one renewal added');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-T2-05',
    feature: 'E2E-F21',
    title: 'Prefill autre antiparasitic product and dose accurately via Noter la prise suivante on Rappels',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Oscar', espece: 'Chien' });
      await openPet(page, 'Oscar', 'antiparasitaires');
      await addAntiparasitic(page, {
        type: 'autre',
        produit: 'Collier',
        dose: '1 collier',
        date: isoDateOffset(-180),
        prochaine: isoDateOffset(0),
      });

      await goTab(page, 'rappels');
      await page.locator('#rappels-liste').getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('[data-champ="type"] input[type="radio"][value="autre"]').isChecked(), true);
      assertEqual(await page.locator('#champ-produit').inputValue(), 'Collier');
      assertEqual(await page.locator('#champ-dose').inputValue(), '1 collier');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F22-T2 — R4: Keyword Search & Chronologie Boundaries
     ========================================================================= */
  {
    id: 'E2E-F22-T2-01',
    feature: 'E2E-F22',
    title: 'Case-insensitive and accent-insensitive keyword search plus empty no-match state',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Luna', espece: 'Chat' });
      await openPet(page, 'Luna', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'symptome', texte: 'Fièvre modérée' });

      await searchAnimalKeyword(page, 'fièvre');
      assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), 'Fièvre modérée');

      await searchAnimalKeyword(page, 'FIEVRE');
      assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), 'Fièvre modérée');

      await searchAnimalKeyword(page, 'xyz-introuvable-999');
      const noMatchText = await page.locator('.vue[data-vue="animal"]').textContent();
      assert(/aucun résultat/i.test(noMatchText), 'Empty-results message expected on unmatched search');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-T2-02',
    feature: 'E2E-F22',
    title: 'Switching to a second animal resets previous animal keyword search state',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'PetA', espece: 'Chat' });
      await openPet(page, 'PetA', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'allergie', texte: 'Allergie pollen A' });

      await createPet(page, { nom: 'PetB', espece: 'Chien' });
      await openPet(page, 'PetA', 'identite');
      const inputA = await searchAnimalKeyword(page, 'pollen');
      assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), 'Allergie pollen A');
      assertEqual(await inputA.inputValue(), 'pollen');

      await openPet(page, 'PetB', 'identite');
      const inputB = page.locator('.vue[data-vue="animal"] input[type="search"]').first();
      assertEqual(await inputB.inputValue(), '', 'Search input must reset when opening another animal');
      assert(!((await page.locator('.vue[data-vue="animal"]').textContent()).includes('Allergie pollen A')), 'PetA results must not bleed into PetB');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-T2-03',
    feature: 'E2E-F22',
    title: 'Neutralize XSS payloads in keyword search query and matched record fields',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const p1 = '<img src=x onerror=window.__xss=2>';
      await createPet(page, { nom: 'SecPet', espece: 'Chien' });
      await openPet(page, 'SecPet', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: `Test ${p1}` });

      await searchAnimalKeyword(page, '<script>window.__xss=1</script>');
      await searchAnimalKeyword(page, 'onerror');
      assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), p1);
      assertEqual(await page.evaluate(() => window.__xss), undefined, 'XSS payload must not execute in search');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-T2-04',
    feature: 'E2E-F22',
    title: 'Handle empty Chronologie tab and treatments without debut date gracefully',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'EmptyChron', espece: 'Chat' });
      await openPet(page, 'EmptyChron', 'identite');
      await openChronologieTab(page);
      const emptyText = await page.locator('#animal-contenu').textContent();
      assert(!/Invalid Date|NaN/i.test(emptyText), 'Empty Chronologie must not show Invalid Date/NaN');

      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Vitamines sans date', statut: 'en-cours' });
      await openChronologieTab(page);
      const withNoDate = await page.locator('#animal-contenu').textContent();
      assert(!/Invalid Date|NaN/i.test(withNoDate), 'Missing debut date must not produce Invalid Date/NaN');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-T2-05',
    feature: 'E2E-F22',
    title: 'Handle same-date tie-breaking across symptome, rdv, traitements, and pesees in Chronologie',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const today = isoDateOffset(0);
      await createPet(page, { nom: 'TiePet', espece: 'Chien' });
      await openPet(page, 'TiePet', 'notes');
      await addNote(page, { date: today, categorie: 'symptome', texte: 'Symptôme du jour' });
      await openAnimalSection(page, 'poids');
      await addWeighIn(page, { date: today, valeur: '10,2' });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Traitement du jour', debut: today });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: today, motif: 'RDV du jour' });

      await openChronologieTab(page);
      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'Symptôme du jour');
      assertIncludes(text, '10,2 kg');
      assertIncludes(text, 'Traitement du jour');
      assertIncludes(text, 'RDV du jour');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F23-T2 — R4: Ideal Weight Range & Global Expenses Boundaries
     ========================================================================= */
  {
    id: 'E2E-F23-T2-01',
    feature: 'E2E-F23',
    title: 'Reject poidsIdealMin > poidsIdealMax with validation error',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Rex', 'poids');
      await configureIdealWeight(page, { min: '25', max: '20', expectErrors: true });

      const errVisible = await page.locator('#formulaire-erreurs:not([hidden]), dialog#dialogue[open] .message-erreur:not([hidden]), #animal-contenu .message-erreur:not([hidden])').first().isVisible();
      assertEqual(errVisible, true, 'Validation error expected when min > max');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-T2-02',
    feature: 'E2E-F23',
    title: 'Reject zero, negative, and non-numeric values for ideal weight range',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Moka', espece: 'Chat', unitePoids: 'kg' });
      await openPet(page, 'Moka', 'poids');
      for (const [min, max] of [['0', '5'], ['-2', '5'], ['abc', '5']]) {
        await configureIdealWeight(page, { min, max, expectErrors: true });
        const errVisible = await page.locator('#formulaire-erreurs:not([hidden]), dialog#dialogue[open] .message-erreur:not([hidden]), #animal-contenu .message-erreur:not([hidden])').first().isVisible();
        assertEqual(errVisible, true, `Validation error expected for min=${min}, max=${max}`);
        const backBtn = page.locator('.vue[data-vue="formulaire"]:not([hidden]) button.retour');
        if ((await backBtn.count()) > 0 && (await backBtn.isVisible())) {
          await backBtn.click();
          await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        }
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-T2-03',
    feature: 'E2E-F23',
    title: 'Handle equal min === max ideal weight boundary without zero-height or NaN SVG attributes',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Léo', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Léo', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-5), valeur: '9,8' });
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '10,2' });
      await configureIdealWeight(page, { min: '10', max: '10' });

      const band = page.locator('svg.graphique rect.bande-ideale');
      await band.waitFor({ state: 'visible', timeout: 10000 });
      const attrs = await band.evaluate((el) => ({
        x: Number(el.getAttribute('x')),
        y: Number(el.getAttribute('y')),
        width: Number(el.getAttribute('width')),
        height: Number(el.getAttribute('height')),
      }));
      assert(Number.isFinite(attrs.x) && Number.isFinite(attrs.y), 'Finite SVG coordinates for equal bounds');
      assert(attrs.width > 0 && attrs.height > 0, 'Non-zero width and height for equal ideal weight bounds');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-T2-04',
    feature: 'E2E-F23',
    title: 'Hide global expenses summary on Rappels when no rdv.cout is recorded',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Pet1', espece: 'Chat' });
      await openPet(page, 'Pet1', 'rdv');
      await addAppointment(page, { date: isoDateOffset(2), motif: 'Contrôle gratuit' });

      await createPet(page, { nom: 'Pet2', espece: 'Chien' });
      await openPet(page, 'Pet2', 'rdv');
      await addAppointment(page, { date: isoDateOffset(3), motif: 'Suivi' });

      await goTab(page, 'rappels');
      const text = await page.locator('.vue[data-vue="rappels"]').textContent();
      assert(!/0,00[\s\u00a0\u202f]*€/.test(text), 'No 0,00 € expenses block when zero costs are entered');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-T2-05',
    feature: 'E2E-F23',
    title: 'Handle decimal rdv.cout precision and multi-year descending sorting on Rappels',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const yNow = new Date().getFullYear();
      const yPrev = yNow - 1;

      await createPet(page, { nom: 'CalcPet', espece: 'Chien' });
      await openPet(page, 'CalcPet', 'rdv');
      await addAppointment(page, { date: `${yNow}-01-10`, motif: 'Méd1', cout: '19,99' });
      await addAppointment(page, { date: `${yNow}-02-10`, motif: 'Méd2', cout: '0,01' });
      await addAppointment(page, { date: `${yPrev}-06-15`, motif: 'MédPrev', cout: '120,50' });

      await goTab(page, 'rappels');
      const text = await page.locator('.vue[data-vue="rappels"]').textContent();
      assertMatch(text, /20,00[\s\u00a0\u202f]*€/, 'Floating-point sum 19.99 + 0.01 formatted as 20,00 €');
      assertMatch(text, /120,50[\s\u00a0\u202f]*€/, 'Previous year 120,50 € shown');
      const iNow = text.indexOf(String(yNow));
      const iPrev = text.indexOf(String(yPrev));
      assert(iNow !== -1 && iPrev !== -1 && iNow < iPrev, 'Years sorted descending on expenses summary');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F24-T2 — R5: Passport & Insurance Boundaries
     ========================================================================= */
  {
    id: 'E2E-F24-T2-01',
    feature: 'E2E-F24',
    title: 'Reject invalid characters in assuranceTelephone',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Nala', espece: 'Chat' });
      await openPet(page, 'Nala', 'identite');
      await editAnimalIdentity(page, { assuranceTelephone: 'call:evil()' }, { expectErrors: true });
      await assertFieldError(page, 'assuranceTelephone');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-T2-02',
    feature: 'E2E-F24',
    title: 'Enforce max length bounds on passeport and insurance fields',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Max', espece: 'Chien' });
      await openPet(page, 'Max', 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’identité', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-passeport').fill('P'.repeat(200));
      await page.locator('#champ-assuranceCompagnie').fill('C'.repeat(200));
      await page.locator('#champ-assuranceContrat').fill('N'.repeat(200));
      await page.locator('#champ-assuranceTelephone').fill('0'.repeat(100));

      assert((await page.locator('#champ-passeport').inputValue()).length <= 80, 'passeport max length <= 80');
      assert((await page.locator('#champ-assuranceCompagnie').inputValue()).length <= 120, 'assuranceCompagnie max length <= 120');
      assert((await page.locator('#champ-assuranceContrat').inputValue()).length <= 80, 'assuranceContrat max length <= 80');
      assert((await page.locator('#champ-assuranceTelephone').inputValue()).length <= 40, 'assuranceTelephone max length <= 40');
      await submitAnimalForm(page, 'Identité');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-T2-03',
    feature: 'E2E-F24',
    title: 'Neutralize XSS payloads in passeport, assuranceCompagnie, and assuranceContrat across reload and #carnet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const p1 = '<img src=x onerror=window.__xss=1>';
      const p2 = '<script>window.__xss=2</script>';
      await createPet(page, { nom: 'XssPet', espece: 'Chat' });
      await openPet(page, 'XssPet', 'identite');
      await editAnimalIdentity(page, {
        passeport: p1,
        assuranceCompagnie: p2,
        assuranceContrat: p1,
      });

      await reloadApp(page);
      await openPet(page, 'XssPet', 'identite');
      const idText = await page.locator('#animal-contenu').textContent();
      assertIncludes(idText, p1);
      assertIncludes(idText, p2);

      await printCarnetWithOptions(page, {
        periode: 'tout',
        onPrint: async (p) => {
          assertIncludes(await p.locator('#carnet').textContent(), p1);
        },
      });
      assertEqual(await page.evaluate(() => window.__xss), undefined, 'XSS payload must not execute');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-T2-04',
    feature: 'E2E-F24',
    title: 'Guard assuranceTelephone against javascript: or non-digit string injected via JSON backup',
    run: async ({ page, assertNoRuntimeErrors }) => {
      for (const badTel of ['javascript:alert(1)', '---']) {
        const crafted = {
          format: 'omni-animaux-sauvegarde',
          versionFormat: 1,
          donnees: {
            animaux: [{ id: 'a-ins-1', nom: 'AssurPet', espece: 'Chien', assuranceTelephone: badTel }],
          },
        };
        await uploadJsonImport(page, 'bad-ins-tel.json', crafted);
        const dlg = page.locator('dialog#dialogue[open]');
        await dlg.waitFor({ state: 'visible', timeout: 10000 });
        const title = await dlg.locator('#dialogue-titre').textContent();
        if (title === 'Fichier refusé') {
          await confirmDialog(page, 'J’ai compris');
        } else {
          await confirmDialog(page, 'Remplacer', { expectNextDialog: true });
          await confirmDialog(page, 'Remplacer');
          await page.locator('#annonce').filter({ hasText: 'Restauration terminée' }).waitFor({ state: 'visible' });
          await openPet(page, 'AssurPet', 'identite');
          assertEqual(await page.locator('#animal-contenu a[href^="javascript:"]').count(), 0);
          assertEqual(await page.locator('#animal-contenu a[href^="tel:"]').count(), 0);
        }
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-T2-05',
    feature: 'E2E-F24',
    title: 'Treat whitespace-only passport and insurance fields as empty and hide them on Identité',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'BlankPet', espece: 'Chat' });
      await openPet(page, 'BlankPet', 'identite');
      await editAnimalIdentity(page, {
        passeport: '   ',
        assuranceCompagnie: '   ',
        assuranceContrat: '   ',
        assuranceTelephone: '   ',
      });

      const text = await page.locator('#animal-contenu').textContent();
      assert(!/Passeport/i.test(text), 'Whitespace-only passport hidden');
      assert(!/Assurance|Mutuelle|Contrat/i.test(text), 'Whitespace-only insurance hidden');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F25-T2 — R5: Carnet Period, Appendix & Cross-Cutting Boundaries
     ========================================================================= */
  {
    id: 'E2E-F25-T2-01',
    feature: 'E2E-F25',
    title: 'Enforce exact 12-month boundary cutoff in printable carnet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const exactCutoff = isoMonthsOffset(-12, 0);
      const oneDayBefore = isoMonthsOffset(-12, -1);

      await createPet(page, { nom: 'CutoffPet', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'CutoffPet', 'notes');
      await addNote(page, { date: exactCutoff, categorie: 'observation', texte: 'Note limite exacte' });
      await addNote(page, { date: oneDayBefore, categorie: 'observation', texte: 'Note trop ancienne' });

      await openAnimalSection(page, 'identite');
      await printCarnetWithOptions(page, {
        periode: '12mois',
        annexe: false,
        onPrint: async (p) => {
          const text = await p.locator('#carnet').textContent();
          assertIncludes(text, 'Note limite exacte');
          assert(!text.includes('Note trop ancienne'), 'Date 1 day before 12m cutoff must be excluded');
        },
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-T2-02',
    feature: 'E2E-F25',
    title: 'Print 12 derniers mois when all records are older than 12 months shows Aucune donnée cleanly',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'OldDataPet', espece: 'Chat' });
      await openPet(page, 'OldDataPet', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-500), valeur: '4,0' });
      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(-500), categorie: 'observation', texte: 'Vieille note' });

      await openAnimalSection(page, 'identite');
      await printCarnetWithOptions(page, {
        periode: '12mois',
        annexe: false,
        onPrint: async (p) => {
          const text = await p.locator('#carnet').textContent();
          assertIncludes(text, 'OldDataPet');
          assert(!text.includes('Vieille note'));
          assertEqual(await p.locator('#carnet section.carnet-section p.vide').count(), 6, 'All 6 health sections show Aucune donnée.');
        },
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-T2-03',
    feature: 'E2E-F25',
    title: 'Render photo appendix cleanly across multiple notes and multiple attachments and clear on afterprint',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'MultiDocPet', espece: 'Chien' });
      await openPet(page, 'MultiDocPet', 'notes');

      for (const label of ['Note A', 'Note B']) {
        await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-date').fill(isoDateOffset(-1));
        await page.locator('#champ-texte').fill(label);
        const fileInput = page.locator('[data-champ="pieces"] input[type="file"]:not([capture])');
        const docs = page.locator('[data-champ="pieces"] .vignettes-documents .document');
        await uploadSamplePng(page, fileInput, 'doc1.png', '[data-champ="pieces"] .aide', 'Document ajouté');
        await docs.nth(0).waitFor({ state: 'visible' });
        assertEqual(await docs.count(), 1, '1 document thumbnail rendered after first upload');
        await uploadSamplePng(page, fileInput, 'doc2.png', '[data-champ="pieces"] .aide', 'Document ajouté');
        await docs.nth(1).waitFor({ state: 'visible' });
        assertEqual(await docs.count(), 2, '2 document thumbnails rendered after second upload');
        await submitAnimalForm(page, 'Notes de santé');
      }

      await openAnimalSection(page, 'identite');
      await printCarnetWithOptions(page, {
        periode: 'tout',
        annexe: true,
        onPrint: async (p) => {
          const imgs = p.locator('#carnet img:not(.carnet-photo)');
          assertEqual(await imgs.count(), 4, 'All 4 attached note images rendered in appendix');
        },
      });
      assertEqual(await page.locator('#carnet').evaluate((el) => el.children.length), 0, '#carnet cleared after afterprint');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-T2-04',
    feature: 'E2E-F25',
    title: 'Clear #carnet on background relock even when photo appendix is populated',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'LockAppPet', espece: 'Chat' });
      await openPet(page, 'LockAppPet', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'examen', texte: 'Radio', withDocument: true });
      await activatePassword(page, 'SecAppendix99');

      await openPet(page, 'LockAppPet', 'identite');
      await withPrintStubV130(page, async (stub) => {
        const annexeBox = page.locator('#animal-contenu').getByLabel(/annexe|photos|ordonnances|documents/i).first();
        let annexeApplied = false;
        if ((await annexeBox.count()) > 0) {
          if (!(await annexeBox.isChecked())) await annexeBox.check();
          annexeApplied = true;
        }
        await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();
        const dlg = page.locator('dialog#dialogue[open]');
        if (await dlg.waitFor({ state: 'visible', timeout: 800 }).then(() => true).catch(() => false)) {
          const dlgBox = dlg.getByLabel(/annexe|photos|ordonnances|documents/i).first();
          if ((await dlgBox.count()) > 0) {
            if (!(await dlgBox.isChecked())) await dlgBox.check();
            annexeApplied = true;
          }
          await dlg.locator('button[type="submit"], .dialogue-boutons button.principal').first().click();
        }
        assert(annexeApplied, 'Carnet appendix control must exist');
        await page.locator('#carnet .carnet-entete').waitFor({ state: 'attached', timeout: 10000 });
        assertEqual(await stub.getPrintCallCount(), 1, 'window.print() must be called once for carnet');
        assert(await page.locator('#carnet img:not(.carnet-photo)').count() >= 1, 'Appendix image attached before relock');

        await triggerBackgroundRelock(page, 305000);
        assertEqual(await page.locator('#carnet').evaluate((el) => el.children.length), 0, '#carnet cleared on relock');
        assertEqual(await page.locator('#principal').evaluate((el) => el.hidden), true);
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-T2-05',
    feature: 'E2E-F25',
    title: 'Reject unsafe non-image URI in note pieces before printing appendix with zero external requests',
    run: async ({ page, monitors, assertNoRuntimeErrors }) => {
      const badPieces = {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        donnees: {
          animaux: [{ id: 'a-uri', nom: 'UriPet', espece: 'Chien' }],
          notes: [{
            id: 'n-uri',
            animalId: 'a-uri',
            date: isoDateOffset(0),
            texte: 'Pièce suspecte',
            pieces: ['https://evil.example/payload.png'],
          }],
        },
      };
      await restoreMaybeEncryptedBackup(page, 'bad-pieces.json', badPieces, { expectFileRejected: true });
      assertEqual(monitors.externalRequests.length, 0, 'Zero external requests triggered by rejected URI');
      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 2,
  name: 'Tier 2 — R1-R5 Boundary & Corner Cases (v1.3.0)',
  tests,
};
