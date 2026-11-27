/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 3 — R1-R5 Pairwise Combinations (10 opaque-box cross-feature tests) */
'use strict';

const {
  assert,
  assertEqual,
  assertIncludes,
  assertMatch,
  reloadApp,
  goTab,
  openPet,
  openAnimalSection,
  openGarde,
  submitGardeForm,
  submitAnimalForm,
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
  wipeAllData,
  confirmDialog,
  ensureSwControlled,
  setOfflineWithSw,
  isoDateOffset,
  setupClipboardSpy,
  clickGardeShare,
  triggerLostPetSheet,
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
} = require('./helpers-v130');

const tests = [
  {
    id: 'E2E-F19-F17-F24-T3-19',
    feature: 'E2E-F19',
    title: 'Full v1.3.0 encrypted backup round-trip preserving vetoUrgence, passport, insurance, ideal weight, chronic med, and rdv.cout',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await configureEmergencyVet(page, {
        nom: 'Urgences 24h',
        clinique: 'CHV Nord',
        telephone: '01 40 00 11 22',
      });
      await createPet(page, { nom: 'Atlas', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Atlas', 'identite');
      await editAnimalIdentity(page, {
        passeport: 'FR-ATLAS-99',
        assuranceCompagnie: 'SantéVet',
        assuranceContrat: 'CON-42',
        assuranceTelephone: '01 80 00 55 66',
      });
      await openAnimalSection(page, 'poids');
      await addWeighIn(page, { date: isoDateOffset(-3), valeur: '19' });
      await configureIdealWeight(page, { min: '18', max: '21' });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Cardio', prisesParJour: 1, debut: isoDateOffset(-2), fin: '', statut: 'en-cours' });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(-1), motif: 'Bilan', cout: '85' });

      const backup = await exportBackupWithPassword(page, 'RoundTrip130!');
      assert(!backup.raw.includes('FR-ATLAS-99'), 'Passport must be encrypted');
      assert(!backup.raw.includes('Urgences 24h'), 'Emergency vet must be encrypted');

      await wipeAllData(page);
      await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, {
        password: 'RoundTrip130!',
        mode: 'remplacer',
      });
      await reloadApp(page);

      await goTab(page, 'veterinaires');
      await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0140001122"]').waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      assertMatch(await page.locator('#accueil-liste .carte-animal .badges').textContent(), /(?:^|\D)1 prise à noter\b/);

      await openPet(page, 'Atlas', 'identite');
      const idText = await page.locator('#animal-contenu').textContent();
      assertIncludes(idText, 'FR-ATLAS-99');
      assertIncludes(idText, 'SantéVet');
      assertIncludes(idText, 'CON-42');
      await page.locator('#animal-contenu a[href="tel:0180005566"]').waitFor({ state: 'visible' });

      await openAnimalSection(page, 'poids');
      assertEqual(await page.locator('svg.graphique rect.bande-ideale').count(), 1);

      await goTab(page, 'rappels');
      assertMatch(await page.locator('.vue[data-vue="rappels"]').textContent(), /85,00[\s\u00a0\u202f]*€/);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-F21-T3-20',
    feature: 'E2E-F20',
    title: 'R3 full sync loop across Accueil dose badge, Rappels filter & quick actions, and animal tab dots',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', espece: 'Chien' });
      await openPet(page, 'Rex', 'traitements');
      await addTreatment(page, { nom: 'Apoquel', prisesParJour: 1, debut: isoDateOffset(-5), fin: '', statut: 'en-cours' });
      await openAnimalSection(page, 'vaccins');
      await addVaccine(page, { nom: 'CHPPiL', date: isoDateOffset(-366), rappel: isoDateOffset(-1) });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-90), prochaine: isoDateOffset(0) });
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Couper griffes', echeance: isoDateOffset(0), repete: 'non' });

      await createPet(page, { nom: 'Moka', espece: 'Chat' });
      await openPet(page, 'Moka', 'taches');
      await addTask(page, { titre: 'Brosser Moka', echeance: isoDateOffset(0), repete: 'non' });

      await goTab(page, 'accueil');
      assertMatch(
        await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Rex' }).locator('.badges').textContent(),
        /(?:^|\D)1 prise à noter\b/
      );

      await openPet(page, 'Rex', 'identite');
      for (const sec of ['vaccins', 'antiparasitaires', 'traitements', 'taches']) {
        assert(await getAnimalTabDot(page, sec).count() > 0, `Expected tab dot on ${sec}`);
      }

      await goTab(page, 'rappels');
      await filterRappelsByAnimal(page, 'Rex');
      await page.locator('#rappels-liste').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('#rappels-liste .encart.prises.complet').waitFor({ state: 'visible' });

      await page.locator('#rappels-liste').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-rappel').fill(isoDateOffset(365));
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });

      await goTab(page, 'rappels');
      await filterRappelsByAnimal(page, 'Rex');
      await page.locator('#rappels-liste').getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-prochaine').fill(isoDateOffset(90));
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });

      await goTab(page, 'rappels');
      await filterRappelsByAnimal(page, 'Rex');
      await page.locator('#rappels-liste').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.waitForTimeout(80);

      await goTab(page, 'accueil');
      const rexCardText = await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Rex' }).textContent();
      assert(!/prise[s]?\s+à noter/i.test(rexCardText), 'Rex dose badge cleared');

      await openPet(page, 'Rex', 'identite');
      for (const sec of ['vaccins', 'antiparasitaires', 'traitements', 'taches']) {
        assertEqual(await getAnimalTabDot(page, sec).count(), 0, `Rex ${sec} tab dot cleared`);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-F23-T3-21',
    feature: 'E2E-F22',
    title: 'Keyword search + Chronologie + ideal weight band + Rappels expenses interaction',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Néo', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'Néo', 'poids');
      await configureIdealWeight(page, { min: '10', max: '12' });
      await addWeighIn(page, { date: isoDateOffset(-10), valeur: '9,5' });
      await addWeighIn(page, { date: isoDateOffset(-2), valeur: '11,0' });
      await page.locator('svg.graphique rect.bande-ideale').waitFor({ state: 'visible' });

      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(-8), categorie: 'symptome', texte: 'Toux sèche' });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Sirop apaisant', debut: isoDateOffset(-6) });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(-1), motif: 'Radio thorax', compteRendu: 'Radio normale', cout: '80' });

      await openChronologieTab(page);
      const chrono = await page.locator('#animal-contenu').textContent();
      assertIncludes(chrono, 'Toux sèche');
      assertIncludes(chrono, 'Sirop apaisant');
      assertIncludes(chrono, 'Radio thorax');
      assertIncludes(chrono, '11 kg');

      await searchAnimalKeyword(page, 'Radio normale');
      const jump = page.locator('.vue[data-vue="animal"] [data-section="rdv"], .vue[data-vue="animal"] button, .vue[data-vue="animal"] a')
        .filter({ hasText: /Radio/i })
        .last();
      await jump.click();
      await page.locator('#animal-sections button[data-section="rdv"][aria-current="true"]').waitFor({ state: 'visible' });

      await goTab(page, 'rappels');
      assertMatch(await page.locator('.vue[data-vue="rappels"]').textContent(), /80,00[\s\u00a0\u202f]*€/);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F16-F17-F18-T3-22',
    feature: 'E2E-F16',
    title: 'Emergency readiness flow across Vétos 24h, Identité Fiche animal perdu, and Fiche de garde share',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await configureEmergencyVet(page, { nom: 'Urgences 24h', clinique: 'CHV Est', telephone: '01 48 00 11 22' });
        await createVet(page, { nom: 'Dr Claire', clinique: 'Cabinet Centre', telephone: '01 42 00 33 44' });
        await createPet(page, {
          nom: 'Lou',
          espece: 'Chat',
          race: 'Chartreux',
          couleur: 'Gris bleu',
          puce: '250269600555444',
          vetoLabel: 'Dr Claire (Cabinet Centre)',
        });

        await openPet(page, 'Lou', 'alimentation');
        await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-alimEviter').fill('Lait et thon salé');
        await submitAnimalForm(page, 'Alimentation');

        await openAnimalSection(page, 'notes');
        await addNote(page, { date: isoDateOffset(-1), categorie: 'allergie', texte: 'Allergie poulet' });
        await openAnimalSection(page, 'traitements');
        await addTreatment(page, { nom: 'Cortico', prisesParJour: 1, debut: isoDateOffset(0), statut: 'en-cours' });

        await openAnimalSection(page, 'identite');
        await openGarde(page);
        await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('Paul');
        await page.locator('#champ-telephone').fill('06 55 44 33 22');
        await submitGardeForm(page);

        await page.locator('#garde-contenu a[href="tel:0655443322"]').waitFor({ state: 'visible' });
        await page.locator('#garde-contenu a[href="tel:0142003344"]').waitFor({ state: 'visible' });
        await clickGardeShare(page);
        const gardeShare = await clip.lastText();
        assertIncludes(gardeShare, 'Lou');
        assertIncludes(gardeShare, 'Lait et thon salé');
        assertIncludes(gardeShare, 'Allergie poulet');
        assertIncludes(gardeShare, 'Cortico');
        assertIncludes(gardeShare, '06 55 44 33 22');

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#animal-contenu a[href="tel:0142003344"]').waitFor({ state: 'visible' });
        await triggerLostPetSheet(page);
        const lostShare = await clip.lastText();
        assertIncludes(lostShare, 'Lou');
        assertIncludes(lostShare, 'Chartreux');
        assertIncludes(lostShare, '250269600555444');
        assertIncludes(lostShare, '06 55 44 33 22');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F24-F25-T3-23',
    feature: 'E2E-F24',
    title: 'Passport/insurance fields + old vs recent note photos + 12-month carnet with appendix print',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Vega', espece: 'Chien' });
      await openPet(page, 'Vega', 'identite');
      await editAnimalIdentity(page, {
        passeport: 'FR-VEGA-2026',
        assuranceCompagnie: 'AssurVega',
        assuranceContrat: 'POL-23',
        assuranceTelephone: '01 60 70 80 90',
      });

      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(-450), categorie: 'examen', texte: 'Ancien bilan', withDocument: true, docName: 'old.png' });
      await addNote(page, { date: isoDateOffset(-5), categorie: 'examen', texte: 'Nouveau bilan', withDocument: true, docName: 'new.png' });

      await openAnimalSection(page, 'identite');
      await printCarnetWithOptions(page, {
        periode: '12mois',
        annexe: true,
        onPrint: async (p) => {
          const text = await p.locator('#carnet').textContent();
          assertIncludes(text, 'FR-VEGA-2026');
          assertIncludes(text, 'AssurVega');
          assertIncludes(text, 'Nouveau bilan');
          assert(!text.includes('Ancien bilan'), 'Old note >12m excluded from 12-month carnet');
          assertEqual(await p.locator('#carnet img:not(.carnet-photo)').count(), 1, 'Only recent note appendix photo included');
        },
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F19-F13-T3-24',
    feature: 'E2E-F19',
    title: 'App Lock (Verrou) + Encrypted Backup coexistence with distinct passwords',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'LockEncPet', espece: 'Chat' });
      await activatePassword(page, 'PassApp1');
      const backup = await exportBackupWithPassword(page, 'PassBackup2');

      await reloadApp(page);
      await unlockApp(page, 'PassApp1');

      await wipeAllData(page);
      // App Lock password must fail on encrypted backup
      const wrong = await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, {
        password: 'PassApp1',
        expectDecryptError: true,
      });
      assertIncludes(wrong.decryptError, 'Mot de passe incorrect');

      // Backup password succeeds
      const ok = await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, {
        password: 'PassBackup2',
        mode: 'remplacer',
      });
      assertEqual(ok.restored, true);
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'LockEncPet');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F21-F23-F6-T3-25',
    feature: 'E2E-F21',
    title: 'Multi-pet annual expenses + archive/restore + Rappels filter consistency',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const thisYear = new Date().getFullYear();
      const d = `${thisYear}-04-05`;

      await createPet(page, { nom: 'Actif1', espece: 'Chien' });
      await openPet(page, 'Actif1', 'rdv');
      await addAppointment(page, { date: d, motif: 'Visit 1', cout: '50' });

      await createPet(page, { nom: 'Actif2', espece: 'Chat' });
      await openPet(page, 'Actif2', 'rdv');
      await addAppointment(page, { date: d, motif: 'Visit 2', cout: '70' });

      await createPet(page, { nom: 'ArchPet', espece: 'Lapin' });
      await openPet(page, 'ArchPet', 'rdv');
      await addAppointment(page, { date: d, motif: 'Visit 3', cout: '100' });

      await openAnimalSection(page, 'identite');
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
      assertIncludes(filterText, 'Actif1');
      assertIncludes(filterText, 'Actif2');
      assert(!filterText.includes('ArchPet'), 'Archived pet excluded from Rappels filter');
      const expensesText = await page.locator('.vue[data-vue="rappels"]').textContent();
      assertMatch(expensesText, /120,00[\s\u00a0\u202f]*€|220,00[\s\u00a0\u202f]*€/, 'Annual expenses summary displays valid sum');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F20-F1-T3-26',
    feature: 'E2E-F20',
    title: 'Demo data (Charger un exemple) + R3 home badges & tab dots + Supprimer l’exemple cleanup',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await goTab(page, 'accueil');
      const biscuitCard = page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Biscuit' });
      assertMatch(await biscuitCard.locator('.badges').textContent(), /(?:^|\D)2 prises à noter\b/);

      await openPet(page, 'Biscuit (exemple)', 'identite');
      for (const sec of ['vaccins', 'antiparasitaires', 'traitements', 'taches']) {
        assert(await getAnimalTabDot(page, sec).count() > 0, `Demo pet Biscuit should show tab dot on ${sec}`);
      }
      await openChronologieTab(page);
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Anti-inflammatoire (exemple)');

      await goTab(page, 'reglages');
      await page.locator('#bouton-exemple').click();
      await confirmDialog(page, 'Supprimer l’exemple');
      await page.locator('#bouton-exemple', { hasText: 'Charger un exemple' }).waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Aucun animal pour l’instant.');
      assertEqual(await page.locator('#nav-pastille').evaluate((el) => el.hidden), true);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F22-F25-T3-27',
    feature: 'E2E-F25',
    title: 'Responsive 390x844 + tresgrand text size + all 3 themes across R1-R5 views',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      await page.locator('#reglage-taille-2').check();
      await page.waitForFunction(() => document.documentElement.dataset.taille === 'tresgrand');

      await createPet(page, { nom: 'ThemePet', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'ThemePet', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-2), valeur: '10' });
      await configureIdealWeight(page, { min: '9', max: '11' });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(0), motif: 'Contrôle', cout: '40' });

      for (const [idx, theme] of [[2, 'clair'], [1, 'sombre'], [0, 'omni']]) {
        await goTab(page, 'reglages');
        await page.locator(`#reglage-theme-${idx}`).check();
        await page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);

        await openPet(page, 'ThemePet', 'poids');
        const ov = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        assertEqual(ov, true, `Zero overflow on Poids in theme ${theme} + tresgrand`);
        await openChronologieTab(page);
        const ov2 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        assertEqual(ov2, true, `Zero overflow on Chronologie in theme ${theme} + tresgrand`);
      }

      await reloadApp(page);
      assertEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'omni');
      assertEqual(await page.evaluate(() => document.documentElement.dataset.taille), 'tresgrand');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F25-F15-T3-28',
    feature: 'E2E-F25',
    title: 'Full offline SW mode exercising all R1-R5 features and offline reload persistence',
    run: async ({ browser, context, page, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);
      const clip = await setupClipboardSpy(page);
      try {
        await setOfflineWithSw(browser, context, page, true);
        try {
          await configureEmergencyVet(page, { nom: 'Urgence Offline', clinique: 'CHV', telephone: '01 40 00 11 22' });
          await createPet(page, { nom: 'OffR15', espece: 'Chat', unitePoids: 'kg' });
          await openPet(page, 'OffR15', 'identite');
          await editAnimalIdentity(page, { passeport: 'FR-OFF-1', assuranceCompagnie: 'OffAssur' });
          await openAnimalSection(page, 'poids');
          await addWeighIn(page, { date: isoDateOffset(-5), valeur: '4,0' });
          await configureIdealWeight(page, { min: '3,5', max: '4,5' });
          await openAnimalSection(page, 'traitements');
          await addTreatment(page, { nom: 'Gouttes', prisesParJour: 1, debut: isoDateOffset(0) });

          await searchAnimalKeyword(page, 'Gouttes');
          assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), 'Gouttes');
          await searchAnimalKeyword(page, '');
          await openChronologieTab(page);

          await openAnimalSection(page, 'identite');
          await triggerLostPetSheet(page);
          assertIncludes(await clip.lastText(), 'OffR15');

          await openGarde(page);
          await clickGardeShare(page);
          assertIncludes(await clip.lastText(), 'Gouttes');

          await page.locator('.vue[data-vue="garde"] button.retour').click();
          await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
          await printCarnetWithOptions(page, {
            periode: '12mois',
            annexe: false,
            onPrint: async (p) => {
              assertIncludes(await p.locator('#carnet').textContent(), 'FR-OFF-1');
            },
          });

          const enc = await exportBackupWithPassword(page, 'OfflineEnc2026');
          assertEqual(enc.data.chiffre, true);

          await reloadApp(page);
          await openPet(page, 'OffR15', 'poids');
          assertEqual(await page.locator('svg.graphique rect.bande-ideale').count(), 1);
        } finally {
          await setOfflineWithSw(browser, context, page, false);
        }
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 3,
  name: 'Tier 3 — R1-R5 Pairwise Combinations (v1.3.0)',
  tests,
};
