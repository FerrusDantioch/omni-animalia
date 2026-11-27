/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests unitaires et d’intégration M4 (v1.3.0) :
   - M4A : fourchette de poids idéal, recherche multi-sections, Chronologie (R4)
   - M4B : pastilles onglets (R3), fiche animal perdu (R1),
           passeport/assurance et carnet imprimable avec annexe (R5)

   Lancer :  node tests/unit-v130-m4.js
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

lancer('Omni-Animalia (v1.3.0 — M4)', async () => {
  const { ctx, p } = await ouvrir();

  await section('EcranSante : fourchette de poids idéal, SVG, validations, unités et contrats M3 (R4)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Helper pur fourchettePoids()
      const fNull = EcranSante.fourchettePoids(null);
      const fVide = EcranSante.fourchettePoids({});
      const fPartielMin = EcranSante.fourchettePoids({ poidsIdealMin: 4000 });
      const fPartielMax = EcranSante.fourchettePoids({ poidsIdealMax: 5000 });
      const fInvalide = EcranSante.fourchettePoids({ poidsIdealMin: 5000, poidsIdealMax: 4000 });
      const fZero = EcranSante.fourchettePoids({ poidsIdealMin: 0, poidsIdealMax: 4000 });
      const fEgal = EcranSante.fourchettePoids({ poidsIdealMin: 4500, poidsIdealMax: 4500 });
      const fOk = EcranSante.fourchettePoids({ poidsIdealMin: 4200, poidsIdealMax: 5800 });

      // 2. État vide (0 pesée) : l'encart fourchette-poids est visible et button.principal reste Ajouter une pesée
      await BD.enregistrer('animaux', { id: 'a_p1', nom: 'Pixel', espece: 'Chat', unitePoids: 'kg', archive: false });
      await Nav.aller({ vue: 'animal', id: 'a_p1', section: 'poids' });
      await new Promise((ok) => setTimeout(ok, 120));

      const encartVide = !!document.querySelector('#animal-contenu .encart.fourchette-poids');
      const btnsPrincipauxVide = [...document.querySelectorAll('#animal-contenu button.principal')].map((b) => b.textContent.trim());
      const messageVide = !!document.querySelector('#animal-contenu .encart.vide');

      // 3. Ajout de pesées sans fourchette : aucune bande, première .carte-fiche = pesée
      await BD.enregistrer('pesees', { id: 'p_1', animalId: 'a_p1', date: '2026-04-01', grammes: 4500 });
      await BD.enregistrer('pesees', { id: 'p_2', animalId: 'a_p1', date: '2026-05-01', grammes: 5000 });
      await EcranAnimal.rafraichir();
      await new Promise((ok) => setTimeout(ok, 100));

      const bandeSansFourchette = document.querySelectorAll('#animal-contenu svg.graphique rect.bande-ideale').length;
      const premiereCarteTexte = document.querySelector('#animal-contenu .carte-fiche')?.textContent || '';

      // 4. Définition via formulairePoidsIdeal en kg (4,2 à 5,8)
      const btnDef = [...document.querySelectorAll('#animal-contenu .fourchette-poids button')]
        .find((b) => /Définir le poids idéal/i.test(b.textContent));
      btnDef.click();
      await new Promise((ok) => setTimeout(ok, 120));

      const form1 = document.querySelector('#formulaire-zone form');
      form1.querySelector('#champ-poidsIdealMin').value = '4,2';
      form1.querySelector('#champ-poidsIdealMax').value = '5,8';
      await Formulaire.soumettre(form1);
      await new Promise((ok) => setTimeout(ok, 150));

      const animalApresKg = await BD.lire('animaux', 'a_p1');
      const txtEncartKg = document.querySelector('#animal-contenu .encart.fourchette-poids')?.textContent || '';
      const figCaptionKg = document.querySelector('#animal-contenu figure.figure-graphique figcaption')?.textContent || '';
      const svgEl = document.querySelector('#animal-contenu svg.graphique');
      const svgAriaKg = svgEl?.getAttribute('aria-label') || '';
      const rectsKg = [...document.querySelectorAll('#animal-contenu svg.graphique rect.bande-ideale')];
      const rectKgAttr = rectsKg[0] ? {
        x: parseFloat(rectsKg[0].getAttribute('x')),
        y: parseFloat(rectsKg[0].getAttribute('y')),
        width: parseFloat(rectsKg[0].getAttribute('width')),
        height: parseFloat(rectsKg[0].getAttribute('height'))
      } : null;

      // Réouverture de l'onglet poids : persistance vérifiée
      await EcranAnimal.afficher('a_p1', 'poids');
      await new Promise((ok) => setTimeout(ok, 120));
      const persisteBande = document.querySelectorAll('#animal-contenu svg.graphique rect.bande-ideale').length;

      // 5. Passage en grammes (g) : conversion affichage + pré-remplissage formulaire
      await BD.enregistrer('animaux', { ...animalApresKg, unitePoids: 'g' });
      await EcranAnimal.afficher('a_p1', 'poids');
      await new Promise((ok) => setTimeout(ok, 120));
      const txtEncartG = document.querySelector('#animal-contenu .encart.fourchette-poids')?.textContent || '';

      const btnModifG = [...document.querySelectorAll('#animal-contenu .fourchette-poids button')]
        .find((b) => /Modifier le poids idéal/i.test(b.textContent));
      btnModifG.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const prefillMinG = document.querySelector('#champ-poidsIdealMin').value;
      const prefillMaxG = document.querySelector('#champ-poidsIdealMax').value;

      // 6. Rejets de validation (0, -2, abc, min > max, partiel, sous-milligramme en kg)
      const testerRejet = async (minVal, maxVal) => {
        const f = document.querySelector('#formulaire-zone form');
        f.querySelector('#champ-poidsIdealMin').value = minVal;
        f.querySelector('#champ-poidsIdealMax').value = maxVal;
        await Formulaire.soumettre(f);
        return {
          minErr: f.querySelector('[data-champ="poidsIdealMin"] .message-erreur').textContent,
          maxErr: f.querySelector('[data-champ="poidsIdealMax"] .message-erreur').textContent,
          toujoursOuvert: !!document.querySelector('#formulaire-zone form')
        };
      };
      const rejZero = await testerRejet('0', '5000');
      const rejNeg = await testerRejet('-2', '5000');
      const rejAlpha = await testerRejet('abc', '5000');
      const rejOrdre = await testerRejet('6000', '4000');
      const rejPartielMin = await testerRejet('4000', '');
      const rejPartielMax = await testerRejet('', '5000');

      const animalInchange = await BD.lire('animaux', 'a_p1');
      Formulaire.reinitialiser();
      await Nav.remplacer({ vue: 'animal', id: 'a_p1', section: 'poids' });
      await new Promise((ok) => setTimeout(ok, 100));

      // Test sous-gramme en kg (0,00001 kg -> arrondi <= 0 g)
      await BD.enregistrer('animaux', { ...animalInchange, unitePoids: 'kg' });
      await EcranAnimal.afficher('a_p1', 'poids');
      await new Promise((ok) => setTimeout(ok, 100));
      document.querySelector('#animal-contenu .fourchette-poids button').click();
      await new Promise((ok) => setTimeout(ok, 100));
      const rejMicroKg = await testerRejet('0,00001', '5');

      // 7. Bornes égales (4,5 et 4,5 kg)
      const fEgalForm = document.querySelector('#formulaire-zone form');
      fEgalForm.querySelector('#champ-poidsIdealMin').value = '4,5';
      fEgalForm.querySelector('#champ-poidsIdealMax').value = '4,5';
      await Formulaire.soumettre(fEgalForm);
      await new Promise((ok) => setTimeout(ok, 150));

      const animalEgal = await BD.lire('animaux', 'a_p1');
      const rectEgal = document.querySelector('#animal-contenu svg.graphique rect.bande-ideale');
      const rectEgalH = rectEgal ? parseFloat(rectEgal.getAttribute('height')) : 0;
      const txtEgal = document.querySelector('#animal-contenu .encart.fourchette-poids')?.textContent || '';

      // 8. Effacement par bouton « Effacer le poids idéal » (annuler puis confirmer)
      const origConf = UI.confirmer;
      UI.confirmer = async () => false;
      const btnEff = [...document.querySelectorAll('#animal-contenu .fourchette-poids button')]
        .find((b) => /Effacer le poids idéal/i.test(b.textContent));
      btnEff.click();
      await new Promise((ok) => setTimeout(ok, 100));
      const apresAnnulEff = await BD.lire('animaux', 'a_p1');

      UI.confirmer = async () => true;
      btnEff.click();
      await new Promise((ok) => setTimeout(ok, 150));
      UI.confirmer = origConf;
      const apresConfEff = await BD.lire('animaux', 'a_p1');
      const bandeApresEff = document.querySelectorAll('#animal-contenu svg.graphique rect.bande-ideale').length;
      const courbeApresEff = document.querySelectorAll('#animal-contenu svg.graphique circle.point').length;

      // 9. Effacement en vidant les deux champs du formulaire
      document.querySelector('#animal-contenu .fourchette-poids button').click();
      await new Promise((ok) => setTimeout(ok, 100));
      const fSet2 = document.querySelector('#formulaire-zone form');
      fSet2.querySelector('#champ-poidsIdealMin').value = '4';
      fSet2.querySelector('#champ-poidsIdealMax').value = '6';
      await Formulaire.soumettre(fSet2);
      await new Promise((ok) => setTimeout(ok, 120));

      document.querySelector('#animal-contenu .fourchette-poids button').click();
      await new Promise((ok) => setTimeout(ok, 100));
      const fVider = document.querySelector('#formulaire-zone form');
      fVider.querySelector('#champ-poidsIdealMin').value = '';
      fVider.querySelector('#champ-poidsIdealMax').value = '';
      await Formulaire.soumettre(fVider);
      await new Promise((ok) => setTimeout(ok, 120));
      const apresViderForm = await BD.lire('animaux', 'a_p1');
      const bandeApresVider = document.querySelectorAll('#animal-contenu svg.graphique rect.bande-ideale').length;

      // 10. Animal en grammes + axe Y élargi par fourchette (pesée 1200 g, fourchette 850..1050 g)
      await BD.enregistrer('animaux', {
        id: 'a_g1', nom: 'Noisette', espece: 'Lapin', unitePoids: 'g', archive: false,
        poidsIdealMin: 850, poidsIdealMax: 1050
      });
      await BD.enregistrer('pesees', { id: 'pg_1', animalId: 'a_g1', date: '2026-05-01', grammes: 1200 });
      await EcranAnimal.afficher('a_g1', 'poids');
      await new Promise((ok) => setTimeout(ok, 120));
      const rectG = document.querySelector('#animal-contenu svg.graphique rect.bande-ideale');
      const rectGAttr = rectG ? {
        y: parseFloat(rectG.getAttribute('y')),
        h: parseFloat(rectG.getAttribute('height'))
      } : null;

      // 10b. Petits poids en kg (< 0,005 kg) : pas de collapse vers "0 kg"
      await BD.enregistrer('animaux', {
        id: 'a_micro', nom: 'Souris', espece: 'Rongeur', unitePoids: 'kg', archive: false,
        poidsIdealMin: 1, poidsIdealMax: 2
      });
      await BD.enregistrer('pesees', { id: 'pm_1', animalId: 'a_micro', date: '2026-05-01', grammes: 2 });
      await Nav.aller({ vue: 'animal', id: 'a_micro', section: 'poids' });
      await new Promise((ok) => setTimeout(ok, 120));
      const encartMicro12g = document.querySelector('#animal-contenu .encart.fourchette-poids')?.textContent || '';
      const figMicro12g = document.querySelector('#animal-contenu figure.figure-graphique figcaption')?.textContent || '';
      const ariaMicro12g = document.querySelector('#animal-contenu svg.graphique')?.getAttribute('aria-label') || '';

      document.querySelector('#animal-contenu .fourchette-poids button').click();
      await new Promise((ok) => setTimeout(ok, 100));
      const fMicro = document.querySelector('#formulaire-zone form');
      fMicro.querySelector('#champ-poidsIdealMin').value = '0,00005';
      fMicro.querySelector('#champ-poidsIdealMax').value = '0,00005';
      await Formulaire.soumettre(fMicro);
      await new Promise((ok) => setTimeout(ok, 120));
      const encartMicro01g = document.querySelector('#animal-contenu .encart.fourchette-poids')?.textContent || '';
      const figMicro01g = document.querySelector('#animal-contenu figure.figure-graphique figcaption')?.textContent || '';
      const ariaMicro01g = document.querySelector('#animal-contenu svg.graphique')?.getAttribute('aria-label') || '';

      // 11. Enregistrement partiel hérité (min seul) + animal archivé (lecture seule)
      await BD.enregistrer('animaux', { id: 'a_part', nom: 'Vieux', espece: 'Chien', unitePoids: 'kg', poidsIdealMin: 4000, archive: false });
      await BD.enregistrer('pesees', { id: 'pp_1', animalId: 'a_part', date: '2026-05-01', grammes: 4500 });
      await EcranAnimal.afficher('a_part', 'poids');
      await new Promise((ok) => setTimeout(ok, 100));
      const encartPartielTxt = document.querySelector('#animal-contenu .encart.fourchette-poids')?.textContent || '';
      const bandePartiel = document.querySelectorAll('#animal-contenu svg.graphique rect.bande-ideale').length;

      await BD.enregistrer('animaux', {
        id: 'a_arch', nom: 'Arch', espece: 'Chat', unitePoids: 'kg', archive: true,
        poidsIdealMin: 3500, poidsIdealMax: 4500
      });
      await BD.enregistrer('pesees', { id: 'pa_1', animalId: 'a_arch', date: '2026-05-01', grammes: 4000 });
      await EcranAnimal.afficher('a_arch', 'poids');
      await new Promise((ok) => setTimeout(ok, 100));
      const btnsArchFourchette = document.querySelectorAll('#animal-contenu .encart.fourchette-poids button').length;
      const bandeArch = document.querySelectorAll('#animal-contenu svg.graphique rect.bande-ideale').length;

      // 12. Préservation des contrats M3 : formulaireVaccin & formulaireAP avec 3e argument depart
      await EcranSante.formulaireVaccin({ id: 'a_p1', nom: 'Pixel', espece: 'Chat' }, null, {
        nom: 'Typhus', veterinaire: 'Dr Test', date: '2026-05-10'
      });
      await new Promise((ok) => setTimeout(ok, 80));
      const vacPrefill = document.querySelector('#champ-nom')?.value || '';
      Formulaire.reinitialiser();
      await Nav.remplacer({ vue: 'accueil' });

      EcranSante.formulaireAP({ id: 'a_p1', nom: 'Pixel' }, null, {
        type: 'vermifuge', produit: 'Milbemax', dose: '1 cp', date: '2026-05-10'
      });
      await new Promise((ok) => setTimeout(ok, 80));
      const apPrefill = document.querySelector('#champ-produit')?.value || '';
      Formulaire.reinitialiser();
      await Nav.remplacer({ vue: 'accueil' });

      return {
        fNull, fVide, fPartielMin, fPartielMax, fInvalide, fZero, fEgal, fOk,
        encartVide, btnsPrincipauxVide, messageVide,
        bandeSansFourchette, premiereCarteTexte,
        animalApresKg, txtEncartKg, figCaptionKg, svgAriaKg, nbRectsKg: rectsKg.length, rectKgAttr, persisteBande,
        txtEncartG, prefillMinG, prefillMaxG,
        rejZero, rejNeg, rejAlpha, rejOrdre, rejPartielMin, rejPartielMax, rejMicroKg, animalInchange,
        animalEgal, rectEgalH, txtEgal,
        apresAnnulEff, apresConfEff, bandeApresEff, courbeApresEff,
        apresViderForm, bandeApresVider,
        rectGAttr, encartMicro12g, figMicro12g, ariaMicro12g, encartMicro01g, figMicro01g, ariaMicro01g, encartPartielTxt, bandePartiel, btnsArchFourchette, bandeArch,
        vacPrefill, apPrefill
      };
    });

    verifier(
      r.fNull === null && r.fVide === null && r.fPartielMin === null && r.fPartielMax === null &&
      r.fInvalide === null && r.fZero === null &&
      r.fEgal && r.fEgal.minGrammes === 4500 && r.fEgal.maxGrammes === 4500 &&
      r.fOk && r.fOk.minGrammes === 4200 && r.fOk.maxGrammes === 5800,
      'EcranSante.fourchettePoids valide et rejette les cas limites',
      r
    );
    verifier(
      r.encartVide && r.messageVide &&
      r.btnsPrincipauxVide.length === 1 && r.btnsPrincipauxVide[0] === 'Ajouter une pesée',
      'État vide : .encart.fourchette-poids affiché et button.principal unique = Ajouter une pesée',
      r
    );
    verifier(
      r.bandeSansFourchette === 0 && r.premiereCarteTexte.includes('+0,5 kg'),
      'Sans fourchette : aucune .bande-ideale et la première .carte-fiche reste la pesée',
      r.premiereCarteTexte
    );
    verifier(
      r.animalApresKg.poidsIdealMin === 4200 && r.animalApresKg.poidsIdealMax === 5800 &&
      r.txtEncartKg.includes('4,2') && r.txtEncartKg.includes('5,8') && r.txtEncartKg.includes('kg') &&
      r.nbRectsKg === 1 && r.persisteBande === 1 &&
      r.rectKgAttr && Number.isFinite(r.rectKgAttr.x) && r.rectKgAttr.y >= 16 &&
      r.rectKgAttr.height > 0 && (r.rectKgAttr.y + r.rectKgAttr.height) <= 186.1 &&
      r.figCaptionKg.includes('4,2') && r.svgAriaKg.includes('4,2'),
      'Fourchette en kg enregistrée en grammes, affichée, persistée et dessinée dans la zone SVG',
      r.rectKgAttr
    );
    verifier(
      r.txtEncartG.includes('4 200') || r.txtEncartG.includes('4\u202f200') || r.txtEncartG.includes('4200'),
      'Bascule d’unité kg -> g convertit l’affichage de la fourchette',
      r.txtEncartG
    );
    verifier(
      r.prefillMinG === '4200' && r.prefillMaxG === '5800',
      'formulairePoidsIdeal pré-remplit les valeurs converties en g',
      { prefillMinG: r.prefillMinG, prefillMaxG: r.prefillMaxG }
    );
    verifier(
      r.rejZero.minErr.length > 0 && r.rejZero.toujoursOuvert &&
      r.rejNeg.minErr.length > 0 &&
      r.rejAlpha.minErr.length > 0 &&
      r.rejOrdre.maxErr.length > 0 &&
      r.rejPartielMin.maxErr.length > 0 &&
      r.rejPartielMax.minErr.length > 0 &&
      r.rejMicroKg.minErr.length > 0 &&
      r.animalInchange.poidsIdealMin === 4200 && r.animalInchange.poidsIdealMax === 5800,
      'Rejets de validation (0, négatif, texte, min>max, partiel, sous-gramme) sans écraser IDB',
      r.rejMicroKg
    );
    verifier(
      r.animalEgal.poidsIdealMin === 4500 && r.animalEgal.poidsIdealMax === 4500 &&
      r.rectEgalH >= 2 && Number.isFinite(r.rectEgalH) && r.txtEgal.includes('4,5'),
      'Bornes égales (min === max) acceptées avec bande >= 2 px sans NaN',
      { rectEgalH: r.rectEgalH, txtEgal: r.txtEgal }
    );
    verifier(
      r.apresAnnulEff.poidsIdealMin === 4500 && r.apresAnnulEff.poidsIdealMax === 4500 &&
      r.apresConfEff.poidsIdealMin === undefined && r.apresConfEff.poidsIdealMax === undefined &&
      r.bandeApresEff === 0 && r.courbeApresEff === 2 &&
      r.apresViderForm.poidsIdealMin === undefined && r.apresViderForm.poidsIdealMax === undefined &&
      r.bandeApresVider === 0,
      'Effacement via confirmation et via champs vides supprime les champs IDB et retire la bande',
      r
    );
    verifier(
      r.rectGAttr && Number.isFinite(r.rectGAttr.y) && r.rectGAttr.y >= 16 &&
      r.rectGAttr.h > 0 && (r.rectGAttr.y + r.rectGAttr.h) <= 186.1,
      'Fourchette en g élargit l’axe Y proprement sans déborder du viewBox',
      r.rectGAttr
    );
    verifier(
      r.encartMicro12g.includes('0,001') && r.encartMicro12g.includes('0,002') && !r.encartMicro12g.includes('De 0 à 0 kg') &&
      r.figMicro12g.includes('0,001') && r.figMicro12g.includes('0,002') &&
      r.ariaMicro12g.includes('0,002') && r.ariaMicro12g.includes('0,001') && !r.ariaMicro12g.includes(' 0 kg') &&
      r.encartMicro01g.includes('0,0001') && !r.encartMicro01g.includes('visé : 0 kg') &&
      r.figMicro01g.includes('0,0001') && r.ariaMicro01g.includes('0,0001') && !r.ariaMicro01g.includes('Poids idéal : 0 kg') && !r.txtEncartKg.includes('4,2000'),
      'Petits poids en kg (< 0,005 kg) affichés sans effondrement à 0 kg et sans zéros superflus sur 4,2 kg',
      { encartMicro12g: r.encartMicro12g, figMicro12g: r.figMicro12g, ariaMicro12g: r.ariaMicro12g, encartMicro01g: r.encartMicro01g, figMicro01g: r.figMicro01g, ariaMicro01g: r.ariaMicro01g }
    );
    verifier(
      r.bandePartiel === 0 && r.encartPartielTxt.includes('4') &&
      r.btnsArchFourchette === 0 && r.bandeArch === 1,
      'Donnée partielle gérée sans bande ; animal archivé affiche la bande en lecture seule',
      { bandePartiel: r.bandePartiel, btnsArchFourchette: r.btnsArchFourchette, bandeArch: r.bandeArch }
    );
    verifier(
      r.vacPrefill === 'Typhus' && r.apPrefill === 'Milbemax',
      'Contrats M3 (formulaireVaccin et formulaireAP avec depart) préservés',
      { vacPrefill: r.vacPrefill, apPrefill: r.apPrefill }
    );
  });

  await section('EcranAnimal : recherche multi-sections par mot-clé, XSS, concurrence et changement d’animal (R4)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Tests purs de normaliserRecherche et rechercherDansDonnees
      const norm = EcranAnimal.normaliserRecherche('  FiÈvRe ModÉrée  ');
      const videRes = EcranAnimal.rechercherDansDonnees('   ', { notes: [{ id: 'n1', texte: 'test' }] });
      const texteLong = 'Début de note très long '.repeat(12) + 'échocardiographie urgente ' + 'suite observation '.repeat(12);
      const resPur = EcranAnimal.rechercherDansDonnees('fièvre', {
        notes: [
          { id: 'n1', date: '2026-05-01', categorie: 'symptome', texte: 'Fièvre modérée le soir' },
          { id: 'n_proto', date: '2026-05-02', categorie: 'toString', texte: 'FIEVRE sans accent' }
        ],
        vaccins: [{ id: 'v1', date: '2026-04-10', nom: 'Lyme', note: 'Pas de fièvre après injection' }],
        antiparasitaires: [{ id: 'ap1', date: '2026-04-05', type: 'constructor', produit: 'Bravecto', note: 'Tolérance' }],
        traitements: [{ id: 't1', debut: '2026-04-12', nom: 'Meloxicam', note: 'Contre la fievre' }],
        rdv: [{ id: 'r1', date: '2026-04-15', motif: 'Bilan', compteRendu: 'Aucune fièvre détectée à l’examen' }]
      });
      const resLong = EcranAnimal.rechercherDansDonnees('échocardiographie', {
        rdv: [{ id: 'rl', date: '2026-05-01', motif: 'Cardio', compteRendu: texteLong }]
      });
      const resNfdDebut = EcranAnimal.rechercherDansDonnees('pneumopathie', {
        rdv: [{ id: 'rnfd1', date: '2026-05-10', motif: 'Bilan', compteRendu: 'e\u0301'.repeat(220) + ' pneumopathie' }]
      });
      const resNfdMilieu = EcranAnimal.rechercherDansDonnees('pneumopathie', {
        rdv: [{ id: 'rnfd2', date: '2026-05-10', motif: 'Bilan', compteRendu: 'e\u0301'.repeat(220) + ' pneumopathie ' + 'e\u0301'.repeat(220) }]
      });

      // 2. Intégration DOM + 5 magasins + XSS + saut de section + effacement + rafraîchissement
      const a1 = { id: 'a_r1', nom: 'Moka', espece: 'Chien', archive: false };
      const a2 = { id: 'a_r2', nom: 'Plume', espece: 'Chat', archive: false };
      await BD.enregistrer('animaux', a1);
      await BD.enregistrer('animaux', a2);

      const xssPayload = '<img src=x onerror=window.__xssM4Search=1>';
      await BD.enregistrer('notes', { id: 'nr1', animalId: 'a_r1', date: '2026-05-01', categorie: 'symptome', texte: 'Boiterie patte droite ' + xssPayload });
      await BD.enregistrer('vaccins', { id: 'vr1', animalId: 'a_r1', date: '2026-04-20', nom: 'Lyme' });
      await BD.enregistrer('antiparasitaires', { id: 'apr1', animalId: 'a_r1', date: '2026-04-18', type: 'anti-tiques', produit: 'Bravecto' });
      await BD.enregistrer('traitements', { id: 'tr1', animalId: 'a_r1', debut: '2026-04-19', nom: 'Meloxicam', statut: 'en-cours' });
      await BD.enregistrer('rdv', { id: 'rr1', animalId: 'a_r1', date: '2026-05-02', motif: 'Contrôle', compteRendu: 'Radiographie normale ' + xssPayload });

      await BD.enregistrer('notes', { id: 'nr2', animalId: 'a_r2', date: '2026-05-03', categorie: 'observation', texte: 'Allergie pollen' });

      await Nav.aller({ vue: 'animal', id: 'a_r1', section: 'identite' });
      await new Promise((ok) => setTimeout(ok, 150));

      const zoneRech = document.querySelector('#animal-recherche');
      const apresNav = zoneRech?.previousElementSibling?.id === 'animal-sections';
      const dansContenu = document.querySelector('#animal-contenu')?.contains(zoneRech);

      const chercher = async (q) => {
        const input = document.querySelector('#animal-recherche-saisie');
        input.value = q;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((ok) => setTimeout(ok, 120));
        return {
          txt: document.querySelector('#animal-recherche-resultats')?.textContent || '',
          cache: document.querySelector('#animal-recherche-resultats')?.hidden,
          boutons: [...document.querySelectorAll('#animal-recherche-resultats button.resultat-recherche')].map((b) => ({
            section: b.dataset.section,
            texte: b.textContent
          })),
          effHidden: document.querySelector('#animal-recherche-effacer')?.hidden
        };
      };

      const rBoiterie = await chercher('boiterie');
      const imgsXss = document.querySelectorAll('#animal-recherche-resultats img').length;
      const rLyme = await chercher('lyme');
      const rBravecto = await chercher('bravecto');
      const rMeloxicam = await chercher('meloxicam');
      const rRadio = await chercher('radiographie');
      const rAucun = await chercher('introuvableXYZ');

      // Saut vers la section RDV au clic sur résultat
      const rRadio2 = await chercher('radiographie');
      document.querySelector('#animal-recherche-resultats button.resultat-recherche[data-section="rdv"]').click();
      await new Promise((ok) => setTimeout(ok, 120));
      const sectionApresClic = document.querySelector('#animal-sections button[aria-current="true"]')?.dataset.section || '';
      const contenuApresClic = document.querySelector('#animal-contenu')?.textContent || '';

      // Effacer avec le bouton « Effacer » sans vider #animal-contenu
      document.querySelector('#animal-recherche-effacer').click();
      await new Promise((ok) => setTimeout(ok, 80));
      const inputApresEff = document.querySelector('#animal-recherche-saisie').value;
      const resCacheApresEff = document.querySelector('#animal-recherche-resultats').hidden;
      const contenuApresEff = document.querySelector('#animal-contenu h2')?.textContent || '';

      // Rafraîchissement après suppression d'une fiche alors qu'une recherche est active
      await chercher('boiterie');
      await BD.supprimer('notes', 'nr1');
      await EcranAnimal.rafraichir();
      await new Promise((ok) => setTimeout(ok, 120));
      const resApresSuppr = document.querySelector('#animal-recherche-resultats')?.textContent || '';

      // Changement d'animal : la recherche est réinitialisée
      await chercher('lyme');
      await EcranAnimal.afficher('a_r2', 'identite');
      await new Promise((ok) => setTimeout(ok, 120));
      const inputAnimal2 = document.querySelector('#animal-recherche-saisie').value;
      const resCacheAnimal2 = document.querySelector('#animal-recherche-resultats').hidden;

      // Concurrence asynchrone : un effacement synchrone annule une requête lente en vol
      const origParAnimal = BD.parAnimal;
      BD.parAnimal = async (m, id) => {
        await new Promise((ok) => setTimeout(ok, 90));
        return origParAnimal.call(BD, m, id);
      };
      const inputB = document.querySelector('#animal-recherche-saisie');
      inputB.value = 'pollen';
      const promLente = EcranAnimal.executerRecherche('pollen');
      inputB.value = '';
      await EcranAnimal.executerRecherche('');
      await promLente;
      BD.parAnimal = origParAnimal;
      const resCacheApresCourse = document.querySelector('#animal-recherche-resultats').hidden;

      return {
        norm, videRes, resPur, resLong, resNfdDebut, resNfdMilieu,
        apresNav, dansContenu: !!dansContenu,
        rBoiterie, imgsXss, xssExec: !!window.__xssM4Search,
        rLyme, rBravecto, rMeloxicam, rRadio, rRadio2, rAucun,
        sectionApresClic, contenuApresClic,
        inputApresEff, resCacheApresEff, contenuApresEff,
        resApresSuppr, inputAnimal2, resCacheAnimal2, resCacheApresCourse
      };
    });

    verifier(r.norm === 'fievre moderee' && r.videRes.length === 0, 'normaliserRecherche plie casse/accents et requête vide renvoie []', r.norm);
    verifier(
      r.resPur.length === 5 &&
      r.resLong.length === 1 && r.resLong[0].extrait.toLowerCase().includes('échocardiographie'),
      'rechercherDansDonnees couvre les 5 magasins, résiste aux clés prototype et centre les extraits longs',
      { nb: r.resPur.length, extrait: r.resLong[0]?.extrait }
    );
    verifier(
      r.resNfdDebut.length === 1 &&
      r.resNfdDebut[0].extrait.includes('pneumopathie') &&
      !/^…[\u0300-\u036f]/.test(r.resNfdDebut[0].extrait) &&
      r.resNfdMilieu.length === 1 &&
      r.resNfdMilieu[0].extrait.includes('pneumopathie') &&
      !/^…[\u0300-\u036f]/.test(r.resNfdMilieu[0].extrait) &&
      r.resNfdMilieu[0].extrait.endsWith('e\u0301…'),
      'Extraits NFD longs (220+ diacritiques combinants) conservent le mot-clé et ne coupent pas les grappes combinantes',
      { debut: r.resNfdDebut[0]?.extrait, milieu: r.resNfdMilieu[0]?.extrait }
    );
    verifier(r.apresNav && !r.dansContenu, '#animal-recherche monté après #animal-sections et hors #animal-contenu', r);
    verifier(
      r.rBoiterie.boutons.length === 1 && r.rBoiterie.boutons[0].section === 'notes' &&
      r.rLyme.boutons[0]?.section === 'vaccins' &&
      r.rBravecto.boutons[0]?.section === 'antiparasitaires' &&
      r.rMeloxicam.boutons[0]?.section === 'traitements' &&
      r.rRadio.boutons[0]?.section === 'rdv' &&
      r.rAucun.txt.includes('Aucun résultat'),
      'Recherche DOM trouve notes, vaccins, antiparasitaires, traitements, comptes-rendus de RDV et gère l’absence de résultat',
      r.rAucun
    );
    verifier(
      r.imgsXss === 0 && !r.xssExec && r.rBoiterie.txt.includes('<img src=x'),
      'Charges XSS rendues en textContent pur sans exécution',
      { imgsXss: r.imgsXss, xssExec: r.xssExec }
    );
    verifier(
      r.sectionApresClic === 'rdv' && r.contenuApresClic.includes('Radiographie normale') &&
      r.inputApresEff === '' && r.resCacheApresEff && r.contenuApresEff === 'Rendez-vous vétérinaires',
      'Clic sur résultat bascule vers la section cible ; bouton Effacer vide la recherche sans vider #animal-contenu',
      { sectionApresClic: r.sectionApresClic, contenuApresEff: r.contenuApresEff }
    );
    verifier(
      r.resApresSuppr.includes('Aucun résultat') &&
      r.inputAnimal2 === '' && r.resCacheAnimal2 && r.resCacheApresCourse,
      'rafraichir() met à jour la recherche ; changement d’animal et concurrence _tourRecherche réinitialisent proprement',
      { resApresSuppr: r.resApresSuppr, inputAnimal2: r.inputAnimal2, resCacheAnimal2: r.resCacheAnimal2, resCacheApresCourse: r.resCacheApresCourse }
    );
  });

  await section('EcranAnimal : onglet Chronologie, tri déterministe et responsive 390px / 3 thèmes (R4)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Vérifier SECTIONS + construireChronologie (pur)
      const indexChrono = SECTIONS.findIndex((s) => s.cle === 'chronologie');
      const episodesPur = EcranAnimal.construireChronologie({
        notes: [
          { id: 'n_sym', date: '2026-05-10', categorie: 'symptome', texte: 'Toux légère', pieces: ['data:image/jpeg;base64,AA'] },
          { id: 'n_obs', date: '2026-05-11', categorie: 'observation', texte: 'Observation exclue' },
          { id: 'n_all', date: '2026-05-12', categorie: 'allergie', texte: 'Allergie exclue' },
          { id: 'n_bad', date: 'invalide', categorie: 'symptome', texte: 'Date invalide exclue' }
        ],
        rdv: [
          { id: 'r1', date: '2026-05-10', heure: '09:00', motif: 'Matin', veterinaire: 'Dr A' },
          { id: 'r2', date: '2026-05-10', heure: '15:30', motif: 'Après-midi', compteRendu: 'RAS' }
        ],
        traitements: [
          { id: 't_deb', debut: '2026-05-10', nom: 'Antibio', dose: '1 cp', statut: 'en-cours' },
          { id: 't_fin', fin: '2026-05-08', nom: 'Cure sans debut', statut: 'termine' },
          { id: 't_sans', nom: 'Traitement sans date', statut: 'en-cours' }
        ],
        pesees: [
          { id: 'p1', date: '2026-05-10', grammes: 4200, note: 'À jeun' },
          { id: 'p_nan', date: '2026-05-09', grammes: NaN }
        ]
      }, 'kg');

      const episodesG = EcranAnimal.construireChronologie({
        pesees: [{ id: 'pg', date: '2026-05-01', grammes: 950 }]
      }, 'g');

      // 2. Intégration UI : état vide puis rempli
      await BD.enregistrer('animaux', {
        id: 'a_ch', nom: 'Luna', espece: 'Chat', unitePoids: 'kg', archive: false,
        poidsIdealMin: 3500, poidsIdealMax: 4500
      });
      await Nav.aller({ vue: 'animal', id: 'a_ch', section: 'chronologie' });
      await new Promise((ok) => setTimeout(ok, 120));

      const titreChrono = document.querySelector('#animal-contenu h2')?.textContent || '';
      const videChrono = !!document.querySelector('#animal-contenu .encart.vide');
      const boutonOnglet = document.querySelector('#animal-sections button[data-section="chronologie"]');

      // Remplir des épisodes variés + XSS
      const xss = '<script>window.__xssM4Chrono=1</script>';
      await BD.enregistrer('notes', { id: 'cn1', animalId: 'a_ch', date: '2026-05-02', categorie: 'symptome', texte: 'Fièvre ' + xss });
      await BD.enregistrer('notes', { id: 'cn2', animalId: 'a_ch', date: '2026-05-04', categorie: 'observation', texte: 'Obs ignorée' });
      await BD.enregistrer('pesees', { id: 'cp1', animalId: 'a_ch', date: '2026-05-03', grammes: 4100 });
      await BD.enregistrer('traitements', { id: 'ct1', animalId: 'a_ch', debut: '2026-05-04', nom: 'Sirop gorge', statut: 'en-cours' });
      await BD.enregistrer('traitements', { id: 'ct_undated', animalId: 'a_ch', nom: 'Sans date', statut: 'en-cours' });
      await BD.enregistrer('rdv', { id: 'cr1', animalId: 'a_ch', date: '2026-05-05', heure: '14:00', motif: 'Visite contrôle' });
      await EcranAnimal.rafraichir();
      await new Promise((ok) => setTimeout(ok, 120));

      const cartes = [...document.querySelectorAll('#animal-contenu .carte-fiche.chronologie-carte')];
      const titresCartes = cartes.map((c) => c.querySelector('.carte-titre')?.textContent || '');
      const texteZone = document.querySelector('#animal-contenu')?.textContent || '';

      // Saut vers section source depuis une carte Chronologie
      const btnVoirPoids = [...document.querySelectorAll('#animal-contenu .chronologie-carte button')]
        .find((b) => /Voir dans « Poids »/i.test(b.textContent));
      btnVoirPoids.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const apresSautSection = document.querySelector('#animal-sections button[aria-current="true"]')?.dataset.section || '';

      // 3. Vérification zéro débordement à 390px en taille tresgrand sur les 3 thèmes
      const origTaille = document.documentElement.getAttribute('data-taille');
      const origTheme = document.documentElement.getAttribute('data-theme');
      const debordements = [];

      const testerDebordement = async (label) => {
        for (const theme of ['omni', 'sombre', 'clair']) {
          document.documentElement.setAttribute('data-theme', theme);
          document.documentElement.setAttribute('data-taille', 'tresgrand');
          await new Promise((ok) => setTimeout(ok, 30));
          if (document.documentElement.scrollWidth > window.innerWidth) {
            debordements.push(label + '/' + theme + ':' + document.documentElement.scrollWidth + '>' + window.innerWidth);
          }
        }
      };

      // Sur onglet poids (avec fourchette + courbe)
      await testerDebordement('poids');

      // Sur onglet chronologie + recherche active
      await EcranAnimal.changerSection('chronologie');
      const inp = document.querySelector('#animal-recherche-saisie');
      inp.value = 'contrôle';
      await EcranAnimal.executerRecherche('contrôle');
      await new Promise((ok) => setTimeout(ok, 120));
      await testerDebordement('chronologie+recherche');

      if (origTaille) document.documentElement.setAttribute('data-taille', origTaille);
      else document.documentElement.removeAttribute('data-taille');
      if (origTheme) document.documentElement.setAttribute('data-theme', origTheme);
      else document.documentElement.removeAttribute('data-theme');

      return {
        indexChrono,
        episodesPur: episodesPur.map((e) => ({ id: e.id, type: e.type, date: e.date, heure: e.heure, titre: e.titre })),
        episodesG: episodesG.map((e) => e.titre),
        titreChrono, videChrono, aOnglet: !!boutonOnglet,
        titresCartes, texteZone, xssExec: !!window.__xssM4Chrono,
        apresSautSection, debordements
      };
    });

    verifier(r.indexChrono === 9 && r.aOnglet, 'Onglet Chronologie ajouté en 10e position dans SECTIONS', r.indexChrono);
    verifier(
      r.episodesPur.length === 6 &&
      r.episodesPur.map((e) => e.id).join(',') === 'r2,r1,n_sym,t_deb,p1,t_fin' &&
      r.episodesG[0] === '950 g',
      'construireChronologie filtre les symptômes, exclut les fiches sans date/NaN et trie du plus récent au plus ancien avec départage déterministe',
      r.episodesPur
    );
    verifier(r.titreChrono === 'Chronologie' && r.videChrono, 'État vide de Chronologie rendu avec .encart.vide', r);
    verifier(
      r.titresCartes.length === 4 &&
      r.titresCartes[0] === 'Visite contrôle' &&
      r.titresCartes[1] === 'Sirop gorge' &&
      r.titresCartes[2] === '4,1 kg' &&
      r.titresCartes[3].startsWith('Fièvre ') &&
      !r.texteZone.includes('Obs ignorée') &&
      !r.texteZone.includes('Sans date') &&
      !r.texteZone.includes('Invalid Date') &&
      !r.texteZone.includes('NaN') &&
      !r.xssExec,
      'Cartes Chronologie dans l’ordre chronologique décroissant sans Invalid Date / NaN / XSS',
      r.titresCartes
    );
    verifier(r.apresSautSection === 'poids', 'Bouton « Voir dans « Poids » » bascule vers l’onglet Poids', r.apresSautSection);
    verifier(r.debordements.length === 0, 'Aucun débordement horizontal à 390px en tresgrand sur les 3 thèmes', r.debordements);
  });

  await section('M4B — R3 : Pastilles visuelles sur les onglets de la fiche animal', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const auj = Dates.aujourdhui();
      const hier = Dates.ajouterJours(auj, -1);
      const demain = Dates.ajouterJours(auj, 1);
      const passe = Dates.ajouterJours(auj, -100);

      await BD.enregistrer('animaux', { id: 'a_dot', nom: 'Filou', espece: 'Chat', archive: false });
      await BD.enregistrer('animaux', { id: 'a_futur', nom: 'Zéphyr', espece: 'Chien', archive: false });
      await BD.enregistrer('animaux', { id: 'a_arch_dot', nom: 'Vénus', espece: 'Chat', archive: true });

      // Animal avec rappels en retard / aujourd'hui / prise chronique sans fin
      await BD.enregistrer('vaccins', { id: 'vd1', animalId: 'a_dot', nom: 'Typhus', date: passe, rappel: hier });
      await BD.enregistrer('antiparasitaires', { id: 'ad1', animalId: 'a_dot', type: 'vermifuge', produit: 'Milbemax', date: passe, prochaine: auj });
      await BD.enregistrer('traitements', {
        id: 'td1', animalId: 'a_dot', nom: 'Cortisone', statut: 'en-cours', debut: passe,
        prisesParJour: 2, prises: { [auj]: ['08:00'] }
      });
      await BD.enregistrer('taches', { id: 'tkd1', animalId: 'a_dot', titre: 'Couper griffes', echeance: auj, fait: false });

      // Animal futur uniquement
      await BD.enregistrer('vaccins', { id: 'vf1', animalId: 'a_futur', nom: 'Rage', date: passe, rappel: demain });
      await BD.enregistrer('taches', { id: 'tkf1', animalId: 'a_futur', titre: 'Bain', echeance: demain, fait: false });

      // Animal archivé avec rappels en retard
      await BD.enregistrer('vaccins', { id: 'va1', animalId: 'a_arch_dot', nom: 'Rage', date: passe, rappel: hier });
      await BD.enregistrer('taches', { id: 'tka1', animalId: 'a_arch_dot', titre: 'Bilan', echeance: hier, fait: false });

      const lireOnglets = () => {
        const res = {};
        for (const b of document.querySelectorAll('#animal-sections button')) {
          const pastille = b.querySelector('.pastille-section');
          res[b.dataset.section] = {
            dot: !!pastille,
            hasHidden: pastille ? pastille.hasAttribute('hidden') : false,
            text: b.textContent,
            ariaLabel: b.getAttribute('aria-label') || ''
          };
        }
        return res;
      };

      await Nav.aller({ vue: 'animal', id: 'a_dot', section: 'identite' });
      await new Promise((ok) => setTimeout(ok, 150));
      const ongletsActif = lireOnglets();

      // Contraste de la pastille (onglet inactif vs actif aria-current="true") sur les 3 thèmes
      const origTheme = document.documentElement.getAttribute('data-theme');
      const origTaille = document.documentElement.getAttribute('data-taille');
      const contrastes = [];
      const debordements = [];
      for (const theme of ['omni', 'sombre', 'clair']) {
        await EcranAnimal.changerSection('identite');
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-taille', 'tresgrand');
        await new Promise((ok) => setTimeout(ok, 30));
        const btnVac = document.querySelector('#animal-sections button[data-section="vaccins"]');
        const bgBtnInactif = getComputedStyle(btnVac).backgroundColor;
        const bgDotInactif = getComputedStyle(btnVac.querySelector('.pastille-section')).backgroundColor;
        await EcranAnimal.changerSection('vaccins');
        await new Promise((ok) => setTimeout(ok, 80));
        const bgBtnActif = getComputedStyle(btnVac).backgroundColor;
        const bgDotActif = getComputedStyle(btnVac.querySelector('.pastille-section')).backgroundColor;
        contrastes.push({
          theme,
          inactifDistinct: bgDotInactif !== bgBtnInactif,
          actifDistinct: bgDotActif !== bgBtnActif,
          changeAvecActif: bgDotActif !== bgDotInactif
        });
        if (document.documentElement.scrollWidth > window.innerWidth) {
          debordements.push(theme + ':' + document.documentElement.scrollWidth);
        }
      }
      if (origTheme) document.documentElement.setAttribute('data-theme', origTheme);
      else document.documentElement.removeAttribute('data-theme');
      if (origTaille) document.documentElement.setAttribute('data-taille', origTaille);
      else document.documentElement.removeAttribute('data-taille');

      // Rafraîchissement dynamique : noter prise -> pastille traitements disparaît ; annuler -> revient
      await EcranAnimal.changerSection('traitements');
      await new Promise((ok) => setTimeout(ok, 100));
      const tr = await BD.lire('traitements', 'td1');
      await EcranSante.noterPrise(tr, () => EcranAnimal.rafraichir());
      await new Promise((ok) => setTimeout(ok, 120));
      const dotTrApresPrise = !!document.querySelector('#animal-sections button[data-section="traitements"] .pastille-section');

      const tr2 = await BD.lire('traitements', 'td1');
      const origConfDot = UI.confirmer;
      UI.confirmer = async () => true;
      await EcranSante.annulerPrise(tr2, () => EcranAnimal.rafraichir());
      UI.confirmer = origConfDot;
      await new Promise((ok) => setTimeout(ok, 120));
      const dotTrApresAnnul = !!document.querySelector('#animal-sections button[data-section="traitements"] .pastille-section');

      // Marquer tâche faite -> pastille taches disparaît + aria-label effacé
      await EcranAnimal.changerSection('taches');
      await new Promise((ok) => setTimeout(ok, 100));
      const tk = await BD.lire('taches', 'tkd1');
      await EcranAgenda.marquerFait(tk, () => EcranAnimal.rafraichir());
      await new Promise((ok) => setTimeout(ok, 120));
      const btnTachesApres = document.querySelector('#animal-sections button[data-section="taches"]');
      const dotTachesApres = !!btnTachesApres.querySelector('.pastille-section');
      const ariaTachesApres = btnTachesApres.getAttribute('aria-label');

      // Renouvellement vaccin + antiparasitaire via rafraichir()
      await BD.enregistrer('vaccins', { id: 'vd2', animalId: 'a_dot', nom: 'Typhus', date: auj, rappel: demain });
      await BD.enregistrer('antiparasitaires', { id: 'ad2', animalId: 'a_dot', type: 'vermifuge', produit: 'Milbemax', date: auj, prochaine: demain });
      await EcranAnimal.rafraichir();
      await new Promise((ok) => setTimeout(ok, 120));
      const dotVacApresRenouv = !!document.querySelector('#animal-sections button[data-section="vaccins"] .pastille-section');
      const dotApApresRenouv = !!document.querySelector('#animal-sections button[data-section="antiparasitaires"] .pastille-section');

      // Animal futur uniquement : 0 pastille
      await EcranAnimal.afficher('a_futur', 'identite');
      await new Promise((ok) => setTimeout(ok, 120));
      const nbDotsFutur = document.querySelectorAll('#animal-sections .pastille-section').length;

      // Animal archivé : 0 pastille
      await EcranAnimal.afficher('a_arch_dot', 'identite');
      await new Promise((ok) => setTimeout(ok, 120));
      const nbDotsArch = document.querySelectorAll('#animal-sections .pastille-section').length;

      // Garde de concurrence _tour : un rafraichir() lent sur a_dot ne doit pas écraser a_futur
      await EcranAnimal.afficher('a_dot', 'identite');
      await new Promise((ok) => setTimeout(ok, 100));
      const origToutLire = BD.toutLire;
      BD.toutLire = async () => {
        await new Promise((ok) => setTimeout(ok, 90));
        return origToutLire.call(BD);
      };
      const promRafLent = EcranAnimal.rafraichir();
      BD.toutLire = origToutLire;
      await EcranAnimal.afficher('a_futur', 'identite');
      await promRafLent;
      await new Promise((ok) => setTimeout(ok, 120));
      const nbDotsApresCourse = document.querySelectorAll('#animal-sections .pastille-section').length;

      return {
        ongletsActif, contrastes, debordements,
        dotTrApresPrise, dotTrApresAnnul,
        dotTachesApres, ariaTachesApres,
        dotVacApresRenouv, dotApApresRenouv,
        nbDotsFutur, nbDotsArch, nbDotsApresCourse
      };
    });

    verifier(
      r.ongletsActif.vaccins?.dot && r.ongletsActif.traitements?.dot &&
      r.ongletsActif.antiparasitaires?.dot && r.ongletsActif.taches?.dot &&
      !r.ongletsActif.identite?.dot && !r.ongletsActif.poids?.dot &&
      !r.ongletsActif.rdv?.dot && !r.ongletsActif.notes?.dot &&
      !r.ongletsActif.alimentation?.dot && !r.ongletsActif.chronologie?.dot &&
      r.ongletsActif.vaccins.text === 'Vaccins' && r.ongletsActif.traitements.text === 'Traitements' &&
      r.ongletsActif.antiparasitaires.text === 'Antiparasitaires' && r.ongletsActif.taches.text === 'À faire' &&
      !r.ongletsActif.vaccins.hasHidden && r.ongletsActif.vaccins.ariaLabel.includes('rappel'),
      'Pastilles affichées uniquement sur les 4 onglets concernés avec textContent exact et sans hidden',
      r.ongletsActif
    );
    verifier(
      r.contrastes.length === 3 && r.contrastes.every((c) => c.inactifDistinct && c.actifDistinct && c.changeAvecActif) &&
      r.debordements.length === 0,
      'Pastilles contrastées et sans débordement à 390px en tresgrand sur les 3 thèmes',
      { contrastes: r.contrastes, debordements: r.debordements }
    );
    verifier(
      !r.dotTrApresPrise && r.dotTrApresAnnul &&
      !r.dotTachesApres && r.ariaTachesApres === null &&
      !r.dotVacApresRenouv && !r.dotApApresRenouv,
      'rafraichir() met à jour dynamiquement les 4 pastilles et efface aria-label',
      r
    );
    verifier(
      r.nbDotsFutur === 0 && r.nbDotsArch === 0 && r.nbDotsApresCourse === 0,
      'Aucune pastille sur animal futur, animal archivé, ni après concurrence asynchrone _tour',
      { nbDotsFutur: r.nbDotsFutur, nbDotsArch: r.nbDotsArch, nbDotsApresCourse: r.nbDotsApresCourse }
    );
  });

  await section('M4B — R1 : Fiche animal perdu (texteAnimalPerdu, UI, partage & garde verrou)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Helper pur texteAnimalPerdu
      const complet = EcranAnimal.texteAnimalPerdu({
        nom: 'Pixel <script>x</script>',
        espece: 'Chien',
        race: 'Border Collie & Berger',
        sexe: 'male',
        naissance: '2022-05-15',
        couleur: 'Noir et blanc, cicatrice "oreille"',
        puce: '250 2696 0011 2233',
        tatouage: 'TAT789',
        notes: 'Très sociable'
      }, { nom: 'Camille', telephone: '06 11 22 33 44' }, '2026-05-15');

      const minimal = EcranAnimal.texteAnimalPerdu({
        nom: 'Minou',
        espece: 'Chat'
      }, null, '2026-05-15');

      const invalideNull = EcranAnimal.texteAnimalPerdu(null);
      const invalideArr = EcranAnimal.texteAnimalPerdu([]);

      // 2. UI actif & archivé + compatibilité sélecteur Copier .first() + Partage.texte
      await BD.enregistrer('animaux', {
        id: 'a_perdu', nom: 'Pixel', espece: 'Chien', race: 'Berger', couleur: 'Fauve',
        puce: '250 2696 0000 0001', archive: false
      });
      await BD.enregistrer('animaux', {
        id: 'a_perdu_arch', nom: 'Milo', espece: 'Chat', couleur: 'Roux', archive: true
      });
      await BD.definirReglage('contactGarde', { nom: 'Sam', telephone: '07 65 43 21 00' });

      await Nav.aller({ vue: 'animal', id: 'a_perdu', section: 'identite' });
      await new Promise((ok) => setTimeout(ok, 120));

      const btnsCopier = [...document.querySelectorAll('#animal-contenu button')]
        .filter((b) => b.textContent.includes('Copier'));
      const premierCopierAria = btnsCopier[0]?.getAttribute('aria-label') || '';
      const btnPerduActif = [...document.querySelectorAll('#animal-contenu button')]
        .find((b) => b.textContent.trim() === 'Fiche animal perdu');

      // Test partage natif (navigator.share)
      const origShare = navigator.share;
      const origCanShare = navigator.canShare;
      const origCopier = UI.copier;
      const partages = [];
      let copies = [];

      navigator.canShare = () => true;
      navigator.share = async (data) => { partages.push(data); };
      btnPerduActif.click();
      await new Promise((ok) => setTimeout(ok, 100));

      // Test AbortError silencieux
      document.querySelector('#annonce').textContent = '';
      navigator.share = async () => { const err = new Error('Annulé'); err.name = 'AbortError'; throw err; };
      btnPerduActif.click();
      await new Promise((ok) => setTimeout(ok, 100));
      const annonceAbort = document.querySelector('#annonce').textContent;

      // Test fallback UI.copier quand navigator.share indisponible + mise à jour contactGarde
      navigator.share = undefined;
      navigator.canShare = undefined;
      UI.copier = async (txt) => { copies.push(txt); return true; };
      await BD.definirReglage('contactGarde', null);
      btnPerduActif.click();
      await new Promise((ok) => setTimeout(ok, 100));
      const annonceCopie = document.querySelector('#annonce').textContent;

      // Test animal archivé
      await EcranAnimal.afficher('a_perdu_arch', 'identite');
      await new Promise((ok) => setTimeout(ok, 100));
      const btnPerduArch = [...document.querySelectorAll('#animal-contenu button')]
        .find((b) => b.textContent.trim() === 'Fiche animal perdu');
      btnPerduArch.click();
      await new Promise((ok) => setTimeout(ok, 100));

      // Test garde #verrou
      const verrou = document.querySelector('#verrou');
      const etaitCache = verrou.hidden;
      verrou.hidden = false;
      const nbCopiesAvantVerrou = copies.length;
      await EcranAnimal.partagerAnimalPerdu({ id: 'a_perdu_arch', nom: 'Milo' });
      const nbCopiesApresVerrou = copies.length;
      verrou.hidden = etaitCache;

      navigator.share = origShare;
      navigator.canShare = origCanShare;
      UI.copier = origCopier;

      return {
        complet, minimal, invalideNull, invalideArr,
        nbBtnsCopier: btnsCopier.length, premierCopierAria,
        aBtnPerduActif: !!btnPerduActif, aBtnPerduArch: !!btnPerduArch,
        partages, annonceAbort, copies, annonceCopie,
        bloqueSiVerrou: nbCopiesAvantVerrou === nbCopiesApresVerrou
      };
    });

    verifier(
      r.complet.includes('ANIMAL PERDU — Pixel <script>x</script>') &&
      r.complet.includes('Chien · Border Collie & Berger') &&
      r.complet.includes('Mâle') && r.complet.includes('4 ans') &&
      r.complet.includes('250 2696 0011 2233') && r.complet.includes('TAT789') &&
      r.complet.includes('06 11 22 33 44 (Camille)') &&
      r.complet.includes('15/05/2026') &&
      !r.complet.includes('&lt;') && !r.complet.includes('&amp;') &&
      !/\b(undefined|null|NaN)\b/.test(r.complet) &&
      r.minimal.includes('aucune puce ni tatouage') &&
      r.minimal.includes('non renseigné') &&
      !/\b(undefined|null|NaN)\b/.test(r.minimal) &&
      r.invalideNull === '' && r.invalideArr === '',
      'texteAnimalPerdu génère un texte complet/partiel lisible, déterministe et sans échappement HTML ni undefined/null/NaN',
      { complet: r.complet, minimal: r.minimal }
    );
    verifier(
      r.aBtnPerduActif && r.aBtnPerduArch &&
      r.nbBtnsCopier === 1 && r.premierCopierAria.includes('puce'),
      'Bouton « Fiche animal perdu » présent sur actif et archivé sans casser le sélecteur Copier .first()',
      { nbBtnsCopier: r.nbBtnsCopier, premierCopierAria: r.premierCopierAria }
    );
    verifier(
      r.partages.length === 1 && r.partages[0].title === 'Animal perdu — Pixel' &&
      r.partages[0].text.includes('07 65 43 21 00 (Sam)') &&
      r.annonceAbort === '' &&
      r.copies.length === 2 && r.copies[0].includes('non renseigné') && !r.copies[0].includes('07 65 43 21 00') &&
      r.copies[1].includes('Milo') && r.copies[1].includes('Roux') &&
      r.annonceCopie.includes('copié') && r.bloqueSiVerrou,
      'Partage.texte gère navigator.share, AbortError silencieux, repli UI.copier, contact à jour et garde #verrou',
      r
    );
  });

  await section('M4B — R5 : Champs passeport européen & assurance/mutuelle (masquage, tel:, XSS, carnet)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Champs absents / blancs uniquement : masqués dans Identité et #carnet
      await BD.enregistrer('animaux', {
        id: 'a_vide', nom: 'Simba', espece: 'Chat', unitePoids: 'kg',
        passeport: '   ', assuranceCompagnie: '', assuranceContrat: ' ', assuranceTelephone: '  '
      });
      await Nav.aller({ vue: 'animal', id: 'a_vide', section: 'identite' });
      await new Promise((ok) => setTimeout(ok, 120));
      const txtVideIdentite = document.querySelector('#animal-contenu')?.textContent || '';
      const telVideCount = document.querySelectorAll('#animal-contenu a[href^="tel:"]').length;

      const origPrint = window.print;
      window.print = () => {};
      await EcranAnimal.imprimerCarnet(await BD.lire('animaux', 'a_vide'));
      const txtVideCarnet = document.querySelector('#carnet')?.textContent || '';
      if (Impression._nettoyer) Impression._nettoyer(true);

      // 2. Formulaire : présence, maxlength, rejet téléphone invalide, enregistrement et modification
      document.querySelector('#animal-contenu button.principal').click();
      await new Promise((ok) => setTimeout(ok, 120));
      const form = document.querySelector('#formulaire-zone form');
      const maxLengths = {
        passeport: form.querySelector('#champ-passeport')?.maxLength,
        compagnie: form.querySelector('#champ-assuranceCompagnie')?.maxLength,
        contrat: form.querySelector('#champ-assuranceContrat')?.maxLength,
        tel: form.querySelector('#champ-assuranceTelephone')?.maxLength,
        telType: form.querySelector('#champ-assuranceTelephone')?.type
      };

      form.querySelector('#champ-passeport').value = 'FR-123456';
      form.querySelector('#champ-assuranceCompagnie').value = 'SantéVet';
      form.querySelector('#champ-assuranceContrat').value = 'POL-9988';
      form.querySelector('#champ-assuranceTelephone').value = 'call:evil()';
      await Formulaire.soumettre(form);
      const errTel = form.querySelector('[data-champ="assuranceTelephone"] .message-erreur')?.textContent || '';

      const attendreIdentite = async (ancienH2) => {
        const debut = Date.now();
        while (Date.now() - debut < 3000) {
          const vue = document.querySelector('.vue[data-vue="animal"]');
          const btns = document.querySelector('#animal-contenu .pile-boutons');
          if (vue && !vue.hidden && btns && (!ancienH2 || !ancienH2.isConnected)) return;
          await new Promise((ok) => setTimeout(ok, 25));
        }
      };

      const ancienH2Avant1 = document.querySelector('#animal-contenu h2');
      form.querySelector('#champ-assuranceTelephone').value = '01 80 00 11 22';
      await Formulaire.soumettre(form);
      await attendreIdentite(ancienH2Avant1);

      const txtRempliIdentite = document.querySelector('#animal-contenu')?.textContent || '';
      const lienTelValide = document.querySelector('#animal-contenu a[href="tel:0180001122"]')?.textContent || '';

      const aVideIdb = await BD.lire('animaux', 'a_vide');
      await EcranAnimal.imprimerCarnet(aVideIdb);
      const txtRempliCarnet = document.querySelector('#carnet')?.textContent || '';
      const liensCarnet = document.querySelectorAll('#carnet a').length;
      if (Impression._nettoyer) Impression._nettoyer(true);

      // Effacement des champs via formulaire
      const ancienH2Avant2 = document.querySelector('#animal-contenu h2');
      document.querySelector('#animal-contenu button.principal').click();
      await new Promise((ok) => setTimeout(ok, 120));
      const form2 = document.querySelector('#formulaire-zone form');
      form2.querySelector('#champ-passeport').value = '';
      form2.querySelector('#champ-assuranceCompagnie').value = '';
      form2.querySelector('#champ-assuranceContrat').value = '';
      form2.querySelector('#champ-assuranceTelephone').value = '';
      await Formulaire.soumettre(form2);
      await attendreIdentite(ancienH2Avant2);
      const animalEfface = await BD.lire('animaux', 'a_vide');
      const txtApresEff = document.querySelector('#animal-contenu')?.textContent || '';

      // 3. Sécurité : charge malveillante injectée en IDB (import sauvegarde)
      const xss = '<img src=x onerror=window.__xssM4Pass=1>';
      await BD.enregistrer('animaux', {
        id: 'a_sec', nom: 'SecPet', espece: 'Chien',
        passeport: xss, assuranceCompagnie: xss, assuranceContrat: xss,
        assuranceTelephone: 'javascript:alert(1)'
      });
      await EcranAnimal.afficher('a_sec', 'identite');
      await new Promise((ok) => setTimeout(ok, 120));
      const secTelLinks = document.querySelectorAll('#animal-contenu a[href^="tel:"]').length;
      const secJsLinks = document.querySelectorAll('#animal-contenu a[href^="javascript:"]').length;
      const secImgs = document.querySelectorAll('#animal-contenu .carte-fiche img').length;
      const secTxt = document.querySelector('#animal-contenu .carte-fiche')?.textContent || '';

      await BD.enregistrer('animaux', {
        id: 'a_tiret', nom: 'TiretPet', espece: 'Chat', assuranceTelephone: '---'
      });
      await EcranAnimal.afficher('a_tiret', 'identite');
      await new Promise((ok) => setTimeout(ok, 120));
      const tiretTelLinks = document.querySelectorAll('#animal-contenu a[href^="tel:"]').length;
      const tiretTxt = document.querySelector('#animal-contenu .carte-fiche')?.textContent || '';

      window.print = origPrint;

      return {
        txtVideIdentite, telVideCount, txtVideCarnet,
        maxLengths, errTel, txtRempliIdentite, lienTelValide, aVideIdb, txtRempliCarnet, liensCarnet,
        animalEfface, txtApresEff,
        secTelLinks, secJsLinks, secImgs, secTxt, xssExec: !!window.__xssM4Pass,
        tiretTelLinks, tiretTxt
      };
    });

    verifier(
      !/Passeport|Assurance|Mutuelle|Contrat/i.test(r.txtVideIdentite) &&
      !/Passeport|Assurance|Mutuelle|Contrat/i.test(r.txtVideCarnet) &&
      !/\bnull\b|\bundefined\b/.test(r.txtVideCarnet) &&
      r.telVideCount === 0,
      'Champs passeport et assurance masqués dans Identité et #carnet lorsqu’ils sont vides ou blancs',
      { telVideCount: r.telVideCount }
    );
    verifier(
      r.maxLengths.passeport === 80 && r.maxLengths.compagnie === 120 &&
      r.maxLengths.contrat === 80 && r.maxLengths.tel === 30 && r.maxLengths.telType === 'tel' &&
      r.errTel.length > 0,
      'Limites maxlength respectées et téléphone invalide rejeté dans Formulaire',
      { maxLengths: r.maxLengths, errTel: r.errTel }
    );
    verifier(
      r.txtRempliIdentite.includes('FR-123456') && r.txtRempliIdentite.includes('SantéVet') &&
      r.txtRempliIdentite.includes('POL-9988') && r.lienTelValide.includes('01 80 00 11 22') &&
      r.txtRempliCarnet.includes('FR-123456') && r.txtRempliCarnet.includes('01 80 00 11 22') &&
      !/\bnull\b|\bundefined\b/.test(r.txtRempliCarnet) &&
      r.liensCarnet === 0 &&
      r.animalEfface.passeport === undefined && !/Passeport|Assurance/i.test(r.txtApresEff),
      'Champs passeport/assurance affichés avec lien tel:, repris en texte brut dans #carnet, et effaçables',
      { lienTelValide: r.lienTelValide, aVideIdb: r.aVideIdb, liensCarnet: r.liensCarnet }
    );
    verifier(
      r.secTelLinks === 0 && r.secJsLinks === 0 && r.secImgs === 0 && !r.xssExec &&
      r.secTxt.includes('javascript:alert(1)') && r.secTxt.includes('<img src=x') &&
      r.tiretTelLinks === 0 && r.tiretTxt.includes('---'),
      'Protection XSS et neutralisation de javascript:alert(1) / --- sans aucun lien tel: ou javascript:',
      { secTelLinks: r.secTelLinks, secJsLinks: r.secJsLinks, tiretTelLinks: r.tiretTelLinks }
    );
  });

  await section('M4B — R5 : Carnet imprimable (période, annexe photo, impression.css & 390px)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);

      // 1. Helper pur filtrerPourCarnet (bornes exactes, bissextile, traitements chevauchants/chroniques)
      const fBissextile = EcranAnimal.filtrerPourCarnet({
        pesees: [
          { id: 'pb1', date: '2023-02-28', grammes: 4000 },
          { id: 'pb0', date: '2023-02-27', grammes: 3900 }
        ]
      }, '12mois', '2024-02-29');

      const fComplet = EcranAnimal.filtrerPourCarnet({
        pesees: [
          { id: 'p_in', date: '2025-05-15', grammes: 4100 },
          { id: 'p_out', date: '2025-05-14', grammes: 4000 }
        ],
        vaccins: [
          { id: 'v_in', date: '2025-05-15', nom: 'VIn' },
          { id: 'v_out', date: '2025-05-14', nom: 'VOut' }
        ],
        antiparasitaires: [
          { id: 'ap_in', date: '2025-05-15', type: 'vermifuge' },
          { id: 'ap_out', date: '2025-05-14', type: 'vermifuge' }
        ],
        rdv: [
          { id: 'r_in', date: '2025-05-15', motif: 'RIn' },
          { id: 'r_out', date: '2025-05-14', motif: 'ROut' }
        ],
        notes: [
          { id: 'n_in', date: '2025-05-15', texte: 'NIn' },
          { id: 'n_out', date: '2025-05-14', texte: 'NOut' }
        ],
        traitements: [
          { id: 't_cheval', debut: '2024-01-01', fin: '2025-06-01', statut: 'termine', nom: 'Chevauchant' },
          { id: 't_chron', debut: '2024-01-01', statut: 'en-cours', nom: 'Chronique' },
          { id: 't_term_sans_fin_old', debut: '2024-01-01', statut: 'termine', nom: 'TermineAncien' },
          { id: 't_term_sans_fin_new', debut: '2025-06-01', statut: 'termine', nom: 'TermineRecent' },
          { id: 't_expire', debut: '2024-01-01', fin: '2025-05-14', statut: 'termine', nom: 'Expire' }
        ]
      }, '12mois', '2026-05-15');

      // 2. UI .options-carnet + rétrocompatibilité + filtrage + annexe photo sécurisée
      const auj = Dates.aujourdhui();
      const limite = Dates.ajouterIntervalle(auj, -12, 'mois');
      const avantLimite = Dates.ajouterJours(limite, -1);
      const recent = Dates.ajouterJours(auj, -5);
      const pixelJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      await BD.enregistrer('animaux', {
        id: 'a_carnet', nom: 'Oscar', espece: 'Chien', unitePoids: 'kg',
        passeport: 'FR-777', assuranceCompagnie: 'AssurPlus', assuranceTelephone: '01 40 50 60 70'
      });
      await BD.enregistrer('pesees', { id: 'cp_old', animalId: 'a_carnet', date: avantLimite, grammes: 12000, note: 'Pesée ancienne' });
      await BD.enregistrer('pesees', { id: 'cp_new', animalId: 'a_carnet', date: recent, grammes: 13500, note: 'Pesée récente' });
      await BD.enregistrer('vaccins', { id: 'cv_old', animalId: 'a_carnet', date: avantLimite, nom: 'AncienVaccin' });
      await BD.enregistrer('vaccins', { id: 'cv_new', animalId: 'a_carnet', date: recent, nom: 'RecentVaccin' });
      await BD.enregistrer('antiparasitaires', { id: 'cap_old', animalId: 'a_carnet', date: avantLimite, type: 'vermifuge', produit: 'AncienAP' });
      await BD.enregistrer('antiparasitaires', { id: 'cap_new', animalId: 'a_carnet', date: recent, type: 'vermifuge', produit: 'RecentAP' });
      await BD.enregistrer('traitements', { id: 'ct_old', animalId: 'a_carnet', debut: '2020-01-01', fin: avantLimite, statut: 'termine', nom: 'AncienTraitement' });
      await BD.enregistrer('traitements', { id: 'ct_chron', animalId: 'a_carnet', debut: '2020-01-01', statut: 'en-cours', nom: 'ChroniqueActif' });
      await BD.enregistrer('rdv', { id: 'cr_old', animalId: 'a_carnet', date: avantLimite, motif: 'AncienRDV' });
      await BD.enregistrer('rdv', { id: 'cr_new', animalId: 'a_carnet', date: recent, motif: 'RecentRDV' });
      await BD.enregistrer('notes', { id: 'cn_old', animalId: 'a_carnet', date: avantLimite, categorie: 'observation', texte: 'Note ancienne', pieces: [pixelJpeg] });
      await BD.enregistrer('notes', { id: 'cn_new', animalId: 'a_carnet', date: recent, categorie: 'examen', texte: 'Ordonnance récente', pieces: [pixelJpeg] });

      // Injection brute IDB d'une note avec image non valide (doit être ignorée par imageValide())
      const tx = await BD._transaction('notes', 'readwrite');
      tx.objectStore('notes').put({
        id: 'cn_unsafe', animalId: 'a_carnet', date: recent, categorie: 'autre',
        texte: 'Source non sûre', pieces: ['https://evil.invalid/x.jpg', 'data:image/svg+xml,<svg></svg>']
      });
      await BD.finTransaction(tx);

      await Nav.aller({ vue: 'animal', id: 'a_carnet', section: 'identite' });
      await new Promise((ok) => setTimeout(ok, 120));

      const fieldset = document.querySelector('#animal-contenu fieldset.options-carnet');
      const dansDetails = !!fieldset?.closest('details');
      const radioTout = document.querySelector('#animal-contenu input[type="radio"][value="tout"]');
      const radio12m = document.querySelector('#animal-contenu input[type="radio"][value="12mois"]');
      const caseAnnexe = document.querySelector('#animal-contenu input[type="checkbox"]');
      const defaultsOk = Boolean(fieldset && !dansDetails && radioTout?.checked && !radio12m?.checked && caseAnnexe && !caseAnnexe.checked);

      let nbAppelsPrint = 0;
      const origPrint = window.print;
      window.print = () => { nbAppelsPrint++; };

      // Clic immédiat par défaut (Tout, annexe false) -> 0 modale, 6 tables
      const btnImprimer = [...document.querySelectorAll('#animal-contenu button')]
        .find((b) => b.textContent.trim() === 'Carnet de santé (imprimer ou PDF)');
      btnImprimer.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const snapDefaut = {
        ouvertModal: !!document.querySelector('#dialogue[open]'),
        nbAppelsPrint,
        nbTables: document.querySelectorAll('#carnet section.carnet-section table').length,
        nbSections: document.querySelectorAll('#carnet section.carnet-section').length,
        nbAnnexeImgs: document.querySelectorAll('#carnet img:not(.carnet-photo)').length,
        txt: document.querySelector('#carnet')?.textContent || ''
      };
      window.dispatchEvent(new Event('afterprint'));
      const videApresPrint = document.querySelector('#carnet').children.length === 0;

      // 12 derniers mois + annexe false
      radio12m.checked = true;
      btnImprimer.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const snap12mSansAnnexe = {
        txt: document.querySelector('#carnet')?.textContent || '',
        nbSections: document.querySelectorAll('#carnet section.carnet-section').length,
        nbAnnexeImgs: document.querySelectorAll('#carnet img:not(.carnet-photo)').length
      };
      window.dispatchEvent(new Event('afterprint'));

      // 12 derniers mois + annexe true (seule la photo JPEG récente est rendue, l'ancienne et les URLs non sûres sont exclues)
      caseAnnexe.checked = true;
      btnImprimer.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const imgs12mAnnexe = [...document.querySelectorAll('#carnet .annexe-photo')].map((img) => img.getAttribute('src'));
      const nbFigures12m = document.querySelectorAll('#carnet .annexe-photo-element').length;
      window.dispatchEvent(new Event('afterprint'));

      // Tout + annexe true (les 2 photos JPEG valides sont rendues)
      radioTout.checked = true;
      btnImprimer.click();
      await new Promise((ok) => setTimeout(ok, 120));
      const nbFiguresTout = document.querySelectorAll('#carnet .annexe-photo-element').length;
      const figsTout = [...document.querySelectorAll('#carnet .annexe-photo-element figcaption')].map((f) => f.textContent);
      window.dispatchEvent(new Event('afterprint'));

      // 12 derniers mois quand aucune donnée récente et annexe false -> 6 p.vide
      await BD.enregistrer('animaux', { id: 'a_ancien', nom: 'VieuxCarnet', espece: 'Chat' });
      await BD.enregistrer('pesees', { id: 'ao_p', animalId: 'a_ancien', date: avantLimite, grammes: 3500 });
      await EcranAnimal.imprimerCarnet(await BD.lire('animaux', 'a_ancien'), { periode: '12mois', annexe: false });
      const nbVide12m = document.querySelectorAll('#carnet section.carnet-section p.vide').length;
      window.dispatchEvent(new Event('afterprint'));

      // 12 derniers mois + annexe true sans photo sur la période -> p.vide dans l'annexe
      await EcranAnimal.imprimerCarnet(await BD.lire('animaux', 'a_ancien'), { periode: '12mois', annexe: true });
      const txtAnnexeVide = document.querySelector('#carnet')?.textContent || '';
      const nbAnnexeVideImgs = document.querySelectorAll('#carnet .annexe-photo').length;

      // Rétrocompatibilité 1 argument
      await EcranAnimal.imprimerCarnet(await BD.lire('animaux', 'a_ancien'));
      const compat1ArgOk = document.querySelector('#carnet')?.textContent.includes('3,5 kg');
      window.dispatchEvent(new Event('afterprint'));

      window.print = origPrint;

      // Débordement 390px tresgrand sur Identité (avec passeport/assurance, options-carnet, Fiche animal perdu)
      await EcranAnimal.afficher('a_carnet', 'identite');
      await new Promise((ok) => setTimeout(ok, 120));
      const origTheme = document.documentElement.getAttribute('data-theme');
      const origTaille = document.documentElement.getAttribute('data-taille');
      const debordements = [];
      for (const theme of ['omni', 'sombre', 'clair']) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-taille', 'tresgrand');
        await new Promise((ok) => setTimeout(ok, 30));
        if (document.documentElement.scrollWidth > window.innerWidth) {
          debordements.push(theme + ':' + document.documentElement.scrollWidth);
        }
      }
      if (origTheme) document.documentElement.setAttribute('data-theme', origTheme);
      else document.documentElement.removeAttribute('data-theme');
      if (origTaille) document.documentElement.setAttribute('data-taille', origTaille);
      else document.documentElement.removeAttribute('data-taille');

      return {
        fBissextile: fBissextile.pesees.map((x) => x.id),
        fComplet: {
          dateDebut: fComplet.dateDebut,
          pesees: fComplet.pesees.map((x) => x.id),
          vaccins: fComplet.vaccins.map((x) => x.id),
          antip: fComplet.antiparasitaires.map((x) => x.id),
          rdv: fComplet.rdv.map((x) => x.id),
          notes: fComplet.notes.map((x) => x.id),
          traitements: fComplet.traitements.map((x) => x.id)
        },
        defaultsOk, snapDefaut, videApresPrint, snap12mSansAnnexe,
        imgs12mAnnexe, nbFigures12m, nbFiguresTout, figsTout,
        nbVide12m, txtAnnexeVide, nbAnnexeVideImgs, compat1ArgOk, debordements
      };
    });

    // Vérification des règles @media print via emulateMedia('print')
    await p.evaluate(async () => {
      const pixelJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      const a = await BD.lire('animaux', 'a_carnet');
      const origPrint = window.print;
      window.print = () => {};
      await EcranAnimal.imprimerCarnet(a, { periode: 'tout', annexe: true });
      window.print = origPrint;
      if (!document.querySelector('#carnet .annexe-photo') && pixelJpeg) throw new Error('Annexe manquante');
    });
    await p.emulateMedia({ media: 'print' });
    const printCss = await p.evaluate(() => {
      const carnetStyle = getComputedStyle(document.querySelector('#carnet'));
      const principalStyle = getComputedStyle(document.querySelector('#principal'));
      const figStyle = getComputedStyle(document.querySelector('#carnet .annexe-photo-element'));
      const imgStyle = getComputedStyle(document.querySelector('#carnet .annexe-photo'));
      const res = {
        carnetDisplay: carnetStyle.display,
        principalDisplay: principalStyle.display,
        figBreakInside: figStyle.breakInside || figStyle.pageBreakInside,
        imgBreakInside: imgStyle.breakInside || imgStyle.pageBreakInside,
        imgMaxHeight: imgStyle.maxHeight
      };
      window.dispatchEvent(new Event('afterprint'));
      return res;
    });
    await p.emulateMedia({ media: 'screen' });

    verifier(
      r.fBissextile.join(',') === 'pb1' &&
      r.fComplet.dateDebut === '2025-05-15' &&
      r.fComplet.pesees.join(',') === 'p_in' &&
      r.fComplet.vaccins.join(',') === 'v_in' &&
      r.fComplet.antip.join(',') === 'ap_in' &&
      r.fComplet.rdv.join(',') === 'r_in' &&
      r.fComplet.notes.join(',') === 'n_in' &&
      r.fComplet.traitements.join(',') === 't_cheval,t_chron,t_term_sans_fin_new',
      'filtrerPourCarnet gère exactement la borne 12 mois, les années bissextiles et les traitements chevauchants/chroniques',
      { fBissextile: r.fBissextile, fComplet: r.fComplet }
    );
    verifier(
      r.defaultsOk && !r.snapDefaut.ouvertModal && r.snapDefaut.nbAppelsPrint === 1 &&
      r.snapDefaut.nbTables === 6 && r.snapDefaut.nbSections === 7 && r.snapDefaut.nbAnnexeImgs === 0 &&
      r.snapDefaut.txt.includes('[1 document(s) joint(s) dans l’application]') &&
      r.videApresPrint && r.compat1ArgOk,
      'Options carnet en ligne par défaut (Tout, sans annexe), impression immédiate sans modale, 6 tableaux et rétrocompatibilité 1 argument',
      r.snapDefaut
    );
    verifier(
      r.snap12mSansAnnexe.nbSections === 7 && r.snap12mSansAnnexe.nbAnnexeImgs === 0 &&
      r.snap12mSansAnnexe.txt.includes('12 derniers mois') &&
      r.snap12mSansAnnexe.txt.includes('Pesée récente') && !r.snap12mSansAnnexe.txt.includes('Pesée ancienne') &&
      r.snap12mSansAnnexe.txt.includes('RecentVaccin') && !r.snap12mSansAnnexe.txt.includes('AncienVaccin') &&
      r.snap12mSansAnnexe.txt.includes('RecentAP') && !r.snap12mSansAnnexe.txt.includes('AncienAP') &&
      r.snap12mSansAnnexe.txt.includes('ChroniqueActif') && !r.snap12mSansAnnexe.txt.includes('AncienTraitement') &&
      r.snap12mSansAnnexe.txt.includes('RecentRDV') && !r.snap12mSansAnnexe.txt.includes('AncienRDV') &&
      r.snap12mSansAnnexe.txt.includes('Ordonnance récente') && !r.snap12mSansAnnexe.txt.includes('Note ancienne') &&
      r.nbVide12m === 6,
      'Période « 12 derniers mois » filtre les 6 sections et affiche 6 p.vide si aucune donnée récente',
      { nbVide12m: r.nbVide12m }
    );
    verifier(
      r.nbFigures12m === 1 && r.imgs12mAnnexe.length === 1 && r.imgs12mAnnexe[0].startsWith('data:image/jpeg;base64,') &&
      r.nbFiguresTout === 2 && r.figsTout.some((t) => t.includes('Ordonnance récente')) &&
      r.txtAnnexeVide.includes('Aucun document joint') && r.nbAnnexeVideImgs === 0,
      'Annexe photo respecte la période et imageValide() en ignorant toute URL ou SVG non sûr',
      { nbFigures12m: r.nbFigures12m, nbFiguresTout: r.nbFiguresTout }
    );
    verifier(
      printCss.carnetDisplay === 'block' && printCss.principalDisplay === 'none' &&
      printCss.figBreakInside === 'avoid' && printCss.imgBreakInside === 'avoid' &&
      printCss.imgMaxHeight !== 'none' &&
      r.debordements.length === 0,
      'impression.css isole #carnet avec break-inside: avoid sur l’annexe, et zéro débordement à 390px en tresgrand sur les 3 thèmes',
      { printCss, debordements: r.debordements }
    );
  });

  await section('M4B — Non-régression BUG-M4B-1 (course pastilles/changerSection) et BUG-M4B-2 (NOMS_SEXE)', async () => {
    const r = await p.evaluate(async () => {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      const auj = Dates.aujourdhui();
      const hier = Dates.ajouterJours(auj, -1);
      const demain = Dates.ajouterJours(auj, 1);
      const passe = Dates.ajouterJours(auj, -60);

      await BD.enregistrer('animaux', { id: 'a_race', nom: 'Vif', espece: 'Chat', unitePoids: 'kg', archive: false });
      await BD.enregistrer('vaccins', { id: 'vr1', animalId: 'a_race', nom: 'Coryza', date: passe, rappel: hier });
      await BD.enregistrer('taches', { id: 'tkr1', animalId: 'a_race', titre: 'Pesée mensuelle', echeance: auj, fait: false });

      const origLirePastilles = EcranAnimal._lirePastilles.bind(EcranAnimal);

      // 1. BUG-M4B-1a : changerSection() pendant _lirePastilles() lors de afficher()
      let resAffPastilles;
      let signAffDemarre;
      const promAffDemarre = new Promise((ok) => { signAffDemarre = ok; });
      const promAffDebloque = new Promise((ok) => { resAffPastilles = ok; });
      EcranAnimal._lirePastilles = async (a) => {
        const val = await origLirePastilles(a);
        signAffDemarre();
        await promAffDebloque;
        return val;
      };
      const promAff = EcranAnimal.afficher('a_race', 'identite');
      await promAffDemarre;
      await EcranAnimal.changerSection('poids');
      const sectionPendantAff = EcranAnimal.section;
      resAffPastilles();
      await promAff;
      EcranAnimal._lirePastilles = origLirePastilles;
      const dotsApresChangerDansAff = document.querySelectorAll('#animal-sections .pastille-section').length;

      // 2. BUG-M4B-1b : changerSection() pendant _lirePastilles() lors de rafraichir() après résolution des rappels
      await BD.enregistrer('vaccins', { id: 'vr1', animalId: 'a_race', nom: 'Coryza', date: auj, rappel: demain });
      await BD.enregistrer('taches', { id: 'tkr1', animalId: 'a_race', titre: 'Pesée mensuelle', echeance: auj, fait: true });

      let resRafPastilles;
      let signRafDemarre;
      const promRafDemarre = new Promise((ok) => { signRafDemarre = ok; });
      const promRafDebloque = new Promise((ok) => { resRafPastilles = ok; });
      EcranAnimal._lirePastilles = async (a) => {
        const val = await origLirePastilles(a);
        signRafDemarre();
        await promRafDebloque;
        return val;
      };
      const promRaf = EcranAnimal.rafraichir();
      await promRafDemarre;
      await EcranAnimal.changerSection('identite');
      const sectionPendantRaf = EcranAnimal.section;
      resRafPastilles();
      await promRaf;
      EcranAnimal._lirePastilles = origLirePastilles;
      const dotsApresChangerDansRaf = document.querySelectorAll('#animal-sections .pastille-section').length;

      // 3. BUG-M4B-1c : une ancienne lecture _lirePastilles() plus lente ne doit pas écraser un rafraichir() plus récent
      await BD.enregistrer('vaccins', { id: 'vr1', animalId: 'a_race', nom: 'Coryza', date: passe, rappel: hier });
      await EcranAnimal.rafraichir();
      const dotsAvantCourse = document.querySelectorAll('#animal-sections .pastille-section').length;

      let resAncienLire;
      let signAncienDemarre;
      const promAncienDemarre = new Promise((ok) => { signAncienDemarre = ok; });
      const promAncienDebloque = new Promise((ok) => { resAncienLire = ok; });
      let appelNum = 0;
      EcranAnimal._lirePastilles = async (a) => {
        appelNum++;
        const val = await origLirePastilles(a);
        if (appelNum === 1) {
          signAncienDemarre();
          await promAncienDebloque;
        }
        return val;
      };
      const promRafAncien = EcranAnimal.rafraichir();
      await promAncienDemarre;
      await BD.enregistrer('vaccins', { id: 'vr1', animalId: 'a_race', nom: 'Coryza', date: auj, rappel: demain });
      await EcranAnimal.rafraichir();
      const dotsApresRafRecent = document.querySelectorAll('#animal-sections .pastille-section').length;
      resAncienLire();
      await promRafAncien;
      EcranAnimal._lirePastilles = origLirePastilles;
      const dotsApresFinAncienRaf = document.querySelectorAll('#animal-sections .pastille-section').length;

      // 4. BUG-M4B-2 : sexe corrompu 'toString' en IDB ne doit jamais rendre 'function toString'
      const tx = await BD._transaction('animaux', 'readwrite');
      tx.objectStore('animaux').put({ id: 'a_proto_sexe', nom: 'Corrompu', espece: 'Chat', sexe: 'toString', unitePoids: 'kg', archive: false });
      await BD.finTransaction(tx);

      await EcranAnimal.afficher('a_proto_sexe', 'identite');
      await new Promise((ok) => setTimeout(ok, 80));
      const txtIdentiteProto = document.querySelector('#animal-contenu')?.textContent || '';
      const txtPerduProto = EcranAnimal.texteAnimalPerdu(await BD.lire('animaux', 'a_proto_sexe'), null, auj);

      const origPrint = window.print;
      window.print = () => {};
      await EcranAnimal.imprimerCarnet(await BD.lire('animaux', 'a_proto_sexe'));
      const txtCarnetProto = document.querySelector('#carnet')?.textContent || '';
      window.dispatchEvent(new Event('afterprint'));
      window.print = origPrint;

      // 5. BUG-M4B-3 : un rafraichir() #1 ralenti dans BD.lire ne doit pas écraser EcranAnimal.animal après un rafraichir() #2 plus récent
      await BD.enregistrer('animaux', { id: 'a_bug3', nom: 'Alfa', espece: 'Chat', unitePoids: 'kg', archive: false });
      await EcranAnimal.afficher('a_bug3', 'identite');

      const origBdLire = BD.lire.bind(BD);
      let resLire1;
      let signLire1Pause;
      const promLire1Pause = new Promise((ok) => { signLire1Pause = ok; });
      const promLire1Debloque = new Promise((ok) => { resLire1 = ok; });
      let intercepte = false;
      BD.lire = async (magasin, cle) => {
        const res = await origBdLire(magasin, cle);
        if (!intercepte && magasin === 'animaux' && cle === 'a_bug3') {
          intercepte = true;
          signLire1Pause();
          await promLire1Debloque;
        }
        return res;
      };
      const promRaf1Bug3 = EcranAnimal.rafraichir();
      await promLire1Pause;

      await BD.enregistrer('animaux', { id: 'a_bug3', nom: 'Alfa-Modifie', espece: 'Chat', unitePoids: 'kg', archive: false });
      await EcranAnimal.rafraichir();
      const nomApresRaf2 = EcranAnimal.animal ? EcranAnimal.animal.nom : '';

      resLire1();
      await promRaf1Bug3;
      BD.lire = origBdLire;
      const nomApresRaf1 = EcranAnimal.animal ? EcranAnimal.animal.nom : '';

      await EcranAnimal.changerSection('poids');
      await EcranAnimal.changerSection('identite');
      const domIdentiteBug3 = document.querySelector('#animal-contenu')?.textContent || '';

      // Vérifie également que changerSection() pendant un seul BD.lire() n'empêche pas rafraichir() de mettre à jour this.animal
      await BD.enregistrer('animaux', { id: 'a_bug3', nom: 'Alfa-Section', espece: 'Chat', unitePoids: 'kg', archive: false });
      let resLireSingle;
      let signLireSinglePause;
      const promLireSinglePause = new Promise((ok) => { signLireSinglePause = ok; });
      const promLireSingleDebloque = new Promise((ok) => { resLireSingle = ok; });
      let intercepteSingle = false;
      BD.lire = async (magasin, cle) => {
        const res = await origBdLire(magasin, cle);
        if (!intercepteSingle && magasin === 'animaux' && cle === 'a_bug3') {
          intercepteSingle = true;
          signLireSinglePause();
          await promLireSingleDebloque;
        }
        return res;
      };
      const promRafSingle = EcranAnimal.rafraichir();
      await promLireSinglePause;
      await EcranAnimal.changerSection('poids');
      resLireSingle();
      await promRafSingle;
      BD.lire = origBdLire;
      const sectionApresRafSingle = EcranAnimal.section;
      const nomApresRafSingle = EcranAnimal.animal ? EcranAnimal.animal.nom : '';

      return {
        sectionPendantAff,
        dotsApresChangerDansAff,
        sectionPendantRaf,
        dotsApresChangerDansRaf,
        dotsAvantCourse,
        dotsApresRafRecent,
        dotsApresFinAncienRaf,
        nomsSexeNullProto: Object.getPrototypeOf(NOMS_SEXE) === null,
        txtIdentiteProto,
        txtPerduProto,
        txtCarnetProto,
        nomApresRaf2,
        nomApresRaf1,
        domIdentiteBug3,
        sectionApresRafSingle,
        nomApresRafSingle
      };
    });

    verifier(
      r.sectionPendantAff === 'poids' && r.dotsApresChangerDansAff === 2 &&
      r.sectionPendantRaf === 'identite' && r.dotsApresChangerDansRaf === 0,
      'BUG-M4B-1 : changerSection() pendant _lirePastilles() conserve la mise à jour des pastilles dans afficher() et rafraichir()',
      {
        sectionPendantAff: r.sectionPendantAff,
        dotsApresChangerDansAff: r.dotsApresChangerDansAff,
        sectionPendantRaf: r.sectionPendantRaf,
        dotsApresChangerDansRaf: r.dotsApresChangerDansRaf
      }
    );
    verifier(
      r.dotsAvantCourse === 1 && r.dotsApresRafRecent === 0 && r.dotsApresFinAncienRaf === 0,
      'BUG-M4B-1 : une lecture _lirePastilles() obsolète ne peut pas écraser un rafraichir() plus récent',
      {
        dotsAvantCourse: r.dotsAvantCourse,
        dotsApresRafRecent: r.dotsApresRafRecent,
        dotsApresFinAncienRaf: r.dotsApresFinAncienRaf
      }
    );
    verifier(
      r.nomsSexeNullProto &&
      !/function|toString/i.test(r.txtIdentiteProto) &&
      !/function|toString/i.test(r.txtPerduProto) &&
      !/function|toString/i.test(r.txtCarnetProto),
      'BUG-M4B-2 : NOMS_SEXE sans prototype et sexe corrompu « toString » ignoré dans identite(), texteAnimalPerdu() et #carnet',
      {
        nomsSexeNullProto: r.nomsSexeNullProto,
        identiteHasFn: /function|toString/i.test(r.txtIdentiteProto),
        carnetHasFn: /function|toString/i.test(r.txtCarnetProto)
      }
    );
    verifier(
      r.nomApresRaf2 === 'Alfa-Modifie' &&
      r.nomApresRaf1 === 'Alfa-Modifie' &&
      r.domIdentiteBug3.includes('Alfa-Modifie') &&
      r.sectionApresRafSingle === 'poids' &&
      r.nomApresRafSingle === 'Alfa-Section',
      'BUG-M4B-3 : un rafraichir() obsolète ralenti dans BD.lire ne réverte pas EcranAnimal.animal tout en préservant changerSection() pendant BD.lire',
      {
        nomApresRaf2: r.nomApresRaf2,
        nomApresRaf1: r.nomApresRaf1,
        domHasModifie: r.domIdentiteBug3.includes('Alfa-Modifie'),
        sectionApresRafSingle: r.sectionApresRafSingle,
        nomApresRafSingle: r.nomApresRafSingle
      }
    );
  });

  await ctx.close();
});
