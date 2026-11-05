/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-REGLAGES — thème, unité de poids, sauvegarde et restauration,
   taille du texte, mot de passe, exemple de démonstration, suppression de tout.
   (La page « À propos » est écrite directement dans index.html.)
   ============================================================ */
'use strict';

const EcranReglages = {

  /* Un bloc de réglages avec son titre */
  bloc(titre, ...contenu) {
    return el('section', { class: 'bloc' }, el('h2', { text: titre }), ...contenu);
  },

  /* Un groupe de boutons radio qui agit dès qu'on change */
  radios(nom, legende, options, valeur, action) {
    const groupe = el('fieldset', { class: 'groupe-radios' }, el('legend', { class: 'invisible', text: legende }));
    options.forEach((o, i) => {
      const id = 'reglage-' + nom + '-' + i;
      const r = el('input', { type: 'radio', name: 'reglage-' + nom, id, value: o.valeur, checked: o.valeur === valeur });
      r.addEventListener('change', () => { if (r.checked) action(o.valeur); });
      groupe.append(el('div', { class: 'radio' }, r, el('label', { for: id, text: o.texte })));
    });
    return groupe;
  },

  async afficher() {
    const zone = vider($('#reglages-contenu'));
    const theme = await BD.reglage('theme', 'omni');
    const taille = await BD.reglage('taille', 'normal');
    const unite = await BD.reglage('unitePoids', 'kg');
    const derniere = await BD.reglage('derniereSauvegarde', null);
    const mdp = await Verrou.actif();
    const exemple = await Sauvegarde.exemplePresent();

    // 1. Apparence
    zone.append(this.bloc('Apparence',
      this.radios('theme', 'Thème', [
        { valeur: 'omni', texte: 'Omni-système (violet sur fond sombre)' },
        { valeur: 'sombre', texte: 'Sombre (bleu-gris)' },
        { valeur: 'clair', texte: 'Clair' }
      ], theme, async (t) => {
        Theme.appliquer(t);
        await BD.definirReglage('theme', t);
      }),
      el('h3', { class: 'sous-titre', text: 'Taille du texte' }),
      this.radios('taille', 'Taille du texte', [
        { valeur: 'normal', texte: 'Normale' },
        { valeur: 'grand', texte: 'Grande' },
        { valeur: 'tresgrand', texte: 'Très grande' }
      ], taille, async (z) => {
        Taille.appliquer(z);
        await BD.definirReglage('taille', z);
      })));

    // 2. Unité de poids
    zone.append(this.bloc('Unité de poids par défaut',
      el('p', { class: 'aide', text: 'Proposée pour chaque nouvel animal. Elle peut ensuite être changée animal par animal (dans sa fiche d’identité).' }),
      this.radios('unite', 'Unité de poids', [
        { valeur: 'kg', texte: 'Kilogrammes (kg)' },
        { valeur: 'g', texte: 'Grammes (g)' }
      ], unite, async (u) => {
        await BD.definirReglage('unitePoids', u);
        UI.annoncer('Unité par défaut : ' + (u === 'g' ? 'grammes' : 'kilogrammes') + '.');
      })));

    // 3. Sauvegarde et restauration
    const choixFichier = el('input', { type: 'file', accept: '.json,application/json', class: 'invisible', tabindex: '-1', 'aria-hidden': 'true', id: 'fichier-import' });
    choixFichier.addEventListener('change', () => {
      const f = choixFichier.files[0];
      choixFichier.value = '';
      if (f) this.restaurer(f);
    });
    zone.append(this.bloc('Sauvegarde et restauration',
      el('div', { class: 'encart attention' },
        el('p', { text: 'Tes données restent uniquement sur cet appareil. Si le téléphone est perdu, réinitialisé, ou si les données du navigateur sont effacées, elles disparaissent.' }),
        el('p', { text: 'Fais une sauvegarde régulièrement, et garde le fichier ailleurs (ordinateur, clé USB, courriel à toi-même…).' })),
      el('p', { text: 'Dernière sauvegarde : ' + (derniere ? Dates.fr(derniere) : 'jamais') }),
      el('div', { class: 'pile-boutons' },
        bouton('Sauvegarder toutes mes données', () => this.sauvegarder(), { classe: 'principal large', icone: 'sauver', id: 'bouton-sauvegarder' }),
        bouton('Restaurer une sauvegarde', () => choixFichier.click(), { classe: 'secondaire large', icone: 'restaurer', id: 'bouton-restaurer' })),
      choixFichier,
      el('p', { class: 'aide', text: 'Le fichier de sauvegarde (.json) contient tout, photos comprises. Il se retrouve en général dans le dossier « Téléchargements ». Il n’est pas chiffré : garde-le en lieu sûr.' })));

    // 4. Mot de passe
    const blocMdp = this.bloc('Mot de passe',
      el('p', { text: mdp ? 'Le verrouillage par mot de passe est activé.' : 'Le verrouillage par mot de passe est désactivé.' }),
      el('div', { class: 'encart' },
        el('p', { text: 'Ce verrou empêche quelqu’un qui prend ton téléphone d’ouvrir l’application. Il ne chiffre pas les données : une personne qui s’y connaît pourrait les lire autrement. Il protège contre un regard indiscret, pas contre un vol organisé.' }),
        el('p', { text: 'Le mot de passe n’est pas enregistré : seule une empreinte calculée l’est. Il ne peut donc pas être récupéré en cas d’oubli. L’application se verrouille à l’ouverture et après 5 minutes en arrière-plan.' })));
    const boutonsMdp = el('div', { class: 'pile-boutons' });
    if (mdp) {
      boutonsMdp.append(
        bouton('Changer le mot de passe', () => this.formulaireMdp('changer'), { classe: 'secondaire large', icone: 'cadenas' }),
        bouton('Désactiver le mot de passe', () => this.formulaireMdp('desactiver'), { classe: 'secondaire large' }));
    } else {
      boutonsMdp.append(bouton('Activer un mot de passe', () => this.formulaireMdp('activer'), { classe: 'secondaire large', icone: 'cadenas' }));
    }
    blocMdp.append(boutonsMdp);
    zone.append(blocMdp);

    // 5. Exemple de démonstration
    zone.append(this.bloc('Essayer avec un exemple',
      el('p', { class: 'aide', text: 'Ajoute un chien et un chat inventés (avec pesées, vaccins, rappels…) pour découvrir l’application. Tes vraies données ne sont pas touchées, et l’exemple se retire en un clic.' }),
      exemple
        ? bouton('Supprimer l’exemple', () => this.supprimerExemple(), { classe: 'secondaire large', icone: 'poubelle', id: 'bouton-exemple' })
        : bouton('Charger un exemple', () => this.chargerExemple(), { classe: 'secondaire large', icone: 'patte', id: 'bouton-exemple' })));

    // 6. Stockage
    const infoStockage = el('p', { class: 'aide', text: 'Calcul de la place utilisée…' });
    zone.append(this.bloc('Stockage sur l’appareil',
      el('p', { text: App.stockageProtege === true
        ? 'Stockage protégé : oui. Le navigateur ne doit pas effacer tes données pour faire de la place.'
        : 'Stockage protégé : non. En cas de manque de place, le navigateur pourrait effacer les données. Installer l’application sur l’écran d’accueil aide à obtenir cette protection. Dans tous les cas, fais des sauvegardes.' }),
      infoStockage));
    this.majStockage(infoStockage);

    // 7. À propos
    zone.append(this.bloc('Informations',
      bouton('À propos d’Omni-Animaux', () => Nav.aller({ vue: 'apropos' }), { classe: 'secondaire large', icone: 'info' })));

    // 8. Tout supprimer
    zone.append(this.bloc('Zone sensible',
      el('p', { class: 'aide', text: 'Efface tous les animaux, tout leur historique, les vétérinaires et les réglages de ce téléphone.' }),
      bouton('Supprimer toutes les données', () => this.toutSupprimer(), { classe: 'danger large', icone: 'poubelle' })));
  },

  async majStockage(p) {
    try {
      if (!navigator.storage || !navigator.storage.estimate) { p.textContent = ''; return; }
      const e = await navigator.storage.estimate();
      const mo = (n) => UI.nombre(n / (1024 * 1024), 1) + ' Mo';
      p.textContent = 'Place utilisée : environ ' + mo(e.usage || 0) + ' (application et données).';
    } catch (err) { p.textContent = ''; }
  },

  afficherApropos() { /* tout est déjà écrit dans index.html */ },

  /* ---------- Sauvegarde ----------
     Si le téléphone sait partager un fichier, on propose :
     - Partager : Drive, messagerie, e-mail à soi-même… (la sauvegarde
       quitte le téléphone : elle survit à sa perte) ;
     - Télécharger : le fichier va dans « Téléchargements ». */
  async sauvegarder() {
    try {
      let mode = 'telecharger';
      if (Partage.possible(new File(['{}'], 'essai.json', { type: 'application/json' }))) {
        mode = await UI.choisir({
          titre: 'Sauvegarder toutes mes données',
          message: [
            'Partager : envoie le fichier vers Google Drive, ta messagerie, ou un e-mail à toi-même. Conseillé : la sauvegarde est alors à l’abri, hors du téléphone.',
            'Télécharger : range le fichier dans « Téléchargements », sur ce téléphone.'
          ],
          choix: [
            { valeur: null, texte: 'Annuler' },
            { valeur: 'telecharger', texte: 'Télécharger' },
            { valeur: 'partager', texte: 'Partager', principal: true }
          ]
        });
        if (!mode) return;
      }
      const r = await Sauvegarde.exporter(mode);
      if (r.resultat === 'annule') {
        UI.annoncer('Partage annulé : la sauvegarde n’a été envoyée nulle part.');
        return;
      }
      const taille = r.taille > 1024 * 1024 ? UI.nombre(r.taille / (1024 * 1024), 1) + ' Mo' : UI.nombre(Math.ceil(r.taille / 1024), 0) + ' Ko';
      UI.annoncer(r.resultat === 'partage'
        ? 'Sauvegarde envoyée : « ' + r.nom + ' » (' + taille + ').'
        : 'Sauvegarde créée : « ' + r.nom + ' » (' + taille + '). Elle se trouve en général dans « Téléchargements ».');
      if (Nav.etat && Nav.etat.vue === 'reglages') await this.afficher();
      if (Nav.etat && Nav.etat.vue === 'accueil') await EcranAccueil.afficher();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- Restauration ---------- */
  async restaurer(fichier) {
    let lu;
    try {
      lu = await Sauvegarde.lireFichier(fichier);
    } catch (e) {
      await UI.informer({ titre: 'Fichier refusé', message: [UI.messageErreur(e), 'Rien n’a été modifié.'] });
      return;
    }
    const r = lu.resume;
    const mode = await UI.choisir({
      titre: 'Restaurer cette sauvegarde ?',
      message: [
        'Contenu : ' + r.animaux + ' animal(aux), ' + r.veterinaires + ' vétérinaire(s), ' + r.fiches + ' fiche(s) de suivi' + (r.date ? ', sauvegarde du ' + Dates.fr(r.date) : '') + '.',
        'Remplacer : tout ce qui est sur ce téléphone est effacé, puis remplacé par la sauvegarde.',
        'Fusionner : la sauvegarde est ajoutée à ce qui existe. Une fiche présente des deux côtés est remplacée par celle de la sauvegarde.'
      ],
      choix: [
        { valeur: null, texte: 'Annuler' },
        { valeur: 'fusionner', texte: 'Fusionner' },
        { valeur: 'remplacer', texte: 'Remplacer', danger: true }
      ]
    });
    if (!mode) return;
    if (mode === 'remplacer') {
      const ok = await UI.confirmer({
        titre: 'Tout remplacer ?',
        message: 'Les données actuelles de ce téléphone seront effacées et remplacées par la sauvegarde. Cette action ne peut pas être annulée.',
        oui: 'Remplacer', danger: true
      });
      if (!ok) return;
    }
    try {
      const res = await Sauvegarde.importer(lu, mode);
      if (lu.reglages.theme) Theme.appliquer(lu.reglages.theme);
      if (lu.reglages.taille) Taille.appliquer(lu.reglages.taille);
      let message = 'Restauration terminée (' + res.ajoutees + ' fiche(s)).';
      if (res.ecartees) message += ' ' + res.ecartees + ' fiche(s) sans animal ont été ignorées.';
      UI.annoncer(message);
      await this.afficher();
      Nav.majPastille();
    } catch (e) {
      await UI.informer({ titre: 'La restauration a échoué', message: [UI.messageErreur(e), 'Rien n’a été modifié.'] });
    }
  },

  /* ---------- Mot de passe ---------- */
  formulaireMdp(action) {
    const champsNouveau = [
      { nom: 'nouveau', label: 'Nouveau mot de passe', type: 'motdepasse', requis: true, aide: 'Au moins 4 caractères. Note-le quelque part : il ne peut pas être récupéré.' },
      { nom: 'confirmation', label: 'Retape le nouveau mot de passe', type: 'motdepasse', requis: true }
    ];
    const champActuel = { nom: 'actuel', label: 'Mot de passe actuel', type: 'motdepasse', requis: true, autocomplete: 'current-password' };
    const verifierNouveau = (v) => {
      const e = {};
      if (v.nouveau && v.nouveau.length < 4) e.nouveau = 'Le mot de passe doit faire au moins 4 caractères.';
      if (v.nouveau && v.confirmation && v.nouveau !== v.confirmation) e.confirmation = 'Les deux mots de passe ne sont pas identiques.';
      return e;
    };
    const verifierActuel = async (v) => {
      if (!(await Verrou.verifier(v.actuel))) throw BD.erreur('Le mot de passe actuel est incorrect. Rien n’a été modifié.');
    };

    if (action === 'activer') {
      Formulaire.ouvrir({
        titre: 'Activer un mot de passe', texteBouton: 'Activer',
        intro: 'Ce verrou protège contre un regard indiscret, mais ne chiffre pas les données.',
        champs: champsNouveau, valider: verifierNouveau,
        enregistrer: async (v) => { await Verrou.definir(v.nouveau); return 'Mot de passe activé.'; }
      });
    } else if (action === 'changer') {
      Formulaire.ouvrir({
        titre: 'Changer le mot de passe', texteBouton: 'Changer',
        champs: [champActuel, ...champsNouveau], valider: verifierNouveau,
        enregistrer: async (v) => { await verifierActuel(v); await Verrou.definir(v.nouveau); return 'Mot de passe changé.'; }
      });
    } else {
      Formulaire.ouvrir({
        titre: 'Désactiver le mot de passe', texteBouton: 'Désactiver',
        champs: [champActuel],
        enregistrer: async (v) => { await verifierActuel(v); await BD.definirReglage('motDePasse', null); return 'Mot de passe désactivé.'; }
      });
    }
  },

  /* ---------- Exemple ---------- */
  async chargerExemple() {
    try {
      await Sauvegarde.chargerExemple();
      UI.annoncer('Exemple chargé : Biscuit et Moka sont dans la liste des animaux.');
      await this.afficher();
      Nav.majPastille();
      $('#bouton-exemple').focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  async supprimerExemple() {
    const ok = await UI.confirmer({
      titre: 'Supprimer l’exemple ?',
      message: 'Biscuit, Moka et le vétérinaire d’exemple seront effacés, avec tout leur historique. Tes propres données ne sont pas touchées.',
      oui: 'Supprimer l’exemple', danger: true
    });
    if (!ok) return;
    try {
      await Sauvegarde.supprimerExemple();
      UI.annoncer('Exemple supprimé.');
      await this.afficher();
      Nav.majPastille();
      $('#bouton-exemple').focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- Tout supprimer (double confirmation) ---------- */
  async toutSupprimer() {
    const ok1 = await UI.confirmer({
      titre: 'Supprimer toutes les données ?',
      message: ['Tous les animaux (y compris archivés), leur historique, leurs photos, les vétérinaires et les réglages seront effacés de ce téléphone.',
        'Pense à faire une sauvegarde avant, si tu veux pouvoir revenir en arrière.'],
      oui: 'Continuer', danger: true
    });
    if (!ok1) return;
    const ok2 = await UI.confirmer({
      titre: 'Dernière confirmation',
      message: 'Cette suppression est définitive.',
      saisie: 'SUPPRIMER',
      oui: 'Tout supprimer', danger: true
    });
    if (!ok2) return;
    try {
      await BD.toutEffacer();
      await BD.definirReglage('avertissementVu', true);
      await BD.definirReglage('debutSuivi', Dates.aujourdhui());
      Theme.appliquer('omni');
      Taille.appliquer('normal');
      UI.annoncer('Toutes les données ont été supprimées.');
      await this.afficher();
      Nav.majPastille();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};
