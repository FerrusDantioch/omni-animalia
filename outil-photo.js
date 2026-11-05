/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OUTIL-PHOTO — réduit les photos avant de les enregistrer.

   Une photo de téléphone pèse souvent 3 à 8 Mo. On la redessine dans
   un « canvas » (une zone de dessin invisible) à 800 pixels au plus de
   côté, puis on l'enregistre en JPEG qualité 0,8 : elle ne pèse plus
   qu'environ 60 à 150 Ko, et reste bien nette sur l'écran.
   ============================================================ */
'use strict';

const Photo = {
  COTE_MAX: 800,       // taille maximale du plus grand côté, en pixels
  QUALITE: 0.8,        // qualité JPEG (de 0 à 1)

  /* Charge l'image depuis le fichier choisi.
     createImageBitmap tient compte du sens de la photo (portrait ou
     paysage) enregistré par l'appareil photo. */
  async charger(fichier) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
      } catch (e) { /* on essaie l'autre méthode ci-dessous */ }
    }
    return new Promise((ok, echec) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); echec(new Error('Cette image n’a pas pu être lue. Essayez une autre photo (JPEG ou PNG).')); };
      img.src = url;
    });
  },

  /* Renvoie la photo réduite, sous forme de texte « data:image/jpeg;base64,… » */
  async reduire(fichier) {
    if (!fichier || !/^image\//.test(fichier.type || 'image/')) {
      throw new Error('Ce fichier n’est pas une image.');
    }
    const image = await this.charger(fichier);
    const largeur = image.width;
    const hauteur = image.height;
    if (!largeur || !hauteur) throw new Error('Cette image est vide ou abîmée.');

    const echelle = Math.min(1, this.COTE_MAX / Math.max(largeur, hauteur));
    const l = Math.max(1, Math.round(largeur * echelle));
    const h = Math.max(1, Math.round(hauteur * echelle));
    const canvas = document.createElement('canvas');
    canvas.width = l;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Fond clair : une image PNG transparente ne devient pas noire en JPEG
    ctx.fillStyle = '#f7f8f9';
    ctx.fillRect(0, 0, l, h);
    ctx.drawImage(image, 0, 0, l, h);
    if (image.close) image.close();     // libère la mémoire tout de suite
    return canvas.toDataURL('image/jpeg', this.QUALITE);
  }
};
