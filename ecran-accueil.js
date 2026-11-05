/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-ACCUEIL — la liste des animaux, et les animaux archivés.
   ============================================================ */
'use strict';

const EcranAccueil = {
  rappelSauvegardeMasque: false,     // « Plus tard » touché pendant cette visite

  /* La vignette d'un animal : sa photo, ou une patte s'il n'en a pas */
  vignette(animal, classe) {
    if (animal.photo) {
      const img = el('img', { class: 'vignette ' + (classe || ''), alt: '' });
      img.src = animal.photo;
      return img;
    }
    return el('span', { class: 'vignette vide ' + (classe || '') }, icone('patte'));
  },

  /* « Chien · Labrador » */
  sousTitre(animal) {
    return [animal.espece, animal.race].filter(Boolean).join(' · ') || 'Espèce non précisée';
  },

  /* La carte d'un animal (toute la carte est un bouton) */
  carte(animal, compte) {
    const age = Dates.age(animal.naissance, animal.naissanceApprox);
    const badges = el('div', { class: 'badges' });
    if (compte && compte.retard) badges.append(el('span', { class: 'badge retard', text: compte.retard + ' en retard' }));
    if (compte && compte.bientot) badges.append(el('span', { class: 'badge bientot', text: compte.bientot + ' bientôt' }));
    return el('button', {
      type: 'button', class: 'carte carte-animal',
      onclick: () => Nav.aller({ vue: 'animal', id: animal.id, section: 'identite' })
    },
      this.vignette(animal),
      el('span', { class: 'carte-texte' },
        el('span', { class: 'carte-titre', text: animal.nom }),
        el('span', { class: 'carte-detail', text: this.sousTitre(animal) }),
        el('span', { class: 'carte-detail', text: age ? 'Âge : ' + age : 'Âge inconnu' }),
        badges.childElementCount ? badges : null
      )
    );
  },

  async afficher() {
    const d = await BD.toutLire();
    const actifs = d.animaux.filter((a) => !a.archive).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const archives = d.animaux.filter((a) => a.archive);
    const compte = Rappels.compterParAnimal(Rappels.calculer(d));

    // Rappel discret de sauvegarde
    const bandeaux = vider($('#accueil-bandeaux'));
    if (actifs.length && !this.rappelSauvegardeMasque) {
      const derniere = await BD.reglage('derniereSauvegarde', null);
      const debut = await BD.reglage('debutSuivi', Dates.aujourdhui());
      const depuis = Dates.ecartJours(derniere || debut, Dates.aujourdhui());
      if (depuis > 30) {
        const texte = derniere
          ? 'Ta dernière sauvegarde date du ' + Dates.fr(derniere) + ' (il y a ' + depuis + ' jours).'
          : 'Tu n’as encore jamais fait de sauvegarde.';
        const encart = el('div', { class: 'encart rappel-sauvegarde', role: 'note' },
          el('p', { text: texte + ' Tes données ne sont que sur ce téléphone : une sauvegarde évite de tout perdre.' }),
          el('div', { class: 'rangee-boutons' },
            bouton('Sauvegarder maintenant', () => EcranReglages.sauvegarder(), { classe: 'principal', icone: 'sauver' }),
            bouton('Plus tard', () => { this.rappelSauvegardeMasque = true; encart.remove(); }, { classe: 'secondaire' })));
        bandeaux.append(encart);
      }
    }

    const liste = vider($('#accueil-liste'));
    if (!actifs.length) {
      liste.append(el('div', { class: 'encart vide' },
        el('p', { text: 'Aucun animal pour l’instant.' }),
        el('p', { text: 'Touche « Ajouter un animal » pour commencer. Pour essayer l’application sans rien taper, ouvre Réglages puis « Charger un exemple ».' })));
    }
    for (const a of actifs) liste.append(this.carte(a, compte[a.id]));

    const actions = vider($('#accueil-actions'));
    actions.append(bouton('Ajouter un animal', () => EcranAnimal.formulaire(null), { classe: 'principal large', icone: 'plus' }));
    if (archives.length) {
      actions.append(bouton('Animaux archivés (' + archives.length + ')', () => Nav.aller({ vue: 'archives' }), { classe: 'secondaire large', icone: 'archive' }));
    }
  },

  /* ---------- Les animaux archivés ---------- */
  async afficherArchives() {
    const animaux = (await BD.tout('animaux')).filter((a) => a.archive).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const liste = vider($('#archives-liste'));
    if (!animaux.length) {
      liste.append(el('p', { class: 'encart vide', text: 'Aucun animal archivé.' }));
      return;
    }
    for (const a of animaux) {
      const motif = a.motifArchive ? a.motifArchive : 'archivé';
      liste.append(el('div', { class: 'carte carte-archive' },
        el('div', { class: 'carte-entete' },
          this.vignette(a),
          el('div', { class: 'carte-texte' },
            el('h2', { class: 'carte-titre', text: a.nom }),
            el('p', { class: 'carte-detail', text: this.sousTitre(a) }),
            el('p', { class: 'carte-detail', text: 'Motif : ' + motif + (a.dateArchive ? ' (le ' + Dates.fr(a.dateArchive) + ')' : '') }))),
        el('div', { class: 'rangee-boutons' },
          bouton('Consulter', () => Nav.aller({ vue: 'animal', id: a.id, section: 'identite' }), { classe: 'secondaire' }),
          bouton('Restaurer', () => EcranAnimal.restaurer(a), { classe: 'secondaire', icone: 'restaurer' }),
          bouton('Supprimer définitivement', () => this.supprimerDefinitivement(a), { classe: 'danger', icone: 'poubelle' }))));
    }
  },

  /* Suppression définitive : deux confirmations successives */
  async supprimerDefinitivement(animal) {
    const ok1 = await UI.confirmer({
      titre: 'Supprimer ' + animal.nom + ' ?',
      message: 'Toute la fiche de ' + animal.nom + ' sera effacée : identité, photo, poids, vaccins, traitements, rendez-vous, notes et tâches.',
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
      UI.annoncer(animal.nom + ' a été supprimé définitivement.');
      await this.afficherArchives();
      $('[data-vue="archives"] h1').focus();
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};
