/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests de régression Tier 5 (T5-01 .. T5-10) :
   durcissement PWA hors-ligne, bornes numériques, verrouillage/impression,
   atomicité IDB, concurrence de rendu asynchrone, anti-brute-force
   réglages et cohérence validation téléphone.

   Lancer :  node tests/tier5.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer, section, verifier, nouvellePage, RACINE, adresse } = require('./outils.js');

const PARIS = { timezoneId: 'Europe/Paris' };
const pause = (p, ms) => p.waitForTimeout(ms || 250);

async function ouvrir(options) {
  const r = await nouvellePage({ ...PARIS, ...(options || {}) });
  await r.p.waitForSelector('#dialogue[open]', { timeout: 5000 });
  await r.p.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();
  await pause(r.p);
  return r;
}

lancer('Omni-Animalia (Tier 5)', async () => {
  await section('T5-10 : Version, CACHE et exclusion de tests/tier5.js du Service Worker', async () => {
    const swTexte = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
    const appTexte = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
    verifier(/const CACHE = 'omni-animalia-v9';/.test(swTexte), 'sw.js : CACHE === omni-animalia-v9');
    verifier(/const VERSION = '1\.2\.6';/.test(appTexte), 'app.js : VERSION === 1.2.6');
    verifier(!swTexte.includes('tier5.js'), 'sw.js : FICHIERS n’inclut pas tests/tier5.js');
  });

  await section('T5-01 : Repli navigation hors-ligne sur sous-chemins (/a/, /a/b/c, /a/b/c#reglages)', async () => {
    const { ctx, p } = await ouvrir();
    const browser = p.context().browser();
    await ctx.close();

    const isoCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
    const isoPage = await isoCtx.newPage();
    const failed = [];
    const badResponses = [];
    isoPage.on('requestfailed', (req) => failed.push(req.url()));
    isoPage.on('response', (res) => { if (res.status() >= 400) badResponses.push({ url: res.url(), status: res.status() }); });

    await isoPage.goto(adresse());
    await isoPage.waitForSelector('#dialogue[open]', { timeout: 5000 });
    await isoPage.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();

    const swPret = await isoPage.evaluate(() => Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise((ok) => setTimeout(() => ok(false), 10000))
    ]));
    verifier(swPret, 'Service worker prêt');
    await isoPage.reload();
    await pause(isoPage, 600);

    await isoCtx.setOffline(true);
    const bcdp = await browser.newBrowserCDPSession();
    const { targetInfos } = await bcdp.send('Target.getTargets');
    for (const t of targetInfos.filter((x) => x.type === 'service_worker')) {
      const { sessionId } = await bcdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: false });
      await bcdp.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({ id: 1, method: 'Network.enable' })
      });
      await bcdp.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({
          id: 2,
          method: 'Network.emulateNetworkConditions',
          params: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }
        })
      });
    }

    for (const [subpath, expectedVue, expectedHash] of [
      ['sous-chemin-inconnu/', 'accueil', '#accueil'],
      ['a/b/c', 'accueil', '#accueil'],
      ['a/b/c#reglages', 'reglages', '#reglages']
    ]) {
      failed.length = 0;
      badResponses.length = 0;
      await isoPage.goto(adresse() + subpath, { waitUntil: 'domcontentloaded' });
      await isoPage.locator(`.vue[data-vue="${expectedVue}"]:not([hidden])`).waitFor({ state: 'visible', timeout: 8000 });
      const state = await isoPage.evaluate((vue) => ({
        appDefined: typeof App !== 'undefined' && App.pret,
        chargementHidden: document.querySelector('#chargement').hidden,
        vueVisible: !document.querySelector(`.vue[data-vue="${vue}"]`).hidden,
        hash: location.hash
      }), expectedVue);
      verifier(
        state.appDefined && state.chargementHidden && state.vueVisible && state.hash === expectedHash && failed.length === 0 && badResponses.length === 0,
        `hors-ligne ${subpath} -> redirection propre vers ${expectedHash} (0 échec réseau)`,
        { state, failed, badResponses }
      );
    }

    await bcdp.detach();
    await isoCtx.close();
  });

  const { ctx, p } = await ouvrir();

  await section('T5-02 : Formulaire.lireNombre rejette Infinity / -Infinity (NaN)', async () => {
    const r = await p.evaluate(() => {
      const infPos = Formulaire.lireNombre('9'.repeat(400));
      const infNeg = Formulaire.lireNombre('-' + '9'.repeat(400));

      Formulaire.ouvrir({
        titre: 'Test Nombre',
        champs: [{ nom: 'qte', label: 'Quantité', type: 'nombre', positif: true }],
        enregistrer: async () => 'OK'
      });
      const form = document.querySelector('#formulaire-zone form');
      form.querySelector('#champ-qte').value = '9'.repeat(400);
      const resInf = Formulaire.verifier(form);
      form.querySelector('#champ-qte').value = '12,5';
      const resOk = Formulaire.verifier(form);
      Formulaire.reinitialiser();
      Nav.remplacer({ vue: 'accueil' });
      return {
        posIsNaN: Number.isNaN(infPos),
        negIsNaN: Number.isNaN(infNeg),
        errInf: resInf.erreurs.qte || '',
        valInf: resInf.valeurs.qte,
        errOk: Object.keys(resOk.erreurs).length,
        valOk: resOk.valeurs.qte
      };
    });
    verifier(r.posIsNaN && r.negIsNaN, 'lireNombre retourne NaN pour +/-9e399', r);
    verifier(r.errInf.length > 0 && r.valInf !== Infinity && r.errOk === 0 && r.valOk === 12.5, 'Formulaire.verifier rejette Infinity sans max et accepte 12,5', r);
  });

  await section('T5-03 & T5-04 : Verrou.demander nettoie Impression et bloque la course impression/verrou', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const pet = { id: 'p_sec', nom: 'SecretPet', espece: 'Chat', archive: false };
      await BD.enregistrer('animaux', pet);

      const origPrint = window.print;
      let printCount = 0;
      window.print = () => { printCount++; };

      // T5-03 : Verrou.demander nettoie #carnet, document.title et Impression._nettoyer
      await EcranAnimal.imprimerCarnet(pet);
      const titleBeforeLock = document.title;
      const carnetBeforeLock = document.querySelector('#carnet').children.length;
      const hadNettoyer = typeof Impression._nettoyer === 'function';

      Verrou.demander();
      const titleAfterLock = document.title;
      const carnetAfterLock = document.querySelector('#carnet').children.length;
      const nettoyerAfterLock = Impression._nettoyer;

      // Reset UI lock state cleanly
      document.querySelector('#verrou').hidden = true;
      Verrou._promesse = null;
      App.montrer();

      // T5-04 : race pendant BD.parAnimal pour imprimerCarnet et EcranGarde.imprimer
      printCount = 0;
      const origParAnimal = BD.parAnimal;
      const testRace = async (fn) => {
        let release;
        const gate = new Promise((ok) => { release = ok; });
        BD.parAnimal = async (m, id) => {
          await gate;
          return origParAnimal.call(BD, m, id);
        };
        const prom = fn();
        await new Promise((ok) => setTimeout(ok, 20));
        Verrou.demander();
        release();
        await prom;
        const res = {
          carnetLen: document.querySelector('#carnet').children.length,
          title: document.title,
          printCount,
          verrouVisible: !document.querySelector('#verrou').hidden
        };
        document.querySelector('#verrou').hidden = true;
        Verrou._promesse = null;
        App.montrer();
        BD.parAnimal = origParAnimal;
        return res;
      };

      const raceCarnet = await testRace(() => EcranAnimal.imprimerCarnet(pet));
      const raceGarde = await testRace(() => EcranGarde.imprimer(pet));

      window.print = origPrint;
      return {
        titleBeforeLock, carnetBeforeLock, hadNettoyer,
        titleAfterLock, carnetAfterLock, nettoyerAfterLock,
        raceCarnet, raceGarde
      };
    });

    verifier(
      r.titleBeforeLock === 'Carnet de santé - SecretPet' && r.carnetBeforeLock > 0 && r.hadNettoyer &&
      r.titleAfterLock === 'Omni-Animalia' && r.carnetAfterLock === 0 && r.nettoyerAfterLock === null,
      'T5-03 : Verrou.demander() restaure document.title et appelle Impression._nettoyer(true)',
      r
    );
    verifier(
      r.raceCarnet.verrouVisible && r.raceCarnet.carnetLen === 0 && r.raceCarnet.title === 'Omni-Animalia' && r.raceCarnet.printCount === 0,
      'T5-04 : EcranAnimal.imprimerCarnet abandonné si Verrou activé pendant await IDB',
      r.raceCarnet
    );
    verifier(
      r.raceGarde.verrouVisible && r.raceGarde.carnetLen === 0 && r.raceGarde.title === 'Omni-Animalia' && r.raceGarde.printCount === 0,
      'T5-04 : EcranGarde.imprimer abandonné si Verrou activé pendant await IDB',
      r.raceGarde
    );
  });

  await section('T5-05 : EcranVeto.supprimer atomique (rollback tout-ou-rien et suppression propre)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const veto = { id: 'v_atom', nom: 'Dr Atom', telephone: '01 23 45 67 89' };
      await BD.enregistrer('veterinaires', veto);
      await BD.enregistrer('animaux', { id: 'a_at1', nom: 'Pixel', vetoId: 'v_atom', archive: false });
      await BD.enregistrer('animaux', { id: 'a_at2', nom: 'Moka', vetoId: 'v_atom', archive: false });

      const origConfirmer = UI.confirmer;
      UI.confirmer = async () => true;
      const origTx = BD._transaction;

      // Simule échec sur le magasin animaux en milieu de transaction
      BD._transaction = async function (magasins, mode) {
        const tx = await origTx.call(BD, magasins, mode);
        if (Array.isArray(magasins) && magasins.includes('animaux') && mode === 'readwrite') {
          const origStore = tx.objectStore.bind(tx);
          tx.objectStore = (name) => {
            const store = origStore(name);
            if (name === 'animaux') {
              const origCursor = store.openCursor.bind(store);
              store.openCursor = (...args) => {
                const req = origCursor(...args);
                setTimeout(() => { try { tx.abort(); } catch (e) {} }, 0);
                return req;
              };
            }
            return store;
          };
        }
        return tx;
      };

      await EcranVeto.supprimer(veto, ['Pixel', 'Moka']);
      BD._transaction = origTx;

      const vetoAfterAbort = await BD.lire('veterinaires', 'v_atom');
      const a1AfterAbort = await BD.lire('animaux', 'a_at1');
      const a2AfterAbort = await BD.lire('animaux', 'a_at2');

      // Puis suppression normale
      await Nav.remplacer({ vue: 'veterinaires' });
      await EcranVeto.supprimer(veto, ['Pixel', 'Moka']);
      UI.confirmer = origConfirmer;

      const vetoAfterOk = await BD.lire('veterinaires', 'v_atom');
      const a1AfterOk = await BD.lire('animaux', 'a_at1');
      const a2AfterOk = await BD.lire('animaux', 'a_at2');

      return {
        vetoKeptOnAbort: !!vetoAfterAbort && vetoAfterAbort.id === 'v_atom',
        a1KeptOnAbort: a1AfterAbort && a1AfterAbort.vetoId === 'v_atom',
        a2KeptOnAbort: a2AfterAbort && a2AfterAbort.vetoId === 'v_atom',
        vetoDeletedOnOk: vetoAfterOk === undefined,
        a1UnlinkedOnOk: a1AfterOk && a1AfterOk.vetoId === undefined,
        a2UnlinkedOnOk: a2AfterOk && a2AfterOk.vetoId === undefined
      };
    });

    verifier(
      r.vetoKeptOnAbort && r.a1KeptOnAbort && r.a2KeptOnAbort,
      'T5-05 : échec sur animaux annule la suppression du vétérinaire (rollback atomique)',
      r
    );
    verifier(
      r.vetoDeletedOnOk && r.a1UnlinkedOnOk && r.a2UnlinkedOnOk,
      'T5-05 : suppression nominale retire le vétérinaire et délie tous les animaux',
      r
    );
  });

  await section('T5-06 : Courses asynchrones IDB décalées sur les 6 écrans', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const auj = Dates.aujourdhui();
      const petA = { id: 'p_raceA', nom: 'RacePetA', espece: 'Chat', archive: false };
      const petB = { id: 'p_raceB', nom: 'RacePetB', espece: 'Chien', archive: false };
      const petArch = { id: 'p_arch', nom: 'ArchPet', espece: 'Lapin', archive: true, motifArchive: 'confié' };
      await BD.enregistrer('animaux', petA);
      await BD.enregistrer('animaux', petB);
      await BD.enregistrer('animaux', petArch);
      await BD.enregistrer('pesees', { id: 'w_race', animalId: 'p_raceA', date: auj, grammes: 4200 });
      await BD.enregistrer('vaccins', { id: 'v_race', animalId: 'p_raceA', nom: 'Rage', date: auj });
      await BD.enregistrer('veterinaires', { id: 'vet_1', nom: 'Dr Initial' });

      // 1. EcranGarde.afficher : petA lent, petB rapide
      await Nav.remplacer({ vue: 'garde', id: 'p_raceB' });
      const origLire = BD.lire;
      let releaseGardeA;
      const gateGardeA = new Promise((ok) => { releaseGardeA = ok; });
      BD.lire = async (mag, id) => {
        if (mag === 'animaux' && id === 'p_raceA') await gateGardeA;
        return origLire.call(BD, mag, id);
      };
      const pGardeA = EcranGarde.afficher('p_raceA');
      const pGardeB = EcranGarde.afficher('p_raceB');
      await pGardeB;
      releaseGardeA();
      await pGardeA;
      BD.lire = origLire;
      const gardeRes = {
        fiches: document.querySelectorAll('#garde-contenu .fiche-garde').length,
        piles: document.querySelectorAll('#garde-contenu .pile-boutons').length,
        titre: document.querySelector('#garde-titre').textContent,
        txt: document.querySelector('#garde-contenu').textContent
      };

      // 2. EcranReglages.afficher : 2 appels concurrents avec retard sur le premier
      await Nav.remplacer({ vue: 'reglages' });
      const origReglage = BD.reglage;
      let releaseReg1;
      const gateReg1 = new Promise((ok) => { releaseReg1 = ok; });
      let regCount = 0;
      BD.reglage = async (cle, defaut) => {
        if (cle === 'theme' && regCount++ === 0) await gateReg1;
        return origReglage.call(BD, cle, defaut);
      };
      const pReg1 = EcranReglages.afficher();
      const pReg2 = EcranReglages.afficher();
      await pReg2;
      releaseReg1();
      await pReg1;
      BD.reglage = origReglage;
      const reglagesBlocs = document.querySelectorAll('#reglages-contenu .bloc').length;

      // 3. EcranAccueil.afficher & afficherArchives
      await BD.definirReglage('derniereSauvegarde', Dates.ajouterJours(auj, -60));
      let releaseAcc1;
      let markEnteredAcc1;
      const enteredAcc1 = new Promise((ok) => { markEnteredAcc1 = ok; });
      const gateAcc1 = new Promise((ok) => { releaseAcc1 = ok; });
      let accCount = 0;
      BD.reglage = async (cle, defaut) => {
        if (cle === 'derniereSauvegarde' && accCount++ === 0) {
          markEnteredAcc1();
          await gateAcc1;
        }
        return origReglage.call(BD, cle, defaut);
      };
      const pAcc1 = EcranAccueil.afficher();
      await enteredAcc1;
      const pAcc2 = EcranAccueil.afficher();
      await pAcc2;
      releaseAcc1();
      await pAcc1;
      BD.reglage = origReglage;
      const accueilBandeaux = document.querySelectorAll('#accueil-bandeaux .rappel-sauvegarde').length;
      const accueilCartes = document.querySelectorAll('#accueil-liste .carte-animal').length;

      const origTout = BD.tout;
      let releaseArch1;
      const gateArch1 = new Promise((ok) => { releaseArch1 = ok; });
      let archCalls = 0;
      BD.tout = async (mag) => {
        if (mag === 'animaux' && archCalls++ === 0) {
          await gateArch1;
          return []; // périmé
        }
        return origTout.call(BD, mag);
      };
      const pArch1 = EcranAccueil.afficherArchives();
      const pArch2 = EcranAccueil.afficherArchives();
      await pArch2;
      releaseArch1();
      await pArch1;
      BD.tout = origTout;
      const archivesCartes = document.querySelectorAll('#archives-liste .carte-archive').length;

      // 4. EcranVeto.afficher : appel 1 ('Dr Stale') finit après appel 2 ('Dr Fresh')
      let releaseVeto1;
      const gateVeto1 = new Promise((ok) => { releaseVeto1 = ok; });
      let vetoCalls = 0;
      BD.tout = async (mag) => {
        if (mag === 'veterinaires' && vetoCalls++ === 0) {
          await gateVeto1;
          return [{ id: 'vet_stale', nom: 'Dr Stale' }];
        }
        return origTout.call(BD, mag);
      };
      await BD.enregistrer('veterinaires', { id: 'vet_fresh', nom: 'Dr Fresh' });
      const pVeto1 = EcranVeto.afficher();
      const pVeto2 = EcranVeto.afficher();
      await pVeto2;
      releaseVeto1();
      await pVeto1;
      BD.tout = origTout;
      const vetosTxt = document.querySelector('#vetos-liste').textContent;

      // 5a. EcranAnimal.changerSection : poids lent vs vaccins rapide
      await EcranAnimal.afficher('p_raceA', 'identite');
      const origParAnimal = BD.parAnimal;
      let releasePoids;
      const gatePoids = new Promise((ok) => { releasePoids = ok; });
      BD.parAnimal = async (mag, id) => {
        if (mag === 'pesees') await gatePoids;
        return origParAnimal.call(BD, mag, id);
      };
      const pSec1 = EcranAnimal.changerSection('poids');
      const pSec2 = EcranAnimal.changerSection('vaccins');
      await pSec2;
      releasePoids();
      await pSec1;
      BD.parAnimal = origParAnimal;
      const h2Texts = [...document.querySelectorAll('#animal-contenu h2')].map((el) => el.textContent);

      // 5b. EcranAnimal.afficher : petA lent vs petB rapide
      let releasePetA;
      const gatePetA = new Promise((ok) => { releasePetA = ok; });
      BD.lire = async (mag, id) => {
        if (mag === 'animaux' && id === 'p_raceA') await gatePetA;
        return origLire.call(BD, mag, id);
      };
      const pAnA = EcranAnimal.afficher('p_raceA', 'identite');
      const pAnB = EcranAnimal.afficher('p_raceB', 'alimentation');
      await pAnB;
      releasePetA();
      await pAnA;
      BD.lire = origLire;
      const animalTitre = document.querySelector('#animal-titre').textContent;
      const animalH2 = [...document.querySelectorAll('#animal-contenu h2')].map((el) => el.textContent);

      // 6. EcranAgenda.afficherRappels : snapshot périmé vs tâche fraîche
      const origToutLire = BD.toutLire;
      let releaseRap1;
      const gateRap1 = new Promise((ok) => { releaseRap1 = ok; });
      let rapCalls = 0;
      BD.toutLire = async () => {
        if (rapCalls++ === 0) {
          const stale = await origToutLire.call(BD);
          await gateRap1;
          return stale;
        }
        return origToutLire.call(BD);
      };
      const pRap1 = EcranAgenda.afficherRappels();
      await BD.enregistrer('taches', { id: 't_fresh', animalId: 'p_raceA', titre: 'TacheFraicheRace', echeance: auj, fait: false });
      const pRap2 = EcranAgenda.afficherRappels();
      await pRap2;
      releaseRap1();
      await pRap1;
      BD.toutLire = origToutLire;
      const rappelsTxt = document.querySelector('#rappels-liste').textContent;

      return {
        gardeRes,
        reglagesBlocs,
        accueilBandeaux, accueilCartes, archivesCartes,
        vetosTxt,
        h2Texts, animalTitre, animalH2,
        rappelsTxt
      };
    });

    verifier(
      r.gardeRes.fiches === 1 && r.gardeRes.piles === 1 && r.gardeRes.titre === 'Garde de RacePetB' &&
      r.gardeRes.txt.includes('RacePetB') && !r.gardeRes.txt.includes('RacePetA'),
      'T5-06 : EcranGarde.afficher ignore le rendu périmé',
      r.gardeRes
    );
    verifier(r.reglagesBlocs === 8, 'T5-06 : EcranReglages.afficher ne duplique pas les 8 blocs', r.reglagesBlocs);
    verifier(r.accueilBandeaux === 1 && r.accueilCartes === 2 && r.archivesCartes === 1, 'T5-06 : EcranAccueil.afficher et afficherArchives sans doublon ni écrasement', r);
    verifier(r.vetosTxt.includes('Dr Fresh') && !r.vetosTxt.includes('Dr Stale'), 'T5-06 : EcranVeto.afficher ignore la réponse périmée', r.vetosTxt);
    verifier(JSON.stringify(r.h2Texts) === JSON.stringify(['Vaccins']), 'T5-06 : EcranAnimal.changerSection ne concatène pas Poids + Vaccins', r.h2Texts);
    verifier(r.animalTitre === 'RacePetB' && JSON.stringify(r.animalH2) === JSON.stringify(['Alimentation']), 'T5-06 : EcranAnimal.afficher ignore animal périmé', r);
    verifier(r.rappelsTxt.includes('TacheFraicheRace'), 'T5-06 : EcranAgenda.afficherRappels conserve la tâche fraîche', r.rappelsTxt.slice(0, 200));
  });

  await section('T5-07 : EcranReglages.formulaireMdp applique le délai anti-brute-force partagé avec Verrou', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      await Verrou.definir('Secret1234');
      await Nav.remplacer({ vue: 'reglages' });

      EcranReglages.formulaireMdp('changer');
      await new Promise((ok) => setTimeout(ok, 80));
      const form = document.querySelector('#formulaire-zone form');

      const messages = [];
      for (let i = 1; i <= 3; i++) {
        form.querySelector('#champ-actuel').value = 'Faux' + i;
        form.querySelector('#champ-nouveau').value = 'Nouveau1234';
        form.querySelector('#champ-confirmation').value = 'Nouveau1234';
        await Formulaire.soumettre(form);
        messages.push(document.querySelector('#annonce').textContent);
      }
      const echecsApres3 = Verrou._echecs;
      const bloqueApres3 = Verrou._bloqueJusqua > Date.now();

      // 4e tentative immédiate : doit être bloquée AVANT Verrou.verifier (PBKDF2)
      let verifierCalls = 0;
      const origVerifier = Verrou.verifier;
      Verrou.verifier = async (mdp) => { verifierCalls++; return origVerifier.call(Verrou, mdp); };
      form.querySelector('#champ-actuel').value = 'Secret1234';
      await Formulaire.soumettre(form);
      const msg4 = document.querySelector('#annonce').textContent;
      const verifierCallsDuringCooldown = verifierCalls;

      // Attendre expiration du délai (1 s) puis soumettre le bon mot de passe
      await new Promise((ok) => setTimeout(ok, 1150));
      form.querySelector('#champ-actuel').value = 'Secret1234';
      await Formulaire.soumettre(form);
      Verrou.verifier = origVerifier;
      const msgOk = document.querySelector('#annonce').textContent;
      const echecsApresOk = Verrou._echecs;
      const bloqueApresOk = Verrou._bloqueJusqua;
      const nouveauValide = await Verrou.verifier('Nouveau1234');

      // Vérifier aussi sur 'desactiver'
      EcranReglages.formulaireMdp('desactiver');
      await new Promise((ok) => setTimeout(ok, 80));
      const fDes = document.querySelector('#formulaire-zone form');
      for (let i = 1; i <= 3; i++) {
        fDes.querySelector('#champ-actuel').value = 'FauxDes' + i;
        await Formulaire.soumettre(fDes);
      }
      fDes.querySelector('#champ-actuel').value = 'Nouveau1234';
      await Formulaire.soumettre(fDes);
      const msgDesCooldown = document.querySelector('#annonce').textContent;
      await new Promise((ok) => setTimeout(ok, 1150));
      fDes.querySelector('#champ-actuel').value = 'Nouveau1234';
      await Formulaire.soumettre(fDes);
      const msgDesOk = document.querySelector('#annonce').textContent;
      const actifApresDes = await Verrou.actif();

      return {
        messages, echecsApres3, bloqueApres3,
        msg4, verifierCallsDuringCooldown,
        msgOk, echecsApresOk, bloqueApresOk, nouveauValide,
        msgDesCooldown, msgDesOk, actifApresDes,
        echecsFinaux: Verrou._echecs
      };
    });

    verifier(
      r.messages.every((m) => m.includes('incorrect')) && r.echecsApres3 === 3 && r.bloqueApres3,
      'T5-07 : 3 erreurs incrémentent _echecs et activent le blocage',
      r
    );
    verifier(
      r.msg4.includes('Trop d’essais incorrects') && r.verifierCallsDuringCooldown === 0,
      'T5-07 : 4e tentative immédiate bloquée sans exécuter PBKDF2',
      r
    );
    verifier(
      r.msgOk.includes('Mot de passe changé') && r.echecsApresOk === 0 && r.bloqueApresOk === 0 && r.nouveauValide,
      'T5-07 : changement réussi après délai réinitialise le compteur',
      r
    );
    verifier(
      r.msgDesCooldown.includes('Trop d’essais incorrects') && r.msgDesOk.includes('désactivé') && !r.actifApresDes && r.echecsFinaux === 0,
      'T5-07 : désactivation partage le même blocage et réinitialise le compteur',
      r
    );
  });

  await section('T5-08 : Validation téléphone cohérente (espaces simples acceptés, tab/retour ligne rejetés)', async () => {
    const r = await p.evaluate(() => {
      Formulaire.ouvrir({
        titre: 'Test Tel',
        champs: [{ nom: 'telephone', label: 'Téléphone', type: 'tel', long: 30 }],
        enregistrer: async () => 'OK'
      });
      const form = document.querySelector('#formulaire-zone form');
      const champTel = form.querySelector('#champ-telephone');
      const testerTel = (val) => {
        champTel.value = val;
        return Object.keys(Formulaire.verifier(form).erreurs).length === 0;
      };
      const acceptTab = testerTel('06\t12 34 56 78');
      const origLire = Formulaire.lire;
      Formulaire.lire = () => ({ telephone: '06\n12 34 56 78' });
      const acceptNl = Object.keys(Formulaire.verifier(form).erreurs).length === 0;
      Formulaire.lire = origLire;
      const acceptEspace = testerTel('06 12 34 56 78');
      const acceptIntl = testerTel('+33 (0)1-23.45.67');
      Formulaire.reinitialiser();

      EcranGarde.formulaireContact({});
      const gardeTab = Object.keys(Formulaire.courant.valider({ telephone: '06\t12' })).length > 0;
      const gardeNl = Object.keys(Formulaire.courant.valider({ telephone: '06\n12' })).length > 0;
      Formulaire.reinitialiser();
      Nav.remplacer({ vue: 'accueil' });

      let sauvTab = false;
      let sauvNl = false;
      try {
        Sauvegarde.valider({ format: 'omni-animaux-sauvegarde', versionFormat: 1, reglages: { contactGarde: { telephone: '06\t12' } }, donnees: { animaux: [] } });
      } catch (e) { sauvTab = true; }
      try {
        Sauvegarde.valider({ format: 'omni-animaux-sauvegarde', versionFormat: 1, reglages: { contactGarde: { telephone: '06\n12' } }, donnees: { animaux: [] } });
      } catch (e) { sauvNl = true; }

      return { acceptTab, acceptNl, acceptEspace, acceptIntl, gardeTab, gardeNl, sauvTab, sauvNl };
    });

    verifier(
      !r.acceptTab && !r.acceptNl && r.acceptEspace && r.acceptIntl &&
      r.gardeTab && r.gardeNl && r.sauvTab && r.sauvNl,
      'T5-08 : Formulaire, EcranGarde et Sauvegarde rejettent \\t/\\n et acceptent espaces simples',
      r
    );
  });

  await ctx.close();
});
