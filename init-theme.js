/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Pose le thème et la taille du texte choisis AVANT le premier
   affichage : sans cela, l'écran s'allumerait une fraction de seconde
   avec les réglages par défaut (un éclair désagréable). */
'use strict';

(function () {
  var t = 'omni', z = 'normal';
  try {
    var r = localStorage.getItem('omnianimaux_theme');
    if (r === 'omni' || r === 'sombre' || r === 'clair') t = r;
    var s = localStorage.getItem('omnianimaux_taille');
    if (s === 'normal' || s === 'grand' || s === 'tresgrand') z = s;
  } catch (e) { /* stockage refusé : réglages par défaut */ }
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.taille = z;
})();
