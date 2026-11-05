/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-GARDE — la « fiche de garde » d'un animal.

   Une page à montrer (ou à imprimer) à la personne qui garde l'animal :
   qui appeler, quoi donner à manger et ce qu'il ne faut SURTOUT PAS
   donner, les allergies, les médicaments en cours, les consignes,
   et ce qui est prévu dans les 30 prochains jours.
   ============================================================ */
'use strict';

const EcranGarde = {
  animal: null,

  /* Une partie de la fiche, avec son titre (rien si elle est vide) */
  partie(titre, ...contenu) {
    const enfants = contenu.flat(Infinity).filter(Boolean);
    if (!enfants.length) return null;
    return el('section', { class: 'garde-partie' }, el('h2', { text: titre }), enfants);
  },

  /* Fabrique le contenu de la fiche (le même à l'écran et sur papier) */
  async construire(a, pourImpression) {
    const [traitements, notes] = await Promise.all([BD.parAnimal('traitements', a.id), BD.parAnimal('notes', a.id)]);
    const veto = a.vetoId ? await BD.lire('veterinaires', a.vetoId) : null;
    const contact = await BD.reglage('contactGarde', null);
    const rappels = Rappels.calculer(await BD.toutLire()).filter((r) => r.animalId === a.id && r.ecart >= 0 && r.ecart <= 30);
    const ligne = (l, v) => EcranAnimal.ligne(l, v);
    // À l'écran, un numéro de téléphone devient un bouton « Appeler »
    const tel = (numero) => (numero
      ? (pourImpression ? ligne('Téléphone', numero) : el('p', { class: 'ligne' }, EcranVeto.lienTelephone(numero)))
      : null);

    const enCours = traitements.filter((t) => t.statut !== 'termine');
    const allergies = notes.filter((n) => n.categorie === 'allergie');
    const photo = a.photo ? el('img', { class: 'garde-photo', alt: '' }) : null;
    if (photo) photo.src = a.photo;
    const age = Dates.age(a.naissance, a.naissanceApprox);

    return el('div', { class: 'fiche-garde' },
      el('header', { class: 'garde-entete' },
        photo,
        el('div', {},
          el('p', { class: 'etiquette', text: 'Fiche de garde' }),
          el('p', { class: 'garde-nom', text: a.nom }),
          el('p', { text: [EcranAccueil.sousTitre(a), age ? age : '', NOMS_SEXE[a.sexe] && a.sexe !== 'inconnu' ? NOMS_SEXE[a.sexe] : ''].filter(Boolean).join(' · ') }))),

      this.partie('À contacter',
        contact && (contact.nom || contact.telephone) ? [
          el('p', { class: 'ligne' }, el('strong', { text: 'Propriétaire : ' }), contact.nom || ''),
          tel(contact.telephone)] : null,
        veto ? [
          el('p', { class: 'ligne' }, el('strong', { text: 'Vétérinaire : ' }), veto.nom + (veto.clinique ? ' — ' + veto.clinique : '')),
          tel(veto.telephone),
          ligne('Adresse', veto.adresse),
          ligne('Infos', veto.notes)] : null),

      a.alimEviter ? el('section', { class: 'garde-partie garde-alerte' },
        el('h2', { text: 'À ne surtout pas donner' }),
        el('p', { class: 'texte-libre', text: a.alimEviter })) : null,

      this.partie('Allergies connues',
        allergies.length ? el('ul', {}, allergies.map((n) => el('li', { text: n.texte || 'Allergie notée le ' + Dates.fr(n.date) }))) : null),

      this.partie('Repas',
        ligne('Aliment', a.alimMarque),
        ligne('Quantité par jour', a.alimQuantite),
        ligne('Nombre de repas', a.alimRepas ? String(a.alimRepas) : ''),
        ligne('Remarques', a.alimRemarques)),

      this.partie('Médicaments en cours',
        enCours.map((t) => el('div', { class: 'garde-medicament' },
          el('p', { class: 'ligne' }, el('strong', { text: t.nom })),
          ligne('Dose', t.dose),
          ligne('Quand', t.frequence),
          t.prisesParJour ? ligne('Prises par jour', String(t.prisesParJour)) : null,
          t.fin ? ligne('Jusqu’au', Dates.fr(t.fin)) : null))),

      this.partie('Consignes', a.consignesGarde ? el('p', { class: 'texte-libre', text: a.consignesGarde }) : null),

      this.partie('Prévu dans les 30 prochains jours',
        rappels.length ? el('ul', {}, rappels.map((r) => el('li', { text: Dates.fr(r.date) + (r.heure ? ' à ' + r.heure.replace(':', ' h ') : '') + ' : ' + r.titre }))) : null),

      this.partie('Identification',
        ligne('Puce électronique', a.puce),
        ligne('Tatouage', a.tatouage),
        ligne('Couleur, signes distinctifs', a.couleur)),

      el('p', { class: 'garde-pied', text: 'Fiche éditée le ' + Dates.fr(Dates.aujourdhui()) + ' avec Omni-Animaux. Cette application sert à organiser les informations. Elle ne remplace pas l’avis d’un vétérinaire.' })
    );
  },

  /* L'écran « Fiche de garde » */
  async afficher(id) {
    const a = await BD.lire('animaux', id);
    if (!a) {
      UI.annoncer('Cet animal n’existe plus.', 'erreur');
      return Nav.remplacer({ vue: 'accueil' });
    }
    this.animal = a;
    $('#garde-titre').textContent = 'Garde de ' + a.nom;
    const zone = vider($('#garde-contenu'));
    zone.append(el('p', { class: 'aide', text: 'À montrer ou à imprimer pour la personne qui garde ' + a.nom + '. Les informations viennent de sa fiche : identité, alimentation, notes d’allergie, traitements en cours, vétérinaire habituel et rappels.' }));
    zone.append(await this.construire(a, false));
    const contact = await BD.reglage('contactGarde', null);
    zone.append(el('div', { class: 'pile-boutons' },
      bouton('Imprimer ou enregistrer en PDF', () => this.imprimer(a), { classe: 'principal large', icone: 'imprimer' }),
      a.archive ? null : bouton(a.consignesGarde ? 'Modifier les consignes' : 'Ajouter des consignes', () => this.formulaireConsignes(a), { classe: 'secondaire large', icone: 'crayon' }),
      bouton(contact ? 'Modifier mon contact' : 'Ajouter mon contact (propriétaire)', () => this.formulaireContact(contact), { classe: 'secondaire large', icone: 'telephone' })));
    zone.append(el('p', { class: 'aide', text: 'Ton contact est commun à toutes les fiches de garde. Pour changer l’alimentation, les traitements ou le vétérinaire, modifie la fiche de l’animal.' }));
  },

  formulaireConsignes(a) {
    Formulaire.ouvrir({
      titre: 'Consignes de garde — ' + a.nom,
      valeurs: a,
      champs: [
        { nom: 'consignesGarde', label: 'Consignes pour la personne qui garde', type: 'zone',
          aide: 'Sorties, habitudes, cachettes, ce qui le rassure, ce qui lui fait peur, où sont ses affaires…' }
      ],
      enregistrer: async (v) => {
        await BD.enregistrer('animaux', { ...a, consignesGarde: v.consignesGarde });
        return 'Consignes enregistrées.';
      }
    });
  },

  formulaireContact(contact) {
    Formulaire.ouvrir({
      titre: 'Mon contact',
      intro: 'Affiché en haut de toutes les fiches de garde, pour qu’on puisse te joindre.',
      valeurs: contact || {},
      champs: [
        { nom: 'nom', label: 'Nom ou prénom', type: 'texte', long: 120 },
        { nom: 'telephone', label: 'Téléphone', type: 'tel', long: 30 }
      ],
      enregistrer: async (v) => {
        await BD.definirReglage('contactGarde', v.nom || v.telephone ? { nom: v.nom, telephone: v.telephone } : null);
        return 'Contact enregistré.';
      }
    });
  },

  /* Imprime la fiche (même mécanisme que le carnet de santé) */
  async imprimer(a) {
    const carnet = vider($('#carnet'));
    carnet.append(await this.construire(a, true));
    Impression.lancer('Fiche de garde - ' + a.nom);
  }
};
