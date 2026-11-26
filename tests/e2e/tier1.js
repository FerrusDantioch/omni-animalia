/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 1 — Category-Partition Feature Coverage (>= 75 happy-path tests across E2E-F1..E2E-F15) */
'use strict';

const {
  assert,
  assertEqual,
  assertIncludes,
  assertTruthy,
  assertMatch,
  openApp,
  reloadApp,
  goTab,
  openPet,
  openAnimalSection,
  openGarde,
  submitGardeForm,
  loadDemoData,
  createPet,
  submitForm,
  confirmDialog,
  uploadSamplePng,
  triggerBackupDownload,
  captureDownload,
  isoDateOffset,
  frDate,
} = require('./helpers');

/* Helper: add a vet via UI */
async function createVet(page, data) {
  await goTab(page, 'veterinaires');
  await page.locator('#vetos-actions').getByRole('button', { name: 'Ajouter un vétérinaire', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (data.nom !== undefined) await page.locator('#champ-nom').fill(data.nom);
  if (data.clinique !== undefined) await page.locator('#champ-clinique').fill(data.clinique);
  if (data.telephone !== undefined) await page.locator('#champ-telephone').fill(data.telephone);
  if (data.adresse !== undefined) await page.locator('#champ-adresse').fill(data.adresse);
  if (data.notes !== undefined) await page.locator('#champ-notes').fill(data.notes);
  await submitForm(page);
  await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: add weigh-in while on pet's Poids section */
async function addWeighIn(page, { date, valeur, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (valeur !== undefined) await page.locator('#champ-valeur').fill(String(valeur));
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitForm(page);
  await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: add vaccine while on pet's Vaccins section */
async function addVaccine(page, { nom, date, rappel, veterinaire, lot, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un vaccin', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (nom !== undefined) await page.locator('#champ-nom').fill(nom);
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (rappel !== undefined) await page.locator('#champ-rappel').fill(rappel);
  if (veterinaire !== undefined) await page.locator('#champ-veterinaire').fill(veterinaire);
  if (lot !== undefined) await page.locator('#champ-lot').fill(lot);
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitForm(page);
  await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: add antiparasitic while on pet's Antiparasitaires section */
async function addAntiparasitic(page, { type, produit, date, prochaine, dose, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une prise', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (type !== undefined) await page.locator(`[data-champ="type"] input[type="radio"][value="${type}"]`).check();
  if (produit !== undefined) await page.locator('#champ-produit').fill(produit);
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (prochaine !== undefined) await page.locator('#champ-prochaine').fill(prochaine);
  if (dose !== undefined) await page.locator('#champ-dose').fill(dose);
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitForm(page);
  await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: add treatment while on pet's Traitements section */
async function addTreatment(page, { nom, dose, frequence, prisesParJour, debut, fin, statut, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un traitement', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (nom !== undefined) await page.locator('#champ-nom').fill(nom);
  if (dose !== undefined) await page.locator('#champ-dose').fill(dose);
  if (frequence !== undefined) await page.locator('#champ-frequence').fill(frequence);
  if (prisesParJour !== undefined) await page.locator('#champ-prisesParJour').fill(String(prisesParJour));
  if (debut !== undefined) await page.locator('#champ-debut').fill(debut);
  if (fin !== undefined) await page.locator('#champ-fin').fill(fin);
  if (statut !== undefined) await page.locator(`[data-champ="statut"] input[type="radio"][value="${statut}"]`).check();
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitForm(page);
  await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: add appointment while on pet's Rendez-vous section */
async function addAppointment(page, { date, heure, motif, veterinaire, compteRendu, cout } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (heure !== undefined) await page.locator('#champ-heure').fill(heure);
  if (motif !== undefined) await page.locator('#champ-motif').fill(motif);
  if (veterinaire !== undefined) await page.locator('#champ-veterinaire').fill(veterinaire);
  if (compteRendu !== undefined) await page.locator('#champ-compteRendu').fill(compteRendu);
  if (cout !== undefined) await page.locator('#champ-cout').fill(String(cout));
  await submitForm(page);
  await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: add task while on pet's À faire section */
async function addTask(page, { titre, echeance, repete, recN, recUnite, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
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
  await submitForm(page);
  await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: add health note while on pet's Notes de santé section */
async function addNote(page, { date, categorie, texte, withDocument } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (categorie !== undefined) await page.locator('#champ-categorie').selectOption(categorie);
  if (texte !== undefined) await page.locator('#champ-texte').fill(texte);
  if (withDocument) {
    const fileInput = page.locator('[data-champ="pieces"] input[type="file"]:not([capture])');
    await uploadSamplePng(page, fileInput, 'ordonnance.png', '[data-champ="pieces"] .aide', 'Document ajouté');
  }
  await submitForm(page);
  await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
}

/* Helper: set password lock from Réglages */
async function activatePassword(page, password) {
  await goTab(page, 'reglages');
  await page.locator('#reglages-contenu').getByRole('button', { name: 'Activer un mot de passe', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  await page.locator('#champ-nouveau').fill(password);
  await page.locator('#champ-confirmation').fill(password);
  await submitForm(page);
  await page.locator('.vue[data-vue="reglages"]:not([hidden])').waitFor({ state: 'visible' });
}

const tests = [
  /* =========================================================================
     E2E-F1: Pet Profile CRUD & Archive
     ========================================================================= */
  {
    id: 'E2E-F1-01',
    feature: 'E2E-F1',
    title: 'Create minimal pet and persist card across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await assertIncludes(await page.locator('#accueil-liste').textContent(), 'Aucun animal pour l’instant.');
      await createPet(page, { nom: 'Filou' });
      const card = page.locator('#accueil-liste .carte-animal');
      assertEqual(await card.count(), 1, 'Pet card count');
      assertIncludes(await card.first().textContent(), 'Filou');
      await reloadApp(page);
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 1, 'Pet card count after reload');
      assertIncludes(await page.locator('#accueil-liste .carte-animal').first().textContent(), 'Filou');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-02',
    feature: 'E2E-F1',
    title: 'Create full pet with sterilization visibleSi, photo upload, and age calculation',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const birth = isoDateOffset(-400);
      const sterilDate = isoDateOffset(-100);
      await goTab(page, 'accueil');
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('[data-champ="dateSterilisation"]').evaluate((el) => el.hidden), true, 'dateSterilisation hidden initially');

      await page.locator('#champ-nom').fill('Nala');
      await page.locator('#champ-espece').fill('Chat');
      await page.locator('#champ-race').fill('Siamois');
      await page.locator('[data-champ="sexe"] input[value="femelle"]').check();
      await page.locator('#champ-couleur').fill('Crème et chocolat');
      await page.locator('#champ-naissance').fill(birth);
      await page.locator('#champ-naissanceApprox').check();
      await page.locator('#champ-puce').fill('250269600112233');
      await page.locator('#champ-sterilise').check();
      await page.locator('#champ-dateSterilisation').waitFor({ state: 'visible' });
      await page.locator('#champ-dateSterilisation').fill(sterilDate);
      await uploadSamplePng(page, page.locator('[data-champ="photo"] input[type="file"]:not([capture])'), 'nala.png');
      await page.locator('#champ-notes').fill('Très joueuse');
      await submitForm(page);

      const thumbSrc = await page.locator('#accueil-liste .carte-animal img.vignette').getAttribute('src');
      assertMatch(thumbSrc, /^data:image\/jpeg;base64,/, 'Pet thumbnail data URL');
      await openPet(page, 'Nala');
      const bodyText = await page.locator('#animal-contenu').textContent();
      assertIncludes(bodyText, 'Chat');
      assertIncludes(bodyText, 'Siamois');
      assertIncludes(bodyText, 'Femelle');
      assertIncludes(bodyText, '(date approximative)');
      assertIncludes(bodyText, '250269600112233');
      assertIncludes(bodyText, `Oui, le ${frDate(sterilDate)}`);
      assertIncludes(bodyText, 'Très joueuse');

      await reloadApp(page);
      await openPet(page, 'Nala');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Siamois');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-03',
    feature: 'E2E-F1',
    title: 'Edit pet profile, copy microchip, and verify alphabetical sorting',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Zorro', espece: 'Chien', puce: '250269600999888' });
      await createPet(page, { nom: 'Alpha', espece: 'Lapin' });
      const titlesBefore = await page.locator('#accueil-liste .carte-animal .carte-titre').allTextContents();
      assertEqual(JSON.stringify(titlesBefore), JSON.stringify(['Alpha', 'Zorro']), 'Alphabetical pet sort');

      await openPet(page, 'Zorro');
      await page.locator('#animal-contenu [aria-label="Copier le numéro de puce"]').click();
      await page.locator('#annonce').filter({ hasText: 'Copié : 250269600999888' }).waitFor({ state: 'visible' });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’identité', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Apollo');
      await page.locator('#champ-race').fill('Beagle');
      await submitForm(page);

      assertIncludes(await page.locator('#animal-titre').textContent(), 'Apollo');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Beagle');
      await goTab(page, 'accueil');
      const titlesAfter = await page.locator('#accueil-liste .carte-animal .carte-titre').allTextContents();
      assertEqual(JSON.stringify(titlesAfter), JSON.stringify(['Alpha', 'Apollo']), 'Updated alphabetical sort');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-04',
    feature: 'E2E-F1',
    title: 'Archive pet, inspect read-only archive view, and restore back to active list',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Milo', espece: 'Chat' });
      await openPet(page, 'Milo');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="confié"]').check();
      await submitForm(page);

      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Aucun animal pour l’instant.');
      const archBtn = page.locator('#accueil-actions').getByRole('button', { name: /Animaux archivés/ });
      await archBtn.click();
      await page.locator('.vue[data-vue="archives"]:not([hidden])').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#archives-liste').textContent(), 'Milo');
      assertIncludes(await page.locator('#archives-liste').textContent(), 'confié');

      await page.locator('#archives-liste').getByRole('button', { name: 'Consulter', exact: true }).click();
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’identité', exact: true }).count(), 0, 'Read-only archived identity');

      await page.locator('#animal-resume').getByRole('button', { name: 'Restaurer dans la liste', exact: true }).click();
      await confirmDialog(page, 'Restaurer');
      await goTab(page, 'accueil');
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 1, 'Restored pet on home');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Milo');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-05',
    feature: 'E2E-F1',
    title: 'Permanently delete archived pet via double confirmation',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Oscar', espece: 'Furet' });
      await openPet(page, 'Oscar');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="vendu"]').check();
      await submitForm(page);

      await goTab(page, 'accueil');
      await page.locator('#accueil-actions').getByRole('button', { name: /Animaux archivés/ }).click();
      await page.locator('.vue[data-vue="archives"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#archives-liste').getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
      await confirmDialog(page, 'Continuer', { expectNextDialog: true });
      await page.locator('dialog#dialogue[open] #dialogue-titre', { hasText: 'Dernière confirmation' }).waitFor({ state: 'visible' });
      await confirmDialog(page, 'Supprimer définitivement');

      await page.locator('#archives-liste .encart.vide').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#archives-liste').textContent(), 'Aucun animal archivé.');
      await reloadApp(page);
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Aucun animal pour l’instant.');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F2: Weigh-ins & SVG Weight Chart
     ========================================================================= */
  {
    id: 'E2E-F2-01',
    feature: 'E2E-F2',
    title: 'Add first weigh-in in kg with comma decimal and single-point SVG caption',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Luna', unitePoids: 'kg' });
      await openPet(page, 'Luna', 'poids');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucune pesée enregistrée.');

      const d1 = isoDateOffset(-5);
      await addWeighIn(page, { date: d1, valeur: '4,5', note: 'Avant repas' });

      assertIncludes(await page.locator('.chiffre-cle').textContent(), '4,5 kg');
      assertIncludes(await page.locator('.chiffre-cle').textContent(), frDate(d1));
      assertEqual(await page.locator('svg.graphique circle.point').count(), 1, '1 SVG point');
      assertEqual(await page.locator('svg.graphique polyline.courbe').count(), 0, 'No polyline with 1 point');
      assertIncludes(await page.locator('figcaption.aide').textContent(), 'Ajoute une deuxième pesée pour voir une courbe.');

      await reloadApp(page);
      await openPet(page, 'Luna', 'poids');
      assertIncludes(await page.locator('.chiffre-cle').textContent(), '4,5 kg');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-02',
    feature: 'E2E-F2',
    title: 'Add second weigh-in and verify SVG polyline and positive variation',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rex', unitePoids: 'kg' });
      await openPet(page, 'Rex', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-14), valeur: '10' });
      await addWeighIn(page, { date: isoDateOffset(-1), valeur: '10,8' });

      assertEqual(await page.locator('svg.graphique circle.point').count(), 2, '2 SVG points');
      assertEqual(await page.locator('svg.graphique polyline.courbe').count(), 1, 'SVG polyline rendered');
      assertIncludes(await page.locator('figcaption.aide').textContent(), 'Évolution du poids (kg)');
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), '+0,8 kg');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-03',
    feature: 'E2E-F2',
    title: 'Weigh-ins in grams display g unit and SVG axis legend',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Plume', espece: 'Rat', unitePoids: 'g' });
      await openPet(page, 'Plume', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-10), valeur: '320' });
      await addWeighIn(page, { date: isoDateOffset(-2), valeur: '355' });

      assertIncludes(await page.locator('.chiffre-cle').textContent(), '355 g');
      const legends = await page.locator('svg.graphique text.legende').allTextContents();
      assert(legends.includes('g'), 'SVG y-axis unit legend should contain g');
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), '+35 g');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-04',
    feature: 'E2E-F2',
    title: 'Edit weigh-in recalculates key stat and negative variation across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bibi', unitePoids: 'kg' });
      await openPet(page, 'Bibi', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-10), valeur: '5' });
      await addWeighIn(page, { date: isoDateOffset(-1), valeur: '5,5' });

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-valeur').fill('4,6');
      await submitForm(page);

      assertIncludes(await page.locator('.chiffre-cle').textContent(), '4,6 kg');
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), '−0,4 kg');
      await reloadApp(page);
      await openPet(page, 'Bibi', 'poids');
      assertIncludes(await page.locator('.chiffre-cle').textContent(), '4,6 kg');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-05',
    feature: 'E2E-F2',
    title: 'Delete weigh-in restores empty state when last entry removed',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Coco', unitePoids: 'kg' });
      await openPet(page, 'Coco', 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '3,2' });
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 1);

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucune pesée enregistrée.');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F3: Vaccines
     ========================================================================= */
  {
    id: 'E2E-F3-01',
    feature: 'E2E-F3',
    title: 'Add vaccine with future reminder, vet, lot, and note and verify persistence',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Rocky', espece: 'Chien' });
      await openPet(page, 'Rocky', 'vaccins');
      const dVacc = isoDateOffset(-10);
      const dRappel = isoDateOffset(12);
      await addVaccine(page, {
        nom: 'CHPPiL',
        date: dVacc,
        rappel: dRappel,
        veterinaire: 'Dr Dupont',
        lot: 'LOT-42A',
        note: 'Bien toléré',
      });

      const cardText = await page.locator('#animal-contenu .carte-fiche').first().textContent();
      assertIncludes(cardText, 'CHPPiL');
      assertIncludes(cardText, frDate(dVacc));
      assertIncludes(cardText, frDate(dRappel));
      assertIncludes(cardText, 'Dr Dupont');
      assertIncludes(cardText, 'LOT-42A');
      assertIncludes(cardText, 'Bien toléré');
      assertEqual(await page.locator('#animal-contenu').getByRole('button', { name: 'Noter le rappel fait', exact: true }).count(), 1);

      await reloadApp(page);
      await openPet(page, 'Rocky', 'vaccins');
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), 'LOT-42A');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-02',
    feature: 'E2E-F3',
    title: 'Add vaccine without reminder date omits renewal button',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Kiki', espece: 'Chat' });
      await openPet(page, 'Kiki', 'vaccins');
      await addVaccine(page, { nom: 'Leucose', date: isoDateOffset(-5) });

      const card = page.locator('#animal-contenu .carte-fiche').first();
      assertIncludes(await card.textContent(), 'Leucose');
      assertEqual(await card.getByRole('button', { name: 'Noter le rappel fait', exact: true }).count(), 0);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-03',
    feature: 'E2E-F3',
    title: 'Renew active vaccine via Noter le rappel fait marks older record renewed',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Simba', espece: 'Chat' });
      await openPet(page, 'Simba', 'vaccins');
      await addVaccine(page, {
        nom: 'Coryza',
        date: isoDateOffset(-365),
        rappel: isoDateOffset(-2),
        veterinaire: 'Dr Martin',
      });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-nom').inputValue(), 'Coryza', 'Prefilled vaccine name');
      assertEqual(await page.locator('#champ-veterinaire').inputValue(), 'Dr Martin', 'Prefilled vet');
      assertEqual(await page.locator('#champ-date').inputValue(), isoDateOffset(0), 'Prefilled today date');
      await page.locator('#champ-rappel').fill(isoDateOffset(365));
      await submitForm(page);

      const cards = page.locator('#animal-contenu .carte-fiche');
      assertEqual(await cards.count(), 2);
      assertIncludes(await cards.nth(1).textContent(), '(déjà renouvelé)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-04',
    feature: 'E2E-F3',
    title: 'Edit vaccine lot and reminder date persists across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bella', espece: 'Chien' });
      await openPet(page, 'Bella', 'vaccins');
      await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-30), rappel: isoDateOffset(30), lot: 'OLD-1' });

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-lot').fill('NEW-99');
      const newRappel = isoDateOffset(60);
      await page.locator('#champ-rappel').fill(newRappel);
      await submitForm(page);

      await reloadApp(page);
      await openPet(page, 'Bella', 'vaccins');
      const text = await page.locator('#animal-contenu .carte-fiche').first().textContent();
      assertIncludes(text, 'NEW-99');
      assertIncludes(text, frDate(newRappel));
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-05',
    feature: 'E2E-F3',
    title: 'Delete vaccine restores empty state',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Gribouille', espece: 'Chat' });
      await openPet(page, 'Gribouille', 'vaccins');
      await addVaccine(page, { nom: 'Typhus', date: isoDateOffset(-3) });
      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucun vaccin enregistré.');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F4: Antiparasitics
     ========================================================================= */
  {
    id: 'E2E-F4-01',
    feature: 'E2E-F4',
    title: 'Add Vermifuge with product, dose, and next due date',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Praline', espece: 'Chat' });
      await openPet(page, 'Praline', 'antiparasitaires');
      const nextDate = isoDateOffset(15);
      await addAntiparasitic(page, {
        type: 'vermifuge',
        produit: 'Milbemax',
        date: isoDateOffset(-15),
        prochaine: nextDate,
        dose: '1 comprimé',
      });

      const cardText = await page.locator('#animal-contenu .carte-fiche').first().textContent();
      assertIncludes(cardText, 'Vermifuge — Milbemax');
      assertIncludes(cardText, '1 comprimé');
      assertIncludes(cardText, frDate(nextDate));
      await reloadApp(page);
      await openPet(page, 'Praline', 'antiparasitaires');
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), 'Milbemax');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-02',
    feature: 'E2E-F4',
    title: 'Track Anti-puces and Anti-tiques independently as active entries',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Lucky', espece: 'Chien' });
      await openPet(page, 'Lucky', 'antiparasitaires');
      await addAntiparasitic(page, {
        type: 'anti-puces',
        produit: 'Advantix',
        date: isoDateOffset(-5),
        prochaine: isoDateOffset(25),
      });
      await addAntiparasitic(page, {
        type: 'anti-tiques',
        produit: 'Bravecto',
        date: isoDateOffset(-2),
        prochaine: isoDateOffset(88),
      });

      const cards = page.locator('#animal-contenu .carte-fiche');
      assertEqual(await cards.count(), 2);
      assertEqual(await page.locator('#animal-contenu').getByRole('button', { name: 'Noter la prise suivante', exact: true }).count(), 2);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-03',
    feature: 'E2E-F4',
    title: 'Log next antiparasitic dose via Noter la prise suivante marks previous done',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Moustache', espece: 'Chat' });
      await openPet(page, 'Moustache', 'antiparasitaires');
      await addAntiparasitic(page, {
        type: 'vermifuge',
        produit: 'Drontal',
        date: isoDateOffset(-90),
        prochaine: isoDateOffset(-1),
        dose: '1/2 comprimé',
      });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-produit').inputValue(), 'Drontal');
      assertEqual(await page.locator('#champ-dose').inputValue(), '1/2 comprimé');
      await page.locator('#champ-prochaine').fill(isoDateOffset(90));
      await submitForm(page);

      const cards = page.locator('#animal-contenu .carte-fiche');
      assertEqual(await cards.count(), 2);
      assertIncludes(await cards.nth(1).textContent(), '(déjà faite)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-04',
    feature: 'E2E-F4',
    title: 'Add and edit Autre antiparasitaire with custom product',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Polly', espece: 'Oiseau' });
      await openPet(page, 'Polly', 'antiparasitaires');
      await addAntiparasitic(page, {
        type: 'autre',
        produit: 'Spray anti-acariens',
        date: isoDateOffset(-3),
        dose: '2 pulvérisations',
      });
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), 'Autre antiparasitaire — Spray anti-acariens');

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-dose').fill('3 pulvérisations');
      await submitForm(page);
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), '3 pulvérisations');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-05',
    feature: 'E2E-F4',
    title: 'Delete antiparasitic entry restores empty state',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Choupette', espece: 'Chat' });
      await openPet(page, 'Choupette', 'antiparasitaires');
      await addAntiparasitic(page, { type: 'anti-puces', produit: 'Frontline', date: isoDateOffset(-1) });
      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucune prise enregistrée.');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F5: Treatments & Daily Doses
     ========================================================================= */
  {
    id: 'E2E-F5-01',
    feature: 'E2E-F5',
    title: 'Add active treatment with daily dose counter and verify persistence',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bounty', espece: 'Chien' });
      await openPet(page, 'Bounty', 'traitements');
      await addTreatment(page, {
        nom: 'Amoxicilline',
        dose: '1 comprimé',
        frequence: 'Matin et soir',
        prisesParJour: 2,
        debut: isoDateOffset(-1),
        fin: isoDateOffset(5),
        statut: 'en-cours',
      });

      const content = await page.locator('#animal-contenu').textContent();
      assertIncludes(content, 'En cours (1)');
      assertIncludes(content, 'aucune prise notée sur 2 prévues');
      await reloadApp(page);
      await openPet(page, 'Bounty', 'traitements');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Amoxicilline');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-02',
    feature: 'E2E-F5',
    title: 'Log daily doses until complete state reached',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Tigrou', espece: 'Chat' });
      await openPet(page, 'Tigrou', 'traitements');
      await addTreatment(page, { nom: 'Cortisone', prisesParJour: 2, statut: 'en-cours' });

      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises').filter({ hasText: '1 prise sur 2' }).waitFor({ state: 'visible' });

      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises.complet').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('.encart.prises.complet').textContent(), '✓ Toutes les prises du jour sont notées.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-03',
    feature: 'E2E-F5',
    title: 'Confirm extra dose when complete and undo last dose',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Pixel', espece: 'Chat' });
      await openPet(page, 'Pixel', 'traitements');
      await addTreatment(page, { nom: 'Gouttes', prisesParJour: 1, statut: 'en-cours' });

      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises.complet').waitFor({ state: 'visible' });

      // Extra dose confirmation
      await page.locator('.encart.prises').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await confirmDialog(page, 'Noter une prise de plus');
      await page.locator('.encart.prises').filter({ hasText: '2 prises sur 1' }).waitFor({ state: 'visible' });

      // Undo last dose
      await page.locator('.encart.prises').getByRole('button', { name: 'Annuler la dernière prise', exact: true }).click();
      await confirmDialog(page, 'Retirer la prise');
      await page.locator('.encart.prises').filter({ hasText: '1 prise sur 1' }).waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-04',
    feature: 'E2E-F5',
    title: 'Mark active treatment finished moves card to Terminés',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Léo', espece: 'Chien' });
      await openPet(page, 'Léo', 'traitements');
      await addTreatment(page, { nom: 'Collyre', debut: isoDateOffset(-4), statut: 'en-cours' });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer terminé', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });
      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'En cours (0)');
      assertIncludes(text, 'Terminés (1)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-05',
    feature: 'E2E-F5',
    title: 'Edit and delete treatment persists across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Kiwi', espece: 'Oiseau' });
      await openPet(page, 'Kiwi', 'traitements');
      await addTreatment(page, { nom: 'Vitamines', dose: '1 goutte', statut: 'en-cours' });

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-dose').fill('2 gouttes');
      await submitForm(page);
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), '2 gouttes');

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });
      await reloadApp(page);
      await openPet(page, 'Kiwi', 'traitements');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucun traitement enregistré.');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F6: Vet Appointments & Costs
     ========================================================================= */
  {
    id: 'E2E-F6-01',
    feature: 'E2E-F6',
    title: 'Add upcoming appointment with time, vet, and cost',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Max', espece: 'Chien' });
      await openPet(page, 'Max', 'rdv');
      const d = isoDateOffset(10);
      await addAppointment(page, {
        date: d,
        heure: '14:30',
        motif: 'Bilan annuel',
        veterinaire: 'Dr Leroy',
        cout: '65,5',
      });

      const content = await page.locator('#animal-contenu').textContent();
      assertIncludes(content, 'À venir (1)');
      assertIncludes(content, 'Bilan annuel');
      assertIncludes(content, 'Dr Leroy');
      assertMatch(await page.locator('.encart.frais').textContent(), /65,50\s*€/, 'Cost summary');
      await reloadApp(page);
      await openPet(page, 'Max', 'rdv');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Bilan annuel');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-02',
    feature: 'E2E-F6',
    title: 'Add past appointment and fill summary via Ajouter le compte rendu',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Maya', espece: 'Chat' });
      await openPet(page, 'Maya', 'rdv');
      await addAppointment(page, { date: isoDateOffset(-7), motif: 'Détartrage' });

      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Passés (1)');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter le compte rendu', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-compteRendu').fill('Dents impeccables.');
      await submitForm(page);

      assertIncludes(await page.locator('#animal-contenu .carte-fiche.termine').textContent(), 'Dents impeccables.');
      assertEqual(await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter le compte rendu', exact: true }).count(), 0);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-03',
    feature: 'E2E-F6',
    title: 'Compute per-year subtotals and multi-year total in cost summary',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Pacha', espece: 'Chat' });
      await openPet(page, 'Pacha', 'rdv');
      const yearA = new Date().getFullYear() - 1;
      const yearB = new Date().getFullYear();
      await addAppointment(page, { date: `${yearA}-06-15`, motif: 'Visite A', cout: '40' });
      await addAppointment(page, { date: `${yearB}-01-10`, motif: 'Visite B', cout: '60' });

      const fraisText = await page.locator('.encart.frais').textContent();
      assertIncludes(fraisText, `${yearA} :`);
      assertIncludes(fraisText, `${yearB} :`);
      assertMatch(fraisText, /Total\s*:\s*100,00\s*€/);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-04',
    feature: 'E2E-F6',
    title: 'Prefill default veterinarian from pet profile when creating appointment',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Pasteur', clinique: 'Clinique Centrale' });
      await createPet(page, { nom: 'Vega', espece: 'Chien', vetoLabel: 'Dr Pasteur (Clinique Centrale)' });
      await openPet(page, 'Vega', 'rdv');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#champ-veterinaire').inputValue(), 'Dr Pasteur', 'Prefilled vet name');
      await page.locator('.formulaire-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-05',
    feature: 'E2E-F6',
    title: 'Open Google Calendar dialog on upcoming appointment, then edit and delete',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Louna', espece: 'Chien' });
      await openPet(page, 'Louna', 'rdv');
      await addAppointment(page, { date: isoDateOffset(5), heure: '10:00', motif: 'Vaccin annuel' });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
      const dlg = page.locator('dialog#dialogue[open]');
      await dlg.waitFor({ state: 'visible' });
      assertIncludes(await dlg.locator('#dialogue-titre').textContent(), 'Ajouter à Google Agenda');
      assertEqual(await dlg.getByRole('button', { name: 'Ouvrir Google Agenda', exact: true }).count(), 1);
      await confirmDialog(page, 'Annuler');

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-motif').fill('Rappel vaccin');
      await submitForm(page);
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Rappel vaccin');

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucun rendez-vous enregistré.');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F7: Tasks & Recurrence
     ========================================================================= */
  {
    id: 'E2E-F7-01',
    feature: 'E2E-F7',
    title: 'Add one-off task and verify persistence across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Noisette', espece: 'Lapin' });
      await openPet(page, 'Noisette', 'taches');
      await addTask(page, {
        titre: 'Nettoyer la litière',
        echeance: isoDateOffset(2),
        repete: 'non',
        note: 'Utiliser du vinaigre blanc',
      });

      const content = await page.locator('#animal-contenu').textContent();
      assertIncludes(content, 'À faire (1)');
      assertIncludes(content, 'Nettoyer la litière');
      assertIncludes(content, 'Une seule fois');
      await reloadApp(page);
      await openPet(page, 'Noisette', 'taches');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Nettoyer la litière');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-02',
    feature: 'E2E-F7',
    title: 'Complete one-off task moves it to Faites with completion date',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Cookie', espece: 'Chien' });
      await openPet(page, 'Cookie', 'taches');
      await addTask(page, { titre: 'Couper les griffes', echeance: isoDateOffset(0), repete: 'non' });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });
      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'À faire (0)');
      assertIncludes(text, 'Faites (1)');
      assertIncludes(text, `Faite le : ${frDate(isoDateOffset(0))}`);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-03',
    feature: 'E2E-F7',
    title: 'Undo completion restores task back to À faire',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Biscotte', espece: 'Chat' });
      await openPet(page, 'Biscotte', 'taches');
      await addTask(page, { titre: 'Brosser le poil', echeance: isoDateOffset(0), repete: 'non' });
      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Annuler « fait »', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: 'À faire (1)' }).waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu .carte-fiche.termine').count(), 0);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-04',
    feature: 'E2E-F7',
    title: 'Complete recurring task generates next occurrence and undo removes it',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Pluto', espece: 'Chien' });
      await openPet(page, 'Pluto', 'taches');
      const start = isoDateOffset(0);
      const expectedNext = isoDateOffset(14);
      await addTask(page, {
        titre: 'Laver les gamelles',
        echeance: start,
        repete: 'oui',
        recN: 2,
        recUnite: 'semaines',
      });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });
      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'À faire (1)');
      assertIncludes(text, 'Faites (1)');
      assertIncludes(text, frDate(expectedNext));

      await page.locator('#animal-contenu').getByRole('button', { name: 'Annuler « fait »', exact: true }).click();
      await page.locator('#annonce').filter({ hasText: 'La tâche est de nouveau à faire.' }).waitFor({ state: 'visible' });
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'detached' });
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 1, 'Auto-generated next task removed on undo');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-05',
    feature: 'E2E-F7',
    title: 'Edit and delete task persists across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Mimi', espece: 'Chat' });
      await openPet(page, 'Mimi', 'taches');
      await addTask(page, { titre: 'Acheter croquettes', echeance: isoDateOffset(3), repete: 'non' });

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-titre').fill('Acheter pâtée');
      await submitForm(page);
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Acheter pâtée');

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });
      await reloadApp(page);
      await openPet(page, 'Mimi', 'taches');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucune tâche.');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F8: Reminders & Badge
     ========================================================================= */
  {
    id: 'E2E-F8-01',
    feature: 'E2E-F8',
    title: 'Verify empty reminders view and hidden navigation badge',
    run: async ({ page, assertNoRuntimeErrors }) => {
      assertEqual(await page.locator('#nav-pastille').evaluate((el) => el.hidden), true, 'Badge hidden initially');
      await goTab(page, 'rappels');
      assertIncludes(await page.locator('#rappels-liste').textContent(), 'Aucun animal pour l’instant : aucun rappel.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-02',
    feature: 'E2E-F8',
    title: 'Verify reminder aggregation buckets, home badges, and nav badge count',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await page.locator('#nav-pastille:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#nav-pastille').textContent(), '4', 'Demo overdue+today reminder count');

      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'en retard');

      await goTab(page, 'rappels');
      assertIncludes(await page.locator('#rappels-retard').textContent(), 'En retard (3)');
      assertIncludes(await page.locator('#rappels-aujourdhui').textContent(), 'Aujourd’hui (1)');
      assertIncludes(await page.locator('#rappels-semaine').textContent(), 'Dans les 7 jours (3)');
      assertIncludes(await page.locator('#rappels-mois').textContent(), 'Dans les 30 jours (4)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-03',
    feature: 'E2E-F8',
    title: 'Complete task directly on Rappels decrements nav badge count',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await goTab(page, 'rappels');
      assertEqual(await page.locator('#nav-pastille').textContent(), '4');

      const overdueSection = page.locator('section.groupe-rappels.retard');
      await overdueSection.getByRole('button', { name: 'Marquer comme fait', exact: true }).first().click();
      await page.locator('#nav-pastille').filter({ hasText: '3' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#rappels-retard').textContent(), 'En retard (2)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-04',
    feature: 'E2E-F8',
    title: 'Log daily medication doses from Médicaments du jour on Rappels',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await goTab(page, 'rappels');
      const medSection = page.locator('section.groupe-rappels.medicaments');
      await medSection.waitFor({ state: 'visible' });
      assertIncludes(await medSection.textContent(), 'Médicaments du jour (1)');

      await medSection.getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await medSection.locator('.encart.prises').filter({ hasText: '1 prise sur 2' }).waitFor({ state: 'visible' });
      await medSection.getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await medSection.locator('.encart.prises.complet').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-05',
    feature: 'E2E-F8',
    title: 'Navigate from reminder card Voir la fiche and export bulk .ics file',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await goTab(page, 'rappels');

      await page.locator('#agenda-tout summary').click();
      const ics = await captureDownload(page, () => page.locator('#bouton-agenda-tout').click());
      assertMatch(ics.filename, /\.ics$/i, 'ICS filename');
      assertIncludes(ics.content, 'BEGIN:VCALENDAR');
      assertIncludes(ics.content, 'END:VCALENDAR');
      assertIncludes(ics.content, 'BEGIN:VEVENT');

      await page.locator('#rappels-liste .carte-rappel').getByRole('button', { name: 'Voir la fiche', exact: true }).first().click();
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      assertMatch(page.url(), /#animal\/[^/]+\//);
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F9: Notes, Filters & Documents
     ========================================================================= */
  {
    id: 'E2E-F9-01',
    feature: 'E2E-F9',
    title: 'Add observation note and verify persistence across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Saphir', espece: 'Chat' });
      await openPet(page, 'Saphir', 'notes');
      const d = isoDateOffset(-2);
      await addNote(page, { date: d, categorie: 'observation', texte: 'Très bon appétit ce matin.' });

      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, `${frDate(d)} — Observation`);
      assertIncludes(text, 'Très bon appétit ce matin.');
      await reloadApp(page);
      await openPet(page, 'Saphir', 'notes');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Très bon appétit ce matin.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-02',
    feature: 'E2E-F9',
    title: 'Add allergy note displays Allergies connues alert banner',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Caramel', espece: 'Chien' });
      await openPet(page, 'Caramel', 'notes');
      await addNote(page, { date: isoDateOffset(-1), categorie: 'allergie', texte: 'Allergique au poulet' });

      const banner = page.locator('#animal-contenu .encart.attention');
      await banner.waitFor({ state: 'visible' });
      assertIncludes(await banner.textContent(), 'Allergies connues');
      assertIncludes(await banner.textContent(), 'Allergique au poulet');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-03',
    feature: 'E2E-F9',
    title: 'Filter health notes by category and date range and reset with Tout afficher',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Moka', espece: 'Chat' });
      await openPet(page, 'Moka', 'notes');
      await addNote(page, { date: isoDateOffset(-10), categorie: 'symptome', texte: 'Éternuements légers' });
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^1 note\(s\)\.$/ })
        .waitFor({ state: 'visible', timeout: 10000 });
      await addNote(page, { date: isoDateOffset(-1), categorie: 'examen', texte: 'Prise de sang normale' });
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^2 note\(s\)\.$/ })
        .waitFor({ state: 'visible', timeout: 10000 });

      await page.locator('details.filtre summary').click();
      await page.locator('#filtre-categorie').selectOption('examen');
      await page.locator('#filtre-du').fill(isoDateOffset(-3));
      await page.locator('details.filtre').getByRole('button', { name: 'Appliquer le filtre', exact: true }).click();
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^1 note\(s\) sur 2 \(filtre actif\)\.$/ })
        .waitFor({ state: 'visible', timeout: 10000 });

      assertIncludes(await page.locator('#animal-contenu').textContent(), '1 note(s) sur 2 (filtre actif).');
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 1);

      await page.locator('details.filtre').getByRole('button', { name: 'Tout afficher', exact: true }).click();
      await page.locator('#animal-contenu p[aria-live="polite"]')
        .filter({ hasText: /^2 note\(s\)\.$/ })
        .waitFor({ state: 'visible', timeout: 10000 });
      assertIncludes(await page.locator('#animal-contenu').textContent(), '2 note(s).');
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 2);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-04',
    feature: 'E2E-F9',
    title: 'Attach PNG document to note and inspect in image viewer',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Jazz', espece: 'Chien' });
      await openPet(page, 'Jazz', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'examen', texte: 'Ordonnance', withDocument: true });

      const thumbBtn = page.locator('#animal-contenu button.vignette-document').first();
      await thumbBtn.waitFor({ state: 'visible' });
      await thumbBtn.click();

      const viewer = page.locator('dialog#visionneuse[open]');
      await viewer.waitFor({ state: 'visible' });
      const imgSrc = await viewer.locator('img.image-visionneuse').getAttribute('src');
      assertMatch(imgSrc, /^data:image\/jpeg;base64,/);

      await viewer.getByRole('button', { name: 'Taille réelle', exact: true }).click();
      assertEqual(await viewer.locator('.visionneuse-zone.taille-reelle').count(), 1);
      await viewer.getByRole('button', { name: 'Ajuster à l’écran', exact: true }).click();
      await viewer.getByRole('button', { name: 'Fermer', exact: true }).click();
      await page.locator('dialog#visionneuse:not([open])').waitFor({ state: 'attached' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-05',
    feature: 'E2E-F9',
    title: 'Edit note to remove attached document and delete note',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Oreo', espece: 'Chat' });
      await openPet(page, 'Oreo', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'autre', texte: 'Bilan papier', withDocument: true });

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="pieces"] button[aria-label^="Retirer le document"]').click();
      await page.locator('[data-champ="pieces"] .champ-photo-zone .aide').filter({ hasText: 'Document retiré' }).waitFor({ state: 'visible' });
      await page.locator('#champ-texte').fill('Note sans document');
      await submitForm(page);

      assertEqual(await page.locator('#animal-contenu button.vignette-document').count(), 0);
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Note sans document');

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#animal-contenu .encart.vide').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Aucune note pour l’instant');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F10: Pet-Sitter Care Sheet (Garde)
     ========================================================================= */
  {
    id: 'E2E-F10-01',
    feature: 'E2E-F10',
    title: 'Care sheet displays contact, forbidden foods, allergies, meals, treatments, and 30-day reminders',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await openPet(page, 'Biscuit (exemple)');
      await openGarde(page);

      const gardeText = await page.locator('#garde-contenu').textContent();
      assertIncludes(await page.locator('#garde-titre').textContent(), 'Garde de Biscuit (exemple)');
      assertIncludes(gardeText, 'À contacter');
      assertIncludes(gardeText, 'Dr Exemple');
      assertIncludes(gardeText, 'Allergies connues');
      assertIncludes(gardeText, 'Repas');
      assertIncludes(gardeText, 'Croquettes adulte (exemple)');
      assertIncludes(gardeText, 'Médicaments en cours');
      assertIncludes(gardeText, 'Anti-inflammatoire (exemple)');
      assertIncludes(gardeText, 'Consignes');
      assertIncludes(gardeText, 'Prévu dans les 30 prochains jours');
      assertIncludes(gardeText, 'Identification');

      // Add forbidden food and verify .garde-alerte appears
      await page.locator('.vue[data-vue="garde"] [data-action="retour"]').click();
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      await openAnimalSection(page, 'alimentation');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Modifier l’alimentation', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-alimEviter').fill('Chocolat et oignons');
      await submitForm(page);

      await openAnimalSection(page, 'identite');
      await openGarde(page);
      const alertText = await page.locator('.garde-partie.garde-alerte').textContent();
      assertIncludes(alertText, 'À ne surtout pas donner');
      assertIncludes(alertText, 'Chocolat et oignons');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-02',
    feature: 'E2E-F10',
    title: 'Add sitter instructions from care sheet and persist across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Chipie', espece: 'Chat' });
      await openPet(page, 'Chipie');
      await openGarde(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter des consignes', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-consignesGarde').fill('Dort dans le panier du salon.');
      await submitGardeForm(page);

      assertIncludes(await page.locator('#garde-contenu').textContent(), 'Dort dans le panier du salon.');
      await reloadApp(page);
      assertIncludes(await page.locator('#garde-contenu').textContent(), 'Dort dans le panier du salon.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-03',
    feature: 'E2E-F10',
    title: 'Add owner contact on care sheet and share across multiple pets',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Uno', espece: 'Chien' });
      await createPet(page, { nom: 'Dos', espece: 'Chat' });

      await openPet(page, 'Uno');
      await openGarde(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter mon contact (propriétaire)', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Camille');
      await page.locator('#champ-telephone').fill('06 11 22 33 44');
      await submitGardeForm(page);

      assertIncludes(await page.locator('#garde-contenu').textContent(), 'Propriétaire : Camille');
      assertEqual(await page.locator('#garde-contenu a.lien-tel[href="tel:0611223344"]').count(), 1);

      await goTab(page, 'accueil');
      await openPet(page, 'Dos');
      await openGarde(page);
      assertIncludes(await page.locator('#garde-contenu').textContent(), 'Propriétaire : Camille');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-04',
    feature: 'E2E-F10',
    title: 'Edit existing sitter instructions on care sheet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bambou', espece: 'Lapin' });
      await openPet(page, 'Bambou');
      await openGarde(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter des consignes', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-consignesGarde').fill('Première consigne');
      await submitGardeForm(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Modifier les consignes', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-consignesGarde').fill('Foin à volonté matin et soir');
      await submitGardeForm(page);

      assertIncludes(await page.locator('#garde-contenu').textContent(), 'Foin à volonté matin et soir');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-05',
    feature: 'E2E-F10',
    title: 'Trigger Imprimer ou enregistrer en PDF populates #carnet with care sheet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Néo', espece: 'Chat' });
      await openPet(page, 'Néo');
      await openGarde(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).click();
      await page.locator('#carnet .fiche-garde').waitFor({ state: 'attached' });
      const carnetText = await page.locator('#carnet .fiche-garde').textContent();
      assertIncludes(carnetText, 'Fiche de garde');
      assertIncludes(carnetText, 'Néo');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F11: Vet Directory (Vétérinaires)
     ========================================================================= */
  {
    id: 'E2E-F11-01',
    feature: 'E2E-F11',
    title: 'Add veterinarian with phone link and verify persistence across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'veterinaires');
      assertIncludes(await page.locator('#vetos-liste').textContent(), 'Aucun vétérinaire enregistré.');

      await createVet(page, {
        nom: 'Dr Moreau',
        clinique: 'Clinique des Lilas',
        telephone: '01 42 55 66 77',
        adresse: '12 avenue Jean Jaurès',
        notes: 'Urgences 24/7',
      });

      const card = page.locator('#vetos-liste .carte-fiche').first();
      const text = await card.textContent();
      assertIncludes(text, 'Dr Moreau');
      assertIncludes(text, 'Clinique des Lilas');
      assertIncludes(text, '12 avenue Jean Jaurès');
      assertIncludes(text, 'Urgences 24/7');
      assertEqual(await card.locator('a.lien-tel').getAttribute('href'), 'tel:0142556677');

      await reloadApp(page);
      await goTab(page, 'veterinaires');
      assertIncludes(await page.locator('#vetos-liste').textContent(), 'Dr Moreau');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-02',
    feature: 'E2E-F11',
    title: 'Assign vet to pet and verify reciprocal display on both screens',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Curie', clinique: 'Clinique Sud', telephone: '04 50 10 20 30' });
      await createPet(page, { nom: 'Baxter', espece: 'Chien', vetoLabel: 'Dr Curie (Clinique Sud)' });

      await goTab(page, 'veterinaires');
      assertIncludes(await page.locator('#vetos-liste .carte-fiche').first().textContent(), 'Vétérinaire habituel de : Baxter');

      await openPet(page, 'Baxter');
      const idText = await page.locator('#animal-contenu').textContent();
      assertIncludes(idText, 'Dr Curie — Clinique Sud');
      assertEqual(await page.locator('#animal-contenu a.lien-tel').getAttribute('href'), 'tel:0450102030');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-03',
    feature: 'E2E-F11',
    title: 'Edit vet updates details on both Vétérinaires and linked pet Identité',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Klein', clinique: 'Clinique Nord' });
      await createPet(page, { nom: 'Ruby', espece: 'Chat', vetoLabel: 'Dr Klein (Clinique Nord)' });

      await goTab(page, 'veterinaires');
      await page.locator('#vetos-liste .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-clinique').fill('Clinique Horizon');
      await submitForm(page);

      assertIncludes(await page.locator('#vetos-liste').textContent(), 'Clinique Horizon');
      await openPet(page, 'Ruby');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Dr Klein — Clinique Horizon');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-04',
    feature: 'E2E-F11',
    title: 'Verify alphabetical sorting of veterinarians in directory',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Zola' });
      await createVet(page, { nom: 'Dr Bernard' });
      await createVet(page, { nom: 'Dr Lambert' });

      const names = await page.locator('#vetos-liste .carte-titre').allTextContents();
      assertEqual(JSON.stringify(names), JSON.stringify(['Dr Bernard', 'Dr Lambert', 'Dr Zola']));
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-05',
    feature: 'E2E-F11',
    title: 'Delete linked vet warns about pet and unlinks pet Identité',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Vidal', clinique: 'Clinique Parc' });
      await createPet(page, { nom: 'Nino', espece: 'Chien', vetoLabel: 'Dr Vidal (Clinique Parc)' });

      await goTab(page, 'veterinaires');
      await page.locator('#vetos-liste .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true }).click();
      const dlgText = await page.locator('dialog#dialogue[open]').textContent();
      assertIncludes(dlgText, 'Nino');
      await confirmDialog(page, 'Supprimer');

      await page.locator('#vetos-liste .encart.vide').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#vetos-liste').textContent(), 'Aucun vétérinaire enregistré.');
      await openPet(page, 'Nino');
      assertEqual(await page.locator('#animal-contenu').textContent().then((t) => t.includes('Dr Vidal')), false, 'Vet unlinked from pet');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F12: Backup, Restore & Demo Data
     ========================================================================= */
  {
    id: 'E2E-F12-01',
    feature: 'E2E-F12',
    title: 'Load demo dataset creates Biscuit, Moka, and Dr Exemple',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await goTab(page, 'accueil');
      const homeText = await page.locator('#accueil-liste').textContent();
      assertIncludes(homeText, 'Biscuit (exemple)');
      assertIncludes(homeText, 'Moka (exemple)');

      await goTab(page, 'veterinaires');
      assertIncludes(await page.locator('#vetos-liste').textContent(), 'Dr Exemple');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-02',
    feature: 'E2E-F12',
    title: 'Delete demo dataset preserves user-created pet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'MonChien', espece: 'Chien' });
      await loadDemoData(page);
      await goTab(page, 'accueil');
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 3);

      await goTab(page, 'reglages');
      await page.locator('#bouton-exemple').click();
      await confirmDialog(page, 'Supprimer l’exemple');
      await page.locator('#bouton-exemple').filter({ hasText: 'Charger un exemple' }).waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 1);
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'MonChien');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-03',
    feature: 'E2E-F12',
    title: 'Export JSON backup validates schema and updates Dernière sauvegarde date',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Atlas', espece: 'Chien' });
      await goTab(page, 'reglages');
      assertIncludes(await page.locator('#reglages-contenu').textContent(), 'Dernière sauvegarde : jamais');

      const backup = await triggerBackupDownload(page);
      assertMatch(backup.filename, /^omni-animalia-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
      assertEqual(backup.data.format, 'omni-animaux-sauvegarde');
      assertEqual(backup.data.versionFormat, 1);
      assertEqual(backup.data.donnees.animaux.length, 1);
      assertEqual(backup.data.donnees.animaux[0].nom, 'Atlas');
      assertIncludes(await page.locator('#reglages-contenu').textContent(), `Dernière sauvegarde : ${frDate(isoDateOffset(0))}`);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-04',
    feature: 'E2E-F12',
    title: 'Wipe all data via SUPPRIMER confirmation and restore in Remplacer mode',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Toby', espece: 'Chien' });
      const backup = await triggerBackupDownload(page);

      await page.locator('#reglages-contenu').getByRole('button', { name: 'Supprimer toutes les données', exact: true }).click();
      await confirmDialog(page, 'Continuer', { expectNextDialog: true });
      await page.locator('dialog#dialogue[open] #dialogue-saisie').waitFor({ state: 'visible' });
      await confirmDialog(page, 'Tout supprimer', { inputText: 'SUPPRIMER' });

      await page.locator('#annonce').filter({ hasText: 'Toutes les données ont été supprimées.' }).waitFor({ state: 'visible' });
      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Aucun animal pour l’instant.');

      await goTab(page, 'reglages');
      await page.locator('#fichier-import').setInputFiles({
        name: backup.filename,
        mimeType: 'application/json',
        buffer: Buffer.from(backup.raw, 'utf8'),
      });
      await confirmDialog(page, 'Remplacer', { expectNextDialog: true });
      await page.locator('dialog#dialogue[open] #dialogue-titre', { hasText: 'Tout remplacer ?' }).waitFor({ state: 'visible' });
      await confirmDialog(page, 'Remplacer');
      await page.locator('#annonce').filter({ hasText: 'Restauration terminée' }).waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Toby');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-05',
    feature: 'E2E-F12',
    title: 'Restore backup in Fusionner mode merges imported pet with existing pet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'PetImporte', espece: 'Chat' });
      const backup = await triggerBackupDownload(page);

      // Wipe and create a different pet, then merge
      await goTab(page, 'accueil');
      await openPet(page, 'PetImporte');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="autre"]').check();
      await submitForm(page);
      await goTab(page, 'accueil');
      await page.locator('#accueil-actions').getByRole('button', { name: /Animaux archivés/ }).click();
      await page.locator('#archives-liste').getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
      await confirmDialog(page, 'Continuer', { expectNextDialog: true });
      await page.locator('dialog#dialogue[open] #dialogue-titre', { hasText: 'Dernière confirmation' }).waitFor({ state: 'visible' });
      await confirmDialog(page, 'Supprimer définitivement');
      await page.locator('#archives-liste .encart.vide').waitFor({ state: 'visible' });

      await createPet(page, { nom: 'PetLocal', espece: 'Chien' });
      await goTab(page, 'reglages');
      await page.locator('#fichier-import').setInputFiles({
        name: backup.filename,
        mimeType: 'application/json',
        buffer: Buffer.from(backup.raw, 'utf8'),
      });
      await confirmDialog(page, 'Fusionner');
      await page.locator('#annonce').filter({ hasText: 'Restauration terminée' }).waitFor({ state: 'visible' });

      await goTab(page, 'accueil');
      const names = await page.locator('#accueil-liste .carte-animal .carte-titre').allTextContents();
      assertEqual(JSON.stringify(names), JSON.stringify(['PetImporte', 'PetLocal']));
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F13: Password Lock (Verrou)
     ========================================================================= */
  {
    id: 'E2E-F13-01',
    feature: 'E2E-F13',
    title: 'Activate password lock updates Réglages status and buttons',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      assertIncludes(await page.locator('#reglages-contenu').textContent(), 'Le verrouillage par mot de passe est désactivé.');
      await activatePassword(page, 'Secret1234');
      const content = await page.locator('#reglages-contenu').textContent();
      assertIncludes(content, 'Le verrouillage par mot de passe est activé.');
      assertEqual(await page.locator('#reglages-contenu').getByRole('button', { name: 'Changer le mot de passe', exact: true }).count(), 1);
      assertEqual(await page.locator('#reglages-contenu').getByRole('button', { name: 'Désactiver le mot de passe', exact: true }).count(), 1);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-02',
    feature: 'E2E-F13',
    title: 'Reload displays lock overlay and hides main app and navigation',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await activatePassword(page, 'MonMotDePasse');
      await reloadApp(page);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), false, '#verrou visible');
      assertEqual(await page.locator('#principal').evaluate((el) => el.hidden), true, '#principal hidden');
      assertEqual(await page.locator('#barre-nav').evaluate((el) => el.hidden), true, '#barre-nav hidden');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-03',
    feature: 'E2E-F13',
    title: 'Reject incorrect password and unlock with correct password',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await activatePassword(page, 'Chaton2026');
      await reloadApp(page);

      await page.locator('#verrou-mdp').fill('MauvaisPass');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#verrou-erreur:not([hidden])').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#verrou-erreur').textContent(), 'Mot de passe incorrect');

      await page.locator('#verrou-mdp').fill('Chaton2026');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#principal:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), true);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-04',
    feature: 'E2E-F13',
    title: 'Change password invalidates old password and accepts new password',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await activatePassword(page, 'AncienPass');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'Changer le mot de passe', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-actuel').fill('AncienPass');
      await page.locator('#champ-nouveau').fill('NouveauPass');
      await page.locator('#champ-confirmation').fill('NouveauPass');
      await submitForm(page);

      await reloadApp(page);
      await page.locator('#verrou-mdp').fill('AncienPass');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#verrou-erreur:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#verrou-mdp').fill('NouveauPass');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#principal:not([hidden])').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-05',
    feature: 'E2E-F13',
    title: 'Disable password lock removes prompt on subsequent reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await activatePassword(page, 'PassTemporaire');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'Désactiver le mot de passe', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-actuel').fill('PassTemporaire');
      await submitForm(page);

      assertIncludes(await page.locator('#reglages-contenu').textContent(), 'Le verrouillage par mot de passe est désactivé.');
      await reloadApp(page);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), true);
      assertEqual(await page.locator('#principal').evaluate((el) => el.hidden), false);
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F14: Themes, Text Size & Routing
     ========================================================================= */
  {
    id: 'E2E-F14-01',
    feature: 'E2E-F14',
    title: 'Switch theme updates html[data-theme], localStorage, and persists across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      assertEqual(await page.locator('html').getAttribute('data-theme'), 'omni');

      await page.locator('input[name="reglage-theme"][value="sombre"]').check();
      assertEqual(await page.locator('html').getAttribute('data-theme'), 'sombre');
      assertEqual(await page.evaluate(() => localStorage.getItem('omnianimaux_theme')), 'sombre');

      await page.locator('input[name="reglage-theme"][value="clair"]').check();
      assertEqual(await page.locator('html').getAttribute('data-theme'), 'clair');
      assertEqual(await page.evaluate(() => localStorage.getItem('omnianimaux_theme')), 'clair');

      await reloadApp(page);
      assertEqual(await page.locator('html').getAttribute('data-theme'), 'clair');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-02',
    feature: 'E2E-F14',
    title: 'Switch text size updates html[data-taille], root font-size, and persists across reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      const normalPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

      await page.locator('input[name="reglage-taille"][value="grand"]').check();
      assertEqual(await page.locator('html').getAttribute('data-taille'), 'grand');
      const grandPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      assert(grandPx > normalPx, `Expected grand font-size (${grandPx}) > normal (${normalPx})`);

      await page.locator('input[name="reglage-taille"][value="tresgrand"]').check();
      assertEqual(await page.locator('html').getAttribute('data-taille'), 'tresgrand');
      assertEqual(await page.evaluate(() => localStorage.getItem('omnianimaux_taille')), 'tresgrand');
      const tresGrandPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      assert(tresGrandPx > grandPx, `Expected tresgrand font-size (${tresGrandPx}) > grand (${grandPx})`);

      await reloadApp(page);
      assertEqual(await page.locator('html').getAttribute('data-taille'), 'tresgrand');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-03',
    feature: 'E2E-F14',
    title: 'Navigate all 4 bottom tabs updates aria-current, visible view, and URL hash',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const tabs = [
        { onglet: 'rappels', hash: '#rappels' },
        { onglet: 'veterinaires', hash: '#veterinaires' },
        { onglet: 'reglages', hash: '#reglages' },
        { onglet: 'accueil', hash: '#accueil' },
      ];
      for (const t of tabs) {
        await goTab(page, t.onglet);
        assertEqual(await page.locator(`#barre-nav button[data-onglet="${t.onglet}"]`).getAttribute('aria-current'), 'page');
        assertEqual(new URL(page.url()).hash, t.hash);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-04',
    feature: 'E2E-F14',
    title: 'Deep navigation, Retour button, À propos view, and browser goBack history',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Atlas', espece: 'Chien' });
      await openPet(page, 'Atlas');
      await openGarde(page);

      await page.locator('.vue[data-vue="garde"] [data-action="retour"]').click();
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });

      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'À propos d’Omni-Animalia', exact: true }).click();
      await page.locator('.vue[data-vue="apropos"]:not([hidden])').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#numero-version').textContent(), 'Version');

      await page.goBack();
      await page.locator('.vue[data-vue="reglages"]:not([hidden])').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-05',
    feature: 'E2E-F14',
    title: 'Direct hash URL navigation opens #veterinaires and #animal/<id>/vaccins directly',
    run: async ({ page, baseUrl, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Félix', espece: 'Chat' });
      await openPet(page, 'Félix', 'vaccins');
      const petVaccinsHash = new URL(page.url()).hash;
      assertMatch(petVaccinsHash, /^#animal\/[^/]+\/vaccins$/);

      await page.goto(`${baseUrl}#veterinaires`, { waitUntil: 'domcontentloaded' });
      await page.locator('#chargement').waitFor({ state: 'hidden' });
      await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible' });

      await page.goto(`${baseUrl}${petVaccinsHash}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#chargement').waitFor({ state: 'hidden' });
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-sections button[data-section="vaccins"]').getAttribute('aria-current'), 'true');
      assertIncludes(await page.locator('#animal-titre').textContent(), 'Félix');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F15: Print View (#carnet), Basic Offline/SW Readiness & Clear #carnet
     ========================================================================= */
  {
    id: 'E2E-F15-01',
    feature: 'E2E-F15',
    title: 'Health booklet print populates #carnet and print media toggles visibility',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await openPet(page, 'Biscuit (exemple)');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();
      await page.locator('#carnet header.carnet-entete').waitFor({ state: 'attached' });

      const screenCarnetDisplay = await page.locator('#carnet').evaluate((el) => getComputedStyle(el).display);
      assertEqual(screenCarnetDisplay, 'none', '#carnet must stay hidden in screen media');

      const carnetText = await page.locator('#carnet').textContent();
      assertIncludes(carnetText, 'Carnet de santé');
      assertIncludes(carnetText, 'Biscuit (exemple)');
      assertIncludes(carnetText, 'Vaccins');
      assertIncludes(carnetText, 'Rendez-vous vétérinaires');
      assert(await page.locator('#carnet footer.carnet-pied').count() === 1, 'Footer present in #carnet');

      await page.emulateMedia({ media: 'print' });
      const printCarnetDisplay = await page.locator('#carnet').evaluate((el) => getComputedStyle(el).display);
      const printMainDisplay = await page.locator('#principal').evaluate((el) => getComputedStyle(el).display);
      assertEqual(printCarnetDisplay, 'block', '#carnet visible in print media');
      assertEqual(printMainDisplay, 'none', '#principal hidden in print media');
      await page.emulateMedia({ media: 'screen' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-02',
    feature: 'E2E-F15',
    title: 'Care sheet print populates #carnet .fiche-garde and renders in print media',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await loadDemoData(page);
      await openPet(page, 'Moka (exemple)');
      await openGarde(page);

      await page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).click();
      await page.locator('#carnet .fiche-garde').waitFor({ state: 'attached' });
      assertIncludes(await page.locator('#carnet .fiche-garde').textContent(), 'Moka (exemple)');

      await page.emulateMedia({ media: 'print' });
      assertEqual(await page.locator('#carnet').evaluate((el) => getComputedStyle(el).display), 'block');
      assertEqual(await page.locator('#principal').evaluate((el) => getComputedStyle(el).display), 'none');
      await page.emulateMedia({ media: 'screen' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-03',
    feature: 'E2E-F15',
    title: 'Service Worker activates and precaches index.html and app.js in omni-animalia-* cache',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const swInfo = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        const cacheKeys = await caches.keys();
        const omniKey = cacheKeys.find((k) => k.startsWith('omni-animalia-'));
        let cachedPaths = [];
        if (omniKey) {
          const cache = await caches.open(omniKey);
          const reqs = await cache.keys();
          cachedPaths = reqs.map((r) => new URL(r.url).pathname);
        }
        return {
          hasActive: !!(reg && reg.active),
          scope: reg ? reg.scope : '',
          omniKey: omniKey || '',
          cachedPaths,
        };
      });

      assertTruthy(swInfo.hasActive, 'Service worker must be active');
      assertMatch(swInfo.omniKey, /^omni-animalia-/, 'Cache name prefix');
      assert(swInfo.cachedPaths.some((p) => p.endsWith('/index.html')), 'index.html cached');
      assert(swInfo.cachedPaths.some((p) => p.endsWith('/app.js')), 'app.js cached');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-04',
    feature: 'E2E-F15',
    title: 'App boots offline from Service Worker cache and displays persisted pet data',
    run: async ({ page, context, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'HorsLigne', espece: 'Chien' });
      await page.evaluate(() => navigator.serviceWorker.ready);
      // Reload once online so SW claims and controls the page
      await reloadApp(page);
      const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
      assertTruthy(controlled, 'Page controlled by SW after online reload');

      await context.setOffline(true);
      await reloadApp(page);
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'HorsLigne');
      await context.setOffline(false);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-05',
    feature: 'E2E-F15',
    title: 'Clear #carnet DOM and restore document.title after print (afterprint)',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Étoile', espece: 'Chat' });
      await openPet(page, 'Étoile');
      const titleBefore = await page.title();

      await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();
      await page.locator('#carnet header.carnet-entete').waitFor({ state: 'attached' });
      assertEqual(await page.locator('#carnet').evaluate((el) => getComputedStyle(el).display), 'none', 'Hidden in screen mode');

      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await page.waitForTimeout(100);

      const remainingChildren = await page.locator('#carnet').evaluate((el) => el.children.length);
      assertEqual(remainingChildren, 0, '#carnet must be cleared after print (afterprint)');
      assertEqual(await page.title(), titleBefore, 'document.title restored after print');
      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 1,
  name: 'Tier 1 — Feature Coverage',
  tests,
};
