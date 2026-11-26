/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 3 — Cross-Feature Pairwise Combinations
   (18 opaque-box pairwise tests covering all 15 features E2E-F1..E2E-F15) */
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
  loadDemoData,
  createPet,
  submitForm,
  confirmDialog,
  triggerBackupDownload,
  captureDownload,
  isoDateOffset,
  frDate,
  ensureSwControlled,
  setOfflineWithSw,
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

const tests = [
  {
    id: 'E2E-F1-F12-T3-01',
    feature: 'E2E-F1',
    title: 'Demo data + user edits & linked records + supprimerExemple cleans demo subtree while preserving user data',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);

      // Edit demo pet Biscuit (notes + user-added weigh-in on demo pet)
      await openPet(page, 'Biscuit (exemple)');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’identité', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-notes').fill('Note ajoutée sur exemple');
      await submitAnimalForm(page, 'Identité');
      await openAnimalSection(page, 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '29.5', note: 'Pesée utilisateur' });

      // Create user vet and two user pets (one linked to Dr Exemple, one with vaccine)
      await createVet(page, { nom: 'Dr Réel', clinique: 'Clinique Réelle', telephone: '01 11 22 33 44' });
      await createPet(page, { nom: 'Luna', espece: 'Chat', vetoLabel: 'Dr Réel (Clinique Réelle)' });
      await openPet(page, 'Luna', 'vaccins');
      await addVaccine(page, { nom: 'Typhus', date: isoDateOffset(-30), rappel: isoDateOffset(335), veterinaire: 'Dr Réel' });

      await createPet(page, { nom: 'Rex', espece: 'Chien', vetoLabel: 'Dr Exemple (Clinique vétérinaire des Tilleuls (fictive))' });

      // Delete demo data via Settings
      await goTab(page, 'reglages');
      await page.locator('#bouton-exemple').click();
      await confirmDialog(page, 'Supprimer l’exemple');
      await page.locator('#bouton-exemple', { hasText: 'Charger un exemple' }).waitFor({ state: 'visible' });

      // Verify demo pets and demo vet removed, user pets and user vet preserved
      await goTab(page, 'accueil');
      const homeText = await page.locator('#accueil-liste').textContent();
      assert(!homeText.includes('Biscuit'), 'Biscuit (exemple) must be removed');
      assert(!homeText.includes('Moka'), 'Moka (exemple) must be removed');
      assertIncludes(homeText, 'Luna');
      assertIncludes(homeText, 'Rex');

      await goTab(page, 'veterinaires');
      const vetText = await page.locator('#vetos-liste').textContent();
      assert(!vetText.includes('Dr Exemple'), 'Dr Exemple must be removed');
      assertIncludes(vetText, 'Dr Réel');

      // Rex must have Dr Exemple unlinked
      await openPet(page, 'Rex');
      const rexIdentity = await page.locator('#animal-contenu').textContent();
      assert(!rexIdentity.includes('Dr Exemple'), 'Rex must unlink deleted demo vet');

      // Backup must contain zero orphan records from Biscuit's user weigh-in
      const backup = await triggerBackupDownload(page);
      assertEqual(backup.data.donnees.animaux.length, 2, 'Only user animals remain');
      assertEqual(backup.data.donnees.veterinaires.length, 1, 'Only user vet remains');
      assertEqual(backup.data.donnees.pesees.length, 0, 'Demo pet weigh-in cascade deleted');
      assertEqual(backup.data.donnees.vaccins.length, 1, 'User pet vaccine preserved');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-F8-F10-T3-02',
    feature: 'E2E-F8',
    title: 'Treatment + prisesParJour + Rappels dose logging sync + Garde active & future treatments',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Milo', espece: 'Chien' });
      await openPet(page, 'Milo', 'traitements');

      const today = isoDateOffset(0);
      const plus3 = isoDateOffset(3);
      const plus4 = isoDateOffset(4);
      const plus10 = isoDateOffset(10);

      await addTreatment(page, {
        nom: 'Amoxicilline',
        dose: '1 comprimé',
        frequence: 'matin et soir',
        prisesParJour: 2,
        debut: today,
        fin: plus3,
      });
      await addTreatment(page, {
        nom: 'CureDemain',
        dose: '5 ml',
        frequence: 'matin',
        prisesParJour: 1,
        debut: plus4,
        fin: plus10,
      });

      // On Rappels, only active treatment appears in Médicaments du jour
      await goTab(page, 'rappels');
      const medSection = page.locator('#rappels-liste section.medicaments');
      await medSection.waitFor({ state: 'visible' });
      const medTextBefore = await medSection.textContent();
      assertIncludes(medTextBefore, 'Médicaments du jour (1)');
      assertIncludes(medTextBefore, 'Amoxicilline');
      assert(!medTextBefore.includes('CureDemain'), 'Future treatment must not appear in Médicaments du jour');

      // Log 1 dose directly from Rappels
      await medSection.getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await medSection.filter({ hasText: '1 prise sur 2' }).waitFor({ state: 'visible' });

      // Sync check back on Milo -> Traitements
      await openPet(page, 'Milo', 'traitements');
      assertIncludes(await page.locator('#animal-contenu').textContent(), '1 prise sur 2');

      // Care sheet lists Amoxicilline active first, then CureDemain with À venir
      await openAnimalSection(page, 'identite');
      await openGarde(page);
      const gardeMeds = page.locator('#garde-contenu .garde-medicament');
      assertEqual(await gardeMeds.count(), 2, 'Both active and future treatments appear on Garde');
      assertIncludes(await gardeMeds.nth(0).textContent(), 'Amoxicilline');
      const secondMedText = await gardeMeds.nth(1).textContent();
      assertIncludes(secondMedText, 'CureDemain');
      assertIncludes(secondMedText, `À venir (à partir du ${frDate(plus4)})`);

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-F11-T3-03',
    feature: 'E2E-F6',
    title: 'Appointment + Vet directory + Google Calendar noopener,noreferrer + bulk .ics + Vet delete cascade',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, {
        nom: 'Dr Martin',
        clinique: 'Clinique Lilas',
        telephone: '01 40 50 60 70',
        adresse: '5 rue Paix',
      });
      await createPet(page, { nom: 'Oscar', espece: 'Chat', vetoLabel: 'Dr Martin (Clinique Lilas)' });
      await openPet(page, 'Oscar', 'rdv');

      // Verify vet name prefilled on new appointment form
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-veterinaire').inputValue(), 'Dr Martin', 'Habitual vet prefilled');

      await page.locator('#champ-date').fill(isoDateOffset(4));
      await page.locator('#champ-heure').fill('15:00');
      await page.locator('#champ-motif').fill('Vaccin annuel');
      await page.locator('#champ-cout').fill('60');
      await submitAnimalForm(page, 'Rendez-vous vétérinaires');

      // Intercept window.open for Google Calendar
      const openCalls = await captureWindowOpen(page, async () => {
        await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
        await confirmDialog(page, 'Ouvrir Google Agenda');
      });
      assertEqual(openCalls.length, 1, 'Google Calendar should call window.open once');
      assertEqual(openCalls[0].target, '_blank');
      assertEqual(openCalls[0].features, 'noopener,noreferrer');
      assert(openCalls[0].url.startsWith('https://calendar.google.com/calendar/render?'), 'Google Calendar base URL');
      const gParams = new URL(openCalls[0].url).searchParams;
      assertEqual(gParams.get('location'), 'Clinique Lilas, 5 rue Paix');

      // Bulk .ics export on Rappels
      await goTab(page, 'rappels');
      await page.locator('#agenda-tout summary').click();
      const ics = await captureDownload(page, () => page.locator('#bouton-agenda-tout').click());
      const unfolded = unfoldIcs(ics.content);
      assertIncludes(unfolded, 'LOCATION:Clinique Lilas\\, 5 rue Paix');

      // Delete Dr Martin and verify cascade
      await goTab(page, 'veterinaires');
      await page.locator('#vetos-liste .carte-fiche').getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#vetos-liste', { hasText: 'Aucun vétérinaire enregistré.' }).waitFor({ state: 'visible' });

      await openPet(page, 'Oscar', 'identite');
      assert(!((await page.locator('#animal-contenu').textContent()).includes('Vétérinaire habituel')), 'Identité unlinked');
      await openAnimalSection(page, 'rdv');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Dr Martin');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-F15-F14-T3-04',
    feature: 'E2E-F13',
    title: 'Password lock + Print #carnet clearing + visibilitychange relock + popstate guard while locked',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Puce', espece: 'Chien' });
      await openPet(page, 'Puce', 'vaccins');
      await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-10), rappel: isoDateOffset(355) });

      await activatePassword(page, 'PassPair3');
      await openPet(page, 'Puce', 'identite');
      const savedHash = await page.evaluate(() => location.hash);

      // Populate #carnet without firing afterprint yet
      await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();
      await page.locator('#carnet .carnet-entete').waitFor({ state: 'attached' });
      assert((await page.locator('#carnet').evaluate((el) => el.children.length)) > 0, '#carnet populated before lock');

      // Background visibilitychange relock must clear #carnet and hide #principal
      await triggerBackgroundRelock(page, 305000);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), false);
      assertEqual(await page.locator('#principal').evaluate((el) => el.hidden), true);
      assertEqual(await page.locator('#carnet').evaluate((el) => el.children.length), 0, '#carnet cleared on lock');

      // Hash / popstate change while locked must not bypass lock screen
      await page.evaluate(() => {
        window.location.hash = '#reglages';
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForTimeout(50);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), false, 'Lock remains active after popstate');
      assertEqual(await page.locator('#principal').evaluate((el) => el.hidden), true, 'Main stays hidden while locked');

      // Unlock restores prior pet view cleanly
      await unlockApp(page, 'PassPair3');
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-titre').textContent(), 'Puce');
      assertMatch(savedHash, /^#animal\//);

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-F9-F14-T3-05',
    feature: 'E2E-F12',
    title: 'Backup replace & merge + filtreNotes reset on replace + theme/text-size persistence',
    run: async ({ page, assertNoRuntimeErrors }) => {
      // Configure clair + tresgrand and build backupB with PetB
      await goTab(page, 'reglages');
      await page.locator('#reglage-theme-2').check();
      await page.locator('#reglage-taille-2').check();
      await page.waitForFunction(() =>
        document.documentElement.dataset.theme === 'clair' && document.documentElement.dataset.taille === 'tresgrand'
      );

      await createPet(page, { nom: 'PetB', espece: 'Chat' });
      await openPet(page, 'PetB', 'notes');
      await addNote(page, { date: isoDateOffset(-2), categorie: 'observation', texte: 'Note B1' });
      await addNote(page, { date: isoDateOffset(0), categorie: 'examen', texte: 'Note B2' });
      const backupB = await triggerBackupDownload(page);

      // Reset, configure sombre + grand, build PetA with active note filter
      await wipeAllData(page);
      await page.locator('#reglage-theme-1').check();
      await page.locator('#reglage-taille-1').check();
      await page.waitForFunction(() =>
        document.documentElement.dataset.theme === 'sombre' && document.documentElement.dataset.taille === 'grand'
      );

      await createPet(page, { nom: 'PetA', espece: 'Chien' });
      await openPet(page, 'PetA', 'notes');
      await addNote(page, { date: isoDateOffset(-1), categorie: 'symptome', texte: 'Note A1' });
      await addNote(page, { date: isoDateOffset(0), categorie: 'examen', texte: 'Note A2' });
      const backupA = await triggerBackupDownload(page);

      await openPet(page, 'PetA', 'notes');
      await page.locator('details.filtre summary').click();
      await page.locator('#filtre-categorie').selectOption('symptome');
      await page.locator('details.filtre').getByRole('button', { name: 'Appliquer le filtre', exact: true }).click();
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^1 note\(s\) sur 2 \(filtre actif\)\.$/ })
        .waitFor({ state: 'visible' });

      // Replace with backupB: theme/size must switch to clair/tresgrand and filtreNotes must reset
      await restoreBackup(page, backupB.filename, backupB.raw, 'remplacer');
      await page.waitForFunction(() =>
        document.documentElement.dataset.theme === 'clair' && document.documentElement.dataset.taille === 'tresgrand'
      );
      await reloadApp(page);
      assertEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'clair');
      assertEqual(await page.evaluate(() => document.documentElement.dataset.taille), 'tresgrand');

      await openPet(page, 'PetB', 'notes');
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^2 note\(s\)\.$/ })
        .waitFor({ state: 'visible' });

      // Merge backupA: both PetA and PetB coexist with all notes intact
      await restoreBackup(page, backupA.filename, backupA.raw, 'fusionner');
      await goTab(page, 'accueil');
      const homeText = await page.locator('#accueil-liste').textContent();
      assertIncludes(homeText, 'PetA');
      assertIncludes(homeText, 'PetB');

      await openPet(page, 'PetA', 'notes');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Note A1');
      await openPet(page, 'PetB', 'notes');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Note B1');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-F1-F8-T3-06',
    feature: 'E2E-F2',
    title: 'Weigh-ins + SVG chart + unit change (g -> kg) + archive/unarchive read-only & badge sync',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Kiwi', espece: 'Lapin', unitePoids: 'g' });
      await openPet(page, 'Kiwi', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-10), valeur: '450' });
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '520' });

      assertEqual(await page.locator('#animal-contenu svg.graphique circle.point').count(), 2);
      assertIncludes(await page.locator('#animal-contenu .chiffre-cle').textContent(), '520 g');

      // Overdue task -> badge = 1
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Tâche en retard', echeance: isoDateOffset(-1), repete: 'non' });
      await page.locator('#nav-pastille:not([hidden])').filter({ hasText: '1' }).waitFor({ state: 'visible' });

      // Change unit to kg on Identité
      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’identité', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="unitePoids"] input[type="radio"][value="kg"]').check();
      await submitAnimalForm(page, 'Identité');

      await openAnimalSection(page, 'poids');
      assertIncludes(await page.locator('#animal-contenu .chiffre-cle').textContent(), '0,52 kg');
      assertIncludes(await page.locator('#animal-contenu figure.figure-graphique figcaption').textContent(), '(kg)');

      // Archive Kiwi -> badge hides and poids becomes read-only
      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[type="radio"][value="confié"]').check();
      await submitAnimalForm(page, 'Identité');

      await page.waitForFunction(() => document.querySelector('#nav-pastille').hidden === true);
      await goTab(page, 'accueil');
      await openArchives(page);
      await openAnimalFromView(page, page.locator('#archives-liste .carte-archive').getByRole('button', { name: 'Consulter', exact: true }));
      await openAnimalSection(page, 'poids');
      assertEqual(await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).count(), 0);
      assertEqual(await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier', exact: true }).count(), 0);

      // Restore Kiwi -> badge returns and edit buttons return
      await page.locator('#animal-resume').getByRole('button', { name: 'Restaurer dans la liste', exact: true }).click();
      await confirmDialog(page, 'Restaurer');
      await page.locator('#nav-pastille:not([hidden])').filter({ hasText: '1' }).waitFor({ state: 'visible' });
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).waitFor({ state: 'visible' });

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-F8-F6-T3-07',
    feature: 'E2E-F7',
    title: 'Recurring task completion on Rappels + upcoming appointment + bulk .ics VEVENT formatting',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Boby', espece: 'Chien' });
      await openPet(page, 'Boby', 'taches');
      const today = isoDateOffset(0);
      const plus2 = isoDateOffset(2);
      const plus7 = isoDateOffset(7);

      await addTask(page, {
        titre: 'Couper griffes',
        echeance: today,
        repete: 'oui',
        recN: 1,
        recUnite: 'semaines',
      });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: plus2, heure: '09:30', motif: 'Contrôle', cout: 45 });

      await goTab(page, 'rappels');
      await page.locator('#nav-pastille:not([hidden])').filter({ hasText: '1' }).waitFor({ state: 'visible' });
      await page.locator('#rappels-aujourdhui').filter({ hasText: 'Aujourd’hui (1)' }).waitFor({ state: 'visible' });

      // Complete task directly on Rappels
      await page.locator('section.groupe-rappels').filter({ has: page.locator('#rappels-aujourdhui') })
        .getByRole('button', { name: 'Marquer comme fait', exact: true }).click();

      await page.locator('#rappels-aujourdhui').filter({ hasText: 'Aujourd’hui (0)' }).waitFor({ state: 'visible' });
      await page.locator('#rappels-semaine').filter({ hasText: 'Dans les 7 jours (2)' }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('#nav-pastille').hidden === true);

      // Export bulk .ics -> both appointment (timed) and regenerated +7d task (all-day) present
      await page.locator('#agenda-tout summary').click();
      const ics = await captureDownload(page, () => page.locator('#bouton-agenda-tout').click());
      const unfolded = unfoldIcs(ics.content);
      assertEqual((unfolded.match(/BEGIN:VEVENT/g) || []).length, 2, 'Two upcoming VEVENTs');
      assertIncludes(unfolded, `DTSTART:${plus2.replace(/-/g, '')}T093000`);
      assertIncludes(unfolded, `DTEND:${plus2.replace(/-/g, '')}T103000`);
      assertIncludes(unfolded, `DTSTART;VALUE=DATE:${plus7.replace(/-/g, '')}`);

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-F10-F12-T3-08',
    feature: 'E2E-F9',
    title: 'Allergy note + document attachment + Alimentation + Garde care sheet + Backup roundtrip',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Léo', espece: 'Chat' });
      await openPet(page, 'Léo', 'alimentation');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-alimMarque').fill('Croquettes saumon');
      await page.locator('#champ-alimEviter').fill('Raisins');
      await submitAnimalForm(page, 'Alimentation');

      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'allergie', texte: 'Allergie acariens', withDocument: true });

      const notesBanner = await page.locator('#animal-contenu .encart.attention').textContent();
      assertIncludes(notesBanner, 'Allergie acariens');
      assertIncludes(notesBanner, 'Aliments à éviter : Raisins');

      await openAnimalSection(page, 'identite');
      await openGarde(page);
      const gardeTextBefore = await page.locator('#garde-contenu').textContent();
      assertIncludes(gardeTextBefore, 'Raisins');
      assertIncludes(gardeTextBefore, 'Allergie acariens');

      // Export, wipe, restore, reload
      const backup = await triggerBackupDownload(page);
      await wipeAllData(page);
      await restoreBackup(page, backup.filename, backup.raw, 'remplacer');
      await reloadApp(page);

      await openPet(page, 'Léo', 'notes');
      await page.locator('#animal-contenu button.vignette-document').first().click();
      const viewer = page.locator('dialog#visionneuse[open]');
      await viewer.waitFor({ state: 'visible' });
      const src = await viewer.locator('img.image-visionneuse').getAttribute('src');
      assertMatch(src, /^data:image\/jpeg;base64,/);
      await viewer.getByRole('button', { name: 'Fermer', exact: true }).click();
      await page.locator('dialog#visionneuse:not([open])').waitFor({ state: 'attached' });

      await openAnimalSection(page, 'identite');
      await openGarde(page);
      const gardeTextAfter = await page.locator('#garde-contenu').textContent();
      assertIncludes(gardeTextAfter, 'Raisins');
      assertIncludes(gardeTextAfter, 'Allergie acariens');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-F6-F8-T3-09',
    feature: 'E2E-F3',
    title: 'Vaccine renewal + past appointment compteRendu + Rappels badge clearing',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Véto', clinique: 'Clinique Centre' });
      await createPet(page, { nom: 'Nala', espece: 'Chien', vetoLabel: 'Dr Véto (Clinique Centre)' });

      await openPet(page, 'Nala', 'vaccins');
      await addVaccine(page, { nom: 'CHPPiL', date: isoDateOffset(-365), rappel: isoDateOffset(-2), veterinaire: 'Dr Véto' });
      await page.locator('#nav-pastille:not([hidden])').filter({ hasText: '1' }).waitFor({ state: 'visible' });

      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(-2), motif: 'Rappel vaccin', cout: 50, compteRendu: 'Rappel fait' });
      assertMatch(await page.locator('#animal-contenu .encart.frais').textContent(), /50,00\s*€/);

      await openAnimalSection(page, 'vaccins');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-nom').inputValue(), 'CHPPiL');
      assertEqual(await page.locator('#champ-veterinaire').inputValue(), 'Dr Véto');
      await page.locator('#champ-rappel').fill(isoDateOffset(365));
      await submitAnimalForm(page, 'Vaccins');

      assertIncludes(await page.locator('#animal-contenu').textContent(), '(déjà renouvelé)');
      await page.waitForFunction(() => document.querySelector('#nav-pastille').hidden === true);

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-F8-F10-T3-10',
    feature: 'E2E-F4',
    title: 'Antiparasitic 30-day window across Rappels and Garde care sheet + renewal update',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Plume', espece: 'Chat' });
      await openPet(page, 'Plume', 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-60), prochaine: isoDateOffset(15) });
      await addAntiparasitic(page, { type: 'anti-puces', produit: 'Bravecto', date: isoDateOffset(-30), prochaine: isoDateOffset(45) });

      await goTab(page, 'rappels');
      const rappelsText = await page.locator('#rappels-liste').textContent();
      assertIncludes(rappelsText, 'Dans les 30 jours (1)');
      assertIncludes(rappelsText, 'Milbemax');
      assertIncludes(rappelsText, '1 autre(s) rappel(s) plus lointain(s)');

      await openPet(page, 'Plume', 'identite');
      await openGarde(page);
      const garde1 = await page.locator('#garde-contenu').textContent();
      assertIncludes(garde1, 'Prévu dans les 30 prochains jours');
      assertIncludes(garde1, 'Milbemax');
      assert(!garde1.includes('Bravecto'), '45-day antiparasitic must not appear in 30-day Garde section');

      // Renew Milbemax out to +90d -> 30-day Garde section disappears
      await openAnimalFromView(page, page.locator('.vue[data-vue="garde"] button.retour'));
      await openAnimalSection(page, 'antiparasitaires');
      const cardMilbemax = page.locator('#animal-contenu .carte-fiche').filter({ hasText: 'Milbemax' });
      await cardMilbemax.getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-prochaine').fill(isoDateOffset(90));
      await submitAnimalForm(page, 'Vermifuges et antiparasitaires');

      await openAnimalSection(page, 'identite');
      await openGarde(page);
      assert(!((await page.locator('#garde-contenu').textContent()).includes('Prévu dans les 30 prochains jours')));

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-F9-F15-T3-11',
    feature: 'E2E-F15',
    title: 'Pet photo + note attachment + full #carnet print booklet layout and afterprint cleanup',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Simba', espece: 'Chat', withPhoto: true, photoName: 'simba.png' });
      await openPet(page, 'Simba', 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '4.2' });
      await openAnimalSection(page, 'vaccins');
      await addVaccine(page, { nom: 'Coryza', date: isoDateOffset(-10), rappel: isoDateOffset(355) });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Drontal', date: isoDateOffset(-5), prochaine: isoDateOffset(85) });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Collyre', dose: '1 goutte', debut: isoDateOffset(0) });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(5), motif: 'Bilan' });
      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Note imprimée', withDocument: true });

      await openAnimalSection(page, 'identite');
      await probePrintView(
        page,
        () => page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click(),
        {
          carnetChildSelector: '.carnet-entete',
          expectedTitleContains: 'Carnet de santé - Simba',
          onPrint: async (p) => {
            const photoSrc = await p.locator('#carnet .carnet-photo').getAttribute('src');
            assertMatch(photoSrc, /^data:image\/jpeg;base64,/);
            assertEqual(await p.locator('#carnet section.carnet-section table').count(), 6, 'All 6 health tables populated');
            assertIncludes(await p.locator('#carnet').textContent(), '[1 document(s) joint(s) dans l’application]');
          },
        }
      );

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-F5-F15-T3-12',
    feature: 'E2E-F15',
    title: 'Full offline SW precache + weigh-in SVG chart + treatment dose logging + offline reload persistence',
    run: async ({ browser, context, page, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);

      await setOfflineWithSw(browser, context, page, true);
      try {
        await createPet(page, { nom: 'OfflineMax', espece: 'Chien' });
        await openPet(page, 'OfflineMax', 'poids');
        await addWeighIn(page, { date: isoDateOffset(-3), valeur: '10' });
        await addWeighIn(page, { date: isoDateOffset(0), valeur: '11.2' });
        await page.locator('#animal-contenu svg.graphique polyline.courbe').waitFor({ state: 'visible' });

        await openAnimalSection(page, 'traitements');
        await addTreatment(page, { nom: 'Gouttes', prisesParJour: 2, debut: isoDateOffset(0) });
        await page.locator('#animal-contenu').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
        await page.locator('#animal-contenu').filter({ hasText: '1 prise sur 2' }).waitFor({ state: 'visible' });

        await reloadApp(page);
        await openPet(page, 'OfflineMax', 'poids');
        await page.locator('#animal-contenu svg.graphique polyline.courbe').waitFor({ state: 'visible' });
        await openAnimalSection(page, 'traitements');
        assertIncludes(await page.locator('#animal-contenu').textContent(), '1 prise sur 2');
      } finally {
        await setOfflineWithSw(browser, context, page, false);
      }

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-F4-F11-T3-13',
    feature: 'E2E-F11',
    title: 'Vet directory edit propagates dynamically to Identité while preserving historical vaccine vet string',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Alpha', clinique: 'Clinique A', telephone: '01 22 33 44 55' });
      await createPet(page, { nom: 'Roxy', espece: 'Chat', vetoLabel: 'Dr Alpha (Clinique A)' });

      await openPet(page, 'Roxy', 'vaccins');
      await addVaccine(page, { nom: 'Typhus', date: isoDateOffset(-5), rappel: isoDateOffset(360), veterinaire: 'Dr Alpha' });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Frontline', date: isoDateOffset(-2), prochaine: isoDateOffset(88) });

      await goTab(page, 'veterinaires');
      await page.locator('#vetos-liste .carte-fiche').getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-clinique').fill('Clinique Z');
      await submitForm(page);
      await page.locator('#vetos-liste').filter({ hasText: 'Clinique Z' }).waitFor({ state: 'visible' });

      await openPet(page, 'Roxy', 'identite');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Dr Alpha — Clinique Z');
      await openAnimalSection(page, 'vaccins');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Dr Alpha');
      await openAnimalSection(page, 'antiparasitaires');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Frontline');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-F7-F13-T3-14',
    feature: 'E2E-F5',
    title: 'Password lock + treatment dose & recurring task completion persist across reload & unlock',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'LockPet', espece: 'Chien' });
      await openPet(page, 'LockPet', 'traitements');
      await addTreatment(page, { nom: 'Sirop', prisesParJour: 1, debut: isoDateOffset(0) });
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Brossage', echeance: isoDateOffset(0), repete: 'oui', recN: 1, recUnite: 'jours' });

      await activatePassword(page, 'Key5713');

      await openPet(page, 'LockPet', 'traitements');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: '1 prise sur 1' }).waitFor({ state: 'visible' });

      await openAnimalSection(page, 'taches');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: 'Faites (1)' }).waitFor({ state: 'visible' });

      await reloadApp(page);
      await unlockApp(page, 'Key5713');

      await openPet(page, 'LockPet', 'traitements');
      assertIncludes(await page.locator('#animal-contenu').textContent(), '1 prise sur 1');
      await openAnimalSection(page, 'taches');
      const taskText = await page.locator('#animal-contenu').textContent();
      assertIncludes(taskText, 'À faire (1)');
      assertIncludes(taskText, 'Faites (1)');
      assertIncludes(taskText, frDate(isoDateOffset(1)));

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-F14-F15-T3-15',
    feature: 'E2E-F14',
    title: 'Abandoning unsaved pet edit via nav tab resets Formulaire & goBack does not reopen stale form + hash deep-link',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'RoutePet', espece: 'Chat' });
      await openPet(page, 'RoutePet', 'identite');
      const identHash = await page.evaluate(() => location.hash);

      await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’identité', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('RoutePetMOD');

      // Leave via bottom navigation without saving
      await goTab(page, 'reglages');
      await page.goBack();
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('.vue[data-vue="formulaire"]').evaluate((el) => el.hidden), true, 'Abandoned form must not reopen on history back');

      // Verify name remained unchanged and deep-link to poids section works
      const poidsHash = identHash.replace('/identite', '/poids');
      await page.evaluate((h) => {
        window.location.hash = h;
      }, poidsHash);
      await page.locator('#animal-contenu h2').filter({ hasText: 'Poids' }).waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-titre').textContent(), 'RoutePet');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-F10-F11-T3-16',
    feature: 'E2E-F10',
    title: 'Multi-pet shared owner contactGarde + vet tel: links + isolated per-pet appointment cost totals',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Tel', clinique: 'Vet24', telephone: '06 99 88 77 66' });
      await createPet(page, { nom: 'P1', espece: 'Chien', vetoLabel: 'Dr Tel (Vet24)' });
      await createPet(page, { nom: 'P2', espece: 'Chat' });

      await openPet(page, 'P1', 'rdv');
      await addAppointment(page, { date: isoDateOffset(-1), motif: 'Soin P1', cout: 55 });
      assertMatch(await page.locator('#animal-contenu .encart.frais').textContent(), /55,00\s*€/);
      await openAnimalSection(page, 'identite');
      await openGarde(page);
      await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/, exact: false }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Alex');
      await page.locator('#champ-telephone').fill('06 11 22 33 44');
      await submitGardeForm(page);
      await page.locator('#garde-contenu a[href="tel:0611223344"]').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu a[href="tel:0699887766"]').waitFor({ state: 'visible' });

      // P2 has its own isolated appointment cost and shares owner contact without P1's vet
      await openPet(page, 'P2', 'rdv');
      await addAppointment(page, { date: isoDateOffset(-1), motif: 'Soin P2', cout: 30 });
      const p2Frais = await page.locator('#animal-contenu .encart.frais').textContent();
      assertMatch(p2Frais, /30,00\s*€/);
      assert(!p2Frais.includes('55,00'), 'P1 cost must not bleed into P2');

      await openAnimalSection(page, 'identite');
      await openGarde(page);
      await page.locator('#garde-contenu a[href="tel:0611223344"]').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#garde-contenu a[href="tel:0699887766"]').count(), 0);

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-F9-F14-T3-17',
    feature: 'E2E-F9',
    title: 'Active note filter on PetA resets on switching to PetB while clair theme persists across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'PetA', espece: 'Chat' });
      await openPet(page, 'PetA', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'symptome', texte: 'Symptôme A' });

      await createPet(page, { nom: 'PetB', espece: 'Chien' });
      await openPet(page, 'PetB', 'taches');
      await addTask(page, { titre: 'Tâche B', echeance: isoDateOffset(1), repete: 'non' });
      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Observation B' });

      await openPet(page, 'PetA', 'notes');
      await page.locator('details.filtre summary').click();
      await page.locator('#filtre-categorie').selectOption('allergie');
      await page.locator('details.filtre').getByRole('button', { name: 'Appliquer le filtre', exact: true }).click();
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^0 note\(s\) sur 1 \(filtre actif\)\.$/ })
        .waitFor({ state: 'visible' });

      await goTab(page, 'reglages');
      await page.locator('#reglage-theme-2').check();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'clair');

      await openPet(page, 'PetB', 'taches');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Tâche B');
      await openAnimalSection(page, 'notes');
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^1 note\(s\)\.$/ })
        .waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Observation B');

      await reloadApp(page);
      assertEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'clair');

      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-F3-F4-T3-18',
    feature: 'E2E-F1',
    title: 'Permanent deletion of archived pet cascades cleanly across all 7 linked IndexedDB stores',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'CleanPet', espece: 'Chien' });
      await openPet(page, 'CleanPet', 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '12' });
      await openAnimalSection(page, 'vaccins');
      await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-5), rappel: isoDateOffset(360) });
      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-2), prochaine: isoDateOffset(88) });
      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Antibio', debut: isoDateOffset(0) });
      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: isoDateOffset(3), motif: 'Bilan' });
      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'RAS' });
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Tâche', echeance: isoDateOffset(2), repete: 'non' });

      const before = await triggerBackupDownload(page);
      assertEqual(before.data.donnees.animaux.length, 1);
      for (const store of ['pesees', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes', 'taches']) {
        assertEqual(before.data.donnees[store].length, 1, `Expected 1 record in ${store} before delete`);
      }

      // Archive and permanently delete CleanPet
      await openPet(page, 'CleanPet', 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[type="radio"][value="vendu"]').check();
      await submitAnimalForm(page, 'Identité');

      await goTab(page, 'accueil');
      await openArchives(page);
      await page.locator('#archives-liste .carte-archive').getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
      await confirmDialog(page, 'Continuer', { expectNextDialog: true });
      await confirmDialog(page, 'Supprimer définitivement');
      await page.locator('#archives-liste').filter({ hasText: 'Aucun animal archivé.' }).waitFor({ state: 'visible' });

      const after = await triggerBackupDownload(page);
      assertEqual(after.data.donnees.animaux.length, 0, 'animaux must be empty');
      for (const store of ['pesees', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes', 'taches']) {
        assertEqual(after.data.donnees[store].length, 0, `Expected 0 orphan records in ${store} after permanent delete`);
      }

      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 3,
  name: 'Tier 3 — Cross-Feature Pairwise Combinations',
  tests,
};
