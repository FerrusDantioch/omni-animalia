/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 1 — R1-R5 Feature Coverage (50 happy-path opaque-box tests across E2E-F16..E2E-F25) */
'use strict';

const fs = require('fs');
const path = require('path');

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
  createPet,
  createVet,
  addWeighIn,
  addVaccine,
  addAntiparasitic,
  addTreatment,
  addAppointment,
  addTask,
  addNote,
  confirmDialog,
  triggerBackupDownload,
  wipeAllData,
  ensureSwControlled,
  setOfflineWithSw,
  getCachedPaths,
  isoDateOffset,
  frDate,
  setupClipboardSpy,
  setupShareSpy,
  clickGardeShare,
  triggerLostPetSheet,
  getEmergencyVetBlock,
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
} = require('./helpers-v130');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const tests = [
  /* =========================================================================
     E2E-F16 — R1: Fiche de garde « Partager / Copier le texte »
     ========================================================================= */
  {
    id: 'E2E-F16-01',
    feature: 'E2E-F16',
    title: 'Copy full Fiche de garde text summary via clipboard fallback',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createVet(page, { nom: 'Dr Lebrun', clinique: 'Clinique Parc', telephone: '01 44 55 66 77' });
        await createPet(page, { nom: 'Maya', espece: 'Chien', puce: '250269600123456', vetoLabel: 'Dr Lebrun (Clinique Parc)' });

        await openPet(page, 'Maya', 'alimentation');
        await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-alimMarque').fill('Croquettes saumon');
        await page.locator('#champ-alimQuantite').fill('220 g');
        await page.locator('#champ-alimRepas').fill('2');
        await page.locator('#champ-alimEviter').fill('Chocolat et raisin');
        await submitAnimalForm(page, 'Alimentation');

        await openAnimalSection(page, 'notes');
        await addNote(page, { date: isoDateOffset(-2), categorie: 'allergie', texte: 'Allergie pollen' });

        await openAnimalSection(page, 'traitements');
        await addTreatment(page, { nom: 'Apoquel', dose: '1 comprimé', frequence: 'Matin', prisesParJour: 1, debut: isoDateOffset(0) });

        await openAnimalSection(page, 'vaccins');
        await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-350), rappel: isoDateOffset(12) });

        await openAnimalSection(page, 'identite');
        await openGarde(page);

        await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter des consignes', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-consignesGarde').fill('Laisse courte en ville');
        await submitGardeForm(page);

        await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('Camille');
        await page.locator('#champ-telephone').fill('06 11 22 33 44');
        await submitGardeForm(page);

        await clickGardeShare(page);
        await page.locator('#annonce').filter({ hasText: /copié|partagé/i }).waitFor({ state: 'visible', timeout: 5000 });

        const text = await clip.lastText();
        for (const expected of [
          'Maya',
          'Croquettes saumon',
          '220 g',
          'Chocolat et raisin',
          'Allergie pollen',
          'Apoquel',
          'Laisse courte en ville',
          'Camille',
          '06 11 22 33 44',
          'Dr Lebrun',
          '01 44 55 66 77',
          'Rage',
        ]) {
          assertIncludes(text, expected, `Garde share summary missing ${expected}`);
        }
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-02',
    feature: 'E2E-F16',
    title: 'Copy minimal pet Fiche de garde omits empty sections cleanly',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Plume' });
        await openPet(page, 'Plume', 'identite');
        await openGarde(page);

        await clickGardeShare(page);
        await page.locator('#annonce').filter({ hasText: /copié|partagé/i }).waitFor({ state: 'visible', timeout: 5000 });

        const text = await clip.lastText();
        assertIncludes(text, 'Plume');
        assert(!/\bundefined\b|\bnull\b/i.test(text), 'Garde summary must not contain undefined or null');
        assert(!text.includes('Médicaments en cours'), 'Empty meds section omitted');
        assert(!text.includes('À ne surtout pas donner'), 'Empty forbidden section omitted');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-03',
    feature: 'E2E-F16',
    title: 'Invoke navigator.share({ title, text }) when Web Share API is available',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const share = await setupShareSpy(page, { mode: 'resolve' });
      try {
        await createPet(page, { nom: 'Néo', espece: 'Chat' });
        await openPet(page, 'Néo', 'identite');
        await openGarde(page);

        await clickGardeShare(page);
        await page.waitForFunction(() => Array.isArray(window.__omniShareCalls) && window.__omniShareCalls.length === 1);
        const calls = await share.getCalls();
        assertEqual(calls.length, 1);
        assertIncludes(calls[0].title, 'Néo');
        assertIncludes(calls[0].text, 'Néo');
        assertTruthy(calls[0].text.length > 10, 'Share payload text non-empty');
      } finally {
        await share.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-04',
    feature: 'E2E-F16',
    title: 'Reflect edited instructions and forbidden foods in generated Garde summary',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Oscar', espece: 'Chien' });
        await openPet(page, 'Oscar', 'identite');
        await openGarde(page);

        await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter des consignes', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-consignesGarde').fill('Consigne V1');
        await submitGardeForm(page);

        await clickGardeShare(page);
        assertIncludes(await clip.lastText(), 'Consigne V1');

        await page.locator('#garde-contenu').getByRole('button', { name: 'Modifier les consignes', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-consignesGarde').fill('Consigne V2 urgente');
        await submitGardeForm(page);

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        await openAnimalSection(page, 'alimentation');
        await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-alimEviter').fill('Avocat et oignon');
        await submitAnimalForm(page, 'Alimentation');

        await openAnimalSection(page, 'identite');
        await openGarde(page);
        await clickGardeShare(page);
        const updated = await clip.lastText();
        assertIncludes(updated, 'Consigne V2 urgente');
        assertIncludes(updated, 'Avocat et oignon');
        assert(!updated.includes('Consigne V1'), 'Stale instructions replaced');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-05',
    feature: 'E2E-F16',
    title: 'Include multiple active & upcoming medications and 30-day reminders in Garde summary',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Zoe', espece: 'Chat' });
        await openPet(page, 'Zoe', 'traitements');
        await addTreatment(page, { nom: 'Cortisone', prisesParJour: 2, debut: isoDateOffset(0) });
        const plus3 = isoDateOffset(3);
        await addTreatment(page, { nom: 'AntibioFutur', debut: plus3 });

        await openAnimalSection(page, 'vaccins');
        const plus10 = isoDateOffset(10);
        await addVaccine(page, { nom: 'Typhus', date: isoDateOffset(-355), rappel: plus10 });

        await openAnimalSection(page, 'identite');
        await openGarde(page);
        await clickGardeShare(page);

        const text = await clip.lastText();
        assertIncludes(text, 'Cortisone');
        assertIncludes(text, 'AntibioFutur');
        assertIncludes(text, frDate(plus3));
        assertIncludes(text, 'Typhus');
        assertIncludes(text, frDate(plus10));
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F17 — R1: Emergency Vet / 24h Clinic & vetoUrgence Backup
     ========================================================================= */
  {
    id: 'E2E-F17-01',
    feature: 'E2E-F17',
    title: 'Configure optional emergency vet / 24h clinic on Vétérinaires and persist across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await configureEmergencyVet(page, {
        nom: 'Urgences Vet 24h',
        clinique: 'CHV Nord',
        telephone: '01 40 00 11 22',
        adresse: '10 avenue Secours',
        notes: 'Ouvert nuit et dimanche',
      });

      const block = getEmergencyVetBlock(page);
      const blockText = ((await block.count()) > 0 ? await block.textContent() : await page.locator('.vue[data-vue="veterinaires"]').textContent());
      assertIncludes(blockText, 'Urgences Vet 24h');
      assertIncludes(blockText, 'CHV Nord');
      assertIncludes(blockText, '10 avenue Secours');
      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0140001122"]').waitFor({ state: 'visible' });

      await reloadApp(page);
      await goTab(page, 'veterinaires');
      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0140001122"]').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('.vue[data-vue="veterinaires"]').textContent(), 'CHV Nord');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-02',
    feature: 'E2E-F17',
    title: 'One-tap tel: call link strips spaces and punctuation cleanly',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await configureEmergencyVet(page, {
        nom: 'Garde Vétérinaire',
        clinique: 'Clinique 24/24',
        telephone: '+33 (1) 42.55-66.77',
      });

      const link = page.locator('.vue[data-vue="veterinaires"] a[href="tel:+33142556677"]');
      await link.waitFor({ state: 'visible' });
      assertIncludes(await link.textContent(), 'Appeler');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-03',
    feature: 'E2E-F17',
    title: 'Edit and clear emergency vet information',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await configureEmergencyVet(page, {
        nom: 'Urgence A',
        clinique: 'Clinique A',
        telephone: '01 11 11 11 11',
      });
      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0111111111"]').waitFor({ state: 'visible' });

      await configureEmergencyVet(page, {
        nom: 'Urgence B',
        clinique: 'Clinique B',
        telephone: '01 22 22 22 22',
      });
      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0122222222"]').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('.vue[data-vue="veterinaires"]').textContent(), 'Clinique B');

      await clearEmergencyVet(page);
      assertEqual(await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0122222222"]').count(), 0);
      assert(!((await page.locator('.vue[data-vue="veterinaires"]').textContent()).includes('Urgence B')), 'Cleared emergency vet removed');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-04',
    feature: 'E2E-F17',
    title: 'Export and restore vetoUrgence setting in backup round-trip',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await configureEmergencyVet(page, {
        nom: 'CHU Vet',
        clinique: 'Urgences 24h',
        telephone: '01 99 88 77 66',
      });

      const backup = await triggerBackupDownload(page);
      assertTruthy(backup.data.reglages && backup.data.reglages.vetoUrgence, 'vetoUrgence exported in reglages');
      assertEqual(backup.data.reglages.vetoUrgence.telephone, '01 99 88 77 66');

      await wipeAllData(page);
      await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, { mode: 'remplacer' });

      await goTab(page, 'veterinaires');
      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0199887766"]').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('.vue[data-vue="veterinaires"]').textContent(), 'CHU Vet');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F17-05',
    feature: 'E2E-F17',
    title: 'Emergency vet remains independent from regular veterinarian CRUD and deletion',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Martin', clinique: 'Cabinet Ville', telephone: '01 00 00 00 01' });
      await configureEmergencyVet(page, { nom: 'Urgences 24h', clinique: 'CHV Sud', telephone: '01 00 00 00 99' });

      await page.locator('#vetos-liste .carte-fiche').getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#vetos-liste', { hasText: 'Aucun vétérinaire enregistré.' }).waitFor({ state: 'visible' });

      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0100000099"]').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('.vue[data-vue="veterinaires"]').textContent(), 'Urgences 24h');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F18 — R1: Identité « Fiche animal perdu »
     ========================================================================= */
  {
    id: 'E2E-F18-01',
    feature: 'E2E-F18',
    title: 'Generate and copy Fiche animal perdu text with all identification and owner phone fields',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, {
          nom: 'Pixel',
          espece: 'Chien',
          race: 'Border Collie',
          couleur: 'Noir et blanc',
          puce: '250269600112233',
          tatouage: 'TAT789',
        });
        await openPet(page, 'Pixel', 'identite');
        await openGarde(page);
        await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('Camille');
        await page.locator('#champ-telephone').fill('06 11 22 33 44');
        await submitGardeForm(page);

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        const { dialogText } = await triggerLostPetSheet(page);
        const text = (await clip.lastText()) || dialogText || '';
        for (const expected of ['Pixel', 'Chien', 'Border Collie', 'Noir et blanc', '250269600112233', 'TAT789', '06 11 22 33 44']) {
          assertIncludes(text, expected, `Lost pet sheet missing ${expected}`);
        }
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-02',
    feature: 'E2E-F18',
    title: 'Generate Fiche animal perdu cleanly when only partial identification fields are filled',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Minou', espece: 'Chat', tatouage: 'CAT42' });
        await openPet(page, 'Minou', 'identite');
        const { dialogText } = await triggerLostPetSheet(page);
        const text = (await clip.lastText()) || dialogText || '';
        assertIncludes(text, 'Minou');
        assertIncludes(text, 'Chat');
        assertIncludes(text, 'CAT42');
        assert(!/\bundefined\b|\bnull\b/i.test(text), 'No undefined/null in partial lost pet sheet');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-03',
    feature: 'E2E-F18',
    title: 'Use navigator.share for Fiche animal perdu when supported',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const share = await setupShareSpy(page, { mode: 'resolve' });
      try {
        await createPet(page, { nom: 'Bounty', espece: 'Chien', couleur: 'Fauve' });
        await openPet(page, 'Bounty', 'identite');
        await triggerLostPetSheet(page);
        await page.waitForFunction(() => Array.isArray(window.__omniShareCalls) && window.__omniShareCalls.length === 1);
        const calls = await share.getCalls();
        assertEqual(calls.length, 1);
        assertIncludes(calls[0].title, 'Bounty');
        assertIncludes(calls[0].text, 'Bounty');
        assertIncludes(calls[0].text, 'Fauve');
      } finally {
        await share.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-04',
    feature: 'E2E-F18',
    title: 'Reflect updated color, microchip, and owner phone immediately in Fiche animal perdu',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Luna', espece: 'Chat', couleur: 'Grise' });
        await openPet(page, 'Luna', 'identite');
        await editAnimalIdentity(page, { couleur: 'Grise et blanche', puce: '250269800777888' });

        await openGarde(page);
        await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('Sam');
        await page.locator('#champ-telephone').fill('07 65 43 21 00');
        await submitGardeForm(page);

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        const { dialogText } = await triggerLostPetSheet(page);
        const text = (await clip.lastText()) || dialogText || '';
        assertIncludes(text, 'Grise et blanche');
        assertIncludes(text, '250269800777888');
        assertIncludes(text, '07 65 43 21 00');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F18-05',
    feature: 'E2E-F18',
    title: 'Generate Fiche animal perdu cleanly on active and archived pet views',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await createPet(page, { nom: 'Milo', espece: 'Chat', couleur: 'Roux' });
        await openPet(page, 'Milo', 'identite');
        await triggerLostPetSheet(page);
        assertIncludes(await clip.lastText(), 'Milo');

        await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('[data-champ="motif"] input[value="confié"]').check();
        await submitAnimalForm(page, 'Identité');

        assertEqual(
          await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).count(),
          0,
          'Pet is now archived'
        );
        await triggerLostPetSheet(page);
        assertIncludes(await clip.lastText(), 'Roux');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F19 — R2: Encrypted Backup Export & Restore (AES-GCM + PBKDF2)
     ========================================================================= */
  {
    id: 'E2E-F19-01',
    feature: 'E2E-F19',
    title: 'Export encrypted backup with password and verify opaque AES-GCM/PBKDF2 envelope',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'SecretPet', espece: 'Chat' });
      await openPet(page, 'SecretPet', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'allergie', texte: 'Allergie pénicilline' });

      const backup = await exportBackupWithPassword(page, 'MonMot2Passe!');
      assertEqual(backup.data.format, 'omni-animaux-sauvegarde');
      assertEqual(backup.data.chiffre, true);
      assertEqual(backup.data.kdf, 'PBKDF2-SHA256');
      assertEqual(backup.data.algo, 'AES-GCM');
      assert(Number.isInteger(backup.data.iterations) && backup.data.iterations >= 100000, 'PBKDF2 iterations >= 100k');
      assertTruthy(typeof backup.data.sel === 'string' && backup.data.sel.length > 0, 'sel base64 present');
      assertTruthy(typeof backup.data.iv === 'string' && backup.data.iv.length > 0, 'iv base64 present');
      assertTruthy(typeof backup.data.donnees === 'string' && backup.data.donnees.length > 0, 'encrypted donnees string present');
      assert(!backup.raw.includes('SecretPet'), 'Plaintext pet name must not leak into encrypted envelope');
      assert(!backup.raw.includes('Allergie pénicilline'), 'Plaintext note must not leak into encrypted envelope');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-02',
    feature: 'E2E-F19',
    title: 'Auto-detect encrypted backup on restore, prompt password, and restore in Remplacer mode',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'SecretPet', espece: 'Chien' });
      await openPet(page, 'SecretPet', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Note secrète' });

      const backup = await exportBackupWithPassword(page, 'CleSecrete2026');
      await wipeAllData(page);

      const res = await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, {
        password: 'CleSecrete2026',
        mode: 'remplacer',
      });
      assertEqual(res.promptedPassword, true, 'Encrypted backup must prompt password');
      assertEqual(res.restored, true);

      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'SecretPet');
      await openPet(page, 'SecretPet', 'notes');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Note secrète');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-03',
    feature: 'E2E-F19',
    title: 'Restore encrypted .txt backup in Fusionner mode alongside existing pet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'SecretPet', espece: 'Chat' });
      const backup = await exportBackupWithPassword(page, 'MergePass99');
      await wipeAllData(page);

      await createPet(page, { nom: 'LocalPet', espece: 'Lapin' });
      const res = await restoreMaybeEncryptedBackup(page, 'sauvegarde-chiffree.txt', backup.raw, {
        password: 'MergePass99',
        mode: 'fusionner',
      });
      assertEqual(res.restored, true);

      await goTab(page, 'accueil');
      const home = await page.locator('#accueil-liste').textContent();
      assertIncludes(home, 'LocalPet');
      assertIncludes(home, 'SecretPet');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-04',
    feature: 'E2E-F19',
    title: 'Export unencrypted backup when password protection option is left unchecked',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'ClairPet', espece: 'Chien' });
      const backup = await exportBackupWithPassword(page, '', { checkEncryptionBox: false });
      assertEqual(backup.data.format, 'omni-animaux-sauvegarde');
      assertEqual(backup.data.versionFormat, 1);
      assert(!backup.data.chiffre, 'Unencrypted export must not set chiffre=true');
      assertEqual(backup.data.donnees.animaux[0].nom, 'ClairPet');

      await wipeAllData(page);
      const res = await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, { mode: 'remplacer' });
      assertEqual(res.promptedPassword, false, 'Unencrypted backup must not prompt password');
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'ClairPet');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-05',
    feature: 'E2E-F19',
    title: 'Preserve backward compatibility restoring legacy unencrypted v1.2.6 .json and .txt backups',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const legacy = {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        application: 'Omni-Animalia 1.2.6',
        reglages: { theme: 'sombre', taille: 'grand', unitePoids: 'g' },
        donnees: {
          animaux: [{ id: 'leg-1', nom: 'LegacyPet', espece: 'Furet', unitePoids: 'g' }],
          pesees: [{ id: 'leg-p1', animalId: 'leg-1', date: isoDateOffset(-5), grammes: 950 }],
        },
      };

      const resJson = await restoreMaybeEncryptedBackup(page, 'legacy-v126.json', legacy, { mode: 'remplacer' });
      assertEqual(resJson.promptedPassword, false);
      assertEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'sombre');
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'LegacyPet');

      await wipeAllData(page);
      const resTxt = await restoreMaybeEncryptedBackup(page, 'legacy-v126.txt', JSON.stringify(legacy), { mode: 'remplacer' });
      assertEqual(resTxt.promptedPassword, false);
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'LegacyPet');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F20 — R3: Home Card Daily Dose Badge & Animal Tab Notification Dots
     ========================================================================= */
  {
    id: 'E2E-F20-01',
    feature: 'E2E-F20',
    title: 'Display 1 prise à noter badge on home card for active treatment with 1 remaining dose',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', espece: 'Chien' });
      await openPet(page, 'Rex', 'traitements');
      await addTreatment(page, { nom: 'Antibio', prisesParJour: 1, debut: isoDateOffset(0), statut: 'en-cours' });

      await goTab(page, 'accueil');
      const badges = await page.locator('#accueil-liste .carte-animal .badges').textContent();
      assertMatch(badges, /(?:^|\D)1 prise à noter\b/);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-02',
    feature: 'E2E-F20',
    title: 'Display N prises à noter across multiple and chronic treatments without fin date',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Moka', espece: 'Chat' });
      await openPet(page, 'Moka', 'traitements');
      await addTreatment(page, { nom: 'Insuline', prisesParJour: 2, debut: isoDateOffset(-30), fin: '', statut: 'en-cours' });
      await addTreatment(page, { nom: 'Cardio', prisesParJour: 1, debut: isoDateOffset(-10), fin: '', statut: 'en-cours' });

      await goTab(page, 'accueil');
      const badges = await page.locator('#accueil-liste .carte-animal .badges').textContent();
      assertMatch(badges, /(?:^|\D)3 prises à noter\b/);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-03',
    feature: 'E2E-F20',
    title: 'Decrement and remove home card dose badge as doses are logged',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Luna', espece: 'Chien' });
      await openPet(page, 'Luna', 'traitements');
      await addTreatment(page, { nom: 'Cortisone', prisesParJour: 2, debut: isoDateOffset(0), statut: 'en-cours' });

      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises').filter({ hasText: '1 prise sur 2' }).waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      assertMatch(await page.locator('#accueil-liste .carte-animal .badges').textContent(), /(?:^|\D)1 prise à noter\b/);

      await openPet(page, 'Luna', 'traitements');
      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises.complet').waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      const cardText = await page.locator('#accueil-liste .carte-animal').textContent();
      assert(!/prise[s]?\s+à noter/i.test(cardText), 'Dose badge must disappear when all doses logged');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-04',
    feature: 'E2E-F20',
    title: 'Display visual dot on Vaccins, Traitements, Antiparasitaires, and À faire tabs for overdue/today items',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Nala', espece: 'Chat' });
      await openPet(page, 'Nala', 'vaccins');
      await addVaccine(page, { nom: 'Typhus', date: isoDateOffset(-366), rappel: isoDateOffset(-1) });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-90), prochaine: isoDateOffset(0) });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Gouttes', prisesParJour: 1, debut: isoDateOffset(0), statut: 'en-cours' });
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Couper griffes', echeance: isoDateOffset(0), repete: 'non' });

      await openAnimalSection(page, 'identite');
      for (const sec of ['vaccins', 'antiparasitaires', 'traitements', 'taches']) {
        assert(await getAnimalTabDot(page, sec).count() > 0, `Expected tab dot on ${sec}`);
      }
      for (const sec of ['identite', 'poids', 'notes', 'alimentation']) {
        assertEqual(await getAnimalTabDot(page, sec).count(), 0, `No tab dot expected on ${sec}`);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-05',
    feature: 'E2E-F20',
    title: 'Clear tab notification dot immediately when overdue/today item is resolved without reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Coco', espece: 'Chien' });
      await openPet(page, 'Coco', 'vaccins');
      await addVaccine(page, { nom: 'CHPPiL', date: isoDateOffset(-365), rappel: isoDateOffset(0) });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'anti-puces', produit: 'Bravecto', date: isoDateOffset(-30), prochaine: isoDateOffset(0) });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Sirop', prisesParJour: 1, debut: isoDateOffset(0), statut: 'en-cours' });
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Bain', echeance: isoDateOffset(0), repete: 'non' });

      // Resolve task
      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: 'Faites (1)' }).waitFor({ state: 'visible' });
      assertEqual(await getAnimalTabDot(page, 'taches').count(), 0, 'taches dot cleared dynamically');

      // Log daily med dose
      await openAnimalSection(page, 'traitements');
      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises.complet').waitFor({ state: 'visible' });
      assertEqual(await getAnimalTabDot(page, 'traitements').count(), 0, 'traitements dot cleared dynamically');

      // Renew vaccine
      await openAnimalSection(page, 'vaccins');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-rappel').fill(isoDateOffset(365));
      await submitAnimalForm(page, 'Vaccins');
      assertEqual(await getAnimalTabDot(page, 'vaccins').count(), 0, 'vaccins dot cleared dynamically');

      // Renew antiparasitic
      await openAnimalSection(page, 'antiparasitaires');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-prochaine').fill(isoDateOffset(90));
      await submitAnimalForm(page, 'Vermifuges et antiparasitaires');
      assertEqual(await getAnimalTabDot(page, 'antiparasitaires').count(), 0, 'antiparasitaires dot cleared dynamically');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F21 — R3: Rappels Quick Animal Filter & Quick Actions
     ========================================================================= */
  {
    id: 'E2E-F21-01',
    feature: 'E2E-F21',
    title: 'Filter Rappels page by selected animal and reset back to all animals',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', espece: 'Chien' });
      await openPet(page, 'Rex', 'taches');
      await addTask(page, { titre: 'Tâche Rex', echeance: isoDateOffset(0), repete: 'non' });

      await createPet(page, { nom: 'Moka', espece: 'Chat' });
      await openPet(page, 'Moka', 'taches');
      await addTask(page, { titre: 'Tâche Moka', echeance: isoDateOffset(0), repete: 'non' });

      await goTab(page, 'rappels');
      const allText = await page.locator('#rappels-liste').textContent();
      assertIncludes(allText, 'Tâche Rex');
      assertIncludes(allText, 'Tâche Moka');

      await filterRappelsByAnimal(page, 'Rex');
      const rexText = await page.locator('#rappels-liste').textContent();
      assertIncludes(rexText, 'Tâche Rex');
      assert(!rexText.includes('Tâche Moka'), 'Filtered Rappels must hide Moka items');

      await filterRappelsByAnimal(page, 'tous');
      const resetText = await page.locator('#rappels-liste').textContent();
      assertIncludes(resetText, 'Tâche Rex');
      assertIncludes(resetText, 'Tâche Moka');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-02',
    feature: 'E2E-F21',
    title: 'Renew vaccine directly from Rappels via Noter le rappel fait button',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', espece: 'Chien' });
      await openPet(page, 'Rex', 'vaccins');
      await addVaccine(page, { nom: 'CHPPiL', date: isoDateOffset(-365), rappel: isoDateOffset(0), veterinaire: 'Dr Dupont' });

      await goTab(page, 'rappels');
      await page.locator('#nav-pastille:not([hidden])').filter({ hasText: '1' }).waitFor({ state: 'visible' });
      await page.locator('#rappels-liste').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-nom').inputValue(), 'CHPPiL');
      assertEqual(await page.locator('#champ-date').inputValue(), isoDateOffset(0));

      await page.locator('#champ-rappel').fill(isoDateOffset(365));
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });

      await goTab(page, 'rappels');
      await page.waitForFunction(() => document.querySelector('#nav-pastille').hidden === true);
      assert(!((await page.locator('#rappels-liste').textContent()).includes('Aujourd’hui (1)')), 'Vaccine cleared from today reminders');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-03',
    feature: 'E2E-F21',
    title: 'Log next antiparasitic dose directly from Rappels via Noter la prise suivante button',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Mina', espece: 'Chat' });
      await openPet(page, 'Mina', 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-90), prochaine: isoDateOffset(0), dose: '1 comprimé' });

      await goTab(page, 'rappels');
      await page.locator('#rappels-liste').getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-produit').inputValue(), 'Milbemax');
      assertEqual(await page.locator('#champ-date').inputValue(), isoDateOffset(0));

      await page.locator('#champ-prochaine').fill(isoDateOffset(90));
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });

      await goTab(page, 'rappels');
      await page.waitForFunction(() => document.querySelector('#nav-pastille').hidden === true);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-04',
    feature: 'E2E-F21',
    title: 'Rappels filter stays consistent across quick action completion',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'PetA', espece: 'Chien' });
      await openPet(page, 'PetA', 'taches');
      await addTask(page, { titre: 'Soin A', echeance: isoDateOffset(0), repete: 'non' });

      await createPet(page, { nom: 'PetB', espece: 'Chat' });
      await openPet(page, 'PetB', 'taches');
      await addTask(page, { titre: 'Soin B', echeance: isoDateOffset(0), repete: 'non' });

      await goTab(page, 'rappels');
      await filterRappelsByAnimal(page, 'PetA');
      await page.locator('#rappels-liste').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.waitForTimeout(80);
      const afterText = await page.locator('#rappels-liste').textContent();
      assert(!afterText.includes('Soin A'), 'Completed PetA task removed');
      assert(!afterText.includes('Soin B'), 'PetB task must stay hidden while filtered on PetA');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-05',
    feature: 'E2E-F21',
    title: 'Exclude archived animals from Rappels quick animal filter options',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Actif', espece: 'Chien' });
      await createPet(page, { nom: 'Archivé', espece: 'Chat' });

      await openPet(page, 'Archivé', 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="confié"]').check();
      await submitAnimalForm(page, 'Identité');

      await goTab(page, 'rappels');
      const filterSelect = page.locator('.vue[data-vue="rappels"] select').first();
      const filterControl = (await filterSelect.count()) > 0
        ? filterSelect
        : page.locator('.vue[data-vue="rappels"] .filtre-animal').first();
      await filterControl.waitFor({ state: 'visible', timeout: 10000 });
      const filterText = await filterControl.textContent();
      assertIncludes(filterText, 'Actif');
      assert(!filterText.includes('Archivé'), 'Archived pet must be excluded from Rappels animal filter');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F22 — R4: Animal Multi-Section Keyword Search & Chronologie Tab
     ========================================================================= */
  {
    id: 'E2E-F22-01',
    feature: 'E2E-F22',
    title: 'Search keyword across notes, vaccins, antiparasitaires, traitements, and rdv compteRendu',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rocky', espece: 'Chien' });
      await openPet(page, 'Rocky', 'notes');
      await addNote(page, { date: isoDateOffset(-5), categorie: 'symptome', texte: 'Légère boiterie patte avant' });
      await openAnimalSection(page, 'vaccins');
      await addVaccine(page, { nom: 'Lyme', date: isoDateOffset(-4) });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'anti-tiques', produit: 'Bravecto', date: isoDateOffset(-3) });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Meloxicam', debut: isoDateOffset(-2) });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(-1), motif: 'Contrôle', compteRendu: 'Aucune anomalie à la radiographie' });

      for (const kw of ['boiterie', 'Lyme', 'Bravecto', 'Meloxicam', 'radiographie']) {
        await searchAnimalKeyword(page, kw);
        const content = await page.locator('.vue[data-vue="animal"]').textContent();
        assertIncludes(content, kw, `Search result should include keyword ${kw}`);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-02',
    feature: 'E2E-F22',
    title: 'Click search result jumps directly to matching animal section',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Luna', espece: 'Chat' });
      await openPet(page, 'Luna', 'rdv');
      await addAppointment(page, { date: isoDateOffset(-3), motif: 'Bilan', compteRendu: 'Résultat échographie normal' });
      await openAnimalSection(page, 'identite');

      await searchAnimalKeyword(page, 'échographie');
      const jumpBtn = page.locator('.vue[data-vue="animal"] [data-section="rdv"], .vue[data-vue="animal"] button, .vue[data-vue="animal"] a')
        .filter({ hasText: /échographie|Bilan|Rendez-vous/i })
        .last();
      await jumpBtn.click();

      await page.locator('#animal-sections button[data-section="rdv"][aria-current="true"]').waitFor({ state: 'visible', timeout: 10000 });
      await page.locator('#animal-contenu h2').filter({ hasText: /Rendez-vous/i }).waitFor({ state: 'visible', timeout: 10000 });
      await page.locator('#animal-contenu .carte-fiche, #animal-contenu .encart.vide').first().waitFor({ state: 'visible', timeout: 10000 });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Résultat échographie normal');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-03',
    feature: 'E2E-F22',
    title: 'Display 10th Chronologie tab and list dated symptome, rdv, traitements, and pesees in date order',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Sacha', espece: 'Chien' });
      await openPet(page, 'Sacha', 'notes');
      await addNote(page, { date: isoDateOffset(-20), categorie: 'symptome', texte: 'Symptôme toux' });
      await addNote(page, { date: isoDateOffset(-15), categorie: 'observation', texte: 'Observation calme' });

      await openAnimalSection(page, 'poids');
      await addWeighIn(page, { date: isoDateOffset(-10), valeur: '14,5' });

      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Sirop gorge', debut: isoDateOffset(-5) });

      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(-1), motif: 'Visite contrôle' });

      await openChronologieTab(page);
      const chronoText = await page.locator('#animal-contenu').textContent();
      assertIncludes(chronoText, 'Symptôme toux');
      assertIncludes(chronoText, '14,5 kg');
      assertIncludes(chronoText, 'Sirop gorge');
      assertIncludes(chronoText, 'Visite contrôle');

      // Verify chronological order (either newest-first or oldest-first, must be monotonic)
      const iRdv = chronoText.indexOf('Visite contrôle');
      const iTrt = chronoText.indexOf('Sirop gorge');
      const iPoids = chronoText.indexOf('14,5 kg');
      const iSymp = chronoText.indexOf('Symptôme toux');
      const newestFirst = iRdv < iTrt && iTrt < iPoids && iPoids < iSymp;
      const oldestFirst = iSymp < iPoids && iPoids < iTrt && iTrt < iRdv;
      assert(newestFirst || oldestFirst, 'Chronologie episodes must be strictly ordered by date');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-04',
    feature: 'E2E-F22',
    title: 'Clear keyword search restores normal view without stale filter state',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Milo', espece: 'Chat' });
      await openPet(page, 'Milo', 'vaccins');
      await addVaccine(page, { nom: 'Lyme', date: isoDateOffset(-2) });

      await searchAnimalKeyword(page, 'Lyme');
      assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), 'Lyme');

      await searchAnimalKeyword(page, '');
      await page.locator('#animal-contenu h2').filter({ hasText: 'Vaccins' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Lyme');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-05',
    feature: 'E2E-F22',
    title: 'Update Chronologie and keyword search dynamically after adding and deleting records',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Filou', espece: 'Chat' });
      await openPet(page, 'Filou', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'symptome', texte: 'Toux sèche' });

      await openChronologieTab(page);
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Toux sèche');
      await searchAnimalKeyword(page, 'Toux');
      assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), 'Toux sèche');
      await searchAnimalKeyword(page, '');

      await openAnimalSection(page, 'notes');
      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });

      await openChronologieTab(page);
      assert(!((await page.locator('#animal-contenu').textContent()).includes('Toux sèche')), 'Deleted note removed from Chronologie');
      await searchAnimalKeyword(page, 'Toux');
      assert(!((await page.locator('#animal-contenu').textContent()).includes('Toux sèche')), 'Deleted note removed from search');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F23 — R4: Ideal Weight SVG Band & Global Annual Expenses Summary
     ========================================================================= */
  {
    id: 'E2E-F23-01',
    feature: 'E2E-F23',
    title: 'Set optional ideal weight range in kg and render .bande-ideale SVG band',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Rex', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-10), valeur: '19' });
      await addWeighIn(page, { date: isoDateOffset(-1), valeur: '21' });

      await configureIdealWeight(page, { min: '18', max: '22' });
      const band = page.locator('svg.graphique rect.bande-ideale');
      await band.waitFor({ state: 'visible', timeout: 10000 });
      assertEqual(await band.count(), 1);
      const box = await band.evaluate((el) => ({
        x: Number(el.getAttribute('x')),
        y: Number(el.getAttribute('y')),
        width: Number(el.getAttribute('width')),
        height: Number(el.getAttribute('height')),
      }));
      assert(Number.isFinite(box.x) && box.width > 0, 'bande-ideale width > 0');
      assert(Number.isFinite(box.y) && box.y >= 0 && box.height > 0 && box.y + box.height <= 220, 'bande-ideale inside viewBox');

      await reloadApp(page);
      await openPet(page, 'Rex', 'poids');
      assertEqual(await page.locator('svg.graphique rect.bande-ideale').count(), 1);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-02',
    feature: 'E2E-F23',
    title: 'Ideal weight range works in g unit and expands Y-axis scale when weigh-ins are outside range',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Kiwi', espece: 'Lapin', unitePoids: 'g' });
      await openPet(page, 'Kiwi', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-7), valeur: '1100' });
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '1150' });

      await configureIdealWeight(page, { min: '800', max: '1000' });
      const band = page.locator('svg.graphique rect.bande-ideale');
      await band.waitFor({ state: 'visible', timeout: 10000 });
      const box = await band.evaluate((el) => ({
        y: Number(el.getAttribute('y')),
        height: Number(el.getAttribute('height')),
      }));
      assert(box.y >= 0 && box.y + box.height <= 220, 'bande-ideale must not clip outside SVG viewBox');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-03',
    feature: 'E2E-F23',
    title: 'Clear ideal weight range removes .bande-ideale from SVG chart',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bella', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Bella', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-5), valeur: '12' });
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '12,5' });
      await configureIdealWeight(page, { min: '11', max: '13' });
      assertEqual(await page.locator('svg.graphique rect.bande-ideale').count(), 1);

      await clearIdealWeight(page);
      assertEqual(await page.locator('svg.graphique rect.bande-ideale').count(), 0);
      assertEqual(await page.locator('svg.graphique polyline.courbe').count(), 1, 'Weight curve remains intact');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-04',
    feature: 'E2E-F23',
    title: 'Display global annual veterinary expenses summary on Rappels across multiple animals',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const thisYear = new Date().getFullYear();
      const thisYearDate1 = `${thisYear}-01-15`;
      const thisYearDate2 = `${thisYear}-02-20`;
      const lastYearDate = `${thisYear - 1}-11-10`;

      await createPet(page, { nom: 'PetA', espece: 'Chien' });
      await openPet(page, 'PetA', 'rdv');
      await addAppointment(page, { date: thisYearDate1, motif: 'Visit 1', cout: '45' });
      await addAppointment(page, { date: thisYearDate2, motif: 'Visit 2', cout: '55' });

      await createPet(page, { nom: 'PetB', espece: 'Chat' });
      await openPet(page, 'PetB', 'rdv');
      await addAppointment(page, { date: thisYearDate1, motif: 'Visit 3', cout: '35,50' });
      await addAppointment(page, { date: lastYearDate, motif: 'Old visit', cout: '80' });

      await goTab(page, 'rappels');
      const rappelsText = await page.locator('.vue[data-vue="rappels"]').textContent();
      assertMatch(rappelsText, /135,50[\s\u00a0\u202f]*€/, 'Current year global total 135,50 €');
      assertIncludes(rappelsText, 'PetA');
      assertMatch(rappelsText, /100,00[\s\u00a0\u202f]*€/, 'PetA breakdown 100,00 €');
      assertIncludes(rappelsText, 'PetB');
      assertMatch(rappelsText, /35,50[\s\u00a0\u202f]*€/, 'PetB breakdown 35,50 €');
      assertMatch(rappelsText, /80,00[\s\u00a0\u202f]*€/, 'Previous year total 80,00 €');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F23-05',
    feature: 'E2E-F23',
    title: 'Reflect rdv.cout updates immediately on Rappels global expenses summary',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const thisYear = new Date().getFullYear();
      await createPet(page, { nom: 'PetA', espece: 'Chien' });
      await openPet(page, 'PetA', 'rdv');
      await addAppointment(page, { date: `${thisYear}-03-10`, motif: 'Bilan', cout: '45' });

      await goTab(page, 'rappels');
      assertMatch(await page.locator('.vue[data-vue="rappels"]').textContent(), /45,00[\s\u00a0\u202f]*€/);

      await openPet(page, 'PetA', 'rdv');
      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-cout').fill('65');
      await submitAnimalForm(page, 'Rendez-vous vétérinaires');

      await goTab(page, 'rappels');
      const updated = await page.locator('.vue[data-vue="rappels"]').textContent();
      assertMatch(updated, /65,00[\s\u00a0\u202f]*€/);
      assert(!/45,00[\s\u00a0\u202f]*€/.test(updated), 'Old cost replaced by updated total');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F24 — R5: Optional Passport & Insurance Fields (Identité)
     ========================================================================= */
  {
    id: 'E2E-F24-01',
    feature: 'E2E-F24',
    title: 'Fill passport and insurance fields and verify display + tel: link on Identité',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Nala', espece: 'Chat' });
      await openPet(page, 'Nala', 'identite');
      await editAnimalIdentity(page, {
        passeport: 'FR-123456',
        assuranceCompagnie: 'SantéVet',
        assuranceContrat: 'POL-9988',
        assuranceTelephone: '01 80 00 11 22',
      });

      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'FR-123456');
      assertIncludes(text, 'SantéVet');
      assertIncludes(text, 'POL-9988');
      await page.locator('#animal-contenu a[href="tel:0180001122"]').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-02',
    feature: 'E2E-F24',
    title: 'Hide passport and insurance lines completely when left empty',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Simba', espece: 'Chat' });
      await openPet(page, 'Simba', 'identite');
      const text = await page.locator('#animal-contenu').textContent();
      assert(!/Passeport/i.test(text), 'Empty passport line hidden');
      assert(!/Assurance|Mutuelle|Contrat/i.test(text), 'Empty insurance lines hidden');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-03',
    feature: 'E2E-F24',
    title: 'Partial insurance fields show only filled fields',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Léo', espece: 'Chien' });
      await openPet(page, 'Léo', 'identite');
      await editAnimalIdentity(page, { assuranceCompagnie: 'AssurPet' });

      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'AssurPet');
      assert(!/Passeport/i.test(text), 'Unfilled passport hidden');
      assert(!/Contrat/i.test(text), 'Unfilled contract hidden');
      assertEqual(await page.locator('#animal-contenu a[href^="tel:"]').count(), 0);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-04',
    feature: 'E2E-F24',
    title: 'Preserve passport and insurance fields across backup export/restore and #carnet print',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Gribouille', espece: 'Chat' });
      await openPet(page, 'Gribouille', 'identite');
      await editAnimalIdentity(page, {
        passeport: 'FR-PASS-01',
        assuranceCompagnie: 'MutuelleAnimaux',
        assuranceContrat: 'CTR-77',
        assuranceTelephone: '01 70 00 22 33',
      });

      const backup = await triggerBackupDownload(page);
      await wipeAllData(page);
      await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, { mode: 'remplacer' });
      await reloadApp(page);

      await openPet(page, 'Gribouille', 'identite');
      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'FR-PASS-01');
      assertIncludes(text, 'MutuelleAnimaux');
      assertIncludes(text, 'CTR-77');
      await page.locator('#animal-contenu a[href="tel:0170002233"]').waitFor({ state: 'visible' });

      await printCarnetWithOptions(page, {
        periode: 'tout',
        annexe: false,
        onPrint: async (p) => {
          const carnetText = await p.locator('#carnet').textContent();
          assertIncludes(carnetText, 'FR-PASS-01');
          assertIncludes(carnetText, 'MutuelleAnimaux');
        },
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-05',
    feature: 'E2E-F24',
    title: 'Edit and clear previously saved passport and insurance fields',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Polly', espece: 'Oiseau' });
      await openPet(page, 'Polly', 'identite');
      await editAnimalIdentity(page, {
        passeport: 'EU-999',
        assuranceCompagnie: 'VetAssur',
        assuranceTelephone: '01 23 45 67 89',
      });
      await page.locator('#animal-contenu a[href="tel:0123456789"]').waitFor({ state: 'visible' });

      await editAnimalIdentity(page, {
        passeport: '',
        assuranceTelephone: '',
      });
      const text = await page.locator('#animal-contenu').textContent();
      assert(!text.includes('EU-999'), 'Cleared passport hidden');
      assert(!/Passeport/i.test(text), 'Cleared passport label hidden');
      assertEqual(await page.locator('#animal-contenu a[href="tel:0123456789"]').count(), 0);
      assertIncludes(text, 'VetAssur');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F25 — R5: Carnet Period/Appendix & Responsive / Themes / PWA Checks
     ========================================================================= */
  {
    id: 'E2E-F25-01',
    feature: 'E2E-F25',
    title: 'Filter printable #carnet to 12 derniers mois vs tout',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Max', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Max', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-400), valeur: '15', note: 'Pesée ancienne' });
      await addWeighIn(page, { date: isoDateOffset(-10), valeur: '16,5', note: 'Pesée récente' });

      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(-400), categorie: 'observation', texte: 'Note ancienne >12m' });
      await addNote(page, { date: isoDateOffset(-10), categorie: 'observation', texte: 'Note récente <12m' });

      await openAnimalSection(page, 'identite');
      await printCarnetWithOptions(page, {
        periode: 'tout',
        annexe: false,
        onPrint: async (p) => {
          const text = await p.locator('#carnet').textContent();
          assertIncludes(text, 'Pesée ancienne');
          assertIncludes(text, 'Pesée récente');
          assertIncludes(text, 'Note ancienne >12m');
          assertIncludes(text, 'Note récente <12m');
        },
      });

      await printCarnetWithOptions(page, {
        periode: '12mois',
        annexe: false,
        onPrint: async (p) => {
          const text = await p.locator('#carnet').textContent();
          assertIncludes(text, 'Max');
          assertIncludes(text, 'Pesée récente');
          assertIncludes(text, 'Note récente <12m');
          assert(!text.includes('Pesée ancienne'), 'Old weigh-in excluded by 12-month filter');
          assert(!text.includes('Note ancienne >12m'), 'Old note excluded by 12-month filter');
        },
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-02',
    feature: 'E2E-F25',
    title: 'Include attached note photos in printable #carnet appendix when enabled and omit when disabled',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Daisy', espece: 'Chat' });
      await openPet(page, 'Daisy', 'notes');
      await addNote(page, { date: isoDateOffset(-2), categorie: 'examen', texte: 'Résultat prise de sang', withDocument: true });

      await openAnimalSection(page, 'identite');
      await printCarnetWithOptions(page, {
        periode: 'tout',
        annexe: false,
        onPrint: async (p) => {
          assertIncludes(await p.locator('#carnet').textContent(), '[1 document(s) joint(s) dans l’application]');
          assertEqual(await p.locator('#carnet img:not(.carnet-photo)').count(), 0, 'No note appendix img when disabled');
        },
      });

      await printCarnetWithOptions(page, {
        periode: 'tout',
        annexe: true,
        onPrint: async (p) => {
          const imgs = p.locator('#carnet img:not(.carnet-photo)');
          assertEqual(await imgs.count(), 1, 'Note document photo rendered in #carnet appendix');
          const src = await imgs.first().getAttribute('src');
          assertMatch(src, /^data:image\/jpeg;base64,/);
        },
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-03',
    feature: 'E2E-F25',
    title: 'Verify 390x844 mobile layout with tresgrand text size across all R1-R5 screens without overflow',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      await page.locator('#reglage-taille-2').check();
      await page.waitForFunction(() => document.documentElement.dataset.taille === 'tresgrand');

      await configureEmergencyVet(page, { nom: 'Urgences 24h', clinique: 'CHV', telephone: '01 40 00 11 22' });
      await createPet(page, { nom: 'Toby', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Toby', 'identite');
      await editAnimalIdentity(page, {
        passeport: 'FR-888',
        assuranceCompagnie: 'AssurVet',
        assuranceContrat: 'C-100',
        assuranceTelephone: '01 77 88 99 00',
      });
      await openAnimalSection(page, 'poids');
      await addWeighIn(page, { date: isoDateOffset(-1), valeur: '15' });
      await configureIdealWeight(page, { min: '14', max: '16' });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Sirop', prisesParJour: 1, debut: isoDateOffset(0) });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(0), motif: 'Bilan', cout: '55' });

      const checkNoOverflow = async (label) => {
        const dims = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        assert(dims.scrollWidth <= dims.innerWidth, `Horizontal overflow on ${label}: ${dims.scrollWidth} > ${dims.innerWidth}`);
      };

      await goTab(page, 'accueil');
      await checkNoOverflow('accueil');
      await goTab(page, 'rappels');
      await checkNoOverflow('rappels');
      await goTab(page, 'veterinaires');
      await checkNoOverflow('veterinaires');
      await goTab(page, 'reglages');
      await checkNoOverflow('reglages');

      await openPet(page, 'Toby', 'identite');
      await checkNoOverflow('animal-identite');
      await openAnimalSection(page, 'poids');
      await checkNoOverflow('animal-poids');
      await openChronologieTab(page);
      await checkNoOverflow('animal-chronologie');
      await searchAnimalKeyword(page, 'Sirop');
      await checkNoOverflow('animal-search');
      await searchAnimalKeyword(page, '');
      await openAnimalSection(page, 'identite');
      await openGarde(page);
      await checkNoOverflow('garde');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-04',
    feature: 'E2E-F25',
    title: 'Verify all 3 themes (omni, sombre, clair) render R1-R5 components with zero errors',
    run: async ({ page, monitors, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Misty', espece: 'Chat', unitePoids: 'kg' });
      await openPet(page, 'Misty', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-2), valeur: '4,2' });
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '4,4' });
      await configureIdealWeight(page, { min: '4', max: '5' });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Vitamines', prisesParJour: 1, debut: isoDateOffset(0) });

      for (const [idx, name] of [[2, 'clair'], [1, 'sombre'], [0, 'omni']]) {
        await goTab(page, 'reglages');
        await page.locator(`#reglage-theme-${idx}`).check();
        await page.waitForFunction((t) => document.documentElement.dataset.theme === t, name);

        await openPet(page, 'Misty', 'poids');
        await page.locator('svg.graphique rect.bande-ideale').waitFor({ state: 'visible' });
        assert(await getAnimalTabDot(page, 'traitements').count() > 0, `Tab dot visible in theme ${name}`);
        await openChronologieTab(page);
      }

      assertEqual(monitors.externalRequests.length, 0, 'Zero external requests across theme switches');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-05',
    feature: 'E2E-F25',
    title: 'Verify VERSION (>=1.3.0), CACHE bump (>=omni-animalia-v10), and offline SW precache',
    run: async ({ browser, context, page, baseUrl, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'À propos d’Omni-Animalia', exact: true }).click();
      await page.locator('.vue[data-vue="apropos"]:not([hidden])').waitFor({ state: 'visible' });
      const verText = (await page.locator('#numero-version').textContent()).trim();
      const verMatch = verText.match(/(\d+)\.(\d+)\.(\d+)/);
      assert(verMatch !== null, `Expected semver in #numero-version, got "${verText}"`);
      const verParts = [Number(verMatch[1]), Number(verMatch[2]), Number(verMatch[3])];
      assert(
        verParts[0] > 1 || (verParts[0] === 1 && verParts[1] >= 3),
        `Expected VERSION >= 1.3.0 in #numero-version, got "${verText}"`
      );

      const swText = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');
      const cacheMatch = swText.match(/const\s+CACHE\s*=\s*'omni-animalia-v(\d+)'/);
      assertTruthy(cacheMatch, 'CACHE constant found in sw.js');
      assert(Number(cacheMatch[1]) >= 10, `Expected sw.js CACHE >= omni-animalia-v10, got v${cacheMatch[1]}`);

      await ensureSwControlled(page);
      const cached = await getCachedPaths(page);
      const basePath = new URL(baseUrl).pathname;
      const htmlScripts = await page.evaluate(() =>
        [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'))
      );
      for (const s of htmlScripts) {
        const expected = `${basePath}${s.replace(/^\.\//, '')}`;
        assert(cached.includes(expected), `Script ${expected} must be precached in Cache Storage`);
      }

      await setOfflineWithSw(browser, context, page, true);
      try {
        await reloadApp(page);
        await createPet(page, { nom: 'OffPet', espece: 'Chien' });
        await openPet(page, 'OffPet', 'identite');
        await openChronologieTab(page);
      } finally {
        await setOfflineWithSw(browser, context, page, false);
      }
      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 1,
  name: 'Tier 1 — R1-R5 Feature Coverage (v1.3.0)',
  tests,
};
