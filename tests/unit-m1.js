/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests unitaires et d'intégration du jalon M1 (Omni-Animalia).
   Vérifie : CSP, Referrer-Policy, init-theme.js, sw.js (cache,
   concurrence, hors-ligne), MiseAJour, BUG-01, BUG-02, BUG-11,
   BUG-13, durcissement de Verrou / #carnet et LISEZMOI.md.
   Lancer : node tests/unit-m1.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer, section, verifier, nouvellePage, RACINE, adresse } = require('./outils.js');

const PARIS = { timezoneId: 'Europe/Paris' };
const pause = (p, ms) => p.waitForTimeout(ms || 300);

async function ouvrir(options = {}) {
  const r = await nouvellePage({ ...PARIS, ...options });
  await r.p.waitForSelector('#dialogue[open]', { timeout: 5000 });
  await r.p.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();
  await pause(r.p, 250);
  return r;
}

lancer('Unités M1 — Omni-Animalia', async () => {

  await section('M1.1 : CSP stricte, Referrer-Policy et init-theme.js', async () => {
    const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
    verifier(/<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*default-src 'none'[^"]*script-src 'self'/.test(html),
      'index.html contient une balise meta CSP stricte');
    verifier(/<meta\s+name="referrer"\s+content="no-referrer">/.test(html),
      'index.html contient Referrer-Policy no-referrer');
    verifier(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html),
      'index.html ne contient aucun script en ligne');
    verifier(!/\sstyle\s*=/i.test(html) && !/\son[a-z]+\s*=/i.test(html),
      'index.html ne contient aucun attribut style= ni on*=');
    verifier(/<script\s+src="\.\/init-theme\.js"><\/script>/.test(html),
      'index.html charge init-theme.js de façon synchrone');

    const { ctx, p } = await nouvellePage({
      ...PARIS,
      avant: async (c) => {
        await c.addInitScript(() => {
          window.__cspViolations = [];
          document.addEventListener('securitypolicyviolation', (e) => {
            window.__cspViolations.push(e.violatedDirective + ':' + e.blockedURI);
          });
          localStorage.setItem('omnianimaux_theme', 'clair');
          localStorage.setItem('omnianimaux_taille', 'grand');
          window.__themeAvantLoad = null;
          document.addEventListener('DOMContentLoaded', () => {
            window.__themeAvantLoad = {
              theme: document.documentElement.dataset.theme,
              taille: document.documentElement.dataset.taille
            };
          }, { once: true });
        });
      }
    });
    await p.waitForSelector('#dialogue[open]', { timeout: 5000 });
    await p.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();
    await pause(p, 250);

    const etatTheme = await p.evaluate(() => ({
      avant: window.__themeAvantLoad,
      maintenant: {
        theme: document.documentElement.dataset.theme,
        taille: document.documentElement.dataset.taille
      },
      violations: window.__cspViolations
    }));
    // Note : avant DOMContentLoaded, init-theme.js a déjà posé clair/grand ;
    // ensuite App.demarrer() réapplique les réglages IndexedDB (omni/normal par défaut).
    verifier(etatTheme.avant && etatTheme.avant.theme === 'clair' && etatTheme.avant.taille === 'grand',
      'init-theme.js applique thème et taille avant App.demarrer()', etatTheme.avant);
    verifier(etatTheme.violations.length === 0,
      '0 violation CSP à l’ouverture et dans le dialogue', etatTheme.violations);

    // Valeurs invalides dans localStorage -> valeurs par défaut sûres
    await p.evaluate(() => {
      localStorage.setItem('omnianimaux_theme', 'pirate');
      localStorage.setItem('omnianimaux_taille', 'geante');
    });
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(e.violatedDirective));
    });
    await p2.goto(adresse());
    await p2.waitForTimeout(300);
    const repli = await p2.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      taille: document.documentElement.dataset.taille,
      violations: window.__cspViolations
    }));
    verifier(repli.theme === 'omni' && repli.taille === 'normal',
      'init-theme.js ignore les valeurs invalides du localStorage', repli);
    verifier(repli.violations.length === 0, '0 violation CSP sur second chargement', repli.violations);
    await ctx.close();
  });

  await section('M1.2 : sw.js (version, FICHIERS, cache hors-ligne et repli)', async () => {
    const swTexte = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
    const appTexte = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8');
    verifier(/const CACHE = 'omni-animalia-v9';/.test(swTexte), 'sw.js : CACHE incrémenté à omni-animalia-v9');
    verifier(/const VERSION = '1\.2\.6';/.test(appTexte), 'app.js : VERSION incrémentée à 1.2.6');
    verifier(swTexte.includes("'./init-theme.js'"), 'sw.js : init-theme.js présent dans FICHIERS');
    verifier(/remplissageEnCours/.test(swTexte) && /c\.put\(e\.request,\s*rep\.clone\(\)\)\.catch/.test(swTexte),
      'sw.js : déduplication du remplissage et garde c.put().catch()');

    // Contexte isolé pour tester Response.error() hors-ligne sans polluer outils.js
    const { ctx, p } = await ouvrir();
    const browser = p.context().browser();
    await ctx.close();

    const isoCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
    const isoPage = await isoCtx.newPage();
    await isoPage.goto(adresse());
    await isoPage.waitForSelector('#dialogue[open]', { timeout: 5000 });
    await isoPage.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();

    const swPret = await isoPage.evaluate(() => Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise((ok) => setTimeout(() => ok(false), 10000))
    ]));
    verifier(swPret, 'le service worker est installé et prêt');
    await isoPage.reload();
    await pause(isoPage, 600);

    const aInitTheme = await isoPage.evaluate(async () => {
      const c = await caches.open('omni-animalia-v9');
      return !!(await c.match('./init-theme.js'));
    });
    verifier(aInitTheme, 'init-theme.js est bien mis en cache dans omni-animalia-v9');

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

    // Repli de navigation hors-ligne sur un sous-chemin inconnu
    await isoPage.goto(adresse() + 'sous-chemin-inconnu');
    await isoPage.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 5000 }).catch(() => {});
    const contenuHorsLigne = await isoPage.evaluate(() => document.body.innerText.trim().length);
    verifier(contenuHorsLigne > 20, 'hors-ligne : une navigation inconnue retombe sur index.html', contenuHorsLigne);

    // Requête non-navigation absente du cache hors-ligne -> Response.error() (fetch rejette)
    const erreurFetch = await isoPage.evaluate(async () => {
      try {
        await fetch('./fichier-inexistant-m1.json');
        return false;
      } catch (e) {
        return true;
      }
    });
    verifier(erreurFetch === true, 'hors-ligne : requête non-navigation non cachée rejette via Response.error()');
    await bcdp.detach();
    await isoCtx.close();
  });

  await section('M1.2 bis : MiseAJour (boutons désactivés, verifier(), controllerchange)', async () => {
    const { ctx, p } = await ouvrir();
    const res = await p.evaluate(async () => {
      let appels = 0;
      const fauxSw = { state: 'installed', postMessage: () => { appels++; } };
      MiseAJour.proposer(fauxSw);
      const visible = !document.querySelector('#bandeau-mise-a-jour').hidden;
      document.querySelector('#maj-oui').click();
      document.querySelector('#maj-oui').click();
      const desactiveOui = document.querySelector('#maj-oui').disabled;
      const desactiveTard = document.querySelector('#maj-plus-tard').disabled;

      // Simule controllerchange sur un autre onglet (demandee === false)
      MiseAJour.demandee = false;
      MiseAJour.enAttente = fauxSw;
      navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
      const cacheApres = !MiseAJour.enAttente && document.querySelector('#bandeau-mise-a-jour').hidden;

      // MiseAJour.verifier() ne lance aucune erreur même si update() échoue
      let majAppelee = 0;
      MiseAJour._reg = { update: async () => { majAppelee++; throw new Error('réseau coupé'); } };
      await MiseAJour.verifier();

      return { visible, appels, desactiveOui, desactiveTard, cacheApres, majAppelee };
    });
    verifier(res.visible, 'le bandeau de mise à jour s’affiche');
    verifier(res.appels === 1 && res.desactiveOui && res.desactiveTard,
      'cliquer Mettre à jour désactive les boutons et envoie un seul message', res);
    verifier(res.cacheApres, 'controllerchange sans demande nettoie enAttente et cache le bandeau');
    verifier(res.majAppelee === 1, 'MiseAJour.verifier() attrape les échecs de reg.update()');
    await ctx.close();
  });

  await section('M1.3 (BUG-01) : visibilitychange, non-écrasement UI et verrou single-flight', async () => {
    const { ctx, p } = await ouvrir();
    // Ajoute un animal avec une note pour tester l'écran santé + filtre
    await p.evaluate(async () => {
      await BD.enregistrer('animaux', { id: 'a1', nom: 'Pixel', espece: 'Chat' });
      await BD.enregistrer('notes', { id: 'n1', animalId: 'a1', date: '2026-05-01', categorie: 'observation', texte: 'Note test' });
      await Nav.aller({ vue: 'animal', id: 'a1', section: 'notes' });
    });
    await pause(p, 400);

    // Ouvre le filtre, tape une date, scrolle et ouvre un dialogue
    const preserve = await p.evaluate(async () => {
      const details = document.querySelector('#animal-contenu details.filtre');
      if (details) details.open = true;
      const champDu = document.querySelector('#filtre-du');
      if (champDu) champDu.value = '2026-01-01';

      // Déclenche un aller-retour rapide (< 5 min, même jour)
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 100));

      return {
        detailsOuvert: details ? details.open : null,
        valeurDu: champDu ? champDu.value : null
      };
    });
    verifier(preserve.detailsOuvert === true && preserve.valeurDu === '2026-01-01',
      'retour rapide sur l’onglet : <details> et filtre non écrasés', preserve);

    // Dialogue ouvert + visibilitychange rapide -> le dialogue reste ouvert
    const dlgOk = await p.evaluate(async () => {
      const prom = UI.confirmer({ titre: 'Test', message: 'Reste ouvert' });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 80));
      const ouvert = document.querySelector('#dialogue').open;
      document.querySelector('#dialogue').close();
      await prom;
      return ouvert;
    });
    verifier(dlgOk === true, 'retour rapide : un dialogue ouvert reste ouvert');

    // Événements visibilitychange rapides avec délai > 5 min et mot de passe actif
    await p.evaluate(async () => {
      await Verrou.definir('secret-123');
      let t = 1000000;
      Date.now = () => t;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      t += Verrou.DELAI_ARRIERE_PLAN + 5000;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await p.waitForSelector('#verrou:not([hidden])', { timeout: 5000 });
    // Un seul écouteur submit doit être attaché : un mauvais mot de passe n'incrémente _echecs que de 1
    await p.fill('#verrou-mdp', 'faux');
    await p.click('#verrou-form button[type=submit]');
    await pause(p, 500);
    const echecs = await p.evaluate(() => Verrou._echecs);
    verifier(echecs === 1, 'rafale de visibilitychange : un seul écouteur submit (1 seul échec compté)', echecs);
    await p.fill('#verrou-mdp', 'secret-123');
    await p.click('#verrou-form button[type=submit]');
    await pause(p, 500);
    verifier(await p.isVisible('#principal'), 'déverrouillage réussi après rafale');
    await ctx.close();
  });

  await section('M1.4 (BUG-02) : Formulaire.courant, aria-current et fermeture des dialogues sur popstate', async () => {
    const { ctx, p } = await ouvrir();
    await p.click('#accueil-actions button'); // Ouvre « Ajouter un animal »
    await pause(p, 300);
    const ariaPendantForm = await p.evaluate(() =>
      [...document.querySelectorAll('#barre-nav button')].filter((b) => b.hasAttribute('aria-current')).length
    );
    verifier(ariaPendantForm === 0, 'en mode formulaire, aucun onglet n’a aria-current="page"', ariaPendantForm);

    // 1. Sortie via « Annuler »
    await p.click('#formulaire-zone .formulaire-boutons button.secondaire');
    await pause(p, 350);
    verifier(await p.evaluate(() => Formulaire.courant === null), 'Annuler remet Formulaire.courant à null');
    await p.goForward();
    await pause(p, 350);
    verifier(await p.isVisible('[data-vue="accueil"]'), 'Avancer après Annuler redirige vers accueil');

    // 2. Sortie via onglet de navigation
    await p.click('#accueil-actions button');
    await pause(p, 300);
    await p.click('#barre-nav button[data-onglet="reglages"]');
    await pause(p, 350);
    const apresOnglet = await p.evaluate(() => ({
      courant: Formulaire.courant,
      aria: document.querySelector('#barre-nav button[data-onglet="reglages"]').getAttribute('aria-current')
    }));
    verifier(apresOnglet.courant === null && apresOnglet.aria === 'page',
      'quitter le formulaire par un onglet vide Formulaire.courant et met aria-current="page"', apresOnglet);

    // 3. Sortie via bouton retour navigateur (popstate)
    await p.click('#barre-nav button[data-onglet="accueil"]');
    await pause(p, 250);
    await p.click('#accueil-actions button');
    await pause(p, 250);
    await p.goBack();
    await pause(p, 350);
    verifier(await p.evaluate(() => Formulaire.courant === null), 'popstate en quittant un formulaire vide Formulaire.courant');

    // 4. popstate ferme #dialogue et #visionneuse proprement
    await p.evaluate(() => Nav.aller({ vue: 'rappels' }));
    await pause(p, 250);
    await p.evaluate(() => {
      window.__confRes = 'en-attente';
      UI.confirmer({ titre: 'Modale', message: 'Test popstate' }).then((v) => { window.__confRes = v; });
    });
    await pause(p, 150);
    await p.goBack();
    await pause(p, 350);
    const dlgFerme = await p.evaluate(() => ({
      ouvert: document.querySelector('#dialogue').open,
      res: window.__confRes
    }));
    verifier(dlgFerme.ouvert === false && dlgFerme.res === false,
      'popstate ferme #dialogue et résout UI.confirmer à false', dlgFerme);

    await p.evaluate(() => Nav.aller({ vue: 'veterinaires' }));
    await pause(p, 250);
    await p.evaluate(() => {
      window.__visRes = false;
      const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
      UI.voirImage(svg, 'Test').then(() => { window.__visRes = true; });
    });
    await pause(p, 150);
    await p.goBack();
    await pause(p, 350);
    const visFerme = await p.evaluate(() => ({
      ouvert: document.querySelector('#visionneuse').open,
      res: window.__visRes
    }));
    verifier(visFerme.ouvert === false && visFerme.res === true,
      'popstate ferme #visionneuse et résout UI.voirImage', visFerme);
    await ctx.close();
  });

  await section('M1.5 (BUG-11 & BUG-13) : App.proteger() attendu et hash malformé #% récupéré', async () => {
    const { ctx, p } = await nouvellePage({
      ...PARIS,
      avant: async (c) => {
        await c.addInitScript(() => {
          Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: {
              persisted: () => new Promise((ok) => setTimeout(() => ok(true), 120)),
              persist: async () => true
            }
          });
        });
      }
    });
    await p.waitForSelector('#dialogue[open]', { timeout: 5000 });
    await p.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();
    await pause(p, 200);

    // Ouvre directement #reglages dans un nouvel onglet pour vérifier que App.proteger() est attendu avant le rendu
    const pReg = await ctx.newPage();
    await pReg.goto(adresse() + '#reglages');
    await pReg.waitForSelector('#reglages-contenu', { timeout: 5000 });
    await pReg.waitForFunction(() => document.querySelector('#reglages-contenu').textContent.includes('Stockage protégé'));
    const txtStockage = await pReg.$eval('#reglages-contenu', (e) => e.textContent);
    verifier(txtStockage.includes('Stockage protégé : oui'),
      'BUG-11 : App.proteger() est attendu avant affichage de #reglages', txtStockage.slice(0, 120));

    // Hash malformé #% et #animal/%E0%A4%A
    const pHash = await ctx.newPage();
    await pHash.goto(adresse() + '#%');
    await pause(pHash, 400);
    verifier(await pHash.isVisible('[data-vue="accueil"]'), 'BUG-13 : #% récupère proprement vers accueil');

    const roundTrip = await pHash.evaluate(() => {
      const h = Nav.adresse({ vue: 'animal', id: 'id/1?a#b', section: 'poids' });
      location.hash = h;
      const d1 = Nav.depuisAdresse();
      location.hash = '#animal/%E0%A4%A';
      const d2 = Nav.depuisAdresse();
      return { h, d1, d2 };
    });
    verifier(roundTrip.d1.vue === 'animal' && roundTrip.d1.id === 'id/1?a#b' && roundTrip.d2.vue === 'accueil',
      'Nav.adresse encode et Nav.depuisAdresse récupère sur URIError', roundTrip);
    await ctx.close();
  });

  await section('M1.6 : Durcissement Verrou (#carnet, popstate, corruption BD, cooldown, maxlength)', async () => {
    const { ctx, p } = await ouvrir();
    const maxLen = await p.getAttribute('#verrou-mdp', 'maxlength');
    verifier(maxLen === '200', '#verrou-mdp possède maxlength="200"', maxLen);

    // Remplit #carnet, active un mot de passe et verrouille -> #carnet doit être vidé
    await p.evaluate(async () => {
      document.querySelector('#carnet').append(document.createElement('div'));
      await Verrou.definir('chat-1234');
      history.pushState({ omni: true, vue: 'reglages', profondeur: 1 }, '', '#reglages');
    });
    const promVerrou = p.evaluate(() => { Verrou.demander(); });
    await p.waitForSelector('#verrou:not([hidden])', { timeout: 5000 });
    const carnetVide = await p.evaluate(() => document.querySelector('#carnet').childElementCount === 0);
    verifier(carnetVide, 'Verrou.demander() vide #carnet pour éviter toute fuite à l’impression');

    // popstate pendant le verrouillage ne doit ni changer la vue ni voler le focus
    await p.evaluate(() => {
      document.querySelector('#verrou-mdp').focus();
      history.back();
    });
    await pause(p, 250);
    const focusVerrou = await p.evaluate(() => ({
      verrouVisible: !document.querySelector('#verrou').hidden,
      actifId: document.activeElement && document.activeElement.id
    }));
    verifier(focusVerrou.verrouVisible && focusVerrou.actifId === 'verrou-mdp',
      'popstate pendant le verrouillage ne vole pas le focus', focusVerrou);

    // 3 échecs consécutifs -> 4e bloqué par temporisation (cooldown)
    for (let i = 0; i < 3; i++) {
      await p.fill('#verrou-mdp', 'faux-' + i);
      await p.click('#verrou-form button[type=submit]');
      await pause(p, 350);
    }
    await p.fill('#verrou-mdp', 'chat-1234');
    await p.click('#verrou-form button[type=submit]');
    await pause(p, 150);
    const msgCooldown = await p.$eval('#verrou-erreur', (e) => e.textContent);
    verifier(msgCooldown.includes('Trop d’essais incorrects'),
      'après 3 échecs, un 4e essai immédiat est bloqué par temporisation', msgCooldown);

    // Attend la fin du cooldown (1 s) et vérifie le déverrouillage
    await pause(p, 1100);
    await p.fill('#verrou-mdp', 'chat-1234');
    await p.click('#verrou-form button[type=submit]');
    await promVerrou;
    await pause(p, 300);
    verifier(await p.evaluate(() => document.querySelector('#verrou').hidden), 'déverrouillage après temporisation');

    // Enregistrements corrompus en base -> rejet explicite (fail-closed)
    const corruptions = await p.evaluate(async () => {
      const cas = [
        'bad',
        { sel: 'zz', iterations: 0, empreinte: 'x' },
        { sel: '00'.repeat(16), iterations: 1e9, empreinte: '00'.repeat(32) }
      ];
      const resultats = [];
      for (const c of cas) {
        await BD.definirReglage('motDePasse', c);
        try {
          await Verrou.verifier('x');
          resultats.push(false);
        } catch (e) {
          resultats.push(true);
        }
      }
      return resultats;
    });
    verifier(corruptions.every(Boolean), 'enregistrements motDePasse corrompus rejetés (fail-closed)', corruptions);

    // Vérifie que #verrou-form affiche l'erreur sans déverrouiller si BD corrompue
    const pCorrompu = await ctx.newPage();
    await pCorrompu.goto(adresse());
    await pCorrompu.waitForSelector('#verrou:not([hidden])', { timeout: 5000 });
    await pCorrompu.fill('#verrou-mdp', 'x');
    await pCorrompu.click('#verrou-form button[type=submit]');
    await pause(pCorrompu, 300);
    const etatCorrompu = await pCorrompu.evaluate(() => ({
      verrouVisible: !document.querySelector('#verrou').hidden,
      erreur: document.querySelector('#verrou-erreur').textContent
    }));
    verifier(etatCorrompu.verrouVisible && etatCorrompu.erreur.includes('corrompues'),
      'formulaire de verrouillage affiche l’erreur sur données corrompues sans déverrouiller', etatCorrompu);
    await ctx.close();
  });

  await section('M1.7 : Conformité LISEZMOI.md (Omni-Système)', async () => {
    const lisezmoi = fs.readFileSync(path.join(RACINE, 'LISEZMOI.md'), 'utf8');
    verifier(lisezmoi.includes('init-theme.js'), 'LISEZMOI.md documente init-theme.js');
    verifier(lisezmoi.includes('omni-systeme.choking513@passmail.net'),
      'LISEZMOI.md contient l’adresse de contact explicite');
    verifier(lisezmoi.includes('CC BY-NC-ND 4.0') &&
      lisezmoi.includes('Attribution-NonCommercial-NoDerivatives 4.0 International'),
      'LISEZMOI.md contient la mention officielle CC BY-NC-ND 4.0');
    verifier(lisezmoi.includes('Ferrus Dantioch') &&
      /non commercial/i.test(lisezmoi) && /dérivées|modifiées/i.test(lisezmoi),
      'LISEZMOI.md contient la traduction et les conditions en français');
  });
});
