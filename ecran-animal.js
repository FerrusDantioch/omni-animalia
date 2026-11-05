/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-ANIMAL — la fiche d'un animal.
   - l'en-tête (photo, nom, âge) et les boutons des parties de la fiche ;
   - la partie « Identité » et la partie « Alimentation » ;
   - le formulaire d'ajout / de modification d'un animal ;
   - l'archivage, la restauration ;
   - le carnet de santé à imprimer (ou enregistrer en PDF).
   (La fiche de garde est dans ecran-garde.js.)
   Les autres parties sont dans ecran-sante.js et ecran-agenda.js.
   ============================================================ */
'use strict';

/* Les parties de la fiche, toujours dans le même ordre */
const SECTIONS = [
  { cle: 'identite',         texte: 'Identité' },
  { cle: 'poids',            texte: 'Poids' },
  { cle: 'vaccins',          texte: 'Vaccins' },
  { cle: 'antiparasitaires', texte: 'Antiparasitaires' },
  { cle: 'traitements',      texte: 'Traitements' },
  { cle: 'rdv',              texte: 'Rendez-vous' },
  { cle: 'notes',            texte: 'Notes de santé' },
  { cle: 'alimentation',     texte: 'Alimentation' },
  { cle: 'taches',           texte: 'À faire' }
];

/* Espèces proposées (la saisie reste libre) */
const ESPECES = ['Chien', 'Chat', 'Lapin', 'Rongeur', 'Furet', 'Oiseau', 'Reptile', 'Poisson', 'Cheval', 'Âne', 'Chèvre', 'Mouton', 'Poule', 'Autre'];

const NOMS_SEXE = { male: 'Mâle', femelle: 'Femelle', inconnu: 'Inconnu' };

/* Lance l'impression de ce qui a été rangé dans la zone #carnet.
   Le titre de la page devient le nom proposé pour le fichier PDF. */
const Impression = {
  lancer(titre) {
    const ancienTitre = document.title;
    document.title = titre;
    const remettre = () => {
      document.title = ancienTitre;
      window.removeEventListener('afterprint', remettre);
    };
    window.addEventListener('afterprint', remettre);
    window.print();
  }
};

