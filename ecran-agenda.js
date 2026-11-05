/* Omni-Animaux — © 2026 Ferrus Dantioch
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

  /* ---------- Rendez-vous vétérinaires ---------- */
  async rdv(zone, a) {
    const tous = await BD.parAnimal('rdv', a.id);
    const aujourdhui = Dates.aujourdhui();
    const cle = (r) => r.date + ' ' + (r.heure || '');
    const aVenir = tous.filter((r) => r.date >= aujourdhui).sort((x, y) => (cle(x) < cle(y) ? -1 : 1));
    const passes = tous.filter((r) => r.date < aujourdhui).sort((x, y) => (cle(x) < cle(y) ? 1 : -1));
    EcranAnimal.entete(zone, 'Rendez-vous vétérinaires', 'Ajouter un rendez-vous', () => this.formulaireRdv(a, null));
    if (!tous.length) return EcranAnimal.message(zone, 'Aucun rendez-vous enregistré.');

    const carte = (r, passe) => EcranAnimal.carteFiche({
      titre: Dates.frHeure(r.date, r.heure) + (r.motif ? ' — ' + r.motif : ''),
      classe: passe ? 'termine' : '',
      lignes: [
        passe ? null : EcranAnimal.ligne('Quand', Dates.relatif(r.date)),
        EcranAnimal.ligne('Vétérinaire', r.veterinaire),
        EcranAnimal.ligne('Compte rendu', r.compteRendu),
        EcranAnimal.ligne('Coût', typeof r.cout === 'number' ? UI.euros(r.cout) : '')],
      autres: passe && !r.compteRendu && !a.archive
        ? bouton('Ajouter le compte rendu', () => this.formulaireRdv(a, r), { classe: 'secondaire', icone: 'crayon' }) : null,
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
    const vetos = await EcranSante.nomsVetos();
    let defaut = '';
    if (!r && a.vetoId) {
      const v = await BD.lire('veterinaires', a.vetoId);
      if (v) defaut = v.nom;
    }
    Formulaire.ouvrir({
      titre: (r ? 'Modifier un rendez-vous' : 'Nouveau rendez-vous') + ' — ' + a.nom,
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
  },

  /* ---------- Choses à faire ---------- */
  async taches(zone, a) {
    const toutes = await BD.parAnimal('taches', a.id);
    const aFaire = toutes.filter((t) => !t.fait).sort((x, y) => ((x.echeance || '9999') < (y.echeance || '9999') ? -1 : 1));
    const faites = toutes.filter((t) => t.fait).sort((x, y) => ((x.faitLe || '') < (y.faitLe || '') ? 1 : -1));
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
    return EcranAnimal.carteFiche({
      titre: t.titre,
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
      supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('taches', t, t.titre)
    });
  },

  formulaireTache(a, t) {
    const valeurs = t
      ? { ...t, repete: t.recN && t.recUnite ? 'oui' : 'non' }
      : { repete: 'non', recN: 1, recUnite: 'semaines', echeance: Dates.aujourdhui() };
    Formulaire.ouvrir({
      titre: (t ? 'Modifier une tâche' : 'Nouvelle tâche') + ' — ' + a.nom,
      valeurs,
      champs: [
        { nom: 'titre', label: 'Que faut-il faire ?', type: 'texte', requis: true, long: 200 },
        { nom: 'echeance', label: 'Date d’échéance', type: 'date', aide: 'Obligatoire pour une tâche qui se répète.' },
        { nom: 'repete', label: 'Répétition', type: 'radios', requis: true, options: [{ valeur: 'non', texte: 'Une seule fois' }, { valeur: 'oui', texte: 'Se répète' }] },
        { nom: 'recN', label: 'Tous les…', type: 'nombre', entier: true, positif: true, max: 999, visibleSi: (v) => v.repete === 'oui' },
        { nom: 'recUnite', label: 'Unité', type: 'choix', options: UNITES_RECURRENCE, visibleSi: (v) => v.repete === 'oui',
          aide: 'Quand vous cochez « fait », la tâche suivante est créée automatiquement, au même rythme.' },
        { nom: 'note', label: 'Note', type: 'zone' }
      ],
      valider: (v) => {
        const e = {};
        if (v.repete === 'oui') {
          if (!v.echeance) e.echeance = 'Indiquez une date : elle sert de point de départ à la répétition.';
          if (v.recN === null || v.recN === undefined) e.recN = 'Indiquez tous les combien (exemple : 2).';
        }
        return e;
      },
      enregistrer: async (v) => {
        const fiche = { ...(t || { fait: false }), animalId: a.id, titre: v.titre, echeance: v.echeance, note: v.note };
        if (v.repete === 'oui') {
          fiche.recN = v.recN;
          fiche.recUnite = v.recUnite;
          // Jour du mois d'origine : une tâche du 31 reviendra au 31 quand c'est possible
          fiche.recJour = Dates.lire(v.echeance).getDate();
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
    try {
      const aujourdhui = Dates.aujourdhui();
      const fait = { ...t, fait: true, faitLe: aujourdhui };
      let suivante = null;
      if (t.recN && t.recUnite && t.echeance) {
        suivante = {
          id: BD.nouvelId(), animalId: t.animalId, titre: t.titre, note: t.note,
          recN: t.recN, recUnite: t.recUnite, recJour: t.recJour, fait: false,
          echeance: Dates.prochaineEcheance(t.echeance, t.recN, t.recUnite, t.recJour, aujourdhui)
        };
        if (t.exemple) suivante.exemple = true;
        fait.suivanteId = suivante.id;
      }
      const tx = BD.base.transaction('taches', 'readwrite');
      tx.objectStore('taches').put(nettoyerFiche('taches', fait));
      if (suivante) tx.objectStore('taches').put(nettoyerFiche('taches', suivante));
      await BD.finTransaction(tx);
      UI.annoncer(suivante
        ? 'C’est noté. Prochaine fois : le ' + Dates.fr(suivante.echeance) + '.'
        : 'C’est noté : tâche faite.');
      if (apres) await apres();
      else await EcranAnimal.rafraichir();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* Décoche une tâche. La tâche suivante créée automatiquement est
     retirée, si elle n'a pas encore été faite. */
  async annulerFait(t) {
    try {
      const fiche = { ...t, fait: false };
      delete fiche.faitLe;
      const tx = BD.base.transaction('taches', 'readwrite');
      const magasin = tx.objectStore('taches');
      if (t.suivanteId) {
        magasin.get(t.suivanteId).onsuccess = (e) => {
          const s = e.target.result;
          if (s && !s.fait) magasin.delete(s.id);
        };
        delete fiche.suivanteId;
      }
      magasin.put(nettoyerFiche('taches', fiche));
      await BD.finTransaction(tx);
      UI.annoncer('La tâche est de nouveau à faire.');
      await EcranAnimal.rafraichir();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  /* ---------- La page « Rappels » ---------- */
  async afficherRappels() {
    const d = await BD.toutLire();
    const zone = vider($('#rappels-liste'));
    if (!d.animaux.some((a) => !a.archive)) {
      zone.append(el('p', { class: 'encart vide', text: 'Aucun animal pour l’instant : aucun rappel.' }));
      return;
    }
    const g = Rappels.grouper(Rappels.calculer(d));
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
      zone.append(section);
    }
    if (g.plusTard.length) {
      zone.append(el('p', { class: 'discret', text: g.plusTard.length + ' autre(s) rappel(s) plus lointain(s), visibles dans la fiche de chaque animal.' }));
    }
  },

  carteRappel(r) {
    const quand = Dates.fr(r.date) + (r.heure ? ' à ' + Dates.frHeure(r.date, r.heure).split(' à ')[1] : '') + ' — ' + Dates.relatif(r.date);
    const actions = el('div', { class: 'rangee-boutons' },
      bouton('Voir la fiche', () => Nav.aller({ vue: 'animal', id: r.animalId, section: r.section }), { classe: 'secondaire' }));
    if (r.type === 'tache') {
      actions.prepend(bouton('Marquer comme fait', async () => {
        const t = await BD.lire('taches', r.id);
        if (t) await this.marquerFait(t, async () => { await this.afficherRappels(); Nav.majPastille(); $('[data-vue="rappels"] h1').focus(); });
      }, { classe: 'principal', icone: 'coche' }));
    }
    return el('article', { class: 'carte carte-rappel' },
      el('p', { class: 'etiquette', text: r.animalNom }),
      el('h3', { class: 'carte-titre', text: r.titre }),
      el('p', { class: 'carte-detail', text: quand }),
      actions);
  }
};
