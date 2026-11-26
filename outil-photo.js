/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OUTIL-PHOTO — réduit les photos avant de les enregistrer.

   Une photo de téléphone pèse souvent 3 à 8 Mo. On la redessine dans
   un « canvas » (une zone de dessin invisible) à 800 pixels au plus de
   côté, puis on l'enregistre en JPEG qualité 0,8 : elle ne pèse plus
   qu'environ 60 à 150 Ko, et reste bien nette sur l'écran.

   Les DOCUMENTS (ordonnance, résultat d'analyse) gardent plus de
   détails (1600 pixels, qualité 0,85) pour que le texte reste lisible.
   ============================================================ */
'use strict';

const Photo = {
  COTE_MAX: 800,       // taille maximale du plus grand côté, en pixels
  QUALITE: 0.8,        // qualité JPEG (de 0 à 1)
  DOCUMENT: { cote: 1600, qualite: 0.85 },   // réglages pour un document

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
      let url;
      try {
        url = URL.createObjectURL(fichier);
      } catch (e) {
        return echec(new Error('Cette image n’a pas pu être lue. Essaie une autre photo (JPEG ou PNG).'));
      }
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); echec(new Error('Cette image n’a pas pu être lue. Essaie une autre photo (JPEG ou PNG).')); };
      img.onabort = img.onerror;
      img.src = url;
    });
  },

  /* Renvoie la photo réduite, sous forme de texte « data:image/jpeg;base64,… »
     options (facultatif) : { cote, qualite }, par exemple Photo.DOCUMENT */
  async reduire(fichier, options) {
    const cote = Number.isFinite(options && options.cote) && options.cote > 0 ? options.cote : this.COTE_MAX;
    const qualite = Number.isFinite(options && options.qualite) && options.qualite > 0 && options.qualite <= 1 ? options.qualite : this.QUALITE;
    const type = fichier && typeof fichier.type === 'string' ? fichier.type.trim().toLowerCase() : '';
    if (!fichier || !/^image\/[a-z0-9.+-]+$/.test(type) || type.includes('svg')) {
      throw new Error('Ce fichier n’est pas une image prise en charge (JPEG, PNG ou WebP).');
    }
    const image = await this.charger(fichier);
    try {
      const largeur = image.naturalWidth ?? image.width;
      const hauteur = image.naturalHeight ?? image.height;
      if (!Number.isFinite(largeur) || !Number.isFinite(hauteur) || largeur <= 0 || hauteur <= 0) {
        throw new Error('Cette image est vide ou abîmée.');
      }

      const echelle = Math.min(1, cote / Math.max(largeur, hauteur));
      const l = Math.max(1, Math.round(largeur * echelle));
      const h = Math.max(1, Math.round(hauteur * echelle));
      const canvas = document.createElement('canvas');
      canvas.width = l;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Impossible de préparer cette image sur cet appareil.');
      // Fond clair : une image PNG transparente ne devient pas noire en JPEG
      ctx.fillStyle = '#f7f8f9';
      ctx.fillRect(0, 0, l, h);
      ctx.drawImage(image, 0, 0, l, h);
      const dataUrl = canvas.toDataURL('image/jpeg', qualite);
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,')) {
        throw new Error('Cette image n’a pas pu être enregistrée au format JPEG.');
      }
      return dataUrl;
    } finally {
      if (image && typeof image.close === 'function') image.close();     // libère la mémoire tout de suite
    }
  }
};