const EcranAnimal = {
  animal: null,       // l'animal affiché
  section: 'identite',

  /* ---------- Affichage général ---------- */
  async afficher(id, section) {
    const animal = await BD.lire('animaux', id);
    if (!animal) {
      UI.annoncer('Cet animal n’existe plus.', 'erreur');
      return Nav.remplacer({ vue: 'accueil' });
    }
    this.animal = animal;
    this.section = SECTIONS.some((s) => s.cle === section) ? section : 'identite';
    $('#animal-titre').textContent = animal.nom;

    // Résumé en haut : photo, espèce, âge, et l'état « archivé »
    const age = Dates.age(animal.naissance, animal.naissanceApprox);
    const resume = vider($('#animal-resume'));
    resume.append(el('div', { class: 'resume-animal' },
      EcranAccueil.vignette(animal, 'grande'),
      el('div', {},
        el('p', { class: 'carte-detail', text: EcranAccueil.sousTitre(animal) }),
        el('p', { class: 'carte-detail', text: age ? 'Âge : ' + age : 'Âge inconnu' }))));
    if (animal.archive) {
      resume.append(el('div', { class: 'encart attention' },
        el('p', { text: 'Animal archivé' + (animal.motifArchive ? ' (' + animal.motifArchive + ')' : '') + (animal.dateArchive ? ' le ' + Dates.fr(animal.dateArchive) : '') + '. Son historique reste consultable.' }),
        bouton('Restaurer dans la liste', () => this.restaurer(animal), { classe: 'secondaire', icone: 'restaurer' })));
    }

    // Les boutons des parties
    const nav = vider($('#animal-sections'));
    for (const s of SECTIONS) {
      nav.append(el('button', {
        type: 'button', class: 'bouton-section', 'data-section': s.cle,
        'aria-current': s.cle === this.section ? 'true' : null,
        onclick: () => this.changerSection(s.cle),
        text: s.texte
      }));
    }
    await this.afficherContenu();
  },

  /* Passe d'une partie à l'autre sans changer d'écran */
  async changerSection(cle) {
    this.section = cle;
    const etat = { ...history.state, vue: 'animal', id: this.animal.id, section: cle };
    history.replaceState(etat, '', Nav.adresse(etat));
    Nav.etat = etat;
    for (const b of $$('#animal-sections button')) {
      if (b.dataset.section === cle) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    await this.afficherContenu();
    const titre = $('#animal-contenu h2');
    if (titre) titre.focus();
  },

  /* Remplit la partie choisie */
  async afficherContenu() {
    const zone = vider($('#animal-contenu'));
    const a = this.animal;
    switch (this.section) {
      case 'identite':         return this.identite(zone, a);
      case 'alimentation':     return this.alimentation(zone, a);
      case 'poids':            return EcranSante.poids(zone, a);
      case 'vaccins':          return EcranSante.vaccins(zone, a);
      case 'antiparasitaires': return EcranSante.antiparasitaires(zone, a);
      case 'traitements':      return EcranSante.traitements(zone, a);
      case 'notes':            return EcranSante.notes(zone, a);
      case 'rdv':              return EcranAgenda.rdv(zone, a);
      case 'taches':           return EcranAgenda.taches(zone, a);
    }
  },

  /* Recharge l'animal et la partie affichée (après une modification) */
  async rafraichir() {
    const a = await BD.lire('animaux', this.animal.id);
    if (a) this.animal = a;
    await this.afficherContenu();
  },

  /* ---------- Petits outils partagés par toutes les parties ---------- */

  /* Une ligne « Libellé : valeur » (rien si la valeur est vide) */
  ligne(libelle, valeur, ...extra) {
    if (valeur === undefined || valeur === null || valeur === '') return null;
    return el('p', { class: 'ligne' }, el('span', { class: 'ligne-libelle', text: libelle + ' : ' }), el('span', { text: valeur }), ...extra);
  },

  /* Titre de partie + bouton « Ajouter » */
  entete(zone, titre, texteAjout, action) {
    zone.append(el('h2', { tabindex: '-1', text: titre }));
    if (action && !this.animal.archive) zone.append(bouton(texteAjout, action, { classe: 'principal large', icone: 'plus' }));
  },

  /* Une fiche de liste avec « Modifier » et « Supprimer » */
  carteFiche({ titre, lignes, classe, modifier, supprimer, autres }) {
    return el('article', { class: 'carte carte-fiche' + (classe ? ' ' + classe : '') },
      el('h3', { class: 'carte-titre', text: titre }),
      lignes.filter(Boolean),
      el('div', { class: 'rangee-boutons' },
        autres || null,
        modifier ? bouton('Modifier', modifier, { classe: 'secondaire', icone: 'crayon' }) : null,
        supprimer ? bouton('Supprimer', supprimer, { classe: 'secondaire danger-discret', icone: 'poubelle' }) : null));
  },

  /* Supprimer une fiche après confirmation */
  async supprimerFiche(magasin, fiche, description) {
    const ok = await UI.confirmer({
      titre: 'Supprimer cette fiche ?',
      message: ['« ' + description + ' » sera effacé.', 'Cette action ne peut pas être annulée.'],
      oui: 'Supprimer', danger: true
    });
    if (!ok) return;
    try {
      await BD.supprimer(magasin, fiche.id);
      UI.annoncer('Fiche supprimée.');
      await this.rafraichir();
      const titre = $('#animal-contenu h2');
      if (titre) titre.focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  message(zone, texte) {
    zone.append(el('p', { class: 'encart vide', text: texte }));
  },

  /* ---------- Partie « Identité » ---------- */
  async identite(zone, a) {
    zone.append(el('h2', { tabindex: '-1', text: 'Identité' }));
    let veto = null;
    if (a.vetoId) veto = await BD.lire('veterinaires', a.vetoId);

    const copie = (numero, nom) => bouton('Copier', () => UI.copier(numero), { classe: 'secondaire petit-bouton', icone: 'copier', aria: 'Copier le numéro de ' + nom });
    const naissance = a.naissance
      ? Dates.fr(a.naissance) + (a.naissanceApprox ? ' (date approximative)' : '') : '';
    const bloc = el('div', { class: 'carte carte-fiche' },
      this.ligne('Nom', a.nom),
      this.ligne('Espèce', a.espece),
      this.ligne('Race', a.race),
      this.ligne('Sexe', NOMS_SEXE[a.sexe]),
      this.ligne('Couleur, signes distinctifs', a.couleur),
      this.ligne('Date de naissance', naissance),
      this.ligne('Âge', Dates.age(a.naissance, a.naissanceApprox)),
      this.ligne('Puce électronique', a.puce, a.puce ? copie(a.puce, 'puce') : null),
      this.ligne('Tatouage', a.tatouage, a.tatouage ? copie(a.tatouage, 'tatouage') : null),
      this.ligne('Stérilisé', a.sterilise ? 'Oui' + (a.dateSterilisation ? ', le ' + Dates.fr(a.dateSterilisation) : '') : 'Non'),
      this.ligne('Unité de poids', a.unitePoids === 'g' ? 'grammes (g)' : 'kilogrammes (kg)'),
      veto ? this.ligne('Vétérinaire habituel', veto.nom + (veto.clinique ? ' — ' + veto.clinique : '')) : null,
      veto && veto.telephone ? el('p', { class: 'ligne' }, EcranVeto.lienTelephone(veto.telephone)) : null,
      this.ligne('Notes', a.notes)
    );
    zone.append(bloc);

    const actions = el('div', { class: 'pile-boutons' });
    if (!a.archive) actions.append(bouton('Modifier l’identité', () => this.formulaire(a), { classe: 'principal large', icone: 'crayon' }));
    actions.append(bouton('Fiche de garde', () => Nav.aller({ vue: 'garde', id: a.id }), { classe: 'secondaire large', icone: 'info' }));
    actions.append(bouton('Carnet de santé (imprimer ou PDF)', () => this.imprimerCarnet(a), { classe: 'secondaire large', icone: 'imprimer' }));
    if (!a.archive) actions.append(bouton('Archiver cet animal', () => this.formulaireArchive(a), { classe: 'secondaire large', icone: 'archive' }));
    zone.append(actions);
    if (!a.archive) {
      zone.append(el('p', { class: 'aide', text: 'Archiver : pour un animal décédé, confié ou vendu. Il quitte la liste principale, mais tout son historique est conservé et il peut être restauré.' }));
    }
  },

  /* ---------- Formulaire d'ajout / de modification ---------- */
  async formulaire(animal) {
    const vetos = (await BD.tout('veterinaires')).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
    const uniteDefaut = await BD.reglage('unitePoids', 'kg');
    const a = animal || { unitePoids: uniteDefaut, sexe: 'inconnu' };
    Formulaire.ouvrir({
      titre: animal ? 'Modifier ' + animal.nom : 'Nouvel animal',
      valeurs: a,
      champs: [
        { nom: 'nom', label: 'Nom', type: 'texte', requis: true, long: 80 },
        { nom: 'espece', label: 'Espèce', type: 'texte', suggestions: ESPECES, aide: 'Choisis dans la liste ou tape librement (par exemple : « Tortue »).', long: 80 },
        { nom: 'race', label: 'Race', type: 'texte', long: 120 },
        { nom: 'sexe', label: 'Sexe', type: 'radios', options: [{ valeur: 'male', texte: 'Mâle' }, { valeur: 'femelle', texte: 'Femelle' }, { valeur: 'inconnu', texte: 'Je ne sais pas' }] },
        { nom: 'couleur', label: 'Couleur et signes distinctifs', type: 'texte', long: 300 },
        { nom: 'naissance', label: 'Date de naissance', type: 'date', pasDansFutur: true, aide: 'L’âge sera calculé tout seul à partir de cette date.' },
        { nom: 'naissanceApprox', label: 'Date de naissance approximative', type: 'case' },
        { nom: 'puce', label: 'Numéro de puce électronique', type: 'texte', long: 40, aide: 'En général 15 chiffres.' },
        { nom: 'tatouage', label: 'Numéro de tatouage', type: 'texte', long: 40 },
        { nom: 'sterilise', label: 'Stérilisé', type: 'case' },
        { nom: 'dateSterilisation', label: 'Date de stérilisation', type: 'date', pasDansFutur: true, visibleSi: (v) => v.sterilise },
        { nom: 'unitePoids', label: 'Unité de poids pour cet animal', type: 'radios', requis: true, options: [{ valeur: 'kg', texte: 'Kilogrammes (kg)' }, { valeur: 'g', texte: 'Grammes (g) — petits animaux' }] },
        { nom: 'vetoId', label: 'Vétérinaire habituel', type: 'choix', options: [{ valeur: '', texte: vetos.length ? '— Aucun —' : '— Aucun vétérinaire enregistré —' }, ...vetos.map((v) => ({ valeur: v.id, texte: v.nom + (v.clinique ? ' (' + v.clinique + ')' : '') }))], aide: 'Les vétérinaires s’ajoutent dans l’onglet « Vétos » en bas de l’écran.' },
        { nom: 'photo', label: 'Photo', type: 'photo' },
        { nom: 'notes', label: 'Notes libres', type: 'zone' }
      ],
      valider: (v) => {
        const e = {};
        if (v.puce && !/^[0-9A-Za-z\s-]+$/.test(v.puce)) e.puce = 'Seuls les chiffres, lettres, espaces et tirets sont acceptés.';
        if (v.tatouage && !/^[0-9A-Za-z\s-]+$/.test(v.tatouage)) e.tatouage = 'Seuls les chiffres, lettres, espaces et tirets sont acceptés.';
        if (v.dateSterilisation && v.naissance && v.dateSterilisation < v.naissance) e.dateSterilisation = 'La stérilisation ne peut pas être avant la naissance.';
        return e;
      },
      enregistrer: async (v) => {
        const fiche = { ...(animal || { creeLe: Dates.aujourdhui(), archive: false }), ...v };
        if (v.puce) fiche.puce = v.puce.replace(/\s+/g, ' ');
        await BD.enregistrer('animaux', fiche);
        return animal ? 'Fiche de ' + fiche.nom + ' enregistrée.' : fiche.nom + ' a été ajouté.';
      }
    });
  },

  /* ---------- Archiver / restaurer ---------- */
  formulaireArchive(animal) {
    Formulaire.ouvrir({
      titre: 'Archiver ' + animal.nom,
      intro: animal.nom + ' quittera la liste principale. Tout son historique sera conservé dans « Animaux archivés », et tu pourras le restaurer à tout moment.',
      texteBouton: 'Archiver',
      valeurs: { dateArchive: Dates.aujourdhui() },
      champs: [
        { nom: 'motif', label: 'Pourquoi ?', type: 'radios', requis: true, options: [
          { valeur: 'décédé', texte: 'Décédé' }, { valeur: 'confié', texte: 'Confié à quelqu’un' },
          { valeur: 'vendu', texte: 'Vendu' }, { valeur: 'autre', texte: 'Autre raison' }] },
        { nom: 'precision', label: 'Précise', type: 'texte', long: 120, visibleSi: (v) => v.motif === 'autre' },
        { nom: 'dateArchive', label: 'Date', type: 'date', requis: true, pasDansFutur: true }
      ],
      enregistrer: async (v) => {
        const fiche = { ...animal, archive: true, dateArchive: v.dateArchive, motifArchive: v.motif === 'autre' ? (v.precision || 'autre raison') : v.motif };
        await BD.enregistrer('animaux', fiche);
        return animal.nom + ' a été archivé.';
      }
    });
  },

  async restaurer(animal) {
    const ok = await UI.confirmer({
      titre: 'Restaurer ' + animal.nom + ' ?',
      message: animal.nom + ' reviendra dans la liste principale, avec tout son historique, et ses rappels seront de nouveau calculés.',
      oui: 'Restaurer'
    });
    if (!ok) return;
    try {
      const fiche = { ...animal, archive: false };
      delete fiche.motifArchive;
      delete fiche.dateArchive;
      await BD.enregistrer('animaux', fiche);
      UI.annoncer(animal.nom + ' est de retour dans la liste.');
      await Nav.afficher(Nav.etat);
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- Partie « Alimentation » ---------- */
  alimentation(zone, a) {
    zone.append(el('h2', { tabindex: '-1', text: 'Alimentation' }));
    const vide = !a.alimMarque && !a.alimQuantite && !a.alimRepas && !a.alimRemarques && !a.alimEviter;
    if (vide) this.message(zone, 'Rien de noté pour l’instant.');
    else {
      zone.append(el('div', { class: 'carte carte-fiche' },
        this.ligne('Marque ou type d’aliment', a.alimMarque),
        this.ligne('Quantité par jour', a.alimQuantite),
        this.ligne('Nombre de repas par jour', a.alimRepas ? String(a.alimRepas) : ''),
        this.ligne('Remarques', a.alimRemarques),
        this.ligne('Allergies, aliments à éviter', a.alimEviter)));
    }
    if (!a.archive) zone.append(bouton(vide ? 'Remplir l’alimentation' : 'Modifier l’alimentation', () => this.formulaireAlimentation(a), { classe: 'principal large', icone: 'crayon' }));
  },

  formulaireAlimentation(animal) {
    Formulaire.ouvrir({
      titre: 'Alimentation de ' + animal.nom,
      valeurs: animal,
      champs: [
        { nom: 'alimMarque', label: 'Marque ou type d’aliment', type: 'texte', long: 200 },
        { nom: 'alimQuantite', label: 'Quantité par jour', type: 'texte', long: 100, placeholder: 'exemple : 250 g' },
        { nom: 'alimRepas', label: 'Nombre de repas par jour', type: 'nombre', positif: true, entier: true, max: 50 },
        { nom: 'alimRemarques', label: 'Remarques', type: 'zone' },
        { nom: 'alimEviter', label: 'Allergies ou aliments à éviter', type: 'zone' }
      ],
      enregistrer: async (v) => {
        await BD.enregistrer('animaux', { ...animal, ...v });
        return 'Alimentation enregistrée.';
      }
    });
  },

  /* ---------- Carnet de santé à imprimer ----------
     On remplit la zone #carnet (invisible à l'écran), puis on ouvre la
     fenêtre d'impression du téléphone. Là, on peut choisir « Enregistrer
     au format PDF ». La mise en page vient du fichier impression.css. */
  async imprimerCarnet(a) {
    const [pesees, vaccins, antip, traitements, rdv, notes] = await Promise.all(
      ['pesees', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes'].map((m) => BD.parAnimal(m, a.id)));
    const veto = a.vetoId ? await BD.lire('veterinaires', a.vetoId) : null;
    const parDate = (champ) => (x, y) => ((x[champ] || '') < (y[champ] || '') ? 1 : -1);   // plus récent d'abord

    const carnet = vider($('#carnet'));
    const tableau = (entetes, lignes) => {
      if (!lignes.length) return el('p', { class: 'vide', text: 'Aucune donnée.' });
      return el('table', {},
        el('thead', {}, el('tr', {}, entetes.map((t) => el('th', { text: t })))),
        el('tbody', {}, lignes.map((l) => el('tr', {}, l.map((c) => el('td', { text: c || '' }))))));
    };
    const section = (titre, contenu) => el('section', { class: 'carnet-section' }, el('h2', { text: titre }), contenu);

    const photo = a.photo ? el('img', { class: 'carnet-photo', alt: '' }) : null;
    if (photo) photo.src = a.photo;
    const unite = a.unitePoids === 'g' ? 'g' : 'kg';

    carnet.append(
      el('header', { class: 'carnet-entete' },
        el('div', {},
          el('p', { class: 'carnet-sur-titre', text: 'Carnet de santé' }),
          el('h1', { text: a.nom }),
          el('p', { text: 'Édité le ' + Dates.fr(Dates.aujourdhui()) + ' avec Omni-Animaux' })),
        photo),
      section('Identité', el('div', { class: 'carnet-identite' },
        this.ligne('Espèce', a.espece), this.ligne('Race', a.race), this.ligne('Sexe', NOMS_SEXE[a.sexe]),
        this.ligne('Couleur, signes distinctifs', a.couleur),
        this.ligne('Naissance', a.naissance ? Dates.fr(a.naissance) + (a.naissanceApprox ? ' (approximative)' : '') + ' — ' + Dates.age(a.naissance, a.naissanceApprox) : ''),
        this.ligne('Puce électronique', a.puce), this.ligne('Tatouage', a.tatouage),
        this.ligne('Stérilisé', a.sterilise ? 'Oui' + (a.dateSterilisation ? ', le ' + Dates.fr(a.dateSterilisation) : '') : 'Non'),
        veto ? this.ligne('Vétérinaire habituel', [veto.nom, veto.clinique, veto.telephone].filter(Boolean).join(' — ')) : null,
        this.ligne('Allergies, aliments à éviter', a.alimEviter),
        this.ligne('Notes', a.notes))),
      section('Poids', tableau(['Date', 'Poids', 'Note'],
        pesees.sort(parDate('date')).map((p) => [Dates.fr(p.date), UI.nombre(Graphique.convertir(p.grammes, unite)) + ' ' + unite, p.note]))),
      section('Vaccins', tableau(['Date', 'Vaccin', 'Prochain rappel', 'Vétérinaire', 'Lot'],
        vaccins.sort(parDate('date')).map((v) => [Dates.fr(v.date), v.nom, v.rappel ? Dates.fr(v.rappel) : '', v.veterinaire, v.lot]))),
      section('Vermifuges et antiparasitaires', tableau(['Date', 'Type', 'Produit', 'Dose', 'Prochaine prise'],
        antip.sort(parDate('date')).map((x) => [Dates.fr(x.date), EcranSante.NOMS_AP[x.type], x.produit, x.dose, x.prochaine ? Dates.fr(x.prochaine) : '']))),
      section('Traitements', tableau(['Médicament', 'Dose', 'Fréquence', 'Début', 'Fin', 'Statut'],
        traitements.sort(parDate('debut')).map((t) => [t.nom, t.dose, t.frequence, t.debut ? Dates.fr(t.debut) : '', t.fin ? Dates.fr(t.fin) : '', t.statut === 'termine' ? 'Terminé' : 'En cours']))),
      section('Rendez-vous vétérinaires', tableau(['Date', 'Motif', 'Vétérinaire', 'Compte rendu'],
        rdv.sort(parDate('date')).map((r) => [Dates.frHeure(r.date, r.heure), r.motif, r.veterinaire, r.compteRendu]))),
      section('Notes de santé', tableau(['Date', 'Type', 'Note'],
        notes.sort(parDate('date')).map((n) => [Dates.fr(n.date), EcranSante.NOMS_NOTES[n.categorie] || '',
          (n.texte || '') + (n.pieces && n.pieces.length ? ' [' + n.pieces.length + ' document(s) joint(s) dans l’application]' : '')]))),
      el('footer', { class: 'carnet-pied', text: 'Cette application sert à organiser tes informations. Elle ne remplace pas l’avis d’un vétérinaire. — Omni-Animaux, © 2026 Ferrus Dantioch' })
    );

    Impression.lancer('Carnet de santé - ' + a.nom);
  }
};
