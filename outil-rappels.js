/* Omni-Animalia — © 2026 Ferrus Dantioch
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
  calculer(donnees, reference) {
    const d = donnees && typeof donnees === 'object' ? donnees : {};
    const aujourdhui = Dates.estValide(reference) ? reference : Dates.aujourdhui();
    const animaux = Array.isArray(d.animaux) ? d.animaux : [];
    const actifs = new Map(animaux.filter((a) => a && !a.archive).map((a) => [a.id, a]));
    const liste = [];
    const ajouter = (fiche, date, type, titre, section, extra) => {
      if (!fiche) return;
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
      for (const f of Array.isArray(fiches) ? fiches : []) {
        if (!f || !Dates.estValide(f.date)) continue;
        const k = f.animalId + '|' + cle(f);
        const actuel = groupes.get(k);
        if (!actuel || f.date > actuel.date || (f.date === actuel.date && String(f.id ?? '') > String(actuel.id ?? ''))) {
          groupes.set(k, f);
        }
      }
      return [...groupes.values()];
    };

    for (const v of dernieres(d.vaccins, (f) => (f.nom || '').trim().toLowerCase())) {
      if (v.rappel) ajouter(v, v.rappel, 'vaccin', 'Rappel de vaccin : ' + (v.nom || ''), 'vaccins', { magasin: 'vaccins' });
    }
    const nomsAP = Object.assign(Object.create(null), {
      vermifuge: 'Vermifuge', 'anti-puces': 'Anti-puces', 'anti-tiques': 'Anti-tiques', autre: 'Antiparasitaire'
    });
    for (const a of dernieres(d.antiparasitaires, (f) => (f.type === 'autre' ? 'autre:' + (f.produit || '').trim().toLowerCase() : (f.type || '')))) {
      if (a.prochaine) ajouter(a, a.prochaine, 'antiparasitaire', (nomsAP[a.type] || 'Antiparasitaire') + (a.produit ? ' : ' + a.produit : ''), 'antiparasitaires', { magasin: 'antiparasitaires' });
    }
    for (const t of Array.isArray(d.traitements) ? d.traitements : []) {
      if (t && t.statut === 'en-cours' && t.fin) ajouter(t, t.fin, 'traitement', 'Fin prévue du traitement : ' + (t.nom || ''), 'traitements', { magasin: 'traitements' });
    }
    for (const r of Array.isArray(d.rdv) ? d.rdv : []) {
      if (r && r.date >= aujourdhui) ajouter(r, r.date, 'rdv', 'Rendez-vous vétérinaire' + (r.motif ? ' : ' + r.motif : ''), 'rdv', { magasin: 'rdv', heure: r.heure });
    }
    for (const t of Array.isArray(d.taches) ? d.taches : []) {
      if (t && !t.fait && t.echeance) ajouter(t, t.echeance, 'tache', t.titre, 'taches', { magasin: 'taches' });
    }

    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    return liste.sort((a, b) => (
      cmp(a.date, b.date)
      || cmp(a.heure || '', b.heure || '')
      || cmp(String(a.type || ''), String(b.type || ''))
      || cmp(String(a.id || ''), String(b.id || ''))
    ));
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
    const compte = Object.create(null);
    if (!Array.isArray(liste)) return compte;
    for (const r of liste) {
      if (!r || !r.animalId) continue;
      const c = compte[r.animalId] || (compte[r.animalId] = { retard: 0, bientot: 0 });
      if (r.ecart < 0) c.retard++;
      else if (r.ecart <= 7) c.bientot++;
    }
    return compte;
  },

  /* Prises de médicaments restantes aujourd'hui, par animal actif :
     { [animalId]: { total, parTraitement: { [traitementId]: restant } } } */
  prisesANoter(donnees, reference) {
    const res = Object.create(null);
    const d = donnees && typeof donnees === 'object' ? donnees : {};
    const aujourdhui = Dates.estValide(reference) ? reference : Dates.aujourdhui();
    const animaux = Array.isArray(d.animaux) ? d.animaux : [];
    const actifs = new Set(animaux.filter((a) => a && !a.archive && typeof a.id === 'string' && a.id).map((a) => a.id));
    for (const t of Array.isArray(d.traitements) ? d.traitements : []) {
      if (!t || t.statut === 'termine' || !actifs.has(t.animalId)) continue;
      if (typeof t.prisesParJour !== 'number' || !Number.isFinite(t.prisesParJour) || t.prisesParJour <= 0) continue;
      if (t.debut && (!Dates.estValide(t.debut) || t.debut > aujourdhui)) continue;
      if (t.fin && (!Dates.estValide(t.fin) || t.fin < aujourdhui)) continue;
      const prises = t.prises && typeof t.prises === 'object' && !Array.isArray(t.prises) &&
        Object.prototype.hasOwnProperty.call(t.prises, aujourdhui) && Array.isArray(t.prises[aujourdhui])
        ? t.prises[aujourdhui] : [];
      const restant = Math.max(0, t.prisesParJour - prises.length);
      if (restant <= 0) continue;
      const entree = res[t.animalId] || (res[t.animalId] = { total: 0, parTraitement: Object.create(null) });
      entree.total += restant;
      if (typeof t.id === 'string' && t.id) entree.parTraitement[t.id] = restant;
    }
    return res;
  },

  /* Pastilles des onglets de la fiche animal : vrai si un élément est en
     retard ou prévu aujourd'hui (y compris prises restantes du jour). */
  pastillesAnimal(donnees, animalId, reference) {
    const p = { vaccins: false, traitements: false, antiparasitaires: false, taches: false };
    if (typeof animalId !== 'string' || !animalId || !donnees || typeof donnees !== 'object') return p;
    for (const r of this.calculer(donnees, reference)) {
      if (r.animalId !== animalId || r.ecart > 0) continue;
      if (Object.prototype.hasOwnProperty.call(p, r.section)) p[r.section] = true;
    }
    const prises = this.prisesANoter(donnees, reference);
    if (prises[animalId] && prises[animalId].total > 0) p.traitements = true;
    return p;
  }
};
