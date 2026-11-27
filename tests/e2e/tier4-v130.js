/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tier 4 — R1-R5 Real-World Workloads, Security Hardening & Compliance Audit
   (3 multi-feature workloads + SEC-06 + AUDIT-01) */
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
  wipeAllData,
  ensureSwControlled,
  setOfflineWithSw,
  getCachedPaths,
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
  probePrintViewV130,
} = require('./helpers-v130');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const tests = [
  {
    id: 'E2E-T4-W6',
    feature: 'E2E-F19',
    title: 'Workload 6: Multi-pet household annual care, emergency prep, R1-R5 sync & encrypted migration',
    run: async ({ browser, context, page, assertNoRuntimeErrors }) => {
      await ensureSwControlled(page);
      const clip = await setupClipboardSpy(page);
      try {
        const yNow = new Date().getFullYear();
        const yPrev = yNow - 1;

        await configureEmergencyVet(page, {
          nom: 'Urgences 24h',
          clinique: 'CHV Métropole',
          telephone: '01 40 00 11 22',
        });
        await createVet(page, {
          nom: 'Dr Moreau',
          clinique: 'Clinique Parc',
          telephone: '01 42 55 66 77',
        });

        // Pet 1: Dog in kg with passport, insurance, ideal weight, chronic treatment without fin
        await createPet(page, {
          nom: 'Atlas',
          espece: 'Chien',
          race: 'Berger',
          couleur: 'Fauve',
          puce: '250269600111222',
          unitePoids: 'kg',
          vetoLabel: 'Dr Moreau (Clinique Parc)',
        });
        await openPet(page, 'Atlas', 'identite');
        await editAnimalIdentity(page, {
          passeport: 'FR-DOG-101',
          assuranceCompagnie: 'SantéVet',
          assuranceContrat: 'POL-101',
          assuranceTelephone: '01 80 00 11 22',
        });
        await openAnimalSection(page, 'poids');
        await addWeighIn(page, { date: isoDateOffset(-20), valeur: '24,5' });
        await addWeighIn(page, { date: isoDateOffset(-2), valeur: '25,0' });
        await configureIdealWeight(page, { min: '23', max: '26' });
        await openAnimalSection(page, 'traitements');
        await addTreatment(page, { nom: 'Cardio', prisesParJour: 2, debut: isoDateOffset(-10), fin: '', statut: 'en-cours' });
        await openAnimalSection(page, 'rdv');
        await addAppointment(page, { date: `${yNow}-02-15`, motif: 'Bilan cardiaque', compteRendu: 'Rythme stable', cout: '95' });

        // Pet 2: Cat in g with ideal weight, overdue vaccine, due antiparasitic, note with PNG, multi-year RDVs
        await createPet(page, { nom: 'Misty', espece: 'Chat', unitePoids: 'g' });
        await openPet(page, 'Misty', 'poids');
        await addWeighIn(page, { date: isoDateOffset(-15), valeur: '3800' });
        await addWeighIn(page, { date: isoDateOffset(-1), valeur: '3950' });
        await configureIdealWeight(page, { min: '3600', max: '4100' });
        await openAnimalSection(page, 'vaccins');
        await addVaccine(page, { nom: 'Typhus', date: isoDateOffset(-370), rappel: isoDateOffset(-5) });
        await openAnimalSection(page, 'antiparasitaires');
        await addAntiparasitic(page, { type: 'vermifuge', produit: 'Milbemax', date: isoDateOffset(-90), prochaine: isoDateOffset(0) });
        await openAnimalSection(page, 'notes');
        await addNote(page, { date: isoDateOffset(-4), categorie: 'symptome', texte: 'Éternuements légers', withDocument: true });
        await openAnimalSection(page, 'rdv');
        await addAppointment(page, { date: `${yNow}-03-10`, motif: 'Vaccins', cout: '55' });
        await addAppointment(page, { date: `${yPrev}-10-01`, motif: 'Stérilisation', cout: '140' });

        // Home badge & Rappels filter + quick actions + global expenses
        await goTab(page, 'accueil');
        assertMatch(
          await page.locator('#accueil-liste .carte-animal').filter({ hasText: 'Atlas' }).locator('.badges').textContent(),
          /(?:^|\D)2 prises à noter\b/
        );

        await goTab(page, 'rappels');
        const rappelsText = await page.locator('.vue[data-vue="rappels"]').textContent();
        assertMatch(rappelsText, /150,00[\s\u00a0\u202f]*€/, 'Current year expenses 95 + 55 = 150,00 €');
        assertMatch(rappelsText, /140,00[\s\u00a0\u202f]*€/, 'Previous year expenses 140,00 €');

        await filterRappelsByAnimal(page, 'Misty');
        await page.locator('#rappels-liste').getByRole('button', { name: 'Noter le rappel fait', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-rappel').fill(isoDateOffset(365));
        await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
        await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });

        await goTab(page, 'rappels');
        await filterRappelsByAnimal(page, 'Misty');
        await page.locator('#rappels-liste').getByRole('button', { name: 'Noter la prise suivante', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-prochaine').fill(isoDateOffset(90));
        await page.locator('.vue[data-vue="formulaire"] form.formulaire button[type="submit"]').click();
        await page.locator('.vue[data-vue="formulaire"]').waitFor({ state: 'hidden', timeout: 10000 });

        // Misty tab dots cleared
        await openPet(page, 'Misty', 'identite');
        assertEqual(await getAnimalTabDot(page, 'vaccins').count(), 0);
        assertEqual(await getAnimalTabDot(page, 'antiparasitaires').count(), 0);
        await openChronologieTab(page);
        assertIncludes(await page.locator('#animal-contenu').textContent(), 'Éternuements légers');

        // Print Misty 12m + appendix
        await openAnimalSection(page, 'identite');
        await printCarnetWithOptions(page, {
          periode: '12mois',
          annexe: true,
          onPrint: async (p) => {
            assertEqual(await p.locator('#carnet img:not(.carnet-photo)').count(), 1);
          },
        });

        // Atlas keyword search, lost pet, garde share
        await openPet(page, 'Atlas', 'identite');
        await searchAnimalKeyword(page, 'Rythme stable');
        assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), 'Rythme stable');
        await searchAnimalKeyword(page, '');
        await triggerLostPetSheet(page);
        assertIncludes(await clip.lastText(), '250269600111222');

        await openGarde(page);
        await clickGardeShare(page);
        assertIncludes(await clip.lastText(), 'Cardio');

        // Encrypted backup -> wipe -> wrong password -> correct password -> offline reload
        const backup = await exportBackupWithPassword(page, 'Household2026!');
        await wipeAllData(page);
        const wrong = await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, {
          password: 'WrongPassword',
          expectDecryptError: true,
        });
        assertIncludes(wrong.decryptError, 'Mot de passe incorrect');

        await restoreMaybeEncryptedBackup(page, backup.filename, backup.raw, {
          password: 'Household2026!',
          mode: 'remplacer',
        });

        await setOfflineWithSw(browser, context, page, true);
        try {
          await reloadApp(page);
          await goTab(page, 'veterinaires');
          await page.locator('.vue[data-vue="veterinaires"] a[href="tel:0140001122"]').waitFor({ state: 'visible' });
          await openPet(page, 'Atlas', 'poids');
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
  {
    id: 'E2E-T4-W7',
    feature: 'E2E-F16',
    title: 'Workload 7: Travel / boarding handover in tresgrand + clair theme at 390x844',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const clip = await setupClipboardSpy(page);
      try {
        await goTab(page, 'reglages');
        await page.locator('#reglage-theme-2').check();
        await page.locator('#reglage-taille-2').check();
        await page.waitForFunction(() =>
          document.documentElement.dataset.theme === 'clair' && document.documentElement.dataset.taille === 'tresgrand'
        );

        await configureEmergencyVet(page, { nom: 'Urgences 24h', clinique: 'Clinique Voyage', telephone: '01 44 00 99 88' });
        await createPet(page, {
          nom: 'Praline',
          espece: 'Chat',
          race: 'Siamois',
          couleur: 'Crème',
          puce: '250269600333444',
        });
        await openPet(page, 'Praline', 'identite');
        await editAnimalIdentity(page, {
          passeport: 'EU-PRALINE-26',
          assuranceCompagnie: 'AssurVoyage',
          assuranceContrat: 'V-777',
          assuranceTelephone: '01 70 11 22 33',
        });
        await openAnimalSection(page, 'alimentation');
        await page.locator('#animal-contenu').getByRole('button', { name: 'Remplir l’alimentation', exact: true }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-alimEviter').fill('Plantes vertes');
        await submitAnimalForm(page, 'Alimentation');

        await openAnimalSection(page, 'notes');
        await addNote(page, { date: isoDateOffset(-1), categorie: 'allergie', texte: 'Allergie poisson', withDocument: true });
        await openAnimalSection(page, 'traitements');
        await addTreatment(page, { nom: 'Probiotiques', prisesParJour: 1, debut: isoDateOffset(-2), fin: '', statut: 'en-cours' });
        await openAnimalSection(page, 'vaccins');
        await addVaccine(page, { nom: 'Rage', date: isoDateOffset(-340), rappel: isoDateOffset(20) });

        await openAnimalSection(page, 'identite');
        await triggerLostPetSheet(page);
        assertIncludes(await clip.lastText(), '250269600333444');

        await openGarde(page);
        await page.locator('#garde-contenu').getByRole('button', { name: /Ajouter mon contact/ }).click();
        await page.locator('.vue[data-vue="formulaire"]:not([hidden])').waitFor({ state: 'visible' });
        await page.locator('#champ-nom').fill('Lucie');
        await page.locator('#champ-telephone').fill('06 22 33 44 55');
        await submitGardeForm(page);

        const ovGarde = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        assertEqual(ovGarde, true, 'Zero horizontal overflow on Garde in tresgrand + clair');

        await clickGardeShare(page);
        const summary = await clip.lastText();
        assertIncludes(summary, 'Praline');
        assertIncludes(summary, 'Plantes vertes');
        assertIncludes(summary, 'Allergie poisson');
        assertIncludes(summary, 'Probiotiques');
        assertIncludes(summary, 'Lucie');

        await probePrintViewV130(
          page,
          () => page.locator('#garde-contenu').getByRole('button', { name: 'Imprimer ou enregistrer en PDF', exact: true }).click(),
          { carnetChildSelector: '.fiche-garde', expectedTitleContains: 'Fiche de garde - Praline' }
        );

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        await printCarnetWithOptions(page, {
          periode: 'tout',
          annexe: true,
          onPrint: async (p) => {
            assertIncludes(await p.locator('#carnet').textContent(), 'EU-PRALINE-26');
            assertEqual(await p.locator('#carnet img:not(.carnet-photo)').count(), 1);
          },
        });
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-W8',
    feature: 'E2E-F22',
    title: 'Workload 8: Longitudinal 18-month medical follow-up, search, Chronologie & multi-year expenses',
    run: async ({ page, assertNoRuntimeErrors }) => {
      const yNow = new Date().getFullYear();
      const yPrev = yNow - 1;

      await createPet(page, { nom: 'LongPet', espece: 'Chien', unitePoids: 'kg' });
      await openPet(page, 'LongPet', 'poids');
      for (const [days, val] of [[-540, '20'], [-420, '21'], [-240, '22'], [-60, '21,5'], [-5, '21,8']]) {
        await addWeighIn(page, { date: isoDateOffset(days), valeur: val });
      }
      await configureIdealWeight(page, { min: '20,5', max: '22,5' });

      await openAnimalSection(page, 'notes');
      await addNote(page, { date: isoDateOffset(-500), categorie: 'symptome', texte: 'Ancienne dermite' });
      await addNote(page, { date: isoDateOffset(-120), categorie: 'symptome', texte: 'Otite gauche' });
      await addNote(page, { date: isoDateOffset(-10), categorie: 'symptome', texte: 'Récupération complète' });

      await openAnimalSection(page, 'vaccins');
      await addVaccine(page, { nom: 'Leptospirose', date: isoDateOffset(-450) });
      await addVaccine(page, { nom: 'CHPPiL', date: isoDateOffset(-30) });

      await openAnimalSection(page, 'antiparasitaires');
      await addAntiparasitic(page, { type: 'anti-tiques', produit: 'NexGard', date: isoDateOffset(-25) });

      await openAnimalSection(page, 'traitements');
      await addTreatment(page, { nom: 'Aurizon', debut: isoDateOffset(-120), fin: isoDateOffset(-105), statut: 'termine' });
      await addTreatment(page, { nom: 'Probiotique', debut: isoDateOffset(-9), fin: isoDateOffset(-2), statut: 'termine' });

      await openAnimalSection(page, 'rdv');
      await addAppointment(page, { date: `${yPrev}-07-01`, motif: 'Dermatologie', compteRendu: 'Biopsie bénigne', cout: '110' });
      await addAppointment(page, { date: `${yNow}-01-20`, motif: 'Otoscopie', compteRendu: 'Tympan sain', cout: '65' });

      // Search across all 5 stores
      for (const kw of ['Otite', 'Leptospirose', 'NexGard', 'Aurizon', 'Tympan sain']) {
        await searchAnimalKeyword(page, kw);
        assertIncludes(await page.locator('.vue[data-vue="animal"]').textContent(), kw);
      }
      await searchAnimalKeyword(page, '');

      // Chronologie ordering & presence of mixed episodes
      await openChronologieTab(page);
      const chrono = await page.locator('#animal-contenu').textContent();
      assertIncludes(chrono, 'Ancienne dermite');
      assertIncludes(chrono, 'Otite gauche');
      assertIncludes(chrono, 'Aurizon');
      assertIncludes(chrono, 'Dermatologie');
      assertIncludes(chrono, '21,8 kg');

      // 12-month carnet vs tout
      await openAnimalSection(page, 'identite');
      await printCarnetWithOptions(page, {
        periode: '12mois',
        onPrint: async (p) => {
          const text = await p.locator('#carnet').textContent();
          assertIncludes(text, 'Otite gauche');
          assert(!text.includes('Ancienne dermite'), '18-month-old symptom excluded in 12-month carnet');
          assert(!text.includes('Leptospirose'), '15-month-old vaccine excluded in 12-month carnet');
        },
      });
      await printCarnetWithOptions(page, {
        periode: 'tout',
        onPrint: async (p) => {
          const text = await p.locator('#carnet').textContent();
          assertIncludes(text, 'Ancienne dermite');
          assertIncludes(text, 'Leptospirose');
        },
      });

      // Global expenses on Rappels
      await goTab(page, 'rappels');
      const exp = await page.locator('.vue[data-vue="rappels"]').textContent();
      assertMatch(exp, /65,00[\s\u00a0\u202f]*€/);
      assertMatch(exp, /110,00[\s\u00a0\u202f]*€/);
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-SEC-06',
    feature: 'E2E-F19',
    title: 'Security Grid SEC-06: Crypto opacity, tampered ciphertext rejection, R1-R5 XSS neutralization & tel: guard',
    run: async ({ page, monitors, assertNoRuntimeErrors }) => {
      const P1 = '<img src=x onerror=window.__xss=1>';
      const P2 = '<script>window.__xss=2</script>';
      const clip = await setupClipboardSpy(page);
      try {
        await configureEmergencyVet(page, { nom: P1, clinique: P2, telephone: '01 23 45 67 89' });
        await createPet(page, { nom: P1, espece: 'Chien' });
        await openPet(page, P1, 'identite');
        await editAnimalIdentity(page, {
          passeport: P1,
          assuranceCompagnie: P2,
          assuranceContrat: P1,
          assuranceTelephone: '01 80 00 11 22',
        });
        await openAnimalSection(page, 'notes');
        await addNote(page, { date: isoDateOffset(0), categorie: 'symptome', texte: P2, withDocument: true });
        await openAnimalSection(page, 'rdv');
        await addAppointment(page, { date: isoDateOffset(0), motif: P1, compteRendu: P2, cout: '50' });

        await searchAnimalKeyword(page, P1);
        await searchAnimalKeyword(page, '');
        await openChronologieTab(page);

        await openAnimalSection(page, 'identite');
        await triggerLostPetSheet(page);
        assertIncludes(await clip.lastText(), P1);
        await openGarde(page);
        await clickGardeShare(page);
        assertIncludes(await clip.lastText(), P1);

        await page.locator('.vue[data-vue="garde"] button.retour').click();
        await page.locator('.vue[data-vue="animal"]:not([hidden])').waitFor({ state: 'visible' });
        await printCarnetWithOptions(page, {
          periode: 'tout',
          annexe: true,
          onPrint: async (p) => {
            const carnetText = await p.locator('#carnet').textContent();
            assertIncludes(carnetText, P1, 'XSS payload P1 escaped as text in #carnet');
            assertIncludes(carnetText, P2, 'XSS payload P2 escaped as text in #carnet');
            const printSec = await p.evaluate(() => ({
              xss: window.__xss,
              injectedImgs: document.querySelectorAll('#carnet img[src="x"]').length,
              inlineScripts: document.querySelectorAll('#carnet script').length,
            }));
            assertEqual(printSec.xss, undefined, 'XSS payload must not execute during carnet print');
            assertEqual(printSec.injectedImgs, 0, 'Zero injected <img src=x> in #carnet');
            assertEqual(printSec.inlineScripts, 0, 'Zero injected <script> in #carnet');
          },
        });

        // Encrypted export opacity & tampered rejection
        const enc = await exportBackupWithPassword(page, 'SecGrid2026!');
        assert(!enc.raw.includes(P1), 'XSS/pet name must not appear in encrypted backup');
        assert(!enc.raw.includes(P2), 'Note/assurance must not appear in encrypted backup');

        const tampered = structuredClone(enc.data);
        tampered.donnees = tampered.donnees.slice(0, -2) + 'AA';
        const rej = await restoreMaybeEncryptedBackup(page, 'tampered-sec.json', tampered, {
          password: 'SecGrid2026!',
          expectDecryptError: true,
        });
        assertIncludes(rej.decryptError, 'Mot de passe incorrect ou sauvegarde abîmée');

        // tel: guard for crafted vetoUrgence (rejected on import by bd-base.js) & assuranceTelephone (neutralized on render)
        const craftedVetoTel = {
          format: 'omni-animaux-sauvegarde',
          versionFormat: 1,
          reglages: {
            vetoUrgence: { nom: 'Urgence Bad', telephone: 'javascript:window.__xss=9' },
          },
          donnees: {},
        };
        const rejTel = await restoreMaybeEncryptedBackup(page, 'crafted-veto-tel.json', craftedVetoTel, { expectFileRejected: true });
        assertEqual(rejTel.rejected, true, 'Invalid vetoUrgence telephone rejected on backup import');

        const craftedAssuranceTel = {
          format: 'omni-animaux-sauvegarde',
          versionFormat: 1,
          donnees: {
            animaux: [{ id: 'a-sec-tel', nom: 'TelSecPet', assuranceTelephone: 'javascript:window.__xss=10' }],
          },
        };
        const resTel = await restoreMaybeEncryptedBackup(page, 'crafted-assurance-tel.json', craftedAssuranceTel, { mode: 'remplacer' });
        assertEqual(resTel.restored, true);
        await openPet(page, 'TelSecPet', 'identite');
        assertEqual(await page.locator('a[href^="javascript:"]').count(), 0);

        const secState = await page.evaluate(() => ({
          xss: window.__xss,
          injectedImgs: document.querySelectorAll('img[src="x"]').length,
          inlineScripts: document.querySelectorAll('script:not([src])').length,
        }));
        assertEqual(secState.xss, undefined, 'XSS payload must never execute across R1-R5');
        assertEqual(secState.injectedImgs, 0, 'Zero injected <img> elements');
        assertEqual(secState.inlineScripts, 0, 'Zero injected inline <script> elements');
        assertEqual(monitors.cspViolations.length, 0, 'Zero CSP violations');
      } finally {
        await clip.restore();
      }
      await assertNoRuntimeErrors();
    },
  },
  {
    id: 'E2E-T4-AUDIT-01',
    feature: 'E2E-F25',
    title: 'Compliance & PWA Audit: VERSION >= 1.3.0, CACHE >= v10, 100% SW precache, 3-line CC BY-NC-ND 4.0 headers & offline boot',
    run: async ({ browser, context, page, baseUrl, monitors, assertNoRuntimeErrors }) => {
      // 1. VERSION >= 1.3.0 in app.js and #numero-version
      const appText = fs.readFileSync(path.join(REPO_ROOT, 'app.js'), 'utf8');
      const verMatch = appText.match(/const\s+VERSION\s*=\s*'([^']+)'/);
      assertTruthy(verMatch, 'VERSION constant found in app.js');
      const parts = verMatch[1].split('.').map(Number);
      assert(
        parts.length >= 3 && (parts[0] > 1 || (parts[0] === 1 && parts[1] >= 3)),
        `Expected VERSION >= 1.3.0, got ${verMatch[1]}`
      );

      await goTab(page, 'reglages');
      await page.locator('#reglages-contenu').getByRole('button', { name: 'À propos d’Omni-Animalia', exact: true }).click();
      await page.locator('.vue[data-vue="apropos"]:not([hidden])').waitFor({ state: 'visible' });
      assertIncludes(await page.locator('#numero-version').textContent(), verMatch[1]);

      // 2. CACHE >= omni-animalia-v10 and 100% FICHIERS precache
      const swText = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');
      const cacheMatch = swText.match(/const\s+CACHE\s*=\s*'omni-animalia-v(\d+)'/);
      assertTruthy(cacheMatch, 'CACHE constant found in sw.js');
      assert(Number(cacheMatch[1]) >= 10, `Expected CACHE >= omni-animalia-v10, got v${cacheMatch[1]}`);

      const fichiersMatch = swText.match(/const\s+FICHIERS\s*=\s*\[([\s\S]*?)\];/);
      assertTruthy(fichiersMatch, 'FICHIERS array found in sw.js');
      const swFiles = [...fichiersMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

      const htmlText = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
      const scriptSrcs = [...htmlText.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
      for (const s of scriptSrcs) {
        assert(swFiles.includes(s), `sw.js FICHIERS missing script ${s}`);
      }

      // 3. 3-line CC BY-NC-ND 4.0 header & CLAUDE.md hygiene on all root .js files and v130 E2E files
      const rootJsFiles = fs.readdirSync(REPO_ROOT).filter((f) => f.endsWith('.js')).map((f) => path.join(REPO_ROOT, f));
      const e2eV130Files = ['helpers-v130.js', 'tier1-v130.js', 'tier2-v130.js', 'tier3-v130.js', 'tier4-v130.js']
        .map((f) => path.join(REPO_ROOT, 'tests', 'e2e', f));

      for (const filePath of [...rootJsFiles, ...e2eV130Files]) {
        const content = fs.readFileSync(filePath, 'utf8');
        const firstLines = content.split(/\r?\n/).slice(0, 4).join('\n');
        assertIncludes(firstLines, 'Ferrus Dantioch', `3-line header missing Ferrus Dantioch in ${path.basename(filePath)}`);
        assertIncludes(firstLines, 'BY-NC-ND 4.0', `3-line header missing CC BY-NC-ND 4.0 in ${path.basename(filePath)}`);
        assert(!/C:\\Users\\|\/Users\/|\/home\/[a-z]/i.test(content), `Personal local path detected in ${path.basename(filePath)}`);
      }

      // 4. Zero external URLs in runtime JS (only allowed static references)
      const allowedUrlPrefix = [
        'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        'https://calendar.google.com/calendar/render',
        'https://github.com/FerrusDantioch/',
        'http://www.w3.org/2000/svg',
      ];
      for (const filePath of rootJsFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const urls = content.match(/https?:\/\/[^\s'"`)>]+/g) || [];
        for (const u of urls) {
          assert(
            allowedUrlPrefix.some((p) => u.startsWith(p)),
            `Unexpected external URL "${u}" in ${path.basename(filePath)}`
          );
        }
      }

      // 5. Verify Cache Storage & offline boot
      await ensureSwControlled(page);
      const cached = await getCachedPaths(page);
      const basePath = new URL(baseUrl).pathname;
      for (const f of swFiles) {
        const expected = f === './' ? basePath : `${basePath}${f.replace(/^\.\//, '')}`;
        assert(cached.includes(expected), `Cache Storage missing ${expected}`);
      }

      await setOfflineWithSw(browser, context, page, true);
      try {
        await reloadApp(page);
        assertEqual(await page.evaluate(() => !!navigator.serviceWorker.controller), true, 'SW controller active offline');
      } finally {
        await setOfflineWithSw(browser, context, page, false);
      }

      assertEqual(monitors.externalRequests.length, 0, 'Zero external network requests');
      await assertNoRuntimeErrors();
    },
  },
];

module.exports = {
  tier: 4,
  name: 'Tier 4 — R1-R5 Workloads, Security & Compliance (v1.3.0)',
  tests,
};
