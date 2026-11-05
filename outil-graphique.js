/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OUTIL-GRAPHIQUE — la courbe de poids, dessinée en SVG.

   Le SVG est un dessin fait de traits, que le navigateur affiche net à
   toutes les tailles. Aucune bibliothèque extérieure : on calcule
   nous-mêmes la place de chaque point.
   - axe horizontal : le temps (les dates des pesées) ;
   - axe vertical : le poids, dans l'unité choisie pour l'animal.
   Les couleurs viennent du thème (feuille de style), pas d'ici.
   ============================================================ */
'use strict';

const Graphique = {

  /* Convertit des grammes dans l'unité de l'animal */
  convertir(grammes, unite) {
    return unite === 'g' ? grammes : grammes / 1000;
  },

  /* Fabrique le dessin de la courbe.
     pesees : [{ date, grammes }] (dans n'importe quel ordre)
     unite  : 'kg' ou 'g' */
  courbePoids(pesees, unite) {
    const ns = 'http://www.w3.org/2000/svg';
    const points = pesees
      .filter((p) => Dates.estValide(p.date) && typeof p.grammes === 'number')
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const L = 360, H = 220;                               // taille du dessin
    const marge = { gauche: 56, droite: 16, haut: 16, bas: 34 };
    const largeurUtile = L - marge.gauche - marge.droite;
    const hauteurUtile = H - marge.haut - marge.bas;

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + L + ' ' + H);
    svg.setAttribute('class', 'graphique');
    svg.setAttribute('role', 'img');

    const ajouter = (nom, attrs, texte) => {
      const e = document.createElementNS(ns, nom);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (texte !== undefined) e.textContent = texte;
      svg.append(e);
      return e;
    };

    if (points.length === 0) return null;

    const valeurs = points.map((p) => this.convertir(p.grammes, unite));
    let min = Math.min(...valeurs);
    let max = Math.max(...valeurs);
    // Un peu d'air en haut et en bas ; si tous les poids sont égaux, on écarte
    const ecart = max - min || Math.max(Math.abs(max) * 0.1, unite === 'g' ? 10 : 0.5);
    min = Math.max(0, min - ecart * 0.15);
    max = max + ecart * 0.15;

    const premier = points[0].date;
    const dernier = points[points.length - 1].date;
    const duree = Dates.ecartJours(premier, dernier) || 1;
    const x = (date) => (points.length === 1
      ? marge.gauche + largeurUtile / 2
      : marge.gauche + (Dates.ecartJours(premier, date) / duree) * largeurUtile);
    const y = (v) => marge.haut + (1 - (v - min) / (max - min)) * hauteurUtile;

    // Lignes de repère horizontales (4 niveaux) avec leurs valeurs
    const decimales = unite === 'g' ? 0 : (max - min < 2 ? 2 : 1);
    for (let i = 0; i <= 3; i++) {
      const v = min + ((max - min) * i) / 3;
      const yy = y(v);
      ajouter('line', { x1: marge.gauche, x2: L - marge.droite, y1: yy, y2: yy, class: 'repere' });
      ajouter('text', { x: marge.gauche - 6, y: yy + 4, 'text-anchor': 'end', class: 'legende' }, UI.nombre(v, decimales));
    }
    ajouter('text', { x: 4, y: 12, class: 'legende' }, unite);

    // Dates du premier et du dernier point, sous le dessin
    const court = (d) => Dates.fr(d).slice(0, 6) + Dates.fr(d).slice(8);    // jj/mm/aa
    ajouter('text', { x: marge.gauche, y: H - 10, 'text-anchor': 'start', class: 'legende' }, court(premier));
    if (points.length > 1) ajouter('text', { x: L - marge.droite, y: H - 10, 'text-anchor': 'end', class: 'legende' }, court(dernier));

    // La courbe, puis un point pour chaque pesée
    if (points.length > 1) {
      ajouter('polyline', {
        points: points.map((p, i) => x(p.date).toFixed(1) + ',' + y(valeurs[i]).toFixed(1)).join(' '),
        class: 'courbe'
      });
    }
    points.forEach((p, i) => ajouter('circle', { cx: x(p.date).toFixed(1), cy: y(valeurs[i]).toFixed(1), r: 4.5, class: 'point' }));

    // Description pour les lecteurs d'écran
    const debut = UI.nombre(valeurs[0]) + ' ' + unite + ' le ' + Dates.fr(premier);
    const fin = UI.nombre(valeurs[valeurs.length - 1]) + ' ' + unite + ' le ' + Dates.fr(dernier);
    svg.setAttribute('aria-label', points.length === 1
      ? 'Courbe de poids : une seule pesée, ' + debut + '.'
      : 'Courbe de poids, ' + points.length + ' pesées : de ' + debut + ' à ' + fin + '.');
    return svg;
  }
};
