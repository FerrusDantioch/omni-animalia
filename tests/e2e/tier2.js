/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 2 — Boundaries, Corner Cases, Stability, Offline/Network Recovery & PWA Precache
   (>= 80 opaque-box tests, >= 5 per feature across E2E-F1..E2E-F15) */
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
  waitForSwReady,
  ensureSwControlled,
  setOfflineWithSw,
  getCachedPaths,
  assertFieldError,
  uploadFileBuffer,
  uploadJsonImport,
  rapidDoubleClick,
  withPrintStub,
  probePrintView,
  waitForIdbSetting,
} = require('./helpers');

/* ---------- Local Opaque-Box UI Helpers ---------- */

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
  if (data.nom !== undefined) {
    await page.locator('#vetos-liste .carte-fiche .carte-titre').filter({ hasText: data.nom.trim() }).first().waitFor({ state: 'visible' });
  }
}

async function submitAnimalForm(page, expectedHeading) {
  const prevHeading = (await page.locator('#animal-contenu h2').count()) > 0
    ? await page.locator('#animal-contenu h2').first().elementHandle().catch(() => null)
    : null;
  try {
    await submitForm(page);
    await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
    if (prevHeading) {
      await page.waitForFunction((el) => !el.isConnected, prevHeading, { timeout: 10000 });
    }
  } finally {
    if (prevHeading) await prevHeading.dispose().catch(() => {});
  }
  if (expectedHeading) {
    await page.locator('#animal-contenu h2').filter({ hasText: expectedHeading }).waitFor({ state: 'visible' });
  } else {
    await page.locator('#animal-contenu h2').waitFor({ state: 'visible' });
  }
}

async function addWeighIn(page, { date, valeur, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (valeur !== undefined) await page.locator('#champ-valeur').fill(String(valeur));
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Poids');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
}

async function addVaccine(page, { nom, date, rappel, veterinaire, lot, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un vaccin', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (nom !== undefined) await page.locator('#champ-nom').fill(nom);
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (rappel !== undefined) await page.locator('#champ-rappel').fill(rappel);
  if (veterinaire !== undefined) await page.locator('#champ-veterinaire').fill(veterinaire);
  if (lot !== undefined) await page.locator('#champ-lot').fill(lot);
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Vaccins');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
}

async function addAntiparasitic(page, { type, produit, date, prochaine, dose, note } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une prise', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (type !== undefined) await page.locator(`[data-champ="type"] input[type="radio"][value="${type}"]`).check();
  if (produit !== undefined) await page.locator('#champ-produit').fill(produit);
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (prochaine !== undefined) await page.locator('#champ-prochaine').fill(prochaine);
  if (dose !== undefined) await page.locator('#champ-dose').fill(dose);
  if (note !== undefined) await page.locator('#champ-note').fill(note);
  await submitAnimalForm(page, 'Vermifuges et antiparasitaires');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
}

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
  await submitAnimalForm(page, 'Traitements et médicaments');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
}

async function addAppointment(page, { date, heure, motif, veterinaire, compteRendu, cout } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (heure !== undefined) await page.locator('#champ-heure').fill(heure);
  if (motif !== undefined) await page.locator('#champ-motif').fill(motif);
  if (veterinaire !== undefined) await page.locator('#champ-veterinaire').fill(veterinaire);
  if (compteRendu !== undefined) await page.locator('#champ-compteRendu').fill(compteRendu);
  if (cout !== undefined) await page.locator('#champ-cout').fill(String(cout));
  await submitAnimalForm(page, 'Rendez-vous vétérinaires');
  await page.locator('#animal-contenu h3.sous-titre').first().waitFor({ state: 'visible' });
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
}

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
  await submitAnimalForm(page, 'Choses à faire');
  await page.locator('#animal-contenu h3.sous-titre').first().waitFor({ state: 'visible' });
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
}

async function addNote(page, { date, categorie, texte, withDocument } = {}) {
  await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  if (date !== undefined) await page.locator('#champ-date').fill(date);
  if (categorie !== undefined) await page.locator('#champ-categorie').selectOption(categorie);
  if (texte !== undefined) await page.locator('#champ-texte').fill(texte);
  if (withDocument) {
    const fileInput = page.locator('[data-champ="pieces"] input[type="file"]:not([capture])');
    await uploadSamplePng(page, fileInput, 'doc.png', '[data-champ="pieces"] .aide', 'Document ajouté');
  }
  await submitAnimalForm(page, 'Notes de santé');
  await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
}

async function activatePassword(page, password) {
  await goTab(page, 'reglages');
  await page.locator('#reglages-contenu').getByRole('button', { name: 'Activer un mot de passe', exact: true }).click();
  await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
  await page.locator('#champ-nouveau').fill(password);
  await page.locator('#champ-confirmation').fill(password);
  await submitForm(page);
  await page.locator('.vue[data-vue="reglages"]:not([hidden])').waitFor({ state: 'visible' });
  await page.locator('#reglages-contenu').filter({ hasText: 'Le verrouillage par mot de passe est activé.' }).waitFor({ state: 'visible' });
}

async function restoreBackupReplace(page, filename, contentOrObj) {
  await uploadJsonImport(page, filename, contentOrObj);
  await confirmDialog(page, 'Remplacer', { expectNextDialog: true });
  await confirmDialog(page, 'Remplacer');
  await page.locator('#annonce').filter({ hasText: 'Restauration terminée' }).waitFor({ state: 'visible', timeout: 10000 });
}

