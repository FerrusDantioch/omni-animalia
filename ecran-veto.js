/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-VETO — la liste des vétérinaires (commune à tous les animaux).
   ============================================================ */
'use strict';

const EcranVeto = {

  /* Un lien qui lance l'appel quand on le touche */
  lienTelephone(numero) {
    const propre = numero.replace(/[^0-9+]/g, '');
    return el('a', { class: 'bouton secondaire lien-tel', href: 'tel:' + propre, 'aria-label': 'Appeler le ' + numero },
      icone('telephone'), el('span', { text: 'Appeler le ' + numero }));
  },

  async afficher() {
    const vetos = (await BD.tout('veterinaires')).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const animaux = await BD.tout('animaux');
    const liste = vider($('#vetos-liste'));
    if (!vetos.length) {
      liste.append(el('p', { class: 'encart vide', text: 'Aucun vétérinaire enregistré.' }));
    }
    for (const v of vetos) {
      const suivis = animaux.filter((a) => a.vetoId === v.id && !a.archive).map((a) => a.nom);
      liste.append(el('article', { class: 'carte carte-fiche' },
        el('h2', { class: 'carte-titre', text: v.nom }),
        EcranAnimal.ligne('Clinique', v.clinique),
        v.telephone ? el('p', { class: 'ligne' }, this.lienTelephone(v.telephone)) : null,
        EcranAnimal.ligne('Adresse', v.adresse),
        EcranAnimal.ligne('Notes', v.notes),
        suivis.length ? EcranAnimal.ligne('Vétérinaire habituel de', suivis.join(', ')) : null,
        el('div', { class: 'rangee-boutons' },
          bouton('Modifier', () => this.formulaire(v), { classe: 'secondaire', icone: 'crayon' }),
          bouton('Supprimer', () => this.supprimer(v, suivis), { classe: 'secondaire danger-discret', icone: 'poubelle' }))));
    }
    const actions = vider($('#vetos-actions'));
    actions.append(bouton('Ajouter un vétérinaire', () => this.formulaire(null), { classe: 'principal large', icone: 'plus' }));
  },

  formulaire(v) {
    Formulaire.ouvrir({
      titre: v ? 'Modifier ' + v.nom : 'Nouveau vétérinaire',
      valeurs: v || {},
      champs: [
        { nom: 'nom', label: 'Nom', type: 'texte', requis: true, long: 120, placeholder: 'exemple : Dr Martin' },
        { nom: 'clinique', label: 'Clinique', type: 'texte', long: 150 },
        { nom: 'telephone', label: 'Téléphone', type: 'tel', long: 30, autocomplete: 'tel' },
        { nom: 'adresse', label: 'Adresse', type: 'zone', long: 500 },
        { nom: 'notes', label: 'Notes', type: 'zone', aide: 'Horaires, numéro d’urgence, spécialités…' }
      ],
      enregistrer: async (val) => {
        await BD.enregistrer('veterinaires', { ...(v || {}), ...val });
        return 'Vétérinaire enregistré.';
      }
    });
  },

  async supprimer(v, suivis) {
    const message = ['« ' + v.nom + ' » sera retiré de la liste.'];
    if (suivis.length) message.push('Ces animaux n’auront plus de vétérinaire habituel : ' + suivis.join(', ') + '.');
    message.push('Les vaccins et rendez-vous déjà notés gardent son nom.');
    const ok = await UI.confirmer({ titre: 'Supprimer ce vétérinaire ?', message, oui: 'Supprimer', danger: true });
    if (!ok) return;
    try {
      await BD.supprimer('veterinaires', v.id);
      for (const a of await BD.tout('animaux')) {
        if (a.vetoId === v.id) { delete a.vetoId; await BD.enregistrer('animaux', a); }
      }
      UI.annoncer('Vétérinaire supprimé.');
      await this.afficher();
      $('[data-vue="veterinaires"] h1').focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};
