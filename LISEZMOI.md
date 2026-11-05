# Omni-Animaux

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
Claude (Anthropic). Portfolio : https://ferrusdantioch.github.io/omni-systeme/

---

## Les fichiers

Tous les fichiers sont **à la racine** (pas de dossier) : c'est plus simple pour
les envoyer depuis un téléphone. Leur nom indique leur rôle.

| Fichier | Rôle |
|---|---|
| `index.html` | la page unique de l'application (tous les écrans) |
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

## ✏️ Mettre l'adresse de contact

Ouvrez `app.js`. Tout en haut, dans le cadre « À COMPLÉTER », se trouve la ligne :

```js
const ADRESSE_CONTACT = '';
```

Écrivez l'adresse entre les deux apostrophes, par exemple
`const ADRESSE_CONTACT = 'omni-animaux@exemple.net';`.
Elle apparaîtra dans la page À propos, avec un bouton « Envoyer un retour par
e-mail ». Ensuite, **changez le numéro de version** (voir plus bas).

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
3. Ouvrez Omni-Animaux depuis son icône (une patte dans un anneau violet).
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

© 2026 Ferrus Dantioch — Creative Commons BY-NC-ND 4.0 (texte complet dans
`LICENSE`). Utilisation et partage de copies identiques autorisés, gratuitement,
en citant l'auteur ; pas d'utilisation commerciale ; pas de version modifiée.
Polices : SIL Open Font License 1.1 (`POLICES-OFL.txt`).
