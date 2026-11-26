/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-AGENDA — ce qui a une date dans le futur :
   - les rendez-vous vétérinaires d'un animal ;
   - les choses à faire (tâches ponctuelles ou répétées) ;
   - la page « Rappels », qui regroupe tout pour tous les animaux.
   ============================================================ */
'use strict';

const UNITES_RECURRENCE = [
  { valeur: 'jours', texte: 'jour(s)' },
  { valeur: 'semaines', texte: 'semaine(s)' },
  { valeur: 'mois', texte: 'mois' },
  { valeur: 'ans', texte: 'an(s)' }
];

const EcranAgenda = {
  _verrousTaches: new Map(),
  _tourRappels: 0,

  async _avecVerrouTache(id, fn) {
    const prec = this._verrousTaches.get(id) || Promise.resolve();
    let courant;
    courant = prec.catch(() => {}).then(fn).finally(() => {
      if (this._verrousTaches.get(id) === courant) this._verrousTaches.delete(id);
    });
    this._verrousTaches.set(id, courant);
    return courant;
  },

  /* Le lieu d'un rendez-vous : la clinique et l'adresse du vétérinaire
     enregistré sous ce nom (s'il existe). */
  lieu(nomVeto, vetos) {
    if (!nomVeto || typeof nomVeto !== 'string' || !Array.isArray(vetos)) return '';
    const cible = nomVeto.trim().toLowerCase();
    const v = vetos.find((x) => x && typeof x.nom === 'string' && x.nom.trim().toLowerCase() === cible);
    if (!v) return '';
    return [v.clinique, (v.adresse || '').replace(/\s*\n\s*/g, ', ')].filter(Boolean).join(', ');
  },

  /* Les frais vétérinaires notés (coût des rendez-vous), par année */
  blocFrais(rdvs) {
    const liste = Array.isArray(rdvs) ? rdvs : [];
    const avecCout = liste.filter((r) => r && typeof r.cout === 'number' && Number.isFinite(r.cout));
    if (!avecCout.length) return null;
    const parAn = {};
    for (const r of avecCout) {
      const an = typeof r.date === 'string' && /^\d{4}/.test(r.date) ? r.date.slice(0, 4) : 'Date inconnue';
      parAn[an] = (parAn[an] || 0) + r.cout;
    }
    const total = avecCout.reduce((s, r) => s + r.cout, 0);
    const annees = Object.keys(parAn).sort().reverse();
    return el('div', { class: 'encart frais' },
      el('p', { class: 'etiquette', text: 'Frais vétérinaires notés' }),
      annees.map((an) => el('p', { class: 'ligne' }, el('span', { class: 'ligne-libelle', text: an + ' : ' }), el('span', { class: 'mono', text: UI.euros(parAn[an]) }))),
      annees.length > 1 ? el('p', { class: 'ligne' }, el('strong', { text: 'Total : ' }), el('strong', { class: 'mono', text: UI.euros(total) })) : null,
      el('p', { class: 'aide', text: 'Calculé à partir du coût noté dans chaque rendez-vous (' + avecCout.length + ' sur ' + liste.length + ').' }));
  },

  /* ---------- Rendez-vous vétérinaires ---------- */
  async rdv(zone, a) {
    const tous = await BD.parAnimal('rdv', a.id);
    const aujourdhui = Dates.aujourdhui();
    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    const cle = (r) => ((r && r.date) || '') + ' ' + ((r && r.heure) || '');
    const aVenir = tous.filter((r) => (r.date || '') >= aujourdhui)
      .sort((x, y) => cmp(cle(x), cle(y)) || cmp(String((x && x.id) ?? ''), String((y && y.id) ?? '')));
    const passes = tous.filter((r) => (r.date || '') < aujourdhui)
      .sort((x, y) => cmp(cle(y), cle(x)) || cmp(String((y && y.id) ?? ''), String((x && x.id) ?? '')));
    EcranAnimal.entete(zone, 'Rendez-vous vétérinaires', 'Ajouter un rendez-vous', () => this.formulaireRdv(a, null));
    if (!tous.length) return EcranAnimal.message(zone, 'Aucun rendez-vous enregistré.');
    const vetos = await BD.tout('veterinaires');
    const frais = this.blocFrais(tous);
    if (frais) zone.append(frais);

    const carte = (r, passe) => EcranAnimal.carteFiche({
      titre: Dates.frHeure(r.date, r.heure) + (r.motif ? ' — ' + r.motif : ''),
      classe: passe ? 'termine' : '',
      lignes: [
        passe ? null : EcranAnimal.ligne('Quand', Dates.relatif(r.date)),
        EcranAnimal.ligne('Vétérinaire', r.veterinaire),
        EcranAnimal.ligne('Compte rendu', r.compteRendu),
        EcranAnimal.ligne('Coût', typeof r.cout === 'number' && Number.isFinite(r.cout) ? UI.euros(r.cout) : '')],
      autres: a.archive ? null : (passe
        ? (!r.compteRendu ? bouton('Ajouter le compte rendu', () => this.formulaireRdv(a, r), { classe: 'secondaire', icone: 'crayon' }) : null)
        : bouton('Ajouter à Google Agenda', () => Agenda.proposer({
          uid: r.id, titre: (a.nom || '') + ' : rendez-vous vétérinaire' + (r.motif ? ' (' + r.motif + ')' : ''),
          description: [r.veterinaire ? 'Vétérinaire : ' + r.veterinaire : '', 'Ajouté depuis Omni-Animalia.'].filter(Boolean).join('\n'),
          lieu: this.lieu(r.veterinaire, vetos), date: r.date, heure: r.heure || ''
        }), { classe: 'secondaire', icone: 'cloche' })),
      modifier: a.archive ? null : () => this.formulaireRdv(a, r),
      supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('rdv', r, 'Rendez-vous du ' + Dates.fr(r.date))
    });
    zone.append(el('h3', { class: 'sous-titre', text: 'À venir (' + aVenir.length + ')' }));
    if (!aVenir.length) zone.append(el('p', { class: 'discret', text: 'Aucun rendez-vous à venir.' }));
    aVenir.forEach((r) => zone.append(carte(r, false)));
    if (passes.length) {
      zone.append(el('h3', { class: 'sous-titre', text: 'Passés (' + passes.length + ')' }));
      passes.forEach((r) => zone.append(carte(r, true)));
    }
  },

  async formulaireRdv(a, r) {
    try {
      const vetos = await EcranSante.nomsVetos();
      let defaut = '';
      if (!r && a.vetoId) {
        const v = await BD.lire('veterinaires', a.vetoId);
        if (v && v.nom) defaut = v.nom;
      }
      Formulaire.ouvrir({
        titre: (r ? 'Modifier un rendez-vous' : 'Nouveau rendez-vous') + ' — ' + (a.nom || ''),
        valeurs: r || { veterinaire: defaut },
        champs: [
          { nom: 'date', label: 'Date', type: 'date', requis: true },
          { nom: 'heure', label: 'Heure', type: 'heure' },
          { nom: 'motif', label: 'Motif', type: 'texte', requis: true, long: 200 },
          { nom: 'veterinaire', label: 'Vétérinaire', type: 'texte', long: 120, suggestions: vetos },
          { nom: 'compteRendu', label: 'Compte rendu (après la visite)', type: 'zone' },
          { nom: 'cout', label: 'Coût (facultatif)', type: 'nombre', unite: '€', max: 1000000 }
        ],
        enregistrer: async (v) => {
          await BD.enregistrer('rdv', { ...(r || {}), ...v, animalId: a.id });
          return 'Rendez-vous enregistré.';
        }
      });
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- Choses à faire ---------- */
  async taches(zone, a) {
    const toutes = await BD.parAnimal('taches', a.id);
    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    const aFaire = toutes.filter((t) => !t.fait)
      .sort((x, y) => cmp(x.echeance || '9999', y.echeance || '9999') || cmp(String((x && x.id) ?? ''), String((y && y.id) ?? '')));
    const faites = toutes.filter((t) => t.fait)
      .sort((x, y) => cmp(y.faitLe || '', x.faitLe || '') || cmp(String((y && y.id) ?? ''), String((x && x.id) ?? '')));
    EcranAnimal.entete(zone, 'Choses à faire', 'Ajouter une tâche', () => this.formulaireTache(a, null));
    if (!toutes.length) return EcranAnimal.message(zone, 'Aucune tâche. Exemples : brosser, couper les griffes, nettoyer la cage, acheter des croquettes…');

    zone.append(el('h3', { class: 'sous-titre', text: 'À faire (' + aFaire.length + ')' }));
    if (!aFaire.length) zone.append(el('p', { class: 'discret', text: 'Tout est fait.' }));
    for (const t of aFaire) zone.append(this.carteTache(a, t));
    if (faites.length) {
      zone.append(el('h3', { class: 'sous-titre', text: 'Faites (' + faites.length + ')' }));
      for (const t of faites.slice(0, 30)) zone.append(this.carteTache(a, t));
      if (faites.length > 30) zone.append(el('p', { class: 'discret', text: 'Seules les 30 dernières tâches faites sont affichées.' }));
    }
  },

  carteTache(a, t) {
    const rec = Dates.texteRecurrence(t.recN, t.recUnite);
    const titreTache = t.titre || 'Tâche sans titre';
    return EcranAnimal.carteFiche({
      titre: titreTache,
      classe: t.fait ? 'termine' : '',
      lignes: [
        EcranAnimal.ligne('Échéance', t.echeance ? Dates.fr(t.echeance) : 'aucune date', t.echeance && !t.fait ? EcranSante.echeance(t.echeance) : null),
        EcranAnimal.ligne('Répétition', rec ? rec.charAt(0).toUpperCase() + rec.slice(1) : 'Une seule fois'),
        t.fait ? EcranAnimal.ligne('Faite le', Dates.fr(t.faitLe)) : null,
        EcranAnimal.ligne('Note', t.note)],
      autres: a.archive ? null : (t.fait
        ? bouton('Annuler « fait »', () => this.annulerFait(t), { classe: 'secondaire', icone: 'restaurer' })
        : bouton('Marquer comme fait', () => this.marquerFait(t), { classe: 'principal', icone: 'coche' })),
      modifier: a.archive || t.fait ? null : () => this.formulaireTache(a, t),
      supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('taches', t, titreTache)
    });
  },

  formulaireTache(a, t) {
    const valeurs = t
      ? { ...t, repete: t.recN && t.recUnite ? 'oui' : 'non' }
      : { repete: 'non', recN: 1, recUnite: 'semaines', echeance: Dates.aujourdhui() };
    Formulaire.ouvrir({
      titre: (t ? 'Modifier une tâche' : 'Nouvelle tâche') + ' — ' + (a.nom || ''),
      valeurs,
      champs: [
        { nom: 'titre', label: 'Que faut-il faire ?', type: 'texte', requis: true, long: 200 },
        { nom: 'echeance', label: 'Date d’échéance', type: 'date', aide: 'Obligatoire pour une tâche qui se répète.' },
        { nom: 'repete', label: 'Répétition', type: 'radios', requis: true, options: [{ valeur: 'non', texte: 'Une seule fois' }, { valeur: 'oui', texte: 'Se répète' }] },
        { nom: 'recN', label: 'Tous les…', type: 'nombre', entier: true, positif: true, max: 999, visibleSi: (v) => v.repete === 'oui' },
        { nom: 'recUnite', label: 'Unité', type: 'choix', options: UNITES_RECURRENCE, visibleSi: (v) => v.repete === 'oui',
          aide: 'Quand tu coches « fait », la tâche suivante est créée automatiquement, au même rythme.' },
        { nom: 'note', label: 'Note', type: 'zone' }
      ],
      valider: (v) => {
        const e = {};
        if (v.repete === 'oui') {
          if (!v.echeance) e.echeance = 'Indique une date : elle sert de point de départ à la répétition.';
          if (v.recN === null || v.recN === undefined) e.recN = 'Indique tous les combien (exemple : 2).';
        }
        return e;
      },
      enregistrer: async (v) => {
        const fiche = { ...(t || { fait: false }), animalId: a.id, titre: v.titre, echeance: v.echeance, note: v.note };
        if (v.repete === 'oui') {
          fiche.recN = v.recN;
          fiche.recUnite = v.recUnite;
          // Jour du mois d'origine : une tâche du 31 reviendra au 31 quand c'est possible
          const dEch = Dates.lire(v.echeance);
          if (dEch) fiche.recJour = dEch.getDate();
        } else {
          delete fiche.recN; delete fiche.recUnite; delete fiche.recJour;
        }
        await BD.enregistrer('taches', fiche);
        return 'Tâche enregistrée.';
      }
    });
  },

  /* Coche une tâche. Si elle se répète, la suivante est créée dans la
     même opération (tout ou rien : jamais l'une sans l'autre). */
  async marquerFait(t, apres) {
    if (!t || !t.id) return;
    return this._avecVerrouTache(t.id, async () => {
      try {
        const frais = await BD.lire('taches', t.id);
        if (!frais) {
          UI.annoncer('Cette tâche n’existe plus.', 'erreur');
          if (apres) await apres();
          else if (EcranAnimal.animal) await EcranAnimal.rafraichir();
          return;
        }
        if (frais.fait) return;
        const aujourdhui = Dates.aujourdhui();
        const fait = { ...frais, fait: true, faitLe: aujourdhui };
        delete fait.suivanteId;
        let suivante = null;
        let horsLimite = false;
        if (frais.recN && frais.recUnite && frais.echeance) {
          const prochaine = Dates.prochaineEcheance(frais.echeance, frais.recN, frais.recUnite, frais.recJour, aujourdhui);
          if (prochaine) {
            suivante = {
              id: BD.nouvelId(), animalId: frais.animalId, titre: frais.titre, note: frais.note,
              recN: frais.recN, recUnite: frais.recUnite, recJour: frais.recJour, fait: false,
              echeance: prochaine
            };
            if (frais.exemple) suivante.exemple = true;
            fait.suivanteId = suivante.id;
          } else {
            horsLimite = true;
          }
        }
        const tx = await BD._transaction('taches', 'readwrite');
        tx.objectStore('taches').put(nettoyerFiche('taches', fait));
        if (suivante) tx.objectStore('taches').put(nettoyerFiche('taches', suivante));
        await BD.finTransaction(tx);
        UI.annoncer(suivante
          ? 'C’est noté. Prochaine fois : le ' + Dates.fr(suivante.echeance) + '.'
          : (horsLimite ? 'C’est noté : tâche faite. Aucune tâche suivante créée (échéance au-delà de 2200).' : 'C’est noté : tâche faite.'));
        if (apres) await apres();
        else if (EcranAnimal.animal) await EcranAnimal.rafraichir();
        Nav.majPastille();
      } catch (e) {
        UI.annoncer(UI.messageErreur(e), 'erreur');
      }
    });
  },

  /* Décoche une tâche. La tâche suivante créée automatiquement est
     retirée, si elle n'a pas encore été faite. */
  async annulerFait(t) {
    if (!t || !t.id) return;
    return this._avecVerrouTache(t.id, async () => {
      try {
        const frais = await BD.lire('taches', t.id);
        if (!frais) {
          UI.annoncer('Cette tâche n’existe plus.', 'erreur');
          if (EcranAnimal.animal) await EcranAnimal.rafraichir();
          return;
        }
        if (!frais.fait) return;
        const fiche = { ...frais, fait: false };
        delete fiche.faitLe;
        const tx = await BD._transaction('taches', 'readwrite');
        const magasin = tx.objectStore('taches');
        if (frais.suivanteId) {
          magasin.get(frais.suivanteId).onsuccess = (e) => {
            const s = e.target.result;
            if (s && !s.fait) magasin.delete(s.id);
          };
          delete fiche.suivanteId;
        }
        magasin.put(nettoyerFiche('taches', fiche));
        await BD.finTransaction(tx);
        UI.annoncer('La tâche est de nouveau à faire.');
        if (EcranAnimal.animal) await EcranAnimal.rafraichir();
        Nav.majPastille();
      } catch (e) {
        UI.annoncer(UI.messageErreur(e), 'erreur');
      }
    });
  },

  /* ---------- La page « Rappels » ---------- */
  async afficherRappels() {
    const tour = ++this._tourRappels;
    const d = await BD.toutLire();
    if (tour !== this._tourRappels || ($('#verrou') && !$('#verrou').hidden)) return;
    const frag = document.createDocumentFragment();
    if (!d.animaux.some((a) => !a.archive)) {
      frag.append(el('p', { class: 'encart vide', text: 'Aucun animal pour l’instant : aucun rappel.' }));
      vider($('#rappels-liste')).append(frag);
      return;
    }
    this._vetos = d.veterinaires;

    // Médicaments du jour : les traitements en cours avec « prises par jour »
    const aujourdhui = Dates.aujourdhui();
    const actifs = new Map(d.animaux.filter((a) => !a.archive).map((a) => [a.id, a]));
    const medicaments = d.traitements.filter((t) => t.statut !== 'termine' && t.prisesParJour && actifs.has(t.animalId) &&
      (!t.debut || t.debut <= aujourdhui));
    if (medicaments.length) {
      const section = el('section', { class: 'groupe-rappels medicaments', 'aria-labelledby': 'rappels-medicaments' },
        el('h2', { id: 'rappels-medicaments', text: 'Médicaments du jour (' + medicaments.length + ')' }));
      for (const t of medicaments) {
        const animal = actifs.get(t.animalId);
        const enRetard = t.fin && Dates.estValide(t.fin) && t.fin < aujourdhui;
        section.append(el('article', { class: 'carte carte-rappel' },
          el('p', { class: 'etiquette', text: (animal && animal.nom) || '' }),
          el('h3', { class: 'carte-titre', text: t.nom || '' }),
          t.dose || t.frequence ? el('p', { class: 'carte-detail', text: [t.dose, t.frequence].filter(Boolean).join(' — ') }) : null,
          enRetard ? el('p', { class: 'carte-detail etat retard', text: 'Fin prévue le ' + Dates.fr(t.fin) + ' (' + Dates.relatif(t.fin) + ') — toujours en cours' }) : null,
          EcranSante.blocPrises(t, () => this.rafraichirRappels())));
      }
      frag.append(section);
    }

    const tous = Rappels.calculer(d);
    const g = Rappels.grouper(tous);
    const groupes = [
      { cle: 'retard', titre: 'En retard', classe: 'retard' },
      { cle: 'aujourdhui', titre: 'Aujourd’hui', classe: 'bientot' },
      { cle: 'semaine', titre: 'Dans les 7 jours', classe: '' },
      { cle: 'mois', titre: 'Dans les 30 jours', classe: '' }
    ];
    for (const groupe of groupes) {
      const liste = g[groupe.cle];
      const section = el('section', { class: 'groupe-rappels ' + groupe.classe, 'aria-labelledby': 'rappels-' + groupe.cle },
        el('h2', { id: 'rappels-' + groupe.cle, text: groupe.titre + ' (' + liste.length + ')' }));
      if (!liste.length) section.append(el('p', { class: 'discret', text: 'Rien.' }));
      for (const r of liste) section.append(this.carteRappel(r));
      frag.append(section);
    }
    if (g.plusTard.length) {
      frag.append(el('p', { class: 'discret', text: g.plusTard.length + ' autre(s) rappel(s) plus lointain(s), visibles dans la fiche de chaque animal.' }));
    }

    // Tout envoyer d'un coup vers l'agenda du téléphone
    const aVenir = tous.filter((r) => r.ecart >= 0);
    if (aVenir.length) {
      frag.append(el('details', { class: 'filtre', id: 'agenda-tout' },
        el('summary', { text: 'Tous les rappels dans un fichier d’agenda' }),
        el('p', { class: 'aide', text: 'Pour ajouter d’un coup les ' + aVenir.length + ' rappels à venir à un agenda. Sur un téléphone Android, Google Agenda ne sait pas ouvrir ce fichier : utilise plutôt « Ajouter à Google Agenda » sur chaque rappel.' }),
        el('p', { class: 'aide', text: 'Sur un ordinateur : ouvre calendar.google.com, puis Paramètres → Importer et exporter → Importer, et choisis ce fichier. D’autres agendas (Samsung Agenda…) l’ouvrent directement.' }),
        bouton('Télécharger le fichier d’agenda', () => Agenda.envoyerFichier(
          aVenir.map((r) => Agenda.depuisRappel(r, r.type === 'rdv' ? this.lieuRappel(r, d) : '')), 'omni-animalia-rappels-' + Dates.aujourdhui()),
        { classe: 'secondaire large', icone: 'sauver', id: 'bouton-agenda-tout' })));
    }
    vider($('#rappels-liste')).append(frag);
  },

  /* Redessine la page Rappels en gardant la position de l'écran */
  async rafraichirRappels() {
    try {
      const y = window.scrollY;
      const tour = this._tourRappels + 1;
      await this.afficherRappels();
      if (this._tourRappels === tour) {
        window.scrollTo(0, y);
        Nav.majPastille();
      }
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* Le lieu d'un rendez-vous de la page Rappels */
  lieuRappel(r, d) {
    const rdv = d.rdv.find((x) => x.id === r.id);
    return rdv ? this.lieu(rdv.veterinaire, d.veterinaires) : '';
  },

  carteRappel(r) {
    const heureTxt = r.heure && Dates.heureValide(r.heure) ? ' à ' + Dates.frHeure(r.date, r.heure).split(' à ')[1] : '';
    const quand = Dates.fr(r.date) + heureTxt + ' — ' + Dates.relatif(r.date);
    const actions = el('div', { class: 'rangee-boutons' },
      bouton('Voir la fiche', () => Nav.aller({ vue: 'animal', id: r.animalId, section: r.section }), { classe: 'secondaire' }));
    if (r.ecart >= 0) {
      actions.append(bouton('Ajouter à Google Agenda', async () => {
        try {
          const d = { rdv: r.type === 'rdv' ? [await BD.lire('rdv', r.id)].filter(Boolean) : [], veterinaires: this._vetos || [] };
          await Agenda.proposer(Agenda.depuisRappel(r, r.type === 'rdv' ? this.lieuRappel(r, d) : ''));
        } catch (e) {
          UI.annoncer(UI.messageErreur(e), 'erreur');
        }
      }, { classe: 'secondaire', icone: 'cloche' }));
    }
    if (r.type === 'tache') {
      actions.prepend(bouton('Marquer comme fait', async () => {
        try {
          const t = await BD.lire('taches', r.id);
          if (!t) {
            UI.annoncer('Cette tâche n’existe plus.', 'erreur');
            await this.afficherRappels();
            Nav.majPastille();
            return;
          }
          await this.marquerFait(t, async () => { await this.afficherRappels(); Nav.majPastille(); $('[data-vue="rappels"] h1').focus(); });
        } catch (e) {
          UI.annoncer(UI.messageErreur(e), 'erreur');
        }
      }, { classe: 'principal', icone: 'coche' }));
    }
    return el('article', { class: 'carte carte-rappel' },
      el('p', { class: 'etiquette', text: r.animalNom || '' }),
      el('h3', { class: 'carte-titre', text: r.titre || '' }),
      el('p', { class: 'carte-detail', text: quand }),
      actions);
  }
};
