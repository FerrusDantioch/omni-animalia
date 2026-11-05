/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests automatiques d'Omni-Animaux.
   Ils ouvrent l'application dans un vrai navigateur (Chromium, piloté
   par Playwright), comme sur un téléphone, et vérifient qu'elle fait
   bien ce qu'on attend. Rien n'est envoyé sur internet.

   Lancer (Playwright doit être installé) :  node tests/tester.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { lancer, section, verifier, nouvellePage, controlesCommuns, RACINE } = require('./outils.js');

const PARIS = { timezoneId: 'Europe/Paris' };
const pause = (p, ms) => p.waitForTimeout(ms || 400);
const texte = (p, sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim());

/* Clique sur un bouton de la fenêtre de confirmation, d'après son texte */
async function repondre(p, libelle) {
  await p.locator('#dialogue[open] button', { hasText: libelle }).first().click();
  await pause(p);
}

/* Ouvre l'application et ferme le message de bienvenue */
async function ouvrir(options) {
  const r = await nouvellePage({ ...PARIS, ...(options || {}) });
  await r.p.waitForSelector('#dialogue[open]', { timeout: 5000 });
  await repondre(r.p, 'J’ai compris');
  return r;
}

/* Remplit un champ de formulaire (« nom » = attribut name) */
async function remplir(p, nom, valeur) {
  await p.fill('#formulaire-zone [name="' + nom + '"]', valeur);
}
async function enregistrer(p) {
  await p.click('#formulaire-zone button[type="submit"]');
  await pause(p, 600);
}

