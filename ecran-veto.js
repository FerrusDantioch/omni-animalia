/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-VETO — la liste des vétérinaires (commune à tous les animaux).
   ============================================================ */
'use strict';

const EcranVeto = {
  _tour: 0,

  /* Un lien qui lance l'appel quand on le touche */
  lienTelephone(numero) {
    const texte = typeof numero === 'string' ? numero.trim() : '';
    if (!texte) return null;
    const propre = texte.replace(/[^0-9+]/g, '');
    if (!propre || !/\d/.test(propre)) {
      return el('span', {}, el('span', { class: 'ligne-libelle', text: 'Téléphone : ' }), el('span', { text: texte }));
    }
    return el('a', { class: 'bouton secondaire lien-tel', href: 'tel:' + propre, 'aria-label': 'Appeler le ' + texte },
      icone('telephone'), el('span', { text: 'Appeler le ' + texte }));
  },

  async afficher() {
    const tour = ++this._tour;
    const vetos = (await BD.tout('veterinaires')).sort((a, b) => {
      const na = (a && typeof a.nom === 'string') ? a.nom : '';
      const nb = (b && typeof b.nom === 'string') ? b.nom : '';
      const c = na.localeCompare(nb, 'fr');
      if (c !== 0) return c;
      const ia = String((a && a.id) ?? '');
      const ib = String((b && b.id) ?? '');
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;
    const animaux = await BD.tout('animaux');
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;

    const fragListe = document.createDocumentFragment();
    if (!vetos.length) {
      fragListe.append(el('p', { class: 'encart vide', text: 'Aucun vétérinaire enregistré.' }));
    }
    for (const v of vetos) {
      const suivis = animaux.filter((a) => a && a.vetoId === v.id && !a.archive).map((a) => a.nom || '');
      const telEl = v.telephone ? this.lienTelephone(v.telephone) : null;
      fragListe.append(el('article', { class: 'carte carte-fiche' },
        el('h2', { class: 'carte-titre', text: v.nom || '' }),
        EcranAnimal.ligne('Clinique', v.clinique),
        telEl ? el('p', { class: 'ligne' }, telEl) : null,
        EcranAnimal.ligne('Adresse', v.adresse),
        EcranAnimal.ligne('Notes', v.notes),
        suivis.length ? EcranAnimal.ligne('Vétérinaire habituel de', suivis.join(', ')) : null,
        el('div', { class: 'rangee-boutons' },
          bouton('Modifier', () => this.formulaire(v), { classe: 'secondaire', icone: 'crayon' }),
          bouton('Supprimer', () => this.supprimer(v, suivis), { classe: 'secondaire danger-discret', icone: 'poubelle' }))));
    }
    const fragActions = document.createDocumentFragment();
    fragActions.append(bouton('Ajouter un vétérinaire', () => this.formulaire(null), { classe: 'principal large', icone: 'plus' }));

    vider($('#vetos-liste')).append(fragListe);
    vider($('#vetos-actions')).append(fragActions);
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
      const tx = await BD._transaction(['veterinaires', 'animaux'], 'readwrite');
      tx.objectStore('veterinaires').delete(v.id);
      const animaux = tx.objectStore('animaux');
      animaux.openCursor().onsuccess = (e) => {
        const curseur = e.target.result;
        if (!curseur) return;
        const a = curseur.value;
        if (a && a.vetoId === v.id) {
          const maj = { ...a };
          delete maj.vetoId;
          try {
            curseur.update(nettoyerFiche('animaux', maj));
          } catch (err) {
            try { tx.abort(); } catch (errAbort) {}
            return;
          }
        }
        curseur.continue();
      };
      await BD.finTransaction(tx);
      UI.annoncer('Vétérinaire supprimé.');
      await this.afficher();
      $('[data-vue="veterinaires"] h1').focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};
