/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests unitaires et de régression M4 (écrans ecran-*.js).
   Couvre : BUG-03, BUG-04, BUG-06, BUG-10, BUG-15, BUG-17,
   fuite DOM #carnet à l’impression, garde tel:, mots de passe
   espaces seuls, gestion async try/catch et rendu défensif.

   Lancer :  node tests/unit-m4.js
   ============================================================ */
'use strict';
const { lancer, section, verifier, nouvellePage } = require('./outils.js');

const PARIS = { timezoneId: 'Europe/Paris' };
const pause = (p, ms) => p.waitForTimeout(ms || 250);

async function ouvrir(options) {
  const r = await nouvellePage({ ...PARIS, ...(options || {}) });
  await r.p.waitForSelector('#dialogue[open]', { timeout: 5000 });
  await r.p.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();
  await pause(r.p);
  return r;
}

lancer('Omni-Animalia (M4)', async () => {
  const { ctx, p } = await ouvrir();

  await section('EcranSante : verrous, prises <= 48, annulerPrise, terminer futur, recentsDabord, filtreNotes', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const a1 = { id: 'a_s1', nom: 'Pixel', espece: 'Chat', archive: false };
      const a2 = { id: 'a_s2', nom: 'Moka', espece: 'Chien', archive: false };
      await BD.enregistrer('animaux', a1);
      await BD.enregistrer('animaux', a2);

      const auj = Dates.aujourdhui();
      const jPlus5 = Dates.ajouterJours(auj, 5);
      const jMoins200 = Dates.ajouterJours(auj, -200);
      const jPlus2 = Dates.ajouterJours(auj, 2);

      // 1. Concurrence noterPrise + noterPrise (BUG-03) et purge clés invalides / >120j / futures / >400
      const prisesInit = {
        [jMoins200]: ['08:00'],
        [jPlus2]: ['09:00'],
        'pas-une-date': ['10:00']
      };
      for (let i = 1; i <= 110; i++) {
        prisesInit[Dates.ajouterJours(auj, -i)] = ['08:00'];
      }
      const tConc = {
        id: 't_conc', animalId: 'a_s1', nom: 'Antibio', prisesParJour: 4, statut: 'en-cours',
        debut: auj,
        prises: prisesInit
      };
      const txInit = await BD._transaction('traitements', 'readwrite');
      txInit.objectStore('traitements').put(tConc);
      await BD.finTransaction(txInit);
      await Promise.all([EcranSante.noterPrise(tConc), EcranSante.noterPrise(tConc)]);
      const apresDoubleNoter = await BD.lire('traitements', 't_conc');
      const clesPrises = Object.keys(apresDoubleNoter.prises || {});

      // 2. Concurrence noterPrise + terminer (ne pas perdre terminer ni ressusciter)
      const tTermRace = { id: 't_term_race', animalId: 'a_s1', nom: 'Sirop', prisesParJour: 3, statut: 'en-cours', debut: auj };
      await BD.enregistrer('traitements', tTermRace);
      await Promise.all([
        EcranSante.noterPrise(tTermRace),
        EcranSante.terminer(tTermRace),
        EcranSante.noterPrise(tTermRace)
      ]);
      const apresRaceTerm = await BD.lire('traitements', 't_term_race');

      // 3. Plafond 48 prises/jour vérifié AVANT UI.confirmer (BUG-15)
      const heures48 = Array.from({ length: 48 }, (_, i) =>
        Dates.deuxChiffres(Math.floor(i / 2)) + ':' + (i % 2 === 0 ? '00' : '30'));
      const tMax = {
        id: 't_max48', animalId: 'a_s1', nom: 'Gouttes', prisesParJour: 2, statut: 'en-cours', debut: auj,
        prises: { [auj]: heures48 }
      };
      await BD.enregistrer('traitements', tMax);
      let dialogueOuvert48 = false;
      const origConfirmer = UI.confirmer;
      UI.confirmer = async () => { dialogueOuvert48 = true; return true; };
      await EcranSante.noterPrise(tMax);
      UI.confirmer = origConfirmer;
      const msg48 = document.querySelector('#annonce').textContent;
      const apresMax = await BD.lire('traitements', 't_max48');

      // 3b. Plafond 48 atteint pendant UI.confirmer (relecture post-confirmation)
      const heures47 = Array.from({ length: 47 }, (_, i) =>
        Dates.deuxChiffres(Math.floor(i / 2)) + ':' + (i % 2 === 0 ? '00' : '30'));
      const tMaxRace = {
        id: 't_max47', animalId: 'a_s1', nom: 'Gouttes2', prisesParJour: 2, statut: 'en-cours', debut: auj,
        prises: { [auj]: heures47 }
      };
      await BD.enregistrer('traitements', tMaxRace);
      UI.confirmer = async () => {
        const cur = await BD.lire('traitements', 't_max47');
        cur.prises[auj].push('23:45');
        await BD.enregistrer('traitements', cur);
        return true;
      };
      await EcranSante.noterPrise(tMaxRace);
      UI.confirmer = origConfirmer;
      const msg48PostConfirm = document.querySelector('#annonce').textContent;
      const apresMax47 = await BD.lire('traitements', 't_max47');

      // 4. annulerPrise supprime prises[jour] et maj.prises quand vide, gère concurrence
      const tAnn = {
        id: 't_ann', animalId: 'a_s1', nom: 'Gel', prisesParJour: 2, statut: 'en-cours', debut: auj,
        prises: { [auj]: ['08:00'] }
      };
      await BD.enregistrer('traitements', tAnn);
      UI.confirmer = async () => true;
      await Promise.all([EcranSante.annulerPrise(tAnn), EcranSante.annulerPrise(tAnn)]);
      UI.confirmer = origConfirmer;
      const apresAnn = await BD.lire('traitements', 't_ann');

      // 5. noterPrise / annulerPrise / terminer sur traitement supprimé -> ne ressuscite pas
      const tFantome = { id: 't_fantome', animalId: 'a_s1', nom: 'Fantôme', prisesParJour: 1, statut: 'en-cours', debut: auj, prises: { [auj]: ['08:00'] } };
      await EcranSante.noterPrise(tFantome);
      const msgFantome = document.querySelector('#annonce').textContent;
      await EcranSante.terminer(tFantome);
      const fantomeLu = (await BD.lire('traitements', 't_fantome')) ?? null;

      // 6. terminer(t) avec début futur (BUG-10)
      const tFutur = { id: 't_futur', animalId: 'a_s1', nom: 'Cure future', statut: 'en-cours', debut: jPlus5, fin: Dates.ajouterJours(auj, 10), prisesParJour: 2 };
      await BD.enregistrer('traitements', tFutur);
      EcranAnimal.animal = null;
      await EcranSante.terminer(tFutur);
      const apresFutur = await BD.lire('traitements', 't_futur');
      const rappelsFutur = Rappels.calculer(await BD.toutLire());

      // 7. recentsDabord départage par id décroissant (BUG-04, cohérence Rappels)
      await BD.enregistrer('vaccins', { id: 'v_1', animalId: 'a_s1', nom: 'Rage', date: auj, rappel: Dates.ajouterJours(auj, 30) });
      await BD.enregistrer('vaccins', { id: 'v_2', animalId: 'a_s1', nom: 'Rage', date: auj, rappel: Dates.ajouterJours(auj, 60) });
      const vA = EcranSante.recentsDabord(await BD.parAnimal('vaccins', 'a_s1'), 'date').map((x) => x.id);
      const vB = EcranSante.recentsDabord((await BD.parAnimal('vaccins', 'a_s1')).reverse(), 'date').map((x) => x.id);
      const rV = Rappels.calculer(await BD.toutLire()).filter((x) => x.magasin === 'vaccins').map((x) => x.id);

      // 8. filtreNotes réinitialisé au changement d’animal, préservé pendant édition sur même animal (BUG-06)
      await BD.enregistrer('notes', { id: 'n_1', animalId: 'a_s1', date: auj, categorie: 'allergie', texte: 'Poulet' });
      await BD.enregistrer('notes', { id: 'n_2', animalId: 'a_s2', date: auj, categorie: 'observation', texte: 'Calme' });
      await EcranAnimal.afficher('a_s1', 'notes');
      EcranSante.filtreNotes = { du: auj, au: auj, categorie: 'allergie' };
      await EcranAnimal.rafraichir();
      const filtreConserve = { ...EcranSante.filtreNotes };
      await EcranAnimal.afficher('a_s2', 'notes');
      const filtreApresChangement = { ...EcranSante.filtreNotes };

      // 9. Rendu défensif & try/catch async (formulaireVaccin, vignettesDocuments, heureLisible, NOMS_AP)
      const origTout = BD.tout;
      BD.tout = async () => { throw new Error('panne test'); };
      await EcranSante.formulaireVaccin(a1, null);
      const errVaccin = document.querySelector('#annonce').textContent;
      BD.tout = origTout;

      const vignettes = EcranSante.vignettesDocuments(['https://evil.invalid/a.png', 'data:image/jpeg;base64,AAAA']);
      const nbImgs = vignettes ? vignettes.querySelectorAll('img').length : 0;

      return {
        jMoins200, jPlus2,
        nbPrisesConc: (apresDoubleNoter.prises[auj] || []).length,
        clesPrises,
        apresRaceTermStatut: apresRaceTerm.statut,
        dialogueOuvert48,
        msg48,
        nbMax: apresMax.prises[auj].length,
        msg48PostConfirm,
        nbMax47: apresMax47.prises[auj].length,
        apresAnnPrises: apresAnn.prises,
        msgFantome,
        fantomeLu,
        apresFuturStatut: apresFutur.statut,
        apresFuturFin: apresFutur.fin,
        dansRappels: rappelsFutur.some((x) => x.id === 't_futur'),
        vA, vB, rV,
        filtreConserve, filtreApresChangement,
        errVaccin,
        nbImgs,
        heureBad: EcranSante.heureLisible('invalide')
      };
    });

    verifier(r.nbPrisesConc === 2, 'noterPrise concurrent conserve les 2 prises', r.nbPrisesConc);
    verifier(r.clesPrises.length === 111 && !r.clesPrises.includes('pas-une-date') && !r.clesPrises.includes(r.jMoins200) && !r.clesPrises.includes(r.jPlus2), 'clés prises >120j / futures / invalides purgées', r.clesPrises.length);
    verifier(r.apresRaceTermStatut === 'termine', 'noterPrise + terminer concurrent ne perd pas terminé', r.apresRaceTermStatut);
    verifier(!r.dialogueOuvert48 && r.msg48.includes('48') && r.nbMax === 48 && r.msg48PostConfirm.includes('48') && r.nbMax47 === 48, 'plafond 48 prises refusé avant et après UI.confirmer', r);
    verifier(r.apresAnnPrises === undefined, 'annulerPrise supprime prises[jour] et maj.prises quand vide', r.apresAnnPrises);
    verifier(r.msgFantome.includes('existe plus') && r.fantomeLu === null, 'noterPrise/terminer sur fiche supprimée ne ressuscite pas', r);
    verifier(r.apresFuturStatut === 'termine' && r.apresFuturFin === undefined && !r.dansRappels, 'terminer(t) futur supprime fin et sort des rappels', r);
    verifier(JSON.stringify(r.vA) === JSON.stringify(['v_2', 'v_1']) && JSON.stringify(r.vA) === JSON.stringify(r.vB) && r.rV[0] === 'v_2', 'recentsDabord déterministe et cohérent avec Rappels', r);
    verifier(r.filtreConserve.categorie === 'allergie' && r.filtreApresChangement.categorie === '' && r.filtreApresChangement.du === '', 'filtreNotes conservé sur même animal et réinitialisé sur changement', r);
    verifier(r.errVaccin.includes('panne test'), 'formulaireVaccin intercepte les erreurs async', r.errVaccin);
    verifier(r.nbImgs === 1 && r.heureBad === 'invalide', 'vignettesDocuments filtre imageValide et heureLisible tolère entrée invalide', r);
  });

  await section('EcranAnimal : archive/naissance, carnet #carnet nettoyage, tris déterministes', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const animal = { id: 'a_an1', nom: 'Biscuit', espece: 'Chien', naissance: '2022-05-10', archive: false };
      await BD.enregistrer('animaux', animal);
      await BD.enregistrer('vaccins', { id: 'va1', animalId: 'a_an1', nom: 'V1', date: '2026-01-10' });
      await BD.enregistrer('vaccins', { id: 'va2', animalId: 'a_an1', nom: 'V2', date: '2026-01-10' });

      // 1. formulaireArchive rejette dateArchive < naissance
      EcranAnimal.formulaireArchive(animal);
      await new Promise((ok) => setTimeout(ok, 80));
      const form = document.querySelector('#formulaire-zone form');
      form.querySelector('#champ-motif-0').checked = true;
      form.querySelector('#champ-dateArchive').value = '2020-01-01';
      await Formulaire.soumettre(form);
      const errArch = form.querySelector('[data-champ="dateArchive"] .message-erreur').textContent;
      const ariaInv = form.querySelector('#champ-dateArchive').getAttribute('aria-invalid');
      Formulaire.reinitialiser();
      await Nav.remplacer({ vue: 'accueil' });

      // 2. Impression.lancer : reste peuplé > 400 ms, vidé sur afterprint, matchMedia, erreur window.print, timer 10000 ms
      const titreInitial = document.title;
      const origPrint = window.print;
      window.print = () => {};
      await EcranAnimal.imprimerCarnet(animal);
      const carnetImmediat = document.querySelector('#carnet').textContent;
      const lignesVaccins = [...document.querySelectorAll('#carnet table tbody tr')].map((tr) => tr.textContent);
      await new Promise((ok) => setTimeout(ok, 500));
      const carnetA500 = document.querySelector('#carnet').textContent.length;
      window.dispatchEvent(new Event('afterprint'));
      const carnetApresPrint = document.querySelector('#carnet').children.length;
      const titreApresPrint = document.title;

      // chevauchement T1 -> T2
      Impression.lancer('Titre 1');
      Impression.lancer('Titre 2');
      window.dispatchEvent(new Event('afterprint'));
      const titreApresChevauchement = document.title;

      // erreur synchrone dans window.print()
      window.print = () => { throw new Error('print ko'); };
      await EcranAnimal.imprimerCarnet(animal);
      const carnetApresErr = document.querySelector('#carnet').children.length;
      const titreApresErr = document.title;
      const msgErrPrint = document.querySelector('#annonce').textContent;

      // timer fallback 10000 ms
      window.print = () => {};
      const origSetTimeout = window.setTimeout;
      let cbFallback = null;
      let delaiFallback = null;
      window.setTimeout = (fn, ms) => {
        if (ms >= 5000) { cbFallback = fn; delaiFallback = ms; return 999999; }
        return origSetTimeout(fn, ms);
      };
      document.querySelector('#carnet').append(document.createElement('div'));
      Impression.lancer('Titre Timer');
      window.setTimeout = origSetTimeout;
      if (cbFallback) cbFallback();
      const carnetApresFallback = document.querySelector('#carnet').children.length;
      const titreApresFallback = document.title;
      window.print = origPrint;

      // rafraichir avec animal null ne jette pas
      EcranAnimal.animal = null;
      await EcranAnimal.rafraichir();

      return {
        errArch, ariaInv,
        carnetContient: carnetImmediat.includes('Biscuit'),
        ordreVaccins: lignesVaccins,
        carnetA500, carnetApresPrint, titreApresPrint, titreInitial,
        titreApresChevauchement,
        carnetApresErr, titreApresErr, msgErrPrint,
        delaiFallback, carnetApresFallback, titreApresFallback
      };
    });

    verifier(r.ariaInv === 'true' && r.errArch.includes('naissance'), 'formulaireArchive rejette dateArchive < naissance', r);
    verifier(r.carnetContient && r.carnetA500 > 20, '#carnet reste rempli à +500 ms (compatibilité tester.js)', r.carnetA500);
    verifier(r.ordreVaccins.length === 2 && r.ordreVaccins[0].includes('V2') && r.ordreVaccins[1].includes('V1'), 'imprimerCarnet trie déterministement par date puis id desc', r.ordreVaccins);
    verifier(r.carnetApresPrint === 0 && r.titreApresPrint === r.titreInitial, 'afterprint vide #carnet et restaure document.title', r);
    verifier(r.titreApresChevauchement === r.titreInitial, 'appels chevauchants restaurent le vrai titre initial', r.titreApresChevauchement);
    verifier(r.carnetApresErr === 0 && r.titreApresErr === r.titreInitial && r.msgErrPrint.includes('print ko'), 'erreur window.print() vide #carnet et annonce erreur', r);
    verifier(r.delaiFallback === 10000 && r.carnetApresFallback === 0 && r.titreApresFallback === r.titreInitial, 'minuteur fallback 10000 ms vide #carnet', r);
  });

  await section('EcranAccueil : enregistrements corrompus et rendu défensif', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      await BD.definirReglage('derniereSauvegarde', 'pas-une-date');
      const tx = await BD._transaction('animaux', 'readwrite');
      tx.objectStore('animaux').put({ id: 'corrupt_1', archive: false, photo: 'https://evil.invalid/x.png' });
      tx.objectStore('animaux').put({ id: 'corrupt_2', nom: 'Alpha', archive: false });
      tx.objectStore('animaux').put({ id: 'corrupt_arch', archive: true, dateArchive: 'bad-date', motifArchive: 42 });
      await BD.finTransaction(tx);

      await EcranAccueil.afficher();
      const nbActifs = document.querySelectorAll('#accueil-liste .carte-animal').length;
      const nbImgs = document.querySelectorAll('#accueil-liste img').length;
      await EcranAccueil.afficherArchives();
      const nbArch = document.querySelectorAll('#archives-liste .carte-archive').length;
      await EcranAccueil.supprimerDefinitivement(null);

      return { nbActifs, nbImgs, nbArch };
    });

    verifier(r.nbActifs === 2 && r.nbImgs === 0 && r.nbArch === 1, 'EcranAccueil affiche fiches partielles/corrompues sans erreur ni requête externe', r);
  });

  await section('EcranAgenda : _transaction, verrous marquerFait/annulerFait, 2200-12-31, tris, traitements en retard', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const auj = Dates.aujourdhui();
      const animal = { id: 'a_ag1', nom: 'Moka', archive: false };
      await BD.enregistrer('animaux', animal);

      // 1. BD.base.close() avant marquerFait & annulerFait -> BD._transaction récupère
      const tClose = { id: 't_close', animalId: 'a_ag1', titre: 'Griffes', echeance: auj, recN: 7, recUnite: 'jours', recJour: Dates.lire(auj).getDate(), fait: false };
      await BD.enregistrer('taches', tClose);
      EcranAnimal.animal = null;
      BD.base.close();
      await EcranAgenda.marquerFait(tClose);
      const luClose = await BD.lire('taches', 't_close');
      BD.base.close();
      await EcranAgenda.annulerFait(luClose);
      const luApresClose = await BD.lire('taches', 't_close');

      // 2. Concurrence marquerFait + marquerFait -> exactement 1 suivante
      const tDoublon = { id: 't_doublon', animalId: 'a_ag1', titre: 'Brossage', echeance: auj, recN: 1, recUnite: 'semaines', fait: false };
      await BD.enregistrer('taches', tDoublon);
      await Promise.all([EcranAgenda.marquerFait(tDoublon), EcranAgenda.marquerFait(tDoublon)]);
      const toutesTaches1 = await BD.parAnimal('taches', 'a_ag1');
      const suivantes1 = toutesTaches1.filter((x) => x.id !== 't_doublon' && x.titre === 'Brossage');

      // 3. Concurrence marquerFait + annulerFait -> annulé proprement et suivante supprimée
      const tRace = { id: 't_race2', animalId: 'a_ag1', titre: 'Oreilles', echeance: auj, recN: 1, recUnite: 'mois', fait: false };
      await BD.enregistrer('taches', tRace);
      await Promise.all([EcranAgenda.marquerFait(tRace), EcranAgenda.annulerFait(tRace)]);
      const tRaceApres = await BD.lire('taches', 't_race2');
      const suivantesRace = (await BD.parAnimal('taches', 'a_ag1')).filter((x) => x.titre === 'Oreilles' && x.id !== 't_race2');

      // 4. Concurrence annulerFait + annulerFait
      const tDone = { id: 't_done2', animalId: 'a_ag1', titre: 'Dents', echeance: auj, fait: true, faitLe: auj };
      await BD.enregistrer('taches', tDone);
      await Promise.all([EcranAgenda.annulerFait(tDone), EcranAgenda.annulerFait(tDone)]);
      const tDoneApres = await BD.lire('taches', 't_done2');

      // 5. marquerFait / annulerFait sur tâche supprimée -> pas de résurrection
      await EcranAgenda.marquerFait({ id: 't_abs', animalId: 'a_ag1', titre: 'Absente', fait: false });
      const msgAbs = document.querySelector('#annonce').textContent;
      const absLu = (await BD.lire('taches', 't_abs')) ?? null;

      // 6. Borne 2200-12-31 : pas de suivante sans échéance et pas de '—'
      const t2200 = { id: 't_2200', animalId: 'a_ag1', titre: 'Fin du siècle', echeance: '2200-12-31', recN: 1, recUnite: 'jours', recJour: 31, fait: false };
      await BD.enregistrer('taches', t2200);
      await EcranAgenda.marquerFait(t2200);
      const t2200Apres = await BD.lire('taches', 't_2200');
      const msg2200 = document.querySelector('#annonce').textContent;
      const suivantes2200 = (await BD.parAnimal('taches', 'a_ag1')).filter((x) => x.titre === 'Fin du siècle' && x.id !== 't_2200');

      // 7. Traitements en retard dans Médicaments du jour ET Rappels (BUG-10)
      await BD.enregistrer('traitements', { id: 'tr_ret', animalId: 'a_ag1', nom: 'Cure retard', statut: 'en-cours', prisesParJour: 2, debut: Dates.ajouterJours(auj, -5), fin: Dates.ajouterJours(auj, -1) });
      await BD.enregistrer('traitements', { id: 'tr_fut', animalId: 'a_ag1', nom: 'Cure future', statut: 'en-cours', prisesParJour: 2, debut: Dates.ajouterJours(auj, 2) });
      await BD.enregistrer('traitements', { id: 'tr_fin', animalId: 'a_ag1', nom: 'Cure finie', statut: 'termine', prisesParJour: 2, debut: Dates.ajouterJours(auj, -5), fin: auj });
      await EcranAgenda.afficherRappels();
      const medsTxt = document.querySelector('#rappels-liste .medicaments').textContent;
      const rappelsRetard = Rappels.calculer(await BD.toutLire()).some((x) => x.id === 'tr_ret' && x.ecart < 0);

      // 8. Tris déterministes RDV et tâches à égalité
      await BD.enregistrer('rdv', { id: 'r_1', animalId: 'a_ag1', date: Dates.ajouterJours(auj, 3), heure: '10:00', motif: 'R1' });
      await BD.enregistrer('rdv', { id: 'r_2', animalId: 'a_ag1', date: Dates.ajouterJours(auj, 3), heure: '10:00', motif: 'R2' });
      const zoneRdv = document.createElement('div');
      await EcranAgenda.rdv(zoneRdv, animal);
      const titresRdv = [...zoneRdv.querySelectorAll('.carte-titre')].map((el) => el.textContent);

      await BD.enregistrer('taches', { id: 'ta_1', animalId: 'a_ag1', titre: 'T1', echeance: Dates.ajouterJours(auj, 4), fait: false });
      await BD.enregistrer('taches', { id: 'ta_2', animalId: 'a_ag1', titre: 'T2', echeance: Dates.ajouterJours(auj, 4), fait: false });
      const zoneTaches = document.createElement('div');
      await EcranAgenda.taches(zoneTaches, animal);
      const titresTaches = [...zoneTaches.querySelectorAll('.carte-titre')].map((el) => el.textContent).filter((x) => x === 'T1' || x === 'T2');

      // 9. Rendu défensif et erreurs async carteRappel / formulaireRdv / blocFrais / lieu
      const frais = EcranAgenda.blocFrais([{ cout: NaN, date: '2026-01-01' }, { cout: 50, date: undefined }]);
      const lieuVide = EcranAgenda.lieu('Dr Test', [{ id: 'v_bad' }]);
      const carteBadHeure = EcranAgenda.carteRappel({ id: 'x1', animalId: 'a_ag1', animalNom: 'Moka', titre: 'Test', date: Dates.ajouterJours(auj, 1), heure: '99:99', ecart: 1, type: 'tache', section: 'taches' });
      const origLire = BD.lire;
      BD.lire = async () => { throw new Error('lire ko'); };
      carteBadHeure.querySelector('button.principal').click();
      await new Promise((ok) => setTimeout(ok, 50));
      const errCarteTache = document.querySelector('#annonce').textContent;
      await EcranAgenda.formulaireRdv(animal, null);
      const errFormRdv = document.querySelector('#annonce').textContent;
      BD.lire = origLire;

      return {
        luApresCloseFait: luApresClose.fait,
        suivantes1Len: suivantes1.length,
        tRaceFait: tRaceApres.fait, tRaceSuiv: tRaceApres.suivanteId, suivantesRaceLen: suivantesRace.length,
        tDoneFait: tDoneApres.fait,
        msgAbs, absLu,
        t2200Fait: t2200Apres.fait, t2200Suiv: t2200Apres.suivanteId, msg2200, suivantes2200Len: suivantes2200.length,
        medsHasRet: medsTxt.includes('Cure retard') && medsTxt.includes('toujours en cours'),
        medsHasFutOrFin: medsTxt.includes('Cure future') || medsTxt.includes('Cure finie'),
        rappelsRetard,
        titresRdv,
        titresTaches,
        fraisTxt: frais ? frais.textContent : '',
        lieuVide,
        carteTxt: carteBadHeure.textContent,
        errCarteTache, errFormRdv
      };
    });

    verifier(!r.luApresCloseFait, 'BD._transaction récupère après BD.base.close()');
    verifier(r.suivantes1Len === 1, 'marquerFait concurrent crée exactement 1 tâche suivante', r.suivantes1Len);
    verifier(!r.tRaceFait && !r.tRaceSuiv && r.suivantesRaceLen === 0, 'marquerFait + annulerFait concurrent annule et supprime la suivante', r);
    verifier(!r.tDoneFait, 'annulerFait concurrent propre');
    verifier(r.msgAbs.includes('existe plus') && r.absLu === null, 'marquerFait sur tâche supprimée ne ressuscite pas', r);
    verifier(r.t2200Fait && !r.t2200Suiv && r.suivantes2200Len === 0 && r.msg2200.includes('2200') && !r.msg2200.includes('—'), 'tâche récurrente > 2200-12-31 sans suivante orpheline ni "—"', r);
    verifier(r.medsHasRet && !r.medsHasFutOrFin && r.rappelsRetard, 'traitement en retard cohérent entre Médicaments du jour et Rappels', r);
    verifier(r.titresRdv.length === 2 && r.titresRdv[0].includes('R1') && r.titresRdv[1].includes('R2'), 'rdv à date/heure égale triés par id déterministe', r.titresRdv);
    verifier(JSON.stringify(r.titresTaches) === JSON.stringify(['T1', 'T2']), 'tâches à échéance égale triées par id déterministe', r.titresTaches);
    verifier(r.fraisTxt.includes('Date inconnue') && r.lieuVide === '' && !r.carteTxt.includes('undefined'), 'blocFrais, lieu et carteRappel tolèrent données partielles', r);
    verifier(r.errCarteTache.includes('lire ko') && r.errFormRdv.includes('lire ko'), 'handlers async carteRappel et formulaireRdv protégés', r);
  });

  await section('EcranGarde & EcranVeto : BUG-17 traitements futurs, tel:, téléphone contactGarde, try/catch', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const auj = Dates.aujourdhui();
      const jMoins2 = Dates.ajouterJours(auj, -2);
      const jPlus5 = Dates.ajouterJours(auj, 5);

      await BD.enregistrer('veterinaires', { id: 'v_tiret', nom: 'Dr Tiret', telephone: '---' });
      await BD.enregistrer('veterinaires', { id: 'v_ok', nom: 'Dr Ok', telephone: '01 23 45 67 89' });
      const a = { id: 'a_g1', nom: 'Néo', vetoId: 'v_tiret', archive: false };
      await BD.enregistrer('animaux', a);
      await BD.enregistrer('traitements', { id: 'tg_fut', animalId: 'a_g1', nom: 'Cure future', statut: 'en-cours', debut: jPlus5 });
      await BD.enregistrer('traitements', { id: 'tg_act', animalId: 'a_g1', nom: 'Antibio actif', statut: 'en-cours', debut: jMoins2 });

      // 1. EcranVeto.lienTelephone
      const lTiret = EcranVeto.lienTelephone('---');
      const lPlus = EcranVeto.lienTelephone('+++');
      const lVide = EcranVeto.lienTelephone('   ');
      const lOk = EcranVeto.lienTelephone('01 23 45 67 89');

      await EcranVeto.afficher();
      const vetosTelLinks = [...document.querySelectorAll('#vetos-liste a[href^="tel:"]')].map((x) => x.getAttribute('href'));
      await EcranAnimal.afficher('a_g1', 'identite');
      const animalTelLinks = document.querySelectorAll('#animal-contenu a[href^="tel:"]').length;

      // 2. EcranGarde.construire écran et impression
      await EcranGarde.afficher('a_g1');
      const gardeTxt = document.querySelector('#garde-contenu').textContent;
      const gardeTelLinks = document.querySelectorAll('#garde-contenu a[href^="tel:"]').length;
      const gardeMeds = [...document.querySelectorAll('#garde-contenu .garde-medicament')].map((el) => el.textContent);
      const imprDom = await EcranGarde.construire(a, true);
      const imprTxt = imprDom.textContent;

      // 3. validation contactGarde.telephone alignée avec M2 Sauvegarde.valider
      EcranGarde.formulaireContact({});
      await new Promise((ok) => setTimeout(ok, 80));
      const form = document.querySelector('#formulaire-zone form');
      form.querySelector('#champ-nom').value = 'Ferrus';
      form.querySelector('#champ-telephone').value = '06\t12 34 56 78';
      await Formulaire.soumettre(form);
      const errTab = form.querySelector('[data-champ="telephone"] .message-erreur').textContent;
      form.querySelector('#champ-telephone').value = '06\u00a012 34 56 78';
      await Formulaire.soumettre(form);
      const errNbsp = form.querySelector('[data-champ="telephone"] .message-erreur').textContent;
      form.querySelector('#champ-telephone').value = '06 12 34 56 78';
      await Formulaire.soumettre(form);
      await new Promise((ok) => setTimeout(ok, 100));
      const sauvOk = Sauvegarde.valider(await Sauvegarde.preparer());

      // 4. EcranGarde.imprimer intercepte erreur et garde #carnet vide
      const origParAnimal = BD.parAnimal;
      BD.parAnimal = async () => { throw new Error('garde ko'); };
      await EcranGarde.imprimer(a);
      BD.parAnimal = origParAnimal;
      const carnetApresErr = document.querySelector('#carnet').children.length;
      const msgGardeErr = document.querySelector('#annonce').textContent;

      return {
        tiretTag: lTiret && lTiret.tagName,
        plusTag: lPlus && lPlus.tagName,
        lVide,
        okHref: lOk && lOk.getAttribute('href'),
        vetosTelLinks, animalTelLinks, gardeTelLinks,
        gardeTxt, gardeMeds, imprTxt,
        errTab, errNbsp, sauvOk,
        carnetApresErr, msgGardeErr
      };
    });

    verifier(r.tiretTag === 'SPAN' && r.plusTag === 'SPAN' && r.lVide === null && r.okHref === 'tel:0123456789', 'EcranVeto.lienTelephone garde tel: vide et sans chiffres', r);
    verifier(r.vetosTelLinks.length === 1 && r.vetosTelLinks[0] === 'tel:0123456789' && r.animalTelLinks === 0 && r.gardeTelLinks === 0, 'aucun a[href="tel:"] invalide dans Vétos, Animal, Garde', r);
    verifier(r.gardeTxt.includes('Médicaments en cours') && r.gardeMeds[0].includes('Antibio actif') && r.gardeMeds[0].includes('Depuis le') && r.gardeMeds[1].includes('À venir (à partir du') && r.imprTxt.includes('À venir (à partir du'), 'EcranGarde affiche Depuis le / À venir sur écran et impression', r.gardeMeds);
    verifier(r.errTab.length > 0 && r.errNbsp.length > 0 && r.sauvOk, 'EcranGarde.formulaireContact aligné avec Sauvegarde.valider', r);
    verifier(r.carnetApresErr === 0 && r.msgGardeErr.includes('garde ko'), 'EcranGarde.imprimer vide #carnet et annonce erreur en échec', r);
  });

  await section('EcranReglages : mot de passe espaces seuls, radios try/catch, réinitialisation filtreNotes', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      await Nav.remplacer({ vue: 'reglages' });
      await new Promise((ok) => setTimeout(ok, 100));

      // 1. Mot de passe composé uniquement d’espaces refusé pour activer et changer
      EcranReglages.formulaireMdp('activer');
      await new Promise((ok) => setTimeout(ok, 80));
      const f1 = document.querySelector('#formulaire-zone form');
      f1.querySelector('#champ-nouveau').value = '    ';
      f1.querySelector('#champ-confirmation').value = '    ';
      await Formulaire.soumettre(f1);
      const errEspacesActiver = f1.querySelector('[data-champ="nouveau"] .message-erreur').textContent;
      const actifApresEspaces = await Verrou.actif();

      // Accepter mot de passe valide avec espace interne
      f1.querySelector('#champ-nouveau').value = 'chat 12';
      f1.querySelector('#champ-confirmation').value = 'chat 12';
      await Formulaire.soumettre(f1);
      await new Promise((ok) => setTimeout(ok, 120));
      const actifApresValide = await Verrou.actif();

      EcranReglages.formulaireMdp('changer');
      await new Promise((ok) => setTimeout(ok, 80));
      const f2 = document.querySelector('#formulaire-zone form');
      f2.querySelector('#champ-actuel').value = 'chat 12';
      f2.querySelector('#champ-nouveau').value = '\t   ';
      f2.querySelector('#champ-confirmation').value = '\t   ';
      await Formulaire.soumettre(f2);
      const errEspacesChanger = f2.querySelector('[data-champ="nouveau"] .message-erreur').textContent;
      Formulaire.reinitialiser();
      await BD.definirReglage('motDePasse', null);

      // 2. Radios theme / taille / unitePoids avec BD.definirReglage en échec
      await Nav.remplacer({ vue: 'reglages' });
      await EcranReglages.afficher();
      const origDefReg = BD.definirReglage;
      BD.definirReglage = async () => { throw new Error('reglage ko'); };
      const radioTheme = document.querySelector('input[name="reglage-theme"][value="sombre"]');
      radioTheme.checked = true;
      radioTheme.dispatchEvent(new Event('change'));
      await new Promise((ok) => setTimeout(ok, 50));
      const errRadioTheme = document.querySelector('#annonce').textContent;
      const radioTaille = document.querySelector('input[name="reglage-taille"][value="grand"]');
      radioTaille.checked = true;
      radioTaille.dispatchEvent(new Event('change'));
      await new Promise((ok) => setTimeout(ok, 50));
      const errRadioTaille = document.querySelector('#annonce').textContent;
      const radioUnite = document.querySelector('input[name="reglage-unite"][value="g"]');
      radioUnite.checked = true;
      radioUnite.dispatchEvent(new Event('change'));
      await new Promise((ok) => setTimeout(ok, 50));
      const errRadioUnite = document.querySelector('#annonce').textContent;
      BD.definirReglage = origDefReg;

      // 3. Réinitialisation de EcranSante.filtreNotes et EcranAnimal.animal lors de restaurer / supprimerExemple / toutSupprimer
      await Sauvegarde.chargerExemple();
      const exAnimaux = await BD.tout('animaux');
      EcranAnimal.animal = exAnimaux[0];
      EcranSante.filtreNotes = { du: '2026-01-01', au: '2026-12-31', categorie: 'allergie' };
      const origConf = UI.confirmer;
      UI.confirmer = async () => true;
      await EcranReglages.supprimerExemple();
      const filtreApresEx = { ...EcranSante.filtreNotes };
      const animalApresEx = EcranAnimal.animal;

      EcranSante.filtreNotes = { du: '2026-01-01', au: '2026-12-31', categorie: 'allergie' };
      EcranAnimal.animal = { id: 'old', nom: 'Old' };
      const sauv = await Sauvegarde.preparer();
      const fichier = new File([JSON.stringify(sauv)], 'sauv.json', { type: 'application/json' });
      const origChoisir = UI.choisir;
      UI.choisir = async () => 'remplacer';
      await EcranReglages.restaurer(fichier);
      UI.choisir = origChoisir;
      const filtreApresRest = { ...EcranSante.filtreNotes };
      const animalApresRest = EcranAnimal.animal;

      EcranSante.filtreNotes = { du: '2026-01-01', au: '2026-12-31', categorie: 'allergie' };
      EcranAnimal.animal = { id: 'old', nom: 'Old' };
      await EcranReglages.toutSupprimer();
      UI.confirmer = origConf;
      const filtreApresTout = { ...EcranSante.filtreNotes };
      const animalApresTout = EcranAnimal.animal;

      return {
        errEspacesActiver, actifApresEspaces, actifApresValide, errEspacesChanger,
        errRadioTheme, errRadioTaille, errRadioUnite,
        filtreApresEx, animalApresEx,
        filtreApresRest, animalApresRest,
        filtreApresTout, animalApresTout
      };
    });

    verifier(r.errEspacesActiver.length > 0 && !r.actifApresEspaces && r.actifApresValide && r.errEspacesChanger.length > 0, 'mots de passe composés d’espaces rejetés et phrase avec espace acceptée', r);
    verifier(r.errRadioTheme.includes('reglage ko') && r.errRadioTaille.includes('reglage ko') && r.errRadioUnite.includes('reglage ko'), 'radios theme/taille/unite interceptent erreurs async', r);
    verifier(r.filtreApresEx.categorie === '' && r.animalApresEx === null, 'supprimerExemple réinitialise filtreNotes et animal exemple', r);
    verifier(r.filtreApresRest.categorie === '' && r.animalApresRest === null, 'restaurer (remplacer) réinitialise filtreNotes et EcranAnimal.animal', r);
    verifier(r.filtreApresTout.categorie === '' && r.animalApresTout === null, 'toutSupprimer réinitialise filtreNotes et EcranAnimal.animal', r);
  });

  await ctx.close();
});
