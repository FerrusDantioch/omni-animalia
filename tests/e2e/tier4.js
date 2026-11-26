/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 4 — Real-World Scenarios, Automated Security Grid & PWA Compliance Audit
   (5 multi-feature workloads + 5 Security Grid E2E tests + 2 PWA Audit tests) */
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
  loadDemoData,
  createPet,
  submitForm,
  confirmDialog,
  uploadSamplePng,
  triggerBackupDownload,
  captureDownload,
  createCorruptPngBuffer,
  isoDateOffset,
  frDate,
  waitForReady,
  ensureSwControlled,
  setOfflineWithSw,
  getCachedPaths,
  assertFieldError,
  uploadFileBuffer,
  uploadJsonImport,
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
} = require('./helpers');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const tests = [
  /* =========================================================================
     1. Realistic Multi-Feature End-to-End Workloads (5 workloads)
     ========================================================================= */
  {
    id: 'E2E-T4-W1',
    feature: 'E2E-F5',
    title: 'Workload 1: Multi-pet household daily care across offline/online transitions',
    run: async ({ browser, context, page, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);

      await createPet(page, {
        nom: 'Luna',
        espece: 'Chien',
        unitePoids: 'kg',
        naissance: isoDateOffset(-730),
      });
      await createPet(page, {
        nom: 'Mochi',
        espece: 'Chat',
        unitePoids: 'g',
        naissance: isoDateOffset(-90),
      });

      const today = isoDateOffset(0);
      const minus5 = isoDateOffset(-5);
      const minus1 = isoDateOffset(-1);
      const plus5 = isoDateOffset(5);
      const plus6 = isoDateOffset(6);

      await setOfflineWithSw(browser, context, page, true);
      try {
        await openPet(page, 'Luna', 'poids');
        await addWeighIn(page, { date: minus5, valeur: '22.4' });
        await addWeighIn(page, { date: today, valeur: '22.0' });
        await page.locator('#animal-contenu svg.graphique polyline.courbe').waitFor({ state: 'visible' });
        assertIncludes(await page.locator('#animal-contenu').textContent(), '−0,4 kg');

        await openAnimalSection(page, 'traitements');
        await addTreatment(page, {
          nom: 'Antibio',
          dose: '1 comprimé',
          frequence: 'matin et soir',
          prisesParJour: 2,
          debut: today,
          fin: plus5,
        });

        await openAnimalSection(page, 'taches');
        await addTask(page, {
          titre: 'Brossage',
          echeance: minus1,
          repete: 'oui',
          recN: 1,
          recUnite: 'semaines',
        });

        await openPet(page, 'Mochi', 'poids');
        await addWeighIn(page, { date: minus5, valeur: '850' });
        await addWeighIn(page, { date: today, valeur: '920' });
        assertIncludes(await page.locator('#animal-contenu').textContent(), '+70 g');

        await openAnimalSection(page, 'traitements');
        await addTreatment(page, {
          nom: 'Vitamines',
          dose: '2 gouttes',
          prisesParJour: 1,
          debut: today,
        });

        // Rappels page offline: 2 daily medications + 1 overdue task
        await goTab(page, 'rappels');
        await page.locator('#nav-pastille:not([hidden])').filter({ hasText: '1' }).waitFor({ state: 'visible' });
        await page.locator('#rappels-medicaments').filter({ hasText: 'Médicaments du jour (2)' }).waitFor({ state: 'visible' });
        await page.locator('#rappels-retard').filter({ hasText: 'En retard (1)' }).waitFor({ state: 'visible' });

        const lunaCard = page.locator('#rappels-liste article.carte-rappel').filter({ hasText: 'Luna' }).filter({ hasText: 'Antibio' });
        await lunaCard.getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
        await lunaCard.filter({ hasText: '1 prise sur 2' }).waitFor({ state: 'visible' });

        const mochiCard = page.locator('#rappels-liste article.carte-rappel').filter({ hasText: 'Mochi' }).filter({ hasText: 'Vitamines' });
        await mochiCard.getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
        await mochiCard.filter({ hasText: '1 prise sur 1' }).waitFor({ state: 'visible' });

        const overdueSection = page.locator('#rappels-liste section.groupe-rappels').filter({ has: page.locator('#rappels-retard') });
        await overdueSection.getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#nav-pastille').hidden === true);
        await page.locator('#rappels-semaine').filter({ hasText: 'Dans les 7 jours (2)' }).waitFor({ state: 'visible' });
        assertIncludes(
          await page.locator('#rappels-liste section.groupe-rappels').filter({ has: page.locator('#rappels-semaine') }).textContent(),
          frDate(plus6)
        );
      } finally {
        await setOfflineWithSw(browser, context, page, false);
      }

      // Reload back online and verify persistence
      await reloadApp(page);
      await openPet(page, 'Luna', 'traitements');
      assertIncludes(await page.locator('#animal-contenu').textContent(), '1 prise sur 2');
      await openAnimalSection(page, 'poids');
      await page.locator('#animal-contenu svg.graphique polyline.courbe').waitFor({ state: 'visible' });

      await openPet(page, 'Mochi', 'traitements');
      assertIncludes(await page.locator('#animal-contenu').textContent(), '1 prise sur 1');
      await openAnimalSection(page, 'poids');
      await page.locator('#animal-contenu svg.graphique polyline.courbe').waitFor({ state: 'visible' });

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-W2',
    feature: 'E2E-F6',
    title: 'Workload 2: Vet visit lifecycle, follow-up renewals, costs, ICS & Google Calendar, and vet delete cascade',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, {
        nom: 'Dr Moreau',
        clinique: 'Clinique du Parc',
        telephone: '01 45 67 89 10',
        adresse: '18 rue Pasteur\nLyon',
      });
      await createPet(page, { nom: 'Pixel', espece: 'Chien', vetoLabel: 'Dr Moreau (Clinique du Parc)' });

      const today = isoDateOffset(0);
      await openPet(page, 'Pixel', 'vaccins');
      await addVaccine(page, { nom: 'CHPPiL', date: isoDateOffset(-365), rappel: today, veterinaire: 'Dr Moreau' });

      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-90), prochaine: today });
      await page.locator('#nav-pastille:not([hidden])').filter({ hasText: '2' }).waitFor({ state: 'visible' });

      await openAnimalSection(page, 'rdv');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-veterinaire').inputValue(), 'Dr Moreau');
      await page.locator('#champ-date').fill(isoDateOffset(2));
      await page.locator('#champ-heure').fill('14:00');
      await page.locator('#champ-motif').fill('Rappel vaccins');
      await page.locator('#champ-cout').fill('75');
      await submitAnimalForm(page, 'Rendez-vous vétérinaires');

      // Google Calendar window.open verification
      const calls = await captureWindowOpen(page, async () => {
        await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
        await confirmDialog(page, 'Ouvrir Google Agenda');
      });
      assertEqual(calls.length, 1);
      assertEqual(calls[0].features, 'noopener,noreferrer');
      assertEqual(new URL(calls[0].url).searchParams.get('location'), 'Clinique du Parc, 18 rue Pasteur, Lyon');

      // Bulk .ics export on Rappels (3 VEVENTs: today's vaccine + today's antiparasitic + +2d appointment)
      await goTab(page, 'rappels');
      await page.locator('#agenda-tout summary').click();
      const ics = await captureDownload(page, () => page.locator('#bouton-agenda-tout').click());
      const unfolded = unfoldIcs(ics.content);
      assertEqual((unfolded.match(/BEGIN:VEVENT/g) || []).length, 3);
      assertIncludes(unfolded, 'TRIGGER:-PT1H');

      // Renew vaccine & antiparasitic
      await openPet(page, 'Pixel', 'vaccins');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-rappel').fill(isoDateOffset(365));
      await submitAnimalForm(page, 'Vaccins');
      assertIncludes(await page.locator('#animal-contenu').textContent(), '(déjà renouvelé)');

      await openAnimalSection(page, 'antiparasitaires');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-prochaine').fill(isoDateOffset(90));
      await submitAnimalForm(page, 'Vermifuges et antiparasitaires');
      assertIncludes(await page.locator('#animal-contenu').textContent(), '(déjà faite)');

      // Past appointment + delayed compteRendu + yearly cost summary
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(-10), motif: 'Bilan pré-vaccinal', veterinaire: 'Dr Moreau', cout: 45 });
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter le compte rendu', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-compteRendu').fill('Tout va bien');
      await submitAnimalForm(page, 'Rendez-vous vétérinaires');
      assertMatch(await page.locator('#animal-contenu .encart.frais').textContent(), /120,00\s*€/);

      // Delete Dr Moreau -> warning mentions Pixel; Identité unlinked, RDV preserves Dr Moreau
      await goTab(page, 'veterinaires');
      await page.locator('#vetos-liste .carte-fiche').getByRole('button', { name: 'Supprimer', exact: true }).click();
      await page.locator('dialog#dialogue[open]').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('dialog#dialogue').textContent(), 'Pixel');
      await confirmDialog(page, 'Supprimer');
      await page.locator('#vetos-liste', { hasText: 'Aucun vétérinaire enregistré.' }).waitFor({ state: 'visible' });

      await openPet(page, 'Pixel', 'identite');
      assert(!((await page.locator('#animal-contenu').textContent()).includes('Vétérinaire habituel')));
      await openAnimalSection(page, 'rdv');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Dr Moreau');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-W3',
    feature: 'E2E-F10',
    title: 'Workload 3: Pet-sitter care sheet preparation, print views, password lock & background relock #carnet clear',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Urgence', clinique: 'Clinique 24h', telephone: '06 00 11 22 33' });
      await createPet(page, {
        nom: 'Coco',
        espece: 'Chat',
        puce: '250269800123456',
        withPhoto: true,
        vetoLabel: 'Dr Urgence (Clinique 24h)',
      });

      await openPet(page, 'Coco', 'alimentation');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-alimMarque').fill('Croquettes rénales');
      await page.locator('#champ-alimQuantite').fill('60 g');
      await page.locator('#champ-alimRepas').fill('3');
      await page.locator('#champ-alimEviter').fill('Lait et oignon');
      await submitAnimalForm(page, 'Alimentation');

      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(-2), categorie: 'allergie', texte: 'Allergie acariens' });
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Calme', withDocument: true });

      // Filter notes, verify, reset, inspect image viewer
      await page.locator('details.filtre summary').click();
      await page.locator('#filtre-categorie').selectOption('allergie');
      await page.locator('details.filtre').getByRole('button', { name: 'Appliquer le filtre', exact: true }).click();
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^1 note\(s\) sur 2 \(filtre actif\)\.$/ })
        .waitFor({ state: 'visible' });
      await page.locator('details.filtre').getByRole('button', { name: 'Tout afficher', exact: true }).click();
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^2 note\(s\)\.$/ })
        .waitFor({ state: 'visible' });

      await page.locator('#animal-contenu button.vignette-document').first().click();
      const viewer = page.locator('dialog#visionneuse[open]');
      await viewer.waitFor({ state: 'visible' });
      await viewer.getByRole('button', { name: 'Taille réelle', exact: true }).click();
      await viewer.getByRole('button', { name: 'Fermer', exact: true }).click();
      await page.locator('dialog#visionneuse:not([open])').waitFor({ state: 'attached' });

      // Active & future treatments
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Insuline', prisesParJour: 2, debut: isoDateOffset(0) });
      const plus5 = isoDateOffset(5);
      await addTreatment(page, { nom: 'Cure', debut: plus5 });

      // Prepare care sheet
      await openAnimalSection(page, 'identite');
      await openGarde(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter des consignes', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-consignesGarde').fill('Laisser volets entrouverts');
      await submitGardeForm(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter mon contact (propriétaire)', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Julie');
      await page.locator('#champ-telephone').fill('06 77 88 99 00');
      await submitGardeForm(page);

      const gardeText = await page.locator('#garde-contenu').textContent();
      for (const expected of [
        'À contacter', 'Julie', 'Dr Urgence', 'À ne surtout pas donner', 'Lait et oignon',
        'Allergies connues', 'Allergie acariens', 'Repas', 'Croquettes rénales',
        'Médicaments en cours', 'Insuline', 'Cure', `À venir (à partir du ${frDate(plus5)})`,
        'Consignes', 'Laisser volets entrouverts', 'Identification', '250269800123456',
      ]) {
        assertIncludes(gardeText, expected);
      }
      await page.locator('#garde-contenu a[href="tel:0677889900"]').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu a[href="tel:0600112233"]').waitFor({ state: 'visible' });

      // Probe print view for Fiche de garde (plain phone text, zero a.lien-tel)
      await probePrintView(
        page,
        () => page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).click(),
        {
          carnetChildSelector: '.fiche-garde',
          expectedTitleContains: 'Fiche de garde - Coco',
          onPrint: async (p) => {
            assertEqual(await p.locator('#carnet a.lien-tel').count(), 0);
            assertIncludes(await p.locator('#carnet').textContent(), 'Téléphone : 06 77 88 99 00');
          },
        }
      );

      // Probe print view for Carnet de santé
      await openAnimalFromView(page, page.locator('.vue[data-vue="garde"] button.retour'));
      await probePrintView(
        page,
        () => page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click(),
        {
          carnetChildSelector: '.carnet-entete',
          expectedTitleContains: 'Carnet de santé - Coco',
        }
      );

      // Activate lock, populate #carnet, trigger background relock -> #carnet cleared
      await activatePassword(page, 'Garde2026!');
      await openPet(page, 'Coco', 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();
      await page.locator('#carnet .carnet-entete').waitFor({ state: 'attached' });
      await triggerBackgroundRelock(page, 305000);
      assertEqual(await page.locator('#carnet').evaluate((el) => el.children.length), 0);
      assertEqual(await page.locator('#principal').evaluate((el) => el.hidden), true);

      await unlockApp(page, 'Garde2026!');
      assertEqual(await page.locator('#animal-titre').textContent(), 'Coco');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-W4',
    feature: 'E2E-F12',
    title: 'Workload 4: Backup migration & recovery across settings, demo cleanup, wipe, .txt replace & merge',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      await page.locator('#reglage-theme-2').check();
      await page.locator('#reglage-taille-2').check();
      await page.locator('#reglage-unite-1').check();
      await page.waitForFunction(() =>
        document.documentElement.dataset.theme === 'clair' && document.documentElement.dataset.taille === 'tresgrand'
      );

      await loadDemoData(page);

      // Create custom pet Perso (must inherit default unit 'g')
      await goTab(page, 'accueil');
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('[data-champ="unitePoids"] input[type="radio"][value="g"]').isChecked(), true);
      await page.locator('#champ-nom').fill('Perso');
      await page.locator('#champ-espece').fill('Lapin');
      await submitForm(page);
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

      await openPet(page, 'Perso', 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '1200' });
      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'allergie', texte: 'Foin poussiéreux' });
      await openAnimalSection(page, 'identite');
      await openGarde(page);
      await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Camille');
      await page.locator('#champ-telephone').fill('06 12 34 56 78');
      await submitGardeForm(page);

      // Delete demo data while preserving Perso
      await goTab(page, 'reglages');
      await page.locator('#bouton-exemple').click();
      await confirmDialog(page, 'Supprimer l’exemple');
      await page.locator('#bouton-exemple', { hasText: 'Charger un exemple' }).waitFor({ state: 'visible' });

      const backup1 = await triggerBackupDownload(page);
      assertEqual(backup1.data.reglages.theme, 'clair');
      assertEqual(backup1.data.reglages.taille, 'tresgrand');
      assertEqual(backup1.data.reglages.unitePoids, 'g');
      assertEqual(backup1.data.reglages.contactGarde.nom, 'Camille');
      assertEqual(backup1.data.donnees.animaux.length, 1);

      // Wipe all data -> resets theme/size to omni/normal
      await wipeAllData(page);
      await page.waitForFunction(() =>
        document.documentElement.dataset.theme === 'omni' && document.documentElement.dataset.taille === 'normal'
      );

      // Create separate pet RemotePet while preserving clair/tresgrand for later merge
      await goTab(page, 'reglages');
      await page.locator('#reglage-theme-2').check();
      await page.locator('#reglage-taille-2').check();
      await page.waitForFunction(() =>
        document.documentElement.dataset.theme === 'clair' && document.documentElement.dataset.taille === 'tresgrand'
      );
      await createPet(page, { nom: 'RemotePet', espece: 'Furet' });
      const backup2 = await triggerBackupDownload(page);

      // Wipe again, then restore backup1 via .txt extension in replace mode
      await wipeAllData(page);
      await restoreBackup(page, 'backup-migrated.txt', backup1.raw, 'remplacer');
      await page.waitForFunction(() =>
        document.documentElement.dataset.theme === 'clair' && document.documentElement.dataset.taille === 'tresgrand'
      );

      // Add LocalPet, then merge backup2
      await createPet(page, { nom: 'LocalPet', espece: 'Chat' });
      await restoreBackup(page, backup2.filename, backup2.raw, 'fusionner');

      await reloadApp(page);
      assertEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'clair');
      assertEqual(await page.evaluate(() => document.documentElement.dataset.taille), 'tresgrand');
      await goTab(page, 'accueil');
      const homeText = await page.locator('#accueil-liste').textContent();
      assertIncludes(homeText, 'Perso');
      assertIncludes(homeText, 'LocalPet');
      assertIncludes(homeText, 'RemotePet');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-W5',
    feature: 'E2E-F15',
    title: 'Workload 5: Full offline PWA resilience, invalid UI/import recovery, offline backup & online restoration',
    run: async ({ browser, context, page, baseUrl, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);
      await createPet(page, { nom: 'ResilientPet', espece: 'Chien' });
      await openPet(page, 'ResilientPet', 'rdv');
      await addAppointment(page, { date: isoDateOffset(2), heure: '11:00', motif: 'Checkup' });

      await setOfflineWithSw(browser, context, page, true);
      try {
        await reloadApp(page);

        // Unknown subpath offline navigation fallback
        await page.goto(`${baseUrl}offline-route`, { waitUntil: 'domcontentloaded' });
        await waitForReady(page);
        await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
        assertIncludes(await page.locator('#accueil-liste').textContent(), 'ResilientPet');

        // Invalid UI inputs: whitespace name & corrupt PNG
        await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('   ');
        await submitForm(page, { expectErrors: true });
        await assertFieldError(page, 'nom', 'Ce champ est obligatoire.');

        const photoInput = page.locator('[data-champ="photo"] input[type="file"]:not([capture])');
        await uploadFileBuffer(page, photoInput, {
          name: 'bad.png',
          mimeType: 'image/png',
          buffer: createCorruptPngBuffer(),
        });
        await page.locator('[data-champ="photo"] .aide')
          .filter({ hasNotText: 'Aucune photo' })
          .filter({ hasNotText: 'Préparation' })
          .waitFor({ state: 'visible' });
        const photoErrText = await page.locator('[data-champ="photo"] .aide').textContent();
        assert(!photoErrText.includes('Photo prête'), 'Corrupt PNG must not succeed');
        await page.locator('.vue[data-vue="formulaire"] button.retour').click();
        await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

        // Invalid weigh-in value 0
        await openPet(page, 'ResilientPet', 'poids');
        await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-valeur').fill('0');
        await submitForm(page, { expectErrors: true });
        await assertFieldError(page, 'valeur', 'Le nombre doit être plus grand que zéro.');
        await page.locator('.vue[data-vue="formulaire"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });

        // Corrupted JSON & incompatible versionFormat imports rejected cleanly
        for (const badPayload of [
          '{not-valid-json',
          { format: 'omni-animaux-sauvegarde', versionFormat: 99, donnees: {} },
        ]) {
          await uploadJsonImport(page, 'bad.json', badPayload);
          const dlg = page.locator('dialog#dialogue[open]');
          await dlg.waitFor({ state: 'visible' });
          assertEqual(await dlg.locator('#dialogue-titre').textContent(), 'Fichier refusé');
          assertIncludes(await dlg.textContent(), 'Rien n’a été modifié.');
          await confirmDialog(page, 'J’ai compris');
        }

        // Offline Google Agenda click displays offline explanation modal
        await openPet(page, 'ResilientPet', 'rdv');
        await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
        const offlineDlg = page.locator('dialog#dialogue[open]');
        await offlineDlg.waitFor({ state: 'visible' });
        assertEqual(await offlineDlg.locator('#dialogue-titre').textContent(), 'Pas de connexion internet');
        await confirmDialog(page, 'J’ai compris');

        // Export backup while offline
        const offlineBackup = await triggerBackupDownload(page);
        assertEqual(offlineBackup.data.donnees.animaux.length, 1);
      } finally {
        await setOfflineWithSw(browser, context, page, false);
      }

      // Network recovery: online Google Agenda opens confirmation modal normally
      await page.waitForFunction(() => navigator.onLine === true);
      await openPet(page, 'ResilientPet', 'rdv');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
      const onlineDlg = page.locator('dialog#dialogue[open]');
      await onlineDlg.waitFor({ state: 'visible' });
      assertEqual(await onlineDlg.locator('#dialogue-titre').textContent(), 'Ajouter à Google Agenda');
      await confirmDialog(page, 'Annuler');

      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     2. Automated Security Grid E2E Audit (SEC-01..SEC-05)
     ========================================================================= */
  {
    id: 'E2E-T4-SEC-01',
    feature: 'E2E-F15',
    title: 'Security Grid SEC-01: Strict meta CSP, no-referrer, externalized init-theme.js & zero inline code/styles',
    run: async ({ page, monitors, assertNoRuntimeErrors }) => {
      const audit = await page.evaluate(() => {
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        const refMeta = document.querySelector('meta[name="referrer"]');
        const scripts = [...document.querySelectorAll('script')];
        const inlineScripts = scripts.filter((s) => !s.getAttribute('src'));
        const headScripts = [...document.head.querySelectorAll('script')];
        const inlineStyles = [...document.querySelectorAll('[style]')];
        const inlineHandlers = [];
        for (const el of document.querySelectorAll('*')) {
          for (const attr of el.attributes) {
            if (/^on/i.test(attr.name)) {
              inlineHandlers.push(`${el.tagName}:${attr.name}`);
            }
          }
        }
        return {
          csp: cspMeta ? cspMeta.getAttribute('content') : null,
          referrer: refMeta ? refMeta.getAttribute('content') : null,
          inlineScriptCount: inlineScripts.length,
          firstHeadScriptSrc: headScripts[0] ? headScripts[0].getAttribute('src') : null,
          inlineStyleCount: inlineStyles.length,
          inlineHandlers,
        };
      });

      assertEqual(
        audit.csp,
        "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'"
      );
      assertEqual(audit.referrer, 'no-referrer');
      assertEqual(audit.inlineScriptCount, 0, 'Zero inline <script> elements');
      assertEqual(audit.firstHeadScriptSrc, './init-theme.js', 'init-theme.js externalized first in <head>');
      assertEqual(audit.inlineStyleCount, 0, 'Zero inline style= attributes');
      assertEqual(audit.inlineHandlers.length, 0, 'Zero inline on* event attributes');
      assertEqual(monitors.cspViolations.length, 0, 'Zero CSP violations');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-SEC-02',
    feature: 'E2E-F9',
    title: 'Security Grid SEC-02: XSS payloads safely neutralized across all 13 UI forms, JSON import & render surfaces',
    run: async ({ page, monitors, assertNoRuntimeErrors }) => {
      const P1 = '<img src=x onerror=window.__xss=1>';
      const P2 = '<script>window.__xss=2</script>';
      const P3 = 'javascript:window.__xss=3';

      // Verify UI puce/tatouage regex rejects XSS markup cleanly
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill(P1);
      await page.locator('#champ-puce').fill(P1);
      await page.locator('#champ-tatouage').fill(P2);
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'puce', 'chiffres, lettres, espaces et tirets');
      await assertFieldError(page, 'tatouage', 'chiffres, lettres, espaces et tirets');
      await page.locator('.vue[data-vue="formulaire"] button.retour').click();
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

      // Exercise all 13 UI text input forms with XSS payloads
      await createVet(page, {
        nom: P1,
        clinique: P2,
        telephone: '01 23 45 67 89',
        adresse: P3,
        notes: P1,
      });

      await createPet(page, {
        nom: P1,
        espece: P2,
        race: P3,
        couleur: P1,
        notes: P2,
        vetoLabel: `${P1} (${P2})`,
      });

      await openPet(page, P1, 'alimentation');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-alimMarque').fill(P1);
      await page.locator('#champ-alimQuantite').fill(P2);
      await page.locator('#champ-alimRemarques').fill(P3);
      await page.locator('#champ-alimEviter').fill(P1);
      await submitAnimalForm(page, 'Alimentation');

      await openAnimalSection(page, 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '5', note: P2 });

      await openAnimalSection(page, 'vaccins');
      await addVaccine(page, { nom: P1, date: isoDateOffset(-5), rappel: isoDateOffset(1), veterinaire: P2, lot: P3, note: P1 });

      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: P2, date: isoDateOffset(-2), prochaine: isoDateOffset(2), dose: P3, note: P1 });

      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: P1, dose: P2, frequence: P3, prisesParJour: 1, debut: isoDateOffset(0), note: P1 });

      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'allergie', texte: P2 });

      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(3), heure: '10:00', motif: P1, veterinaire: P2, compteRendu: P3 });

      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: P2, echeance: isoDateOffset(0), repete: 'non', note: P1 });

      // Care sheet consignes & owner contact
      await openAnimalSection(page, 'identite');
      await openGarde(page);
      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter des consignes', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-consignesGarde').fill(P2);
      await submitGardeForm(page);

      await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill(P3);
      await page.locator('#champ-telephone').fill('06 11 22 33 44');
      await submitGardeForm(page);

      // Export & re-import with XSS in puce, tatouage, and veterinaires.telephone (bypassing UI regex via JSON)
      const exported = await triggerBackupDownload(page);
      exported.data.donnees.animaux[0].puce = P1;
      exported.data.donnees.animaux[0].tatouage = P2;
      exported.data.donnees.veterinaires[0].telephone = P3;
      await restoreBackup(page, 'xss-backup.json', exported.data, 'remplacer');

      // Visit every render surface and assert zero execution/injection
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), P1);
      await goTab(page, 'rappels');
      assertIncludes(await page.locator('#rappels-liste').textContent(), P1);
      await goTab(page, 'veterinaires');
      assertIncludes(await page.locator('#vetos-liste').textContent(), P1);

      await openPet(page, P1, 'identite');
      for (const sec of ['identite', 'poids', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes', 'alimentation', 'taches']) {
        await openAnimalSection(page, sec);
      }

      // Probe both print builds (#carnet)
      await openAnimalSection(page, 'identite');
      await probePrintView(
        page,
        () => page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click(),
        { carnetChildSelector: '.carnet-entete' }
      );
      await openGarde(page);
      assertIncludes(await page.locator('#garde-contenu').textContent(), P2);
      await probePrintView(
        page,
        () => page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).click(),
        { carnetChildSelector: '.fiche-garde' }
      );

      // Archive with XSS precision payload -> visit #archives and delete confirmation dialog
      await openAnimalFromView(page, page.locator('.vue[data-vue="garde"] button.retour'));
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[type="radio"][value="autre"]').check();
      await page.locator('#champ-precision').waitFor({ state: 'visible' });
      await page.locator('#champ-precision').fill(P1);
      await submitAnimalForm(page, 'Identité');

      await goTab(page, 'accueil');
      await openArchives(page);
      assertIncludes(await page.locator('#archives-liste').textContent(), P1);
      await page.locator('#archives-liste .carte-archive').getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
      await page.locator('dialog#dialogue[open]').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('dialog#dialogue').textContent(), P1);
      await confirmDialog(page, 'Annuler');

      const secState = await page.evaluate(() => ({
        xss: window.__xss,
        injectedImgCount: document.querySelectorAll('img[src="x"]').length,
        inlineScriptCount: document.querySelectorAll('script:not([src])').length,
      }));
      assertEqual(secState.xss, undefined, 'XSS payload must never execute');
      assertEqual(secState.injectedImgCount, 0, 'Zero injected <img> tags');
      assertEqual(secState.inlineScriptCount, 0, 'Zero injected <script> tags');
      assertEqual(monitors.cspViolations.length, 0, 'Zero CSP violations');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-SEC-03',
    feature: 'E2E-F12',
    title: 'Security Grid SEC-03: Prototype pollution JSON import isolation & unsafe image/document URI rejection',
    run: async ({ page, assertNoRuntimeErrors }) => {
      // 1. Unsafe photo / document URI payloads must be rejected
      const badUriBackups = [
        {
          desc: 'javascript photo URI',
          data: {
            format: 'omni-animaux-sauvegarde',
            versionFormat: 1,
            donnees: { animaux: [{ id: 'a1', nom: 'BadPhoto', photo: 'javascript:window.__xss=3' }] },
          },
        },
        {
          desc: 'remote https photo URI',
          data: {
            format: 'omni-animaux-sauvegarde',
            versionFormat: 1,
            donnees: { animaux: [{ id: 'a1', nom: 'RemotePhoto', photo: 'https://evil.example/a.png' }] },
          },
        },
        {
          desc: 'SVG data photo URI',
          data: {
            format: 'omni-animaux-sauvegarde',
            versionFormat: 1,
            donnees: { animaux: [{ id: 'a1', nom: 'SvgPhoto', photo: 'data:image/svg+xml;base64,PHN2Zz4=' }] },
          },
        },
        {
          desc: 'HTML data attachment URI',
          data: {
            format: 'omni-animaux-sauvegarde',
            versionFormat: 1,
            donnees: {
              animaux: [{ id: 'a1', nom: 'OkPet' }],
              notes: [{ id: 'n1', animalId: 'a1', date: isoDateOffset(0), texte: 'doc', pieces: ['data:text/html;base64,PGI+'] }],
            },
          },
        },
        {
          desc: 'prototype key inside traitement.prises',
          raw: `{"format":"omni-animaux-sauvegarde","versionFormat":1,"donnees":{"animaux":[{"id":"a1","nom":"OkPet"}],"traitements":[{"id":"t1","animalId":"a1","nom":"Med","prises":{"__proto__":["08:00"]}}]}}`,
        },
      ];

      for (const item of badUriBackups) {
        await uploadJsonImport(page, 'bad-uri.json', item.raw || item.data);
        const dlg = page.locator('dialog#dialogue[open]');
        await dlg.waitFor({ state: 'visible' });
        assertEqual(await dlg.locator('#dialogue-titre').textContent(), 'Fichier refusé', `Expected rejection for ${item.desc}`);
        await confirmDialog(page, 'J’ai compris');
      }

      // 2. Prototype pollution keys across all object levels in an otherwise valid backup
      const pollutionJson = `{
        "format": "omni-animaux-sauvegarde",
        "versionFormat": 1,
        "__proto__": { "__omniPolluted": true },
        "constructor": { "prototype": { "__omniPolluted": true } },
        "prototype": { "__omniPolluted": true },
        "donnees": {
          "__proto__": { "__omniPolluted": true },
          "constructor": { "prototype": { "__omniPolluted": true } },
          "animaux": [{
            "id": "proto-pet-1",
            "nom": "ProtoSafe",
            "espece": "Chat",
            "__proto__": { "__omniPolluted": true },
            "constructor": { "prototype": { "__omniPolluted": true } },
            "prototype": { "__omniPolluted": true }
          }],
          "traitements": [{
            "id": "proto-trt-1",
            "animalId": "proto-pet-1",
            "nom": "Traitement",
            "statut": "en-cours",
            "prises": { "${isoDateOffset(0)}": ["08:00"] }
          }]
        },
        "reglages": {
          "__proto__": { "__omniPolluted": true },
          "constructor": { "prototype": { "__omniPolluted": true } },
          "theme": "omni",
          "contactGarde": {
            "__proto__": { "__omniPolluted": true },
            "nom": "SafeOwner",
            "telephone": "06 11 22 33 44"
          }
        }
      }`;
      assertIncludes(pollutionJson, '"__proto__"');

      await restoreBackup(page, 'proto-test.json', pollutionJson, 'remplacer');
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'ProtoSafe');

      const polluted = await page.evaluate(() => ({
        plainObj: ({}).__omniPolluted,
        objProto: Object.prototype.__omniPolluted,
        arrProto: Array.prototype.__omniPolluted,
        xss: window.__xss,
      }));
      assertEqual(polluted.plainObj, undefined, 'Plain object must not be polluted');
      assertEqual(polluted.objProto, undefined, 'Object.prototype must not be polluted');
      assertEqual(polluted.arrProto, undefined, 'Array.prototype must not be polluted');
      assertEqual(polluted.xss, undefined);

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-SEC-04',
    feature: 'E2E-F6',
    title: 'Security Grid SEC-04: .ics CRLF/control-char injection neutralization & Google Calendar noopener,noreferrer',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, {
        nom: 'Dr Evil',
        clinique: 'Clinique;A,B\\C\nLigne2',
        adresse: '1 rue X\r\nATTENDEE:mailto:evil@test\x00\x07',
      });
      await createPet(page, { nom: 'Rex\nEND:VEVENT', espece: 'Chien', vetoLabel: 'Dr Evil (Clinique;A,B\\C Ligne2)' });

      // Note: input[type="text"] strips \r\n on fill in browsers, so we import an appointment with raw CRLF & control chars.
      // First verify unsafe ID characters (';', '/') are rejected at import validation.
      const exported = await triggerBackupDownload(page);
      const petId = exported.data.donnees.animaux[0].id;
      exported.data.donnees.animaux[0].nom = 'Rex\nEND:VEVENT';
      exported.data.donnees.veterinaires[0].clinique = 'Clinique;A,B\\C\nLigne2';
      exported.data.donnees.veterinaires[0].adresse = '1 rue X\r\nATTENDEE:mailto:evil@test\x00\x07';
      exported.data.donnees.rdv = [
        {
          id: 'rdv;crlf/id',
          animalId: petId,
          date: isoDateOffset(2),
          heure: '14:00',
          motif: 'Visite;1,2\r\nBEGIN:VALARM\x01\x1f',
          veterinaire: 'Dr Evil',
        },
      ];
      await uploadJsonImport(page, 'ics-bad-id.json', exported.data);
      const badIdDlg = page.locator('dialog#dialogue[open]');
      await badIdDlg.waitFor({ state: 'visible' });
      assertEqual(await badIdDlg.locator('#dialogue-titre').textContent(), 'Fichier refusé');
      await confirmDialog(page, 'J’ai compris');

      exported.data.donnees.rdv[0].id = 'rdv-crlf.01';
      await restoreBackup(page, 'ics-crlf.json', exported.data, 'remplacer');

      await goTab(page, 'rappels');
      await page.locator('#agenda-tout summary').click();
      const ics = await captureDownload(page, () => page.locator('#bouton-agenda-tout').click());
      assertMatch(ics.filename, /^omni-animalia-rappels-\d{4}-\d{2}-\d{2}\.ics$/);

      // Zero disallowed ASCII control bytes (only \r and \n are valid CRLF separators)
      assert(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(ics.content), 'ICS must strip ASCII control bytes');

      const unfolded = unfoldIcs(ics.content);
      const lines = unfolded.split('\r\n').filter(Boolean);
      assertEqual(lines.filter((l) => l === 'BEGIN:VEVENT').length, 1, 'Exactly 1 VEVENT (no injected VEVENT)');
      assertEqual(lines.filter((l) => l === 'END:VEVENT').length, 1, 'Exactly 1 END:VEVENT');
      assertEqual(lines.filter((l) => l === 'BEGIN:VALARM').length, 2, 'Exactly 2 legitimate VALARMs (-P1D & -PT1H)');
      assertEqual(lines.some((l) => l.startsWith('ATTENDEE:')), false, 'Injected ATTENDEE property must not exist');

      const summaryLine = lines.find((l) => l.startsWith('SUMMARY:'));
      const locationLine = lines.find((l) => l.startsWith('LOCATION:'));
      const uidLine = lines.find((l) => l.startsWith('UID:'));
      assertTruthy(summaryLine, 'SUMMARY present');
      assertTruthy(locationLine, 'LOCATION present');
      assertMatch(uidLine, /^UID:[A-Za-z0-9._-]+@omni-animalia$/, 'UID sanitized');
      assertIncludes(summaryLine, '\\n');
      assertIncludes(summaryLine, '\\;');
      assertIncludes(summaryLine, '\\,');
      assertIncludes(locationLine, 'Clinique\\;A\\,B\\\\C\\nLigne2');
      assertIncludes(locationLine, 'ATTENDEE:mailto:evil@test');

      // Google Calendar window.open check (zero external requests)
      const calls = await captureWindowOpen(page, async () => {
        await page.locator('#rappels-liste').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
        await confirmDialog(page, 'Ouvrir Google Agenda');
      });
      assertEqual(calls.length, 1);
      assertEqual(calls[0].target, '_blank');
      assertEqual(calls[0].features, 'noopener,noreferrer');
      assert(calls[0].url.startsWith('https://calendar.google.com/calendar/render?'));

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-SEC-05',
    feature: 'E2E-F13',
    title: 'Security Grid SEC-05: Lock #carnet bypass, 3-strike backoff, target=_blank rel, tel: guard & zero external requests',
    run: async ({ page, monitors, assertNoRuntimeErrors }) => {
      // 1. Check all target="_blank" links on À propos carry noopener and noreferrer
      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'À propos d’Omni-Animalia', exact: true }).click();
      await page.locator('.vue[data-vue="apropos"]:not([hidden])').waitFor({ state: 'visible' });
      const blankLinks = await page.evaluate(() =>
        [...document.querySelectorAll('a[target="_blank"]')].map((a) => ({
          href: a.getAttribute('href'),
          rel: (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean),
        }))
      );
      assert(blankLinks.length >= 2, 'Expected >= 2 target=_blank links in À propos');
      for (const link of blankLinks) {
        assert(link.rel.includes('noopener'), `Link ${link.href} missing rel=noopener`);
        assert(link.rel.includes('noreferrer'), `Link ${link.href} missing rel=noreferrer`);
      }

      // 2. tel: scheme guard for unsafe imported vet phones vs valid phone
      const crafted = {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        donnees: {
          veterinaires: [
            { id: 'v-js', nom: 'Dr Script', telephone: 'javascript:alert(1)' },
            { id: 'v-dash', nom: 'Dr Dash', telephone: '---' },
            { id: 'v-ok', nom: 'Dr Valid', telephone: '01 23 45 67 89' },
          ],
          animaux: [
            { id: 'a-dash', nom: 'PetDash', espece: 'Chat', vetoId: 'v-dash' },
            { id: 'a-ok', nom: 'PetValid', espece: 'Chien', vetoId: 'v-ok' },
          ],
        },
      };
      await restoreBackup(page, 'tel-guard.json', crafted, 'remplacer');

      await goTab(page, 'veterinaires');
      const telHrefs = await page.evaluate(() =>
        [...document.querySelectorAll('#vetos-liste a[href]')].map((a) => a.getAttribute('href'))
      );
      assertEqual(telHrefs.filter((h) => h.startsWith('javascript:')).length, 0, 'No javascript: href allowed');
      assert(telHrefs.includes('tel:0123456789'), 'Valid phone renders tel:0123456789');
      assert(telHrefs.every((h) => /^tel:[0-9+]+$/.test(h)), 'All links strictly tel:[0-9+]+');

      await openPet(page, 'PetDash', 'identite');
      assertEqual(await page.locator('#animal-contenu a[href^="tel:"]').count(), 0, 'Non-digit vet phone renders plain span on Identité');

      // 3. #carnet cleared on afterprint and on lock; 3-strike lock backoff; popstate blocked while locked
      await openPet(page, 'PetValid', 'identite');
      await probePrintView(
        page,
        () => page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click(),
        { carnetChildSelector: '.carnet-entete' }
      );

      await activatePassword(page, 'SecLock99');
      await openPet(page, 'PetValid', 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();
      await page.locator('#carnet .carnet-entete').waitFor({ state: 'attached' });
      await triggerBackgroundRelock(page, 305000);
      assertEqual(await page.locator('#carnet').evaluate((el) => el.children.length), 0, '#carnet cleared on relock');

      // 3 failed attempts trigger rate-limit cooldown on the 4th submit
      for (let i = 0; i < 3; i++) {
        await page.locator('#verrou-mdp').fill(`WrongPass${i}`);
        await page.locator('#verrou-form button[type="submit"]').click();
        await page.waitForFunction(() => {
          const inp = document.querySelector('#verrou-mdp');
          const err = document.querySelector('#verrou-erreur');
          return err && !err.hidden && inp && inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
        });
        assertIncludes(await page.locator('#verrou-erreur').textContent(), 'Mot de passe incorrect');
      }
      await page.locator('#verrou-mdp').fill('WrongPass3');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#verrou-erreur').filter({ hasText: 'Trop d’essais incorrects.' }).waitFor({ state: 'visible' });

      // Wait out 1s initial cooldown, then unlock cleanly
      await page.waitForTimeout(1100);
      await unlockApp(page, 'SecLock99');

      assertEqual(monitors.externalRequests.length, 0, 'Zero external network requests during normal usage');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     3. Automated PWA Compliance Programmatic Audit (PWA-01..PWA-02)
     ========================================================================= */
  {
    id: 'E2E-T4-PWA-01',
    feature: 'E2E-F14',
    title: 'PWA Audit PWA-01: Manifest schema, icon HTTP 200/bytes, sw.js FICHIERS cross-check, Cache Storage & fonts',
    run: async ({ page, baseUrl, assertNoRuntimeErrors }) => {
      // 1. Verify <head> PWA tags
      const headAudit = await page.evaluate(() => ({
        manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
        iconHref: document.querySelector('link[rel="icon"]')?.getAttribute('href'),
        appleIconHref: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
        themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
        mobileCapable: document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute('content'),
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
        scriptSrcs: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
        linkHrefs: [...document.querySelectorAll('link[href]')].map((l) => l.getAttribute('href')),
      }));
      assertEqual(headAudit.manifestHref, './manifest.json');
      assertEqual(headAudit.iconHref, './icon-192.png');
      assertEqual(headAudit.appleIconHref, './icon-192.png');
      assertTruthy(headAudit.themeColor, 'theme-color present');
      assertEqual(headAudit.mobileCapable, 'yes');
      assertIncludes(headAudit.viewport, 'width=device-width');

      // 2. Fetch & validate manifest.json
      const manifestRes = await page.request.get(`${baseUrl}manifest.json`);
      assertEqual(manifestRes.status(), 200);
      const manifest = await manifestRes.json();
      assertTruthy(manifest.name && manifest.short_name);
      assertEqual(manifest.start_url, './index.html');
      assertEqual(manifest.scope, './');
      assertEqual(manifest.display, 'standalone');
      assertEqual(manifest.theme_color, '#14111d');
      assertEqual(manifest.background_color, '#14111d');

      const icons = manifest.icons || [];
      assert(icons.some((i) => i.sizes === '192x192' && i.purpose === 'any'), '192x192 any icon');
      assert(icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'), '512x512 any icon');
      assert(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'), '512x512 maskable icon');
      assert(icons.some((i) => i.type === 'image/svg+xml' && i.sizes === 'any'), 'SVG icon');
      assertEqual(manifest.shortcuts?.[0]?.url, './index.html#rappels');

      for (const icon of icons) {
        const iconUrl = new URL(icon.src, baseUrl).href;
        const res = await page.request.get(iconUrl);
        assertEqual(res.status(), 200, `Icon HTTP 200: ${icon.src}`);
        const buf = await res.body();
        assert(buf.length > 100, `Icon non-empty: ${icon.src}`);
        if (icon.type === 'image/png') {
          assertEqual(buf.slice(0, 4).toString('hex'), '89504e47', `Valid PNG header: ${icon.src}`);
        } else if (icon.type === 'image/svg+xml') {
          assertIncludes(buf.toString('utf8'), '<svg', `Valid SVG: ${icon.src}`);
        }
      }

      // 3. Parse sw.js CACHE, PREFIXE & FICHIERS and cross-check all local assets
      const swText = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');
      const cacheMatch = swText.match(/const\s+CACHE\s*=\s*'([^']+)'/);
      const prefixMatch = swText.match(/const\s+PREFIXE\s*=\s*'([^']+)'/);
      const fichiersMatch = swText.match(/const\s+FICHIERS\s*=\s*\[([\s\S]*?)\];/);
      assertTruthy(cacheMatch, 'CACHE constant found in sw.js');
      assertMatch(cacheMatch[1], /^omni-animalia-v\d+$/);
      assertEqual(prefixMatch?.[1], 'omni-animalia-');
      assertTruthy(fichiersMatch, 'FICHIERS array found in sw.js');

      const swFiles = [...fichiersMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      assert(swFiles.length >= 25, `Expected >= 25 precached files, got ${swFiles.length}`);

      const cssText = fs.readFileSync(path.join(REPO_ROOT, 'styles.css'), 'utf8');
      const fontUrls = [...cssText.matchAll(/url\(["']?(\.\/[^"')]+\.woff2)["']?\)/g)].map((m) => m[1]);
      assertEqual(fontUrls.length, 3, 'Three local @font-face woff2 files');

      const shortcutIcons = (manifest.shortcuts || []).flatMap((s) => (s.icons || []).map((i) => i.src));
      const requiredAssets = new Set([
        './',
        './index.html',
        ...headAudit.scriptSrcs,
        ...headAudit.linkHrefs,
        ...fontUrls,
        ...icons.map((i) => i.src),
        ...shortcutIcons,
      ]);
      for (const asset of requiredAssets) {
        assert(swFiles.includes(asset), `sw.js FICHIERS missing asset: ${asset}`);
      }

      // Every FICHIERS asset returns HTTP 200 online
      for (const f of swFiles) {
        const res = await page.request.get(new URL(f, baseUrl).href);
        assertEqual(res.status(), 200, `sw.js FICHIERS asset must return 200: ${f}`);
      }

      // 4. Verify Cache Storage contains 100% of FICHIERS and fonts are loaded
      await ensureSwControlled(page);
      const cachedPaths = await getCachedPaths(page);
      const basePath = new URL(baseUrl).pathname;
      for (const f of swFiles) {
        const expectedPath = f === './' ? basePath : `${basePath}${f.replace(/^\.\//, '')}`;
        assert(cachedPaths.includes(expectedPath), `Cache Storage missing precached path: ${expectedPath}`);
      }

      const fontAudit = await page.evaluate(async () => {
        await Promise.all([
          document.fonts.load('16px "Oxanium"'),
          document.fonts.load('16px "Literata"'),
          document.fonts.load('16px "JetBrains Mono"'),
        ]);
        await document.fonts.ready;
        return {
          oxanium: document.fonts.check('16px "Oxanium"'),
          literata: document.fonts.check('16px "Literata"'),
          jetbrains: document.fonts.check('16px "JetBrains Mono"'),
        };
      });
      assertEqual(fontAudit.oxanium, true, 'Oxanium font loaded');
      assertEqual(fontAudit.literata, true, 'Literata font loaded');
      assertEqual(fontAudit.jetbrains, true, 'JetBrains Mono font loaded');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-PWA-02',
    feature: 'E2E-F15',
    title: 'PWA Audit PWA-02: Full offline SW-target isolation across all routes, manifest shortcut & IndexedDB persistence',
    run: async ({ browser, context, page, baseUrl, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);

      // Seed baseline pet & vet online
      await createVet(page, { nom: 'Dr Cache', clinique: 'Clinique Offline', telephone: '01 23 45 67 89' });
      await createPet(page, { nom: 'CachePet', espece: 'Chat', vetoLabel: 'Dr Cache (Clinique Offline)' });
      await openPet(page, 'CachePet', 'identite');
      const petHash = await page.evaluate(() => location.hash);
      const petId = petHash.split('/')[1];

      await setOfflineWithSw(browser, context, page, true);
      try {
        await reloadApp(page);
        const swControlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
        assertEqual(swControlled, true, 'SW controller active offline');

        // Navigate across all main routes + manifest shortcut URL
        const routes = [
          `${baseUrl}#accueil`,
          `${baseUrl}#archives`,
          `${baseUrl}#animal/${petId}/identite`,
          `${baseUrl}#animal/${petId}/poids`,
          `${baseUrl}#garde/${petId}`,
          `${baseUrl}index.html#rappels`,
          `${baseUrl}#veterinaires`,
          `${baseUrl}#reglages`,
          `${baseUrl}#apropos`,
        ];
        for (const url of routes) {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await waitForReady(page);
        }

        // Unknown subpath fallback to app shell offline
        await page.goto(`${baseUrl}sous-chemin-pwa-inconnu`, { waitUntil: 'domcontentloaded' });
        await waitForReady(page);
        await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

        // Offline IndexedDB writes & theme change
        await createPet(page, { nom: 'OfflineNew', espece: 'Lapin' });
        await openPet(page, 'OfflineNew', 'poids');
        await addWeighIn(page, { date: isoDateOffset(0), valeur: '1.5' });
        await openAnimalSection(page, 'vaccins');
        await addVaccine(page, { nom: 'Myxomatose', date: isoDateOffset(-1), rappel: isoDateOffset(180) });
        await openAnimalSection(page, 'notes');
        await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Note hors ligne' });
        await openAnimalSection(page, 'taches');
        await addTask(page, { titre: 'Nettoyer clapier', echeance: isoDateOffset(0), repete: 'non' });
        await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
        await page.locator('#animal-contenu').filter({ hasText: 'Faites (1)' }).waitFor({ state: 'visible' });

        await goTab(page, 'reglages');
        await page.locator('#reglage-theme-1').check();
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'sombre');

        // Reload offline again and verify persistence
        await reloadApp(page);
        assertEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'sombre');
        await goTab(page, 'accueil');
        const homeText = await page.locator('#accueil-liste').textContent();
        assertIncludes(homeText, 'CachePet');
        assertIncludes(homeText, 'OfflineNew');

        await openPet(page, 'OfflineNew', 'poids');
        assertIncludes(await page.locator('#animal-contenu').textContent(), '1,5 kg');
        await openAnimalSection(page, 'notes');
        assertIncludes(await page.locator('#animal-contenu').textContent(), 'Note hors ligne');
        await openAnimalSection(page, 'taches');
        assertIncludes(await page.locator('#animal-contenu').textContent(), 'Faites (1)');
      } finally {
        await setOfflineWithSw(browser, context, page, false);
      }

      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 4,
  name: 'Tier 4 — Real-World Scenarios, Security Grid & PWA Audit',
  tests,
};
