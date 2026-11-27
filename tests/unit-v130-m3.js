/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests unitaires v1.3.0 — M3 (ecran-agenda.js) :
   - filtre rapide par animal sur la page Rappels ;
   - actions rapides (« Noter le rappel fait », « Noter la prise suivante ») ;
   - bilan annuel global des dépenses vétérinaires.

   Lancer :  node tests/unit-v130-m3.js
   ============================================================ */
'use strict';
const { lancer, section, verifier, nouvellePage } = require('./outils.js');

const PARIS = { timezoneId: 'Europe/Paris' };
const pause = (p, ms) => p.waitForTimeout(ms || 200);

async function ouvrir(options) {
  const r = await nouvellePage({ ...PARIS, ...(options || {}) });
  await r.p.waitForSelector('#dialogue[open]', { timeout: 5000 });
  await r.p.locator('#dialogue[open] button', { hasText: 'J’ai compris' }).first().click();
  await pause(r.p);
  return r;
}

lancer('Omni-Animalia (v1.3.0 — M3)', async () => {
  const { ctx, p } = await ouvrir();

  await section('M3-1 : Filtre rapide par animal sur la page Rappels', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const auj = Dates.aujourdhui();

      await BD.enregistrer('animaux', { id: 'a_z', nom: 'Zoe', espece: 'Chien', archive: false });
      await BD.enregistrer('animaux', { id: 'a_a', nom: 'Alpha', espece: 'Chat', archive: false });
      await BD.enregistrer('animaux', { id: 'a_m', nom: 'Moka', espece: 'Chat', archive: false });
      await BD.enregistrer('animaux', { id: 'a_arch', nom: 'Ancien', espece: 'Chien', archive: true });

      // Alpha : 1 médicament du jour + 1 traitement en retard toujours en cours + 1 vaccin en retard + 1 tâche J+3 + 1 tâche J+45
      await BD.enregistrer('traitements', { id: 'tr_a1', animalId: 'a_a', nom: 'Med Alpha', statut: 'en-cours', prisesParJour: 2, debut: Dates.ajouterJours(auj, -1) });
      await BD.enregistrer('traitements', { id: 'tr_ret', animalId: 'a_a', nom: 'Cure retard', statut: 'en-cours', prisesParJour: 1, debut: Dates.ajouterJours(auj, -5), fin: Dates.ajouterJours(auj, -1) });
      await BD.enregistrer('vaccins', { id: 'vac_a', animalId: 'a_a', nom: 'Rage', date: Dates.ajouterJours(auj, -366), rappel: Dates.ajouterJours(auj, -1) });
      await BD.enregistrer('taches', { id: 'tac_a1', animalId: 'a_a', titre: 'Griffe Alpha', echeance: Dates.ajouterJours(auj, 3), fait: false });
      await BD.enregistrer('taches', { id: 'tac_a2', animalId: 'a_a', titre: 'Lointain Alpha', echeance: Dates.ajouterJours(auj, 45), fait: false });

      // Zoe : 1 médicament du jour + 1 antiparasitaire aujourd'hui + 1 tâche J+2
      await BD.enregistrer('traitements', { id: 'tr_z1', animalId: 'a_z', nom: 'Med Zoe', statut: 'en-cours', prisesParJour: 1, debut: auj });
      await BD.enregistrer('antiparasitaires', { id: 'ap_z', animalId: 'a_z', type: 'vermifuge', produit: 'Milbemax', date: Dates.ajouterJours(auj, -30), prochaine: auj });
      await BD.enregistrer('taches', { id: 'tac_z1', animalId: 'a_z', titre: 'Bain Zoe', echeance: Dates.ajouterJours(auj, 2), fait: false });

      // Animal archivé : ne doit ni apparaître dans le filtre ni dans les rappels
      await BD.enregistrer('taches', { id: 'tac_arch', animalId: 'a_arch', titre: 'Tache Archivee', echeance: auj, fait: false });

      EcranAgenda.filtreAnimalId = '';
      await Nav.remplacer({ vue: 'rappels' });
      await new Promise((ok) => setTimeout(ok, 80));

      const labelText = document.querySelector('label[for="rappels-filtre-animal"]')?.textContent || '';
      const selInit = document.querySelector('#rappels-filtre-animal');
      const options = [...selInit.options].map((o) => ({ value: o.value, text: o.textContent }));
      const medsTousTitre = document.querySelector('#rappels-medicaments')?.textContent || '';
      const medsTousTxt = document.querySelector('#rappels-liste .medicaments')?.textContent || '';
      const retardTousTitre = document.querySelector('#rappels-retard')?.textContent || '';
      const aujTousTitre = document.querySelector('#rappels-aujourdhui')?.textContent || '';
      const semTousTitre = document.querySelector('#rappels-semaine')?.textContent || '';
      const agendaToutTous = document.querySelector('#agenda-tout')?.textContent || '';
      const pastilleGlobale = document.querySelector('#nav-pastille')?.textContent || '';

      // Sélectionner Alpha ('a_a')
      selInit.value = 'a_a';
      selInit.dispatchEvent(new Event('change'));
      await new Promise((ok) => setTimeout(ok, 80));

      const medsAlphaTitre = document.querySelector('#rappels-medicaments')?.textContent || '';
      const medsAlphaTxt = document.querySelector('#rappels-liste .medicaments')?.textContent || '';
      const retardAlphaTitre = document.querySelector('#rappels-retard')?.textContent || '';
      const aujAlphaTitre = document.querySelector('#rappels-aujourdhui')?.textContent || '';
      const semAlphaTitre = document.querySelector('#rappels-semaine')?.textContent || '';
      const listeAlphaTxt = document.querySelector('#rappels-liste')?.textContent || '';
      const agendaToutAlpha = document.querySelector('#agenda-tout')?.textContent || '';
      const pastilleApresFiltre = document.querySelector('#nav-pastille')?.textContent || '';

      // Persistance après rafraichirRappels()
      await EcranAgenda.rafraichirRappels();
      const filtreApresRafraichir = EcranAgenda.filtreAnimalId;
      const selectValApresRafraichir = document.querySelector('#rappels-filtre-animal')?.value || '';

      // Filtrer sur Moka (0 rappel, 0 médicament)
      const sel2 = document.querySelector('#rappels-filtre-animal');
      sel2.value = 'a_m';
      sel2.dispatchEvent(new Event('change'));
      await new Promise((ok) => setTimeout(ok, 80));
      const listeMokaTxt = document.querySelector('#rappels-liste')?.textContent || '';
      const medsMokaCount = document.querySelectorAll('#rappels-liste .medicaments').length;

      // Retour sur Alpha, puis archivage d'Alpha -> filtreAnimalId réinitialisé à ''
      const sel3 = document.querySelector('#rappels-filtre-animal');
      sel3.value = 'a_a';
      sel3.dispatchEvent(new Event('change'));
      await new Promise((ok) => setTimeout(ok, 80));
      const alphaLu = await BD.lire('animaux', 'a_a');
      await BD.enregistrer('animaux', { ...alphaLu, archive: true });
      await EcranAgenda.rafraichirRappels();
      const filtreApresArchive = EcranAgenda.filtreAnimalId;
      const optionsApresArchive = [...document.querySelectorAll('#rappels-filtre-animal option')].map((o) => o.value);

      // Suppression de tous les animaux actifs -> réinitialise filtre et affiche .encart.vide
      const sel4 = document.querySelector('#rappels-filtre-animal');
      sel4.value = 'a_z';
      sel4.dispatchEvent(new Event('change'));
      await new Promise((ok) => setTimeout(ok, 80));
      await BD.supprimerAnimal('a_z');
      await BD.supprimerAnimal('a_m');
      await EcranAgenda.rafraichirRappels();
      const filtreApresSuppression = EcranAgenda.filtreAnimalId;
      const videTxt = document.querySelector('#rappels-liste .encart.vide')?.textContent || '';

      return {
        labelText, options,
        medsTousTitre, medsTousHasRet: medsTousTxt.includes('Cure retard') && medsTousTxt.includes('toujours en cours'),
        retardTousTitre, aujTousTitre, semTousTitre, agendaToutTous, pastilleGlobale,
        medsAlphaTitre, medsAlphaHasRet: medsAlphaTxt.includes('Cure retard') && medsAlphaTxt.includes('toujours en cours'),
        medsAlphaHasZoe: medsAlphaTxt.includes('Med Zoe'),
        retardAlphaTitre, aujAlphaTitre, semAlphaTitre,
        listeAlphaHasZoe: listeAlphaTxt.includes('Bain Zoe') || listeAlphaTxt.includes('Milbemax'),
        listeAlphaHasLointain: listeAlphaTxt.includes('1 autre(s) rappel(s)'),
        agendaToutAlpha, pastilleApresFiltre,
        filtreApresRafraichir, selectValApresRafraichir,
        listeMokaHasOthers: listeMokaTxt.includes('Griffe Alpha') || listeMokaTxt.includes('Bain Zoe'),
        medsMokaCount,
        filtreApresArchive, optionsApresArchive,
        filtreApresSuppression, videTxt
      };
    });

    verifier(r.labelText === 'Filtrer par animal', 'libellé accessible présent sur #rappels-filtre-animal', r.labelText);
    verifier(
      JSON.stringify(r.options.map((o) => o.text)) === JSON.stringify(['Tous les animaux', 'Alpha', 'Moka', 'Zoe']),
      'options du filtre triées alphabétiquement sans animaux archivés',
      r.options
    );
    verifier(
      r.medsTousTitre === 'Médicaments du jour (3)' && r.medsTousHasRet &&
      r.retardTousTitre === 'En retard (2)' && r.aujTousTitre === 'Aujourd’hui (1)' &&
      r.semTousTitre === 'Dans les 7 jours (2)' && r.agendaToutTous.includes('4 rappels à venir') &&
      r.pastilleGlobale === '3',
      'vue non filtrée affiche tous les médicaments (dont en retard en cours), rappels et pastille globale',
      r
    );
    verifier(
      r.medsAlphaTitre === 'Médicaments du jour (2)' && r.medsAlphaHasRet && !r.medsAlphaHasZoe &&
      r.retardAlphaTitre === 'En retard (2)' && r.aujAlphaTitre === 'Aujourd’hui (0)' &&
      r.semAlphaTitre === 'Dans les 7 jours (1)' && !r.listeAlphaHasZoe &&
      r.listeAlphaHasLointain && r.agendaToutAlpha.includes('2 rappels à venir'),
      'filtre sur Alpha filtre médicaments (avec Cure retard), groupes, plusTard et #agenda-tout',
      r
    );
    verifier(r.pastilleApresFiltre === '3', '#nav-pastille reste globale malgré le filtre', r.pastilleApresFiltre);
    verifier(r.filtreApresRafraichir === 'a_a' && r.selectValApresRafraichir === 'a_a', 'filtreAnimalId persiste après rafraichirRappels()', r);
    verifier(!r.listeMokaHasOthers && r.medsMokaCount === 0, 'filtre sur animal sans rappel masque les autres animaux', r);
    verifier(r.filtreApresArchive === '' && !r.optionsApresArchive.includes('a_a'), 'archivage de l’animal filtré réinitialise filtreAnimalId', r);
    verifier(r.filtreApresSuppression === '' && r.videTxt.includes('Aucun animal pour l’instant'), 'suppression du dernier animal actif réinitialise filtre et affiche .encart.vide', r);
  });

  await section('M3-2 : Actions rapides vaccins / antiparasitaires, gardes et non-régression', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const auj = Dates.aujourdhui();

      await BD.enregistrer('animaux', { id: 'a_qa1', nom: 'Pixel', espece: 'Chien', archive: false });
      await BD.enregistrer('vaccins', { id: 'v_qa1', animalId: 'a_qa1', nom: 'CHPPiL', veterinaire: 'Dr Martin', date: Dates.ajouterJours(auj, -365), rappel: auj });
      await BD.enregistrer('antiparasitaires', { id: 'ap_qa1', animalId: 'a_qa1', type: 'autre', produit: 'Collier', dose: '1 collier', date: Dates.ajouterJours(auj, -180), prochaine: Dates.ajouterJours(auj, -1) });
      await BD.enregistrer('taches', { id: 't_qa1', animalId: 'a_qa1', titre: 'Brosser', echeance: Dates.ajouterJours(auj, 2), fait: false });
      await BD.enregistrer('rdv', { id: 'rdv_qa1', animalId: 'a_qa1', date: Dates.ajouterJours(auj, 4), motif: 'Contrôle' });

      EcranAgenda.filtreAnimalId = '';
      await Nav.remplacer({ vue: 'rappels' });
      await new Promise((ok) => setTimeout(ok, 80));

      const cartes = [...document.querySelectorAll('#rappels-liste .carte-rappel')];
      const boutonsParTitre = {};
      for (const c of cartes) {
        const titre = c.querySelector('.carte-titre')?.textContent || '';
        boutonsParTitre[titre] = [...c.querySelectorAll('button')].map((b) => b.textContent.trim());
      }

      // 1. Double-clic sur « Noter le rappel fait » -> un seul formulaire ouvert, prérempli
      const btnVaccin = [...document.querySelectorAll('#rappels-liste button')].find((b) => b.textContent.trim() === 'Noter le rappel fait');
      btnVaccin.click();
      btnVaccin.click();
      await new Promise((ok) => setTimeout(ok, 120));

      const vueFormVaccinVisible = !document.querySelector('.vue[data-vue="formulaire"]').hidden;
      const valVacNom = document.querySelector('#champ-nom')?.value || '';
      const valVacVeto = document.querySelector('#champ-veterinaire')?.value || '';
      const valVacDate = document.querySelector('#champ-date')?.value || '';
      document.querySelector('#champ-rappel').value = Dates.ajouterJours(auj, 365);
      await Formulaire.soumettre(document.querySelector('#formulaire-zone form'));
      await new Promise((ok) => setTimeout(ok, 150));

      const retourApresVaccin = !document.querySelector('.vue[data-vue="rappels"]').hidden;
      const vaccinsApres = await BD.parAnimal('vaccins', 'a_qa1');
      const pastilleApresVaccin = document.querySelector('#nav-pastille')?.textContent || '';

      // 2. « Noter la prise suivante » sur antiparasitaire (type: 'autre')
      const btnAP = [...document.querySelectorAll('#rappels-liste button')].find((b) => b.textContent.trim() === 'Noter la prise suivante');
      btnAP.click();
      await new Promise((ok) => setTimeout(ok, 120));

      const apTypeAutreChecked = !!document.querySelector('[data-champ="type"] input[type="radio"][value="autre"]')?.checked;
      const apProduit = document.querySelector('#champ-produit')?.value || '';
      const apDose = document.querySelector('#champ-dose')?.value || '';
      const apDate = document.querySelector('#champ-date')?.value || '';
      document.querySelector('#champ-prochaine').value = Dates.ajouterJours(auj, 90);
      await Formulaire.soumettre(document.querySelector('#formulaire-zone form'));
      await new Promise((ok) => setTimeout(ok, 150));

      const retourApresAP = !document.querySelector('.vue[data-vue="rappels"]').hidden;
      const apsApres = await BD.parAnimal('antiparasitaires', 'a_qa1');
      const pastilleCachee = !!document.querySelector('#nav-pastille')?.hidden;

      // 3. Gardes fiche supprimée / archivée / erreur BD.lire
      await BD.enregistrer('vaccins', { id: 'v_del', animalId: 'a_qa1', nom: 'VDel', date: Dates.ajouterJours(auj, -100), rappel: auj });
      await BD.enregistrer('antiparasitaires', { id: 'ap_del', animalId: 'a_qa1', type: 'vermifuge', produit: 'APDel', date: Dates.ajouterJours(auj, -100), prochaine: auj });
      await EcranAgenda.afficherRappels();

      const txDelVac = await BD._transaction('vaccins', 'readwrite');
      txDelVac.objectStore('vaccins').delete('v_del');
      await BD.finTransaction(txDelVac);

      const btnVacDel = [...document.querySelectorAll('#rappels-liste button')].find((b) => b.textContent.trim() === 'Noter le rappel fait');
      btnVacDel.click();
      await new Promise((ok) => setTimeout(ok, 100));
      const msgVacDel = document.querySelector('#annonce')?.textContent || '';
      const clsVacDel = document.querySelector('#annonce')?.className || '';
      const formOuvertSurVacDel = !document.querySelector('.vue[data-vue="formulaire"]').hidden;

      const txDelAP = await BD._transaction('antiparasitaires', 'readwrite');
      txDelAP.objectStore('antiparasitaires').delete('ap_del');
      await BD.finTransaction(txDelAP);

      const btnAPDel = [...document.querySelectorAll('#rappels-liste button')].find((b) => b.textContent.trim() === 'Noter la prise suivante');
      btnAPDel.click();
      await new Promise((ok) => setTimeout(ok, 100));
      const msgAPDel = document.querySelector('#annonce')?.textContent || '';
      const clsAPDel = document.querySelector('#annonce')?.className || '';

      // Garde animal archivé
      await BD.enregistrer('vaccins', { id: 'v_arch', animalId: 'a_qa1', nom: 'VArch', date: Dates.ajouterJours(auj, -100), rappel: auj });
      await EcranAgenda.afficherRappels();
      const pixel = await BD.lire('animaux', 'a_qa1');
      await BD.enregistrer('animaux', { ...pixel, archive: true });
      const btnVacArch = [...document.querySelectorAll('#rappels-liste button')].find((b) => b.textContent.trim() === 'Noter le rappel fait');
      btnVacArch.click();
      await new Promise((ok) => setTimeout(ok, 100));
      const msgVacArch = document.querySelector('#annonce')?.textContent || '';
      const formOuvertSurArch = !document.querySelector('.vue[data-vue="formulaire"]').hidden;

      // Garde erreur BD.lire sur carteRappel vaccin / antiparasitaire
      const origLire = BD.lire;
      BD.lire = async () => { throw new Error('panne lecture'); };
      const carteVacErr = EcranAgenda.carteRappel({ id: 'vx', animalId: 'a_qa1', animalNom: 'Pixel', titre: 'Rappel', date: auj, ecart: 0, type: 'vaccin', section: 'vaccins' });
      carteVacErr.querySelector('button.principal').click();
      await new Promise((ok) => setTimeout(ok, 60));
      const errVacLire = document.querySelector('#annonce')?.textContent || '';
      const carteAPErr = EcranAgenda.carteRappel({ id: 'ax', animalId: 'a_qa1', animalNom: 'Pixel', titre: 'AP', date: auj, ecart: 0, type: 'antiparasitaire', section: 'antiparasitaires' });
      carteAPErr.querySelector('button.principal').click();
      await new Promise((ok) => setTimeout(ok, 60));
      const errAPLire = document.querySelector('#annonce')?.textContent || '';
      BD.lire = origLire;

      return {
        boutonsParTitre,
        vueFormVaccinVisible, valVacNom, valVacVeto, valVacDate, auj,
        retourApresVaccin, nbVaccinsApres: vaccinsApres.length, pastilleApresVaccin,
        apTypeAutreChecked, apProduit, apDose, apDate,
        retourApresAP, nbAPsApres: apsApres.length, pastilleCachee,
        msgVacDel, clsVacDel, formOuvertSurVacDel,
        msgAPDel, clsAPDel,
        msgVacArch, formOuvertSurArch,
        errVacLire, errAPLire
      };
    });

    verifier(
      JSON.stringify(r.boutonsParTitre['Rappel de vaccin : CHPPiL']) === JSON.stringify(['Noter le rappel fait', 'Voir la fiche', 'Ajouter à Google Agenda']) &&
      JSON.stringify(r.boutonsParTitre['Antiparasitaire : Collier']) === JSON.stringify(['Noter la prise suivante', 'Voir la fiche']) &&
      JSON.stringify(r.boutonsParTitre['Brosser']) === JSON.stringify(['Marquer comme fait', 'Voir la fiche', 'Ajouter à Google Agenda']),
      'carteRappel conserve les boutons existants et ajoute les actions rapides selon type et ecart',
      r.boutonsParTitre
    );
    verifier(
      r.vueFormVaccinVisible && r.valVacNom === 'CHPPiL' && r.valVacVeto === 'Dr Martin' && r.valVacDate === r.auj &&
      r.retourApresVaccin && r.nbVaccinsApres === 2 && r.pastilleApresVaccin === '1',
      'Noter le rappel fait préremplit, résiste au double-clic, enregistre 1 seul vaccin, revient à Rappels et met à jour la pastille',
      r
    );
    verifier(
      r.apTypeAutreChecked && r.apProduit === 'Collier' && r.apDose === '1 collier' && r.apDate === r.auj &&
      r.retourApresAP && r.nbAPsApres === 2 && r.pastilleCachee,
      'Noter la prise suivante préremplit (y compris type autre), enregistre, revient à Rappels et masque la pastille',
      r
    );
    verifier(
      r.msgVacDel.includes('existe plus') && r.clsVacDel.includes('erreur') && !r.formOuvertSurVacDel &&
      r.msgAPDel.includes('existe plus') && r.clsAPDel.includes('erreur') &&
      r.msgVacArch.includes('plus dans la liste') && !r.formOuvertSurArch,
      'gardes sur fiche supprimée ou animal archivé annoncent une erreur et rafraîchissent sans ouvrir de formulaire',
      r
    );
    verifier(r.errVacLire.includes('panne lecture') && r.errAPLire.includes('panne lecture'), 'erreurs BD.lire sur actions rapides annoncées proprement', r);
  });

  await section('M3-3 : Bilan annuel global des dépenses (calcul, rendu, thèmes, XSS, non-régression)', async () => {
    const r = await p.evaluate(async () => {
      // 1. Tests unitaires purs de EcranAgenda.calculerBilanDepenses
      const animauxUnit = [
        { id: 'a1', nom: 'Luna', archive: false },
        { id: 'a_arch', nom: 'Vieux', archive: true },
        { id: '__proto__', nom: 'Proto', archive: false },
        { id: 'constructor', nom: 'Ctor', archive: false },
        { id: 'toString', nom: 'ToStr', archive: false }
      ];
      const rdvsUnit = [
        { id: 'r1', animalId: 'a1', date: '2025-05-10', cout: 40 },
        { id: 'r2', animalId: 'a1', date: '2026-01-12', cout: 19.99 },
        { id: 'r3', animalId: 'a1', date: '2026-02-01', cout: 0.01 },
        { id: 'r4', animalId: 'a_arch', date: '2024-03-01', cout: 80 },
        { id: 'r5', animalId: 'absent_id', date: '2026-03-01', cout: 25 },
        { id: 'r6', animalId: '__proto__', date: 'not-a-date', cout: 15 },
        { id: 'r7', animalId: 'constructor', date: '2026-04-01', cout: 10 },
        { id: 'r8', animalId: 'toString', date: '2026-04-02', cout: 5 },
        { id: 'r_neg', animalId: 'a1', date: '2026-05-01', cout: -10 },
        { id: 'r_nan', animalId: 'a1', date: '2026-05-02', cout: NaN },
        { id: 'r_inf', animalId: 'a1', date: '2026-05-03', cout: Infinity },
        { id: 'r_str', animalId: 'a1', date: '2026-05-04', cout: '40' },
        { id: 'r_null', animalId: 'a1', date: '2026-05-05', cout: null },
        { id: 'r_vide', animalId: 'a1', date: '2026-05-06' }
      ];
      const bilan = EcranAgenda.calculerBilanDepenses(rdvsUnit, animauxUnit);
      const bilanVide = EcranAgenda.calculerBilanDepenses([{ id: 'x', date: '2026-01-01' }], animauxUnit);
      const bilanMalforme = EcranAgenda.calculerBilanDepenses(null, undefined);

      // 2. Cas 0 dépense -> aucun .bilan-depenses ni 0,00 €
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      await BD.enregistrer('animaux', { id: 'a_zero', nom: 'Milo', archive: false });
      await BD.enregistrer('rdv', { id: 'r_zero', animalId: 'a_zero', date: '2026-06-01', motif: 'Gratuit' });
      EcranAgenda.filtreAnimalId = '';
      await Nav.remplacer({ vue: 'rappels' });
      await new Promise((ok) => setTimeout(ok, 80));
      const nbBilanZero = document.querySelectorAll('#rappels-liste .bilan-depenses').length;
      const rappelsTxtZero = document.querySelector('#rappels-liste')?.textContent || '';

      // 3. Cas multi-années + archivé + supprimé + XSS + données corrompues en base
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      await BD.enregistrer('animaux', { id: 'a_p1', nom: 'Pixel', archive: false });
      await BD.enregistrer('animaux', { id: 'a_p2', nom: 'Ancien', archive: true });
      await BD.enregistrer('animaux', { id: 'a_xss', nom: '<img src=x onerror="window.__xss=1">Rex', archive: false });
      await BD.enregistrer('rdv', { id: 'r_y1', animalId: 'a_p1', date: '2026-01-10', motif: 'V1', cout: 19.99 });
      await BD.enregistrer('rdv', { id: 'r_y2', animalId: 'a_p1', date: '2026-02-10', motif: 'V2', cout: 0.01 });
      await BD.enregistrer('rdv', { id: 'r_y3', animalId: 'a_p2', date: '2025-11-05', motif: 'V3', cout: 50 });
      await BD.enregistrer('rdv', { id: 'r_y4', animalId: 'a_xss', date: '2026-03-01', motif: 'V4', cout: 30 });
      await BD.enregistrer('rdv', { id: 'r_y5', animalId: 'id_disparu', date: '2026-03-02', motif: 'V5', cout: 12.5 });
      const txBad = await BD._transaction('rdv', 'readwrite');
      txBad.objectStore('rdv').put({ id: 'r_bad1', animalId: 'a_p1', date: 'bad-date', cout: 10 });
      txBad.objectStore('rdv').put({ id: 'r_bad2', animalId: 'a_p1', date: '2026-04-01', cout: -10 });
      txBad.objectStore('rdv').put({ id: 'r_bad3', animalId: 'a_p1', date: '2026-04-01', cout: NaN });
      await BD.finTransaction(txBad);

      await EcranAgenda.afficherRappels();
      const bilanEl = document.querySelector('#rappels-liste .bilan-depenses');
      const bilanTxt = bilanEl ? bilanEl.textContent : '';
      const nbImgsXss = bilanEl ? bilanEl.querySelectorAll('img').length : -1;

      // Vérifier thèmes omni / sombre / clair avec taille tresgrand (aucun débordement horizontal)
      const debords = {};
      Taille.appliquer('tresgrand');
      for (const theme of ['omni', 'sombre', 'clair']) {
        Theme.appliquer(theme);
        debords[theme] = document.documentElement.scrollWidth - innerWidth;
      }
      Theme.appliquer('omni');
      Taille.appliquer('normal');

      // Vérifier affichage même quand tous les animaux sont archivés s'il y a des dépenses
      const p1 = await BD.lire('animaux', 'a_p1');
      const pxss = await BD.lire('animaux', 'a_xss');
      await BD.enregistrer('animaux', { ...p1, archive: true });
      await BD.enregistrer('animaux', { ...pxss, archive: true });
      await EcranAgenda.afficherRappels();
      const videAvecArch = document.querySelector('#rappels-liste .encart.vide')?.textContent || '';
      const bilanAvecArch = document.querySelector('#rappels-liste .bilan-depenses')?.textContent || '';

      // Non-régression : blocFrais / .encart.frais sur l'onglet RDV d'un animal
      const zoneRdv = document.createElement('div');
      await EcranAgenda.rdv(zoneRdv, p1);
      const hasEncartFrais = !!zoneRdv.querySelector('.encart.frais');

      return {
        bilanAnnees: bilan.annees.map((a) => ({ annee: a.annee, total: a.total, noms: a.parAnimal.map((x) => x.nom) })),
        bilanTotalGlobal: bilan.totalGlobal,
        bilanNbAvecCout: bilan.nbAvecCout,
        bilanNbTotalRdv: bilan.nbTotalRdv,
        bilan2026Total: bilan.annees[0].total,
        bilanVideAnnees: bilanVide.annees.length,
        bilanVideTotal: bilanVide.totalGlobal,
        bilanMalformeTotal: bilanMalforme.totalGlobal,
        nbBilanZero,
        hasZeroEuro: /0,00[\s\u00a0\u202f]*€/.test(rappelsTxtZero),
        bilanTxt,
        idx2026: bilanTxt.indexOf('2026'),
        idx2025: bilanTxt.indexOf('2025'),
        idxInconnue: bilanTxt.indexOf('Date inconnue'),
        nbImgsXss,
        xssGlobal: window.__xss,
        debords,
        videAvecArch,
        bilanAvecArchHasTotal: bilanAvecArch.includes('Bilan annuel des dépenses'),
        hasEncartFrais
      };
    });

    verifier(
      JSON.stringify(r.bilanAnnees.map((a) => a.annee)) === JSON.stringify(['2026', '2025', '2024', 'Date inconnue']) &&
      r.bilan2026Total === 60 && r.bilanTotalGlobal === 195 && r.bilanNbAvecCout === 8 && r.bilanNbTotalRdv === 14,
      'calculerBilanDepenses trie années décroissantes avec Date inconnue en dernier, arrondit 19.99+0.01 et exclut les coûts invalides',
      r
    );
    verifier(
      r.bilanAnnees[0].noms.includes('Animal supprimé') && r.bilanAnnees[2].noms.includes('Vieux') &&
      r.bilanAnnees[3].noms.includes('Proto') && r.bilanVideAnnees === 0 && r.bilanVideTotal === 0 && r.bilanMalformeTotal === 0,
      'calculerBilanDepenses gère animaux archivés, supprimés, IDs prototype et entrées vides/malformées',
      r.bilanAnnees
    );
    verifier(r.nbBilanZero === 0 && !r.hasZeroEuro, 'aucun bloc .bilan-depenses ni 0,00 € affiché quand aucune dépense n’est saisie', r);
    verifier(
      r.idx2026 !== -1 && r.idx2025 !== -1 && r.idxInconnue !== -1 &&
      r.idx2026 < r.idx2025 && r.idx2025 < r.idxInconnue &&
      /20,00[\s\u00a0\u202f]*€/.test(r.bilanTxt) && /62,50[\s\u00a0\u202f]*€/.test(r.bilanTxt) &&
      /122,50[\s\u00a0\u202f]*€/.test(r.bilanTxt) &&
      r.bilanTxt.includes('Ancien (archivé)') && r.bilanTxt.includes('Animal supprimé'),
      'rendu .bilan-depenses affiche années décroissantes, montants UI.euros, archivé et Animal supprimé',
      r.bilanTxt
    );
    verifier(r.nbImgsXss === 0 && r.xssGlobal === undefined && r.bilanTxt.includes('<img src=x onerror="window.__xss=1">Rex'), 'payload XSS dans le nom d’animal rendu en texte pur sans exécution', r);
    verifier(r.debords.omni <= 0 && r.debords.sombre <= 0 && r.debords.clair <= 0, 'zéro débordement horizontal sur 3 thèmes en taille tresgrand', r.debords);
    verifier(r.videAvecArch.includes('Aucun animal') && r.bilanAvecArchHasTotal, 'bilan des dépenses conservé même quand tous les animaux sont archivés', r);
    verifier(r.hasEncartFrais, 'non-régression : onglet RDV d’un animal conserve .encart.frais', r.hasEncartFrais);
  });

  await ctx.close();
});
