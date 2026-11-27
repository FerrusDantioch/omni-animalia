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

  await section('5. Schéma animaux (poids idéal, passeport, assurance) et vetoUrgence', async () => {
    const res = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      function rejette(fn) {
        try { fn(); return false; } catch (e) { return e; }
      }

      // 1. SCHEMAS.animaux : poidsIdealMin/Max, passeport, assurance*
      const valide = nettoyerFiche('animaux', {
        id: 'a_ext1',
        nom: 'Pixel',
        poidsIdealMin: 4200,
        poidsIdealMax: 4800,
        passeport: '  FR-123456  ',
        assuranceCompagnie: '  Mutuelle Patte  ',
        assuranceContrat: '  POL-999  ',
        assuranceTelephone: '  +33 1 23 45 67 89  '
      });
      const egaux = nettoyerFiche('animaux', { id: 'a_eq', nom: 'Eq', poidsIdealMin: 4000, poidsIdealMax: 4000 });
      const borneSeule = nettoyerFiche('animaux', { id: 'a_one', nom: 'One', poidsIdealMin: 3500 });

      const minZero = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', poidsIdealMin: 0 }));
      const maxNeg = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', poidsIdealMax: -10 }));
      const minNaN = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', poidsIdealMin: NaN }));
      const maxInf = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', poidsIdealMax: Infinity }));
      const minStr = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', poidsIdealMin: '4000' }));
      const ordreInv = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', poidsIdealMin: 5000, poidsIdealMax: 4000 }));
      const telCtrl = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', assuranceTelephone: '01\n02' }));
      const telDel = rejette(() => nettoyerFiche('animaux', { id: 'a1', nom: 'X', assuranceTelephone: '01\x7f02' }));

      const tronque = nettoyerFiche('animaux', {
        id: 'a_tr',
        nom: 'Tr',
        passeport: 'P'.repeat(100),
        assuranceCompagnie: 'C'.repeat(150),
        assuranceContrat: 'N'.repeat(100),
        assuranceTelephone: '0'.repeat(60)
      });

      // 2. nettoyerVetoUrgence & BD.definirReglage('vetoUrgence', ...)
      const vetoVide = nettoyerVetoUrgence({ nom: '   ', clinique: '', telephone: '  ', adresse: '', notes: '' });
      const vetoPropre = nettoyerVetoUrgence({
        nom: '  Dr Urgence  ',
        clinique: '  Clinique 24h  ',
        telephone: '  01 23 45 67 89  ',
        adresse: '  10 rue de la Paix  ',
        notes: '  Ouvert 24/7  '
      });
      const vetoTelInvalide = rejette(() => nettoyerVetoUrgence({ nom: 'Dr', telephone: 'abc' }));
      const vetoTelCourt = rejette(() => nettoyerVetoUrgence({ telephone: '12' }));
      const vetoTelCtrl = rejette(() => nettoyerVetoUrgence({ telephone: '01\n23 45' }));
      const vetoTab = rejette(() => nettoyerVetoUrgence([]));
      const vetoChampNum = rejette(() => nettoyerVetoUrgence({ nom: 123 }));

      await BD.definirReglage('vetoUrgence', {
        nom: '  Clinique Nuit  ',
        telephone: '01 40 00 00 00'
      });
      const regLu = await BD.reglage('vetoUrgence', null);

      let regRejet = false;
      try { await BD.definirReglage('vetoUrgence', { telephone: 'invalide' }); } catch (e) { regRejet = !!(e && e.lisible); }
      const regIntactApresRejet = await BD.reglage('vetoUrgence', null);

      // Export & import vetoUrgence
      const prepAvecVeto = await Sauvegarde.preparer();
      const valAvecVeto = Sauvegarde.valider(JSON.parse(JSON.stringify(prepAvecVeto)));

      // Remplacer sans vetoUrgence efface l'ancien réglage
      const sansVeto = JSON.parse(JSON.stringify(prepAvecVeto));
      delete sansVeto.reglages.vetoUrgence;
      await Sauvegarde.importer(Sauvegarde.valider(sansVeto), 'remplacer');
      const vetoEffaceRemplacer = await BD.reglage('vetoUrgence', null);

      // Importer avec vetoUrgence le restaure
      await Sauvegarde.importer(valAvecVeto, 'remplacer');
      const vetoRestaure = await BD.reglage('vetoUrgence', null);

      // Sauvegarde corrompue sur vetoUrgence rejetée
      const corrVeto = JSON.parse(JSON.stringify(prepAvecVeto));
      corrVeto.reglages.vetoUrgence = { telephone: 'bad' };
      const vetoSvgRejet = rejette(() => Sauvegarde.valider(corrVeto));

      // Effacement via objet vide dans definirReglage
      await BD.definirReglage('vetoUrgence', { nom: '', telephone: '' });
      const vetoSupprVide = await BD.reglage('vetoUrgence', null);

      return {
        valideOk: valide.poidsIdealMin === 4200 && valide.poidsIdealMax === 4800 &&
          valide.passeport === 'FR-123456' && valide.assuranceCompagnie === 'Mutuelle Patte' &&
          valide.assuranceContrat === 'POL-999' && valide.assuranceTelephone === '+33 1 23 45 67 89',
        egauxOk: egaux.poidsIdealMin === 4000 && egaux.poidsIdealMax === 4000,
        borneSeuleOk: borneSeule.poidsIdealMin === 3500 && borneSeule.poidsIdealMax === undefined,
        rejetsAnimauxOk: !!(minZero && maxNeg && minNaN && maxInf && minStr && ordreInv && telCtrl && telDel),
        tronqueOk: tronque.passeport.length === 80 && tronque.assuranceCompagnie.length === 120 &&
          tronque.assuranceContrat.length === 80 && tronque.assuranceTelephone.length === 30,
        vetoVideNull: vetoVide === null,
        vetoPropreOk: vetoPropre && vetoPropre.nom === 'Dr Urgence' && vetoPropre.clinique === 'Clinique 24h' &&
          vetoPropre.telephone === '01 23 45 67 89' && vetoPropre.adresse === '10 rue de la Paix' && vetoPropre.notes === 'Ouvert 24/7',
        vetoRejetsOk: !!(vetoTelInvalide && vetoTelInvalide.lisible && vetoTelCourt && vetoTelCtrl && vetoTab && vetoChampNum),
        regLuOk: regLu && regLu.nom === 'Clinique Nuit' && regLu.telephone === '01 40 00 00 00' && regLu.clinique === '',
        regRejetOk: regRejet && regIntactApresRejet && regIntactApresRejet.nom === 'Clinique Nuit',
        prepVetoOk: prepAvecVeto.reglages.vetoUrgence && prepAvecVeto.reglages.vetoUrgence.nom === 'Clinique Nuit',
        valVetoOk: valAvecVeto.reglages.vetoUrgence && valAvecVeto.reglages.vetoUrgence.telephone === '01 40 00 00 00',
        vetoEffaceRemplacerOk: vetoEffaceRemplacer === null,
        vetoRestaureOk: vetoRestaure && vetoRestaure.nom === 'Clinique Nuit',
        vetoSvgRejetOk: !!(vetoSvgRejet && vetoSvgRejet.lisible),
        vetoSupprVideOk: vetoSupprVide === null
      };
    });

    verifier(res.valideOk && res.egauxOk && res.borneSeuleOk, 'SCHEMAS.animaux conserve poids idéal, passeport et assurance');
    verifier(res.rejetsAnimauxOk, 'nettoyerFiche rejette poidsIdeal <= 0 / NaN / min > max et contrôles dans assuranceTelephone');
    verifier(res.tronqueOk, 'nettoyerFiche borne passeport (80), assuranceCompagnie (120), contrat (80) et téléphone (30)');
    verifier(res.vetoVideNull && res.vetoPropreOk && res.vetoRejetsOk, 'nettoyerVetoUrgence normalise, retourne null si vide et rejette données invalides');
    verifier(res.regLuOk && res.regRejetOk, 'BD.definirReglage("vetoUrgence") assainit et protège contre les écritures invalides');
    verifier(res.prepVetoOk && res.valVetoOk && res.vetoEffaceRemplacerOk && res.vetoRestaureOk && res.vetoSvgRejetOk && res.vetoSupprVideOk,
      'Sauvegarde exporte, valide, restaure et nettoie vetoUrgence');
  });

  await section('6. Sauvegarde chiffrée (R2 : Web Crypto PBKDF2 + AES-GCM et UI Réglages)', async () => {
    const res = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const animal = await BD.enregistrer('animaux', {
        nom: 'ChiffreTest',
        espece: 'Chat',
        notes: 'A'.repeat(10000)
      });

      const clair = await Sauvegarde.preparer();
      const grosPayload = { ...clair, grosChampTest: 'Z'.repeat(120000) };
      const estChiffreeClair = Sauvegarde.estChiffree(clair);
      const estChiffreeNull = Sauvegarde.estChiffree(null);
      const estChiffreeArr = Sauvegarde.estChiffree([]);

      const env1 = await Sauvegarde.chiffrer(grosPayload, 'MonMotDePasse!2026');
      const env2 = await Sauvegarde.chiffrer(grosPayload, 'MonMotDePasse!2026');

      const champsEnvOk = Sauvegarde.estChiffree(env1) &&
        env1.format === Sauvegarde.FORMAT &&
        env1.chiffre === true &&
        env1.versionChiffrement === 1 &&
        env1.kdf === 'PBKDF2-SHA256' &&
        env1.iterations === 210000 &&
        env1.algo === 'AES-GCM' &&
        typeof env1.sel === 'string' && env1.sel.length > 0 &&
        typeof env1.iv === 'string' && env1.iv.length > 0 &&
        typeof env1.donnees === 'string' && env1.donnees.length > 100000;

      const aleaDistinctOk = env1.sel !== env2.sel && env1.iv !== env2.iv && env1.donnees !== env2.donnees;

      const dech = await Sauvegarde.dechiffrer(env1, 'MonMotDePasse!2026');
      const roundTripOk = !!(dech && dech.donnees && dech.donnees.animaux &&
        dech.donnees.animaux.length === 1 && dech.donnees.animaux[0].notes.length === 10000 &&
        dech.grosChampTest && dech.grosChampTest.length === 120000);

      async function capterErreur(fn) {
        try { await fn(); return ''; } catch (e) { return e && e.message ? e.message : 'err'; }
      }

      const errMauvaisMdp = await capterErreur(() => Sauvegarde.dechiffrer(env1, 'MauvaisMotDePasse'));
      const envTamperData = { ...env1, donnees: 'AA' + env1.donnees.slice(2) };
      const errTamperData = await capterErreur(() => Sauvegarde.dechiffrer(envTamperData, 'MonMotDePasse!2026'));
      const envTamperIv = { ...env1, iv: 'AA' + env1.iv.slice(2) };
      const errTamperIv = await capterErreur(() => Sauvegarde.dechiffrer(envTamperIv, 'MonMotDePasse!2026'));
      const errIterBas = await capterErreur(() => Sauvegarde.dechiffrer({ ...env1, iterations: 5000 }, 'MonMotDePasse!2026'));
      const errIterHaut = await capterErreur(() => Sauvegarde.dechiffrer({ ...env1, iterations: 3000000 }, 'MonMotDePasse!2026'));
      const errVerFutur = await capterErreur(() => Sauvegarde.dechiffrer({ ...env1, versionChiffrement: 2 }, 'MonMotDePasse!2026'));
      const errKdf = await capterErreur(() => Sauvegarde.dechiffrer({ ...env1, kdf: 'MD5' }, 'MonMotDePasse!2026'));

      // Enveloppe chiffrée imbriquée refusée par valider()
      const envImbriquee = await Sauvegarde.chiffrer(env1, 'PassImbrique1');
      const dechImbrique = await Sauvegarde.dechiffrer(envImbriquee, 'PassImbrique1');
      const errImbriqueValider = await capterErreur(() => Sauvegarde.valider(dechImbrique));

      // lireFichier avec fichier chiffré et fichier non chiffré
      const fChiffre = await Sauvegarde.fichier(false, 'FichierSecret1');
      const fClair = await Sauvegarde.fichier(false);
      const errSansMdp = await capterErreur(() => Sauvegarde.lireFichier(fChiffre));
      const luChiffre = await Sauvegarde.lireFichier(fChiffre, 'FichierSecret1');
      const luClair = await Sauvegarde.lireFichier(fClair);

      // UI Réglages : 8 blocs, case décochée par défaut
      await Nav.remplacer({ vue: 'reglages' });
      const blocs = document.querySelectorAll('#reglages-contenu .bloc').length;
      const caseEl = document.querySelector('#sauvegarde-chiffree');
      const caseDecocheeDefaut = !!(caseEl && caseEl.type === 'checkbox' && !caseEl.checked);
      const boutonsPresents = !!(document.querySelector('#bouton-sauvegarder') &&
        document.querySelector('#bouton-restaurer') &&
        document.querySelector('#fichier-import'));

      // Export non chiffré quand case décochée (zéro modale supplémentaire)
      const origPartagePossible = Partage.possible;
      const origTelecharger = Partage.telecharger;
      const fichiersTelecharges = [];
      Partage.possible = () => false;
      Partage.telecharger = (f) => { fichiersTelecharges.push(f); };
      try {
        await EcranReglages.sauvegarder();
      } finally {
        Partage.possible = origPartagePossible;
        Partage.telecharger = origTelecharger;
      }
      const exportClairSansModale = fichiersTelecharges.length === 1 &&
        !Sauvegarde.estChiffree(JSON.parse(await fichiersTelecharges[0].text()));

      return {
        animalId: animal.id,
        estChiffreeClair, estChiffreeNull, estChiffreeArr,
        champsEnvOk, aleaDistinctOk, roundTripOk,
        errMauvaisMdp, errTamperData, errTamperIv,
        errIterBas, errIterHaut, errVerFutur, errKdf, errImbriqueValider,
        errSansMdp,
        luChiffreOk: luChiffre && luChiffre.donnees.animaux.length === 1,
        luClairOk: luClair && luClair.donnees.animaux.length === 1,
        blocs, caseDecocheeDefaut, boutonsPresents, exportClairSansModale
      };
    });

    verifier(!res.estChiffreeClair && !res.estChiffreeNull && !res.estChiffreeArr && res.champsEnvOk,
      'enveloppe chiffrée conforme (PBKDF2-SHA256 210000, AES-GCM, sel/iv/donnees)');
    verifier(res.aleaDistinctOk && res.roundTripOk, 'sel et IV aléatoires à chaque chiffrement et grand payload (>100 Ko) déchiffré');
    verifier(res.errMauvaisMdp.includes('Mot de passe incorrect') &&
      res.errTamperData.includes('Mot de passe incorrect') &&
      res.errTamperIv.includes('Mot de passe incorrect'),
      'mauvais mot de passe et données/IV altérés rejetés proprement');
    verifier(res.errIterBas && res.errIterHaut && res.errVerFutur.includes('version plus récente') && res.errKdf && res.errImbriqueValider,
      'paramètres KDF/version invalides et enveloppes imbriquées rejetés');
    verifier(res.errSansMdp && res.luChiffreOk && res.luClairOk,
      'Sauvegarde.lireFichier gère les fichiers chiffrés et reste 100 % compatible non chiffré');
    verifier(res.blocs === 8 && res.caseDecocheeDefaut && res.boutonsPresents && res.exportClairSansModale,
      'EcranReglages garde 8 blocs, case décochée par défaut et export clair direct');

    // Flux UI complet : export chiffré via case cochée + restauration avec mauvais mot de passe puis bon mot de passe
    const uiFlux = await (async () => {
      await p.evaluate(() => {
        window.__telechargesM1 = [];
        window.__origPartagePossibleM1 = Partage.possible;
        window.__origTelechargerM1 = Partage.telecharger;
        Partage.possible = () => false;
        Partage.telecharger = (f) => { window.__telechargesM1.push(f); };
      });

      await p.check('#sauvegarde-chiffree');
      await p.click('#bouton-sauvegarder');
      await p.waitForSelector('#dialogue[open] #dialogue-mdp-conf', { timeout: 5000 });

      // Test erreur de confirmation différente
      await p.fill('#dialogue-mdp', 'Secret2026!');
      await p.fill('#dialogue-mdp-conf', 'Autre2026!');
      await p.click('#dialogue[open] button[type="submit"]');
      const errConfMsg = await p.textContent('#dialogue-mdp-erreur');

      // Mot de passe concordant
      await p.fill('#dialogue-mdp-conf', 'Secret2026!');
      await p.click('#dialogue[open] button[type="submit"]');
      await p.waitForSelector('#dialogue[open]', { state: 'detached', timeout: 5000 });
      await p.waitForFunction(() => window.__telechargesM1.length === 1, { timeout: 10000 });

      const envTexte = await p.evaluate(async () => {
        Partage.possible = window.__origPartagePossibleM1;
        Partage.telecharger = window.__origTelechargerM1;
        return await window.__telechargesM1[0].text();
      });
      const envObj = JSON.parse(envTexte);

      // Efface l'animal pour prouver que la restauration chiffrée le remet en base
      await p.evaluate(async () => {
        await BD.toutEffacer();
        await BD.definirReglage('avertissementVu', true);
        await Nav.remplacer({ vue: 'reglages' });
      });

      // Déclenche restaurer() sur le fichier chiffré
      await p.evaluate((txt) => {
        const f = new File([txt], 'sauvegarde-chiffree.json', { type: 'application/json' });
        window.__restaurerPromesse = EcranReglages.restaurer(f);
      }, envTexte);

      await p.waitForSelector('#dialogue[open] #dialogue-mdp', { timeout: 5000 });
      // Mauvais mot de passe -> réaffiche l'invite avec erreur
      await p.fill('#dialogue-mdp', 'MauvaisMdp');
      await p.click('#dialogue[open] button[type="submit"]');
      await p.waitForFunction(() => {
        const e = document.querySelector('#dialogue-mdp-erreur');
        return e && !e.hidden && e.textContent.includes('Mot de passe incorrect');
      }, { timeout: 10000 });
      const errMauvaisUi = await p.textContent('#dialogue-mdp-erreur');

      // Bon mot de passe -> passe à la fenêtre Fusionner / Remplacer
      await p.fill('#dialogue-mdp', 'Secret2026!');
      await p.click('#dialogue[open] button[type="submit"]');
      await p.waitForFunction(() => {
        const h2 = document.querySelector('#dialogue[open] h2');
        return h2 && h2.textContent.includes('Restaurer cette sauvegarde');
      }, { timeout: 10000 });
      await p.locator('#dialogue[open] button', { hasText: 'Fusionner' }).click();
      await p.evaluate(() => window.__restaurerPromesse);

      const apresRestaurer = await p.evaluate(async () => {
        const animaux = await BD.tout('animaux');
        return { nb: animaux.length, nom: animaux[0] && animaux[0].nom };
      });

      // Annulation au mot de passe ne touche pas la base
      await p.evaluate((txt) => {
        const f = new File([txt], 'sauvegarde-chiffree.json', { type: 'application/json' });
        window.__restaurerAnnul = EcranReglages.restaurer(f);
      }, envTexte);
      await p.waitForSelector('#dialogue[open] #dialogue-mdp', { timeout: 5000 });
      await p.locator('#dialogue[open] button', { hasText: 'Annuler' }).click();
      await p.evaluate(() => window.__restaurerAnnul);

      return { envChiffre: envObj.chiffre === true, errConfMsg, errMauvaisUi, apresRestaurer };
    })();

    verifier(uiFlux.envChiffre && uiFlux.errConfMsg.includes('identiques'),
      'export chiffré UI vérifie la confirmation et produit un fichier chiffré');
    verifier(uiFlux.errMauvaisUi.includes('Mot de passe incorrect') &&
      uiFlux.apresRestaurer.nb === 1 && uiFlux.apresRestaurer.nom === 'ChiffreTest',
      'restauration chiffrée UI gère le mauvais mot de passe puis restaure avec le bon');
  });

  await section('7. Partage.texte (R1) et UI.copier / UI.demanderMotDePasse', async () => {
    const res = await p.evaluate(async () => {
      const origShare = navigator.share;
      const origCanShare = navigator.canShare;
      const origCopier = UI.copier;

      let appelsShare = [];
      let appelsCopier = 0;

      // 1. navigator.share réussit
      navigator.canShare = () => true;
      navigator.share = async (data) => { appelsShare.push(data); };
      UI.copier = async (t) => { appelsCopier++; return true; };
      const rPartage = await Partage.texte('Fiche', 'Contenu test');

      // 2. navigator.share AbortError -> 'annule' sans copier
      navigator.share = async () => {
        const e = new Error('Annulé');
        e.name = 'AbortError';
        throw e;
      };
      const rAnnule = await Partage.texte('Fiche', 'Contenu test');

      // 3. Sans navigator.share -> fallback UI.copier + UI.annoncer concis
      navigator.share = undefined;
      navigator.canShare = undefined;
      UI.copier = origCopier;
      const origClip = navigator.clipboard;
      let copieClip = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (t) => { copieClip = t; } }
      });
      const rCopie = await Partage.texte('Fiche', 'Ligne 1\nLigne 2');
      const copieClipPartage = copieClip;
      const annonceCopie = document.querySelector('#annonce').textContent;

      // 4. UI.copier retourne true / false
      const boolOk = await UI.copier('ABC');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('denied'); } }
      });
      const origExec = document.execCommand;
      document.execCommand = () => false;
      const boolEchec = await UI.copier('ABC');
      const rErreurPartage = await Partage.texte('Fiche', 'Texte');

      // 5. Chaînage UI.demanderMotDePasse -> UI.choisir résout null sans bloquer
      const pMdp = UI.demanderMotDePasse({ titre: 'Mdp', message: 'Test' });
      const pChoix = UI.choisir({ titre: 'Suite', choix: [{ valeur: 'ok', texte: 'OK' }] });
      document.querySelector('#dialogue button').click();
      const [resMdp, resChoix] = await Promise.all([pMdp, pChoix]);

      // Rétablissement
      document.execCommand = origExec;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: origClip });
      navigator.share = origShare;
      navigator.canShare = origCanShare;
      UI.copier = origCopier;

      return {
        rPartage,
        shareTitre: appelsShare[0] && appelsShare[0].title,
        shareTexte: appelsShare[0] && appelsShare[0].text,
        rAnnule,
        appelsCopier,
        rCopie,
        copieClip: copieClipPartage,
        annonceCopie,
        boolOk,
        boolEchec,
        rErreurPartage,
        resMdp,
        resChoix
      };
    });

    verifier(res.rPartage === 'partage' && res.shareTitre === 'Fiche' && res.shareTexte === 'Contenu test',
      'Partage.texte utilise navigator.share({ title, text }) quand disponible');
    verifier(res.rAnnule === 'annule' && res.appelsCopier === 0,
      'Partage.texte ignore AbortError sans copier dans le presse-papiers');
    verifier(res.rCopie === 'copie' && res.copieClip === 'Ligne 1\nLigne 2' && res.annonceCopie === 'Texte copié dans le presse-papiers.',
      'Partage.texte se replie sur UI.copier et affiche une annonce concise', { rCopie: res.rCopie, copieClip: res.copieClip, annonceCopie: res.annonceCopie });
    verifier(res.boolOk === true && res.boolEchec === false && res.rErreurPartage === 'erreur',
      'UI.copier renvoie true/false et Partage.texte signale erreur en cas d’échec');
    verifier(res.resMdp === null && res.resChoix === 'ok',
      'UI.demanderMotDePasse s’intègre avec _fermerDialogue sans casser UI.choisir');
  });

  await ctx.close();
});
