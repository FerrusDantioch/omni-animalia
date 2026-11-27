/* Omni-Animalia — © 2026 Ferrus Dantioch
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
  { cle: 'taches',           texte: 'À faire' },
  { cle: 'chronologie',      texte: 'Chronologie' }
];

/* Espèces proposées (la saisie reste libre) */
const ESPECES = ['Chien', 'Chat', 'Lapin', 'Rongeur', 'Furet', 'Oiseau', 'Reptile', 'Poisson', 'Cheval', 'Âne', 'Chèvre', 'Mouton', 'Poule', 'Autre'];

const NOMS_SEXE = Object.assign(Object.create(null), { male: 'Mâle', femelle: 'Femelle', inconnu: 'Inconnu' });

/* Lance l'impression de ce qui a été rangé dans la zone #carnet.
   Le titre de la page devient le nom proposé pour le fichier PDF. */
const Impression = {
  _nettoyer: null,
  _titreInitial: null,

  lancer(titre) {
    if (this._nettoyer) this._nettoyer(false);
    if (this._titreInitial === null) this._titreInitial = document.title;
    document.title = titre;

    let fini = false;
    let minuteur = null;
    const mql = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;
    let vuPrint = mql ? mql.matches : false;

    const surMedia = (ev) => {
      if (ev.matches) vuPrint = true;
      else if (vuPrint) remettre(true);
    };

    const remettre = (viderCarnet = true) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      window.removeEventListener('afterprint', surAfterPrint);
      if (mql) {
        if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', surMedia);
        else if (typeof mql.removeListener === 'function') mql.removeListener(surMedia);
      }
      if (this._titreInitial !== null) {
        document.title = this._titreInitial;
        this._titreInitial = null;
      }
      this._nettoyer = null;
      if (viderCarnet) {
        const carnet = $('#carnet');
        if (carnet) vider(carnet);
      }
    };

    const surAfterPrint = () => remettre(true);
    this._nettoyer = remettre;
    window.addEventListener('afterprint', surAfterPrint);
    if (mql) {
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', surMedia);
      else if (typeof mql.addListener === 'function') mql.addListener(surMedia);
    }
    minuteur = setTimeout(() => remettre(true), 10000);

    try {
      window.print();
    } catch (e) {
      remettre(true);
      throw e;
    }
  }
};

