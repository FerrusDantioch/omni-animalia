/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-SANTE — les parties « santé » de la fiche d'un animal :
   poids, vaccins, vermifuges et antiparasitaires, traitements,
   notes de santé.
   ============================================================ */
'use strict';

/* Noms de vaccins COURANTS proposés pendant la saisie, selon l'espèce.
   Ce ne sont que des propositions pour taper plus vite : aucun
   calendrier n'est jamais rempli à la place de la personne. */
const VACCINS_COURANTS = {
  chien: ['CHPPiL', 'CHPL', 'Maladie de Carré', 'Hépatite de Rubarth', 'Parvovirose', 'Parainfluenza', 'Leptospirose', 'Rage', 'Toux du chenil', 'Piroplasmose', 'Maladie de Lyme', 'Leishmaniose'],
  chat: ['Typhus (panleucopénie)', 'Coryza', 'Typhus et coryza', 'Leucose féline (FeLV)', 'Chlamydiose', 'Rage'],
  lapin: ['Myxomatose', 'Maladie hémorragique virale (VHD)', 'VHD type 2', 'Myxomatose et VHD'],
  furet: ['Maladie de Carré', 'Rage'],
  cheval: ['Grippe équine', 'Rhinopneumonie', 'Tétanos', 'Rage', 'Fièvre du Nil occidental'],
  oiseau: ['Maladie de Newcastle', 'Variole aviaire'],
  autre: ['Rage', 'Tétanos']
};

