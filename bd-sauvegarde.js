/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   BD-SAUVEGARDE — sauvegarder, restaurer, et l'exemple de démonstration.

   La sauvegarde est un fichier texte au format JSON qui contient TOUT :
   animaux, photos, pesées, vaccins… Il porte un numéro de version du
   format (« versionFormat ») : si un jour le format change, une
   nouvelle version de l'application saura encore lire les anciens
   fichiers.

   Le mot de passe (s'il y en a un) n'est jamais mis dans la sauvegarde.
   ============================================================ */
'use strict';

const Sauvegarde = {
  FORMAT: 'omni-animaux-sauvegarde',
  VERSION_FORMAT: 1,
  VERSION_CHIFFREMENT: 1,
  KDF: 'PBKDF2-SHA256',
  ITERATIONS: 210000,
  ALGO: 'AES-GCM',
  MAX_TAILLE_FICHIER: 50 * 1024 * 1024,
  MAX_FICHES: 50000,

  /* ---------- Exporter ---------- */

  /* Prépare le contenu du fichier de sauvegarde */
  async preparer() {
    const donnees = await BD.toutLire();
    let vetoUrgence = null;
    try {
      vetoUrgence = nettoyerVetoUrgence(await BD.reglage('vetoUrgence', null));
    } catch (e) {
      vetoUrgence = null;
    }
    return {
      format: this.FORMAT,
      versionFormat: this.VERSION_FORMAT,
      application: 'Omni-Animalia ' + VERSION,
      exporteLe: new Date().toISOString(),
      reglages: {
        theme: await BD.reglage('theme', 'omni'),
        taille: await BD.reglage('taille', 'normal'),
        unitePoids: await BD.reglage('unitePoids', 'kg'),
        contactGarde: await BD.reglage('contactGarde', null),
        vetoUrgence
      },
      donnees
    };
  },

  /* ---------- Chiffrement optionnel (Web Crypto : PBKDF2 + AES-GCM) ---------- */

  _verifierWebCrypto() {
    if (typeof window === 'undefined' || !window.crypto || !crypto.subtle) {
      throw BD.erreur('Ce navigateur ne permet pas le chiffrement (il faut une adresse https).');
    }
  },

  _versBase64(octets) {
    const arr = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
    const morceaux = [];
    for (let i = 0; i < arr.length; i += 0x8000) {
      morceaux.push(String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000)));
    }
    return btoa(morceaux.join(''));
  },

  _depuisBase64(texte) {
    if (typeof texte !== 'string' || !texte) {
      throw BD.erreur('Cette sauvegarde chiffrée est abîmée.');
    }
    let binaire;
    try {
      binaire = atob(texte);
    } catch (e) {
      throw BD.erreur('Cette sauvegarde chiffrée est abîmée.');
    }
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    return octets;
  },

  estChiffree(objet) {
    return !!(objet && typeof objet === 'object' && !Array.isArray(objet) &&
      objet.format === this.FORMAT && objet.chiffre === true);
  },

  verifierEnveloppe(enveloppe) {
    if (!this.estChiffree(enveloppe)) {
      throw BD.erreur('Ce fichier n’est pas une sauvegarde chiffrée d’Omni-Animalia.');
    }
    if (!Number.isInteger(enveloppe.versionChiffrement) || enveloppe.versionChiffrement < 1) {
      throw BD.erreur('Cette sauvegarde chiffrée est vide ou abîmée (version incorrecte).');
    }
    if (enveloppe.versionChiffrement > this.VERSION_CHIFFREMENT) {
      throw BD.erreur('Cette sauvegarde vient d’une version plus récente d’Omni-Animalia. Mets l’application à jour, puis réessaie.');
    }
    if (enveloppe.kdf !== this.KDF || enveloppe.algo !== this.ALGO) {
      throw BD.erreur('Cette sauvegarde chiffrée utilise une méthode inconnue ou abîmée.');
    }
    if (!Number.isInteger(enveloppe.iterations) || enveloppe.iterations < 10000 || enveloppe.iterations > 2000000) {
      throw BD.erreur('Cette sauvegarde chiffrée est abîmée (paramètres invalides).');
    }
    const sel = this._depuisBase64(enveloppe.sel);
    const iv = this._depuisBase64(enveloppe.iv);
    const donnees = this._depuisBase64(enveloppe.donnees);
    if (sel.length !== 16) throw BD.erreur('Cette sauvegarde chiffrée est abîmée (sel invalide).');
    if (iv.length !== 12) throw BD.erreur('Cette sauvegarde chiffrée est abîmée (vecteur d’initialisation invalide).');
    if (donnees.length < 16) throw BD.erreur('Cette sauvegarde chiffrée est abîmée (données incomplètes).');
    return { sel, iv, donnees, iterations: enveloppe.iterations };
  },

  async _deriverCle(motDePasse, sel, iterations, usages) {
    const cleMdp = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations },
      cleMdp,
      { name: 'AES-GCM', length: 256 },
      false,
      usages
    );
  },

  async chiffrer(objet, motDePasse) {
    this._verifierWebCrypto();
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) {
      throw BD.erreur('Contenu de sauvegarde invalide.');
    }
    if (typeof motDePasse !== 'string' || !motDePasse.trim()) {
      throw BD.erreur('Le mot de passe ne peut pas être vide.');
    }
    const sel = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cle = await this._deriverCle(motDePasse, sel, this.ITERATIONS, ['encrypt']);
    const clair = new TextEncoder().encode(JSON.stringify(objet));
    const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, clair);
    return {
      format: this.FORMAT,
      chiffre: true,
      versionChiffrement: this.VERSION_CHIFFREMENT,
      kdf: this.KDF,
      iterations: this.ITERATIONS,
      algo: this.ALGO,
      sel: this._versBase64(sel),
      iv: this._versBase64(iv),
      donnees: this._versBase64(new Uint8Array(chiffre))
    };
  },

  async dechiffrer(enveloppe, motDePasse) {
    this._verifierWebCrypto();
    const { sel, iv, donnees, iterations } = this.verifierEnveloppe(enveloppe);
    if (typeof motDePasse !== 'string' || !motDePasse) {
      throw BD.erreur('Entre un mot de passe.');
    }
    try {
      const cle = await this._deriverCle(motDePasse, sel, iterations, ['decrypt']);
      const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cle, donnees);
      const texte = new TextDecoder('utf-8', { fatal: true }).decode(clair);
      return JSON.parse(texte);
    } catch (e) {
      throw BD.erreur('Mot de passe incorrect ou sauvegarde abîmée.');
    }
  },

  /* Fabrique le fichier de sauvegarde (sans l'envoyer nulle part).
     « pourPartage » : Chrome sur Android refuse de partager un fichier
     .json ; on l'envoie donc comme un simple fichier texte (.txt). Le
     contenu est exactement le même, et « Restaurer » accepte les deux. */
  async fichier(pourPartage, motDePasse) {
    let contenu = await this.preparer();
    if (motDePasse) contenu = await this.chiffrer(contenu, motDePasse);
    const nom = 'omni-animalia-sauvegarde-' + Dates.aujourdhui() + (pourPartage ? '.txt' : '.json');
    return new File([JSON.stringify(contenu)], nom, { type: pourPartage ? 'text/plain' : 'application/json' });
  },

  /* Fabrique le fichier, puis le partage (mode « partager » : Drive,
     e-mail…) ou le télécharge (mode « telecharger »).
     Renvoie { nom, taille, resultat } ; resultat vaut 'partage',
     'telecharge' ou 'annule' (menu de partage fermé sans choisir). */
  async exporter(mode, motDePasse) {
    const f = await this.fichier(mode === 'partager', motDePasse);
    let resultat;
    if (mode === 'partager') {
      resultat = await Partage.envoyer(f, 'Sauvegarde Omni-Animalia');
    } else {
      Partage.telecharger(f);
      resultat = 'telecharge';
    }
    if (resultat !== 'annule') await BD.definirReglage('derniereSauvegarde', Dates.aujourdhui());
    return { nom: f.name, taille: f.size, resultat };
  },

  /* ---------- Importer ---------- */

  /* Lit et parse le JSON d'un fichier de sauvegarde sans encore le déchiffrer ni valider. */
  async lireObjet(fichier) {
    if (!fichier) throw BD.erreur('Aucun fichier choisi.');
    if (typeof fichier.size === 'number' && fichier.size > this.MAX_TAILLE_FICHIER) {
      throw BD.erreur('Ce fichier est beaucoup trop gros pour être une sauvegarde d’Omni-Animalia.');
    }
    let texte;
    try {
      texte = await fichier.text();
    } catch (e) {
      throw BD.erreur('Le fichier n’a pas pu être lu.');
    }
    try {
      return JSON.parse(texte);
    } catch (e) {
      throw BD.erreur('Ce fichier n’est pas une sauvegarde d’Omni-Animalia (il n’est pas au format JSON).');
    }
  },

  /* Lit le fichier choisi et vérifie qu'il est bien une sauvegarde valable.
     Si la sauvegarde est chiffrée, « motDePasse » est requis.
     Renvoie { donnees, reglages, resume } ou lance une erreur lisible. */
  async lireFichier(fichier, motDePasse) {
    let objet = await this.lireObjet(fichier);
    if (this.estChiffree(objet)) {
      if (!motDePasse) throw BD.erreur('Cette sauvegarde est protégée par un mot de passe.');
      objet = await this.dechiffrer(objet, motDePasse);
    }
    return this.valider(objet);
  },

  /* Vérifie le contenu, fiche par fiche */
  valider(objet) {
    if (!objet || typeof objet !== 'object' || Array.isArray(objet) || objet.format !== this.FORMAT) {
      throw BD.erreur('Ce fichier n’est pas une sauvegarde d’Omni-Animalia.');
    }
    if (this.estChiffree(objet)) {
      throw BD.erreur('Cette sauvegarde est protégée par un mot de passe.');
    }
    if (!Number.isInteger(objet.versionFormat) || objet.versionFormat < 1) {
      throw BD.erreur('Cette sauvegarde est vide ou abîmée (numéro de version incorrect).');
    }
    if (objet.versionFormat > this.VERSION_FORMAT) {
      throw BD.erreur('Cette sauvegarde vient d’une version plus récente d’Omni-Animalia. Mets l’application à jour, puis réessaie.');
    }
    if (!objet.donnees || typeof objet.donnees !== 'object' || Array.isArray(objet.donnees)) {
      throw BD.erreur('Cette sauvegarde est vide ou abîmée.');
    }
    const protoDonnees = Object.getPrototypeOf(objet.donnees);
    if (protoDonnees !== Object.prototype && protoDonnees !== null) {
      throw BD.erreur('Cette sauvegarde est vide ou abîmée.');
    }

    const donnees = {};
    let totalFiches = 0;
    for (const magasin of MAGASINS_DONNEES) {
      const brut = Object.prototype.hasOwnProperty.call(objet.donnees, magasin) ? objet.donnees[magasin] : undefined;
      const liste = brut === undefined ? [] : brut;
      if (!Array.isArray(liste)) throw BD.erreur('Cette sauvegarde est abîmée (partie « ' + magasin + ' »).');
      totalFiches += liste.length;
      if (totalFiches > this.MAX_FICHES) {
        throw BD.erreur('Cette sauvegarde est abîmée : elle contient trop de fiches.');
      }
      const ids = new Set();
      donnees[magasin] = liste.map((fiche, i) => {
        try {
          const propre = nettoyerFiche(magasin, fiche);
          if (ids.has(propre.id)) throw new Error('identifiant en double');
          ids.add(propre.id);
          return propre;
        } catch (e) {
          throw BD.erreur('Cette sauvegarde est abîmée : fiche n° ' + (i + 1) + ' de la partie « ' + magasin + ' » (' + e.message + ').');
        }
      });
    }

    if (objet.reglages !== undefined && objet.reglages !== null) {
      if (typeof objet.reglages !== 'object' || Array.isArray(objet.reglages)) {
        throw BD.erreur('Cette sauvegarde est abîmée (réglages illisibles).');
      }
      const protoReglages = Object.getPrototypeOf(objet.reglages);
      if (protoReglages !== Object.prototype && protoReglages !== null) {
        throw BD.erreur('Cette sauvegarde est abîmée (réglages illisibles).');
      }
    }
    const reglages = {};
    const r = objet.reglages || {};
    if (Object.prototype.hasOwnProperty.call(r, 'theme') && ['omni', 'sombre', 'clair'].includes(r.theme)) reglages.theme = r.theme;
    if (Object.prototype.hasOwnProperty.call(r, 'unitePoids') && ['kg', 'g'].includes(r.unitePoids)) reglages.unitePoids = r.unitePoids;
    if (Object.prototype.hasOwnProperty.call(r, 'taille') && ['normal', 'grand', 'tresgrand'].includes(r.taille)) reglages.taille = r.taille;
    if (Object.prototype.hasOwnProperty.call(r, 'contactGarde') && r.contactGarde !== undefined && r.contactGarde !== null) {
      const c = r.contactGarde;
      if (typeof c !== 'object' || Array.isArray(c)) {
        throw BD.erreur('Cette sauvegarde est abîmée (contact de garde illisible).');
      }
      const protoContact = Object.getPrototypeOf(c);
      if (protoContact !== Object.prototype && protoContact !== null) {
        throw BD.erreur('Cette sauvegarde est abîmée (contact de garde illisible).');
      }
      let nom = '';
      if (Object.prototype.hasOwnProperty.call(c, 'nom') && c.nom !== undefined && c.nom !== null) {
        if (typeof c.nom !== 'string') throw BD.erreur('Cette sauvegarde est abîmée (nom du contact de garde invalide).');
        nom = c.nom.trim().slice(0, 120);
      }
      let telephone = '';
      if (Object.prototype.hasOwnProperty.call(c, 'telephone') && c.telephone !== undefined && c.telephone !== null) {
        if (typeof c.telephone !== 'string') throw BD.erreur('Cette sauvegarde est abîmée (téléphone du contact de garde invalide).');
        const telTrim = c.telephone.trim();
        if (telTrim && !/^[0-9+(). -]{3,30}$/.test(telTrim)) {
          throw BD.erreur('Cette sauvegarde est abîmée (numéro de téléphone du contact de garde invalide).');
        }
        telephone = telTrim.slice(0, 30);
      }
      if (nom || telephone) {
        reglages.contactGarde = { nom, telephone };
      }
    }
    if (Object.prototype.hasOwnProperty.call(r, 'vetoUrgence') && r.vetoUrgence !== undefined && r.vetoUrgence !== null) {
      try {
        const veto = nettoyerVetoUrgence(r.vetoUrgence);
        if (veto) reglages.vetoUrgence = veto;
      } catch (e) {
        throw BD.erreur('Cette sauvegarde est abîmée (' + e.message + ').');
      }
    }

    const resume = {
      animaux: donnees.animaux.length,
      veterinaires: donnees.veterinaires.length,
      fiches: MAGASINS_LIES.reduce((s, m) => s + donnees[m].length, 0),
      date: typeof objet.exporteLe === 'string' ? objet.exporteLe.slice(0, 10) : ''
    };
    return { donnees, reglages, resume };
  },

  /* Écrit la sauvegarde dans la base.
     mode « remplacer » : tout est effacé puis remplacé par le fichier.
     mode « fusionner » : les fiches du fichier sont ajoutées ; une fiche
     qui existe déjà (même identifiant) est remplacée par celle du fichier.
     Tout se fait en UNE transaction : en cas de problème, rien ne change. */
  async importer({ donnees, reglages }, mode) {
    // Les fiches dont l'animal n'existe ni dans le fichier ni sur le téléphone sont écartées
    const existants = mode === 'fusionner' ? (await BD.tout('animaux')).map((a) => a.id) : [];
    const animauxConnus = new Set([...existants, ...donnees.animaux.map((a) => a.id)]);
    let ecartees = 0;

    const tous = [...MAGASINS_DONNEES, 'reglages'];
    const tx = await BD._transaction(tous, 'readwrite');
    const reg = tx.objectStore('reglages');
    if (mode === 'remplacer') {
      for (const nom of MAGASINS_DONNEES) tx.objectStore(nom).clear();
      if (!reglages || !reglages.contactGarde) reg.delete('contactGarde');
      if (!reglages || !reglages.vetoUrgence) reg.delete('vetoUrgence');
      if (!reglages || !reglages.unitePoids) reg.delete('unitePoids');
      reg.delete('derniereSauvegarde');
    }
    let ajoutees = 0;
    for (const nom of MAGASINS_DONNEES) {
      const magasin = tx.objectStore(nom);
      for (const fiche of donnees[nom]) {
        if (MAGASINS_LIES.includes(nom) && !animauxConnus.has(fiche.animalId)) { ecartees++; continue; }
        magasin.put(fiche);
        ajoutees++;
      }
    }
    for (const [cle, valeur] of Object.entries(reglages || {})) reg.put({ cle, valeur });
    await BD.finTransaction(tx);
    return { ajoutees, ecartees };
  },

  /* ---------- Exemple de démonstration ----------
     Un chien et un chat inventés, pour essayer l'application sans rien
     taper. Toutes leurs fiches portent « exemple: true » : on peut donc
     les retirer en un clic, sans toucher aux vraies données. */

  async exemplePresent() {
    const [animaux, vetos] = await Promise.all([BD.tout('animaux'), BD.tout('veterinaires')]);
    return animaux.some((a) => a.exemple) || vetos.some((v) => v.exemple);
  },

  async chargerExemple() {
    const j = (n) => Dates.ajouterJours(Dates.aujourdhui(), n);   // date relative à aujourd'hui
    const id = () => BD.nouvelId();
    const veto = { id: id(), nom: 'Dr Exemple', clinique: 'Clinique vétérinaire des Tilleuls (fictive)', telephone: '01 23 45 67 89', adresse: '1 rue Imaginaire, 00000 Exempleville', notes: 'Vétérinaire inventé pour la démonstration.', exemple: true };
    const chien = {
      id: id(), nom: 'Biscuit (exemple)', espece: 'Chien', race: 'Croisé labrador', sexe: 'male',
      couleur: 'Sable, tache blanche sur le poitrail', naissance: Dates.ajouterMois(Dates.aujourdhui(), -40),
      naissanceApprox: false, puce: '250269600000000', tatouage: '', sterilise: true,
      dateSterilisation: Dates.ajouterMois(Dates.aujourdhui(), -28), notes: 'Animal fictif de démonstration.',
      unitePoids: 'kg', vetoId: veto.id, archive: false,
      alimMarque: 'Croquettes adulte (exemple)', alimQuantite: '280 g', alimRepas: 2,
      alimRemarques: 'Eau fraîche à volonté.', alimEviter: 'Chocolat, raisin, oignon.',
      consignesGarde: 'Deux promenades par jour (matin et soir), toujours en laisse près de la route. Dort dans son panier dans l’entrée. (exemple)',
      exemple: true, creeLe: Dates.aujourdhui()
    };
    const chat = {
      id: id(), nom: 'Moka (exemple)', espece: 'Chat', race: 'Européen', sexe: 'femelle',
      couleur: 'Tigrée grise', naissance: Dates.ajouterJours(Dates.aujourdhui(), -70),
      naissanceApprox: true, puce: '', tatouage: 'ABC123', sterilise: false,
      notes: 'Animal fictif de démonstration.', unitePoids: 'g', vetoId: veto.id, archive: false,
      alimMarque: 'Pâtée chaton (exemple)', alimQuantite: '150 g', alimRepas: 4,
      exemple: true, creeLe: Dates.aujourdhui()
    };
    const fiches = {
      veterinaires: [veto],
      animaux: [chien, chat],
      pesees: [
        { animalId: chien.id, date: j(-300), grammes: 27800 },
        { animalId: chien.id, date: j(-200), grammes: 28600 },
        { animalId: chien.id, date: j(-100), grammes: 29400, note: 'Un peu moins de croquettes conseillé.' },
        { animalId: chien.id, date: j(-10), grammes: 28900 },
        { animalId: chat.id, date: j(-42), grammes: 650 },
        { animalId: chat.id, date: j(-28), grammes: 900 },
        { animalId: chat.id, date: j(-14), grammes: 1150 },
        { animalId: chat.id, date: j(-1), grammes: 1400 }
      ],
      vaccins: [
        { animalId: chien.id, nom: 'CHPPiL (exemple)', date: j(-360), rappel: j(5), veterinaire: veto.nom, lot: 'LOT-EX-01' },
        { animalId: chien.id, nom: 'Rage (exemple)', date: j(-360), rappel: j(-3), veterinaire: veto.nom },
        { animalId: chat.id, nom: 'Typhus et coryza (exemple)', date: j(-14), rappel: j(14), veterinaire: veto.nom }
      ],
      antiparasitaires: [
        { animalId: chien.id, type: 'vermifuge', produit: 'Vermifuge (exemple)', date: j(-80), prochaine: j(10), dose: '1 comprimé' },
        { animalId: chien.id, type: 'anti-puces', produit: 'Pipette (exemple)', date: j(-31), prochaine: j(-1), dose: '1 pipette' },
        { animalId: chat.id, type: 'vermifuge', produit: 'Pâte vermifuge (exemple)', date: j(-15), prochaine: j(0), dose: '1 graduation' }
      ],
      traitements: [
        { animalId: chien.id, nom: 'Anti-inflammatoire (exemple)', dose: '1 comprimé', frequence: 'Matin et soir, au repas', debut: j(-3), fin: j(4), statut: 'en-cours', prisesParJour: 2 },
        { animalId: chat.id, nom: 'Collyre (exemple)', dose: '1 goutte', frequence: 'Matin et soir', debut: j(-30), fin: j(-23), statut: 'termine' }
      ],
      rdv: [
        { animalId: chien.id, date: j(-400), heure: '09:00', motif: 'Vaccins (exemple)', veterinaire: veto.nom, compteRendu: 'RAS.', cout: 72.5 },
        { animalId: chien.id, date: j(-60), heure: '10:30', motif: 'Visite annuelle (exemple)', veterinaire: veto.nom, compteRendu: 'Bon état général.', cout: 55 },
        { animalId: chat.id, date: j(20), heure: '17:00', motif: 'Consultation stérilisation (exemple)', veterinaire: veto.nom }
      ],
      notes: [
        { animalId: chien.id, date: j(-20), categorie: 'allergie', texte: 'Démangeaisons après une promenade dans les hautes herbes (exemple).' },
        { animalId: chien.id, date: j(-5), categorie: 'observation', texte: 'Mange bien, très joueur (exemple).' }
      ],
      taches: [
        { animalId: chien.id, titre: 'Brosser le pelage (exemple)', echeance: j(-2), recN: 1, recUnite: 'semaines', fait: false },
        { animalId: chat.id, titre: 'Couper les griffes (exemple)', echeance: j(3), recN: 1, recUnite: 'mois', recJour: Dates.lire(j(3)).getDate(), fait: false },
        { animalId: chat.id, titre: 'Acheter un griffoir (exemple)', echeance: j(25), fait: false }
      ]
    };
    const tous = Object.keys(fiches);
    const tx = await BD._transaction(tous, 'readwrite');
    for (const nom of tous) {
      for (const fiche of fiches[nom]) {
        if (!fiche.id) fiche.id = id();
        fiche.exemple = true;
        tx.objectStore(nom).put(nettoyerFiche(nom, fiche));
      }
    }
    await BD.finTransaction(tx);
  },

  /* Retire tout ce qui vient de l'exemple (et toute fiche liée aux animaux d'exemple) */
  async supprimerExemple() {
    const tx = await BD._transaction(MAGASINS_DONNEES, 'readwrite');
    const magAnimaux = tx.objectStore('animaux');
    const magVetos = tx.objectStore('veterinaires');
    const exempleAnimalIds = new Set();
    const vetosRestants = new Set();

    magVetos.getAll().onsuccess = (evVetos) => {
      for (const v of evVetos.target.result) {
        if (v.exemple) magVetos.delete(v.id);
        else vetosRestants.add(v.id);
      }

      magAnimaux.getAll().onsuccess = (evAnimaux) => {
        for (const a of evAnimaux.target.result) {
          if (a.exemple) {
            exempleAnimalIds.add(a.id);
            magAnimaux.delete(a.id);
          } else if (a.vetoId && !vetosRestants.has(a.vetoId)) {
            const maj = { ...a };
            delete maj.vetoId;
            magAnimaux.put(maj);
          }
        }

        for (const nom of MAGASINS_LIES) {
          const magasin = tx.objectStore(nom);
          magasin.openCursor().onsuccess = (e) => {
            const curseur = e.target.result;
            if (!curseur) return;
            const r = curseur.value;
            if (r.exemple || exempleAnimalIds.has(r.animalId)) {
              curseur.delete();
            }
            curseur.continue();
          };
        }
      };
    };

    await BD.finTransaction(tx);
  }
};