const EcranAnimal = {
  animal: null,       // l'animal affiché
  section: 'identite',
  _tour: 0,
  _tourContenu: 0,
  _tourPastilles: 0,
  _tourRecherche: 0,
  _rechercheRequete: '',

  /* ---------- Affichage général ---------- */
  async afficher(id, section) {
    const tour = ++this._tour;
    const tourContenu = ++this._tourContenu;
    const animal = await BD.lire('animaux', id);
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;
    if (!animal) {
      UI.annoncer('Cet animal n’existe plus.', 'erreur');
      return Nav.remplacer({ vue: 'accueil' });
    }
    if ((!this.animal || this.animal.id !== id) && typeof EcranSante !== 'undefined') {
      EcranSante.reinitialiserFiltre();
    }
    this.animal = animal;
    this.section = SECTIONS.some((s) => s.cle === section) ? section : 'identite';
    $('#animal-titre').textContent = animal.nom || '';

    // Résumé en haut : photo, espèce, âge, et l'état « archivé »
    const age = Dates.age(animal.naissance, animal.naissanceApprox);
    const resume = vider($('#animal-resume'));
    resume.append(el('div', { class: 'resume-animal' },
      EcranAccueil.vignette(animal, 'grande'),
      el('div', {},
        el('p', { class: 'carte-detail', text: EcranAccueil.sousTitre(animal) }),
        el('p', { class: 'carte-detail', text: age ? 'Âge : ' + age : 'Âge inconnu' }))));
    if (animal.archive) {
      const motif = typeof animal.motifArchive === 'string' && animal.motifArchive ? ' (' + animal.motifArchive + ')' : '';
      const dateArch = animal.dateArchive && Dates.estValide(animal.dateArchive) ? ' le ' + Dates.fr(animal.dateArchive) : '';
      resume.append(el('div', { class: 'encart attention' },
        el('p', { text: 'Animal archivé' + motif + dateArch + '. Son historique reste consultable.' }),
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

    // Barre de recherche multi-sections (réinitialisée à l'ouverture d'une fiche)
    this._rechercheRequete = '';
    this._tourRecherche++;
    let zoneRecherche = $('#animal-recherche');
    if (!zoneRecherche) {
      zoneRecherche = el('div', { id: 'animal-recherche', class: 'recherche-animal' });
      nav.after(zoneRecherche);
    }
    this.dessinerRecherche(zoneRecherche);

    await Promise.all([
      this._afficherContenuPourTour(tour, tourContenu),
      this._actualiserPastilles(tour, animal)
    ]);
  },

  async _lirePastilles(a) {
    const aucune = { vaccins: false, traitements: false, antiparasitaires: false, taches: false };
    if (!a || a.archive || !a.id || typeof Rappels === 'undefined' || typeof Rappels.pastillesAnimal !== 'function') {
      return aucune;
    }
    try {
      const donnees = await BD.toutLire();
      return Rappels.pastillesAnimal(donnees, a.id);
    } catch (_) {
      return null;
    }
  },

  async _actualiserPastilles(tourAnimal, a, tourPastilles = ++this._tourPastilles) {
    const pastilles = await this._lirePastilles(a);
    if (tourAnimal !== this._tour || tourPastilles !== this._tourPastilles || ($('#verrou') && !$('#verrou').hidden)) return;
    this.appliquerPastillesSections(pastilles);
  },

  appliquerPastillesSections(pastilles) {
    if (!pastilles || typeof pastilles !== 'object') return;
    for (const b of $$('#animal-sections button')) {
      const cle = b.dataset.section;
      const def = SECTIONS.find((s) => s.cle === cle);
      const actif = Boolean(cle && Object.prototype.hasOwnProperty.call(pastilles, cle) && pastilles[cle]);
      const existante = $('.pastille-section', b);
      if (actif) {
        if (!existante) b.append(el('span', { class: 'pastille-section', 'aria-hidden': 'true' }));
        if (def) b.setAttribute('aria-label', def.texte + ' — rappel en retard ou prévu aujourd’hui');
      } else {
        if (existante) existante.remove();
        b.removeAttribute('aria-label');
      }
    }
  },

  /* Passe d'une partie à l'autre sans changer d'écran */
  async changerSection(cle) {
    if (!this.animal) return;
    try {
      this.section = cle;
      const etat = { ...history.state, vue: 'animal', id: this.animal.id, section: cle };
      history.replaceState(etat, '', Nav.adresse(etat));
      Nav.etat = etat;
      for (const b of $$('#animal-sections button')) {
        if (b.dataset.section === cle) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      }
      const affiche = await this.afficherContenu();
      if (!affiche) return;
      const titre = $('#animal-contenu h2');
      if (titre) titre.focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  async _afficherContenuPourTour(tourAnimal, tourContenu) {
    vider($('#animal-contenu'));
    const a = this.animal;
    if (!a) return false;
    const tampon = document.createDocumentFragment();
    switch (this.section) {
      case 'identite':         await this.identite(tampon, a); break;
      case 'alimentation':     this.alimentation(tampon, a); break;
      case 'poids':            await EcranSante.poids(tampon, a); break;
      case 'vaccins':          await EcranSante.vaccins(tampon, a); break;
      case 'antiparasitaires': await EcranSante.antiparasitaires(tampon, a); break;
      case 'traitements':      await EcranSante.traitements(tampon, a); break;
      case 'notes':            await EcranSante.notes(tampon, a); break;
      case 'rdv':              await EcranAgenda.rdv(tampon, a); break;
      case 'taches':           await EcranAgenda.taches(tampon, a); break;
      case 'chronologie':      await this.chronologie(tampon, a); break;
      default:                 return false;
    }
    if (tourAnimal !== this._tour || tourContenu !== this._tourContenu || ($('#verrou') && !$('#verrou').hidden)) return false;
    vider($('#animal-contenu')).append(tampon);
    return true;
  },

  /* Remplit la partie choisie */
  async afficherContenu() {
    return this._afficherContenuPourTour(this._tour, ++this._tourContenu);
  },

  /* Recharge l'animal et la partie affichée (après une modification) */
  async rafraichir() {
    if (!this.animal) return;
    const tourAnimal = this._tour;
    const tourContenu = ++this._tourContenu;
    const tourPastilles = ++this._tourPastilles;
    try {
      const a = await BD.lire('animaux', this.animal.id);
      if (tourAnimal !== this._tour || tourPastilles !== this._tourPastilles || ($('#verrou') && !$('#verrou').hidden)) return;
      if (!a) return;
      this.animal = a;
      const promPastilles = tourPastilles === this._tourPastilles
        ? this._actualiserPastilles(tourAnimal, a, tourPastilles)
        : Promise.resolve();
      const promContenu = tourContenu === this._tourContenu
        ? this._afficherContenuPourTour(tourAnimal, tourContenu)
        : Promise.resolve(false);
      await Promise.all([promContenu, promPastilles]);
      if (this._rechercheRequete && tourAnimal === this._tour && tourContenu === this._tourContenu) {
        await this.executerRecherche(this._rechercheRequete);
      }
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
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
    if (action && !(this.animal && this.animal.archive)) zone.append(bouton(texteAjout, action, { classe: 'principal large', icone: 'plus' }));
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

  /* ---------- Recherche multi-sections ---------- */
  normaliserRecherche(texte) {
    if (typeof texte !== 'string') return '';
    return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  },

  _estProlongementGrapheme(str, idx) {
    if (idx <= 0 || idx >= str.length) return false;
    const code = str.charCodeAt(idx);
    if (code >= 0xDC00 && code <= 0xDFFF) return true;
    if (code >= 0x0300 && code <= 0x036F) return true;
    if (code >= 0x1AB0 && code <= 0x1AFF) return true;
    if (code >= 0x1DC0 && code <= 0x1DFF) return true;
    if (code >= 0x20D0 && code <= 0x20FF) return true;
    if (code >= 0xFE20 && code <= 0xFE2F) return true;
    return false;
  },

  _extraitRecherche(texte, termeNorm) {
    const t = typeof texte === 'string' ? texte.trim() : '';
    if (!t) return '';
    if (t.length <= 200) return t;
    let norm = '';
    const debuts = [];
    const fins = [];
    let i = 0;
    while (i < t.length) {
      const code = t.codePointAt(i);
      const cp = String.fromCodePoint(code);
      const len = cp.length;
      const morceau = cp.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (morceau) {
        for (let j = 0; j < morceau.length; j++) {
          norm += morceau[j];
          debuts.push(i);
          fins.push(i + len);
        }
      }
      i += len;
    }
    const pos = termeNorm ? norm.indexOf(termeNorm) : -1;
    if (pos < 0) {
      let finDefaut = Math.min(t.length, 200);
      while (finDefaut < t.length && this._estProlongementGrapheme(t, finDefaut)) finDefaut++;
      return t.slice(0, finDefaut) + (finDefaut < t.length ? '…' : '');
    }
    const matchDebut = debuts[pos];
    let matchFin = fins[pos + termeNorm.length - 1];
    while (matchFin < t.length && this._estProlongementGrapheme(t, matchFin)) matchFin++;
    let debut = Math.max(0, matchDebut - 60);
    while (debut < matchDebut && this._estProlongementGrapheme(t, debut)) debut++;
    let fin = Math.max(matchFin, Math.min(t.length, debut + 200));
    while (fin < t.length && this._estProlongementGrapheme(t, fin)) fin++;
    return (debut > 0 ? '…' : '') + t.slice(debut, fin) + (fin < t.length ? '…' : '');
  },

  rechercherDansDonnees(requete, donnees) {
    const q = this.normaliserRecherche(requete);
    if (!q) return [];
    const d = donnees && typeof donnees === 'object' ? donnees : {};
    const match = (...champs) => champs.some((c) => typeof c === 'string' && this.normaliserRecherche(c).includes(q));
    const nomsNotes = typeof EcranSante !== 'undefined' && EcranSante.NOMS_NOTES ? EcranSante.NOMS_NOTES : {};
    const nomsAP = typeof EcranSante !== 'undefined' && EcranSante.NOMS_AP ? EcranSante.NOMS_AP : {};
    const res = [];

    for (const n of (Array.isArray(d.notes) ? d.notes : [])) {
      if (!n || typeof n !== 'object') continue;
      const cat = Object.prototype.hasOwnProperty.call(nomsNotes, n.categorie) ? nomsNotes[n.categorie] : 'Note';
      const dateFr = Dates.estValide(n.date) ? Dates.fr(n.date) : '';
      if (match(n.texte, cat, dateFr)) {
        res.push({
          id: n.id,
          section: 'notes',
          sectionLabel: 'Notes de santé',
          date: Dates.estValide(n.date) ? n.date : '',
          titre: (dateFr ? dateFr + ' — ' : '') + cat,
          extrait: this._extraitRecherche(n.texte, q)
        });
      }
    }

    for (const v of (Array.isArray(d.vaccins) ? d.vaccins : [])) {
      if (!v || typeof v !== 'object') continue;
      const dateFr = Dates.estValide(v.date) ? Dates.fr(v.date) : '';
      if (match(v.nom, v.veterinaire, v.lot, v.note, dateFr)) {
        res.push({
          id: v.id,
          section: 'vaccins',
          sectionLabel: 'Vaccins',
          date: Dates.estValide(v.date) ? v.date : '',
          titre: v.nom || 'Vaccin',
          extrait: [dateFr, v.veterinaire, v.lot, this._extraitRecherche(v.note, q)].filter(Boolean).join(' · ')
        });
      }
    }

    for (const x of (Array.isArray(d.antiparasitaires) ? d.antiparasitaires : [])) {
      if (!x || typeof x !== 'object') continue;
      const typeNom = Object.prototype.hasOwnProperty.call(nomsAP, x.type) ? nomsAP[x.type] : 'Antiparasitaire';
      const dateFr = Dates.estValide(x.date) ? Dates.fr(x.date) : '';
      if (match(typeNom, x.produit, x.dose, x.note, dateFr)) {
        res.push({
          id: x.id,
          section: 'antiparasitaires',
          sectionLabel: 'Antiparasitaires',
          date: Dates.estValide(x.date) ? x.date : '',
          titre: typeNom + (x.produit ? ' — ' + x.produit : ''),
          extrait: [dateFr, x.dose, this._extraitRecherche(x.note, q)].filter(Boolean).join(' · ')
        });
      }
    }

    for (const t of (Array.isArray(d.traitements) ? d.traitements : [])) {
      if (!t || typeof t !== 'object') continue;
      const debutFr = Dates.estValide(t.debut) ? Dates.fr(t.debut) : '';
      if (match(t.nom, t.dose, t.frequence, t.note, debutFr)) {
        res.push({
          id: t.id,
          section: 'traitements',
          sectionLabel: 'Traitements',
          date: Dates.estValide(t.debut) ? t.debut : (Dates.estValide(t.fin) ? t.fin : ''),
          titre: t.nom || 'Traitement',
          extrait: [t.dose, t.frequence, debutFr ? 'Début : ' + debutFr : '', this._extraitRecherche(t.note, q)].filter(Boolean).join(' · ')
        });
      }
    }

    for (const r of (Array.isArray(d.rdv) ? d.rdv : [])) {
      if (!r || typeof r !== 'object') continue;
      const dateFr = Dates.estValide(r.date) ? Dates.frHeure(r.date, r.heure) : '';
      if (match(r.motif, r.veterinaire, r.compteRendu, dateFr)) {
        res.push({
          id: r.id,
          section: 'rdv',
          sectionLabel: 'Rendez-vous',
          date: Dates.estValide(r.date) ? r.date : '',
          titre: [dateFr, r.motif].filter(Boolean).join(' — ') || 'Rendez-vous',
          extrait: [r.veterinaire, this._extraitRecherche(r.compteRendu, q)].filter(Boolean).join(' · ')
        });
      }
    }

    return res.sort((a, b) => {
      if (a.date !== b.date) {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date < b.date ? 1 : -1;
      }
      if (a.section !== b.section) return a.section < b.section ? -1 : 1;
      const ia = String(a.id || '');
      const ib = String(b.id || '');
      return ia < ib ? 1 : ia > ib ? -1 : 0;
    });
  },

  dessinerRecherche(zone) {
    vider(zone);
    const input = el('input', {
      type: 'search',
      id: 'animal-recherche-saisie',
      placeholder: 'Mot-clé (note, vaccin, traitement, RDV…)',
      autocomplete: 'off'
    });
    const effacer = bouton('Effacer', () => {
      input.value = '';
      this.executerRecherche('');
      input.focus();
    }, { classe: 'secondaire', id: 'animal-recherche-effacer' });
    effacer.hidden = true;
    const resultats = el('div', {
      id: 'animal-recherche-resultats',
      class: 'resultats-recherche',
      'aria-live': 'polite',
      hidden: true
    });
    input.addEventListener('input', () => { this.executerRecherche(input.value); });
    input.addEventListener('search', () => { this.executerRecherche(input.value); });
    zone.append(
      el('label', { for: 'animal-recherche-saisie', text: 'Rechercher dans la fiche' }),
      el('div', { class: 'recherche-animal-champ' }, input, effacer),
      resultats
    );
  },

  async executerRecherche(requete) {
    const brute = typeof requete === 'string' ? requete : '';
    this._rechercheRequete = brute;
    const effacer = $('#animal-recherche-effacer');
    if (effacer) effacer.hidden = !brute.trim();
    const zoneRes = $('#animal-recherche-resultats');
    if (!zoneRes) return;
    if (!brute.trim() || !this.animal) {
      ++this._tourRecherche;
      vider(zoneRes);
      zoneRes.hidden = true;
      return;
    }
    const a = this.animal;
    const tourAnimal = this._tour;
    const tourRech = ++this._tourRecherche;
    try {
      const [notes, vaccins, antiparasitaires, traitements, rdv] = await Promise.all(
        ['notes', 'vaccins', 'antiparasitaires', 'traitements', 'rdv'].map((m) => BD.parAnimal(m, a.id)));
      if (tourAnimal !== this._tour || tourRech !== this._tourRecherche || !this.animal || this.animal.id !== a.id || ($('#verrou') && !$('#verrou').hidden)) return;
      const matches = this.rechercherDansDonnees(brute, { notes, vaccins, antiparasitaires, traitements, rdv });
      vider(zoneRes);
      zoneRes.hidden = false;
      if (!matches.length) {
        zoneRes.append(el('p', { class: 'discret', text: 'Aucun résultat pour « ' + brute.trim() + ' ».' }));
        return;
      }
      zoneRes.append(el('p', { class: 'discret', text: matches.length + ' résultat' + (matches.length > 1 ? 's' : '') + ' :' }));
      for (const m of matches) {
        zoneRes.append(el('button', {
          type: 'button',
          class: 'resultat-recherche',
          'data-section': m.section,
          onclick: () => this.changerSection(m.section)
        },
          el('span', { class: 'etiquette', text: m.sectionLabel + (m.date && Dates.estValide(m.date) ? ' — ' + Dates.fr(m.date) : '') }),
          el('span', { class: 'carte-titre', text: m.titre }),
          m.extrait ? el('span', { class: 'carte-detail texte-libre', text: m.extrait }) : null));
      }
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- Partie « Chronologie » ---------- */
  construireChronologie(donnees, unite) {
    const d = donnees && typeof donnees === 'object' ? donnees : {};
    const u = unite === 'g' ? 'g' : 'kg';
    const episodes = [];

    for (const n of (Array.isArray(d.notes) ? d.notes : [])) {
      if (!n || typeof n !== 'object' || n.categorie !== 'symptome' || !Dates.estValide(n.date)) continue;
      episodes.push({
        id: n.id,
        type: 'symptome',
        section: 'notes',
        sectionLabel: 'Notes de santé',
        badge: 'Symptôme',
        date: n.date,
        heure: '',
        dateAffichee: Dates.fr(n.date),
        titre: n.texte || 'Symptôme noté',
        lignes: Array.isArray(n.pieces) && n.pieces.length ? [['Documents joints', String(n.pieces.length)]] : []
      });
    }

    for (const r of (Array.isArray(d.rdv) ? d.rdv : [])) {
      if (!r || typeof r !== 'object' || !Dates.estValide(r.date)) continue;
      episodes.push({
        id: r.id,
        type: 'rdv',
        section: 'rdv',
        sectionLabel: 'Rendez-vous',
        badge: 'Rendez-vous',
        date: r.date,
        heure: Dates.heureValide(r.heure) ? r.heure : '',
        dateAffichee: Dates.frHeure(r.date, r.heure),
        titre: r.motif || 'Rendez-vous vétérinaire',
        lignes: [['Vétérinaire', r.veterinaire], ['Compte rendu', r.compteRendu]]
      });
    }

    for (const t of (Array.isArray(d.traitements) ? d.traitements : [])) {
      if (!t || typeof t !== 'object') continue;
      const date = Dates.estValide(t.debut) ? t.debut : (Dates.estValide(t.fin) ? t.fin : '');
      if (!date) continue;
      episodes.push({
        id: t.id,
        type: 'traitement',
        section: 'traitements',
        sectionLabel: 'Traitements',
        badge: 'Traitement',
        date,
        heure: '',
        dateAffichee: Dates.fr(date),
        titre: t.nom || 'Traitement',
        lignes: [
          ['Statut', t.statut === 'termine' ? 'Terminé' : 'En cours'],
          ['Dose', [t.dose, t.frequence].filter(Boolean).join(' — ')],
          Dates.estValide(t.fin) && t.fin !== date ? ['Fin', Dates.fr(t.fin)] : null,
          ['Note', t.note]
        ]
      });
    }

    for (const p of (Array.isArray(d.pesees) ? d.pesees : [])) {
      if (!p || typeof p !== 'object' || !Dates.estValide(p.date) || typeof p.grammes !== 'number' || !Number.isFinite(p.grammes) || p.grammes < 0) continue;
      const poidsTxt = UI.nombre(Graphique.convertir(p.grammes, u)) + ' ' + u;
      episodes.push({
        id: p.id,
        type: 'pesee',
        section: 'poids',
        sectionLabel: 'Poids',
        badge: 'Pesée',
        date: p.date,
        heure: '',
        dateAffichee: Dates.fr(p.date),
        titre: poidsTxt,
        lignes: [['Note', p.note]]
      });
    }

    const ORDRE_TYPE = { rdv: 0, symptome: 1, traitement: 2, pesee: 3 };
    return episodes.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if ((a.heure || '') !== (b.heure || '')) return (a.heure || '') < (b.heure || '') ? 1 : -1;
      const oa = Object.prototype.hasOwnProperty.call(ORDRE_TYPE, a.type) ? ORDRE_TYPE[a.type] : 9;
      const ob = Object.prototype.hasOwnProperty.call(ORDRE_TYPE, b.type) ? ORDRE_TYPE[b.type] : 9;
      if (oa !== ob) return oa - ob;
      const ia = String(a.id || '');
      const ib = String(b.id || '');
      return ia < ib ? 1 : ia > ib ? -1 : 0;
    });
  },

  async chronologie(zone, a) {
    zone.append(el('h2', { tabindex: '-1', text: 'Chronologie' }));
    const [notes, rdv, traitements, pesees] = await Promise.all(
      ['notes', 'rdv', 'traitements', 'pesees'].map((m) => BD.parAnimal(m, a.id)));
    const unite = a.unitePoids === 'g' ? 'g' : 'kg';
    const episodes = this.construireChronologie({ notes, rdv, traitements, pesees }, unite);
    if (!episodes.length) {
      return this.message(zone, 'Aucun épisode daté pour l’instant (symptômes, rendez-vous, traitements, pesées).');
    }
    zone.append(el('p', { class: 'discret', text: episodes.length + ' épisode' + (episodes.length > 1 ? 's' : '') + ' par ordre chronologique.' }));
    for (const ep of episodes) {
      zone.append(this.carteFiche({
        titre: ep.titre,
        classe: 'chronologie-carte',
        lignes: [
          el('p', { class: 'ligne' },
            el('span', { class: 'badge', text: ep.badge }),
            ' ',
            el('span', { class: 'discret', text: ep.dateAffichee })),
          ...ep.lignes.filter(Boolean).map(([lib, val]) => this.ligne(lib, val))
        ],
        autres: bouton('Voir dans « ' + ep.sectionLabel + ' »', () => this.changerSection(ep.section), { classe: 'secondaire' })
      }));
    }
  },

  /* ---------- Partie « Identité » ---------- */
  async identite(zone, a) {
    zone.append(el('h2', { tabindex: '-1', text: 'Identité' }));
    let veto = null;
    if (a.vetoId) veto = await BD.lire('veterinaires', a.vetoId);

    const textePropre = (v) => (typeof v === 'string' ? v.trim() : '');
    const copie = (numero, nom) => bouton('Copier', () => UI.copier(numero), { classe: 'secondaire petit-bouton', icone: 'copier', aria: 'Copier le numéro de ' + nom });
    const naissance = a.naissance && Dates.estValide(a.naissance)
      ? Dates.fr(a.naissance) + (a.naissanceApprox ? ' (date approximative)' : '') : '';
    const dateSter = a.dateSterilisation && Dates.estValide(a.dateSterilisation) ? ', le ' + Dates.fr(a.dateSterilisation) : '';
    const lienTel = veto && veto.telephone ? EcranVeto.lienTelephone(veto.telephone) : null;
    const passeport = textePropre(a.passeport);
    const assComp = textePropre(a.assuranceCompagnie);
    const assContrat = textePropre(a.assuranceContrat);
    const assTel = textePropre(a.assuranceTelephone);
    let ligneTelAss = null;
    if (assTel) {
      if (/^[0-9+(). -]{3,30}$/.test(assTel) && /\d/.test(assTel)) {
        const lienAss = EcranVeto.lienTelephone(assTel);
        ligneTelAss = lienAss ? el('p', { class: 'ligne' }, el('span', { class: 'ligne-libelle', text: 'Téléphone assurance : ' }), lienAss) : null;
      } else {
        ligneTelAss = this.ligne('Téléphone assurance', assTel);
      }
    }

    const bloc = el('div', { class: 'carte carte-fiche' },
      this.ligne('Nom', a.nom),
      this.ligne('Espèce', a.espece),
      this.ligne('Race', a.race),
      this.ligne('Sexe', Object.prototype.hasOwnProperty.call(NOMS_SEXE, a.sexe) ? NOMS_SEXE[a.sexe] : ''),
      this.ligne('Couleur, signes distinctifs', a.couleur),
      this.ligne('Date de naissance', naissance),
      this.ligne('Âge', Dates.age(a.naissance, a.naissanceApprox)),
      this.ligne('Puce électronique', a.puce, a.puce ? copie(a.puce, 'puce') : null),
      this.ligne('Tatouage', a.tatouage, a.tatouage ? copie(a.tatouage, 'tatouage') : null),
      this.ligne('Passeport européen', passeport),
      this.ligne('Stérilisé', a.sterilise ? 'Oui' + dateSter : 'Non'),
      this.ligne('Unité de poids', a.unitePoids === 'g' ? 'grammes (g)' : 'kilogrammes (kg)'),
      veto ? this.ligne('Vétérinaire habituel', (veto.nom || '') + (veto.clinique ? ' — ' + veto.clinique : '')) : null,
      lienTel ? el('p', { class: 'ligne' }, lienTel) : null,
      this.ligne('Assurance / mutuelle', assComp),
      this.ligne('Contrat d’assurance', assContrat),
      ligneTelAss,
      this.ligne('Notes', a.notes)
    );
    zone.append(bloc);

    const actions = el('div', { class: 'pile-boutons' });
    if (!a.archive) actions.append(bouton('Modifier l’identité', () => this.formulaire(a), { classe: 'principal large', icone: 'crayon' }));
    actions.append(bouton('Fiche de garde', () => Nav.aller({ vue: 'garde', id: a.id }), { classe: 'secondaire large', icone: 'info' }));
    actions.append(bouton('Fiche animal perdu', () => this.partagerAnimalPerdu(a), { classe: 'secondaire large', icone: 'copier' }));

    const radioTout = el('input', { type: 'radio', name: 'carnet-periode', id: 'carnet-periode-tout', value: 'tout', checked: true });
    const radio12m = el('input', { type: 'radio', name: 'carnet-periode', id: 'carnet-periode-12mois', value: '12mois' });
    const caseAnnexe = el('input', { type: 'checkbox', id: 'carnet-annexe', checked: false });
    actions.append(el('fieldset', { class: 'options-carnet' },
      el('legend', { text: 'Options du carnet imprimable' }),
      el('div', { class: 'radio' }, radioTout, el('label', { for: 'carnet-periode-tout', text: 'Tout l’historique' })),
      el('div', { class: 'radio' }, radio12m, el('label', { for: 'carnet-periode-12mois', text: '12 derniers mois' })),
      el('div', { class: 'case' }, caseAnnexe, el('label', { for: 'carnet-annexe', text: 'Inclure les photos d’ordonnances et résultats en annexe' }))
    ));
    actions.append(bouton('Carnet de santé (imprimer ou PDF)', () => this.imprimerCarnet(a, {
      periode: radio12m.checked ? '12mois' : 'tout',
      annexe: caseAnnexe.checked
    }), { classe: 'secondaire large', icone: 'imprimer' }));
    if (!a.archive) actions.append(bouton('Archiver cet animal', () => this.formulaireArchive(a), { classe: 'secondaire large', icone: 'archive' }));
    zone.append(actions);
    if (!a.archive) {
      zone.append(el('p', { class: 'aide', text: 'Archiver : pour un animal décédé, confié ou vendu. Il quitte la liste principale, mais tout son historique est conservé et il peut être restauré.' }));
    }
  },

  /* Fabrique le texte prêt à partager / copier pour un animal perdu */
  texteAnimalPerdu(a, contact, reference) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return '';
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const aujourdhui = Dates.estValide(reference) ? reference : Dates.aujourdhui();
    const nom = str(a.nom) || 'Animal';
    const lignes = ['ANIMAL PERDU — ' + nom];

    const espRace = [str(a.espece), str(a.race)].filter(Boolean).join(' · ');
    if (espRace) lignes.push('Espèce / race : ' + espRace);

    const sexe = Object.prototype.hasOwnProperty.call(NOMS_SEXE, a.sexe) && a.sexe !== 'inconnu' ? NOMS_SEXE[a.sexe] : '';
    const age = Dates.age(a.naissance, a.naissanceApprox, aujourdhui);
    if (sexe) lignes.push('Sexe : ' + sexe);
    if (age) lignes.push('Âge : ' + age);

    const couleur = str(a.couleur);
    if (couleur) lignes.push('Couleur et signes distinctifs : ' + couleur);
    const notes = str(a.notes);
    if (notes) lignes.push('Précisions : ' + notes);

    const puce = str(a.puce);
    const tatouage = str(a.tatouage);
    if (puce) lignes.push('Puce électronique : ' + puce);
    if (tatouage) lignes.push('Tatouage : ' + tatouage);
    if (!puce && !tatouage) lignes.push('Identification : aucune puce ni tatouage enregistré');

    const cObj = contact && typeof contact === 'object' && !Array.isArray(contact) ? contact : null;
    const cTel = cObj ? str(cObj.telephone) : '';
    const cNom = cObj ? str(cObj.nom) : '';
    if (cTel) {
      lignes.push('Téléphone à contacter : ' + cTel + (cNom ? ' (' + cNom + ')' : ''));
    } else if (cNom) {
      lignes.push('Personne à contacter : ' + cNom + ' (téléphone non renseigné)');
    } else {
      lignes.push('Téléphone à contacter : non renseigné (ajoute ton numéro dans Fiche de garde → Mon contact)');
    }

    lignes.push('Fiche générée le ' + Dates.fr(aujourdhui) + ' avec Omni-Animalia.');
    return lignes.join('\n');
  },

  async partagerAnimalPerdu(a) {
    const estVerrouille = () => (typeof Verrou !== 'undefined' && Verrou._promesse) || ($('#verrou') && !$('#verrou').hidden);
    if (!a || !a.id || estVerrouille()) return;
    try {
      const [animal, contact] = await Promise.all([
        BD.lire('animaux', a.id),
        BD.reglage('contactGarde', null)
      ]);
      if (estVerrouille()) return;
      const cible = animal || a;
      const texte = this.texteAnimalPerdu(cible, contact);
      if (!texte) return;
      const nom = typeof cible.nom === 'string' ? cible.nom.trim() : '';
      const titre = nom ? 'Animal perdu — ' + nom : 'Animal perdu';
      const resultat = await Partage.texte(titre, texte);
      if (resultat === 'partage') UI.annoncer('Fiche animal perdu partagée.');
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- Formulaire d'ajout / de modification ---------- */
  async formulaire(animal) {
    try {
      const vetos = (await BD.tout('veterinaires')).sort((x, y) => {
        const nx = (x && typeof x.nom === 'string') ? x.nom : '';
        const ny = (y && typeof y.nom === 'string') ? y.nom : '';
        const c = nx.localeCompare(ny, 'fr');
        if (c !== 0) return c;
        const ix = String((x && x.id) ?? '');
        const iy = String((y && y.id) ?? '');
        return ix < iy ? -1 : ix > iy ? 1 : 0;
      });
      const uniteDefaut = await BD.reglage('unitePoids', 'kg');
      const a = animal || { unitePoids: uniteDefaut, sexe: 'inconnu' };
      Formulaire.ouvrir({
        titre: animal ? 'Modifier ' + (animal.nom || '') : 'Nouvel animal',
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
          { nom: 'passeport', label: 'Numéro de passeport européen', type: 'texte', long: 80 },
          { nom: 'sterilise', label: 'Stérilisé', type: 'case' },
          { nom: 'dateSterilisation', label: 'Date de stérilisation', type: 'date', pasDansFutur: true, visibleSi: (v) => v.sterilise },
          { nom: 'unitePoids', label: 'Unité de poids pour cet animal', type: 'radios', requis: true, options: [{ valeur: 'kg', texte: 'Kilogrammes (kg)' }, { valeur: 'g', texte: 'Grammes (g) — petits animaux' }] },
          { nom: 'vetoId', label: 'Vétérinaire habituel', type: 'choix', options: [{ valeur: '', texte: vetos.length ? '— Aucun —' : '— Aucun vétérinaire enregistré —' }, ...vetos.map((v) => ({ valeur: v.id, texte: (v.nom || '') + (v.clinique ? ' (' + v.clinique + ')' : '') }))], aide: 'Les vétérinaires s’ajoutent dans l’onglet « Vétos » en bas de l’écran.' },
          { nom: 'assuranceCompagnie', label: 'Assurance / mutuelle (compagnie)', type: 'texte', long: 120 },
          { nom: 'assuranceContrat', label: 'Numéro de contrat d’assurance', type: 'texte', long: 80 },
          { nom: 'assuranceTelephone', label: 'Téléphone de l’assurance', type: 'tel', long: 30, autocomplete: 'tel' },
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
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- Archiver / restaurer ---------- */
  formulaireArchive(animal) {
    Formulaire.ouvrir({
      titre: 'Archiver ' + (animal.nom || ''),
      intro: (animal.nom || 'Cet animal') + ' quittera la liste principale. Tout son historique sera conservé dans « Animaux archivés », et tu pourras le restaurer à tout moment.',
      texteBouton: 'Archiver',
      valeurs: { dateArchive: Dates.aujourdhui() },
      champs: [
        { nom: 'motif', label: 'Pourquoi ?', type: 'radios', requis: true, options: [
          { valeur: 'décédé', texte: 'Décédé' }, { valeur: 'confié', texte: 'Confié à quelqu’un' },
          { valeur: 'vendu', texte: 'Vendu' }, { valeur: 'autre', texte: 'Autre raison' }] },
        { nom: 'precision', label: 'Précise', type: 'texte', long: 120, visibleSi: (v) => v.motif === 'autre' },
        { nom: 'dateArchive', label: 'Date', type: 'date', requis: true, pasDansFutur: true }
      ],
      valider: (v) => {
        const e = {};
        if (v.dateArchive && animal.naissance && v.dateArchive < animal.naissance) {
          e.dateArchive = 'La date d’archivage ne peut pas être avant la naissance (' + Dates.fr(animal.naissance) + ').';
        }
        return e;
      },
      enregistrer: async (v) => {
        const fiche = { ...animal, archive: true, dateArchive: v.dateArchive, motifArchive: v.motif === 'autre' ? (v.precision || 'autre raison') : v.motif };
        await BD.enregistrer('animaux', fiche);
        return (animal.nom || 'Cet animal') + ' a été archivé.';
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

  /* Filtre les données d'un carnet selon la période demandée ('tout' ou '12mois') */
  filtrerPourCarnet(donnees, periode, reference) {
    const d = donnees && typeof donnees === 'object' ? donnees : {};
    const p = periode === '12mois' ? '12mois' : 'tout';
    const aujourdhui = Dates.estValide(reference) ? reference : Dates.aujourdhui();
    const dateDebut = p === '12mois' ? Dates.ajouterIntervalle(aujourdhui, -12, 'mois') : '';
    const copier = (liste) => (Array.isArray(liste) ? liste.filter((x) => x && typeof x === 'object') : []);
    if (p !== '12mois' || !dateDebut) {
      return {
        periode: 'tout',
        dateDebut: '',
        pesees: copier(d.pesees),
        vaccins: copier(d.vaccins),
        antiparasitaires: copier(d.antiparasitaires),
        traitements: copier(d.traitements),
        rdv: copier(d.rdv),
        notes: copier(d.notes)
      };
    }
    const dansPeriode = (item) => Dates.estValide(item.date) && item.date >= dateDebut;
    return {
      periode: '12mois',
      dateDebut,
      pesees: copier(d.pesees).filter(dansPeriode),
      vaccins: copier(d.vaccins).filter(dansPeriode),
      antiparasitaires: copier(d.antiparasitaires).filter(dansPeriode),
      traitements: copier(d.traitements).filter((t) => {
        if (Dates.estValide(t.fin)) return t.fin >= dateDebut;
        if (t.statut !== 'termine') return true;
        return Dates.estValide(t.debut) && t.debut >= dateDebut;
      }),
      rdv: copier(d.rdv).filter(dansPeriode),
      notes: copier(d.notes).filter(dansPeriode)
    };
  },

  /* ---------- Carnet de santé à imprimer ----------
     On remplit la zone #carnet (invisible à l'écran), puis on ouvre la
     fenêtre d'impression du téléphone. Là, on peut choisir « Enregistrer
     au format PDF ». La mise en page vient du fichier impression.css. */
  async imprimerCarnet(a, options) {
    const estVerrouille = () => (typeof Verrou !== 'undefined' && Verrou._promesse) || ($('#verrou') && !$('#verrou').hidden);
    if (estVerrouille()) return;
    const opt = options && typeof options === 'object' ? options : {};
    const periode = opt.periode === '12mois' ? '12mois' : 'tout';
    const annexe = Boolean(opt.annexe);
    try {
      const [pesees, vaccins, antip, traitements, rdv, notes] = await Promise.all(
        ['pesees', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes'].map((m) => BD.parAnimal(m, a.id)));
      const veto = a.vetoId ? await BD.lire('veterinaires', a.vetoId) : null;
      if (estVerrouille()) return;
      const filtres = this.filtrerPourCarnet({ pesees, vaccins, antiparasitaires: antip, traitements, rdv, notes }, periode);
      const parDate = (champ) => (x, y) => {
        const vx = (x && x[champ]) || '';
        const vy = (y && y[champ]) || '';
        if (vx !== vy) return vx < vy ? 1 : -1;
        const ix = String((x && x.id) ?? '');
        const iy = String((y && y.id) ?? '');
        return ix < iy ? 1 : ix > iy ? -1 : 0;
      };

      const carnet = vider($('#carnet'));
      const tableau = (entetes, lignes) => {
        if (!lignes.length) return el('p', { class: 'vide', text: 'Aucune donnée.' });
        return el('table', {},
          el('thead', {}, el('tr', {}, entetes.map((t) => el('th', { text: t })))),
          el('tbody', {}, lignes.map((l) => el('tr', {}, l.map((c) => el('td', { text: c || '' }))))));
      };
      const section = (titre, contenu) => el('section', { class: 'carnet-section' }, el('h2', { text: titre }), contenu);
      const textePropre = (v) => (typeof v === 'string' ? v.trim() : '');

      const photo = a.photo && imageValide(a.photo) ? el('img', { class: 'carnet-photo', alt: '' }) : null;
      if (photo) photo.src = a.photo;
      const unite = a.unitePoids === 'g' ? 'g' : 'kg';
      const dateNaissance = a.naissance && Dates.estValide(a.naissance)
        ? Dates.fr(a.naissance) + (a.naissanceApprox ? ' (approximative)' : '') + ' — ' + Dates.age(a.naissance, a.naissanceApprox) : '';
      const dateSter = a.dateSterilisation && Dates.estValide(a.dateSterilisation) ? ', le ' + Dates.fr(a.dateSterilisation) : '';

      const notesTriees = filtres.notes.sort(parDate('date'));
      const nomsNotes = typeof EcranSante !== 'undefined' && EcranSante.NOMS_NOTES ? EcranSante.NOMS_NOTES : null;
      const nomsAp = typeof EcranSante !== 'undefined' && EcranSante.NOMS_AP ? EcranSante.NOMS_AP : null;
      let sectionAnnexe = null;
      if (annexe) {
        const figures = [];
        for (const n of notesTriees) {
          if (!Array.isArray(n.pieces) || !n.pieces.length) continue;
          const catNom = nomsNotes && Object.prototype.hasOwnProperty.call(nomsNotes, n.categorie) ? nomsNotes[n.categorie] : '';
          const piecesValides = n.pieces.filter((src) => imageValide(src));
          piecesValides.forEach((src, idx) => {
            const img = el('img', {
              class: 'annexe-photo',
              alt: 'Document joint' + (n.date && Dates.estValide(n.date) ? ' du ' + Dates.fr(n.date) : '')
            });
            img.src = src;
            const legende = [
              n.date && Dates.estValide(n.date) ? Dates.fr(n.date) : '',
              catNom,
              n.texte || '',
              piecesValides.length > 1 ? 'Document ' + (idx + 1) + '/' + piecesValides.length : ''
            ].filter(Boolean).join(' — ');
            figures.push(el('figure', { class: 'annexe-photo-element' },
              img,
              el('figcaption', { text: legende || 'Document joint' })));
          });
        }
        sectionAnnexe = section('Annexe — Documents joints',
          figures.length
            ? el('div', { class: 'annexe-photos' }, figures)
            : el('p', { class: 'vide', text: 'Aucun document joint sur cette période.' }));
      }

      carnet.append(...[
        el('header', { class: 'carnet-entete' },
          el('div', {},
            el('p', { class: 'carnet-sur-titre', text: 'Carnet de santé' }),
            el('h1', { text: a.nom || '' }),
            el('p', { text: 'Édité le ' + Dates.fr(Dates.aujourdhui()) + ' avec Omni-Animalia' }),
            filtres.periode === '12mois' && filtres.dateDebut
              ? el('p', { class: 'carnet-periode', text: 'Période : 12 derniers mois (depuis le ' + Dates.fr(filtres.dateDebut) + ')' })
              : null),
          photo),
        section('Identité', el('div', { class: 'carnet-identite' },
          this.ligne('Espèce', a.espece), this.ligne('Race', a.race), this.ligne('Sexe', Object.prototype.hasOwnProperty.call(NOMS_SEXE, a.sexe) ? NOMS_SEXE[a.sexe] : ''),
          this.ligne('Couleur, signes distinctifs', a.couleur),
          this.ligne('Naissance', dateNaissance),
          this.ligne('Puce électronique', a.puce), this.ligne('Tatouage', a.tatouage),
          this.ligne('Passeport européen', textePropre(a.passeport)),
          this.ligne('Stérilisé', a.sterilise ? 'Oui' + dateSter : 'Non'),
          veto ? this.ligne('Vétérinaire habituel', [veto.nom, veto.clinique, veto.telephone].filter(Boolean).join(' — ')) : null,
          this.ligne('Assurance / mutuelle', textePropre(a.assuranceCompagnie)),
          this.ligne('Contrat d’assurance', textePropre(a.assuranceContrat)),
          this.ligne('Téléphone assurance', textePropre(a.assuranceTelephone)),
          this.ligne('Allergies, aliments à éviter', a.alimEviter),
          this.ligne('Notes', a.notes))),
        section('Poids', tableau(['Date', 'Poids', 'Note'],
          filtres.pesees.sort(parDate('date')).map((p) => [Dates.fr(p.date), typeof p.grammes === 'number' && Number.isFinite(p.grammes) ? UI.nombre(Graphique.convertir(p.grammes, unite)) + ' ' + unite : '', p.note]))),
        section('Vaccins', tableau(['Date', 'Vaccin', 'Prochain rappel', 'Vétérinaire', 'Lot'],
          filtres.vaccins.sort(parDate('date')).map((v) => [Dates.fr(v.date), v.nom, v.rappel ? Dates.fr(v.rappel) : '', v.veterinaire, v.lot]))),
        section('Vermifuges et antiparasitaires', tableau(['Date', 'Type', 'Produit', 'Dose', 'Prochaine prise'],
          filtres.antiparasitaires.sort(parDate('date')).map((x) => [Dates.fr(x.date), nomsAp && Object.prototype.hasOwnProperty.call(nomsAp, x.type) ? nomsAp[x.type] : '', x.produit, x.dose, x.prochaine ? Dates.fr(x.prochaine) : '']))),
        section('Traitements', tableau(['Médicament', 'Dose', 'Fréquence', 'Début', 'Fin', 'Statut'],
          filtres.traitements.sort(parDate('debut')).map((t) => [t.nom, t.dose, t.frequence, t.debut ? Dates.fr(t.debut) : '', t.fin ? Dates.fr(t.fin) : '', t.statut === 'termine' ? 'Terminé' : 'En cours']))),
        section('Rendez-vous vétérinaires', tableau(['Date', 'Motif', 'Vétérinaire', 'Compte rendu'],
          filtres.rdv.sort(parDate('date')).map((r) => [Dates.frHeure(r.date, r.heure), r.motif, r.veterinaire, r.compteRendu]))),
        section('Notes de santé', tableau(['Date', 'Type', 'Note'],
          notesTriees.map((n) => [Dates.fr(n.date), nomsNotes && Object.prototype.hasOwnProperty.call(nomsNotes, n.categorie) ? nomsNotes[n.categorie] : '',
            (n.texte || '') + (Array.isArray(n.pieces) && n.pieces.length ? ' [' + n.pieces.length + ' document(s) joint(s) dans l’application]' : '')]))),
        sectionAnnexe,
        el('footer', { class: 'carnet-pied', text: 'Cette application sert à organiser tes informations. Elle ne remplace pas l’avis d’un vétérinaire. — Omni-Animalia, © 2026 Ferrus Dantioch' })
      ].filter(Boolean));

      Impression.lancer('Carnet de santé - ' + (a.nom || ''));
    } catch (e) {
      const c = $('#carnet');
      if (c) vider(c);
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};