const tests = [
  /* =========================================================================
     E2E-F1: Pet Profile CRUD & Archive Boundaries (6 tests)
     ========================================================================= */
  {
    id: 'E2E-F1-T2-01',
    feature: 'E2E-F1',
    title: 'Reject empty and whitespace-only pet name, clear aria-invalid on input, and trim saved name',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'nom', 'Ce champ est obligatoire.');

      await page.locator('#champ-nom').fill('   \t\n  ');
      assertEqual(await page.locator('#champ-nom').getAttribute('aria-invalid'), null, 'aria-invalid cleared on input');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'nom', 'Ce champ est obligatoire.');

      await page.locator('#champ-nom').fill('  Praline  ');
      await submitForm(page);
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#accueil-liste .carte-animal .carte-titre').filter({ hasText: 'Praline' }).first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#accueil-liste .carte-animal .carte-titre').first().textContent(), 'Praline');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-T2-02',
    feature: 'E2E-F1',
    title: 'Reject future birth date, out-of-range dates, and sterilization before birth; ignore hidden visibleSi error',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Simba');

      await page.locator('#champ-naissance').fill(isoDateOffset(1));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'naissance', 'Cette date ne peut pas être dans le futur.');

      await page.locator('#champ-naissance').fill('1899-12-31');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'naissance', 'Cette date n’est pas valide.');

      await page.locator('#champ-naissance').fill('2201-01-01');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'naissance', 'Cette date n’est pas valide.');

      const birth = isoDateOffset(-100);
      const beforeBirth = isoDateOffset(-200);
      await page.locator('#champ-naissance').fill(birth);
      await page.locator('#champ-sterilise').check();
      await page.locator('#champ-dateSterilisation').waitFor({ state: 'visible' });
      await page.locator('#champ-dateSterilisation').fill(beforeBirth);
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'dateSterilisation', 'La stérilisation ne peut pas être avant la naissance.');

      await page.locator('#champ-sterilise').uncheck();
      assertEqual(await page.locator('[data-champ="dateSterilisation"]').evaluate((el) => el.hidden), true);
      await submitForm(page);
      await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Simba' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Simba');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-T2-03',
    feature: 'E2E-F1',
    title: 'Reject invalid microchip/tattoo chars, cap overly long pet name, and normalize microchip spaces',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      const overLong = 'A'.repeat(150);
      await page.locator('#champ-nom').fill(overLong);
      const actualName = await page.locator('#champ-nom').inputValue();
      assertEqual(actualName.length, 80, 'Name field enforces maxlength 80');

      await page.locator('#champ-puce').fill('@!#123');
      await page.locator('#champ-tatouage').fill('TAT$%');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'puce', 'Seuls les chiffres, lettres, espaces et tirets sont acceptés.');
      await assertFieldError(page, 'tatouage', 'Seuls les chiffres, lettres, espaces et tirets sont acceptés.');

      await page.locator('#champ-nom').fill('Rex');
      await page.locator('#champ-puce').fill('250  2696  001');
      await page.locator('#champ-tatouage').fill('ABC-123');
      await submitForm(page);

      await openPet(page, 'Rex');
      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, '250 2696 001');
      assertIncludes(text, 'ABC-123');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-T2-04',
    feature: 'E2E-F1',
    title: 'Reject unsupported/SVG/corrupt pet photos and downscale oversized PNG to JPEG',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Pixel');

      const fileInput = page.locator('[data-champ="photo"] input[type="file"]:not([capture])');
      const statusZone = page.locator('[data-champ="photo"] .aide');

      await uploadFileBuffer(page, fileInput, {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hello world', 'utf8'),
      });
      await statusZone.filter({ hasText: 'Ce fichier n’est pas une image prise en charge' }).waitFor({ state: 'visible' });

      await uploadFileBuffer(page, fileInput, {
        name: 'vector.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf8'),
      });
      await statusZone.filter({ hasText: 'Ce fichier n’est pas une image prise en charge' }).waitFor({ state: 'visible' });

      await uploadFileBuffer(page, fileInput, {
        name: 'broken.png',
        mimeType: 'image/png',
        buffer: createCorruptPngBuffer(),
      });
      await statusZone.filter({ hasText: 'Cette image n’a pas pu être lue' }).waitFor({ state: 'visible' });

      const bigPng = createSamplePngBuffer(1400, 1000);
      await uploadFileBuffer(page, fileInput, {
        name: 'large.png',
        mimeType: 'image/png',
        buffer: bigPng,
      });
      await statusZone.filter({ hasText: 'Photo prête' }).waitFor({ state: 'visible' });

      await submitForm(page);
      const src = await page.locator('#accueil-liste .carte-animal img.vignette').getAttribute('src');
      assertMatch(src, /^data:image\/jpeg;base64,/, 'Converted JPEG photo data URL');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-T2-05',
    feature: 'E2E-F1',
    title: 'Prevent duplicate pet on rapid double-click submit and test archive motif/future-date boundaries',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Unique');
      const submitBtn = page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]');
      await rapidDoubleClick(submitBtn);
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Unique' }).first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 1, 'Only 1 pet created on double-click');

      await openPet(page, 'Unique');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('[data-champ="motif"] input[value="autre"]').check();
      await page.locator('#champ-precision').waitFor({ state: 'visible' });
      await page.locator('#champ-dateArchive').fill(isoDateOffset(1));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'dateArchive', 'Cette date ne peut pas être dans le futur.');

      await page.locator('#champ-dateArchive').fill(isoDateOffset(0));
      await submitForm(page);
      await page.locator('#animal-resume .encart.attention').filter({ hasText: 'Animal archivé' }).waitFor({ state: 'visible' });
      await goTab(page, 'accueil');
      await page.locator('#accueil-actions').getByRole('button', { name: /Animaux archivés/ }).click();
      await page.locator('.vue[data-vue="archives"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#archives-liste').filter({ hasText: 'Motif : autre raison' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#archives-liste').textContent(), 'Motif : autre raison');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F1-T2-06',
    feature: 'E2E-F1',
    title: 'Reject archive date earlier than pet birth date without archiving pet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const birth = isoDateOffset(-30);
      await createPet(page, { nom: 'Bambou', espece: 'Lapin', naissance: birth });
      await openPet(page, 'Bambou');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('[data-champ="motif"] input[value="confié"]').check();
      await page.locator('#champ-dateArchive').fill(isoDateOffset(-60));
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('#formulaire-erreurs:not([hidden]), #annonce.erreur:not([hidden]), .vue[data-vue="animal"]:not([hidden])').first().waitFor({ state: 'visible', timeout: 5000 });

      // Form must remain open and an error (inline or toast) must be shown; pet stays active
      assertEqual(await page.locator('.vue[data-vue="formulaire"]').evaluate((el) => el.hidden), false, 'Archive form stays open on dateArchive < naissance');
      const inlineVisible = await page.locator('#formulaire-erreurs').evaluate((el) => !el.hidden);
      const toastVisible = await page.locator('#annonce').evaluate((el) => el.classList.contains('erreur') && !el.hidden && el.textContent.trim().length > 0).catch(() => false);
      assert(inlineVisible || toastVisible, 'Error message shown when archive date precedes birth');

      await page.locator('.formulaire-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();
      await goTab(page, 'accueil');
      await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Bambou' }).first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 1, 'Pet remains active');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F2: Weigh-ins & SVG Weight Chart Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F2-T2-01',
    feature: 'E2E-F2',
    title: 'Reject 0, negative, non-numeric, and > max weights; accept 0,001 kg (1g)',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Coco', unitePoids: 'kg' });
      await openPet(page, 'Coco', 'poids');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-valeur').fill('abc');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'valeur', 'Tape un nombre');

      await page.locator('#champ-valeur').fill('0');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'valeur', 'Le nombre doit être plus grand que zéro.');

      await page.locator('#champ-valeur').fill('-3.5');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'valeur', 'Le nombre doit être plus grand que zéro.');

      await page.locator('#champ-valeur').fill('3001');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'valeur', 'Le nombre est trop grand');

      await page.locator('#champ-valeur').fill('0,001');
      await submitForm(page);
      assertIncludes(await page.locator('#animal-contenu .chiffre-cle').textContent(), '0 kg');
      assertIncludes(await page.locator('#animal-contenu .carte-fiche').first().textContent(), '0 kg');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-T2-02',
    feature: 'E2E-F2',
    title: 'Reject future and out-of-range weigh-in dates; accept 1900-01-01 lower boundary',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Dune', unitePoids: 'kg' });
      await openPet(page, 'Dune', 'poids');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une pesée', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-valeur').fill('5');

      await page.locator('#champ-date').fill(isoDateOffset(1));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'date', 'Cette date ne peut pas être dans le futur.');

      await page.locator('#champ-date').fill('1899-12-31');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'date', 'Cette date n’est pas valide.');

      await page.locator('#champ-date').fill('2201-01-01');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'date', 'Cette date n’est pas valide.');

      await page.locator('#champ-date').fill('1900-01-01');
      await submitForm(page);
      await page.locator('#animal-contenu').filter({ hasText: '01/01/1900' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), '01/01/1900');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-T2-03',
    feature: 'E2E-F2',
    title: 'Render SVG chart cleanly for multiple weigh-ins on the same day without NaN',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bulle', unitePoids: 'kg' });
      await openPet(page, 'Bulle', 'poids');
      const d = isoDateOffset(0);
      await addWeighIn(page, { date: d, valeur: '4,0' });
      await addWeighIn(page, { date: d, valeur: '4,2' });
      await addWeighIn(page, { date: d, valeur: '4,5' });

      const svgInfo = await page.locator('svg.graphique').evaluate((svg) => {
        const circles = [...svg.querySelectorAll('circle.point')].map((c) => ({
          cx: c.getAttribute('cx'),
          cy: c.getAttribute('cy'),
        }));
        const poly = svg.querySelector('polyline.courbe');
        return {
          circles,
          points: poly ? poly.getAttribute('points') : '',
          ariaLabel: svg.getAttribute('aria-label') || '',
        };
      });

      assertEqual(svgInfo.circles.length, 3, 'All 3 same-day points rendered');
      for (const c of svgInfo.circles) {
        assert(Number.isFinite(Number(c.cx)) && Number.isFinite(Number(c.cy)), `Finite coords: ${JSON.stringify(c)}`);
      }
      assert(!svgInfo.points.includes('NaN'), `Polyline has no NaN: ${svgInfo.points}`);
      assertIncludes(svgInfo.ariaLabel, '3 pesées');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-T2-04',
    feature: 'E2E-F2',
    title: 'Small-gram adaptive y-axis decimals (no duplicate labels) and equal-weight plateau handling',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Pippin', unitePoids: 'g' });
      await openPet(page, 'Pippin', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-3), valeur: '12' });
      await addWeighIn(page, { date: isoDateOffset(-2), valeur: '12,5' });
      await addWeighIn(page, { date: isoDateOffset(-1), valeur: '13' });

      const yLabels = await page.locator('svg.graphique text.legende[text-anchor="end"]:not([y="210"])').allTextContents();
      assertEqual(yLabels.length, 4, '4 y-axis labels');
      assertEqual(new Set(yLabels).size, 4, `Distinct y-axis labels expected, got ${JSON.stringify(yLabels)}`);

      // Equal weight plateau
      await createPet(page, { nom: 'Stable', unitePoids: 'kg' });
      await openPet(page, 'Stable', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-5), valeur: '10' });
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '10' });
      await page.locator('#animal-contenu').filter({ hasText: 'inchangé' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'inchangé');
      const plateauCoords = await page.locator('svg.graphique circle.point').evaluateAll((els) =>
        els.map((e) => [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))])
      );
      assertEqual(plateauCoords.length, 2);
      assert(plateauCoords.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), 'Valid plateau coords');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F2-T2-05',
    feature: 'E2E-F2',
    title: 'Extreme high weight (2999 kg) renders SVG cleanly with expanded left margin and no NaN/Infinity',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Titan', espece: 'Cheval', unitePoids: 'kg' });
      await openPet(page, 'Titan', 'poids');
      await addWeighIn(page, { date: isoDateOffset(-1), valeur: '2999' });
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '2999,5' });

      const svgCheck = await page.locator('svg.graphique').evaluate((svg) => {
        const line = svg.querySelector('line.repere');
        const x1 = line ? Number(line.getAttribute('x1')) : 0;
        const poly = svg.querySelector('polyline.courbe').getAttribute('points');
        return { x1, poly, text: svg.textContent };
      });
      assert(svgCheck.x1 >= 56, `Expanded left margin (${svgCheck.x1})`);
      assert(!/NaN|Infinity/.test(svgCheck.poly), 'No NaN/Infinity in extreme weight polyline');
      assertIncludes(await page.locator('#animal-contenu .chiffre-cle').textContent(), '2 999,5');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F3: Vaccines Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F3-T2-01',
    feature: 'E2E-F3',
    title: 'Reject empty and whitespace-only vaccine name and missing required vaccination date',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Léo', espece: 'Chat' });
      await openPet(page, 'Léo', 'vaccins');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un vaccin', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-nom').fill('   \t ');
      await page.locator('#champ-date').fill('');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'nom', 'Ce champ est obligatoire.');
      await assertFieldError(page, 'date', 'Ce champ est obligatoire.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-T2-02',
    feature: 'E2E-F3',
    title: 'Reject future vaccination date and rappel <= date (equal and earlier)',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Milo', espece: 'Chien' });
      await openPet(page, 'Milo', 'vaccins');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un vaccin', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Rage');

      await page.locator('#champ-date').fill(isoDateOffset(1));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'date', 'Cette date ne peut pas être dans le futur.');

      const d = isoDateOffset(-10);
      await page.locator('#champ-date').fill(d);
      await page.locator('#champ-rappel').fill(d);
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'rappel', 'Le rappel doit être après la date de vaccination.');

      await page.locator('#champ-rappel').fill(isoDateOffset(-20));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'rappel', 'Le rappel doit être après la date de vaccination.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-T2-03',
    feature: 'E2E-F3',
    title: 'Save vaccine with empty optional rappel omits Prochain rappel and creates no reminder',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Néo', espece: 'Chien' });
      await openPet(page, 'Néo', 'vaccins');
      await addVaccine(page, { nom: 'Toux du chenil', date: isoDateOffset(-5), rappel: '' });

      const cardText = await page.locator('#animal-contenu .carte-fiche').first().textContent();
      assertIncludes(cardText, 'Toux du chenil');
      assert(!cardText.includes('Prochain rappel'), 'No Prochain rappel line when rappel omitted');
      await goTab(page, 'rappels');
      await page.locator('#rappels-liste .groupe-rappels, #rappels-liste .encart.vide').first().waitFor({ state: 'visible' });
      assert(!((await page.locator('#rappels-liste').textContent()).includes('Toux du chenil')), 'No reminder created');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-T2-04',
    feature: 'E2E-F3',
    title: 'Same-day vaccine renewal marks only one active and updates reminder cleanly',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Odin', espece: 'Chien' });
      await openPet(page, 'Odin', 'vaccins');
      const today = isoDateOffset(0);
      await addVaccine(page, { nom: 'CHPPiL', date: today, rappel: isoDateOffset(30) });
      await addVaccine(page, { nom: 'chppil', date: today, rappel: isoDateOffset(365) });

      await page.locator('#animal-contenu').filter({ hasText: '(déjà renouvelé)' }).waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 2);
      assertEqual(
        await page.locator('#animal-contenu').getByRole('button', { name: 'Noter le rappel fait', exact: true }).count(),
        1,
        'Only one active Noter le rappel fait button'
      );
      assertIncludes(await page.locator('#animal-contenu').textContent(), '(déjà renouvelé)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F3-T2-05',
    feature: 'E2E-F3',
    title: 'Accept upper date boundary 2200-12-31 for rappel and reject 2201-01-01',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Goliath', espece: 'Tortue' });
      await openPet(page, 'Goliath', 'vaccins');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un vaccin', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Herpès');
      await page.locator('#champ-date').fill(isoDateOffset(0));

      await page.locator('#champ-rappel').fill('2201-01-01');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'rappel', 'Cette date n’est pas valide.');

      await page.locator('#champ-rappel').fill('2200-12-31');
      await submitForm(page);
      await page.locator('#animal-contenu').filter({ hasText: '31/12/2200' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), '31/12/2200');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F4: Antiparasitics Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F4-T2-01',
    feature: 'E2E-F4',
    title: 'Missing required antiparasitic type sets aria-invalid on fieldset and radios, clears on selection',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Sissi', espece: 'Chat' });
      await openPet(page, 'Sissi', 'antiparasitaires');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une prise', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'type', 'Choisis une réponse.', { isRadio: true });

      await page.locator('[data-champ="type"] input[value="vermifuge"]').check();
      assertEqual(await page.locator('[data-champ="type"] fieldset').getAttribute('aria-invalid'), null);
      await submitForm(page);
      await page.locator('#animal-contenu').filter({ hasText: 'Vermifuge' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Vermifuge');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-T2-02',
    feature: 'E2E-F4',
    title: 'Reject future antiparasitic date and prochaine <= date',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bibi', espece: 'Chien' });
      await openPet(page, 'Bibi', 'antiparasitaires');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une prise', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="type"] input[value="anti-tiques"]').check();

      await page.locator('#champ-date').fill(isoDateOffset(1));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'date', 'Cette date ne peut pas être dans le futur.');

      const d = isoDateOffset(-5);
      await page.locator('#champ-date').fill(d);
      await page.locator('#champ-prochaine').fill(d);
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'prochaine', 'La prochaine prise doit être après celle-ci.');

      await page.locator('#champ-prochaine').fill(isoDateOffset(-10));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'prochaine', 'La prochaine prise doit être après celle-ci.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-T2-03',
    feature: 'E2E-F4',
    title: 'Group type "autre" by produit name (case-insensitive) keeping distinct products independently active',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Kiki', espece: 'Chien' });
      await openPet(page, 'Kiki', 'antiparasitaires');
      await addAntiparasitic(page, {
        type: 'autre',
        produit: 'Collier Seresto',
        date: isoDateOffset(-10),
        prochaine: isoDateOffset(20),
      });
      await addAntiparasitic(page, {
        type: 'autre',
        produit: 'Anti-moustique',
        date: isoDateOffset(-5),
        prochaine: isoDateOffset(15),
      });
      assertEqual(
        await page.locator('#animal-contenu').getByRole('button', { name: 'Noter la prise suivante', exact: true }).count(),
        2,
        'Both distinct "autre" products stay active'
      );

      await addAntiparasitic(page, {
        type: 'autre',
        produit: '  collier seresto ',
        date: isoDateOffset(-1),
        prochaine: isoDateOffset(180),
      });
      assertEqual(
        await page.locator('#animal-contenu').getByRole('button', { name: 'Noter la prise suivante', exact: true }).count(),
        2,
        'Same-product renewal supersedes older one'
      );
      assertIncludes(await page.locator('#animal-contenu').textContent(), '(déjà faite)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-T2-04',
    feature: 'E2E-F4',
    title: 'Save antiparasitic with empty optional produit, prochaine, and dose without errors or reminders',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Roxy', espece: 'Chat' });
      await openPet(page, 'Roxy', 'antiparasitaires');
      await addAntiparasitic(page, { type: 'anti-puces', date: isoDateOffset(-2), produit: '', prochaine: '', dose: '' });

      const text = await page.locator('#animal-contenu .carte-fiche').first().textContent();
      assertIncludes(text, 'Anti-puces');
      assert(!text.includes('Prochaine prise'), 'No Prochaine prise line');
      await goTab(page, 'rappels');
      await page.locator('#rappels-liste .groupe-rappels, #rappels-liste .encart.vide').first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#nav-pastille').evaluate((el) => el.hidden), true, 'Badge stays hidden');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F4-T2-05',
    feature: 'E2E-F4',
    title: 'Same-day antiparasitic renewal marks older entry as déjà faite',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Gipsy', espece: 'Chien' });
      await openPet(page, 'Gipsy', 'antiparasitaires');
      const d = isoDateOffset(0);
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: d, prochaine: isoDateOffset(30) });
      await addAntiparasitic(page, { type: 'vermifuge', produit: 'Drontal', date: d, prochaine: isoDateOffset(90) });

      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 2);
      assertEqual(
        await page.locator('#animal-contenu').getByRole('button', { name: 'Noter la prise suivante', exact: true }).count(),
        1
      );
      assertIncludes(await page.locator('#animal-contenu').textContent(), '(déjà faite)');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F5: Treatments & Daily Doses Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F5-T2-01',
    feature: 'E2E-F5',
    title: 'Reject whitespace-only treatment name, missing statut, and fin < debut',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Lola', espece: 'Chat' });
      await openPet(page, 'Lola', 'traitements');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un traitement', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-nom').fill('   ');
      await page.locator('#champ-debut').fill(isoDateOffset(0));
      await page.locator('#champ-fin').fill(isoDateOffset(-3));
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'nom', 'Ce champ est obligatoire.');
      await assertFieldError(page, 'fin', 'La fin ne peut pas être avant le début.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-T2-02',
    feature: 'E2E-F5',
    title: 'Enforce prisesParJour bounds (reject 0, -1, 1.5, 25, non-numeric; accept 1 and 24)',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Ziggy', espece: 'Chien' });
      await openPet(page, 'Ziggy', 'traitements');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un traitement', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Gouttes');

      for (const [val, expectedErr] of [
        ['abc', 'Tape un nombre'],
        ['0', 'Le nombre doit être plus grand que zéro.'],
        ['-1', 'Le nombre doit être plus grand que zéro.'],
        ['1,5', 'Tape un nombre entier'],
        ['25', 'Le nombre est trop grand'],
      ]) {
        await page.locator('#champ-prisesParJour').fill(val);
        await submitForm(page, { expectErrors: true });
        await assertFieldError(page, 'prisesParJour', expectedErr);
      }

      await page.locator('#champ-prisesParJour').fill('24');
      await submitForm(page);
      await page.locator('#animal-contenu').filter({ hasText: 'Prises par jour : 24' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Prises par jour : 24');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-T2-03',
    feature: 'E2E-F5',
    title: 'Cancel extra-dose confirmation and cancel undo-dose confirmation leave dose count unchanged',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Toby', espece: 'Chien' });
      await openPet(page, 'Toby', 'traitements');
      await addTreatment(page, { nom: 'Antibio', prisesParJour: 1, debut: isoDateOffset(0), statut: 'en-cours' });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await page.locator('.encart.prises.complet').waitFor({ state: 'visible' });

      // Cancel extra-dose dialog
      await page.locator('#animal-contenu').getByRole('button', { name: 'Noter une prise maintenant', exact: true }).click();
      await confirmDialog(page, 'Ne rien noter');
      assertIncludes(await page.locator('.encart.prises').textContent(), '1 prise sur 1');

      // Cancel undo-dose dialog
      await page.locator('#animal-contenu').getByRole('button', { name: 'Annuler la dernière prise', exact: true }).click();
      await confirmDialog(page, 'Annuler');
      assertIncludes(await page.locator('.encart.prises').textContent(), '1 prise sur 1');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-T2-04',
    feature: 'E2E-F5',
    title: 'Mark finished on treatment with future fin clamps fin to today and clears Rappels',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Gaston', espece: 'Chat' });
      await openPet(page, 'Gaston', 'traitements');
      await addTreatment(page, {
        nom: 'Corticoïde',
        prisesParJour: 2,
        debut: isoDateOffset(-2),
        fin: isoDateOffset(20),
        statut: 'en-cours',
      });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer terminé', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });
      const text = await page.locator('#animal-contenu').textContent();
      assertIncludes(text, 'Terminés (1)');
      assertIncludes(text, `Fin : ${frDate(isoDateOffset(0))}`);

      await goTab(page, 'rappels');
      await page.locator('#rappels-liste .groupe-rappels, #rappels-liste .encart.vide').first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('section.groupe-rappels.medicaments').count(), 0);
      assert(!((await page.locator('#rappels-liste').textContent()).includes('Corticoïde')), 'Finished treatment absent from Rappels');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F5-T2-05',
    feature: 'E2E-F5',
    title: 'Cancel treatment edit leaves record intact; clearing prisesParJour removes dose box',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Ruby', espece: 'Chien' });
      await openPet(page, 'Ruby', 'traitements');
      await addTreatment(page, { nom: 'Sirop', prisesParJour: 2, debut: isoDateOffset(0), statut: 'en-cours' });

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('AutreNomAbandonne');
      await page.locator('.formulaire-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#animal-contenu').filter({ hasText: 'Sirop' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Sirop');

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-prisesParJour').fill('');
      await submitAnimalForm(page, 'Traitements et médicaments');
      assertEqual(await page.locator('#animal-contenu .encart.prises').count(), 0, 'Dose tracker removed when prisesParJour cleared');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F6: Vet Appointments & Costs Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F6-T2-01',
    feature: 'E2E-F6',
    title: 'Reject missing date, whitespace-only motif, and invalid heure values (25:00, 12:60)',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Sam', espece: 'Chien' });
      await openPet(page, 'Sam', 'rdv');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-motif').fill('   \n ');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'date', 'Ce champ est obligatoire.');
      await assertFieldError(page, 'motif', 'Ce champ est obligatoire.');

      await page.locator('#champ-date').fill(isoDateOffset(2));
      await page.locator('#champ-motif').fill('Contrôle');
      // Native input[type="time"] ignores invalid strings unless switched via DOM to test JS validation
      await page.locator('#champ-heure').evaluate((el) => {
        el.type = 'text';
        el.value = '25:00';
      });
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'heure', 'Cette heure n’est pas valide');

      await page.locator('#champ-heure').evaluate((el) => { el.value = '12:60'; });
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'heure', 'Cette heure n’est pas valide');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-T2-02',
    feature: 'E2E-F6',
    title: 'Enforce appointment cost bounds (reject negative, > 1000000, NaN; accept 0 and 1000000)',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Jazz', espece: 'Chat' });
      await openPet(page, 'Jazz', 'rdv');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter un rendez-vous', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-date').fill(isoDateOffset(3));
      await page.locator('#champ-motif').fill('Consultation');

      await page.locator('#champ-cout').fill('-5');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'cout', 'Le nombre ne peut pas être négatif.');

      await page.locator('#champ-cout').fill('1000001');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'cout', 'Le nombre est trop grand');

      await page.locator('#champ-cout').fill('abc');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'cout', 'Tape un nombre');

      await page.locator('#champ-cout').fill('0');
      await submitForm(page);
      assertMatch(await page.locator('.encart.frais').textContent(), /0,00\s*€/);

      await addAppointment(page, { date: isoDateOffset(4), motif: 'Chirurgie', cout: '1000000' });
      await page.locator('#animal-contenu .encart.frais').filter({ hasText: '2 sur 2' }).waitFor({ state: 'visible' });
      assertMatch(await page.locator('.encart.frais').textContent(), /1[\s\u202f\u00a0]000[\s\u202f\u00a0]000,00\s*€/);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-T2-03',
    feature: 'E2E-F6',
    title: 'Export .ics handles 23:30 rollover, 2200-12-31 boundary, and escapes CRLF/special chars',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, {
        nom: 'Dr Durand',
        clinique: 'Clinique; Nord, Sud',
        adresse: '12 rue A\nBâtiment B',
      });
      await createPet(page, { nom: 'Kora', espece: 'Chien', vetoLabel: 'Dr Durand (Clinique; Nord, Sud)' });
      await openPet(page, 'Kora', 'rdv');
      await addAppointment(page, {
        date: '2200-12-31',
        heure: '23:30',
        motif: 'Visite; Spéciale\\Test',
        veterinaire: 'Dr Durand',
      });

      await goTab(page, 'rappels');
      await page.locator('#agenda-tout summary').click();
      const ics = await captureDownload(page, () => page.locator('#bouton-agenda-tout').click());
      const unfolded = ics.content.replace(/\r\n /g, '');
      assertIncludes(unfolded, 'DTSTART:22001231T233000');
      assertIncludes(unfolded, 'DTEND:22010101T003000');
      assertIncludes(unfolded, 'SUMMARY:Kora : Rendez-vous vétérinaire : Visite\\; Spéciale\\\\Test');
      assertIncludes(unfolded, 'LOCATION:Clinique\\; Nord\\, Sud\\, 12 rue A\\, Bâtiment B');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-T2-04',
    feature: 'E2E-F6',
    title: 'Upcoming appointment without time omits "à" time separator and appears in Rappels',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Nora', espece: 'Lapin' });
      await openPet(page, 'Nora', 'rdv');
      const d = isoDateOffset(2);
      await addAppointment(page, { date: d, motif: 'Griffes', heure: '' });

      const title = await page.locator('#animal-contenu .carte-fiche .carte-titre').first().textContent();
      assertEqual(title, `${frDate(d)} — Griffes`);
      await goTab(page, 'rappels');
      const weekSection = page.locator('section.groupe-rappels').filter({ has: page.locator('#rappels-semaine') });
      assertIncludes(await weekSection.textContent(), 'Griffes');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F6-T2-05',
    feature: 'E2E-F6',
    title: 'Past appointment cost counts in multi-year summary and adding compteRendu hides quick button',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Bounty', espece: 'Chien' });
      await openPet(page, 'Bounty', 'rdv');
      await addAppointment(page, { date: '2020-05-10', motif: 'Radio', cout: '80' });
      await addAppointment(page, { date: '2021-05-10', motif: 'Écho' });

      await page.locator('#animal-contenu .encart.frais').filter({ hasText: '1 sur 2' }).waitFor({ state: 'visible' });
      const fraisText = await page.locator('.encart.frais').textContent();
      assertIncludes(fraisText, '2020 :');
      assertIncludes(fraisText, '1 sur 2');

      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter le compte rendu', exact: true }).first().click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-compteRendu').fill('Tout va bien');
      await submitForm(page);
      await page.locator('#animal-contenu').filter({ hasText: 'Tout va bien' }).waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter le compte rendu', exact: true }).count(), 1);
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Tout va bien');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F7: Tasks & Recurrence Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F7-T2-01',
    feature: 'E2E-F7',
    title: 'Reject whitespace task titre, missing echeance when repeating, and invalid recN (0, 1.5, 1000)',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Oreo', espece: 'Chat' });
      await openPet(page, 'Oreo', 'taches');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-titre').fill('   ');
      await page.locator('#champ-echeance').fill('');
      await page.locator('[data-champ="repete"] input[value="oui"]').check();
      await page.locator('#champ-recN').fill('0');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'titre', 'Ce champ est obligatoire.');
      await assertFieldError(page, 'echeance', 'Indique une date : elle sert de point de départ à la répétition.');
      await assertFieldError(page, 'recN', 'Le nombre doit être plus grand que zéro.');

      await page.locator('#champ-titre').fill('Brosser');
      await page.locator('#champ-echeance').fill(isoDateOffset(0));
      await page.locator('#champ-recN').fill('1,5');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'recN', 'Tape un nombre entier');

      await page.locator('#champ-recN').fill('1000');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'recN', 'Le nombre est trop grand');

      await page.locator('#champ-recN').fill('');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'recN', 'Indique tous les combien');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-T2-02',
    feature: 'E2E-F7',
    title: 'Complete >15-year overdue recurring task in O(1) without hang and advance due date past today',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Mathusalem', espece: 'Tortue' });
      await openPet(page, 'Mathusalem', 'taches');
      await addTask(page, {
        titre: 'Nettoyer terrarium',
        echeance: '2005-01-15',
        repete: 'oui',
        recN: 1,
        recUnite: 'mois',
      });

      const t0 = Date.now();
      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible', timeout: 3000 });
      const elapsed = Date.now() - t0;
      assert(elapsed < 3000, `Expected fast O(1) recurrence jump, took ${elapsed}ms`);

      const nextCardText = await page.locator('#animal-contenu .carte-fiche:not(.termine)').first().textContent();
      assertIncludes(nextCardText, 'Échéance :');
      assert(!nextCardText.includes('en retard'), `Next recurring date should be > today: ${nextCardText}`);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-T2-03',
    feature: 'E2E-F7',
    title: 'Preserve month-end day-of-month anchor (31st) across leap/short months',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Janvier', espece: 'Chien' });
      await openPet(page, 'Janvier', 'taches');
      // Pick the most recent Jan 31 in the past or future that yields a predictable next 31st/28th/29th
      const currentYear = new Date().getFullYear();
      const targetYear = currentYear + 1;
      await addTask(page, {
        titre: 'Pesée mensuelle',
        echeance: `${targetYear}-01-31`,
        repete: 'oui',
        recN: 1,
        recUnite: 'mois',
      });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });
      const expectedFebLast = (targetYear % 4 === 0 && (targetYear % 100 !== 0 || targetYear % 400 === 0)) ? '29' : '28';
      const firstNextText = await page.locator('#animal-contenu .carte-fiche:not(.termine)').first().textContent();
      assertIncludes(firstNextText, `${expectedFebLast}/02/${targetYear}`);

      await page.locator('#animal-contenu .carte-fiche:not(.termine)').first().getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche:not(.termine)').filter({ hasText: `31/03/${targetYear}` }).waitFor({ state: 'visible' });
      const marchText = await page.locator('#animal-contenu .carte-fiche:not(.termine)').first().textContent();
      assertIncludes(marchText, `31/03/${targetYear}`);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-T2-04',
    feature: 'E2E-F7',
    title: 'Complete recurring task near 2200-12-31 upper boundary without crash or out-of-range error',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Futur', espece: 'Chat' });
      await openPet(page, 'Futur', 'taches');
      await addTask(page, {
        titre: 'Fin de siècle',
        echeance: '2200-12-25',
        repete: 'oui',
        recN: 14,
        recUnite: 'jours',
      });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#annonce').filter({ hasText: 'échéance au-delà de 2200' }).waitFor({ state: 'visible' });
      await page.locator('#animal-contenu').filter({ hasText: 'À faire (0)' }).waitFor({ state: 'visible' });
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });
      const content = await page.locator('#animal-contenu').textContent();
      assertIncludes(content, 'À faire (0)');
      assertIncludes(content, 'Tout est fait.');
      assertIncludes(content, 'Faites (1)');
      assertEqual(await page.locator('#animal-contenu .carte-fiche:not(.termine)').count(), 0, 'No orphan task created past 2200');
      assertEqual(await page.locator('#animal-contenu .carte-fiche.termine').count(), 1, 'Completed task shown in Faites');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F7-T2-05',
    feature: 'E2E-F7',
    title: 'One-off task without due date saves, completes, undoes, and creates no reminder',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Nuage', espece: 'Lapin' });
      await openPet(page, 'Nuage', 'taches');
      await addTask(page, { titre: 'Acheter foin', echeance: '', repete: 'non' });

      await page.locator('#animal-contenu').filter({ hasText: 'Échéance : aucune date' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Échéance : aucune date');
      await goTab(page, 'rappels');
      await page.locator('#rappels-liste .groupe-rappels, #rappels-liste .encart.vide').first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#nav-pastille').evaluate((el) => el.hidden), true);

      await openPet(page, 'Nuage', 'taches');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true }).click();
      await page.locator('#animal-contenu .carte-fiche.termine').waitFor({ state: 'visible' });
      await page.locator('#animal-contenu').getByRole('button', { name: 'Annuler « fait »', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: 'À faire (1)' }).waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu .carte-fiche.termine').count(), 0);
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'À faire (1)');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F8: Reminders & Badge Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F8-T2-01',
    feature: 'E2E-F8',
    title: 'Cap navigation badge at 99+ when > 99 overdue/today items exist while preserving exact aria-label',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const today = isoDateOffset(0);
      const taches = [];
      for (let i = 1; i <= 105; i++) {
        taches.push({
          id: `t-badge-${i}`,
          animalId: 'a-badge-1',
          titre: `Tâche ${i}`,
          echeance: today,
          fait: false,
        });
      }
      const backup = {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        donnees: {
          animaux: [{ id: 'a-badge-1', nom: 'CentCinq', unitePoids: 'kg', archive: false }],
          veterinaires: [],
          pesees: [],
          vaccins: [],
          antiparasitaires: [],
          traitements: [],
          rdv: [],
          notes: [],
          taches,
        },
      };
      await restoreBackupReplace(page, 'badge-105.json', backup);

      await page.locator('#nav-pastille:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#nav-pastille').textContent(), '99+');
      const aria = await page.locator('#barre-nav button[data-onglet="rappels"]').getAttribute('aria-label');
      assertIncludes(aria, '105');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-T2-02',
    feature: 'E2E-F8',
    title: 'Exclude archived pet from Rappels and badge, and restore reminders on unarchive',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Zéphyr', espece: 'Chien' });
      await openPet(page, 'Zéphyr', 'taches');
      await addTask(page, { titre: 'Collier antiparasitaire', echeance: isoDateOffset(-1), repete: 'non' });
      await page.locator('#nav-pastille:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#nav-pastille').textContent(), '1');

      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="confié"]').check();
      await submitForm(page);

      await page.locator('#nav-pastille[hidden]').waitFor({ state: 'attached', timeout: 10000 });
      assertEqual(await page.locator('#nav-pastille').evaluate((el) => el.hidden), true, 'Badge hidden when pet archived');
      await goTab(page, 'rappels');
      await page.locator('#rappels-liste').filter({ hasText: 'Aucun animal pour l’instant : aucun rappel.' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#rappels-liste').textContent(), 'Aucun animal pour l’instant : aucun rappel.');

      await goTab(page, 'accueil');
      await page.locator('#accueil-actions').getByRole('button', { name: /Animaux archivés/ }).click();
      await page.locator('.vue[data-vue="archives"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#archives-liste').getByRole('button', { name: 'Restaurer', exact: true }).click();
      await confirmDialog(page, 'Restaurer');

      await page.locator('#nav-pastille:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#nav-pastille').textContent(), '1');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-T2-03',
    feature: 'E2E-F8',
    title: 'Hide bulk ICS panel when only overdue items exist and show >30d summary for distant reminders',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Tempo', espece: 'Chat' });
      await openPet(page, 'Tempo', 'taches');
      await addTask(page, { titre: 'Tâche en retard', echeance: isoDateOffset(-2), repete: 'non' });

      await goTab(page, 'rappels');
      assertIncludes(await page.locator('#rappels-retard').textContent(), 'En retard (1)');
      assertEqual(await page.locator('#agenda-tout').count(), 0, 'Bulk ICS panel hidden when aVenir is empty');

      await openPet(page, 'Tempo', 'vaccins');
      await addVaccine(page, { nom: 'Rage', date: isoDateOffset(0), rappel: isoDateOffset(45) });

      await goTab(page, 'rappels');
      await page.locator('#rappels-liste').filter({ hasText: '1 autre(s) rappel(s) plus lointain(s)' }).waitFor({ state: 'visible' });
      assertEqual(await page.locator('#agenda-tout').count(), 1, 'Bulk ICS panel visible when >30d reminder exists');
      assertIncludes(await page.locator('#rappels-liste').textContent(), '1 autre(s) rappel(s) plus lointain(s)');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-T2-04',
    feature: 'E2E-F8',
    title: 'Sort same-day multi-store reminders deterministically across reloads',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Alpha', espece: 'Chien' });
      const d = isoDateOffset(3);
      await openPet(page, 'Alpha', 'rdv');
      await addAppointment(page, { date: d, heure: '16:00', motif: 'Après-midi' });
      await addAppointment(page, { date: d, heure: '09:00', motif: 'Matin' });
      await openAnimalSection(page, 'taches');
      await addTask(page, { titre: 'Tâche du jour', echeance: d, repete: 'non' });

      await goTab(page, 'rappels');
      await page.locator('section.groupe-rappels:has(#rappels-semaine) .carte-rappel').first().waitFor({ state: 'visible' });
      const order1 = await page.locator('section.groupe-rappels:has(#rappels-semaine) .carte-rappel .carte-titre').allTextContents();
      assertEqual(order1.length, 3);
      assert(order1.indexOf('Rendez-vous vétérinaire : Matin') < order1.indexOf('Rendez-vous vétérinaire : Après-midi'), '09:00 before 16:00');

      await reloadApp(page);
      await goTab(page, 'rappels');
      await page.locator('section.groupe-rappels:has(#rappels-semaine) .carte-rappel').first().waitFor({ state: 'visible' });
      const order2 = await page.locator('section.groupe-rappels:has(#rappels-semaine) .carte-rappel .carte-titre').allTextContents();
      assertEqual(JSON.stringify(order2), JSON.stringify(order1), 'Deterministic order across reload');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F8-T2-05',
    feature: 'E2E-F8',
    title: 'Handle overdue active treatment and future-start treatment cleanly on Rappels',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Vénus', espece: 'Chat' });
      await openPet(page, 'Vénus', 'traitements');
      await addTreatment(page, {
        nom: 'Traitement prolongé',
        prisesParJour: 2,
        debut: isoDateOffset(-10),
        fin: isoDateOffset(-1),
        statut: 'en-cours',
      });
      await addTreatment(page, {
        nom: 'Traitement futur',
        prisesParJour: 1,
        debut: isoDateOffset(5),
        fin: isoDateOffset(10),
        statut: 'en-cours',
      });

      await goTab(page, 'rappels');
      const medSection = page.locator('#rappels-liste section.groupe-rappels.medicaments');
      const retardSection = page.locator('#rappels-liste section.groupe-rappels.retard');
      await medSection.waitFor({ state: 'visible' });
      await retardSection.waitFor({ state: 'visible' });
      assertIncludes(await retardSection.textContent(), 'Fin prévue du traitement : Traitement prolongé');
      assertIncludes(await page.locator('#rappels-liste section.groupe-rappels:has(#rappels-mois)').textContent(), 'Traitement futur');
      const medText = await medSection.textContent();
      assertIncludes(medText, 'Médicaments du jour (1)');
      assertIncludes(medText, 'Traitement prolongé');
      assertIncludes(medText, 'Fin prévue le ' + frDate(isoDateOffset(-1)) + ' (en retard d’un jour) — toujours en cours');
      assert(!medText.includes('Traitement futur'), 'Future-start treatment excluded from Médicaments du jour');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F9: Notes, Filters & Documents Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F9-T2-01',
    feature: 'E2E-F9',
    title: 'Reject whitespace-only note without documents, and accept document-only note with empty text',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Lune', espece: 'Chat' });
      await openPet(page, 'Lune', 'notes');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-texte').fill('   \n\t  ');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'texte', 'Écris une note ou joins au moins un document.');

      await page.locator('#champ-texte').fill('');
      const fileInput = page.locator('[data-champ="pieces"] input[type="file"]:not([capture])');
      await uploadSamplePng(page, fileInput, 'radio.png', '[data-champ="pieces"] .aide', 'Document ajouté');
      await submitForm(page);
      await page.locator('#animal-contenu .carte-fiche').first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu .carte-fiche').count(), 1);
      assertEqual(await page.locator('#animal-contenu .vignette-document').count(), 1);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-T2-02',
    feature: 'E2E-F9',
    title: 'Enforce MAX_PIECES (6 documents) limit, disable upload buttons at 6, and re-enable on removal',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Plume', espece: 'Oiseau' });
      await openPet(page, 'Plume', 'notes');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      const fileInput = page.locator('[data-champ="pieces"] input[type="file"]:not([capture])');
      const png = createSamplePngBuffer(10, 10);
      await fileInput.setInputFiles(
        Array.from({ length: 7 }, (_, i) => ({ name: `doc-${i + 1}.png`, mimeType: 'image/png', buffer: png }))
      );

      const zone = page.locator('[data-champ="pieces"] .champ-photo-zone');
      await zone.locator('.aide').filter({ hasText: '6 documents ajoutés.' }).waitFor({ state: 'visible' });
      assertEqual(await zone.locator('.vignettes-documents .document').count(), 6, 'Capped at 6 documents');
      assertEqual(await zone.getByRole('button', { name: 'Photographier un document', exact: true }).isDisabled(), true);
      assertEqual(await zone.getByRole('button', { name: 'Choisir dans la galerie', exact: true }).isDisabled(), true);

      await zone.locator('[aria-label="Retirer le document 1"]').click();
      assertEqual(await zone.locator('.vignettes-documents .document').count(), 5);
      assertEqual(await zone.getByRole('button', { name: 'Choisir dans la galerie', exact: true }).isDisabled(), false);

      await uploadSamplePng(page, fileInput, 'doc-6.png', '[data-champ="pieces"] .champ-photo-zone .aide', 'Document ajouté');
      assertEqual(await zone.locator('.vignettes-documents .document').count(), 6);
      await submitAnimalForm(page, 'Notes de santé');
      await page.locator('#animal-contenu .vignette-document').first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu .vignette-document').count(), 6);

      await page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Modifier', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await zone.locator('.aide').filter({ hasText: '6 documents au maximum pour une note.' }).waitFor({ state: 'visible' });
      assertEqual(await zone.getByRole('button', { name: 'Choisir dans la galerie', exact: true }).isDisabled(), true);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-T2-03',
    feature: 'E2E-F9',
    title: 'Reject invalid document MIME/SVG/corrupt PNG in mixed batch while keeping valid image',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Gribouille', espece: 'Chat' });
      await openPet(page, 'Gribouille', 'notes');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      const fileInput = page.locator('[data-champ="pieces"] input[type="file"]:not([capture])');
      const aide = page.locator('[data-champ="pieces"] .champ-photo-zone .aide');

      await fileInput.setInputFiles([
        { name: 'ok.png', mimeType: 'image/png', buffer: createSamplePngBuffer(10, 10) },
        { name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') },
      ]);
      await aide.filter({ hasText: '1 document(s) ajouté(s).' }).waitFor({ state: 'visible' });
      assertIncludes(await aide.textContent(), 'Ce fichier n’est pas une image prise en charge');

      await uploadFileBuffer(page, fileInput, {
        name: 'corrupt.png',
        mimeType: 'image/png',
        buffer: createCorruptPngBuffer(),
      });
      await aide.filter({ hasText: 'Cette image n’a pas pu être lue' }).waitFor({ state: 'visible' });

      await submitForm(page);
      await page.locator('#animal-contenu .vignette-document').first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-contenu .vignette-document').count(), 1);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-T2-04',
    feature: 'E2E-F9',
    title: 'Reject future note date and handle impossible filter range (du > au) cleanly',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Pépito', espece: 'Chien' });
      await openPet(page, 'Pépito', 'notes');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter une note', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-date').fill(isoDateOffset(1));
      await page.locator('#champ-texte').fill('Note future');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'date', 'Cette date ne peut pas être dans le futur.');
      await page.locator('.formulaire-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();

      await addNote(page, { date: isoDateOffset(-5), categorie: 'observation', texte: 'Observation 1' });
      await page.locator('details.filtre summary').click();
      await page.locator('#filtre-du').fill(isoDateOffset(0));
      await page.locator('#filtre-au').fill(isoDateOffset(-10));
      await page.locator('details.filtre').getByRole('button', { name: 'Appliquer le filtre', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: '0 note(s) sur 1 (filtre actif).' }).waitFor({ state: 'visible' });

      await page.locator('details.filtre').getByRole('button', { name: 'Tout afficher', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: '1 note(s).' }).waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F9-T2-05',
    feature: 'E2E-F9',
    title: 'Toggle image viewer zoom, close with Escape, and reopen cleanly without InvalidStateError',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Zoe', espece: 'Chat' });
      await openPet(page, 'Zoe', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'examen', texte: 'Analyse', withDocument: true });

      await page.locator('#animal-contenu .vignette-document').first().click();
      const viewer = page.locator('dialog#visionneuse[open]');
      await viewer.waitFor({ state: 'visible' });
      await viewer.getByRole('button', { name: 'Taille réelle', exact: true }).click();
      await viewer.getByRole('button', { name: 'Ajuster à l’écran', exact: true }).waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.locator('dialog#visionneuse:not([open])').waitFor({ state: 'attached' });

      await page.locator('#animal-contenu .vignette-document').first().click();
      await viewer.waitFor({ state: 'visible' });
      await viewer.getByRole('button', { name: 'Fermer', exact: true }).click();
      await page.locator('dialog#visionneuse:not([open])').waitFor({ state: 'attached' });
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F10: Pet-Sitter Care Sheet (Garde) Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F10-T2-01',
    feature: 'E2E-F10',
    title: 'Minimal pet care sheet omits empty sections and renders no "undefined" strings',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Minimal' });
      await openPet(page, 'Minimal');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu .fiche-garde').filter({ hasText: 'Minimal' }).waitFor({ state: 'visible' });

      const content = await page.locator('#garde-contenu').textContent();
      assertIncludes(content, 'Minimal');
      assertIncludes(content, 'Fiche éditée le');
      assert(!content.includes('undefined'), 'No undefined text in care sheet');
      assertEqual(await page.locator('#garde-contenu .garde-partie').count(), 0, 'Empty sections omitted');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-T2-02',
    feature: 'E2E-F10',
    title: 'Validate owner contact phone and alimRepas bounds; clearing contact removes Propriétaire block',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Kobe', espece: 'Chien' });
      await openPet(page, 'Kobe', 'alimentation');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      for (const [val, err] of [
        ['0', 'Le nombre doit être plus grand que zéro.'],
        ['1,5', 'Tape un nombre entier'],
        ['51', 'Le nombre est trop grand'],
      ]) {
        await page.locator('#champ-alimRepas').fill(val);
        await submitForm(page, { expectErrors: true });
        await assertFieldError(page, 'alimRepas', err);
      }
      await page.locator('#champ-alimRepas').fill('50');
      await submitAnimalForm(page, 'Alimentation');
      await page.locator('#animal-contenu').filter({ hasText: '50' }).waitFor({ state: 'visible' });

      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter mon contact (propriétaire)', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Alice');
      await page.locator('#champ-telephone').fill('abc');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'telephone', 'Ce numéro contient des caractères inattendus');

      await page.locator('#champ-telephone').fill('06 12 34 56 78');
      await submitForm(page);
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu .fiche-garde').filter({ hasText: 'Propriétaire : Alice' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#garde-contenu').textContent(), 'Propriétaire : Alice');

      await page.locator('#garde-contenu').getByRole('button', { name: 'Modifier mon contact', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('   ');
      await page.locator('#champ-telephone').fill('   ');
      await submitForm(page);
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter mon contact (propriétaire)', exact: true }).waitFor({ state: 'visible' });
      assert(!((await page.locator('#garde-contenu').textContent()).includes('Propriétaire :')), 'Cleared contact removed');
      assertEqual(await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter mon contact (propriétaire)', exact: true }).count(), 1);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-T2-03',
    feature: 'E2E-F10',
    title: 'BUG-17: Future-dated treatment must show start date or not appear unconditionally as active on care sheet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Sora', espece: 'Chat' });
      await openPet(page, 'Sora', 'traitements');
      const futureStart = isoDateOffset(5);
      await addTreatment(page, {
        nom: 'CureFuture',
        dose: '1 comprimé',
        debut: futureStart,
        fin: isoDateOffset(12),
        statut: 'en-cours',
      });

      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu .fiche-garde').filter({ hasText: 'Sora' }).waitFor({ state: 'visible' });

      const gardeMedSections = await page.locator('#garde-contenu .garde-partie').filter({ hasText: 'Médicaments en cours' }).allTextContents();
      assertEqual(gardeMedSections.length, 1, 'Expected "Médicaments en cours" section on care sheet');
      const medText = gardeMedSections[0];
      assertIncludes(medText, 'CureFuture');
      assertIncludes(medText, frDate(futureStart));
      assertIncludes(medText, 'À venir');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-T2-04',
    feature: 'E2E-F10',
    title: 'Exclude finished treatments and >30-day reminders from care sheet while keeping 30-day reminder',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Léon', espece: 'Chien' });
      await openPet(page, 'Léon', 'traitements');
      await addTreatment(page, { nom: 'FiniMed', debut: isoDateOffset(-10), fin: isoDateOffset(-2), statut: 'termine' });
      await openAnimalSection(page, 'vaccins');
      await addVaccine(page, { nom: 'Vaccin30', date: isoDateOffset(0), rappel: isoDateOffset(30) });
      await addVaccine(page, { nom: 'Vaccin31', date: isoDateOffset(0), rappel: isoDateOffset(31) });

      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu .fiche-garde').filter({ hasText: 'Léon' }).waitFor({ state: 'visible' });

      const text = await page.locator('#garde-contenu').textContent();
      assert(!text.includes('FiniMed'), 'Finished treatment excluded');
      assertIncludes(text, 'Vaccin30');
      assert(!text.includes('Vaccin31'), '>30-day reminder excluded');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F10-T2-05',
    feature: 'E2E-F10',
    title: 'Archived pet care sheet hides consignes edit button and print view uses plain Téléphone text',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Blanche', telephone: '01 44 55 66 77' });
      await createPet(page, { nom: 'Poupée', espece: 'Chat', vetoLabel: 'Dr Blanche' });
      await openPet(page, 'Poupée');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="confié"]').check();
      await submitAnimalForm(page, 'Identité');
      await page.locator('#animal-resume .encart.attention').filter({ hasText: 'Animal archivé' }).waitFor({ state: 'visible' });
      await page.locator('#animal-contenu .pile-boutons').waitFor({ state: 'visible' });

      await openAnimalSection(page, 'identite');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu .fiche-garde').filter({ hasText: 'Poupée' }).waitFor({ state: 'visible' });
      await page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).waitFor({ state: 'visible' });

      assertEqual(await page.locator('#garde-contenu').getByRole('button', { name: /consignes/i }).count(), 0, 'Consignes button hidden for archived pet');
      assertEqual(await page.locator('#garde-contenu a.lien-tel').count(), 1, 'Screen view has tel link');

      await probePrintView(
        page,
        () => page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).click(),
        {
          carnetChildSelector: '.fiche-garde',
          expectedTitleContains: 'Fiche de garde - Poupée',
          onPrint: async (p) => {
            assertEqual(await p.locator('#carnet .fiche-garde a.lien-tel').count(), 0, 'Print view uses plain text phone');
            assertIncludes(await p.locator('#carnet .fiche-garde').textContent(), 'Téléphone : 01 44 55 66 77');
          },
        }
      );
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F11: Vet Directory Boundaries (5 tests)
     ========================================================================= */
  {
    id: 'E2E-F11-T2-01',
    feature: 'E2E-F11',
    title: 'Reject empty and whitespace-only veterinarian name',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'veterinaires');
      await page.locator('#vetos-actions').getByRole('button', { name: 'Ajouter un vétérinaire', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('   \t ');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'nom', 'Ce champ est obligatoire.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-T2-02',
    feature: 'E2E-F11',
    title: 'Reject invalid phone chars and prevent empty tel: link on punctuation-only phone ("---")',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'veterinaires');
      await page.locator('#vetos-actions').getByRole('button', { name: 'Ajouter un vétérinaire', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Dr Test');

      for (const badTel of ['06abc', '12', '123@45']) {
        await page.locator('#champ-telephone').fill(badTel);
        await submitForm(page, { expectErrors: true });
        await assertFieldError(page, 'telephone', 'Ce numéro contient des caractères inattendus');
      }

      // Punctuation-only phone without digits must either be rejected or never produce href="tel:"
      await page.locator('#champ-telephone').fill('---');
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('#formulaire-erreurs:not([hidden]), .vue[data-vue="veterinaires"]:not([hidden])').first().waitFor({ state: 'visible', timeout: 5000 });
      const formOpen = await page.locator('.vue[data-vue="formulaire"]').evaluate((el) => !el.hidden);
      if (formOpen) {
        await assertFieldError(page, 'telephone', '');
      } else {
        await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#vetos-liste .carte-fiche').filter({ hasText: 'Dr Test' }).waitFor({ state: 'visible' });
        const emptyTelLinks = await page.locator('#vetos-liste a[href^="tel:"]').evaluateAll((els) =>
          els.map((a) => a.getAttribute('href')).filter((h) => !/\d/.test(h || ''))
        );
        assertEqual(emptyTelLinks.length, 0, `Must not render tel: link without digits, got ${JSON.stringify(emptyTelLinks)}`);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-T2-03',
    feature: 'E2E-F11',
    title: 'List only active pets on vet card and unlink vet from both active and archived pets on delete',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Solo' });
      await createPet(page, { nom: 'Actif', vetoLabel: 'Dr Solo' });
      await createPet(page, { nom: 'Archivé', vetoLabel: 'Dr Solo' });

      await openPet(page, 'Archivé');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Archiver cet animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('[data-champ="motif"] input[value="vendu"]').check();
      await submitForm(page);
      await page.locator('#animal-resume .encart.attention').filter({ hasText: 'Animal archivé' }).waitFor({ state: 'visible' });

      await goTab(page, 'veterinaires');
      await page.locator('#vetos-liste .carte-fiche').filter({ hasText: 'Actif' }).waitFor({ state: 'visible' });
      const vetText = await page.locator('#vetos-liste').textContent();
      assertIncludes(vetText, 'Actif');
      assert(!vetText.includes('Archivé'), 'Archived pet not shown in Vétérinaire habituel de');

      await page.locator('#vetos-liste').getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Supprimer');
      await page.locator('#vetos-liste').filter({ hasText: 'Aucun vétérinaire enregistré.' }).waitFor({ state: 'visible' });

      await openPet(page, 'Actif');
      assert(!((await page.locator('#animal-contenu').textContent()).includes('Dr Solo')), 'Active pet unlinked');
      await goTab(page, 'accueil');
      await page.locator('#accueil-actions').getByRole('button', { name: /Animaux archivés/ }).click();
      await page.locator('.vue[data-vue="archives"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#archives-liste').getByRole('button', { name: 'Consulter', exact: true }).click();
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#animal-titre').filter({ hasText: 'Archivé' }).waitFor({ state: 'visible' });
      await page.locator('#animal-contenu .pile-boutons').waitFor({ state: 'visible' });
      assert(!((await page.locator('#animal-contenu').textContent()).includes('Dr Solo')), 'Archived pet unlinked');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-T2-04',
    feature: 'E2E-F11',
    title: 'Cancel vet deletion preserves vet record and pet linkage',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createVet(page, { nom: 'Dr Gardé', telephone: '01 02 03 04 05' });
      await createPet(page, { nom: 'Paco', vetoLabel: 'Dr Gardé' });
      await goTab(page, 'veterinaires');

      await page.locator('#vetos-liste').getByRole('button', { name: 'Supprimer', exact: true }).click();
      await confirmDialog(page, 'Annuler');
      assertIncludes(await page.locator('#vetos-liste').textContent(), 'Dr Gardé');
      await openPet(page, 'Paco');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Dr Gardé');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F11-T2-05',
    feature: 'E2E-F11',
    title: 'Render special HTML characters and max-length multi-line vet address safely as text',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const xssText = '<img src=x onerror=alert(1)>';
      const longAddr = `${'10 avenue des Champs\n'.repeat(15)}75000 Paris`;
      await createVet(page, { nom: xssText, adresse: longAddr });

      await page.waitForTimeout(100);
      assertEqual(await page.locator('#vetos-liste img').count(), 0, 'No HTML/img tag injected in vet card');
      assertIncludes(await page.locator('#vetos-liste').textContent(), xssText);
      assertIncludes(await page.locator('#vetos-liste').textContent(), '75000 Paris');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F12: Backup, Restore & Demo Data Boundaries (6 tests)
     ========================================================================= */
  {
    id: 'E2E-F12-T2-01',
    feature: 'E2E-F12',
    title: 'Reject corrupt JSON, array root, missing/wrong format, and non-object donnees without data loss',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Intact', espece: 'Chat' });
      const invalidPayloads = [
        '{corrupt json',
        [],
        { versionFormat: 1, donnees: {} },
        { format: 'autre-app', versionFormat: 1, donnees: {} },
        { format: 'omni-animaux-sauvegarde', versionFormat: 1, donnees: [] },
      ];

      for (const payload of invalidPayloads) {
        await uploadJsonImport(page, 'bad.json', payload);
        const dlg = page.locator('dialog#dialogue[open]');
        await dlg.waitFor({ state: 'visible' });
        assertEqual(await dlg.locator('#dialogue-titre').textContent(), 'Fichier refusé');
        assertIncludes(await dlg.textContent(), 'Rien n’a été modifié.');
        await confirmDialog(page, 'J’ai compris');
      }

      await goTab(page, 'accueil');
      await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Intact' }).first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 1);
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Intact');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-T2-02',
    feature: 'E2E-F12',
    title: 'Reject invalid versionFormat values (0, "1", null, 2) with appropriate French refusal messages',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const cases = [
        [0, 'numéro de version incorrect'],
        ['1', 'numéro de version incorrect'],
        [null, 'numéro de version incorrect'],
        [2, 'version plus récente'],
      ];
      for (const [ver, expectedMsg] of cases) {
        await uploadJsonImport(page, 'ver.json', {
          format: 'omni-animaux-sauvegarde',
          versionFormat: ver,
          donnees: { animaux: [], veterinaires: [], pesees: [], vaccins: [], antiparasitaires: [], traitements: [], rdv: [], notes: [], taches: [] },
        });
        const dlg = page.locator('dialog#dialogue[open]');
        await dlg.waitFor({ state: 'visible' });
        assertEqual(await dlg.locator('#dialogue-titre').textContent(), 'Fichier refusé');
        assertIncludes(await dlg.textContent(), expectedMsg);
        await confirmDialog(page, 'J’ai compris');
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-T2-03',
    feature: 'E2E-F12',
    title: 'Reject invalid contactGarde and corrupt nested record, and block JSON prototype pollution',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await uploadJsonImport(page, 'bad-contact.json', {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        reglages: { contactGarde: { nom: 'Test', telephone: '06\n12' } },
        donnees: { animaux: [] },
      });
      await page.locator('dialog#dialogue[open]').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#dialogue-titre').textContent(), 'Fichier refusé');
      await confirmDialog(page, 'J’ai compris');

      await uploadJsonImport(page, 'bad-pesee.json', {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        donnees: {
          animaux: [{ id: 'a1', nom: 'Test', unitePoids: 'kg' }],
          pesees: [{ id: 'p1', animalId: 'a1', date: isoDateOffset(0), grammes: 0 }],
        },
      });
      await page.locator('dialog#dialogue[open]').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#dialogue-titre').textContent(), 'Fichier refusé');
      await confirmDialog(page, 'J’ai compris');

      // Prototype pollution payload
      const protoJson = '{"format":"omni-animaux-sauvegarde","versionFormat":1,"__proto__":{"__omniPolluted":true},"donnees":{"__proto__":{"__omniPolluted":true},"animaux":[{"id":"a-safe","nom":"Safe","unitePoids":"kg"}]}}';
      await restoreBackupReplace(page, 'proto.json', protoJson);
      const polluted = await page.evaluate(() => ({}.__omniPolluted));
      assertEqual(polluted, undefined, 'Object.prototype must not be polluted');
      await goTab(page, 'accueil');
      await page.locator('#accueil-liste').filter({ hasText: 'Safe' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Safe');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-T2-04',
    feature: 'E2E-F12',
    title: 'Accept .txt shared backup and discard orphan child records with count announcement',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const today = isoDateOffset(0);
      const backup = {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        donnees: {
          animaux: [{ id: 'a-real', nom: 'Réel', unitePoids: 'kg' }],
          pesees: [
            { id: 'p-orphan-1', animalId: 'missing-pet', date: today, grammes: 4000 },
            { id: 'p-orphan-2', animalId: 'missing-pet', date: today, grammes: 4100 },
          ],
          vaccins: [],
          antiparasitaires: [],
          traitements: [],
          rdv: [],
          notes: [],
          taches: [],
          veterinaires: [],
        },
      };
      await uploadJsonImport(page, 'partage-sauvegarde.txt', backup);
      await confirmDialog(page, 'Remplacer', { expectNextDialog: true });
      await confirmDialog(page, 'Remplacer');
      await page.locator('#annonce').filter({ hasText: '2 fiche(s) sans animal ont été ignorées.' }).waitFor({ state: 'visible' });

      await goTab(page, 'rappels');
      await goTab(page, 'accueil');
      await page.locator('#accueil-liste').filter({ hasText: 'Réel' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#accueil-liste').textContent(), 'Réel');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-T2-05',
    feature: 'E2E-F12',
    title: 'Replace mode clears omitted contactGarde while preserving password; supprimerExemple cleans child records on demo pet',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Persistant', espece: 'Chat' });
      await openPet(page, 'Persistant');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu').getByRole('button', { name: 'Ajouter mon contact (propriétaire)', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('AncienContact');
      await submitForm(page);
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu .fiche-garde').filter({ hasText: 'AncienContact' }).waitFor({ state: 'visible' });

      await activatePassword(page, 'Secret1234');
      await restoreBackupReplace(page, 'no-contact.json', {
        format: 'omni-animaux-sauvegarde',
        versionFormat: 1,
        donnees: { animaux: [{ id: 'a-new', nom: 'Importé', unitePoids: 'kg' }] },
      });

      await openPet(page, 'Importé');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#garde-contenu .fiche-garde').filter({ hasText: 'Importé' }).waitFor({ state: 'visible' });
      assert(!((await page.locator('#garde-contenu').textContent()).includes('AncienContact')), 'Stale contactGarde cleared by replace');

      // Reload verifies password lock preserved
      await reloadApp(page);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), false, 'Password preserved after replace import');
      await page.locator('#verrou-mdp').fill('Secret1234');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#principal:not([hidden])').waitFor({ state: 'visible' });

      // Load demo, add user weigh-in to Biscuit (exemple), link own pet to Dr Exemple, then delete demo
      await loadDemoData(page);
      await createPet(page, { nom: 'MonChien', vetoLabel: 'Dr Exemple (Clinique vétérinaire des Tilleuls (fictive))' });
      await openPet(page, 'Biscuit (exemple)', 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '23', note: 'Pesée utilisateur' });

      await goTab(page, 'reglages');
      await page.locator('#bouton-exemple').click();
      await confirmDialog(page, 'Supprimer l’exemple');
      await page.locator('#bouton-exemple', { hasText: 'Charger un exemple' }).waitFor({ state: 'visible' });

      await openPet(page, 'MonChien');
      assert(!((await page.locator('#animal-contenu').textContent()).includes('Dr Exemple')), 'Dr Exemple unlinked from real pet');

      const backup = await triggerBackupDownload(page);
      assertEqual(backup.data.donnees.pesees.length, 0, 'User weigh-in on deleted demo pet must be cascade-deleted');
      assert(!backup.data.donnees.animaux.some((a) => a.exemple), 'No demo animals remain in backup');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F12-T2-06',
    feature: 'E2E-F12',
    title: 'Wipe confirmation enforces SUPPRIMER word (case-insensitive) and cancels cleanly',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Gardé', espece: 'Chien' });
      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'Supprimer toutes les données', exact: true }).click();
      await confirmDialog(page, 'Continuer', { expectNextDialog: true });

      const dlg = page.locator('dialog#dialogue[open]');
      await dlg.waitFor({ state: 'visible' });
      const wipeBtn = dlg.getByRole('button', { name: 'Tout supprimer', exact: true });
      assertEqual(await wipeBtn.isDisabled(), true, 'Disabled initially');

      await dlg.locator('#dialogue-saisie').fill('NOPE');
      assertEqual(await wipeBtn.isDisabled(), true, 'Remains disabled for wrong word');

      await dlg.locator('#dialogue-saisie').fill('supprimer');
      assertEqual(await wipeBtn.isDisabled(), false, 'Enabled for case-insensitive supprimer');

      await confirmDialog(page, 'Annuler');
      await goTab(page, 'accueil');
      await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Gardé' }).first().waitFor({ state: 'visible' });
      assertEqual(await page.locator('#accueil-liste .carte-animal').count(), 1, 'Pet preserved after cancel');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F13: Password Lock (Verrou) Boundaries (6 tests)
     ========================================================================= */
  {
    id: 'E2E-F13-T2-01',
    feature: 'E2E-F13',
    title: 'Reject < 4 char password, mismatched confirmation, and empty unlock submit',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'Activer un mot de passe', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#champ-nouveau').fill('abc');
      await page.locator('#champ-confirmation').fill('abcd');
      await submitForm(page, { expectErrors: true });
      await assertFieldError(page, 'nouveau', 'Le mot de passe doit faire au moins 4 caractères.');
      await assertFieldError(page, 'confirmation', 'Les deux mots de passe ne sont pas identiques.');

      await activatePassword(page, 'Valide99');
      await reloadApp(page);
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#verrou-erreur:not([hidden])').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#verrou-erreur').textContent(), 'Tape ton mot de passe.');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-T2-02',
    feature: 'E2E-F13',
    title: 'Reject whitespace-only password ("    ") when activating lock',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'Activer un mot de passe', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nouveau').fill('    ');
      await page.locator('#champ-confirmation').fill('    ');
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('#formulaire-erreurs:not([hidden]), .vue[data-vue="reglages"]:not([hidden])').first().waitFor({ state: 'visible', timeout: 10000 });

      // Expected M4 contract: whitespace-only password must be rejected (form stays open with error)
      assertEqual(
        await page.locator('.vue[data-vue="formulaire"]').evaluate((el) => el.hidden),
        false,
        'Whitespace-only password must be rejected instead of activating lock'
      );
      assertEqual(
        await page.locator('#formulaire-erreurs').evaluate((el) => !el.hidden),
        true,
        'Form validation error summary must be visible when rejecting whitespace-only password'
      );
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-T2-03',
    feature: 'E2E-F13',
    title: 'Enforce 3-strike progressive cooldown on wrong unlock attempts and allow unlock after wait',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await activatePassword(page, 'MonCode1');
      await reloadApp(page);

      for (let i = 1; i <= 3; i++) {
        const wrong = `Mauvais${i}`;
        await page.locator('#verrou-mdp').fill(wrong);
        await page.locator('#verrou-form button[type="submit"]').click();
        await page.waitForFunction(
          (len) => {
            const inp = document.querySelector('#verrou-mdp');
            const err = document.querySelector('#verrou-erreur');
            return inp && err && !err.hidden && err.textContent.includes('Mot de passe incorrect')
              && inp.selectionStart === 0 && inp.selectionEnd === len;
          },
          wrong.length,
          { timeout: 10000 }
        );
      }

      // Immediate 4th attempt hits 1s cooldown
      await page.locator('#verrou-mdp').fill('MonCode1');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#verrou-erreur:not([hidden])').filter({ hasText: 'Trop d’essais incorrects' }).waitFor({ state: 'visible' });

      await page.waitForTimeout(1150);
      await page.locator('#verrou-mdp').fill('MonCode1');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#principal:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-T2-04',
    feature: 'E2E-F13',
    title: 'Reject wrong current password on Change and Disable without altering active password',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await activatePassword(page, 'Initial42');

      // Wrong current on Change
      await page.locator('#reglages-contenu').getByRole('button', { name: 'Changer le mot de passe', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-actuel').fill('Faux');
      await page.locator('#champ-nouveau').fill('Nouveau42');
      await page.locator('#champ-confirmation').fill('Nouveau42');
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('#annonce.erreur').filter({ hasText: 'Le mot de passe actuel est incorrect' }).waitFor({ state: 'visible' });
      await page.locator('.formulaire-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();

      // Wrong current on Disable
      await page.locator('#reglages-contenu').getByRole('button', { name: 'Désactiver le mot de passe', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-actuel').fill('Faux');
      await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
      await page.locator('#annonce.erreur').filter({ hasText: 'Le mot de passe actuel est incorrect' }).waitFor({ state: 'visible' });

      await reloadApp(page);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), false);
      await page.locator('#verrou-mdp').fill('Initial42');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#principal:not([hidden])').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-T2-05',
    feature: 'E2E-F13',
    title: 'Block deep-link hash and popstate while locked, clear #carnet, and open deep link after unlock',
    run: async ({ page, baseUrl, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'Cadenas', espece: 'Chat' });
      await openPet(page, 'Cadenas', 'poids');
      const deepHash = new URL(page.url()).hash;

      // Populate #carnet before activating lock
      await openAnimalSection(page, 'identite');
      await withPrintStub(page, async ({ getPrintCallCount }) => {
        await page.locator('#animal-contenu').getByRole('button', { name: 'Carnet de santé (imprimer ou PDF)', exact: true }).click();
        await page.locator('#carnet header.carnet-entete').waitFor({ state: 'attached' });
        assertEqual(await getPrintCallCount(), 1, 'window.print() must be called once');
        assert((await page.locator('#carnet').evaluate((el) => el.children.length)) > 0, '#carnet populated before lock');

        await activatePassword(page, 'ClefSecrete');
        await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
        await page.goto(`${baseUrl}${deepHash}`, { waitUntil: 'domcontentloaded' });
        await page.locator('#verrou:not([hidden])').waitFor({ state: 'visible' });
        assertEqual(await page.locator('#principal').evaluate((el) => el.hidden), true);
        assertEqual(await page.locator('#carnet').evaluate((el) => el.children.length), 0, '#carnet cleared when lock displayed');
      });

      // Try popstate / hashchange while locked
      await page.evaluate(() => { window.location.hash = '#accueil'; });
      await page.waitForTimeout(100);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), false, 'Lock remains visible on hashchange');

      // Unlock leads to target view
      await page.locator('#verrou-mdp').fill('ClefSecrete');
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#principal:not([hidden])').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F13-T2-06',
    feature: 'E2E-F13',
    title: 'Support Unicode, internal spaces, and long password (200 chars) without trimming',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const complexPass = 'Chien & Chat 2026! 🐾 ' + 'x'.repeat(178);
      await activatePassword(page, complexPass);
      await reloadApp(page);
      assertEqual(await page.locator('#verrou').evaluate((el) => el.hidden), false);

      await page.locator('#verrou-mdp').fill(complexPass);
      await page.locator('#verrou-form button[type="submit"]').click();
      await page.locator('#principal:not([hidden])').waitFor({ state: 'visible' });
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F14: Themes, Text Size & Routing Boundaries (6 tests)
     ========================================================================= */
  {
    id: 'E2E-F14-T2-01',
    feature: 'E2E-F14',
    title: 'Recover cleanly to accueil from malformed percent-encoded and unknown hashes without pageerror',
    run: async ({ page, baseUrl, assertNoRuntimeErrors }) => {
      for (const badHash of ['#%', '#animal/%E0%A4%A/poids', '#inexistant', '#///']) {
        await page.goto(`${baseUrl}${badHash}`, { waitUntil: 'domcontentloaded' });
        await page.locator('#chargement').waitFor({ state: 'hidden' });
        await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-T2-02',
    feature: 'E2E-F14',
    title: 'Handle non-existent pet ID on animal/garde routes and unknown animal section gracefully',
    run: async ({ page, baseUrl, assertNoRuntimeErrors }) => {
      await page.goto(`${baseUrl}#animal/nonexistent-id/identite`, { waitUntil: 'domcontentloaded' });
      await page.locator('#chargement').waitFor({ state: 'hidden' });
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#annonce').filter({ hasText: 'Cet animal n’existe plus.' }).waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#annonce').textContent(), 'Cet animal n’existe plus.');

      await page.goto(`${baseUrl}#garde/nonexistent-id`, { waitUntil: 'domcontentloaded' });
      await page.locator('#chargement').waitFor({ state: 'hidden' });
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

      await createPet(page, { nom: 'RouteTest', espece: 'Chat' });
      await openPet(page, 'RouteTest');
      const petIdHash = new URL(page.url()).hash.replace(/\/identite$/, '/section-inconnue');
      await page.goto(`${baseUrl}${petIdHash}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#animal-contenu h2').filter({ hasText: 'Identité' }).waitFor({ state: 'visible' });
      await page.locator('#animal-contenu .pile-boutons').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#animal-sections button[data-section="identite"]').getAttribute('aria-current'), 'true');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-T2-03',
    feature: 'E2E-F14',
    title: 'Redirect direct #formulaire and forward-history #formulaire cleanly back to accueil',
    run: async ({ page, baseUrl, assertNoRuntimeErrors }) => {
      await page.goto(`${baseUrl}#formulaire`, { waitUntil: 'domcontentloaded' });
      await page.locator('#chargement').waitFor({ state: 'hidden' });
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('.formulaire-boutons').getByRole('button', { name: 'Annuler', exact: true }).click();
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

      await page.goForward();
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('.vue[data-vue="formulaire"]').evaluate((el) => el.hidden), true);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-T2-04',
    feature: 'E2E-F14',
    title: 'Rapid tab switching during open form resets form and settles on final clicked tab',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await page.locator('#accueil-actions').getByRole('button', { name: 'Ajouter un animal', exact: true }).click();
      await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
      await page.locator('#champ-nom').fill('Brouillon');

      await page.locator('#barre-nav').evaluate((nav) => {
        nav.querySelector('button[data-onglet="rappels"]').click();
        nav.querySelector('button[data-onglet="reglages"]').click();
        nav.querySelector('button[data-onglet="veterinaires"]').click();
      });

      await page.locator('.vue[data-vue="veterinaires"]:not([hidden])').waitFor({ state: 'visible' });
      assertEqual(await page.locator('#barre-nav button[data-onglet="veterinaires"]').getAttribute('aria-current'), 'page');
      assertEqual(await page.locator('.vue[data-vue="formulaire"]').evaluate((el) => el.hidden), true);

      await page.goForward().catch(() => {});
      await page.waitForTimeout(100);
      assertEqual(await page.locator('.vue[data-vue="formulaire"]').evaluate((el) => el.hidden), true, 'Stale form not reopened');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-T2-05',
    feature: 'E2E-F14',
    title: 'Corrupted localStorage theme/size values fall back cleanly to omni and normal on reload',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await page.evaluate(() => {
        localStorage.setItem('omnianimaux_theme', '<xss>');
        localStorage.setItem('omnianimaux_taille', 'gigantesque');
      });
      await reloadApp(page);
      assertEqual(await page.locator('html').getAttribute('data-theme'), 'omni');
      assertEqual(await page.locator('html').getAttribute('data-taille'), 'normal');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F14-T2-06',
    feature: 'E2E-F14',
    title: 'Synchronize meta[name="theme-color"] across all 3 themes and apply data-theme before paint',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await goTab(page, 'reglages');
      const expected = {
        omni: '#14111d',
        sombre: '#161b21',
        clair: '#eef0f2',
      };
      for (const [theme, color] of Object.entries(expected)) {
        await page.locator(`input[name="reglage-theme"][value="${theme}"]`).check();
        assertEqual(await page.locator('meta[name="theme-color"]').getAttribute('content'), color, `theme-color for ${theme}`);
      }
      await waitForIdbSetting(page, 'theme', 'clair');
      await reloadApp(page);
      assertEqual(await page.locator('html').getAttribute('data-theme'), 'clair');
      assertEqual(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#eef0f2');
      await assertNoRuntimeErrors();
    },
  },

  /* =========================================================================
     E2E-F15: Print View, Offline/Network Recovery, SW Precache & Concurrency (10 tests)
     ========================================================================= */
  {
    id: 'E2E-F15-T2-01',
    feature: 'E2E-F15',
    title: 'Verify manifest.json completeness, all icon HTTP 200s, and 100% sw.js FICHIERS precache in Cache Storage',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await waitForSwReady(page);
      const audit = await page.evaluate(async () => {
        const manRes = await fetch('./manifest.json');
        const manifest = await manRes.json();
        const iconUrls = [
          ...(manifest.icons || []).map((i) => i.src),
          ...((manifest.shortcuts || []).flatMap((s) => (s.icons || []).map((i) => i.src))),
        ];
        const iconStatuses = [];
        for (const u of iconUrls) {
          const r = await fetch(u);
          iconStatuses.push({ url: u, status: r.status });
        }
        const swText = await (await fetch('./sw.js')).text();
        const declared = [...swText.matchAll(/'(\.[^']*)'/g)]
          .map((m) => m[1])
          .filter((s) => s.startsWith('./'));
        const swStatuses = [];
        for (const f of declared) {
          const r = await fetch(f);
          swStatuses.push({ file: f, status: r.status });
        }
        return { manifest, manStatus: manRes.status, iconStatuses, declared, swStatuses };
      });

      assertEqual(audit.manStatus, 200, 'manifest.json status');
      assertTruthy(audit.manifest.name, 'manifest name');
      assertTruthy(audit.manifest.short_name, 'manifest short_name');
      assertEqual(audit.manifest.display, 'standalone', 'manifest display');
      assert(audit.iconStatuses.every((i) => i.status === 200), `All manifest icons 200: ${JSON.stringify(audit.iconStatuses)}`);
      assert(audit.swStatuses.every((s) => s.status === 200), `All sw.js FICHIERS 200: ${JSON.stringify(audit.swStatuses)}`);

      const cachedPaths = await getCachedPaths(page);
      assert(audit.declared.length >= 25, `Expected full sw.js FICHIERS list, got ${audit.declared.length}`);
      for (const f of audit.declared) {
        const expectedSuffix = f === './' ? '/' : f.slice(1);
        assert(cachedPaths.some((p) => p.endsWith(expectedSuffix)), `Missing from Cache Storage: ${f}`);
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-02',
    feature: 'E2E-F15',
    title: 'Navigate all main routes, ignoreSearch URL, and perform full CRUD + reload offline with 0 errors',
    run: async ({ page, context, baseUrl, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);
      await context.setOffline(true);

      await page.goto(`${baseUrl}?utm=offline#accueil`, { waitUntil: 'domcontentloaded' });
      await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });

      await createPet(page, { nom: 'OfflineRex', espece: 'Chien' });
      await openPet(page, 'OfflineRex', 'poids');
      await addWeighIn(page, { date: isoDateOffset(0), valeur: '14,2' });
      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Créé hors ligne' });

      await goTab(page, 'rappels');
      await goTab(page, 'veterinaires');
      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'À propos d’Omni-Animalia', exact: true }).click();
      await page.locator('.vue[data-vue="apropos"]:not([hidden])').waitFor({ state: 'visible' });

      await reloadApp(page);
      await openPet(page, 'OfflineRex', 'notes');
      assertIncludes(await page.locator('#animal-contenu').textContent(), 'Créé hors ligne');
      await context.setOffline(false);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-03',
    feature: 'E2E-F15',
    runtimeCheckOptions: { allowFailedRequests: true, allowConsoleErrors: true },
    title: 'Offline unknown subpath falls back to index.html and uncached fetch rejects via Response.error()',
    run: async ({ browser, context, page, monitors, baseUrl, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);
      await setOfflineWithSw(browser, context, page, true);

      try {
        await page.goto(`${baseUrl}sous-chemin-inconnu`, { waitUntil: 'domcontentloaded' });
        await page.locator('#chargement').waitFor({ state: 'hidden' });
        await page.locator('.vue[data-vue="accueil"]:not([hidden])').waitFor({ state: 'visible' });
        await assertNoRuntimeErrors();

        const fetchRejected = await page.evaluate(async () => {
          try {
            await fetch('./inexistant-tier2.json');
            return false;
          } catch (e) {
            return true;
          }
        });
        assertEqual(fetchRejected, true, 'Uncached fetch must reject via Response.error() when SW is offline');
        assertEqual(monitors.failedRequests.length, 1, 'Only the intentional uncached fetch failed');
        assert(
          monitors.failedRequests[0].url.endsWith('/inexistant-tier2.json'),
          `Expected failed request for /inexistant-tier2.json, got ${monitors.failedRequests[0].url}`
        );
      } finally {
        await setOfflineWithSw(browser, context, page, false);
      }
      await assertNoRuntimeErrors({ allowFailedRequests: true, allowConsoleErrors: true });
    },
  },
  {
    id: 'E2E-F15-T2-04',
    feature: 'E2E-F15',
    title: 'Recover cleanly from mid-session network loss (Google Agenda offline modal -> online confirmation) and export backup offline',
    run: async ({ page, context, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);
      await createPet(page, { nom: 'Resilient', espece: 'Chien' });
      await openPet(page, 'Resilient', 'rdv');
      await addAppointment(page, { date: isoDateOffset(5), heure: '11:00', motif: 'Vaccin' });

      await context.setOffline(true);
      await page.waitForFunction(() => navigator.onLine === false, null, { timeout: 5000 });

      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
      const dlg = page.locator('dialog#dialogue[open]');
      await dlg.waitFor({ state: 'visible' });
      assertIncludes(await dlg.locator('#dialogue-titre').textContent(), 'Pas de connexion internet');
      await confirmDialog(page, 'J’ai compris');

      // Backup export still works offline
      const backup = await triggerBackupDownload(page);
      assertEqual(backup.data.donnees.animaux.length, 1);

      // Network recovery
      await context.setOffline(false);
      await page.waitForFunction(() => navigator.onLine === true, null, { timeout: 5000 });
      await openPet(page, 'Resilient', 'rdv');
      await page.locator('#animal-contenu').getByRole('button', { name: 'Ajouter à Google Agenda', exact: true }).click();
      await dlg.waitFor({ state: 'visible' });
      assertIncludes(await dlg.locator('#dialogue-titre').textContent(), 'Ajouter à Google Agenda');
      await confirmDialog(page, 'Annuler');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-05',
    feature: 'E2E-F15',
    title: 'Handle overlapping open dialogs (dialog#dialogue & dialog#visionneuse) cleanly without InvalidStateError',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'DialogTest', espece: 'Chat' });
      await openPet(page, 'DialogTest', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Doc', withDocument: true });

      // Double-click delete button rapidly to open confirm dialog without throwing
      const delBtn = page.locator('#animal-contenu .carte-fiche').first().getByRole('button', { name: 'Supprimer', exact: true });
      await rapidDoubleClick(delBtn);
      await page.locator('dialog#dialogue[open]').waitFor({ state: 'visible' });
      await confirmDialog(page, 'Annuler');

      // Double-click image viewer thumbnail rapidly
      const thumbBtn = page.locator('#animal-contenu .vignette-document').first();
      await rapidDoubleClick(thumbBtn);
      await page.locator('dialog#visionneuse[open]').waitFor({ state: 'visible' });
      await page.locator('dialog#visionneuse').getByRole('button', { name: 'Fermer', exact: true }).click();
      await page.locator('dialog#visionneuse:not([open])').waitFor({ state: 'attached' });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-06',
    feature: 'E2E-F15',
    title: 'Clear #carnet DOM and restore document.title on afterprint after printing Fiche de garde',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'PrintGarde', espece: 'Chien' });
      await openPet(page, 'PrintGarde');
      const titleBefore = await page.title();

      await page.locator('#animal-contenu').getByRole('button', { name: 'Fiche de garde', exact: true }).click();
      await page.locator('.vue[data-vue="garde"]:not([hidden])').waitFor({ state: 'visible' });
      await withPrintStub(page, async ({ getPrintCallCount }) => {
        await page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).click();
        await page.locator('#carnet .fiche-garde').waitFor({ state: 'attached' });
        assertEqual(await getPrintCallCount(), 1, 'window.print() must be called once');
        assertIncludes(await page.locator('#carnet').textContent(), 'PrintGarde');
        assertEqual(await page.title(), 'Fiche de garde - PrintGarde', 'document.title set during care sheet print');

        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        await page.waitForFunction(() => {
          const c = document.querySelector('#carnet');
          return !c || c.children.length === 0;
        }, null, { timeout: 5000 });

        assertEqual(await page.locator('#carnet').evaluate((el) => el.children.length), 0, '#carnet must be cleared after print (afterprint)');
        assertEqual(await page.title(), titleBefore, 'document.title restored after print');
      });
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-07',
    feature: 'E2E-F15',
    title: 'Reset health notes filter when switching to another pet so Pet A filter does not hide Pet B notes',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'ChatA', espece: 'Chat' });
      await createPet(page, { nom: 'ChienB', espece: 'Chien' });

      await openPet(page, 'ChatA', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'symptome', texte: 'Toux A' });
      await page.locator('details.filtre summary').click();
      await page.locator('#filtre-categorie').selectOption('allergie');
      await page.locator('details.filtre').getByRole('button', { name: 'Appliquer le filtre', exact: true }).click();
      await page.locator('#animal-contenu').filter({ hasText: '0 note(s) sur 1 (filtre actif).' }).waitFor({ state: 'visible' });

      await openPet(page, 'ChienB', 'notes');
      await addNote(page, { date: isoDateOffset(0), categorie: 'observation', texte: 'Observation B' });
      await page.locator('#animal-contenu h2').waitFor({ state: 'visible' });
      await page.locator('#animal-contenu').filter({ hasText: 'note(s)' }).waitFor({ state: 'visible' });
      const chienBText = await page.locator('#animal-contenu').textContent();
      assertIncludes(chienBText, 'Observation B');
      assert(!chienBText.includes('filtre actif'), 'Notes filter must reset when switching to another pet');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-08',
    feature: 'E2E-F15',
    title: 'Prevent duplicate recurring task creation on rapid double-click of Marquer comme fait',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'DoubleTask', espece: 'Chien' });
      await openPet(page, 'DoubleTask', 'taches');
      await addTask(page, {
        titre: 'Bain hebdo',
        echeance: isoDateOffset(0),
        repete: 'oui',
        recN: 1,
        recUnite: 'semaines',
      });

      const doneBtn = page.locator('#animal-contenu').getByRole('button', { name: 'Marquer comme fait', exact: true });
      await rapidDoubleClick(doneBtn);
      await page.locator('#animal-contenu .carte-fiche.termine').first().waitFor({ state: 'visible' });
      await page.waitForTimeout(200);

      assertIncludes(await page.locator('#animal-contenu').textContent(), 'À faire (1)');
      assertEqual(await page.locator('#animal-contenu .carte-fiche:not(.termine)').count(), 1, 'Exactly 1 next occurrence created');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-09',
    feature: 'E2E-F15',
    title: 'Serialize rapid double-click dose logging without lost updates and guard against accidental overdose',
    run: async ({ page, assertNoRuntimeErrors }) => {
      await createPet(page, { nom: 'DoubleDose', espece: 'Chat' });
      await openPet(page, 'DoubleDose', 'traitements');
      await addTreatment(page, {
        nom: 'Gouttes yeux',
        prisesParJour: 2,
        debut: isoDateOffset(0),
        statut: 'en-cours',
      });

      const doseBtn = page.locator('#animal-contenu').getByRole('button', { name: 'Noter une prise maintenant', exact: true });
      await rapidDoubleClick(doseBtn);
      await page.locator('#animal-contenu .encart.prises.complet').filter({ hasText: '2 prises sur 2' }).waitFor({ state: 'visible' });

      assertEqual(
        await page.locator('#animal-contenu .encart.prises').count(),
        1,
        'Single dose box rendered (no duplicate DOM on rapid double-click)'
      );
      const prisesText = await page.locator('#animal-contenu .encart.prises').textContent();
      assertIncludes(prisesText, '2 prises sur 2');
      assertIncludes(prisesText, 'Toutes les prises du jour sont notées');

      // Third click past prescribed daily doses triggers overdose confirmation guard
      await doseBtn.click();
      const dlg = page.locator('dialog#dialogue[open]');
      await dlg.waitFor({ state: 'visible', timeout: 10000 });
      assertIncludes(await dlg.textContent(), 'Toutes les prises du jour sont déjà notées');
      await confirmDialog(page, 'Ne rien noter');
      assertEqual(await page.locator('#animal-contenu .encart.prises').count(), 1);
      assertIncludes(await page.locator('#animal-contenu .encart.prises').textContent(), '2 prises sur 2');
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-F15-T2-10',
    feature: 'E2E-F15',
    title: 'Preserve CSP violation bridge across mid-test reloads and verify strict zero-inline-script shell',
    run: async ({ page, monitors, syncCspViolations, assertNoRuntimeErrors }) => {
      await reloadApp(page);
      const inlineCount = await page.evaluate(() => ({
        inlineScripts: [...document.querySelectorAll('script')].filter((s) => !s.src).length,
        inlineStyles: document.querySelectorAll('[style]').length,
        cspMeta: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || '',
      }));
      assertEqual(inlineCount.inlineScripts, 0, 'Zero inline scripts');
      assertIncludes(inlineCount.cspMeta, "script-src 'self'");

      // Verify CSP bridge works across reload via exposeFunction
      const hasBridge = await page.evaluate(() => typeof window.__omniReportCsp === 'function');
      assertEqual(hasBridge, true, 'CSP exposeFunction bridge active after reload');
      await syncCspViolations();
      assertEqual(monitors.cspViolations.length, 0, 'Zero CSP violations');
      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 2,
  name: 'Tier 2 — Boundaries, Corner Cases, Offline & PWA Precache',
  tests,
};