const EcranSante = {
  NOMS_AP: { vermifuge: 'Vermifuge', 'anti-puces': 'Anti-puces', 'anti-tiques': 'Anti-tiques', autre: 'Autre antiparasitaire' },
  NOMS_NOTES: { symptome: 'Symptôme', observation: 'Observation', examen: 'Résultat d’examen', allergie: 'Allergie', antecedent: 'Antécédent', autre: 'Autre' },
  filtreNotes: { du: '', au: '', categorie: '' },

  /* Les propositions de vaccins pour une espèce (saisie libre) */
  suggestionsVaccins(espece) {
    const e = (espece || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/chien|chiot/.test(e)) return VACCINS_COURANTS.chien;
    if (/chat|chaton/.test(e)) return VACCINS_COURANTS.chat;
    if (/lapin/.test(e)) return VACCINS_COURANTS.lapin;
    if (/furet/.test(e)) return VACCINS_COURANTS.furet;
    if (/cheval|poney|ane|mule/.test(e)) return VACCINS_COURANTS.cheval;
    if (/oiseau|poule|perroquet|canard|pigeon/.test(e)) return VACCINS_COURANTS.oiseau;
    return VACCINS_COURANTS.autre;
  },

  /* Les noms des vétérinaires enregistrés (pour la saisie semi-automatique) */
  async nomsVetos() {
    return (await BD.tout('veterinaires')).map((v) => v.nom).sort((a, b) => a.localeCompare(b, 'fr'));
  },

  /* Trie du plus récent au plus ancien */
  recentsDabord(liste, champ) {
    return liste.sort((a, b) => ((a[champ] || '') < (b[champ] || '') ? 1 : (a[champ] || '') > (b[champ] || '') ? -1 : 0));
  },

  /* « dans 5 jours », « en retard de 2 jours »… avec la classe de couleur */
  echeance(date) {
    const n = Dates.ecartJours(Dates.aujourdhui(), date);
    const classe = n < 0 ? 'etat retard' : n <= 7 ? 'etat bientot' : 'etat';
    return el('span', { class: classe, text: ' (' + Dates.relatif(date) + ')' });
  },

  /* ---------- Poids ---------- */
  async poids(zone, a) {
    const unite = a.unitePoids === 'g' ? 'g' : 'kg';
    const pesees = this.recentsDabord(await BD.parAnimal('pesees', a.id), 'date');
    EcranAnimal.entete(zone, 'Poids', 'Ajouter une pesée', () => this.formulairePesee(a, null));
    if (!pesees.length) return EcranAnimal.message(zone, 'Aucune pesée enregistrée.');

    const conv = (g) => Graphique.convertir(g, unite);
    const derniere = pesees[0];
    zone.append(el('p', { class: 'chiffre-cle' },
      el('span', { class: 'discret', text: 'Dernier poids : ' }),
      el('strong', { class: 'mono', text: UI.nombre(conv(derniere.grammes)) + ' ' + unite }),
      el('span', { class: 'discret', text: ' le ' + Dates.fr(derniere.date) })));

    const dessin = Graphique.courbePoids(pesees, unite);
    if (dessin) zone.append(el('figure', { class: 'carte figure-graphique' }, dessin,
      el('figcaption', { class: 'aide', text: pesees.length > 1 ? 'Évolution du poids (' + unite + ')' : 'Ajoute une deuxième pesée pour voir une courbe.' })));

    zone.append(el('h3', { class: 'sous-titre', text: 'Historique des pesées' }));
    pesees.forEach((p, i) => {
      const precedente = pesees[i + 1];
      let variation = null;
      if (precedente) {
        const diff = conv(p.grammes) - conv(precedente.grammes);
        const arrondi = Math.round(diff * 1000) / 1000;
        const texte = arrondi === 0 ? 'inchangé' : (arrondi > 0 ? '+' : '−') + UI.nombre(Math.abs(arrondi)) + ' ' + unite;
        variation = EcranAnimal.ligne('Variation', texte + ' depuis le ' + Dates.fr(precedente.date));
      }
      zone.append(EcranAnimal.carteFiche({
        titre: UI.nombre(conv(p.grammes)) + ' ' + unite + ' — ' + Dates.fr(p.date),
        lignes: [variation, EcranAnimal.ligne('Note', p.note)],
        modifier: a.archive ? null : () => this.formulairePesee(a, p),
        supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('pesees', p, 'Pesée du ' + Dates.fr(p.date))
      }));
    });
  },

  formulairePesee(a, pesee) {
    const unite = a.unitePoids === 'g' ? 'g' : 'kg';
    const valeurs = pesee
      ? { date: pesee.date, valeur: Graphique.convertir(pesee.grammes, unite), note: pesee.note }
      : { date: Dates.aujourdhui() };
    Formulaire.ouvrir({
      titre: (pesee ? 'Modifier une pesée' : 'Nouvelle pesée') + ' — ' + a.nom,
      valeurs,
      champs: [
        { nom: 'date', label: 'Date de la pesée', type: 'date', requis: true, pasDansFutur: true },
        { nom: 'valeur', label: 'Poids', type: 'nombre', requis: true, positif: true, unite, max: unite === 'kg' ? 3000 : 3000000,
          aide: unite === 'kg' ? 'En kilogrammes. Exemple : 4,5' : 'En grammes. Exemple : 850' },
        { nom: 'note', label: 'Note (facultative)', type: 'texte', long: 300 }
      ],
      enregistrer: async (v) => {
        const grammes = unite === 'kg' ? Math.round(v.valeur * 1000 * 10) / 10 : Math.round(v.valeur * 10) / 10;
        await BD.enregistrer('pesees', { ...(pesee || {}), animalId: a.id, date: v.date, grammes, note: v.note });
        return 'Pesée enregistrée.';
      }
    });
  },

  /* ---------- Vaccins ---------- */
  async vaccins(zone, a) {
    const liste = this.recentsDabord(await BD.parAnimal('vaccins', a.id), 'date');
    EcranAnimal.entete(zone, 'Vaccins', 'Ajouter un vaccin', () => this.formulaireVaccin(a, null));
    if (!liste.length) return EcranAnimal.message(zone, 'Aucun vaccin enregistré.');

    // Seul le DERNIER vaccin de chaque nom porte le rappel « actif »
    const vus = new Set();
    for (const v of liste) {
      const cle = v.nom.trim().toLowerCase();
      const actif = !vus.has(cle);
      vus.add(cle);
      const rappel = v.rappel
        ? EcranAnimal.ligne('Prochain rappel', Dates.fr(v.rappel), actif ? this.echeance(v.rappel) : el('span', { class: 'discret', text: ' (déjà renouvelé)' }))
        : null;
      zone.append(EcranAnimal.carteFiche({
        titre: v.nom,
        lignes: [
          EcranAnimal.ligne('Date', Dates.fr(v.date)), rappel,
          EcranAnimal.ligne('Vétérinaire', v.veterinaire), EcranAnimal.ligne('Numéro de lot', v.lot),
          EcranAnimal.ligne('Note', v.note)],
        autres: actif && v.rappel && !a.archive
          ? bouton('Noter le rappel fait', () => this.formulaireVaccin(a, null, { nom: v.nom, veterinaire: v.veterinaire, date: Dates.aujourdhui() }), { classe: 'secondaire', icone: 'coche' })
          : null,
        modifier: a.archive ? null : () => this.formulaireVaccin(a, v),
        supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('vaccins', v, v.nom + ' du ' + Dates.fr(v.date))
      }));
    }
  },

  async formulaireVaccin(a, vaccin, depart) {
    const vetos = await this.nomsVetos();
    Formulaire.ouvrir({
      titre: (vaccin ? 'Modifier un vaccin' : 'Nouveau vaccin') + ' — ' + a.nom,
      valeurs: vaccin || depart || { date: Dates.aujourdhui() },
      champs: [
        { nom: 'nom', label: 'Nom du vaccin', type: 'texte', requis: true, long: 120, suggestions: this.suggestionsVaccins(a.espece),
          aide: 'Des noms courants sont proposés pendant la saisie. Rien n’est rempli à ta place : reporte ce qui est écrit sur le carnet ou l’ordonnance.' },
        { nom: 'date', label: 'Date de la vaccination', type: 'date', requis: true, pasDansFutur: true },
        { nom: 'rappel', label: 'Date du prochain rappel', type: 'date', aide: 'Celle indiquée par le vétérinaire. Laisse vide si aucun rappel n’est prévu.' },
        { nom: 'veterinaire', label: 'Vétérinaire', type: 'texte', long: 120, suggestions: vetos },
        { nom: 'lot', label: 'Numéro de lot (facultatif)', type: 'texte', long: 60 },
        { nom: 'note', label: 'Note', type: 'zone' }
      ],
      valider: (v) => (v.rappel && v.date && v.rappel <= v.date ? { rappel: 'Le rappel doit être après la date de vaccination.' } : {}),
      enregistrer: async (v) => {
        await BD.enregistrer('vaccins', { ...(vaccin || {}), ...v, animalId: a.id });
        return 'Vaccin enregistré.';
      }
    });
  },

  /* ---------- Vermifuges et antiparasitaires ---------- */
  async antiparasitaires(zone, a) {
    const liste = this.recentsDabord(await BD.parAnimal('antiparasitaires', a.id), 'date');
    EcranAnimal.entete(zone, 'Vermifuges et antiparasitaires', 'Ajouter une prise', () => this.formulaireAP(a, null));
    if (!liste.length) return EcranAnimal.message(zone, 'Aucune prise enregistrée.');
    const vus = new Set();
    for (const x of liste) {
      const cle = x.type === 'autre' ? 'autre:' + (x.produit || '').trim().toLowerCase() : x.type;
      const actif = !vus.has(cle);
      vus.add(cle);
      const prochaine = x.prochaine
        ? EcranAnimal.ligne('Prochaine prise', Dates.fr(x.prochaine), actif ? this.echeance(x.prochaine) : el('span', { class: 'discret', text: ' (déjà faite)' }))
        : null;
      zone.append(EcranAnimal.carteFiche({
        titre: this.NOMS_AP[x.type] + (x.produit ? ' — ' + x.produit : ''),
        lignes: [EcranAnimal.ligne('Date', Dates.fr(x.date)), prochaine, EcranAnimal.ligne('Dose', x.dose), EcranAnimal.ligne('Note', x.note)],
        autres: actif && x.prochaine && !a.archive
          ? bouton('Noter la prise suivante', () => this.formulaireAP(a, null, { type: x.type, produit: x.produit, dose: x.dose, date: Dates.aujourdhui() }), { classe: 'secondaire', icone: 'coche' })
          : null,
        modifier: a.archive ? null : () => this.formulaireAP(a, x),
        supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('antiparasitaires', x, this.NOMS_AP[x.type] + ' du ' + Dates.fr(x.date))
      }));
    }
  },

  formulaireAP(a, fiche, depart) {
    Formulaire.ouvrir({
      titre: (fiche ? 'Modifier une prise' : 'Nouvelle prise') + ' — ' + a.nom,
      valeurs: fiche || depart || { date: Dates.aujourdhui() },
      champs: [
        { nom: 'type', label: 'Type', type: 'radios', requis: true, options: Object.entries(this.NOMS_AP).map(([valeur, texte]) => ({ valeur, texte })) },
        { nom: 'produit', label: 'Produit', type: 'texte', long: 120 },
        { nom: 'date', label: 'Date de la prise', type: 'date', requis: true, pasDansFutur: true },
        { nom: 'prochaine', label: 'Date de la prochaine prise', type: 'date' },
        { nom: 'dose', label: 'Dose', type: 'texte', long: 100, placeholder: 'exemple : 1 comprimé' },
        { nom: 'note', label: 'Note', type: 'zone' }
      ],
      valider: (v) => (v.prochaine && v.date && v.prochaine <= v.date ? { prochaine: 'La prochaine prise doit être après celle-ci.' } : {}),
      enregistrer: async (v) => {
        await BD.enregistrer('antiparasitaires', { ...(fiche || {}), ...v, animalId: a.id });
        return 'Prise enregistrée.';
      }
    });
  },

  /* ---------- Traitements et médicaments ---------- */
  async traitements(zone, a) {
    const liste = this.recentsDabord(await BD.parAnimal('traitements', a.id), 'debut');
    EcranAnimal.entete(zone, 'Traitements et médicaments', 'Ajouter un traitement', () => this.formulaireTraitement(a, null));
    if (!liste.length) return EcranAnimal.message(zone, 'Aucun traitement enregistré.');
    const enCours = liste.filter((t) => t.statut !== 'termine');
    const finis = liste.filter((t) => t.statut === 'termine');
    const carte = (t) => EcranAnimal.carteFiche({
      titre: t.nom,
      classe: t.statut === 'termine' ? 'termine' : '',
      lignes: [
        EcranAnimal.ligne('Statut', t.statut === 'termine' ? 'Terminé' : 'En cours'),
        EcranAnimal.ligne('Dose', t.dose), EcranAnimal.ligne('Fréquence', t.frequence),
        EcranAnimal.ligne('Début', t.debut ? Dates.fr(t.debut) : ''),
        EcranAnimal.ligne('Fin', t.fin ? Dates.fr(t.fin) : '', t.fin && t.statut !== 'termine' ? this.echeance(t.fin) : null),
        t.prisesParJour ? EcranAnimal.ligne('Prises par jour', String(t.prisesParJour)) : null,
        EcranAnimal.ligne('Note', t.note),
        t.statut !== 'termine' && t.prisesParJour ? this.blocPrises(t, a.archive ? null : () => EcranAnimal.rafraichir()) : null],
      autres: t.statut !== 'termine' && !a.archive ? bouton('Marquer terminé', () => this.terminer(t), { classe: 'secondaire', icone: 'coche' }) : null,
      modifier: a.archive ? null : () => this.formulaireTraitement(a, t),
      supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('traitements', t, t.nom)
    });
    zone.append(el('h3', { class: 'sous-titre', text: 'En cours (' + enCours.length + ')' }));
    if (!enCours.length) zone.append(el('p', { class: 'discret', text: 'Aucun traitement en cours.' }));
    enCours.forEach((t) => zone.append(carte(t)));
    if (finis.length) {
      zone.append(el('h3', { class: 'sous-titre', text: 'Terminés (' + finis.length + ')' }));
      finis.forEach((t) => zone.append(carte(t)));
    }
  },

  /* ---------- Les prises du jour (traitements avec « prises par jour ») ---------- */

  prisesDuJour(t, jour) {
    return ((t.prises && t.prises[jour]) || []).slice().sort();
  },

  /* « 08:05 » → « 8 h 05 » */
  heureLisible(h) {
    const [hh, mm] = h.split(':');
    return Number(hh) + ' h ' + mm;
  },

  /* Le petit encadré « Aujourd'hui : 1 prise sur 2 (8 h 05) » + boutons.
     « apres » : ce qu'il faut redessiner ensuite (null = lecture seule). */
  blocPrises(t, apres) {
    const jour = Dates.aujourdhui();
    const auj = this.prisesDuJour(t, jour);
    const hier = this.prisesDuJour(t, Dates.ajouterJours(jour, -1));
    const prevues = t.prisesParJour;
    const complet = auj.length >= prevues;
    const texte = auj.length
      ? auj.length + ' prise' + (auj.length > 1 ? 's' : '') + ' sur ' + prevues + ' (' + auj.map((h) => this.heureLisible(h)).join(', ') + ')'
      : 'aucune prise notée sur ' + prevues + ' prévue' + (prevues > 1 ? 's' : '');
    const bloc = el('div', { class: 'encart prises' + (complet ? ' complet' : '') },
      el('p', { class: 'ligne' }, el('span', { class: 'ligne-libelle', text: 'Aujourd’hui : ' }), el('strong', { text: texte })),
      complet ? el('p', { class: 'ligne', text: '✓ Toutes les prises du jour sont notées.' }) : null,
      hier.length ? el('p', { class: 'ligne discret', text: 'Hier : ' + hier.length + ' prise' + (hier.length > 1 ? 's' : '') + ' (' + hier.map((h) => this.heureLisible(h)).join(', ') + ')' }) : null);
    if (apres) {
      bloc.append(el('div', { class: 'rangee-boutons' },
        bouton('Noter une prise maintenant', () => this.noterPrise(t, apres), { classe: complet ? 'secondaire' : 'principal', icone: 'coche' }),
        auj.length ? bouton('Annuler la dernière prise', () => this.annulerPrise(t, apres), { classe: 'secondaire', icone: 'restaurer' }) : null));
    }
    return bloc;
  },

  /* Note une prise à l'heure actuelle. Si toutes les prises du jour sont
     déjà notées, on demande confirmation : évite de donner deux fois. */
  async noterPrise(t, apres) {
    try {
      const frais = (await BD.lire('traitements', t.id)) || t;      // la version la plus récente
      const jour = Dates.aujourdhui();
      const deja = this.prisesDuJour(frais, jour);
      if (frais.prisesParJour && deja.length >= frais.prisesParJour) {
        const ok = await UI.confirmer({
          titre: 'Toutes les prises du jour sont déjà notées',
          message: [
            frais.nom + ' : ' + deja.length + ' prise(s) déjà notée(s) aujourd’hui (' + deja.map((h) => this.heureLisible(h)).join(', ') + '), pour ' + frais.prisesParJour + ' prévue(s).',
            'Vérifie bien avant de redonner une dose. En cas de doute, demande au vétérinaire.'
          ],
          oui: 'Noter une prise de plus', non: 'Ne rien noter'
        });
        if (!ok) return;
      }
      const d = new Date();
      const heure = Dates.deuxChiffres(d.getHours()) + ':' + Dates.deuxChiffres(d.getMinutes());
      const prises = { ...(frais.prises || {}) };
      prises[jour] = [...(prises[jour] || []), heure].sort();
      // On garde 120 jours d'historique, pas plus
      for (const j of Object.keys(prises)) if (Dates.ecartJours(j, jour) > 120) delete prises[j];
      await BD.enregistrer('traitements', { ...frais, prises });
      UI.annoncer('Prise notée à ' + this.heureLisible(heure) + ' (' + prises[jour].length + ' sur ' + (frais.prisesParJour || '?') + ' aujourd’hui).');
      if (apres) await apres();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  async annulerPrise(t, apres) {
    try {
      const frais = (await BD.lire('traitements', t.id)) || t;
      const jour = Dates.aujourdhui();
      const auj = this.prisesDuJour(frais, jour);
      if (!auj.length) return;
      const derniere = auj[auj.length - 1];
      const ok = await UI.confirmer({
        titre: 'Annuler cette prise ?',
        message: 'La prise notée à ' + this.heureLisible(derniere) + ' aujourd’hui sera retirée.',
        oui: 'Retirer la prise', danger: true
      });
      if (!ok) return;
      const prises = { ...(frais.prises || {}) };
      prises[jour] = auj.slice(0, -1);
      await BD.enregistrer('traitements', { ...frais, prises });
      UI.annoncer('Prise retirée.');
      if (apres) await apres();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  async terminer(t) {
    try {
      const fiche = { ...t, statut: 'termine' };
      if (!fiche.fin || fiche.fin > Dates.aujourdhui()) fiche.fin = Dates.aujourdhui();
      if (fiche.debut && fiche.fin < fiche.debut) fiche.fin = fiche.debut;
      await BD.enregistrer('traitements', fiche);
      UI.annoncer('Traitement marqué terminé.');
      await EcranAnimal.rafraichir();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  formulaireTraitement(a, t) {
    Formulaire.ouvrir({
      titre: (t ? 'Modifier un traitement' : 'Nouveau traitement') + ' — ' + a.nom,
      valeurs: t || { debut: Dates.aujourdhui(), statut: 'en-cours' },
      champs: [
        { nom: 'nom', label: 'Nom du médicament ou du traitement', type: 'texte', requis: true, long: 150 },
        { nom: 'dose', label: 'Dose', type: 'texte', long: 100, placeholder: 'exemple : 1/2 comprimé' },
        { nom: 'frequence', label: 'Fréquence', type: 'texte', long: 150, placeholder: 'exemple : matin et soir' },
        { nom: 'prisesParJour', label: 'Nombre de prises par jour (facultatif)', type: 'nombre', entier: true, positif: true, max: 24,
          aide: 'Permet de cocher chaque prise, pour ne jamais se demander « est-ce que je lui ai déjà donné ? ».' },
        { nom: 'debut', label: 'Date de début', type: 'date' },
        { nom: 'fin', label: 'Date de fin', type: 'date', aide: 'Si elle est connue. Elle apparaîtra dans les rappels tant que le traitement est en cours.' },
        { nom: 'statut', label: 'Statut', type: 'radios', requis: true, options: [{ valeur: 'en-cours', texte: 'En cours' }, { valeur: 'termine', texte: 'Terminé' }] },
        { nom: 'note', label: 'Note', type: 'zone' }
      ],
      valider: (v) => (v.fin && v.debut && v.fin < v.debut ? { fin: 'La fin ne peut pas être avant le début.' } : {}),
      enregistrer: async (v) => {
        await BD.enregistrer('traitements', { ...(t || {}), ...v, animalId: a.id });
        return 'Traitement enregistré.';
      }
    });
  },

  /* ---------- Notes de santé (journal daté, avec filtre) ---------- */
  async notes(zone, a) {
    const toutes = this.recentsDabord(await BD.parAnimal('notes', a.id), 'date');
    EcranAnimal.entete(zone, 'Notes de santé', 'Ajouter une note', () => this.formulaireNote(a, null));

    const allergies = toutes.filter((n) => n.categorie === 'allergie');
    if (allergies.length || a.alimEviter) {
      zone.append(el('div', { class: 'encart attention' },
        el('p', { class: 'etiquette', text: 'Allergies connues' }),
        el('ul', {}, allergies.map((n) => el('li', { text: n.texte || 'Allergie notée le ' + Dates.fr(n.date) })),
          a.alimEviter ? el('li', { text: 'Aliments à éviter : ' + a.alimEviter }) : null)));
    }
    if (!toutes.length) return EcranAnimal.message(zone, 'Aucune note pour l’instant : symptômes, observations, résultats d’examens, allergies, antécédents…');

    // Le filtre (par dates et par type)
    const f = this.filtreNotes;
    const du = el('input', { type: 'date', id: 'filtre-du', value: f.du });
    const au = el('input', { type: 'date', id: 'filtre-au', value: f.au });
    const cat = el('select', { id: 'filtre-categorie' },
      el('option', { value: '', text: 'Tous les types' }),
      Object.entries(this.NOMS_NOTES).map(([v, t]) => el('option', { value: v, text: t, selected: f.categorie === v })));
    const appliquer = () => {
      this.filtreNotes = { du: Dates.estValide(du.value) ? du.value : '', au: Dates.estValide(au.value) ? au.value : '', categorie: cat.value };
      EcranAnimal.rafraichir();
    };
    zone.append(el('details', { class: 'filtre', open: !!(f.du || f.au || f.categorie) },
      el('summary', { text: 'Filtrer les notes' }),
      el('div', { class: 'filtre-champs' },
        el('div', { class: 'champ' }, el('label', { for: 'filtre-du', text: 'Du' }), du),
        el('div', { class: 'champ' }, el('label', { for: 'filtre-au', text: 'Au' }), au),
        el('div', { class: 'champ' }, el('label', { for: 'filtre-categorie', text: 'Type' }), cat)),
      el('div', { class: 'rangee-boutons' },
        bouton('Appliquer le filtre', appliquer, { classe: 'principal' }),
        bouton('Tout afficher', () => { this.filtreNotes = { du: '', au: '', categorie: '' }; EcranAnimal.rafraichir(); }, { classe: 'secondaire' }))));

    const visibles = toutes.filter((n) =>
      (!f.du || n.date >= f.du) && (!f.au || n.date <= f.au) && (!f.categorie || n.categorie === f.categorie));
    zone.append(el('p', { class: 'discret', 'aria-live': 'polite', text: visibles.length === toutes.length ? toutes.length + ' note(s).' : visibles.length + ' note(s) sur ' + toutes.length + ' (filtre actif).' }));
    for (const n of visibles) {
      zone.append(EcranAnimal.carteFiche({
        titre: Dates.fr(n.date) + ' — ' + (this.NOMS_NOTES[n.categorie] || 'Note'),
        lignes: [
          n.texte ? el('p', { class: 'texte-libre', text: n.texte }) : null,
          n.pieces && n.pieces.length ? this.vignettesDocuments(n.pieces) : null],
        modifier: a.archive ? null : () => this.formulaireNote(a, n),
        supprimer: a.archive ? null : () => EcranAnimal.supprimerFiche('notes', n, 'Note du ' + Dates.fr(n.date))
      }));
    }
  },

  /* Les vignettes des documents d'une note (toucher = voir en grand) */
  vignettesDocuments(pieces) {
    return el('div', { class: 'vignettes-documents' }, pieces.map((src, i) => {
      const img = el('img', { alt: '' });
      img.src = src;
      return el('button', { type: 'button', class: 'vignette-document', 'aria-label': 'Voir le document ' + (i + 1) + ' en grand', onclick: () => UI.voirImage(src, 'Document ' + (i + 1)) }, img);
    }));
  },

  formulaireNote(a, n) {
    Formulaire.ouvrir({
      titre: (n ? 'Modifier une note' : 'Nouvelle note') + ' — ' + a.nom,
      valeurs: n || { date: Dates.aujourdhui(), categorie: 'observation' },
      champs: [
        { nom: 'date', label: 'Date', type: 'date', requis: true, pasDansFutur: true },
        { nom: 'categorie', label: 'Type de note', type: 'choix', requis: true, options: Object.entries(this.NOMS_NOTES).map(([valeur, texte]) => ({ valeur, texte })) },
        { nom: 'texte', label: 'Note', type: 'zone' },
        { nom: 'pieces', label: 'Documents joints (ordonnance, résultats…)', type: 'photos',
          aide: 'Jusqu’à ' + MAX_PIECES + ' photos. Elles sont gardées assez nettes pour relire le texte, et incluses dans la sauvegarde.' }
      ],
      valider: (v) => (!v.texte && !(v.pieces && v.pieces.length) ? { texte: 'Écris une note ou joins au moins un document.' } : {}),
      enregistrer: async (v) => {
        await BD.enregistrer('notes', { ...(n || {}), ...v, animalId: a.id });
        return 'Note enregistrée.';
      }
    });
  }
};
