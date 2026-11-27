/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests unitaires et de régression M3 (outils-*).
   Couvre : BUG-02, BUG-04, BUG-07, BUG-08, BUG-09, BUG-11,
   BUG-14, BUG-16, sécurité el() on*, sécurité .ics, noreferrer.

   Lancer :  node tests/unit-m3.js
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

lancer('Omni-Animalia (M3)', async () => {
  const { ctx, p } = await ouvrir();

  await section('Dates : BUG-07 (O(1) > 5000 cycles, validations, borne 2200-12-31)', async () => {
    const r = await p.evaluate(() => {
      const semaines = Dates.prochaineEcheance('1950-01-01', 2, 'semaines', 1, '2026-11-26');
      return {
        jours: Dates.prochaineEcheance('2000-01-01', 1, 'jours', 1, '2026-11-26'),
        semaines,
        semainesEcart: Dates.ecartJours('1950-01-01', semaines),
        moisAncre31: Dates.prochaineEcheance('2000-01-31', 1, 'mois', 31, '2026-02-28'),
        moisAncre31Mar: Dates.prochaineEcheance('2000-01-31', 1, 'mois', 31, '2026-03-30'),
        moisAncre31Apr: Dates.prochaineEcheance('2000-01-31', 1, 'mois', 31, '2026-03-31'),
        ansAncre29: Dates.prochaineEcheance('2004-02-29', 1, 'ans', 29, '2028-02-28'),
        ansAncre29Next: Dates.prochaineEcheance('2004-02-29', 1, 'ans', 29, '2028-02-29'),
        memeJour: Dates.prochaineEcheance('2026-11-26', 3, 'jours', 1, '2026-11-26'),
        dejaFutur: Dates.prochaineEcheance('2026-12-01', 3, 'jours', 1, '2026-11-26'),
        sansApres: Dates.prochaineEcheance('2026-11-01', 2, 'jours', 1, ''),
        apresInvalide: Dates.prochaineEcheance('2026-11-01', 1, 'jours', 1, 'abc'),
        echInvalide: Dates.prochaineEcheance('2026-02-30', 1, 'jours', 1, '2026-11-26'),
        nZero: Dates.prochaineEcheance('2026-11-01', 0, 'jours', 1, '2026-11-26'),
        nNeg: Dates.prochaineEcheance('2026-11-01', -1, 'jours', 1, '2026-11-26'),
        nFloat: Dates.prochaineEcheance('2026-11-01', 1.5, 'jours', 1, '2026-11-26'),
        nNaN: Dates.prochaineEcheance('2026-11-01', NaN, 'jours', 1, '2026-11-26'),
        nInf: Dates.prochaineEcheance('2026-11-01', Infinity, 'jours', 1, '2026-11-26'),
        uniteInvalide: Dates.prochaineEcheance('2026-11-01', 1, 'heures', 1, '2026-11-26'),
        borneJours: Dates.ajouterJours('2200-12-31', 1),
        borneMois: Dates.ajouterMois('2200-12-01', 1),
        borneProchaine: Dates.prochaineEcheance('2200-12-31', 1, 'jours', 1, '2200-12-31'),
        ajJoursNaN: Dates.ajouterJours('2026-01-01', NaN),
        ajJoursFloat: Dates.ajouterJours('2026-01-01', 1.5),
        ajMoisFloat: Dates.ajouterMois('2026-01-01', 1.5),
        ajIntFloat: Dates.ajouterIntervalle('2026-01-01', 1.5, 'jours'),
        txtZero: Dates.texteRecurrence(0, 'jours'),
        txtNeg: Dates.texteRecurrence(-2, 'mois'),
        txtFloat: Dates.texteRecurrence(1.5, 'semaines'),
        txtOk: Dates.texteRecurrence(3, 'mois')
      };
    });
    verifier(r.jours === '2026-11-27', 'prochaineEcheance > 5000 jours en retard', r.jours);
    verifier(r.semaines > '2026-11-26' && r.semainesEcart % 14 === 0, 'prochaineEcheance semaines depuis 1950', r.semaines);
    verifier(r.moisAncre31 === '2026-03-31', 'ancre 31 sur 2026-02-28 -> 2026-03-31', r.moisAncre31);
    verifier(r.moisAncre31Mar === '2026-03-31', 'ancre 31 sur 2026-03-30 -> 2026-03-31', r.moisAncre31Mar);
    verifier(r.moisAncre31Apr === '2026-04-30', 'ancre 31 sur 2026-03-31 -> 2026-04-30', r.moisAncre31Apr);
    verifier(r.ansAncre29 === '2028-02-29' && r.ansAncre29Next === '2029-02-28', 'ancre 29/02 bissextile', [r.ansAncre29, r.ansAncre29Next]);
    verifier(r.memeJour === '2026-11-29' && r.dejaFutur === '2026-12-04' && r.sansApres === '2026-11-03', 'cas standards memeJour/futur/sansApres', [r.memeJour, r.dejaFutur, r.sansApres]);
    verifier(r.apresInvalide === '' && r.echInvalide === '' && r.nZero === '' && r.nNeg === '' && r.nFloat === '' && r.nNaN === '' && r.nInf === '' && r.uniteInvalide === '', 'entrées invalides refusées', r);
    verifier(r.borneJours === '' && r.borneMois === '' && r.borneProchaine === '', 'borne 2200-12-31 respectée', [r.borneJours, r.borneMois, r.borneProchaine]);
    verifier(r.ajJoursNaN === '' && r.ajJoursFloat === '' && r.ajMoisFloat === '' && r.ajIntFloat === '', 'ajouterJours/Mois/Intervalle rejettent non-entiers');
    verifier(r.txtZero === '' && r.txtNeg === '' && r.txtFloat === '' && r.txtOk === 'tous les 3 mois', 'texteRecurrence valide n entier >= 1');
  });

  await section('Interface : el() rejette les attributs on* non-fonctions', async () => {
    const r = await p.evaluate(() => {
      window.__xss = 0;
      const a = el('div', { onclick: 'window.__xss=1', onClick: 'window.__xss=2', ONERROR: 'window.__xss=3', onload: 123, onfocus: true, on: () => {} });
      let clique = 0;
      const b = el('button', { onClick: () => { clique++; } }, 'Test');
      b.click();
      const c = bouton('Neutre', null);
      document.body.append(a);
      a.click();
      a.remove();
      return {
        xss: window.__xss,
        attrLower: a.getAttribute('onclick'),
        attrMixed: a.getAttribute('onClick'),
        attrErr: a.getAttribute('ONERROR'),
        attrLoad: a.getAttribute('onload'),
        attrFocus: a.getAttribute('onfocus'),
        attrOn: a.getAttribute('on'),
        attrBtn: b.getAttribute('onClick'),
        clique,
        neutreTag: c.tagName
      };
    });
    verifier(r.xss === 0, 'aucun code chaîne on* exécuté');
    verifier(r.attrLower === null && r.attrMixed === null && r.attrErr === null && r.attrLoad === null && r.attrFocus === null && r.attrOn === null && r.attrBtn === null, 'aucun attribut on* posé via setAttribute', r);
    verifier(r.clique === 1 && r.neutreTag === 'BUTTON', 'handlers fonctions attachés et bouton(null) conservé', r);
  });

  await section('Interface : BUG-02 (Formulaire.reinitialiser & Annuler)', async () => {
    await p.click('#accueil-actions button');
    await pause(p);
    const avant = await p.evaluate(() => !!Formulaire.courant);
    verifier(avant, 'Formulaire.courant actif après ouverture');
    await p.click('#formulaire-zone .formulaire-boutons button.secondaire');
    await pause(p, 500);
    const apresAnnuler = await p.evaluate(() => ({
      courant: Formulaire.courant,
      enfants: document.querySelector('#formulaire-zone').children.length
    }));
    verifier(apresAnnuler.courant === null && apresAnnuler.enfants === 0, 'Annuler vide Formulaire.courant et #formulaire-zone', apresAnnuler);
    await p.goForward();
    await pause(p, 500);
    const apresAvancer = await p.evaluate(() => ({
      vue: Nav.etat && Nav.etat.vue,
      courant: Formulaire.courant
    }));
    verifier(apresAvancer.vue !== 'formulaire' && apresAvancer.courant === null, 'Bouton Avancer ne rouvre pas le formulaire annulé', apresAvancer);

    const directReset = await p.evaluate(() => {
      Formulaire.courant = { titre: 'Test', champs: [] };
      Formulaire._enCours = true;
      Formulaire._compressionsEnCours = 2;
      Formulaire.reinitialiser();
      return { c: Formulaire.courant, e: Formulaire._enCours, p: Formulaire._compressionsEnCours };
    });
    verifier(directReset.c === null && directReset.e === false && directReset.p === 0, 'Formulaire.reinitialiser() remet tout à zéro', directReset);

    // Régression BUG-02 : Annuler synchrone suivi immédiatement de Formulaire.ouvrir(def2)
    await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Formulaire 1',
        champs: [{ nom: 'champ1', label: 'Champ 1', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 150);
    await p.evaluate(() => {
      document.querySelector('#formulaire-zone .formulaire-boutons button.secondaire').click();
      Formulaire.ouvrir({
        titre: 'Formulaire 2',
        champs: [{ nom: 'champ2', label: 'Champ 2', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 350);
    const apresRaceAnnuler = await p.evaluate(() => ({
      vue: Nav.etat && Nav.etat.vue,
      titre: Formulaire.courant && Formulaire.courant.titre,
      vueCachee: document.querySelector('[data-vue="formulaire"]').hidden,
      aChamp2: !!document.querySelector('#formulaire-zone #champ-champ2')
    }));
    verifier(apresRaceAnnuler.vue === 'formulaire' && apresRaceAnnuler.titre === 'Formulaire 2' && !apresRaceAnnuler.vueCachee && apresRaceAnnuler.aChamp2,
      'Annuler synchrone + Formulaire.ouvrir(def2) survit au popstate', apresRaceAnnuler);

    // Régression BUG-02 : soumettre() suivi immédiatement de Formulaire.ouvrir(def3)
    await p.evaluate(async () => {
      await Formulaire.soumettre(document.querySelector('#formulaire-zone form'));
      Formulaire.ouvrir({
        titre: 'Formulaire 3',
        champs: [{ nom: 'champ3', label: 'Champ 3', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 350);
    const apresRaceSoumettre = await p.evaluate(() => ({
      vue: Nav.etat && Nav.etat.vue,
      titre: Formulaire.courant && Formulaire.courant.titre,
      aChamp3: !!document.querySelector('#formulaire-zone #champ-champ3')
    }));
    verifier(apresRaceSoumettre.vue === 'formulaire' && apresRaceSoumettre.titre === 'Formulaire 3' && apresRaceSoumettre.aChamp3,
      'soumettre() + Formulaire.ouvrir(def3) survit au popstate', apresRaceSoumettre);

    await p.click('#formulaire-zone .formulaire-boutons button.secondaire');
    await pause(p, 350);

    // Régression r3 : Annuler -> ouvrir(def) -> reinitialiser() explicite ne rouvre pas def
    await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Formulaire R1',
        champs: [{ nom: 'champR1', label: 'Champ R1', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 150);
    await p.evaluate(() => {
      document.querySelector('#formulaire-zone .formulaire-boutons button.secondaire').click();
      Formulaire.ouvrir({
        titre: 'Formulaire Fantome',
        champs: [{ nom: 'champFantome', label: 'Fantôme', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
      Formulaire.reinitialiser();
    });
    await pause(p, 350);
    const apresResetExplicite = await p.evaluate(() => ({
      vue: Nav.etat && Nav.etat.vue,
      courant: Formulaire.courant,
      attente: Formulaire._attenteOuverture,
      enfants: document.querySelector('#formulaire-zone').children.length
    }));
    verifier(apresResetExplicite.vue !== 'formulaire' && apresResetExplicite.courant === null && apresResetExplicite.attente === null && apresResetExplicite.enfants === 0,
      'Annuler + ouvrir(def) + reinitialiser() explicite reste fermé sans rouvrir def', apresResetExplicite);

    // Régression r3 : Annuler -> reinitialiser() -> ouvrir(def2) pendant _retourEnCours ouvre def2
    await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Formulaire R2a',
        champs: [{ nom: 'champR2a', label: 'Champ R2a', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 150);
    await p.evaluate(() => {
      document.querySelector('#formulaire-zone .formulaire-boutons button.secondaire').click();
      Formulaire.reinitialiser();
      Formulaire.ouvrir({
        titre: 'Formulaire R2b',
        champs: [{ nom: 'champR2b', label: 'Champ R2b', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 350);
    const apresResetPuisOuvrir = await p.evaluate(() => ({
      vue: Nav.etat && Nav.etat.vue,
      titre: Formulaire.courant && Formulaire.courant.titre,
      aChampR2b: !!document.querySelector('#formulaire-zone #champ-champR2b')
    }));
    verifier(apresResetPuisOuvrir.vue === 'formulaire' && apresResetPuisOuvrir.titre === 'Formulaire R2b' && apresResetPuisOuvrir.aChampR2b,
      'Annuler + reinitialiser() explicite puis ouvrir(def2) ouvre def2 après popstate', apresResetPuisOuvrir);

    // Régression r3 : Annuler -> ouvrir(def) -> Nav.aller({ vue: 'rappels' }) ne rouvre pas def
    await p.evaluate(() => {
      document.querySelector('#formulaire-zone .formulaire-boutons button.secondaire').click();
      Formulaire.ouvrir({
        titre: 'Formulaire Fantome Nav',
        champs: [{ nom: 'champFantomeNav', label: 'Fantôme Nav', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
      Nav.aller({ vue: 'rappels' });
    });
    await pause(p, 350);
    const apresNavRappelsRace = await p.evaluate(() => ({
      vue: Nav.etat && Nav.etat.vue,
      courant: Formulaire.courant,
      attente: Formulaire._attenteOuverture,
      enfants: document.querySelector('#formulaire-zone').children.length
    }));
    verifier(apresNavRappelsRace.vue !== 'formulaire' && apresNavRappelsRace.courant === null && apresNavRappelsRace.attente === null && apresNavRappelsRace.enfants === 0,
      'Annuler + ouvrir(def) + Nav.aller({ vue: "rappels" }) ne rouvre pas def', apresNavRappelsRace);

    // Régression r3 : Nav.aller({ vue: 'rappels' }) direct depuis un formulaire reste sur rappels
    await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Formulaire Direct Nav',
        champs: [{ nom: 'champDirectNav', label: 'Direct Nav', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 150);
    await p.evaluate(() => {
      Nav.aller({ vue: 'rappels' });
    });
    await pause(p, 250);
    const apresNavRappelsDirect = await p.evaluate(() => ({
      vue: Nav.etat && Nav.etat.vue,
      courant: Formulaire.courant,
      attente: Formulaire._attenteOuverture
    }));
    verifier(apresNavRappelsDirect.vue === 'rappels' && apresNavRappelsDirect.courant === null && apresNavRappelsDirect.attente === null,
      'Nav.aller({ vue: "rappels" }) depuis formulaire reste sur rappels', apresNavRappelsDirect);
    await p.evaluate(() => Nav.remplacer({ vue: 'accueil' }));
    await pause(p, 150);

    // Régression r3 : #verrou visible pendant popstate empêche la réouverture de enAttente
    await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Formulaire Verrou 1',
        champs: [{ nom: 'champV1', label: 'V1', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 150);
    await p.evaluate(() => {
      document.querySelector('#formulaire-zone .formulaire-boutons button.secondaire').click();
      Formulaire.ouvrir({
        titre: 'Formulaire Verrou 2',
        champs: [{ nom: 'champV2', label: 'V2', type: 'texte' }],
        enregistrer: async () => 'OK'
      });
      document.querySelector('#verrou').hidden = false;
    });
    await pause(p, 350);
    const apresVerrouPopstate = await p.evaluate(() => {
      const res = {
        verrouHidden: document.querySelector('#verrou').hidden,
        courant: Formulaire.courant,
        attente: Formulaire._attenteOuverture,
        retourEnCours: Formulaire._retourEnCours,
        enfants: document.querySelector('#formulaire-zone').children.length
      };
      document.querySelector('#verrou').hidden = true;
      Nav.remplacer({ vue: 'accueil' });
      return res;
    });
    await pause(p, 150);
    verifier(!apresVerrouPopstate.verrouHidden && apresVerrouPopstate.courant === null && apresVerrouPopstate.attente === null && !apresVerrouPopstate.retourEnCours && apresVerrouPopstate.enfants === 0,
      '#verrou visible pendant popstate ne rouvre pas enAttente', apresVerrouPopstate);
  });

  await section('Interface : BUG-11 (aria-invalid sur groupe radios et effacement)', async () => {
    await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Test Radios',
        champs: [
          { nom: 'unite', label: 'Unité', type: 'radios', requis: true, options: [{ valeur: 'kg', texte: 'kg' }, { valeur: 'g', texte: 'g' }] },
          { nom: 'nom', label: 'Nom', type: 'texte', requis: true },
          { nom: 'sterilise', label: 'Stérilisé', type: 'case' },
          { nom: 'dateSterilisation', label: 'Date', type: 'date', pasDansFutur: true, visibleSi: (v) => v.sterilise }
        ],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p);
    await p.click('#formulaire-zone button[type="submit"]');
    await pause(p);
    const invalide = await p.evaluate(() => {
      const bloc = document.querySelector('[data-champ="unite"]');
      const fs = bloc.querySelector('fieldset');
      const radios = [...bloc.querySelectorAll('input[type="radio"]')];
      return {
        fs: fs.getAttribute('aria-invalid'),
        radios: radios.map((r) => r.getAttribute('aria-invalid')),
        nom: document.querySelector('#champ-nom').getAttribute('aria-invalid')
      };
    });
    verifier(invalide.fs === 'true' && invalide.radios.length === 2 && invalide.radios.every((v) => v === 'true'), 'fieldset et tous les radios marqués aria-invalid="true"', invalide);

    await p.check('#champ-unite-0');
    await pause(p, 150);
    const apresChoix = await p.evaluate(() => {
      const bloc = document.querySelector('[data-champ="unite"]');
      return bloc.querySelectorAll('[aria-invalid]').length;
    });
    verifier(apresChoix === 0, 'sélection d’un radio efface aria-invalid immédiatement', apresChoix);

    // Re-soumission avec nom encore vide : unite reste sans aria-invalid
    await p.click('#formulaire-zone button[type="submit"]');
    await pause(p);
    const apresResubmit = await p.evaluate(() => ({
      unite: document.querySelectorAll('[data-champ="unite"] [aria-invalid]').length,
      nom: document.querySelector('#champ-nom').getAttribute('aria-invalid')
    }));
    verifier(apresResubmit.unite === 0 && apresResubmit.nom === 'true', 'unite reste valide à la re-soumission tandis que nom est marqué invalide', apresResubmit);

    // Déclenche erreur sur champ conditionnel puis le masque
    await p.check('#champ-sterilise');
    await p.fill('#champ-dateSterilisation', '2099-01-01');
    await p.click('#formulaire-zone button[type="submit"]');
    await pause(p);
    const sterInvalide = await p.getAttribute('#champ-dateSterilisation', 'aria-invalid');
    verifier(sterInvalide === 'true', 'champ conditionnel invalide marqué aria-invalid');
    await p.uncheck('#champ-sterilise');
    await pause(p, 150);
    const sterMasque = await p.getAttribute('#champ-dateSterilisation', 'aria-invalid');
    verifier(sterMasque === null, 'masquer un bloc conditionnel nettoie aria-invalid', sterMasque);

    // Régression BUG-11 : .message-erreur sur visibleSi radios effacé et caché après masquer + réafficher
    await p.click('#formulaire-zone .formulaire-boutons button.secondaire');
    await pause(p, 250);
    await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Test visibleSi erreur',
        valeurs: { montrer: true },
        champs: [
          { nom: 'montrer', label: 'Montrer', type: 'case' },
          { nom: 'choixVis', label: 'Choix', type: 'radios', requis: true, options: [{ valeur: 'a', texte: 'A' }, { valeur: 'b', texte: 'B' }], visibleSi: (v) => v.montrer }
        ],
        enregistrer: async () => 'OK'
      });
    });
    await pause(p, 150);
    await p.click('#formulaire-zone button[type="submit"]');
    await pause(p, 150);
    await p.uncheck('#champ-montrer');
    await pause(p, 100);
    await p.check('#champ-montrer');
    await pause(p, 100);
    const apresReaffichage = await p.evaluate(() => {
      const bloc = document.querySelector('[data-champ="choixVis"]');
      const msg = bloc.querySelector('.message-erreur');
      return {
        blocHidden: bloc.hidden,
        anyAriaInvalid: bloc.querySelectorAll('[aria-invalid]').length,
        errHidden: msg.hidden,
        errText: msg.textContent
      };
    });
    verifier(!apresReaffichage.blocHidden && apresReaffichage.anyAriaInvalid === 0 && apresReaffichage.errHidden && apresReaffichage.errText === '',
      'masquer puis réafficher un bloc visibleSi garde .message-erreur caché et vide', apresReaffichage);

    await p.click('#formulaire-zone .formulaire-boutons button.secondaire');
    await pause(p);
  });

  await section('Interface : BUG-14 (attente compression photo/docs & annulation)', async () => {
    const r = await p.evaluate(async () => {
      const jpgOk = 'data:image/jpeg;base64,' + btoa('fakejpeg');
      const jpgOld = 'data:image/jpeg;base64,' + btoa('oldjpeg');
      const originalReduire = Photo.reduire;
      let resoudre1;
      let sauve = null;
      try {
        Formulaire.ouvrir({
          titre: 'Test Photo',
          champs: [
            { nom: 'photo', label: 'Photo', type: 'photo' },
            { nom: 'pieces', label: 'Documents', type: 'photos' }
          ],
          enregistrer: async (v) => { sauve = v; return 'OK'; }
        });
        await new Promise((ok) => setTimeout(ok, 50));

        const form = document.querySelector('#formulaire-zone form');
        const btnSubmit = form.querySelector('button[type="submit"]');

        // 1. Photo lente + soumission immédiate
        Photo.reduire = () => new Promise((ok) => { resoudre1 = ok; });
        const dt1 = new DataTransfer();
        dt1.items.add(new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
        const inputPhoto = form.querySelector('[data-champ="photo"] input[type="file"]');
        inputPhoto.files = dt1.files;
        inputPhoto.dispatchEvent(new Event('change'));
        const desactivePendant = btnSubmit.disabled;

        const promSoumission = Formulaire.soumettre(form);
        await new Promise((ok) => setTimeout(ok, 30));
        const sauveAvant = sauve;
        resoudre1(jpgOk);
        await promSoumission;
        await new Promise((ok) => setTimeout(ok, 150));

        // 2. Retirer pendant compression en vol ne doit pas ressusciter la photo
        Formulaire.ouvrir({
          titre: 'Test Retirer',
          valeurs: { photo: jpgOld },
          champs: [{ nom: 'photo', label: 'Photo', type: 'photo' }],
          enregistrer: async () => 'OK'
        });
        await new Promise((ok) => setTimeout(ok, 50));
        const form2 = document.querySelector('#formulaire-zone form');
        let resoudreRetirer;
        Photo.reduire = () => new Promise((ok) => { resoudreRetirer = ok; });
        const dt2 = new DataTransfer();
        dt2.items.add(new File(['y'], 'p2.jpg', { type: 'image/jpeg' }));
        const inputPhoto2 = form2.querySelector('[data-champ="photo"] input[type="file"]');
        inputPhoto2.files = dt2.files;
        inputPhoto2.dispatchEvent(new Event('change'));
        form2.querySelector('[data-champ="photo"] .rangee-boutons button:last-of-type').click();
        resoudreRetirer(jpgOk);
        await new Promise((ok) => setTimeout(ok, 30));
        const valeurApresRetirer = form2.querySelector('[name="photo"]').value;
        Formulaire.reinitialiser();
        await new Promise((ok) => setTimeout(ok, 50));

        // 3. Documents : MAX_PIECES et erreur partielle dans un lot
        let appel = 0;
        Formulaire.ouvrir({
          titre: 'Test Docs',
          champs: [{ nom: 'pieces', label: 'Docs', type: 'photos' }],
          enregistrer: async (v) => { sauve = v; return 'OK'; }
        });
        await new Promise((ok) => setTimeout(ok, 50));
        const form3 = document.querySelector('#formulaire-zone form');
        Photo.reduire = () => {
          appel++;
          if (appel === 2) return Promise.reject(new Error('Image corrompue'));
          return Promise.resolve(jpgOk);
        };
        const dtDocs = new DataTransfer();
        for (let i = 0; i < 8; i++) dtDocs.items.add(new File(['x'], 'd' + i + '.jpg', { type: 'image/jpeg' }));
        const inputDocs = form3.querySelector('[data-champ="pieces"] input[type="file"][multiple]');
        inputDocs.files = dtDocs.files;
        inputDocs.dispatchEvent(new Event('change'));
        await new Promise((ok) => setTimeout(ok, 50));
        const nbDocs = JSON.parse(form3.querySelector('[name="pieces"]').value).length;
        const msgDocs = form3.querySelector('[data-champ="pieces"] .aide').textContent;
        const submitActifApresErreur = !form3.querySelector('button[type="submit"]').disabled;
        Formulaire.reinitialiser();

        return {
          desactivePendant,
          sauveAvant,
          sauvePhoto: sauve && sauve.photo,
          valeurApresRetirer,
          nbDocs,
          msgDocs,
          submitActifApresErreur
        };
      } finally {
        Photo.reduire = originalReduire;
      }
    });
    verifier(r.desactivePendant, 'bouton Enregistrer désactivé pendant Photo.reduire');
    verifier(r.sauveAvant === null && r.sauvePhoto && r.sauvePhoto.startsWith('data:image/jpeg'), 'soumettre() attend la compression et enregistre la photo', r);
    verifier(r.valeurApresRetirer === '', 'retirer() annule une compression en cours', r.valeurApresRetirer);
    verifier(r.nbDocs === 5 && r.msgDocs.includes('Image corrompue') && r.submitActifApresErreur, 'documents : respecte MAX_PIECES, gère erreur partielle et réactive Enregistrer', r);
    await p.evaluate(() => Nav.remplacer({ vue: 'accueil' }));
    await pause(p);
  });

  await section('Interface : BUG-16 (dialogues déjà ouverts sans InvalidStateError)', async () => {
    const r = await p.evaluate(async () => {
      const p1 = UI.choisir({ titre: 'Premier', choix: [{ valeur: 'a', texte: 'A' }] });
      const p2 = UI.choisir({ titre: 'Second', choix: [{ valeur: 'b', texte: 'B' }] });
      const titreDialogue = document.querySelector('#dialogue h2').textContent;
      document.querySelector('#dialogue button').click();
      const [v1, v2] = await Promise.all([p1, p2]);

      const pInf = UI.informer({ titre: 'Info', message: 'Texte' });
      const pConf = UI.confirmer({ titre: 'Conf', message: 'Sûr ?', oui: 'Oui' });
      document.querySelectorAll('#dialogue button')[1].click();
      const [rInf, rConf] = await Promise.all([pInf, pConf]);

      const img = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      const vImg1 = UI.voirImage(img, 'Doc 1');
      const vImg2 = UI.voirImage(img, 'Doc 2');
      const ariaVis = document.querySelector('#visionneuse').getAttribute('aria-label');
      document.querySelector('#visionneuse button.principal').click();
      await Promise.all([vImg1, vImg2]);
      return { v1, v2, titreDialogue, rInf, rConf, ariaVis, visOuvert: document.querySelector('#visionneuse').open };
    });
    verifier(r.v1 === null && r.v2 === 'b' && r.titreDialogue === 'Second', 'UI.choisir enchaîné résout l’ancien et affiche le nouveau', r);
    verifier(r.rInf === undefined && r.rConf === true, 'UI.confirmer remplace UI.informer sans blocage', r);
    verifier(r.ariaVis === 'Doc 2' && r.visOuvert === false, 'UI.voirImage enchaîné sans InvalidStateError', r);
  });

  await section('Photo : BUG-09 (MIME, SVG, ImageBitmap.close(), canvas/toDataURL)', async () => {
    const r = await p.evaluate(async () => {
      const errMsg = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
      const eVide = await errMsg(() => Photo.reduire(new File(['x'], 'a', { type: '' })));
      const eTxt = await errMsg(() => Photo.reduire(new File(['x'], 'a.txt', { type: 'text/plain' })));
      const eSvg = await errMsg(() => Photo.reduire(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })));
      const eNull = await errMsg(() => Photo.reduire(null));

      // Image PNG 2000x1500 réelle
      const c = document.createElement('canvas'); c.width = 2000; c.height = 1500;
      const x = c.getContext('2d'); x.fillStyle = '#369'; x.fillRect(0, 0, 2000, 1500);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
      const fichier = new File([blob], 'photo.png', { type: 'image/png' });
      const jpeg = await Photo.reduire(fichier);

      // Fallback Image() sans createImageBitmap
      const origBitmap = window.createImageBitmap;
      window.createImageBitmap = undefined;
      const jpegFallback = await Photo.reduire(fichier);
      const eObjUrl = await errMsg(() => Photo.charger({ bad: true }));

      // ImageBitmap.close() garanti sur erreurs
      let fermeZero = false, fermeCtx = false, fermeDataUrl = false;
      window.createImageBitmap = async () => ({ width: 0, height: 0, close: () => { fermeZero = true; } });
      const eZero = await errMsg(() => Photo.reduire(fichier));

      const origCreate = document.createElement.bind(document);
      window.createImageBitmap = async () => ({ width: 100, height: 100, close: () => { fermeCtx = true; } });
      document.createElement = (tag) => {
        const elmt = origCreate(tag);
        if (tag === 'canvas') elmt.getContext = () => null;
        return elmt;
      };
      const eCtx = await errMsg(() => Photo.reduire(fichier));

      window.createImageBitmap = async () => ({ width: 100, height: 100, close: () => { fermeDataUrl = true; } });
      document.createElement = (tag) => {
        const elmt = origCreate(tag);
        if (tag === 'canvas') elmt.toDataURL = () => 'data:,';
        return elmt;
      };
      const eDataUrl = await errMsg(() => Photo.reduire(fichier));

      document.createElement = origCreate;
      window.createImageBitmap = origBitmap;

      return {
        eVide, eTxt, eSvg, eNull,
        jpegOk: jpeg.startsWith('data:image/jpeg;base64,'),
        jpegFallbackOk: jpegFallback.startsWith('data:image/jpeg;base64,'),
        eObjUrl,
        eZero, fermeZero,
        eCtx, fermeCtx,
        eDataUrl, fermeDataUrl
      };
    });
    verifier(r.eVide && r.eTxt && r.eSvg && r.eNull, 'MIME vide, texte, SVG et null rejetés', r);
    verifier(r.jpegOk && r.jpegFallbackOk, 'PNG 2000x1500 réduit en JPEG via createImageBitmap et fallback Image', r);
    verifier(!!r.eObjUrl, 'URL.createObjectURL protégé sur entrée non-Blob');
    verifier(r.eZero && r.fermeZero && r.eCtx && r.fermeCtx && r.eDataUrl && r.fermeDataUrl, 'image.close() appelé dans finally sur toutes erreurs', r);
  });

  await section('Graphique : BUG-08 (même jour, faibles grammes, non-finis)', async () => {
    const r = await p.evaluate(() => {
      const lire = (pesees, unite) => {
        const svg = Graphique.courbePoids(pesees, unite);
        if (!svg) return null;
        const cercles = [...svg.querySelectorAll('circle')].map((c) => Number(c.getAttribute('cx')));
        const textes = [...svg.querySelectorAll('text.legende')];
        const yLabels = textes.filter((t) => t.getAttribute('text-anchor') === 'end' && Number(t.getAttribute('y')) < 200).map((t) => t.textContent);
        const xDates = textes.filter((t) => Number(t.getAttribute('y')) >= 200).map((t) => ({ txt: t.textContent, anchor: t.getAttribute('text-anchor') }));
        const hasNaN = svg.outerHTML.includes('NaN');
        return { cercles, yLabels, xDates, hasNaN, minX: Math.min(...cercles), maxX: Math.max(...cercles) };
      };
      return {
        memeJour: lire([
          { id: '1', date: '2026-11-05', grammes: 4200 },
          { id: '2', date: '2026-11-05', grammes: 4300 },
          { id: '3', date: '2026-11-05', grammes: 4250 }
        ], 'kg'),
        g1: lire([{ date: '2026-11-01', grammes: 100 }, { date: '2026-11-02', grammes: 101 }], 'g'),
        g2: lire([{ date: '2026-11-01', grammes: 100 }, { date: '2026-11-02', grammes: 102 }], 'g'),
        gZero: lire([{ date: '2026-11-01', grammes: 0 }], 'g'),
        kgTiny: lire([{ date: '2026-11-01', grammes: 4000 }, { date: '2026-11-02', grammes: 4001 }], 'kg'),
        kgSubGram: lire([{ id: '1', date: '2026-05-01', grammes: 4000 }, { id: '2', date: '2026-05-02', grammes: 4000.1 }], 'kg'),
        negMixed: (() => {
          const svg = Graphique.courbePoids([
            { id: '1', date: '2026-05-01', grammes: -500 },
            { id: '2', date: '2026-05-02', grammes: 500 }
          ], 'g');
          const cs = [...svg.querySelectorAll('circle')];
          return { count: cs.length, cy: Number(cs[0].getAttribute('cy')) };
        })(),
        negOnly: Graphique.courbePoids([{ id: '1', date: '2026-05-01', grammes: -500 }], 'g'),
        gGrand: lire([{ date: '2026-11-01', grammes: 100000 }, { date: '2026-11-02', grammes: 100001 }], 'g'),
        nonFini: lire([{ date: '2026-11-01', grammes: NaN }, { date: '2026-11-02', grammes: Infinity }], 'kg')
      };
    });
    verifier(r.memeJour.cercles[0] < r.memeJour.cercles[1] && r.memeJour.cercles[1] < r.memeJour.cercles[2], 'points du même jour répartis horizontalement', r.memeJour.cercles);
    verifier(r.memeJour.xDates.length === 1 && r.memeJour.xDates[0].anchor === 'middle', 'une seule date centrée quand premier === dernier', r.memeJour.xDates);
    verifier(new Set(r.g1.yLabels).size === 4 && new Set(r.g2.yLabels).size === 4 && new Set(r.gZero.yLabels).size === 4 && new Set(r.kgTiny.yLabels).size === 4 && new Set(r.kgSubGram.yLabels).size === 4, '4 repères Y distincts pour petits écarts g / 0 g / petit kg / sous-gramme kg', r);
    verifier(r.negMixed.count === 1 && r.negMixed.cy >= 0 && r.negMixed.cy <= 220 && r.negOnly === null, 'pesées négatives filtrées (aucun point hors viewBox)', { negMixed: r.negMixed, negOnly: r.negOnly });
    verifier(!r.memeJour.hasNaN && !r.g1.hasNaN && !r.gGrand.hasNaN && r.nonFini === null, 'aucun NaN dans le SVG et pesées non-finies filtrées');
  });

  await section('Rappels : BUG-04 (tri déterministe et égalités)', async () => {
    const r = await p.evaluate(() => {
      const base = {
        animaux: [{ id: 'a1', nom: 'Pixel' }],
        vaccins: [
          { id: 'v1', animalId: 'a1', nom: 'Rage', date: '2026-05-01', rappel: '2026-12-01' },
          { id: 'v2', animalId: 'a1', nom: 'Rage', date: '2026-05-01', rappel: '2026-12-15' },
          { id: 'vBad', animalId: 'a1', date: '2026-05-01', rappel: '2026-12-20' }
        ],
        antiparasitaires: [
          { id: 'p1', animalId: 'a1', type: 'vermifuge', date: '2026-06-01', prochaine: '2026-12-01' },
          { id: 'p2', animalId: 'a1', type: 'vermifuge', date: '2026-06-01', prochaine: '2026-12-10' },
          { id: 'pUnk', animalId: 'a1', type: 'inconnu', date: '2026-06-01', prochaine: '2026-12-25' }
        ],
        traitements: [{ id: 't1', animalId: 'a1', nom: 'Cure', statut: 'en-cours', fin: '2026-12-05' }],
        rdv: [
          { id: 'r1', animalId: 'a1', date: '2026-12-05', heure: '10:00', motif: 'A' },
          { id: 'r2', animalId: 'a1', date: '2026-12-05', heure: '10:00', motif: 'B' }
        ],
        taches: [{ id: 'k1', animalId: 'a1', titre: 'Griffes', echeance: '2026-12-05', fait: false }]
      };
      const inv = {
        ...base,
        vaccins: base.vaccins.slice().reverse(),
        antiparasitaires: base.antiparasitaires.slice().reverse(),
        rdv: base.rdv.slice().reverse()
      };
      const l1 = Rappels.calculer(base, '2026-11-26').map((x) => x.id);
      const l2 = Rappels.calculer(inv, '2026-11-26').map((x) => x.id);
      const refInvalide = Rappels.calculer(base, 'pas-une-date');

      // Régression BUG-04 : prototype leak nomsAP ('toString'), null input, f.date manquant
      const protoRes = Rappels.calculer({
        animaux: [{ id: 'a1', nom: 'Moka', archive: false }],
        antiparasitaires: [{ id: 'p4', animalId: 'a1', type: 'toString', produit: 'Proto', date: '2026-05-01', prochaine: '2026-07-15' }]
      }, '2026-05-01');
      const vNoDate = { id: 'v_nodate', animalId: 'a1', nom: 'Rage', date: undefined, rappel: '2026-07-15' };
      const vDated = { id: 'v_dated', animalId: 'a1', nom: 'Rage', date: '2026-05-01', rappel: '2026-07-15' };
      const permA = Rappels.calculer({ animaux: [{ id: 'a1', nom: 'Moka' }], vaccins: [vNoDate, vDated] }, '2026-05-01').map((x) => x.id);
      const permB = Rappels.calculer({ animaux: [{ id: 'a1', nom: 'Moka' }], vaccins: [vDated, vNoDate] }, '2026-05-01').map((x) => x.id);
      const nullRes = Rappels.calculer(null);
      const undefRes = Rappels.calculer(undefined);

      // Régression r3 : compterParAnimal sans collision prototype + champs non-tableaux truthy
      const rappelsProto = Rappels.calculer({
        animaux: [
          { id: 'toString', nom: 'P1', archive: false },
          { id: 'constructor', nom: 'P2', archive: false },
          { id: 'valueOf', nom: 'P3', archive: false },
          { id: '__proto__', nom: 'P4', archive: false }
        ],
        taches: [
          { id: 't_ts', animalId: 'toString', titre: 'Retard', echeance: '2026-04-20', fait: false },
          { id: 't_ct', animalId: 'constructor', titre: 'Bientot', echeance: '2026-05-03', fait: false },
          { id: 't_vo1', animalId: 'valueOf', titre: 'Retard', echeance: '2026-04-25', fait: false },
          { id: 't_vo2', animalId: 'valueOf', titre: 'Bientot', echeance: '2026-05-05', fait: false },
          { id: 't_pr', animalId: '__proto__', titre: 'Bientot', echeance: '2026-05-02', fait: false }
        ]
      }, '2026-05-01');
      const compteProto = Rappels.compterParAnimal([
        ...rappelsProto,
        null,
        { id: 'sans_animal', ecart: -1 }
      ]);
      const protoCheck = {
        protoNull: Object.getPrototypeOf(compteProto) === null,
        ts: Object.prototype.hasOwnProperty.call(compteProto, 'toString') && compteProto.toString,
        ct: Object.prototype.hasOwnProperty.call(compteProto, 'constructor') && compteProto.constructor,
        vo: Object.prototype.hasOwnProperty.call(compteProto, 'valueOf') && compteProto.valueOf,
        pr: Object.prototype.hasOwnProperty.call(compteProto, '__proto__') && compteProto['__proto__'],
        compteNullKeys: Object.keys(Rappels.compterParAnimal(null)).length
      };
      const nonTableaux = Rappels.calculer({
        animaux: [{ id: 'a1', nom: 'Moka', archive: false }],
        vaccins: 123,
        antiparasitaires: 'bad',
        traitements: {},
        rdv: true,
        taches: 42
      }, '2026-05-01');
      const animauxNonTableau = Rappels.calculer({
        animaux: 'bad',
        vaccins: [{ id: 'v1', animalId: 'a1', nom: 'Rage', date: '2026-05-01', rappel: '2026-06-01' }]
      }, '2026-05-01');

      return {
        l1, l2,
        refOk: Array.isArray(refInvalide) && refInvalide.every((x) => Number.isFinite(x.ecart)),
        protoTitre: protoRes[0] && protoRes[0].titre,
        permA, permB, nullRes, undefRes,
        protoCheck, nonTableaux, animauxNonTableau
      };
    });
    verifier(r.l1.includes('v2') && !r.l1.includes('v1') && r.l1.includes('p2') && !r.l1.includes('p1'), 'dernieres() sélectionne id le plus élevé à date égale', r.l1);
    verifier(JSON.stringify(r.l1) === JSON.stringify(r.l2), 'ordre strictement identique quelle que soit l’ordre d’entrée', r);
    verifier(r.refOk, 'reference invalide repliée sur aujourd’hui sans NaN');
    verifier(r.protoTitre === 'Antiparasitaire : Proto', 'nomsAP sans fuite prototype (toString)', r.protoTitre);
    verifier(JSON.stringify(r.permA) === JSON.stringify(['v_dated']) && JSON.stringify(r.permB) === JSON.stringify(['v_dated']), 'fiches sans date valide ignorées et invariance par permutation', { permA: r.permA, permB: r.permB });
    verifier(Array.isArray(r.nullRes) && r.nullRes.length === 0 && Array.isArray(r.undefRes) && r.undefRes.length === 0, 'Rappels.calculer(null/undefined) renvoie [] sans erreur');
    verifier(
      r.protoCheck.protoNull
      && r.protoCheck.ts && r.protoCheck.ts.retard === 1 && r.protoCheck.ts.bientot === 0
      && r.protoCheck.ct && r.protoCheck.ct.retard === 0 && r.protoCheck.ct.bientot === 1
      && r.protoCheck.vo && r.protoCheck.vo.retard === 1 && r.protoCheck.vo.bientot === 1
      && r.protoCheck.pr && r.protoCheck.pr.retard === 0 && r.protoCheck.pr.bientot === 1
      && r.protoCheck.compteNullKeys === 0,
      'compterParAnimal gère toString/constructor/valueOf/__proto__ et entrées invalides', r.protoCheck
    );
    verifier(Array.isArray(r.nonTableaux) && r.nonTableaux.length === 0 && Array.isArray(r.animauxNonTableau) && r.animauxNonTableau.length === 0,
      'Rappels.calculer gère les champs de store truthy non-tableaux sans TypeError', { nonTableaux: r.nonTableaux, animauxNonTableau: r.animauxNonTableau });
  });

  await section('Partage & Agenda : sécurité .ics, borne 2200-12-31, noreferrer, erreurs', async () => {
    const r = await p.evaluate(async () => {
      const ics2200 = Agenda.ics([
        { uid: 'u1', titre: 'Fin siècle', date: '2200-12-31', heure: '' },
        { uid: 'u2', titre: 'Minuit', date: '2200-12-31', heure: '23:30' }
      ]);
      const google2200 = Agenda.lienGoogle({ titre: 'Fin', date: '2200-12-31', heure: '' });
      const google2200H = Agenda.lienGoogle({ titre: 'Minuit', date: '2200-12-31', heure: '23:30' });

      const icsSec = Agenda.ics([
        { uid: 'x\r\nSUMMARY:INJECTED;:', titre: 'A\rB\x00\x07\x7fC', description: 'D\r\nE', lieu: 'L\rF', date: '2026-11-26', heure: '' },
        { uid: ':::', titre: 'Sans UID alphanum', date: '2026-11-26', heure: '' },
        { uid: 'ok', titre: 'Date invalide', date: '2026-02-30', heure: '' }
      ]);
      const lignes = icsSec.split('\r\n');
      const octetsMax = Math.max(...lignes.map((l) => new TextEncoder().encode(l).length));
      const aCtrl = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(icsSec);
      const aLoneCr = /\r(?!\n)/.test(icsSec);
      const uids = lignes.filter((l) => l.startsWith('UID:'));

      // window.open noopener,noreferrer
      let openArgs = null;
      const origOpen = window.open;
      window.open = (...args) => { openArgs = args; return null; };
      const pProp = Agenda.proposer({ titre: 'Rdv', date: '2026-12-01', heure: '10:00' });
      await new Promise((ok) => setTimeout(ok, 50));
      document.querySelectorAll('#dialogue button')[1].click();
      await pProp;
      window.open = origOpen;

      // Erreurs sans rejet non géré
      await Agenda.proposer({ titre: 'Bad', date: 'invalide' });
      const msgInvalide = document.querySelector('#annonce').textContent;
      const origEnvoyer = Partage.envoyer;
      Partage.envoyer = async () => { throw new Error('Échec partage'); };
      await Agenda.envoyerFichier([{ uid: '1', titre: 'T', date: '2026-12-01' }], 'test');
      const msgEnvErr = document.querySelector('#annonce').textContent;
      Partage.envoyer = origEnvoyer;

      // Partage.telecharger nettoyage finally même si click() jette
      const origCreate = document.createElement.bind(document);
      let resteDansDom = false;
      document.createElement = (tag) => {
        const elmt = origCreate(tag);
        if (tag === 'a') elmt.click = () => { throw new Error('click bloqué'); };
        return elmt;
      };
      try { Partage.telecharger(new File(['a'], 'a.txt', { type: 'text/plain' })); } catch (e) {}
      resteDansDom = document.querySelectorAll('a[download="a.txt"]').length > 0;
      document.createElement = origCreate;

      return { ics2200, google2200, google2200H, icsSec, octetsMax, aCtrl, aLoneCr, uids, openArgs, msgInvalide, msgEnvErr, resteDansDom };
    });
    verifier(r.ics2200.includes('DTEND;VALUE=DATE:22010101') && r.ics2200.includes('DTEND:22010101T003000'), '.ics gère 2200-12-31 all-day et 23:30', r.ics2200);
    verifier(r.google2200.includes('dates=22001231%2F22010101') && r.google2200H.includes('dates=22001231T233000%2F22010101T003000'), 'Google Agenda gère 2200-12-31', [r.google2200, r.google2200H]);
    verifier(!r.icsSec.includes('\r\nSUMMARY:INJECTED') && r.uids.length === 2 && r.uids[1].startsWith('UID:omni-2-20261126@omni-animalia'), 'UID assaini et repli si vide/invalide', r.uids);
    verifier(!r.aCtrl && !r.aLoneCr && r.icsSec.includes('SUMMARY:A\\nBC') && r.icsSec.includes('DESCRIPTION:D\\nE') && r.icsSec.includes('LOCATION:L\\nF') && r.octetsMax <= 75, 'contrôles supprimés, \\r isolé échappé, <= 75 octets', { aCtrl: r.aCtrl, aLoneCr: r.aLoneCr, octetsMax: r.octetsMax });
    verifier(r.openArgs && r.openArgs[2] === 'noopener,noreferrer', 'window.open utilise noopener,noreferrer', r.openArgs);
    verifier(r.msgInvalide.includes('invalide') && r.msgEnvErr.includes('Échec partage') && !r.resteDansDom, 'erreurs Agenda gérées et Partage.telecharger nettoyé', { msgInvalide: r.msgInvalide, msgEnvErr: r.msgEnvErr, resteDansDom: r.resteDansDom });
  });

  await section('Rappels : prisesANoter et pastillesAnimal (R3)', async () => {
    const r = await p.evaluate(() => {
      const ref = '2026-11-26';
      const donnees = {
        animaux: [
          { id: 'a_chron', nom: 'Biscuit', archive: false },
          { id: 'a_multi', nom: 'Moka', archive: false },
          { id: 'a_arch', nom: 'Ancien', archive: true },
          { id: 'a_propre', nom: 'Propre', archive: false }
        ],
        traitements: [
          // Chronique sans fin, 2 prises par jour
          { id: 't_chron', animalId: 'a_chron', nom: 'Insuline', statut: 'en-cours', debut: '2026-01-01', prisesParJour: 2, prises: { '2026-11-26': ['08:00'] } },
          // Borné actif aujourd'hui, 0 prise faite sur 3
          { id: 't_borne', animalId: 'a_multi', nom: 'Antibio', statut: 'en-cours', debut: '2026-11-20', fin: '2026-11-26', prisesParJour: 3 },
          // Chronique sans date de début ni de fin, 1 prise sur 2 faite
          { id: 't_nodate', animalId: 'a_multi', nom: 'Gouttes', statut: 'en-cours', prisesParJour: 2, prises: { '2026-11-26': ['09:00'] } },
          // Déjà complet (2 prises sur 2)
          { id: 't_plein', animalId: 'a_multi', nom: 'Complet', statut: 'en-cours', prisesParJour: 2, prises: { '2026-11-26': ['08:00', '20:00'] } },
          // Surdose (3 prises pour 2 prévues) -> 0 restant
          { id: 't_sur', animalId: 'a_propre', nom: 'Surdose', statut: 'en-cours', prisesParJour: 2, prises: { '2026-11-26': ['08:00', '12:00', '20:00'] } },
          // Expiré (fin < ref) -> non compté dans prisesANoter
          { id: 't_exp', animalId: 'a_propre', nom: 'Expiré', statut: 'en-cours', debut: '2026-11-01', fin: '2026-11-25', prisesParJour: 2 },
          // Futur (debut > ref) -> non compté
          { id: 't_fut', animalId: 'a_propre', nom: 'Futur', statut: 'en-cours', debut: '2026-11-27', prisesParJour: 2 },
          // Terminé -> non compté
          { id: 't_term', animalId: 'a_propre', nom: 'Terminé', statut: 'termine', prisesParJour: 2 },
          // Animal archivé -> non compté
          { id: 't_arch', animalId: 'a_arch', nom: 'Archivé', statut: 'en-cours', prisesParJour: 2 }
        ]
      };

      const prises = Rappels.prisesANoter(donnees, ref);

      // Sécurité prototype (noms de propriétés réservés)
      const protoDonnees = {
        animaux: [
          { id: 'toString', nom: 'A1', archive: false },
          { id: 'constructor', nom: 'A2', archive: false },
          { id: 'valueOf', nom: 'A3', archive: false },
          { id: '__proto__', nom: 'A4', archive: false }
        ],
        traitements: [
          { id: 'constructor', animalId: 'toString', nom: 'T1', statut: 'en-cours', prisesParJour: 1 },
          { id: 'toString', animalId: 'constructor', nom: 'T2', statut: 'en-cours', prisesParJour: 2 },
          { id: 'valueOf', animalId: 'valueOf', nom: 'T3', statut: 'en-cours', prisesParJour: 1 },
          { id: '__proto__', animalId: '__proto__', nom: 'T4', statut: 'en-cours', prisesParJour: 3 }
        ]
      };
      const prisesProto = Rappels.prisesANoter(protoDonnees, ref);

      // pastillesAnimal
      const dPast = {
        animaux: [
          { id: 'a1', nom: 'Tout', archive: false },
          { id: 'a2', nom: 'ChroniqueSeul', archive: false },
          { id: 'a3', nom: 'FuturEtRdv', archive: false },
          { id: 'a4', nom: 'Renouvele', archive: false },
          { id: 'a_arch', nom: 'Arch', archive: true }
        ],
        vaccins: [
          { id: 'v1', animalId: 'a1', nom: 'Rage', date: '2025-11-26', rappel: '2026-11-25' }, // retard
          { id: 'v2', animalId: 'a3', nom: 'Typhus', date: '2026-01-01', rappel: '2026-12-01' }, // futur
          { id: 'v3', animalId: 'a4', nom: 'Rage', date: '2025-11-01', rappel: '2026-11-01' }, // ancien
          { id: 'v4', animalId: 'a4', nom: 'Rage', date: '2026-11-01', rappel: '2027-11-01' } // renouvelé -> pas de pastille
        ],
        antiparasitaires: [
          { id: 'ap1', animalId: 'a1', type: 'vermifuge', date: '2026-08-26', prochaine: '2026-11-26' }, // aujourd'hui
          { id: 'ap2', animalId: 'a4', type: 'anti-puces', date: '2026-10-01', prochaine: '2026-11-01' },
          { id: 'ap3', animalId: 'a4', type: 'anti-puces', date: '2026-11-01', prochaine: '2026-12-10' } // renouvelé
        ],
        traitements: [
          { id: 'tr1', animalId: 'a2', nom: 'Chron', statut: 'en-cours', prisesParJour: 1 },
          { id: 'tr_done', animalId: 'a4', nom: 'Fait', statut: 'en-cours', prisesParJour: 1, prises: { '2026-11-26': ['08:00'] } }
        ],
        rdv: [
          { id: 'rdv1', animalId: 'a3', date: '2026-11-26', heure: '14:00', motif: 'Visite' }
        ],
        taches: [
          { id: 'k1', animalId: 'a1', titre: 'Griffes', echeance: '2026-11-26', fait: false },
          { id: 'k2', animalId: 'a3', titre: 'Futur', echeance: '2026-11-27', fait: false },
          { id: 'k3', animalId: 'a_arch', titre: 'Arch', echeance: '2026-11-20', fait: false }
        ]
      };

      return {
        prisesProtoNull: Object.getPrototypeOf(prises) === null,
        chronTotal: prises.a_chron && prises.a_chron.total,
        chronT: prises.a_chron && prises.a_chron.parTraitement.t_chron,
        multiTotal: prises.a_multi && prises.a_multi.total,
        multiBorne: prises.a_multi && prises.a_multi.parTraitement.t_borne,
        multiNodate: prises.a_multi && prises.a_multi.parTraitement.t_nodate,
        multiPlein: prises.a_multi && prises.a_multi.parTraitement.t_plein,
        aPropreOmitted: prises.a_propre === undefined,
        aArchOmitted: prises.a_arch === undefined,
        prisesNull: Object.keys(Rappels.prisesANoter(null, ref)).length,
        prisesBadTypes: Object.keys(Rappels.prisesANoter({ animaux: 'x', traitements: 42 }, ref)).length,
        prisesBadRef: Rappels.prisesANoter({ animaux: [{ id: 'a1', nom: 'A' }], traitements: [{ id: 't1', animalId: 'a1', statut: 'en-cours', prisesParJour: 1 }] }, 'invalide').a1.total,
        protoCheck: {
          protoNull: Object.getPrototypeOf(prisesProto) === null,
          ts: prisesProto['toString'] && prisesProto['toString'].total,
          ct: prisesProto['constructor'] && prisesProto['constructor'].total,
          vo: prisesProto['valueOf'] && prisesProto['valueOf'].total,
          pr: Object.prototype.hasOwnProperty.call(prisesProto, '__proto__') && prisesProto['__proto__'].total
        },
        pTout: Rappels.pastillesAnimal(dPast, 'a1', ref),
        pChron: Rappels.pastillesAnimal(dPast, 'a2', ref),
        pFutur: Rappels.pastillesAnimal(dPast, 'a3', ref),
        pRenouv: Rappels.pastillesAnimal(dPast, 'a4', ref),
        pArch: Rappels.pastillesAnimal(dPast, 'a_arch', ref),
        pInconnu: Rappels.pastillesAnimal(dPast, 'inexistant', ref),
        pNull: Rappels.pastillesAnimal(null, 'a1', ref)
      };
    });

    verifier(r.prisesProtoNull && r.chronTotal === 1 && r.chronT === 1, 'prisesANoter inclut les traitements chroniques sans date de fin et décompte les prises du jour', r);
    verifier(r.multiTotal === 4 && r.multiBorne === 3 && r.multiNodate === 1 && r.multiPlein === undefined, 'prisesANoter somme plusieurs traitements actifs et omet ceux à 0 restant', r);
    verifier(r.aPropreOmitted && r.aArchOmitted && r.prisesNull === 0 && r.prisesBadTypes === 0 && r.prisesBadRef === 1, 'prisesANoter exclut expirés/futurs/terminés/archivés/surdoses et gère entrées invalides', r);
    verifier(r.protoCheck.protoNull && r.protoCheck.ts === 1 && r.protoCheck.ct === 2 && r.protoCheck.vo === 1 && r.protoCheck.pr === 3, 'prisesANoter immunisé contre les clés toString/constructor/valueOf/__proto__', r.protoCheck);
    verifier(r.pTout.vaccins && !r.pTout.traitements && r.pTout.antiparasitaires && r.pTout.taches, 'pastillesAnimal allume vaccins/antiparasitaires/taches en retard ou du jour', r.pTout);
    verifier(!r.pChron.vaccins && r.pChron.traitements && !r.pChron.antiparasitaires && !r.pChron.taches, 'pastillesAnimal allume traitements pour un traitement chronique avec prise à noter', r.pChron);
    verifier(!r.pFutur.vaccins && !r.pFutur.traitements && !r.pFutur.antiparasitaires && !r.pFutur.taches, 'pastillesAnimal ignore rappels futurs et rdv du jour', r.pFutur);
    verifier(!r.pRenouv.vaccins && !r.pRenouv.traitements && !r.pRenouv.antiparasitaires && !r.pRenouv.taches, 'pastillesAnimal éteint les onglets après renouvellement ou prise complète', r.pRenouv);
    verifier(!r.pArch.taches && !r.pInconnu.vaccins && !r.pNull.vaccins, 'pastillesAnimal renvoie tout faux pour animal archivé, inconnu ou données nulles');
  });

  await section('Graphique : fourchette de poids idéal (R4)', async () => {
    const r = await p.evaluate(() => {
      const pesees = [
        { id: '1', date: '2026-10-01', grammes: 4000 },
        { id: '2', date: '2026-11-01', grammes: 4500 }
      ];
      const svg2 = Graphique.courbePoids(pesees, 'kg');
      const svgNull = Graphique.courbePoids(pesees, 'kg', null);
      const svgBad1 = Graphique.courbePoids(pesees, 'kg', { minGrammes: 0, maxGrammes: 4500 });
      const svgBad2 = Graphique.courbePoids(pesees, 'kg', { minGrammes: 5000, maxGrammes: 4000 });
      const svgBad3 = Graphique.courbePoids(pesees, 'kg', { minGrammes: NaN, maxGrammes: 4500 });
      const svgBad4 = Graphique.courbePoids(pesees, 'kg', []);

      // Fourchette au-dessus de toutes les pesées (test échelle Y et ordre DOM)
      const svgKg = Graphique.courbePoids(pesees, 'kg', { minGrammes: 6000, maxGrammes: 8000 });
      const enfantsKg = [...svgKg.children].map((c) => c.getAttribute('class'));
      const bandeKg = svgKg.querySelector('rect.bande-ideale');
      const pointsKg = [...svgKg.querySelectorAll('circle.point')];

      // En grammes
      const svgG = Graphique.courbePoids([{ id: '1', date: '2026-11-01', grammes: 1200 }], 'g', { minGrammes: 900, maxGrammes: 1100 });
      const bandeG = svgG.querySelector('rect.bande-ideale');

      // Fourchette ponctuelle min === max -> hauteur >= 2
      const svgEgal = Graphique.courbePoids(pesees, 'kg', { minGrammes: 4200, maxGrammes: 4200 });
      const bandeEgal = svgEgal.querySelector('rect.bande-ideale');

      return {
        identique2Args: svg2.outerHTML === svgNull.outerHTML &&
          svg2.outerHTML === svgBad1.outerHTML &&
          svg2.outerHTML === svgBad2.outerHTML &&
          svg2.outerHTML === svgBad3.outerHTML &&
          svg2.outerHTML === svgBad4.outerHTML,
        sansBande2Args: svg2.querySelectorAll('.bande-ideale').length === 0,
        videNull: Graphique.courbePoids([], 'kg', { minGrammes: 3000, maxGrammes: 4000 }) === null,
        bandeAvantCourbe: Boolean(bandeKg) &&
          enfantsKg.indexOf('bande-ideale') < enfantsKg.indexOf('repere') &&
          enfantsKg.indexOf('bande-ideale') < enfantsKg.indexOf('courbe') &&
          enfantsKg.indexOf('bande-ideale') < enfantsKg.indexOf('point'),
        kgOk: !svgKg.outerHTML.includes('NaN') &&
          Number(bandeKg.getAttribute('y')) >= 16 &&
          Number(bandeKg.getAttribute('y')) + Number(bandeKg.getAttribute('height')) <= 186 &&
          pointsKg.every((c) => Number(c.getAttribute('cy')) >= 16 && Number(c.getAttribute('cy')) <= 186),
        ariaKg: svgKg.getAttribute('aria-label'),
        gOk: Boolean(bandeG) && !svgG.outerHTML.includes('NaN') && Number(bandeG.getAttribute('height')) > 0,
        egalHauteur: bandeEgal ? Number(bandeEgal.getAttribute('height')) : 0,
        ariaEgal: svgEgal.getAttribute('aria-label')
      };
    });

    verifier(r.identique2Args && r.sansBande2Args && r.videNull,
      'courbePoids à 2 arguments ou fourchette nulle/invalide reste identique et sans .bande-ideale');
    verifier(r.bandeAvantCourbe && r.kgOk && r.ariaKg.includes('Fourchette de poids idéal'),
      'courbePoids trace .bande-ideale sous les repères/courbe/points et élargit l’axe Y', r);
    verifier(r.gOk && r.egalHauteur >= 2 && r.ariaEgal.includes('Poids idéal'),
      'courbePoids gère l’unité g, un seul point et min === max (hauteur >= 2)', r);
  });

  await ctx.close();
});
