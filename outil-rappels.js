/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OUTIL-RAPPELS — calcule la liste des choses à surveiller.

   Les rappels sont recalculés à chaque ouverture de l'application (et à
   chaque affichage). Rien n'est envoyé : pas de notification. Ils
   viennent de cinq sources :
   - vaccins : la date du prochain rappel du DERNIER vaccin de ce nom
     (un rappel déjà refait ne compte plus) ;
   - antiparasitaires : la prochaine prise de la DERNIÈRE prise de ce type ;
   - traitements en cours : la date de fin prévue ;
   - rendez-vous à venir ;
   - tâches pas encore faites.
   Les animaux archivés ne donnent aucun rappel.
   ============================================================ */
'use strict';

const Rappels = {

  /* Calcule tous les rappels. « d » contient toutes les données
     (comme renvoyé par BD.toutLire()). Renvoie une liste triée par date. */
  calculer(d, reference) {
    const aujourdhui = reference || Dates.aujourdhui();
    const actifs = new Map(d.animaux.filter((a) => !a.archive).map((a) => [a.id, a]));
    const liste = [];
    const ajouter = (fiche, date, type, titre, section, extra) => {
      const animal = actifs.get(fiche.animalId);
      if (!animal || !Dates.estValide(date)) return;
      liste.push({
        animalId: animal.id, animalNom: animal.nom, date, type, titre, section,
        magasin: extra && extra.magasin, id: fiche.id, heure: extra && extra.heure,
        ecart: Dates.ecartJours(aujourdhui, date)
      });
    };

    // Garde seulement la fiche la plus récente pour chaque « clé »
    const dernieres = (fiches, cle) => {
      const groupes = new Map();
      for (const f of fiches) {
        const k = f.animalId + '|' + cle(f);
        const actuel = groupes.get(k);
        if (!actuel || f.date > actuel.date) groupes.set(k, f);
      }
      return [...groupes.values()];
    };

    for (const v of dernieres(d.vaccins, (f) => f.nom.trim().toLowerCase())) {
      if (v.rappel) ajouter(v, v.rappel, 'vaccin', 'Rappel de vaccin : ' + v.nom, 'vaccins', { magasin: 'vaccins' });
    }
    const nomsAP = { vermifuge: 'Vermifuge', 'anti-puces': 'Anti-puces', 'anti-tiques': 'Anti-tiques', autre: 'Antiparasitaire' };
    for (const a of dernieres(d.antiparasitaires, (f) => (f.type === 'autre' ? 'autre:' + (f.produit || '').trim().toLowerCase() : f.type))) {
      if (a.prochaine) ajouter(a, a.prochaine, 'antiparasitaire', nomsAP[a.type] + (a.produit ? ' : ' + a.produit : ''), 'antiparasitaires', { magasin: 'antiparasitaires' });
    }
    for (const t of d.traitements) {
      if (t.statut === 'en-cours' && t.fin) ajouter(t, t.fin, 'traitement', 'Fin prévue du traitement : ' + t.nom, 'traitements', { magasin: 'traitements' });
    }
    for (const r of d.rdv) {
      if (r.date >= aujourdhui) ajouter(r, r.date, 'rdv', 'Rendez-vous vétérinaire' + (r.motif ? ' : ' + r.motif : ''), 'rdv', { magasin: 'rdv', heure: r.heure });
    }
    for (const t of d.taches) {
      if (!t.fait && t.echeance) ajouter(t, t.echeance, 'tache', t.titre, 'taches', { magasin: 'taches' });
    }

    return liste.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.heure || '') < (b.heure || '') ? -1 : 1));
  },

  /* Range les rappels dans les quatre groupes de la page « Rappels » */
  grouper(liste) {
    const g = { retard: [], aujourdhui: [], semaine: [], mois: [], plusTard: [] };
    for (const r of liste) {
      if (r.ecart < 0) g.retard.push(r);
      else if (r.ecart === 0) g.aujourdhui.push(r);
      else if (r.ecart <= 7) g.semaine.push(r);
      else if (r.ecart <= 30) g.mois.push(r);
      else g.plusTard.push(r);
    }
    return g;
  },

  /* Pour les badges des cartes d'animaux : { animalId: { retard, bientot } }
     « bientôt » = aujourd'hui ou dans les 7 prochains jours. */
  compterParAnimal(liste) {
    const compte = {};
    for (const r of liste) {
      const c = compte[r.animalId] || (compte[r.animalId] = { retard: 0, bientot: 0 });
      if (r.ecart < 0) c.retard++;
      else if (r.ecart <= 7) c.bientot++;
    }
    return compte;
  }
};
