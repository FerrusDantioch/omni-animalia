# Omni-Animaux — notes pour Claude

PWA de carnet de santé pour animaux de compagnie, en **HTML/CSS/JS pur, sans
dépendance ni compilation**, 100 % hors ligne. Application de l'Omni-système,
sœur d'Omni-Time. L'auteur est novice en programmation : commentaires en
français simple, réponses en français.

## ⚠️ Contraintes à préserver

- **Le vrai nom de l'auteur n'apparaît nulle part.** Seul le pseudonyme
  **Ferrus Dantioch** est utilisé.
- **Licence CC BY-NC-ND 4.0** : `LICENSE` est une copie de celui d'Omni-Time.
  Chaque fichier de code commence par la mention de trois lignes ; tout nouveau
  fichier la reçoit aussi.
- **Thème Omni-système : valeurs du portfolio, à l'identique** (les mêmes
  qu'Omni-Time). Sombre et Clair = gamme Bleu-gris de Cap/Refuge. `--retard` et
  `--bientot` ont été choisis pour un contraste ≥ 5:1 sur tous les fonds.
- **Tutoiement** dans l'application, comme Refuge, Cap et Omni-Time (demandé
  par l'auteur en version 1.1.0) ; vouvoiement dans LISEZMOI.md.
- **Jamais de `innerHTML`** avec du texte saisi : tout passe par `el()` /
  `textContent` (`outil-interface.js`).
- **Suppressions = fenêtre de confirmation** (`UI.confirmer`), jamais `confirm()`
  natif. Suppression définitive d'un animal (depuis les archivés) et « tout
  supprimer » = double confirmation (la seconde exige de taper SUPPRIMER).
- **Aucun calendrier vaccinal prérempli** : seulement des noms proposés en
  saisie semi-automatique (`VACCINS_COURANTS`).
- **Pas de notification** : les rappels sont calculés à l'ouverture. Pour être
  prévenu, « Ajouter à l'agenda » (`outil-partage.js`) : fichier .ics (heure
  « flottante » = locale, alertes veille / 1 h avant) partagé ou téléchargé, ou
  lien Google Agenda (internet). C'est l'agenda du téléphone qui prévient.
- **Prises de médicaments** (`prisesParJour`, `prises` = { jour: [heures] },
  120 jours gardés) : noter une prise de plus que prévu demande confirmation
  (risque de double dose).
- **Dates** : texte `AAAA-MM-JJ`, heure locale, affichage `jj/mm/aaaa`
  (`outil-dates.js`). Récurrences mensuelles/annuelles avec « jour d'ancrage »
  (`recJour`).
- **Nouvelle version jamais imposée** : bandeau « Mettre à jour / Plus tard »,
  pas de `skipWaiting()` à l'installation, caché pendant un formulaire.
- **Tous les fichiers à la racine** (envoi depuis un téléphone).
- Contact : constante `ADRESSE_CONTACT` en haut d'`app.js` (vide pour l'instant ;
  ne PAS réutiliser l'adresse d'Omni-Time).

## Même adresse de site que les autres applications

- Base IndexedDB : `omni-animalia` (ne jamais renommer).
- localStorage : seulement `omnianimaux_theme` et `omnianimaux_taille` (copies
  pour éviter un éclair au démarrage).
- Caches : préfixe `omni-animalia-` ; `sw.js` ne supprime que ceux-là.
- `manifest.json` : `"id": "/omni-animalia/"` (ne plus changer).

## Données

Magasins : `animaux`, `veterinaires`, `pesees`, `vaccins`, `antiparasitaires`,
`traitements`, `rdv`, `notes`, `taches` (+ `reglages` clé/valeur). Schémas dans
`SCHEMAS` (`bd-base.js`) : `nettoyerFiche()` ne garde **que** les champs connus,
donc tout nouveau champ doit y être ajouté. Poids rangé en grammes (`grammes`).
Notes : `pieces` = jusqu'à 6 documents (JPEG 1600 px, `Photo.DOCUMENT`), texte
facultatif si un document est joint. Animaux : `consignesGarde`. Réglages :
`theme`, `taille`, `unitePoids`, `contactGarde` { nom, telephone } (exportés).
Sauvegarde JSON : `format: 'omni-animaux-sauvegarde'`, `versionFormat: 1`, sans
le mot de passe ; partagée (menu Partager d'Android) ou téléchargée. Fiches de démonstration marquées `exemple: true`.

## ⚠️ Avant de pousser : incrémenter la version

Après toute modification d'un fichier mis en cache : `CACHE` en haut de `sw.js`
(`omni-animalia-vN` → `vN+1`) et `VERSION` en haut d'`app.js`. Nouveau fichier →
l'ajouter à `FICHIERS` dans `sw.js`.

## Tests

`node tests/tester.js` (Playwright + Chromium). `tests/outils.js` = boîte à outils
commune aux applications de l'Omni-système.
