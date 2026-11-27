/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-ACCUEIL — la liste des animaux, et les animaux archivés.
   ============================================================ */
'use strict';

const EcranAccueil = {
  rappelSauvegardeMasque: false,     // « Plus tard » touché pendant cette visite
  _tour: 0,
  _tourArchives: 0,

  parNom(a, b) {
    const na = (a && typeof a.nom === 'string') ? a.nom : '';
    const nb = (b && typeof b.nom === 'string') ? b.nom : '';
    const c = na.localeCompare(nb, 'fr');
    if (c !== 0) return c;
    const ia = String((a && a.id) ?? '');
    const ib = String((b && b.id) ?? '');
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  },

  /* La vignette d'un animal : sa photo, ou une patte s'il n'en a pas */
  vignette(animal, classe) {
    if (animal && typeof animal.photo === 'string' && imageValide(animal.photo)) {
      const img = el('img', { class: 'vignette ' + (classe || ''), alt: '' });
      img.src = animal.photo;
      return img;
    }
    return el('span', { class: 'vignette vide ' + (classe || '') }, icone('patte'));
  },

  /* « Chien · Labrador » */
  sousTitre(animal) {
    return [animal && animal.espece, animal && animal.race]
      .filter((x) => typeof x === 'string' && x.trim())
      .join(' · ') || 'Espèce non précisée';
  },

  /* La carte d'un animal (toute la carte est un bouton) */
  carte(animal, compte, prises) {
    const age = animal ? Dates.age(animal.naissance, animal.naissanceApprox) : '';
    const badges = el('div', { class: 'badges' });
    if (compte && compte.retard > 0) badges.append(el('span', { class: 'badge retard', text: compte.retard + ' en retard' }));
    if (compte && compte.bientot > 0) badges.append(el('span', { class: 'badge bientot', text: compte.bientot + ' bientôt' }));
    const nbPrises = typeof prises === 'number'
      ? (Number.isFinite(prises) && prises > 0 ? prises : 0)
      : (prises && typeof prises.total === 'number' && Number.isFinite(prises.total) && prises.total > 0 ? prises.total : 0);
    if (nbPrises > 0) {
      badges.append(el('span', { class: 'badge prises', text: nbPrises + ' prise' + (nbPrises > 1 ? 's' : '') + ' à noter' }));
    }
    return el('button', {
      type: 'button', class: 'carte carte-animal',
      onclick: () => Nav.aller({ vue: 'animal', id: animal.id, section: 'identite' })
    },
      this.vignette(animal),
      el('span', { class: 'carte-texte' },
        el('span', { class: 'carte-titre', text: (animal && typeof animal.nom === 'string') ? animal.nom : '' }),
        el('span', { class: 'carte-detail', text: this.sousTitre(animal) }),
        el('span', { class: 'carte-detail', text: age ? 'Âge : ' + age : 'Âge inconnu' }),
        badges.childElementCount ? badges : null
      )
    );
  },

  async afficher() {
    const tour = ++this._tour;
    const d = await BD.toutLire();
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;
    const tous = Array.isArray(d && d.animaux) ? d.animaux : [];
    const actifs = tous.filter((a) => a && !a.archive).sort((a, b) => this.parNom(a, b));
    const archives = tous.filter((a) => a && a.archive);
    const compte = Rappels.compterParAnimal(Rappels.calculer(d));
    const prises = Rappels.prisesANoter(d);

    // Rappel discret de sauvegarde
    const fragBandeaux = document.createDocumentFragment();
    if (actifs.length && !this.rappelSauvegardeMasque) {
      const derniereBrute = await BD.reglage('derniereSauvegarde', null);
      if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;
      const debutBrute = await BD.reglage('debutSuivi', Dates.aujourdhui());
      if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;
      const derniere = Dates.estValide(derniereBrute) ? derniereBrute : null;
      const debut = Dates.estValide(debutBrute) ? debutBrute : Dates.aujourdhui();
      const depuis = Dates.ecartJours(derniere || debut, Dates.aujourdhui());
      if (Number.isFinite(depuis) && depuis > 30) {
        const texte = derniere
          ? 'Ta dernière sauvegarde date du ' + Dates.fr(derniere) + ' (il y a ' + depuis + ' jours).'
          : 'Tu n’as encore jamais fait de sauvegarde.';
        const encart = el('div', { class: 'encart rappel-sauvegarde', role: 'note' },
          el('p', { text: texte + ' Tes données ne sont que sur ce téléphone : une sauvegarde évite de tout perdre.' }),
          el('div', { class: 'rangee-boutons' },
            bouton('Sauvegarder maintenant', () => EcranReglages.sauvegarder(), { classe: 'principal', icone: 'sauver' }),
            bouton('Plus tard', () => { this.rappelSauvegardeMasque = true; encart.remove(); }, { classe: 'secondaire' })));
        fragBandeaux.append(encart);
      }
    }

    const fragListe = document.createDocumentFragment();
    if (!actifs.length) {
      fragListe.append(el('div', { class: 'encart vide' },
        el('p', { text: 'Aucun animal pour l’instant.' }),
        el('p', { text: 'Touche « Ajouter un animal » pour commencer. Pour essayer l’application sans rien taper, ouvre Réglages puis « Charger un exemple ».' })));
    }
    for (const a of actifs) {
      const id = a && typeof a.id === 'string' ? a.id : '';
      const c = id && Object.prototype.hasOwnProperty.call(compte, id) ? compte[id] : null;
      const p = id && Object.prototype.hasOwnProperty.call(prises, id) ? prises[id] : null;
      fragListe.append(this.carte(a, c, p));
    }

    const fragActions = document.createDocumentFragment();
    fragActions.append(bouton('Ajouter un animal', () => EcranAnimal.formulaire(null), { classe: 'principal large', icone: 'plus' }));
    if (archives.length) {
      fragActions.append(bouton('Animaux archivés (' + archives.length + ')', () => Nav.aller({ vue: 'archives' }), { classe: 'secondaire large', icone: 'archive' }));
    }

    vider($('#accueil-bandeaux')).append(fragBandeaux);
    vider($('#accueil-liste')).append(fragListe);
    vider($('#accueil-actions')).append(fragActions);
  },

  /* ---------- Les animaux archivés ---------- */
  async afficherArchives() {
    const tour = ++this._tourArchives;
    const tous = await BD.tout('animaux');
    if (tour !== this._tourArchives || ($('#verrou') && !$('#verrou').hidden)) return;
    const animaux = (Array.isArray(tous) ? tous : []).filter((a) => a && a.archive).sort((a, b) => this.parNom(a, b));
    const frag = document.createDocumentFragment();
    if (!animaux.length) {
      frag.append(el('p', { class: 'encart vide', text: 'Aucun animal archivé.' }));
    } else {
      for (const a of animaux) {
        const motif = typeof a.motifArchive === 'string' && a.motifArchive ? a.motifArchive : 'archivé';
        const dateArch = a.dateArchive && Dates.estValide(a.dateArchive) ? ' (le ' + Dates.fr(a.dateArchive) + ')' : '';
        frag.append(el('div', { class: 'carte carte-archive' },
          el('div', { class: 'carte-entete' },
            this.vignette(a),
            el('div', { class: 'carte-texte' },
              el('h2', { class: 'carte-titre', text: typeof a.nom === 'string' ? a.nom : '' }),
              el('p', { class: 'carte-detail', text: this.sousTitre(a) }),
              el('p', { class: 'carte-detail', text: 'Motif : ' + motif + dateArch }))),
          el('div', { class: 'rangee-boutons' },
            bouton('Consulter', () => Nav.aller({ vue: 'animal', id: a.id, section: 'identite' }), { classe: 'secondaire' }),
            bouton('Restaurer', () => EcranAnimal.restaurer(a), { classe: 'secondaire', icone: 'restaurer' }),
            bouton('Supprimer définitivement', () => this.supprimerDefinitivement(a), { classe: 'danger', icone: 'poubelle' }))));
      }
    }
    vider($('#archives-liste')).append(frag);
  },

  /* Suppression définitive : deux confirmations successives */
  async supprimerDefinitivement(animal) {
    if (!animal || !animal.id) return;
    const nom = typeof animal.nom === 'string' && animal.nom ? animal.nom : 'cet animal';
    const ok1 = await UI.confirmer({
      titre: 'Supprimer ' + nom + ' ?',
      message: 'Toute la fiche de ' + nom + ' sera effacée : identité, photo, poids, vaccins, traitements, rendez-vous, notes et tâches.',
      oui: 'Continuer', danger: true
    });
    if (!ok1) return;
    const ok2 = await UI.confirmer({
      titre: 'Dernière confirmation',
      message: ['Cette suppression est définitive : elle ne peut pas être annulée.', 'Si tu veux garder une trace, fais d’abord une sauvegarde.'],
      oui: 'Supprimer définitivement', danger: true
    });
    if (!ok2) return;
    try {
      await BD.supprimerAnimal(animal.id);
      UI.annoncer(nom + ' a été supprimé définitivement.');
      await this.afficherArchives();
      $('[data-vue="archives"] h1').focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};