lancer('Omni-Animaux', async () => {
  await controlesCommuns({ serviceWorker: 'sw.js' });

  await section('Manifest et icônes', async () => {
    const m = JSON.parse(fs.readFileSync(path.join(RACINE, 'manifest.json'), 'utf8'));
    verifier(m.name && m.short_name === 'Omni-Animaux', 'nom et nom court');
    verifier(m.lang === 'fr' && m.display === 'standalone', 'langue fr, affichage standalone');
    verifier(m.id === '/omni-animalia/', 'identifiant propre à l’application', m.id);
    verifier(/^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color), 'couleurs définies');
    const lirePng = (f) => { const b = fs.readFileSync(path.join(RACINE, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    for (const ic of m.icons.filter((i) => i.type === 'image/png')) {
      const [l, h] = lirePng(ic.src);
      verifier(ic.sizes === l + 'x' + h, 'icône ' + ic.src + ' : ' + ic.sizes, [l, h]);
    }
    verifier(m.icons.some((i) => i.purpose === 'maskable'), 'une icône « maskable »');
  });

  const { ctx, p } = await ouvrir();

  await section('Calcul des dates et de l’âge (outil-dates.js)', async () => {
    const r = await p.evaluate(() => ({
      fr: Dates.fr('2026-03-07'),
      invalide: Dates.estValide('2026-02-30'),
      bissextile: Dates.estValide('2024-02-29'),
      heureEte: Dates.ecartJours('2026-03-28', '2026-03-30'),
      heureHiver: Dates.ecartJours('2026-10-24', '2026-10-26'),
      age1: Dates.age('2023-09-05', false, '2026-11-05'),
      age2: Dates.age('2026-09-10', false, '2026-11-05'),
      age3: Dates.age('2026-10-30', false, '2026-11-05'),
      age4: Dates.age('2026-01-15', true, '2026-11-05'),
      age5: Dates.age('2025-11-05', false, '2026-11-05'),
      age6: Dates.age('2024-01-31', false, '2024-02-29'),
      ageFutur: Dates.age('2027-01-01', false, '2026-11-05'),
      mois31: Dates.ajouterMois('2026-01-31', 1, 31),
      mois31b: Dates.ajouterMois('2026-02-28', 1, 31),
      an29: Dates.ajouterIntervalle('2024-02-29', 1, 'ans', 29),
      semaines: Dates.ajouterIntervalle('2026-12-28', 2, 'semaines'),
      prochaine: Dates.prochaineEcheance('2026-10-01', 1, 'semaines', 1, '2026-11-05'),
      relatif: [Dates.relatif('2026-11-05', '2026-11-05'), Dates.relatif('2026-11-08', '2026-11-05'), Dates.relatif('2026-11-02', '2026-11-05')]
    }));
    verifier(r.fr === '07/03/2026', 'format français jj/mm/aaaa', r.fr);
    verifier(!r.invalide && r.bissextile, 'le 30 février est refusé, le 29/02/2024 accepté');
    verifier(r.heureEte === 2 && r.heureHiver === 2, 'changements d’heure sans décalage de jour', [r.heureEte, r.heureHiver]);
    verifier(r.age1 === '3 ans et 2 mois', 'âge : 3 ans et 2 mois', r.age1);
    verifier(r.age2 === '8 semaines', 'âge : 8 semaines', r.age2);
    verifier(r.age3 === '6 jours', 'âge : 6 jours', r.age3);
    verifier(r.age4 === 'environ 9 mois', 'date approximative : « environ 9 mois »', r.age4);
    verifier(r.age5 === '1 an', 'âge : 1 an pile', r.age5);
    verifier(r.age6 === '4 semaines', 'né un 31 : âge juste en fin de février', r.age6);
    verifier(r.ageFutur === '', 'naissance dans le futur : pas d’âge');
    verifier(r.mois31 === '2026-02-28' && r.mois31b === '2026-03-31', 'tous les mois depuis le 31 : 28/02 puis 31/03', [r.mois31, r.mois31b]);
    verifier(r.an29 === '2025-02-28', 'tous les ans depuis le 29/02', r.an29);
    verifier(r.semaines === '2027-01-11', 'changement d’année', r.semaines);
    verifier(r.prochaine === '2026-11-12', 'tâche cochée en retard : prochaine date après aujourd’hui', r.prochaine);
    verifier(r.relatif.join('|') === 'aujourd’hui|dans 3 jours|en retard de 3 jours', 'distances en toutes lettres', r.relatif);
  });

  await section('Calcul des rappels (outil-rappels.js)', async () => {
    const r = await p.evaluate(() => {
      const d = {
        animaux: [{ id: 'a', nom: 'A' }, { id: 'b', nom: 'B', archive: true }],
        vaccins: [
          { id: 'v1', animalId: 'a', nom: 'Rage', date: '2025-01-01', rappel: '2026-01-01' },
          { id: 'v2', animalId: 'a', nom: 'rage ', date: '2026-01-02', rappel: '2026-11-10' },
          { id: 'v3', animalId: 'b', nom: 'Rage', date: '2025-01-01', rappel: '2026-01-01' }],
        antiparasitaires: [{ id: 'p1', animalId: 'a', type: 'vermifuge', date: '2026-08-01', prochaine: '2026-11-01' }],
        traitements: [{ id: 't1', animalId: 'a', nom: 'X', statut: 'en-cours', fin: '2026-11-05' }, { id: 't2', animalId: 'a', nom: 'Y', statut: 'termine', fin: '2026-11-06' }],
        rdv: [{ id: 'r1', animalId: 'a', date: '2026-12-01', motif: 'M' }, { id: 'r2', animalId: 'a', date: '2026-10-01', motif: 'Passé' }],
        taches: [{ id: 'k1', animalId: 'a', titre: 'T', echeance: '2026-11-20', fait: false }, { id: 'k2', animalId: 'a', titre: 'Faite', echeance: '2026-11-01', fait: true }],
        veterinaires: [], pesees: [], notes: []
      };
      const liste = Rappels.calculer(d, '2026-11-05');
      const g = Rappels.grouper(liste);
      return { ids: liste.map((x) => x.id), g: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((x) => x.id)])), compte: Rappels.compterParAnimal(liste) };
    });
    verifier(!r.ids.includes('v1'), 'un vaccin renouvelé ne compte plus');
    verifier(!r.ids.includes('v3'), 'un animal archivé ne donne pas de rappel');
    verifier(!r.ids.includes('t2') && !r.ids.includes('r2') && !r.ids.includes('k2'), 'traitement fini, rendez-vous passé, tâche faite : ignorés');
    verifier(r.g.retard.join() === 'p1' && r.g.aujourdhui.join() === 't1' && r.g.semaine.join() === 'v2' && r.g.mois.join() === 'k1,r1', 'groupes : retard / aujourd’hui / 7 jours / 30 jours', r.g);
    verifier(r.compte.a.retard === 1 && r.compte.a.bientot === 2, 'badges : 1 en retard, 2 bientôt', r.compte.a);
  });

  await section('Ajouter un animal (formulaire et vérifications)', async () => {
    await p.click('#accueil-actions button');                // « Ajouter un animal »
    await pause(p);
    await enregistrer(p);                                     // formulaire vide
    verifier(await p.isVisible('#formulaire-erreurs'), 'formulaire vide : erreurs affichées');
    verifier((await texte(p, '[data-champ="nom"] .message-erreur')) === 'Ce champ est obligatoire.', 'message clair sous le nom');
    verifier((await p.getAttribute('#champ-nom', 'aria-invalid')) === 'true', 'le champ est marqué invalide (ARIA)');

    const piege = '<img src=x onerror="window.__pirate=1">Rex';
    await remplir(p, 'nom', piege);
    await remplir(p, 'espece', 'Chien');
    await remplir(p, 'naissance', '2099-01-01');
    await enregistrer(p);
    verifier((await texte(p, '[data-champ="naissance"] .message-erreur')).includes('futur'), 'naissance dans le futur refusée');
    await remplir(p, 'naissance', Dates_moins(400));
    await p.check('#champ-sterilise');
    await remplir(p, 'dateSterilisation', Dates_moins(500));
    await enregistrer(p);
    verifier((await texte(p, '[data-champ="dateSterilisation"] .message-erreur')).includes('avant la naissance'), 'stérilisation avant la naissance refusée');
    await remplir(p, 'dateSterilisation', Dates_moins(100));
    await remplir(p, 'puce', '250 2696 0000 0001');
    await p.check('#champ-unitePoids-0');
    await enregistrer(p);
    verifier(await p.isVisible('[data-vue="accueil"]'), 'retour à l’accueil après enregistrement');
    const titre = await texte(p, '#accueil-liste .carte-titre');
    verifier(titre === piege, 'le nom s’affiche tel quel, comme du texte', titre);
    verifier(!(await p.evaluate(() => window.__pirate)), 'le code tapé dans un nom ne s’exécute jamais');
    verifier((await p.$$('#accueil-liste img[src="x"]')).length === 0, 'aucune balise injectée');
    verifier((await texte(p, '#accueil-liste .carte-animal')).includes('Âge : 1 an'), 'âge calculé tout seul', await texte(p, '#accueil-liste .carte-animal'));
  });

  await section('Poids, courbe et variation', async () => {
    await p.click('#accueil-liste .carte-animal');
    await pause(p);
    await p.click('[data-section="poids"]');
    await pause(p);
    for (const [jours, kg] of [[60, '12,5'], [30, '13']]) {
      await p.click('#animal-contenu button.principal');
      await pause(p);
      await remplir(p, 'date', Dates_moins(jours));
      await remplir(p, 'valeur', kg);
      await enregistrer(p);
    }
    // Un poids négatif est refusé
    await p.click('#animal-contenu button.principal');
    await pause(p);
    await remplir(p, 'valeur', '-3');
    await enregistrer(p);
    verifier(await p.isVisible('[data-champ="valeur"] .message-erreur'), 'poids négatif refusé');
    await p.click('#formulaire-zone .formulaire-boutons button.secondaire');   // Annuler
    await pause(p, 600);
    verifier(await p.isVisible('[data-vue="animal"]'), '« Annuler » ramène à la fiche');
    verifier((await p.$$('.graphique .point')).length === 2, 'deux points sur la courbe');
    verifier((await p.$$('.graphique .courbe')).length === 1, 'une ligne entre les points');
    const variation = await texte(p, '#animal-contenu .carte-fiche');
    verifier(variation.includes('+0,5 kg'), 'variation : +0,5 kg', variation);
  });

  await section('Tâche répétée : la suivante est créée', async () => {
    await p.click('[data-section="taches"]');
    await pause(p);
    await p.click('#animal-contenu button.principal');
    await pause(p);
    await remplir(p, 'titre', 'Couper les griffes');
    await remplir(p, 'echeance', '2026-01-31');
    await p.check('#champ-repete-1');
    await pause(p, 200);
    await remplir(p, 'recN', '1');
    await p.selectOption('#champ-recUnite', 'mois');
    await enregistrer(p);
    await p.locator('#animal-contenu button', { hasText: 'Marquer comme fait' }).first().click();
    await pause(p, 700);
    const taches = await p.evaluate(async () => (await BD.tout('taches')).map((t) => ({ e: t.echeance, f: t.fait, s: !!t.suivanteId })));
    const attendue = await p.evaluate(() => Dates.prochaineEcheance('2026-01-31', 1, 'mois', 31, Dates.aujourdhui()));
    verifier(taches.length === 2, 'deux tâches : la faite et la suivante', taches);
    verifier(taches.some((t) => t.f && t.s) && taches.some((t) => !t.f && t.e === attendue), 'la suivante tombe le ' + attendue, taches);
    // Annuler « fait » retire la suivante
    await p.locator('#animal-contenu button', { hasText: 'Annuler « fait »' }).first().click();
    await pause(p, 700);
    const apres = await p.evaluate(async () => (await BD.tout('taches')).length);
    verifier(apres === 1, 'annuler « fait » retire la tâche suivante', apres);
  });

  await section('Photo réduite automatiquement', async () => {
    await p.click('[data-section="identite"]');
    await pause(p);
    await p.locator('#animal-contenu button', { hasText: 'Modifier l’identité' }).click();
    await pause(p);
    // Fabrique une grande image de 2000 × 1500 pixels
    const donnees = await p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 2000; c.height = 1500;
      const x = c.getContext('2d'); x.fillStyle = '#884'; x.fillRect(0, 0, 2000, 1500);
      return c.toDataURL('image/png').split(',')[1];
    });
    const champs = await p.$$('.champ-photo-zone input[type=file]');
    await champs[1].setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.from(donnees, 'base64') });
    await p.waitForFunction(() => document.querySelector('[name="photo"]').value.startsWith('data:image/jpeg'));
    const taille = await p.evaluate(() => new Promise((ok) => {
      const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = document.querySelector('[name="photo"]').value;
    }));
    verifier(taille[0] === 800 && taille[1] === 600, 'photo ramenée à 800 × 600 en JPEG', taille);
    await enregistrer(p);
    verifier(await p.isVisible('#animal-resume img.vignette'), 'la photo apparaît sur la fiche');
  });

  await section('Copier le numéro de puce', async () => {
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.locator('#animal-contenu button', { hasText: 'Copier' }).first().click();
    await pause(p);
    const copie = await p.evaluate(() => navigator.clipboard.readText());
    verifier(copie === '250 2696 0000 0001', 'numéro copié', copie);
  });

  await section('Carnet de santé imprimable', async () => {
    await p.evaluate(() => { window.__imprime = 0; window.print = () => { window.__imprime++; }; });
    await p.locator('#animal-contenu button', { hasText: 'Carnet de santé' }).click();
    await pause(p);
    verifier(await p.evaluate(() => window.__imprime) === 1, 'la fenêtre d’impression est demandée');
    const carnet = await p.evaluate(() => document.querySelector('#carnet').textContent);
    verifier(carnet.includes('Carnet de santé') && carnet.includes('13 kg') && carnet.includes('Vaccins'), 'le carnet contient identité, poids, vaccins');
    await p.emulateMedia({ media: 'print' });
    const visibles = await p.evaluate(() => ({
      carnet: getComputedStyle(document.querySelector('#carnet')).display,
      app: getComputedStyle(document.querySelector('#principal')).display
    }));
    verifier(visibles.carnet === 'block' && visibles.app === 'none', 'à l’impression, seul le carnet apparaît', visibles);
    await p.emulateMedia({ media: 'screen' });
  });

  await section('Archiver puis restaurer un animal', async () => {
    await p.locator('#animal-contenu button', { hasText: 'Archiver cet animal' }).click();
    await pause(p);
    await p.check('#champ-motif-1');
    await enregistrer(p);
    verifier((await texte(p, '#animal-resume')).includes('Animal archivé (confié)'), 'la fiche indique « archivé »');
    await p.click('[data-onglet="accueil"]');
    await pause(p, 600);
    verifier((await p.$$('#accueil-liste .carte-animal')).length === 0, 'il quitte la liste principale');
    await p.locator('#accueil-actions button', { hasText: 'archivés' }).click();
    await pause(p, 600);
    await p.locator('#archives-liste button', { hasText: 'Restaurer' }).click();
    await repondre(p, 'Restaurer');
    await p.click('[data-onglet="accueil"]');
    await pause(p, 600);
    verifier((await p.$$('#accueil-liste .carte-animal')).length === 1, 'restauré : de retour dans la liste');
  });

  let fichierSauvegarde;
  await section('Sauvegarde puis restauration', async () => {
    await p.click('[data-onglet="reglages"]');
    await pause(p, 600);
    const [telechargement] = await Promise.all([p.waitForEvent('download'), p.click('#bouton-sauvegarder')]);
    fichierSauvegarde = await telechargement.path();
    const contenu = JSON.parse(fs.readFileSync(fichierSauvegarde, 'utf8'));
    verifier(contenu.format === 'omni-animaux-sauvegarde' && contenu.versionFormat === 1, 'fichier avec format et numéro de version');
    verifier(contenu.donnees.animaux.length === 1 && contenu.donnees.pesees.length === 2, 'animal et pesées dans le fichier');
    verifier(contenu.donnees.animaux[0].photo.startsWith('data:image/jpeg'), 'photo incluse');
    verifier(/^omni-animaux-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(telechargement.suggestedFilename()), 'nom du fichier daté', telechargement.suggestedFilename());

    // Tout supprimer (deux confirmations, la seconde en tapant SUPPRIMER)
    await p.locator('#reglages-contenu button', { hasText: 'Supprimer toutes les données' }).click();
    await repondre(p, 'Continuer');
    const desactive = await p.locator('#dialogue[open] button', { hasText: 'Tout supprimer' }).isDisabled();
    verifier(desactive, 'il faut taper SUPPRIMER pour valider');
    await p.fill('#dialogue-saisie', 'supprimer');
    await repondre(p, 'Tout supprimer');
    verifier(await p.evaluate(async () => (await BD.tout('animaux')).length) === 0, 'toutes les données effacées');

    // Fichier invalide : refusé avec un message clair
    await p.setInputFiles('#fichier-import', { name: 'faux.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"autre"}') });
    await p.waitForSelector('#dialogue[open]');
    verifier((await texte(p, '#dialogue')).includes('n’est pas une sauvegarde d’Omni-Animaux'), 'fichier étranger refusé');
    await repondre(p, 'J’ai compris');
    const abime = JSON.parse(JSON.stringify(contenu));
    abime.donnees.pesees[0].date = '2026-13-45';
    await p.setInputFiles('#fichier-import', { name: 'abime.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(abime)) });
    await p.waitForSelector('#dialogue[open]');
    verifier((await texte(p, '#dialogue')).includes('abîmée'), 'fichier abîmé refusé', await texte(p, '#dialogue'));
    await repondre(p, 'J’ai compris');

    // Restauration « remplacer »
    await p.setInputFiles('#fichier-import', fichierSauvegarde);
    await p.waitForSelector('#dialogue[open]');
    await repondre(p, 'Remplacer');
    await repondre(p, 'Remplacer');
    await pause(p, 600);
    const n = await p.evaluate(async () => [(await BD.tout('animaux')).length, (await BD.tout('pesees')).length]);
    verifier(n[0] === 1 && n[1] === 2, 'restauration : animal et pesées revenus', n);

    // Restauration « fusionner » : pas de doublon
    await p.setInputFiles('#fichier-import', fichierSauvegarde);
    await p.waitForSelector('#dialogue[open]');
    await repondre(p, 'Fusionner');
    await pause(p, 600);
    const n2 = await p.evaluate(async () => (await BD.tout('animaux')).length);
    verifier(n2 === 1, 'fusion de la même sauvegarde : aucun doublon', n2);
  });

  await section('Exemple de démonstration', async () => {
    await p.click('#bouton-exemple');
    await pause(p, 700);
    verifier(await p.evaluate(async () => (await BD.tout('animaux')).length) === 3, 'exemple chargé (chien + chat)');
    await p.click('#bouton-exemple');
    await repondre(p, 'Supprimer l’exemple');
    await pause(p, 600);
    const restants = await p.evaluate(async () => (await BD.tout('animaux')).map((a) => a.exemple || false));
    verifier(restants.length === 1 && !restants[0], 'exemple retiré, vraies données intactes', restants);
  });

  await section('Thèmes', async () => {
    for (const t of ['clair', 'sombre', 'omni']) {
      await p.check('input[name="reglage-theme"][value="' + t + '"]');
      await pause(p, 200);
      verifier(await p.evaluate(() => document.documentElement.dataset.theme) === t, 'thème ' + t + ' appliqué');
    }
  });

  await section('Mot de passe', async () => {
    await p.locator('#reglages-contenu button', { hasText: 'Activer un mot de passe' }).click();
    await pause(p);
    await remplir(p, 'nouveau', 'chat-1234');
    await remplir(p, 'confirmation', 'chat-9999');
    await enregistrer(p);
    verifier(await p.isVisible('[data-champ="confirmation"] .message-erreur'), 'deux mots de passe différents : refusé');
    await remplir(p, 'confirmation', 'chat-1234');
    await enregistrer(p);
    const stocke = await p.evaluate(async () => JSON.stringify(await BD.reglage('motDePasse')));
    verifier(!stocke.includes('chat-1234') && /"sel":"[0-9a-f]{32}"/.test(stocke), 'seule une empreinte salée est enregistrée');
    await p.reload();
    await p.waitForSelector('#verrou:not([hidden])');
    verifier(await p.isHidden('#principal'), 'au redémarrage, l’application est verrouillée');
    await p.fill('#verrou-mdp', 'mauvais');
    await p.click('#verrou-form button[type=submit]');
    await pause(p, 800);
    verifier(await p.isVisible('#verrou-erreur'), 'mauvais mot de passe : refusé');
    await p.fill('#verrou-mdp', 'chat-1234');
    await p.click('#verrou-form button[type=submit]');
    await pause(p, 1000);
    verifier(await p.isVisible('#principal'), 'bon mot de passe : application ouverte');
    // Désactivation (le mot de passe actuel est demandé)
    await p.click('[data-onglet="reglages"]');
    await pause(p, 500);
    await p.locator('#reglages-contenu button', { hasText: 'Désactiver le mot de passe' }).click();
    await pause(p);
    await remplir(p, 'actuel', 'chat-1234');
    await enregistrer(p);
    verifier(await p.evaluate(async () => !(await BD.reglage('motDePasse', null))), 'mot de passe désactivé');
  });

  await section('Vétérinaires', async () => {
    await p.click('[data-onglet="veterinaires"]');
    await pause(p, 500);
    await p.click('#vetos-actions button');
    await pause(p);
    await remplir(p, 'nom', 'Dr Durand');
    await remplir(p, 'telephone', 'abc');
    await enregistrer(p);
    verifier(await p.isVisible('[data-champ="telephone"] .message-erreur'), 'numéro de téléphone invalide refusé');
    await remplir(p, 'telephone', '01 23 45 67 89');
    await enregistrer(p);
    verifier((await p.getAttribute('#vetos-liste a.lien-tel', 'href')) === 'tel:0123456789', 'lien cliquable pour appeler');
    await p.locator('#vetos-liste button', { hasText: 'Supprimer' }).click();
    verifier(await p.isVisible('#dialogue[open]'), 'la suppression demande confirmation');
    await repondre(p, 'Annuler');
    verifier((await p.$$('#vetos-liste .carte')).length === 1, '« Annuler » ne supprime rien');
  });

  await section('Bouton « retour » du téléphone', async () => {
    await p.click('[data-onglet="accueil"]');
    await pause(p, 500);
    await p.click('#accueil-liste .carte-animal');
    await pause(p, 500);
    await p.click('[data-section="vaccins"]');
    await pause(p, 500);
    verifier(p.url().endsWith('/vaccins'), 'l’adresse suit la partie ouverte', p.url());
    await p.goBack();
    await pause(p, 600);
    verifier(await p.isVisible('[data-vue="accueil"]'), 'retour : on revient à l’accueil');
  });

  /* ---------- Améliorations de la version 1.2.0 ---------- */

  // Faux menu « Partager » d'Android : on garde les fichiers envoyés
  async function fauxPartage(refuser) {
    await p.evaluate((refuser) => {
      window.__partages = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => {
        if (refuser) { const e = new Error('annulé'); e.name = 'AbortError'; throw e; }
        const f = d.files[0];
        window.__partages.push({ nom: f.name, type: f.type, texte: await f.text() });
      } });
      window.open = (u) => { window.__ouvert = u; return null; };
    }, !!refuser);
  }
  async function ouvrirAnimal(partie) {
    await p.click('[data-onglet="accueil"]');
    await pause(p, 500);
    await p.click('#accueil-liste .carte-animal');
    await pause(p, 500);
    if (partie) { await p.click('[data-section="' + partie + '"]'); await pause(p, 500); }
  }

  await section('Fichier d’agenda (.ics) et lien Google Agenda', async () => {
    const r = await p.evaluate(() => {
      const ics = Agenda.ics([
        { uid: 'x', titre: 'Rex : vaccin, rappel; test', description: 'ligne1\nligne2', date: '2026-11-25', heure: '17:30' },
        { uid: 'y', titre: 'Très long titre '.repeat(12) + 'é', date: '2026-12-31', heure: '' }]);
      return {
        ics,
        octets: ics.split('\r\n').map((l) => new TextEncoder().encode(l).length),
        google: Agenda.lienGoogle({ titre: 'A', date: '2026-11-25', heure: '23:30' }),
        googleJour: Agenda.lienGoogle({ titre: 'A', date: '2026-12-31', heure: '' })
      };
    });
    verifier(r.ics.startsWith('BEGIN:VCALENDAR\r\n') && r.ics.endsWith('END:VCALENDAR\r\n'), 'fichier .ics bien formé (fins de ligne CRLF)');
    verifier(r.ics.includes('DTSTART:20261125T173000') && r.ics.includes('DTEND:20261125T183000'), 'rendez-vous à l’heure locale, durée 1 h');
    verifier(r.ics.includes('DTSTART;VALUE=DATE:20261231') && r.ics.includes('DTEND;VALUE=DATE:20270101'), 'rappel « toute la journée », passage d’année');
    verifier(r.ics.includes('SUMMARY:Rex : vaccin\\, rappel\\; test') && r.ics.includes('DESCRIPTION:ligne1\\nligne2'), 'caractères spéciaux protégés');
    verifier(r.ics.includes('TRIGGER:-P1D') && r.ics.includes('TRIGGER:-PT1H'), 'alertes la veille et une heure avant');
    verifier(Math.max(...r.octets) <= 75, 'lignes de 75 octets au plus', Math.max(...r.octets));
    verifier(r.google.includes('dates=20261125T233000%2F20261126T003000'), 'Google Agenda : rendez-vous de 23 h 30 qui finit le lendemain', r.google);
    verifier(r.googleJour.includes('dates=20261231%2F20270101'), 'Google Agenda : journée entière');
  });

  await section('Sauvegarde partagée (Drive, e-mail…)', async () => {
    await fauxPartage(false);
    await p.click('[data-onglet="reglages"]');
    await pause(p, 500);
    await p.evaluate(() => BD.definirReglage('derniereSauvegarde', null));
    await p.click('#bouton-sauvegarder');
    await p.waitForSelector('#dialogue[open]');
    await repondre(p, 'Partager');
    await pause(p, 600);
    const envoi = await p.evaluate(() => window.__partages[0]);
    verifier(envoi && /^omni-animaux-sauvegarde-.*\.json$/.test(envoi.nom) && JSON.parse(envoi.texte).format === 'omni-animaux-sauvegarde', 'le fichier de sauvegarde part dans le menu Partager', envoi && envoi.nom);
    verifier(await p.evaluate(async () => (await BD.reglage('derniereSauvegarde')) === Dates.aujourdhui()), 'date de dernière sauvegarde mise à jour');
    await fauxPartage(true);
    await p.evaluate(() => BD.definirReglage('derniereSauvegarde', '2020-01-01'));
    await p.click('#bouton-sauvegarder');
    await p.waitForSelector('#dialogue[open]');
    await repondre(p, 'Partager');
    await pause(p, 600);
    verifier((await texte(p, '#annonce')).includes('Partage annulé'), 'menu fermé sans choisir : message clair');
    verifier(await p.evaluate(async () => (await BD.reglage('derniereSauvegarde')) === '2020-01-01'), 'partage annulé : pas compté comme une sauvegarde');
  });

  await section('Rendez-vous : frais par année et ajout à l’agenda', async () => {
    await fauxPartage(false);
    await ouvrirAnimal('rdv');
    const anneeDerniere = (new Date().getFullYear() - 1) + '-06-15';
    const demain = await p.evaluate(() => Dates.ajouterJours(Dates.aujourdhui(), 1));
    for (const [date, heure, motif, cout] of [[anneeDerniere, '09:00', 'Vaccins', '40'], [demain, '17:30', 'Contrôle', '25,5']]) {
      await p.click('#animal-contenu button.principal');
      await pause(p);
      await remplir(p, 'date', date);
      await remplir(p, 'heure', heure);
      await remplir(p, 'motif', motif);
      await remplir(p, 'veterinaire', 'Dr Durand');
      await remplir(p, 'cout', cout);
      await enregistrer(p);
    }
    const frais = await texte(p, '#animal-contenu .encart.frais');
    verifier(frais.includes(String(new Date().getFullYear() - 1) + ' : 40,00 €') && frais.includes('Total : 65,50 €'), 'frais par année et total', frais);
    await p.locator('#animal-contenu button', { hasText: 'Ajouter à l’agenda' }).first().click();
    await p.waitForSelector('#dialogue[open]');
    await repondre(p, 'Fichier d’agenda');
    await pause(p, 500);
    const ics = await p.evaluate(() => window.__partages.find((x) => x.nom.endsWith('.ics')));
    verifier(ics && ics.type === 'text/calendar' && ics.texte.includes('T173000') && ics.texte.includes('Contrôle'), 'fichier d’agenda du rendez-vous partagé', ics && ics.nom);
    await p.locator('#animal-contenu button', { hasText: 'Ajouter à l’agenda' }).first().click();
    await p.waitForSelector('#dialogue[open]');
    await repondre(p, 'Google Agenda');
    const lien = await p.evaluate(() => window.__ouvert || '');
    verifier(lien.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'), 'lien Google Agenda préparé');
  });

  await section('Médicaments : cocher chaque prise', async () => {
    await ouvrirAnimal('traitements');
    await p.click('#animal-contenu button.principal');
    await pause(p);
    await remplir(p, 'nom', 'Antibiotique');
    await remplir(p, 'prisesParJour', '2');
    await enregistrer(p);
    const prises = () => texte(p, '#animal-contenu .encart.prises');
    verifier((await prises()).includes('aucune prise notée sur 2'), 'au départ : aucune prise', await prises());
    for (let i = 0; i < 2; i++) {
      await p.locator('#animal-contenu button', { hasText: 'Noter une prise maintenant' }).click();
      await pause(p, 600);
    }
    verifier((await prises()).includes('2 prises sur 2') && (await prises()).includes('Toutes les prises du jour'), 'deux prises notées, avec l’heure', await prises());
    await p.locator('#animal-contenu button', { hasText: 'Noter une prise maintenant' }).click();
    await p.waitForSelector('#dialogue[open]');
    verifier((await texte(p, '#dialogue')).includes('déjà notées'), 'une prise de trop : avertissement (double dose)');
    await repondre(p, 'Ne rien noter');
    verifier((await prises()).includes('2 prises sur 2'), '« Ne rien noter » : rien n’est ajouté');
    await p.locator('#animal-contenu button', { hasText: 'Annuler la dernière prise' }).click();
    await repondre(p, 'Retirer la prise');
    await pause(p, 400);
    verifier((await prises()).includes('1 prise sur 2'), 'dernière prise annulée', await prises());
    await p.click('[data-onglet="rappels"]');
    await pause(p, 600);
    verifier((await texte(p, '#rappels-liste')).includes('Médicaments du jour (1)'), 'la page Rappels montre les médicaments du jour');
    await p.locator('#rappels-liste .medicaments button', { hasText: 'Noter une prise maintenant' }).click();
    await pause(p, 600);
    verifier((await texte(p, '#rappels-liste .medicaments')).includes('2 prises sur 2'), 'prise notée depuis la page Rappels');
    await fauxPartage(false);
    await p.click('#bouton-agenda-tout');
    await pause(p, 500);
    const tout = await p.evaluate(() => window.__partages.find((x) => x.nom.startsWith('omni-animaux-rappels')));
    verifier(tout && (tout.texte.match(/BEGIN:VEVENT/g) || []).length >= 1, 'tous les rappels à venir dans un seul fichier d’agenda', tout && tout.nom);
  });

  await section('Documents joints aux notes', async () => {
    await ouvrirAnimal('notes');
    await p.click('#animal-contenu button.principal');
    await pause(p);
    await remplir(p, 'texte', '');
    await enregistrer(p);
    verifier((await texte(p, '[data-champ="texte"] .message-erreur')).includes('joins au moins un document'), 'note vide sans document : refusée');
    const image = await p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
      const x = c.getContext('2d'); x.fillStyle = '#ddd'; x.fillRect(0, 0, 3000, 2000); x.fillStyle = '#222'; x.font = '80px serif'; x.fillText('Ordonnance', 100, 200);
      return c.toDataURL('image/png').split(',')[1];
    });
    const buffer = Buffer.from(image, 'base64');
    const champs = await p.$$('[data-champ="pieces"] input[type=file]');
    await champs[1].setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer }, { name: 'b.png', mimeType: 'image/png', buffer }]);
    await p.waitForFunction(() => document.querySelectorAll('[data-champ="pieces"] .vignette-document').length === 2);
    const taille = await p.evaluate(() => new Promise((ok) => {
      const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = JSON.parse(document.querySelector('[name="pieces"]').value)[0];
    }));
    verifier(taille[0] === 1600 && taille[1] === 1067, 'document gardé lisible : 1600 pixels de large', taille);
    await p.locator('[data-champ="pieces"] button', { hasText: 'Retirer' }).nth(1).click();
    verifier((await p.$$('[data-champ="pieces"] .vignette-document')).length === 1, 'un document peut être retiré avant d’enregistrer');
    await enregistrer(p);
    verifier((await p.$$('#animal-contenu .vignette-document')).length === 1, 'le document apparaît dans la note');
    await p.click('#animal-contenu .vignette-document');
    await pause(p, 300);
    verifier(await p.isVisible('#visionneuse[open] .image-visionneuse'), 'toucher la vignette : document en grand');
    await p.locator('#visionneuse button', { hasText: 'Fermer' }).click();
    const sauv = await p.evaluate(async () => {
      const s = await Sauvegarde.preparer();
      const avecPiece = s.donnees.notes.filter((n) => n.pieces).length;
      const pirate = JSON.parse(JSON.stringify(s));
      pirate.donnees.notes.find((n) => n.pieces).pieces = ['https://exemple.invalid/x.jpg'];
      let refuse = false;
      try { Sauvegarde.valider(pirate); } catch (e) { refuse = e.message.includes('document'); }
      return { avecPiece, refuse };
    });
    verifier(sauv.avecPiece === 1, 'le document est inclus dans la sauvegarde');
    verifier(sauv.refuse, 'sauvegarde contenant une adresse internet à la place d’une image : refusée');
  });

  await section('Fiche de garde', async () => {
    await ouvrirAnimal('identite');
    await p.locator('#animal-contenu button', { hasText: 'Fiche de garde' }).click();
    await pause(p, 600);
    verifier(p.url().includes('#garde/'), 'écran « Fiche de garde » ouvert', p.url());
    verifier((await texte(p, '#garde-contenu')).includes('Médicaments en cours') && (await texte(p, '#garde-contenu')).includes('Antibiotique'), 'les médicaments en cours y figurent');
    await p.locator('#garde-contenu button', { hasText: 'Ajouter mon contact' }).click();
    await pause(p);
    await remplir(p, 'nom', 'Ferrus');
    await remplir(p, 'telephone', '06 00 00 00 00');
    await enregistrer(p);
    await p.locator('#garde-contenu button', { hasText: 'Ajouter des consignes' }).click();
    await pause(p);
    await remplir(p, 'consignesGarde', 'Ne sort jamais seul.');
    await enregistrer(p);
    const fiche = await texte(p, '#garde-contenu');
    verifier(fiche.includes('Propriétaire : Ferrus') && fiche.includes('Ne sort jamais seul.'), 'contact du propriétaire et consignes affichés', fiche.slice(0, 200));
    verifier((await p.getAttribute('#garde-contenu a.lien-tel', 'href')) === 'tel:0600000000', 'numéro à appeler en un toucher');
    await p.evaluate(() => { window.__imprime = 0; window.print = () => { window.__imprime++; }; });
    await p.locator('#garde-contenu button', { hasText: 'Imprimer' }).click();
    await pause(p, 400);
    verifier(await p.evaluate(() => window.__imprime === 1 && document.querySelector('#carnet .fiche-garde') !== null), 'fiche de garde imprimable');
    verifier(await p.evaluate(() => document.querySelectorAll('#carnet a').length === 0), 'sur papier, le téléphone est écrit en clair (pas de bouton)');
    await p.goBack();
    await pause(p, 500);
    verifier(await p.isVisible('[data-vue="animal"]'), 'retour : on revient à la fiche de l’animal');
  });

  await section('Taille du texte', async () => {
    await p.click('[data-onglet="reglages"]');
    await pause(p, 500);
    await p.check('input[name="reglage-taille"][value="tresgrand"]');
    await pause(p, 300);
    const t = await p.evaluate(() => ({ attr: document.documentElement.dataset.taille, px: getComputedStyle(document.documentElement).fontSize, memo: localStorage.getItem('omnianimaux_taille') }));
    verifier(t.attr === 'tresgrand' && t.px === '20px' && t.memo === 'tresgrand', 'très grand texte appliqué et mémorisé', t);
    const debords = [];
    for (const [onglet, partie] of [['accueil'], ['rappels'], ['veterinaires'], ['reglages'], ['accueil', 'identite'], ['accueil', 'traitements'], ['accueil', 'notes']]) {
      if (partie) await ouvrirAnimal(partie);
      else { await p.click('[data-onglet="' + onglet + '"]'); await pause(p, 500); }
      const d = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (d > 0) debords.push((partie || onglet) + ' : ' + d);
    }
    verifier(debords.length === 0, 'aucun écran ne déborde sur le côté en très grand texte', debords);
    await p.click('[data-onglet="reglages"]');
    await pause(p, 500);
    await p.check('input[name="reglage-taille"][value="normal"]');
  });

  await ctx.close();

  await section('Nouvelle version : proposée, jamais imposée', async () => {
    const r = await ouvrir();
    await r.p.evaluate(() => navigator.serviceWorker.ready);
    await pause(r.p, 800);
    await r.p.reload();
    await pause(r.p, 800);
    // On « publie » une nouvelle version : sw.js est modifié sur le disque
    // pendant le test, puis remis exactement comme avant (même en cas d'erreur).
    const fichierSw = path.join(RACINE, 'sw.js');
    const original = fs.readFileSync(fichierSw, 'utf8');
    const actuel = original.match(/omni-animalia-v\d+/)[0];      // le numéro en cours
    const remettre = () => fs.writeFileSync(fichierSw, original);
    process.once('exit', remettre);
    try {
      fs.writeFileSync(fichierSw, original.replace(/omni-animalia-v\d+/, 'omni-animalia-v999'));
      await r.p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await r.p.waitForSelector('#bandeau-mise-a-jour:not([hidden])', { timeout: 10000 });
      verifier(true, 'le bandeau « Nouvelle version disponible » apparaît');
      const avant = await r.p.evaluate(() => caches.keys());
      verifier(avant.includes(actuel), 'l’ancienne version reste en place tant qu’on n’a pas choisi', avant);
      await Promise.all([r.p.waitForEvent('load'), r.p.click('#maj-oui')]);
      await pause(r.p, 1000);
      const apres = await r.p.evaluate(() => caches.keys());
      verifier(apres.includes('omni-animalia-v999') && !apres.includes(actuel), '« Mettre à jour » : nouvelle version en place, ancien cache supprimé', apres);
    } finally {
      remettre();
    }
    await r.ctx.close();
  });
});

/* Une date « il y a n jours », au format AAAA-MM-JJ (heure locale) */
function Dates_moins(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
