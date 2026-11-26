/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Tests de régression M2 : cycle de vie IndexedDB, nettoyage de schéma (BUG-06),
   validation/import de sauvegarde, et suppression complète de l'exemple (BUG-05). */
'use strict';

const { lancer, section, verifier, nouvellePage } = require('./outils.js');

const PARIS = { timezoneId: 'Europe/Paris' };

async function ouvrirPrete() {
  const { ctx, p } = await nouvellePage(PARIS);
  await p.waitForSelector('#dialogue[open]', { timeout: 5000 });
  await p.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();
  await p.waitForTimeout(300);
  return { ctx, p };
}

lancer('Omni-Animalia — M2', async () => {
  const { ctx, p } = await ouvrirPrete();

  await section('1. Cycle de vie IndexedDB (BD)', async () => {
    const res = await p.evaluate(async () => {
      // Concurrent ouvrir() single-flight when base is cleared
      BD.base.close();
      BD.base = null;
      const [b1, b2, b3] = await Promise.all([BD.ouvrir(), BD.ouvrir(), BD._garantirBase()]);
      const singleFlightOk = b1 === b2 && b2 === b3 && BD.base === b1 && BD._ouverturePromesse === null;

      // Write a record, force-close BD.base directly (simulates abrupt close), verify auto-reopen
      const sauve = await BD.enregistrer('animaux', { nom: 'TestAutoReopen' });
      BD.base.close();
      const relu = await BD.lire('animaux', sauve.id);
      const autoReopenAfterDirectClose = !!(relu && relu.nom === 'TestAutoReopen');

      // Direct BD.enregistrer('reglages', ...) & BD.definirReglage after BD.base.close()
      BD.base.close();
      await BD.enregistrer('reglages', { cle: 'testDirectReglage', valeur: 1 });
      const valDirectReglage = await BD.reglage('testDirectReglage', null);
      BD.base.close();
      await BD.definirReglage('testDefinirReglage', 'ok');
      const valDefinirReglage = await BD.reglage('testDefinirReglage', null);
      await BD.definirReglage('testDirectReglage', null);
      await BD.definirReglage('testDefinirReglage', null);
      const reglagesApresCloseOk = valDirectReglage === 1 && valDefinirReglage === 'ok';

      // Trigger onclose handler (simulates unexpected browser connection closure)
      const ancienneBase = BD.base;
      if (typeof ancienneBase.onclose === 'function') {
        ancienneBase.onclose();
      }
      const baseResetOnClose = BD.base === null;
      const toutApresOnClose = await BD.tout('animaux');
      const reopenAfterOnClose = Array.isArray(toutApresOnClose) && toutApresOnClose.some((a) => a.id === sauve.id) && BD.base !== null;

      // onversionchange while Formulaire.courant is active must NOT reload, must reset BD.base & announce
      const origCourant = Formulaire.courant;
      Formulaire.courant = { test: true };
      const origAnnoncer = UI.annoncer.bind(UI);
      let annonceRecue = '';
      UI.annoncer = (msg, type) => { annonceRecue = msg; return origAnnoncer(msg, type); };
      try {
        // Test with newVersion !== null while form is open
        BD.base.onversionchange({ newVersion: 2 });
        const baseNullePendantForm = BD.base === null;
        const annonceForm = annonceRecue;
        // Next BD operation must auto-reopen transparently
        const apresVersionChange = await BD.lire('animaux', sauve.id);

        // Test with newVersion === null (DB deleted) even without open form -> must NOT reload & must NOT mention form
        Formulaire.courant = null;
        annonceRecue = '';
        BD.base.onversionchange({ newVersion: null });
        const baseNulleSuppression = BD.base === null;
        const annonceSuppression = annonceRecue;
        const apresSuppressionVersion = await BD.tout('animaux');

        // BD.parAnimal must return [] for null, undefined, '' and non-strings (never leak all animals)
        const auj = Dates.aujourdhui();
        const demain = Dates.ajouterJours(auj, 1);
        await BD.enregistrer('pesees', { id: 'p_iso_1', animalId: 'a1', date: auj, grammes: 100 });
        await BD.enregistrer('pesees', { id: 'p_iso_2', animalId: 'a2', date: auj, grammes: 200 });
        await BD.enregistrer('vaccins', { id: 'v_iso_1', animalId: 'a1', nom: 'V1', date: auj, rappel: demain });
        await BD.enregistrer('vaccins', { id: 'v_iso_2', animalId: 'a2', nom: 'V2', date: auj, rappel: demain });
        const paNullPesees = await BD.parAnimal('pesees', null);
        const paUndefPesees = await BD.parAnimal('pesees', undefined);
        const paNullVaccins = await BD.parAnimal('vaccins', null);
        const paUndefVaccins = await BD.parAnimal('vaccins', undefined);
        const paVidePesees = await BD.parAnimal('pesees', '');
        const paNumPesees = await BD.parAnimal('pesees', 123);
        const paA1Pesees = await BD.parAnimal('pesees', 'a1');
        const parAnimalIsolationOk =
          Array.isArray(paNullPesees) && paNullPesees.length === 0 &&
          Array.isArray(paUndefPesees) && paUndefPesees.length === 0 &&
          Array.isArray(paNullVaccins) && paNullVaccins.length === 0 &&
          Array.isArray(paUndefVaccins) && paUndefVaccins.length === 0 &&
          Array.isArray(paVidePesees) && paVidePesees.length === 0 &&
          Array.isArray(paNumPesees) && paNumPesees.length === 0 &&
          Array.isArray(paA1Pesees) && paA1Pesees.length === 1 && paA1Pesees[0].animalId === 'a1';

        // Clean up
        await BD.supprimer('pesees', 'p_iso_1');
        await BD.supprimer('pesees', 'p_iso_2');
        await BD.supprimer('vaccins', 'v_iso_1');
        await BD.supprimer('vaccins', 'v_iso_2');
        await BD.supprimer('animaux', sauve.id);
        return {
          singleFlightOk,
          autoReopenAfterDirectClose,
          reglagesApresCloseOk,
          baseResetOnClose,
          reopenAfterOnClose,
          baseNullePendantForm,
          annonceForm,
          reopenApresVersionChange: !!(apresVersionChange && apresVersionChange.nom === 'TestAutoReopen'),
          baseNulleSuppression,
          annonceSuppression,
          reopenApresSuppressionVersion: Array.isArray(apresSuppressionVersion),
          parAnimalIsolationOk
        };
      } finally {
        Formulaire.courant = origCourant;
        UI.annoncer = origAnnoncer;
      }
    });

    verifier(res.singleFlightOk, 'appels concurrents à BD.ouvrir() partagent une seule requête et nettoient _ouverturePromesse');
    verifier(res.autoReopenAfterDirectClose, 'BD réouvre automatiquement après BD.base.close() (InvalidStateError retry)');
    verifier(res.reglagesApresCloseOk, 'BD.enregistrer("reglages", ...) et BD.definirReglage réouvrent après BD.base.close()');
    verifier(res.baseResetOnClose && res.reopenAfterOnClose, 'db.onclose réinitialise BD.base et la requête suivante réouvre la base');
    verifier(res.baseNullePendantForm && res.reopenApresVersionChange && res.annonceForm.includes('formulaire'),
      'db.onversionchange préserve un Formulaire.courant actif, annonce le formulaire sans recharger, et réouvre ensuite');
    verifier(res.baseNulleSuppression && res.reopenApresSuppressionVersion && res.annonceSuppression.includes('supprimée') && !res.annonceSuppression.includes('formulaire'),
      'db.onversionchange avec newVersion === null ne recharge pas la page, annonce sans mentionner de formulaire, et réouvre ensuite');
    verifier(res.parAnimalIsolationOk, 'BD.parAnimal(magasin, null | undefined | "" | non-string) renvoie [] sans fuite inter-animaux');
  });

  await section('2. BUG-05 : chargerExemple() et suppression en cascade des fiches orphelines', async () => {
    const res = await p.evaluate(async () => {
      await BD.toutEffacer();
      await Sauvegarde.chargerExemple();
      const exempleCharge = await Sauvegarde.exemplePresent();
      const animaux = await BD.tout('animaux');
      const demoChien = animaux.find((a) => a.exemple && a.nom.includes('Biscuit'));
      const demoVeto = (await BD.tout('veterinaires')).find((v) => v.exemple);

      // Create a real non-demo pet referencing the demo vet, plus real child records
      const vrai = await BD.enregistrer('animaux', { nom: 'VraiMinou', espece: 'Chat', vetoId: demoVeto.id });
      const vraiePesee = await BD.enregistrer('pesees', { animalId: vrai.id, date: Dates.aujourdhui(), grammes: 4200 });

      // Add user-created child records (WITHOUT exemple: true) linked to demoChien across all 7 MAGASINS_LIES
      const auj = Dates.aujourdhui();
      const demain = Dates.ajouterJours(auj, 1);
      await BD.enregistrer('pesees', { animalId: demoChien.id, date: auj, grammes: 29000 });
      await BD.enregistrer('vaccins', { animalId: demoChien.id, nom: 'Vaccin utilisateur', date: auj, rappel: demain });
      await BD.enregistrer('antiparasitaires', { animalId: demoChien.id, type: 'vermifuge', date: auj, prochaine: demain });
      await BD.enregistrer('traitements', { animalId: demoChien.id, nom: 'Traitement utilisateur', statut: 'en-cours', prisesParJour: 1 });
      await BD.enregistrer('rdv', { animalId: demoChien.id, date: demain, motif: 'RDV utilisateur' });
      await BD.enregistrer('notes', { animalId: demoChien.id, date: auj, texte: 'Note utilisateur' });
      await BD.enregistrer('taches', { animalId: demoChien.id, titre: 'Tâche utilisateur', echeance: demain, fait: false });

      await Sauvegarde.supprimerExemple();

      const apres = await BD.toutLire();
      const orphelins = {};
      for (const m of MAGASINS_LIES) {
        orphelins[m] = apres[m].filter((r) => r.animalId !== vrai.id).length;
      }
      const vraiRelu = apres.animaux.find((a) => a.id === vrai.id);
      return {
        exempleCharge,
        exempleApres: await Sauvegarde.exemplePresent(),
        nbAnimaux: apres.animaux.length,
        nbVetos: apres.veterinaires.length,
        orphelins,
        vraiIntact: !!(vraiRelu && vraiRelu.nom === 'VraiMinou' && !vraiRelu.vetoId),
        vraiePeseeIntacte: apres.pesees.some((x) => x.id === vraiePesee.id)
      };
    });

    verifier(res.exempleCharge, 'Sauvegarde.chargerExemple() réussit avec le schéma durci');
    verifier(!res.exempleApres, 'Sauvegarde.exemplePresent() retourne false après suppression');
    verifier(res.nbAnimaux === 1 && res.nbVetos === 0, 'seul l’animal réel reste, vétérinaire d’exemple supprimé', [res.nbAnimaux, res.nbVetos]);
    for (const m of ['pesees', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes', 'taches']) {
      verifier(res.orphelins[m] === 0, 'zéro fiche orpheline dans « ' + m + ' »', res.orphelins[m]);
    }
    verifier(res.vraiIntact && res.vraiePeseeIntacte, 'les vraies données sont intactes et le vetoId d’exemple a été délié');
  });

  await section('3. BUG-06 : Durcissement de nettoyerFiche() et BD.enregistrer()', async () => {
    const res = await p.evaluate(async () => {
      const auj = Dates.aujourdhui();
      const demain = Dates.ajouterJours(auj, 1);
      const hier = Dates.ajouterJours(auj, -1);

      function rejette(fn) {
        try { fn(); return false; } catch (e) { return e.message || true; }
      }

      // 1. Whitespace-only mandatory fields
      const wsAnimal = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: '   \t\n  ' }));
      const wsVaccin = rejette(() => nettoyerFiche('vaccins', { id: 'v1', animalId: 'a1', nom: '  ', date: auj }));
      const wsTrait = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: ' ' }));
      const wsTache = rejette(() => nettoyerFiche('taches', { id: 'k1', animalId: 'a1', titre: '\n' }));
      const wsVeto = rejette(() => nettoyerFiche('veterinaires', { id: 'vt1', nom: '   ' }));
      const trimOk = nettoyerFiche('animaux', { id: 'a1', nom: '  Rex  ' }).nom === 'Rex';

      // 2. Numeric bounds
      const gZero = rejette(() => nettoyerFiche('pesees', { id: 'p1', animalId: 'a1', date: auj, grammes: 0 }));
      const gNeg = rejette(() => nettoyerFiche('pesees', { id: 'p1', animalId: 'a1', date: auj, grammes: -5 }));
      const gNaN = rejette(() => nettoyerFiche('pesees', { id: 'p1', animalId: 'a1', date: auj, grammes: NaN }));
      const gDecimalOk = nettoyerFiche('pesees', { id: 'p1', animalId: 'a1', date: auj, grammes: 12.5 }).grammes === 12.5;
      const coutNegZero = nettoyerFiche('rdv', { id: 'r1', animalId: 'a1', date: auj, cout: -0 }).cout;
      const coutNegZeroNorm = Object.is(coutNegZero, 0);

      const recN0 = rejette(() => nettoyerFiche('taches', { id: 'k1', animalId: 'a1', titre: 'T', recN: 0 }));
      const recNFloat = rejette(() => nettoyerFiche('taches', { id: 'k1', animalId: 'a1', titre: 'T', recN: 1.5 }));
      const ppj0 = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', prisesParJour: 0 }));
      const ppjFloat = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', prisesParJour: 1.5 }));
      const ppj49 = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', prisesParJour: 49 }));
      const recJ0 = rejette(() => nettoyerFiche('taches', { id: 'k1', animalId: 'a1', titre: 'T', recJour: 0 }));
      const recJ32 = rejette(() => nettoyerFiche('taches', { id: 'k1', animalId: 'a1', titre: 'T', recJour: 32 }));
      const recJ31Ok = nettoyerFiche('taches', { id: 'k1', animalId: 'a1', titre: 'T', recN: 1, recUnite: 'mois', recJour: 31 }).recJour === 31;

      // 3. prises bounds & validation
      const tropJours = {};
      for (let i = 0; i < 401; i++) tropJours[Dates.ajouterJours('2025-01-01', i)] = ['08:00'];
      const prises401 = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', prises: tropJours }));
      const prisesBadHour = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', prises: { [auj]: ['25:00'] } }));
      const prises49 = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', prises: { [auj]: new Array(49).fill('08:00') } }));
      const prisesEmptyStripped = nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', prises: { [auj]: [] } }).prises === undefined;

      // 4. Unsafe IDs
      const idCrlf = rejette(() => nettoyerFiche('animaux', { id: 'a\r\nb', nom: 'Rex' }));
      const idSlash = rejette(() => nettoyerFiche('animaux', { id: 'a/b', nom: 'Rex' }));
      const idSpace = rejette(() => nettoyerFiche('animaux', { id: 'a b', nom: 'Rex' }));
      const idWs = rejette(() => nettoyerFiche('animaux', { id: '   ', nom: 'Rex' }));
      const idLong = rejette(() => nettoyerFiche('animaux', { id: 'a'.repeat(129), nom: 'Rex' }));
      const vetoBad = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'Rex', vetoId: 'v\nb' }));
      const idValidOk = nettoyerFiche('animaux', { id: 'Abc_123.4-5', nom: 'Rex' }).id === 'Abc_123.4-5';

      // 5. Cross-field date sanity
      const finAvantDebut = rejette(() => nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', debut: auj, fin: hier }));
      const finEgaleDebutOk = nettoyerFiche('traitements', { id: 't1', animalId: 'a1', nom: 'M', debut: auj, fin: auj }).fin === auj;
      const naissanceFutur = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'Rex', naissance: '2099-01-01' }));
      const sterilAvantNaiss = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'Rex', naissance: auj, dateSterilisation: hier }));
      const archAvantNaiss = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'Rex', naissance: auj, dateArchive: hier }));
      const rappelAvantVaccin = rejette(() => nettoyerFiche('vaccins', { id: 'v1', animalId: 'a1', nom: 'V', date: auj, rappel: auj }));
      const prochaineAvantAp = rejette(() => nettoyerFiche('antiparasitaires', { id: 'ap1', animalId: 'a1', type: 'vermifuge', date: auj, prochaine: auj }));

      // 6. Prototype pollution immunity
      const payload = JSON.parse('{"id":"a1","nom":"Rex","__proto__":{"polluted":true},"constructor":{"x":1},"prototype":{"y":1}}');
      const propreProto = nettoyerFiche('animaux', payload);
      const noPollution = ({}).polluted === undefined &&
        !Object.prototype.hasOwnProperty.call(propreProto, '__proto__') &&
        !Object.prototype.hasOwnProperty.call(propreProto, 'constructor') &&
        !Object.prototype.hasOwnProperty.call(propreProto, 'prototype');

      // 7. BD.enregistrer does not mutate caller object and rejects whitespace ID / invalid objects
      const entree = { nom: 'NonMute' };
      const enr = await BD.enregistrer('animaux', entree);
      const callerNotMutated = !('id' in entree) && typeof enr.id === 'string' && enr.id.length > 0;
      await BD.supprimer('animaux', enr.id);

      let wsIdEnrRejet = false;
      try { await BD.enregistrer('animaux', { id: '   ', nom: 'Test' }); } catch (e) { wsIdEnrRejet = true; }
      let nullEnrRejet = false;
      try { await BD.enregistrer('animaux', null); } catch (e) { nullEnrRejet = true; }
      let arrEnrRejet = false;
      try { await BD.enregistrer('animaux', []); } catch (e) { arrEnrRejet = true; }

      return {
        wsAll: !!(wsAnimal && wsVaccin && wsTrait && wsTache && wsVeto && trimOk),
        numAll: !!(gZero && gNeg && gNaN && gDecimalOk && coutNegZeroNorm && recN0 && recNFloat && ppj0 && ppjFloat && ppj49 && recJ0 && recJ32 && recJ31Ok),
        prisesAll: !!(prises401 && prisesBadHour && prises49 && prisesEmptyStripped),
        idsAll: !!(idCrlf && idSlash && idSpace && idWs && idLong && vetoBad && idValidOk),
        datesAll: !!(finAvantDebut && finEgaleDebutOk && naissanceFutur && sterilAvantNaiss && archAvantNaiss && rappelAvantVaccin && prochaineAvantAp),
        noPollution,
        enrAll: !!(callerNotMutated && wsIdEnrRejet && nullEnrRejet && arrEnrRejet)
      };
    });

    verifier(res.wsAll, 'champs obligatoires blancs refusés et textes valides rognés (trim)');
    verifier(res.numAll, 'bornes numériques strictes (grammes > 0 décimal ok, recN/prisesParJour entiers >= 1, recJour 1..31, -0 normalisé)');
    verifier(res.prisesAll, 'prises bornées à 400 jours / 48 heures par jour, HH:MM valide, tableaux vides retirés');
    verifier(res.idsAll, 'identifiants dangereux (CRLF, slash, espace, vide, >128 car.) refusés');
    verifier(res.datesAll, 'cohérence inter-champs des dates (fin>=debut, naissance<=auj, stérilisation/archive>=naissance, rappel>date)');
    verifier(res.noPollution, 'immunité contre la pollution de prototype (__proto__, constructor, prototype)');
    verifier(res.enrAll, 'BD.enregistrer ne mute pas l’objet appelant et rejette id blanc / null / tableau');
  });

  await section('4. Sauvegarde : validation, limites DoS, contactGarde et mode « remplacer »', async () => {
    const res = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const base = await Sauvegarde.preparer();

      function rejetteValider(mod) {
        const obj = JSON.parse(JSON.stringify(base));
        mod(obj);
        try { Sauvegarde.valider(obj); return false; } catch (e) { return e.message || true; }
      }

      // versionFormat checks
      const v0 = rejetteValider((o) => { o.versionFormat = 0; });
      const vNeg = rejetteValider((o) => { o.versionFormat = -1; });
      const vFloat = rejetteValider((o) => { o.versionFormat = 0.5; });
      const vNaN = rejetteValider((o) => { o.versionFormat = NaN; });
      const vFutur = rejetteValider((o) => { o.versionFormat = 2; });
      const vFuturMsgOk = typeof vFutur === 'string' && vFutur.includes('version plus récente');

      // Non-object / array objet & donnees
      let arrObjet = false;
      try { Sauvegarde.valider([]); } catch (e) { arrObjet = true; }
      const arrDonnees = rejetteValider((o) => { o.donnees = []; });

      // > 50 MiB file rejected
      let grosFichierRejete = false;
      try {
        await Sauvegarde.lireFichier({ size: 50 * 1024 * 1024 + 1, text: async () => '{}' });
      } catch (e) { grosFichierRejete = true; }

      // > MAX_FICHES record count rejected
      const tropDeFiches = rejetteValider((o) => {
        o.donnees.notes = new Array(Sauvegarde.MAX_FICHES + 1).fill({ id: 'x', animalId: 'a', date: Dates.aujourdhui(), texte: 'x' });
      });

      // contactGarde checks
      const cgArr = rejetteValider((o) => { o.reglages.contactGarde = []; });
      const cgNomZero = rejetteValider((o) => { o.reglages.contactGarde = { nom: 0 }; });
      const cgNomFalse = rejetteValider((o) => { o.reglages.contactGarde = { nom: false }; });
      const cgTelNum = rejetteValider((o) => { o.reglages.contactGarde = { telephone: 600000000 }; });
      const cgTelAlpha = rejetteValider((o) => { o.reglages.contactGarde = { telephone: 'abc' }; });
      const cgTelShort = rejetteValider((o) => { o.reglages.contactGarde = { telephone: '12' }; });
      const cgTelLong = rejetteValider((o) => { o.reglages.contactGarde = { telephone: '0'.repeat(35) }; });
      const cgTelNewline = rejetteValider((o) => { o.reglages.contactGarde = { telephone: '06\n12\r34' }; });
      const cgTelCr = rejetteValider((o) => { o.reglages.contactGarde = { telephone: '06\r12 34' }; });
      const cgTelTab = rejetteValider((o) => { o.reglages.contactGarde = { telephone: '06\t12 34' }; });

      const cgValideObj = JSON.parse(JSON.stringify(base));
      cgValideObj.reglages.contactGarde = { nom: '  Ferrus  ', telephone: ' 06 00 00 00 00 ' };
      const cgValideRes = Sauvegarde.valider(cgValideObj);
      const cgTrimmedOk = cgValideRes.reglages.contactGarde &&
        cgValideRes.reglages.contactGarde.nom === 'Ferrus' &&
        cgValideRes.reglages.contactGarde.telephone === '06 00 00 00 00';

      const cgVideObj = JSON.parse(JSON.stringify(base));
      cgVideObj.reglages.contactGarde = { nom: '   ', telephone: '  ' };
      const cgVideOmitted = Sauvegarde.valider(cgVideObj).reglages.contactGarde === undefined;

      // importer(..., 'remplacer') clears stale contactGarde/derniereSauvegarde/unitePoids when omitted, preserves motDePasse & debutSuivi
      await BD.definirReglage('motDePasse', { sel: 'abc', empreinte: 'def' });
      await BD.definirReglage('debutSuivi', '2026-01-01');
      await BD.definirReglage('derniereSauvegarde', '2026-10-01');
      await BD.definirReglage('contactGarde', { nom: 'Ancien', telephone: '06 11 11 11 11' });
      await BD.definirReglage('unitePoids', 'g');

      const sansContact = JSON.parse(JSON.stringify(base));
      delete sansContact.reglages.contactGarde;
      delete sansContact.reglages.unitePoids;
      sansContact.donnees.animaux = [{ id: 'imp1', nom: 'Importe' }];
      const valide = Sauvegarde.valider(sansContact);
      await Sauvegarde.importer(valide, 'remplacer');

      const mdpApres = await BD.reglage('motDePasse', null);
      const avertApres = await BD.reglage('avertissementVu', false);
      const debutApres = await BD.reglage('debutSuivi', null);
      const contactApres = await BD.reglage('contactGarde', null);
      const derniereApres = await BD.reglage('derniereSauvegarde', null);
      const uniteApres = await BD.reglage('unitePoids', 'kg');

      return {
        versionsOk: !!(v0 && vNeg && vFloat && vNaN && vFuturMsgOk),
        structuresOk: !!(arrObjet && arrDonnees),
        dosOk: !!(grosFichierRejete && tropDeFiches),
        cgRejetsOk: !!(cgArr && cgNomZero && cgNomFalse && cgTelNum && cgTelAlpha && cgTelShort && cgTelLong && cgTelNewline && cgTelCr && cgTelTab),
        cgTrimmedOk,
        cgVideOmitted,
        remplacerOk: !!(mdpApres && mdpApres.sel === 'abc' && avertApres === true && debutApres === '2026-01-01' && contactApres === null && derniereApres === null && uniteApres === 'kg')
      };
    });

    verifier(res.versionsOk, 'versionFormat invalide (0, -1, 0.5, NaN) rejeté et version > 1 refusée avec message de mise à jour');
    verifier(res.structuresOk, 'objet racine ou donnees en tableau refusé');
    verifier(res.dosOk, 'fichier > 50 Mio et sauvegarde > 50 000 fiches refusés (anti-DoS)');
    verifier(res.cgRejetsOk, 'contactGarde malformé (tableau, bool/number, téléphone invalide) refusé');
    verifier(res.cgTrimmedOk && res.cgVideOmitted, 'contactGarde valide nettoyé/rogné et contact vide omis');
    verifier(res.remplacerOk, 'importer(..., "remplacer") efface contactGarde/derniereSauvegarde/unitePoids obsolètes tout en préservant motDePasse et debutSuivi');
  });

  await ctx.close();
});
