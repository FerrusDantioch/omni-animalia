/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests unitaires et d’intégration M2 (v1.3.0) :
   - Fiche de garde : EcranGarde.texteResume & Partager / Copier (R1)
   - Vétérinaires : vétérinaire d’urgence / clinique 24h (R1)
   - Accueil : badge de prises de médicaments du jour (R3)

   Lancer :  node tests/unit-v130-m2.js
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

lancer('Omni-Animalia (v1.3.0 M2)', async () => {
  const { ctx, p } = await ouvrir();

  await section('EcranGarde : texteResume (pur), garde-fous, vetoUrgence et Partager / Copier (R1)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Cas limites de texteResume
      const vide0 = EcranGarde.texteResume();
      const videNull = EcranGarde.texteResume(null);
      const videSansAnimal = EcranGarde.texteResume({ animal: null });
      const minimal = EcranGarde.texteResume({
        animal: { id: 'a_min', nom: 'Pixel', alimRepas: NaN },
        traitements: [{ id: 't_nan', nom: 'Test', prisesParJour: NaN, statut: 'en-cours' }],
        reference: '2026-06-15'
      });

      // 2. Cas complet + XSS brut sans échappement HTML + tri déterministe des traitements
      const ref = '2026-06-15';
      const complet = EcranGarde.texteResume({
        animal: {
          id: 'a_comp',
          nom: 'Moka <script>alert(1)</script>',
          espece: 'Chien',
          race: 'Croisé & Beagle',
          sexe: 'femelle',
          alimEviter: 'Chocolat & raisins',
          alimMarque: 'Croquettes Douces',
          alimQuantite: '180 g',
          alimRepas: 2,
          alimRemarques: 'Ajouter un peu d’eau tiède',
          consignesGarde: 'Sortie matin & soir',
          puce: '250269800001234',
          tatouage: 'TAT123',
          couleur: 'Roux <blanc>'
        },
        traitements: [
          { id: 't_term', animalId: 'a_comp', nom: 'Fini', statut: 'termine', debut: '2026-06-01' },
          { id: 't_fut', animalId: 'a_comp', nom: 'Cure future', statut: 'en-cours', debut: '2026-06-20', dose: '1 cp' },
          { id: 't_act', animalId: 'a_comp', nom: 'Cure active', statut: 'en-cours', debut: '2026-06-10', fin: '2026-06-30', dose: '5 ml', frequence: 'Matin', prisesParJour: 1 }
        ],
        notes: [
          { id: 'n_all', animalId: 'a_comp', categorie: 'allergie', texte: 'Poulet & maïs', date: '2026-05-01' },
          { id: 'n_obs', animalId: 'a_comp', categorie: 'observation', texte: 'Note normale', date: '2026-05-02' }
        ],
        veto: { nom: 'Dr Martin', clinique: 'Clinique Parc', telephone: '01 23 45 67 89', adresse: '10 rue Verte', notes: 'Fermé mercredi' },
        contact: { nom: 'Ferrus', telephone: '06 11 22 33 44' },
        vetoUrgence: { nom: 'Dr Garde', clinique: 'Urgences 24h', telephone: '01 99 88 77 66', adresse: '5 avenue Nuit', notes: 'Sonner à droite' },
        rappels: [
          { animalId: 'a_comp', date: '2026-06-20', heure: '14:30', titre: 'Vaccin rage', ecart: 5 },
          { animalId: 'a_comp', date: '2026-08-01', titre: 'Hors fenêtre 30j', ecart: 47 },
          { animalId: 'a_autre', date: '2026-06-18', titre: 'Autre animal', ecart: 3 }
        ],
        reference: ref
      });

      // 3. Intégration écran Fiche de garde + vetoUrgence + Partage.texte
      const auj = Dates.aujourdhui();
      await BD.enregistrer('veterinaires', { id: 'v_hab', nom: 'Dr Martin', clinique: 'Clinique Parc', telephone: '01 23 45 67 89' });
      await BD.definirReglage('contactGarde', { nom: 'Ferrus', telephone: '06 11 22 33 44' });
      await BD.definirReglage('vetoUrgence', { nom: 'Dr Garde', clinique: 'Urgences 24h', telephone: '01 99 88 77 66', adresse: '5 avenue Nuit' });
      await BD.enregistrer('animaux', {
        id: 'a_g', nom: 'Biscuit', espece: 'Chat', alimMarque: 'Pâtée', alimEviter: 'Oignon',
        consignesGarde: 'Laisser fenêtre fermée', vetoId: 'v_hab', archive: false
      });
      await BD.enregistrer('traitements', { id: 'tg1', animalId: 'a_g', nom: 'Sirop actif', statut: 'en-cours', debut: auj, prisesParJour: 1 });
      await BD.enregistrer('traitements', { id: 'tg2', animalId: 'a_g', nom: 'Sirop fini', statut: 'termine', debut: auj });

      await Nav.aller({ vue: 'garde', id: 'a_g' });
      await new Promise((ok) => setTimeout(ok, 150));

      const nbFiches = document.querySelectorAll('#garde-contenu .fiche-garde').length;
      const nbPiles = document.querySelectorAll('#garde-contenu .pile-boutons').length;
      const liensTel = [...document.querySelectorAll('#garde-contenu a.lien-tel')].map((a) => a.getAttribute('href'));
      const btnPartager = [...document.querySelectorAll('#garde-contenu .pile-boutons button')]
        .find((b) => /Partager\s*\/\s*Copier/i.test(b.textContent));

      // Test 3a : navigator.share réussi
      const origShareDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'share');
      const origCanShareDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'canShare');
      const origCopier = UI.copier;
      let shareRecu = null;
      let msgPartage = '';
      let msgAnnule = '';
      let copieRecue = null;
      let msgCopie = '';

      try {
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: async (data) => { shareRecu = data; }
        });
        Object.defineProperty(navigator, 'canShare', {
          configurable: true,
          value: () => true
        });
        btnPartager.click();
        await new Promise((ok) => setTimeout(ok, 120));
        msgPartage = document.querySelector('#annonce').textContent;

        // Test 3b : AbortError silencieux (aucune erreur annoncée)
        document.querySelector('#annonce').textContent = '';
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: async () => {
            const err = new Error('Annulé');
            err.name = 'AbortError';
            throw err;
          }
        });
        btnPartager.click();
        await new Promise((ok) => setTimeout(ok, 120));
        msgAnnule = document.querySelector('#annonce').textContent;

        // Test 3c : repli UI.copier quand navigator.share indisponible
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
        UI.copier = async (t) => { copieRecue = t; return true; };
        btnPartager.click();
        await new Promise((ok) => setTimeout(ok, 120));
        msgCopie = document.querySelector('#annonce').textContent;
      } finally {
        UI.copier = origCopier;
        if (origShareDesc) Object.defineProperty(Navigator.prototype, 'share', origShareDesc);
        delete navigator.share;
        if (origCanShareDesc) Object.defineProperty(Navigator.prototype, 'canShare', origCanShareDesc);
        delete navigator.canShare;
      }

      // 4. Régression enregistrements corrompus (nom absent / non-chaîne, sexe: 'toString')
      const resumeCorrompu = EcranGarde.texteResume({
        animal: { id: 'a_corr', nom: { mauvais: true }, sexe: 'toString' },
        reference: '2026-06-15'
      });
      await BD.ouvrir();
      await new Promise((resolve, reject) => {
        const tx = BD.base.transaction('animaux', 'readwrite');
        tx.objectStore('animaux').put({ id: 'a_corr', nom: null, sexe: 'toString', archive: false });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      await Nav.aller({ vue: 'garde', id: 'a_corr' });
      await new Promise((ok) => setTimeout(ok, 120));
      const titreCorrompu = document.querySelector('#garde-titre')?.textContent || '';
      const aideCorrompue = document.querySelector('#garde-contenu .aide')?.textContent || '';
      const nomCorrompuEl = document.querySelector('#garde-contenu .garde-nom')?.textContent || '';
      const contenuCorrompu = document.querySelector('#garde-contenu')?.textContent || '';
      const fragConstruitCorrompu = await EcranGarde.construire({ id: 'a_corr2', nom: { x: 1 }, sexe: 'toString' }, false);
      const nomConstruitCorrompu = fragConstruitCorrompu.querySelector('.garde-nom')?.textContent || '';
      const sousTitreConstruitCorrompu = fragConstruitCorrompu.querySelector('.garde-entete p:last-child')?.textContent || '';

      return {
        vide0, videNull, videSansAnimal, minimal, complet,
        nbFiches, nbPiles, liensTel,
        aBtnPartager: !!btnPartager,
        shareRecu, msgPartage, msgAnnule, copieRecue, msgCopie,
        resumeCorrompu, titreCorrompu, aideCorrompue, nomCorrompuEl, contenuCorrompu,
        nomConstruitCorrompu, sousTitreConstruitCorrompu
      };
    });

    verifier(r.vide0 === '' && r.videNull === '' && r.videSansAnimal === '', 'texteResume renvoie "" si animal absent ou invalide', r);
    verifier(
      r.minimal.includes('Fiche de garde — Pixel') &&
      !r.minimal.includes('À contacter') &&
      !r.minimal.includes('Repas') &&
      !r.minimal.includes('Consignes') &&
      !r.minimal.includes('undefined') &&
      !r.minimal.includes('null') &&
      !r.minimal.includes('NaN'),
      'texteResume omet les sections vides et n’affiche jamais undefined/null/NaN',
      r.minimal
    );
    verifier(
      r.complet.includes('Moka <script>alert(1)</script>') &&
      r.complet.includes('Croisé & Beagle') &&
      !r.complet.includes('&lt;') &&
      !r.complet.includes('&amp;') &&
      r.complet.includes('Urgence vétérinaire 24h : Dr Garde — Urgences 24h') &&
      r.complet.includes('Téléphone urgence : 01 99 88 77 66') &&
      r.complet.includes('Chocolat & raisins') &&
      r.complet.includes('Poulet & maïs') &&
      !r.complet.includes('Note normale') &&
      r.complet.includes('Cure active') &&
      r.complet.includes('Cure future — À venir') &&
      r.complet.indexOf('Cure active') < r.complet.indexOf('Cure future') &&
      !r.complet.includes('Fini') &&
      r.complet.includes('Vaccin rage') &&
      !r.complet.includes('Hors fenêtre 30j') &&
      !r.complet.includes('Autre animal') &&
      r.complet.includes('250269800001234'),
      'texteResume complet en texte brut sans échappement HTML, trié et filtré correctement',
      r.complet
    );
    verifier(r.nbFiches === 1 && r.nbPiles === 1 && r.aBtnPartager, 'EcranGarde conserve 1 .fiche-garde, 1 .pile-boutons et le bouton Partager / Copier', r);
    verifier(
      r.liensTel.length === 3 &&
      r.liensTel[0] === 'tel:0611223344' &&
      r.liensTel[1] === 'tel:0123456789' &&
      r.liensTel[2] === 'tel:0199887766',
      'EcranGarde affiche le vétérinaire d’urgence après le propriétaire et le vétérinaire habituel',
      r.liensTel
    );
    verifier(
      r.shareRecu && r.shareRecu.title.includes('Biscuit') && r.shareRecu.text.includes('Sirop actif') &&
      !r.shareRecu.text.includes('Sirop fini') && r.msgPartage.includes('Fiche de garde partagée'),
      'Bouton Partager appelle Partage.texte via navigator.share et annonce le partage',
      r
    );
    verifier(r.msgAnnule === '', 'AbortError lors du partage reste silencieux sans message d’erreur', r.msgAnnule);
    verifier(
      typeof r.copieRecue === 'string' && r.copieRecue.includes('Biscuit') && r.msgCopie.includes('presse-papiers'),
      'Repli presse-papiers fonctionne quand navigator.share est absent',
      r
    );
    verifier(
      r.resumeCorrompu.includes('Fiche de garde — Animal') &&
      !r.resumeCorrompu.includes('undefined') &&
      !r.resumeCorrompu.includes('NaN') &&
      !r.resumeCorrompu.includes('[object Object]') &&
      !r.resumeCorrompu.includes('toString') &&
      r.titreCorrompu === 'Fiche de garde' &&
      r.aideCorrompue.includes('cet animal') &&
      !r.aideCorrompue.includes('undefined') &&
      r.nomCorrompuEl === '' &&
      !r.contenuCorrompu.includes('undefined') &&
      !r.contenuCorrompu.includes('NaN') &&
      r.nomConstruitCorrompu === '' &&
      !r.sousTitreConstruitCorrompu.includes('toString'),
      'EcranGarde résiste aux noms absents/non-chaînes et à sexe="toString" sans undefined ni NaN',
      {
        titreCorrompu: r.titreCorrompu,
        aideCorrompue: r.aideCorrompue,
        nomCorrompuEl: r.nomCorrompuEl,
        nomConstruitCorrompu: r.nomConstruitCorrompu,
        sousTitreConstruitCorrompu: r.sousTitreConstruitCorrompu
      }
    );
  });

  await section('EcranVeto : vétérinaire d’urgence / clinique 24h, tel:, XSS, concurrence et layout (R1)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      await BD.enregistrer('veterinaires', { id: 'v1', nom: 'Dr Regular', telephone: '01 11 11 11 11' });

      await Nav.aller({ vue: 'veterinaires' });
      await new Promise((ok) => setTimeout(ok, 150));

      const urgEl = document.querySelector('#veto-urgence');
      const listeEl = document.querySelector('#vetos-liste');
      const avantListe = !!(urgEl && listeEl && urgEl.nextElementSibling === listeEl);
      const dansListe = !!(listeEl && urgEl && listeEl.contains(urgEl));
      const aClasseCarte = !!(urgEl && (urgEl.classList.contains('carte') || urgEl.classList.contains('carte-fiche')));
      const nbCartesInit = document.querySelectorAll('#vetos-liste .carte').length;
      const txtInit = urgEl ? urgEl.textContent : '';

      // 1. Ouvrir formulaire d’urgence, tester téléphone invalide puis trop long (<= 30)
      const btnConfig = [...urgEl.querySelectorAll('button')].find((b) => /Configurer/i.test(b.textContent));
      btnConfig.click();
      await new Promise((ok) => setTimeout(ok, 120));

      const form1 = document.querySelector('#formulaire-zone form');
      form1.querySelector('#champ-clinique').value = 'Clinique H24';
      form1.querySelector('#champ-telephone').value = 'pas-valide';
      await Formulaire.soumettre(form1);
      const errTelInvalide = form1.querySelector('[data-champ="telephone"] .message-erreur').textContent;

      // Test téléphone très long (E2E-F17-T2-04 : maxlength <= 40 et soumission OK)
      const champTel = form1.querySelector('#champ-telephone');
      const maxLenTel = champTel.maxLength;
      champTel.value = '0'.repeat(100).slice(0, maxLenTel);
      // Envoi avec nom vide autorisé (clinique seule)
      form1.querySelector('#champ-nom').value = '';
      await Formulaire.soumettre(form1);
      await new Promise((ok) => setTimeout(ok, 150));

      const apresCliniqueSeule = await BD.reglage('vetoUrgence', null);
      const titreCliniqueSeule = document.querySelector('#veto-urgence h2').textContent;
      const telLienClinique = document.querySelector('#veto-urgence a.lien-tel')?.getAttribute('href') || '';

      // 2. Modifier avec données complètes + charge XSS
      const btnModif = [...document.querySelectorAll('#veto-urgence button')].find((b) => /Modifier/i.test(b.textContent));
      btnModif.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const form2 = document.querySelector('#formulaire-zone form');
      const payloadXss = '<img src=x onerror=window.__xssM2=1>';
      form2.querySelector('#champ-nom').value = 'Dr Urgence ' + payloadXss;
      form2.querySelector('#champ-clinique').value = 'Centre 24h';
      form2.querySelector('#champ-telephone').value = '01 22 33 44 55';
      form2.querySelector('#champ-adresse').value = '42 rue Secours';
      form2.querySelector('#champ-notes').value = 'Code 1234';
      await Formulaire.soumettre(form2);
      await new Promise((ok) => setTimeout(ok, 150));

      const urgenceSauvee = await BD.reglage('vetoUrgence', null);
      const urgTxtModif = document.querySelector('#veto-urgence').textContent;
      const imgsInjectees = document.querySelectorAll('#veto-urgence img').length;
      const telLienModif = document.querySelector('#veto-urgence a.lien-tel')?.getAttribute('href') || '';
      const nbCartesApresModif = document.querySelectorAll('#vetos-liste .carte').length;

      // 3. Concurrence _tour sur EcranVeto.afficher()
      await Promise.all([EcranVeto.afficher(), EcranVeto.afficher()]);
      const nbZonesUrgence = document.querySelectorAll('#veto-urgence').length;

      // 4. Vérification débordement en taille tresgrand & thèmes
      const origTaille = document.documentElement.getAttribute('data-taille');
      const origTheme = document.documentElement.getAttribute('data-theme');
      const debordements = [];
      for (const theme of ['omni', 'sombre', 'clair']) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-taille', 'tresgrand');
        await new Promise((ok) => setTimeout(ok, 30));
        if (document.documentElement.scrollWidth > window.innerWidth) {
          debordements.push(theme + ':' + document.documentElement.scrollWidth + '>' + window.innerWidth);
        }
      }
      if (origTaille) document.documentElement.setAttribute('data-taille', origTaille);
      else document.documentElement.removeAttribute('data-taille');
      if (origTheme) document.documentElement.setAttribute('data-theme', origTheme);
      else document.documentElement.removeAttribute('data-theme');

      // 5. Effacer avec confirmation (annuler puis confirmer)
      const origConf = UI.confirmer;
      UI.confirmer = async () => false;
      const btnEffacer = [...document.querySelectorAll('#veto-urgence button')].find((b) => /Effacer/i.test(b.textContent));
      btnEffacer.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const encorePresent = await BD.reglage('vetoUrgence', null);

      UI.confirmer = async () => true;
      document.querySelector('#veto-urgence button.danger-discret').click();
      await new Promise((ok) => setTimeout(ok, 150));
      UI.confirmer = origConf;
      const apresEffacer = await BD.reglage('vetoUrgence', null);
      const txtApresEffacer = document.querySelector('#veto-urgence').textContent;

      return {
        avantListe, dansListe, aClasseCarte, nbCartesInit, txtInit,
        errTelInvalide, maxLenTel, apresCliniqueSeule, titreCliniqueSeule, telLienClinique,
        urgenceSauvee, urgTxtModif, imgsInjectees, telLienModif, nbCartesApresModif,
        nbZonesUrgence, debordements, xssExec: !!window.__xssM2,
        encorePresent: !!encorePresent, apresEffacer, txtApresEffacer
      };
    });

    verifier(r.avantListe && !r.dansListe && !r.aClasseCarte && r.nbCartesInit === 1, '#veto-urgence est placé avant #vetos-liste sans classe .carte', r);
    verifier(r.txtInit.includes('Urgence / Clinique 24h') && r.txtInit.includes('Configurer'), 'État vide de #veto-urgence affiché', r.txtInit);
    verifier(r.errTelInvalide.length > 0 && r.maxLenTel === 30, 'Téléphone urgence invalide rejeté et longueur max 30 respectée', r);
    verifier(r.apresCliniqueSeule && r.titreCliniqueSeule === 'Clinique H24' && r.telLienClinique.startsWith('tel:0'), 'Enregistrement clinique seule (sans nom) réussi', r);
    verifier(
      r.urgenceSauvee && r.urgenceSauvee.clinique === 'Centre 24h' &&
      r.telLienModif === 'tel:0122334455' && r.imgsInjectees === 0 && !r.xssExec &&
      r.urgTxtModif.includes('<img src=x') && r.nbCartesApresModif === 1,
      'Modification urgence, lien tel: sécurisé et protection XSS vérifiés',
      r
    );
    verifier(r.nbZonesUrgence === 1 && r.debordements.length === 0, 'Concurrence _tour et responsive tresgrand/3 thèmes sans débordement', r);
    verifier(r.encorePresent && r.apresEffacer === null && r.txtApresEffacer.includes('Configurer'), 'Effacement protégé par UI.confirmer puis réinitialisé à null', r);
  });

  await section('EcranAccueil : badge de prises de médicaments du jour (R3)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Compatibilité 2 arguments & valeurs limites de carte()
      const c2 = EcranAccueil.carte({ id: 'x', nom: 'Test' }, { retard: 1, bientot: 0 });
      const cNum1 = EcranAccueil.carte({ id: 'x', nom: 'Test' }, null, 1);
      const cObj3 = EcranAccueil.carte({ id: 'x', nom: 'Test' }, null, { total: 3 });
      const cNaN = EcranAccueil.carte({ id: 'x', nom: 'Test' }, null, NaN);

      const auj = Dates.aujourdhui();
      const hier = Dates.ajouterJours(auj, -1);
      const demain = Dates.ajouterJours(auj, 1);

      // Animaux A..E + archivé + IDs sensibles au prototype + animal corrompu
      await BD.enregistrer('animaux', { id: 'a_a', nom: 'Alpha', archive: false });
      await BD.enregistrer('animaux', { id: 'a_b', nom: 'Bravo', archive: false });
      await BD.enregistrer('animaux', { id: 'a_c', nom: 'Charlie', archive: false });
      await BD.enregistrer('animaux', { id: 'a_d', nom: 'Delta', archive: true });
      await BD.enregistrer('animaux', { id: 'a_e', nom: 'Echo', archive: false });
      await BD.enregistrer('animaux', { id: 'toString', nom: 'ZuluProto', archive: false });
      const txCorrupt = await BD._transaction('animaux', 'readwrite');
      txCorrupt.objectStore('animaux').put({ id: '', nom: 'SansId', archive: false });
      await BD.finTransaction(txCorrupt);

      // Animal A : chronique sans fin, 2/jour, 1 prise notée -> 1 prise à noter
      await BD.enregistrer('traitements', {
        id: 'ta1', animalId: 'a_a', nom: 'Chronique A', statut: 'en-cours',
        debut: hier, prisesParJour: 2, prises: { [auj]: ['08:00'] }
      });

      // Animal B : borné fin === aujourdhui (0/3) + chronique sans fin (1/2) -> 4 prises à noter
      await BD.enregistrer('traitements', {
        id: 'tb1', animalId: 'a_b', nom: 'Cure B1', statut: 'en-cours',
        debut: hier, fin: auj, prisesParJour: 3
      });
      await BD.enregistrer('traitements', {
        id: 'tb2', animalId: 'a_b', nom: 'Chronique B2', statut: 'en-cours',
        debut: hier, prisesParJour: 2, prises: { [auj]: ['09:00'] }
      });

      // Animal C : tout pris + terminé + futur + expiré -> aucun badge prises
      await BD.enregistrer('traitements', {
        id: 'tc1', animalId: 'a_c', nom: 'Complet', statut: 'en-cours',
        debut: hier, prisesParJour: 1, prises: { [auj]: ['08:00'] }
      });
      await BD.enregistrer('traitements', {
        id: 'tc2', animalId: 'a_c', nom: 'Terminé', statut: 'termine',
        debut: hier, prisesParJour: 2
      });
      await BD.enregistrer('traitements', {
        id: 'tc3', animalId: 'a_c', nom: 'Futur', statut: 'en-cours',
        debut: demain, prisesParJour: 2
      });
      await BD.enregistrer('traitements', {
        id: 'tc4', animalId: 'a_c', nom: 'Expiré', statut: 'en-cours',
        debut: Dates.ajouterJours(auj, -5), fin: hier, prisesParJour: 2
      });

      // Animal D (archivé) : chronique -> absent de l'accueil
      await BD.enregistrer('traitements', {
        id: 'td1', animalId: 'a_d', nom: 'Archivé', statut: 'en-cours',
        debut: hier, prisesParJour: 2
      });

      // Animal E : retard + bientôt + 1 prise à noter coexistants
      await BD.enregistrer('vaccins', { id: 've1', animalId: 'a_e', nom: 'Rage', date: Dates.ajouterJours(auj, -30), rappel: hier });
      await BD.enregistrer('taches', { id: 'te1', animalId: 'a_e', titre: 'Pesée', echeance: demain, fait: false });
      await BD.enregistrer('traitements', { id: 'tre1', animalId: 'a_e', nom: 'Gouttes', statut: 'en-cours', debut: hier, prisesParJour: 1 });

      await Nav.aller({ vue: 'accueil' });
      await new Promise((ok) => setTimeout(ok, 150));

      const lireBadge = (nom) => {
        const carte = [...document.querySelectorAll('#accueil-liste .carte-animal')]
          .find((el) => el.querySelector('.carte-titre')?.textContent === nom);
        if (!carte) return null;
        return {
          retard: carte.querySelector('.badge.retard')?.textContent || '',
          bientot: carte.querySelector('.badge.bientot')?.textContent || '',
          prises: carte.querySelector('.badge.prises')?.textContent || ''
        };
      };

      const avant = {
        nbCartes: document.querySelectorAll('#accueil-liste .carte-animal').length,
        alpha: lireBadge('Alpha'),
        bravo: lireBadge('Bravo'),
        charlie: lireBadge('Charlie'),
        delta: lireBadge('Delta'),
        echo: lireBadge('Echo'),
        zulu: lireBadge('ZuluProto')
      };

      // Débordement sous taille tresgrand
      const origTaille = document.documentElement.getAttribute('data-taille');
      document.documentElement.setAttribute('data-taille', 'tresgrand');
      await new Promise((ok) => setTimeout(ok, 30));
      const debordement = document.documentElement.scrollWidth > window.innerWidth;
      if (origTaille) document.documentElement.setAttribute('data-taille', origTaille);
      else document.documentElement.removeAttribute('data-taille');

      // Noter la dernière prise de Alpha via EcranSante.noterPrise et rafraîchir
      const ta1 = await BD.lire('traitements', 'ta1');
      await EcranSante.noterPrise(ta1);
      await EcranAccueil.afficher();
      const alphaApresPrise = lireBadge('Alpha');

      // Noter 1 prise sur Bravo (4 -> 3)
      const tb1 = await BD.lire('traitements', 'tb1');
      await EcranSante.noterPrise(tb1);
      await EcranAccueil.afficher();
      const bravoApresPrise = lireBadge('Bravo');

      return {
        c2Prises: !!c2.querySelector('.badge.prises'),
        cNum1Txt: cNum1.querySelector('.badge.prises')?.textContent || '',
        cObj3Txt: cObj3.querySelector('.badge.prises')?.textContent || '',
        cNaNPrises: !!cNaN.querySelector('.badge.prises'),
        avant, debordement, alphaApresPrise, bravoApresPrise
      };
    });

    verifier(
      !r.c2Prises && r.cNum1Txt === '1 prise à noter' && r.cObj3Txt === '3 prises à noter' && !r.cNaNPrises,
      'EcranAccueil.carte gère 2 args, singulier/pluriel et valeurs invalides',
      r
    );
    verifier(
      r.avant.nbCartes === 6 &&
      r.avant.alpha && r.avant.alpha.prises === '1 prise à noter' &&
      r.avant.bravo && r.avant.bravo.prises === '4 prises à noter' &&
      r.avant.charlie && r.avant.charlie.prises === '' &&
      r.avant.delta === null &&
      r.avant.zulu && r.avant.zulu.prises === '',
      'Badges de prises affichés pour chroniques/bornés et absents si complet/terminé/futur/expiré/archivé/prototype',
      r.avant
    );
    verifier(
      r.avant.echo &&
      r.avant.echo.retard === '1 en retard' &&
      r.avant.echo.bientot === '1 bientôt' &&
      r.avant.echo.prises === '1 prise à noter',
      'Badge prises coexiste avec les badges retard et bientôt sur la même carte',
      r.avant.echo
    );
    verifier(
      r.alphaApresPrise && r.alphaApresPrise.prises === '' &&
      r.bravoApresPrise && r.bravoApresPrise.prises === '3 prises à noter',
      'Noter une prise met à jour puis retire le badge à 0 restant',
      { alphaApresPrise: r.alphaApresPrise, bravoApresPrise: r.bravoApresPrise }
    );
    verifier(!r.debordement, 'Aucun débordement horizontal sur Accueil avec badges en taille tresgrand');
  });

  await ctx.close();
});
