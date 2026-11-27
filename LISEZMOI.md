# Omni-Animalia

**Le carnet de santé de vos animaux de compagnie**, sous forme d'application web
installable (PWA) : identité, poids (avec courbe), vaccins, vermifuges et
antiparasitaires, traitements (avec chaque prise cochée), rendez-vous
vétérinaires et frais, notes de santé avec documents joints, alimentation,
choses à faire, page de rappels, fiche de garde, et ajout des rappels à
l'agenda du téléphone.

- Fonctionne **entièrement hors ligne**, sans compte, sans serveur, sans publicité.
- Les données restent **uniquement sur l'appareil** (base IndexedDB du navigateur).
  Pensez à faire des sauvegardes (Réglages → Sauvegarder toutes mes données).
- Aucune notification : les rappels s'affichent à l'ouverture de l'application.
  Pour être prévenu à l'heure, « Ajouter à l'agenda » les confie à l'agenda du téléphone.

> Cette application sert à organiser vos informations. Elle ne remplace pas l'avis
> d'un vétérinaire.

Application de l'Omni-système, développée par **Ferrus Dantioch** avec l'aide de
l'intelligence artificielle. Portfolio : https://ferrusdantioch.github.io/omni-systeme/

### Nouveautés de la version 1.3.0

- **Partage & urgence** : partage rapide en texte de la fiche de garde, bouton « Fiche animal perdu » depuis *Identité* et coordonnées facultatives d'un vétérinaire d'urgence / clinique 24h.
- **Identité & impression** : champs facultatifs de passeport européen et d'assurance/mutuelle (masqués s'ils restent vides), choix de la période et annexe photo optionnelle dans le carnet de santé imprimable.
- **Suivi quotidien & recherche** : badge des prises de médicaments du jour dès l'accueil (y compris pour vos traitements chroniques), filtre par animal, actions rapides et bilan annuel des frais dans *Rappels*, pastilles sur les onglets concernés, recherche par mot-clé, onglet *Chronologie* et fourchette de poids idéal sur la courbe.
- **Sauvegarde** : chiffrement facultatif de vos sauvegardes par mot de passe directement dans le navigateur (`AES-GCM` + `PBKDF2`), tout en restant compatible avec vos sauvegardes classiques.

---

## Les fichiers

Tous les fichiers sont **à la racine** (pas de dossier) : c'est plus simple pour
les envoyer depuis un téléphone. Leur nom indique leur rôle.

| Fichier | Rôle |
|---|---|
| `index.html` | la page unique de l'application (tous les écrans) |
| `init-theme.js` | applique le thème et la taille du texte dès l'ouverture (évite un éclair visuel) |
| `styles.css` | l'apparence et les trois thèmes (Omni-système, Sombre, Clair) |
| `impression.css` | la mise en page du « Carnet de santé » imprimé ou en PDF |
| `app.js` | le démarrage, la navigation, le mot de passe, les mises à jour — **et l'adresse de contact** |
| `outil-dates.js` | dates françaises, calcul de l'âge, répétitions |
| `outil-interface.js` | boutons, fenêtres de confirmation, formulaires et leurs vérifications |
| `outil-photo.js` | réduction automatique des photos |
| `outil-graphique.js` | la courbe de poids (dessin SVG) |
| `outil-rappels.js` | le calcul des rappels |
| `outil-partage.js` | le menu « Partager » d'Android et l'ajout à l'agenda (fichier .ics, Google Agenda) |
| `bd-base.js` | la base de données (IndexedDB) |
| `bd-sauvegarde.js` | sauvegarde, restauration, exemple de démonstration |
| `ecran-*.js` | les écrans : accueil, fiche d'un animal, santé, agenda, vétérinaires, fiche de garde, réglages |
| `sw.js` | le « service worker » : le fonctionnement hors ligne et les mises à jour |
| `manifest.json` | la carte d'identité de l'application installable |
| `icone.svg`, `icon-192.png`, `icon-512.png`, `maskable-512.png` | les icônes |
| `*.woff2`, `POLICES-OFL.txt` | les polices du thème Omni-système et leur licence |
| `LICENSE` | la licence (CC BY-NC-ND 4.0) |
| `tests/` | les tests automatiques (pour le développement seulement) |

---

## ✏️ L'adresse de contact

Elle se règle tout en haut d'`app.js`, à la ligne `const ADRESSE_CONTACT = '…';`
(actuellement : `omni-systeme.choking513@passmail.net`, celle du portfolio de
l'Omni-système). Elle apparaît dans la page À propos, avec les boutons « Envoyer
un retour par e-mail » et « Copier l'adresse ». Après une modification,
**changez le numéro de version** (voir plus bas).

---

## Tester sur un ordinateur

Un service worker ne fonctionne qu'en `https://` ou sur `http://localhost`, jamais
en ouvrant le fichier directement. Depuis le dossier **qui contient**
`omni-animalia` :

```bash
python3 -m http.server 8000
```

puis ouvrez `http://localhost:8000/omni-animalia/` dans Chrome.

Tests automatiques (Node.js et Playwright nécessaires) :

```bash
node tests/tester.js
```

Ils vérifient notamment : le fonctionnement hors ligne, le manifest et les icônes,
le calcul de l'âge, les répétitions de tâches, les rappels, la sauvegarde et la
restauration, le mot de passe, la réduction des photos, la protection contre le
code tapé dans les champs, et l'arrivée d'une nouvelle version.

---

## Publier sur GitHub Pages

1. Sur GitHub, ouvrez le dépôt `omni-animalia` → **Settings** → **Pages**.
2. Dans « Build and deployment », choisissez **Deploy from a branch**, puis la
   branche **main** et le dossier **/ (root)**, et touchez **Save**.
3. Après une ou deux minutes, l'application est en ligne à l'adresse :
   https://ferrusdantioch.github.io/omni-animalia/

## Installer sur un téléphone Android

1. Ouvrez l'adresse ci-dessus dans **Chrome**.
2. Touchez le menu **⋮** (en haut à droite) → **Ajouter à l'écran d'accueil**
   (ou **Installer l'application**), puis **Installer**.
3. Ouvrez Omni-Animalia depuis son icône (une patte dans un anneau violet).
   Elle fonctionne désormais même sans internet.

---

## ⚠️ À chaque modification d'un fichier de l'application

Augmentez d'un cran le numéro en haut de `sw.js` :

```js
const CACHE = 'omni-animalia-v1';   // → 'omni-animalia-v2'
```

et `VERSION` en haut d'`app.js` (affiché dans À propos). Sinon, les téléphones qui
ont déjà l'application gardent l'ancienne version. Les téléphones verront alors un
bandeau « Une nouvelle version est disponible » avec « Mettre à jour » ou
« Plus tard » : rien ne change par surprise.

Si vous ajoutez un fichier, inscrivez-le aussi dans la liste `FICHIERS` de `sw.js`.

---

## Licence

© 2026 Ferrus Dantioch — Licence **Creative Commons Attribution - Pas d'Utilisation Commerciale - Pas de Modification 4.0 International** (`CC BY-NC-ND 4.0` / `Attribution-NonCommercial-NoDerivatives 4.0 International`, texte complet dans `LICENSE`).

Traduction et conditions en français : vous êtes autorisé à utiliser et partager des copies identiques gratuitement, sous réserve d'attribuer l'œuvre à Ferrus Dantioch, pour un usage strictement non commercial, et sans créer d'œuvres dérivées ou modifiées sans autorisation.

Contact : `omni-systeme.choking513@passmail.net`

Polices : SIL Open Font License 1.1 (`POLICES-OFL.txt`).
