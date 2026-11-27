/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   BD-BASE — la base de données de l'application (IndexedDB).

   IndexedDB est une vraie petite base de données rangée DANS le
   navigateur du téléphone. Contrairement au « localStorage », elle
   accepte beaucoup de données (les photos notamment).

   La base contient des « magasins » (comme des tiroirs) :
   - animaux, veterinaires, reglages ;
   - et, pour chaque animal : pesees, vaccins, antiparasitaires,
     traitements, rdv (rendez-vous), notes, taches.
   Chaque fiche a un identifiant unique « id ». Les fiches liées à un
   animal portent son identifiant dans « animalId ».

   ⚠️ Toutes les applications de ferrusdantioch.github.io partagent la
   même adresse : le nom de la base (« omni-animalia ») doit rester
   unique et ne jamais changer, sinon les données seraient « perdues ».
   ============================================================ */
'use strict';

/* ---------- La description de chaque fiche ----------
   Pour chaque magasin : la liste des champs et leur type.
   Sert à « nettoyer » une fiche (garder seulement les champs connus, du
   bon type), en particulier quand on importe une sauvegarde.
   Types : t = texte, d = date AAAA-MM-JJ, h = heure HH:MM, n = nombre,
           b = oui/non, photo = image, photos = liste d'images (documents),
           prises = prises de médicament par jour, ou une liste de valeurs permises. */
const SCHEMAS = {
  animaux: {
    id: 't', nom: 't', espece: 't', race: 't', sexe: ['', 'male', 'femelle', 'inconnu'],
    couleur: 't', naissance: 'd', naissanceApprox: 'b', puce: 't', tatouage: 't',
    sterilise: 'b', dateSterilisation: 'd', photo: 'photo', notes: 't',
    unitePoids: ['kg', 'g'], vetoId: 't',
    archive: 'b', motifArchive: 't', dateArchive: 'd',
    alimMarque: 't', alimQuantite: 't', alimRepas: 'n', alimRemarques: 't', alimEviter: 't',
    consignesGarde: 't',
    poidsIdealMin: 'n', poidsIdealMax: 'n',
    passeport: 't', assuranceCompagnie: 't', assuranceContrat: 't', assuranceTelephone: 't',
    exemple: 'b', creeLe: 'd'
  },
  pesees:           { id: 't', animalId: 't', date: 'd', grammes: 'n', note: 't', exemple: 'b' },
  vaccins:          { id: 't', animalId: 't', nom: 't', date: 'd', rappel: 'd', veterinaire: 't', lot: 't', note: 't', exemple: 'b' },
  antiparasitaires: { id: 't', animalId: 't', type: ['vermifuge', 'anti-puces', 'anti-tiques', 'autre'], produit: 't', date: 'd', prochaine: 'd', dose: 't', note: 't', exemple: 'b' },
  traitements:      { id: 't', animalId: 't', nom: 't', dose: 't', frequence: 't', debut: 'd', fin: 'd', statut: ['en-cours', 'termine'], prisesParJour: 'n', prises: 'prises', note: 't', exemple: 'b' },
  rdv:              { id: 't', animalId: 't', date: 'd', heure: 'h', motif: 't', veterinaire: 't', compteRendu: 't', cout: 'n', exemple: 'b' },
  notes:            { id: 't', animalId: 't', date: 'd', categorie: ['symptome', 'observation', 'examen', 'allergie', 'antecedent', 'autre'], texte: 't', pieces: 'photos', exemple: 'b' },
  taches:           { id: 't', animalId: 't', titre: 't', echeance: 'd', recN: 'n', recUnite: ['', 'jours', 'semaines', 'mois', 'ans'], recJour: 'n', fait: 'b', faitLe: 'd', suivanteId: 't', note: 't', exemple: 'b' },
  veterinaires:     { id: 't', nom: 't', clinique: 't', telephone: 't', adresse: 't', notes: 't', exemple: 'b' }
};

/* Champs obligatoires de chaque magasin (une fiche sans eux est refusée) */
const OBLIGATOIRES = {
  animaux: ['id', 'nom'],
  pesees: ['id', 'animalId', 'date', 'grammes'],
  vaccins: ['id', 'animalId', 'nom', 'date'],
  antiparasitaires: ['id', 'animalId', 'type', 'date'],
  traitements: ['id', 'animalId', 'nom'],
  rdv: ['id', 'animalId', 'date'],
  notes: ['id', 'animalId', 'date'],
  taches: ['id', 'animalId', 'titre'],
  veterinaires: ['id', 'nom']
};

/* Une image enregistrée : seules les vraies images encodées sont acceptées
   (jamais une adresse internet), et pas plus de 8 millions de caractères. */
function imageValide(v) {
  return typeof v === 'string' && v.length <= 8000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
}
const MAX_PIECES = 6;          // documents joints au plus par note
const MAX_PRISES_JOURS = 400;  // jours d'historique de prises au plus par traitement
const ID_VALIDE = /^[A-Za-z0-9._-]{1,128}$/;
const CHAMPS_ID = new Set(['id', 'animalId', 'vetoId', 'suivanteId']);
const LIMITES_TEXTE_ANIMAL = {
  passeport: 80,
  assuranceCompagnie: 120,
  assuranceContrat: 80,
  assuranceTelephone: 30
};

/* Les magasins dont chaque fiche appartient à un animal */
const MAGASINS_LIES = ['pesees', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes', 'taches'];
const MAGASINS_DONNEES = ['animaux', 'veterinaires', ...MAGASINS_LIES];

/* Nettoie une fiche selon son schéma.
   Renvoie la fiche propre, ou lance une erreur expliquant le problème. */
function nettoyerFiche(magasin, fiche) {
  if (!Object.prototype.hasOwnProperty.call(SCHEMAS, magasin)) throw new Error('magasin inconnu');
  const schema = SCHEMAS[magasin];
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) throw new Error('une fiche n’est pas lisible');
  const proto = Object.getPrototypeOf(fiche);
  if (proto !== Object.prototype && proto !== null) throw new Error('une fiche n’est pas lisible');
  const propre = {};
  for (const [champ, type] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(fiche, champ)) continue;
    const v = fiche[champ];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(type)) {
      if (!type.includes(v)) throw new Error('valeur inattendue pour « ' + champ + ' »');
      propre[champ] = v;
    } else if (type === 't') {
      if (typeof v !== 'string') throw new Error('« ' + champ + ' » devrait être un texte');
      if (CHAMPS_ID.has(champ)) {
        if (!ID_VALIDE.test(v)) throw new Error('identifiant incorrect pour « ' + champ + ' »');
        propre[champ] = v;
      } else {
        const t = v.trim();
        if (!t) continue;
        if (magasin === 'animaux' && champ === 'assuranceTelephone' && /[\x00-\x1f\x7f]/.test(t)) {
          throw new Error('numéro de téléphone invalide pour « ' + champ + ' »');
        }
        const max = (magasin === 'animaux' && LIMITES_TEXTE_ANIMAL[champ]) || 10000;
        propre[champ] = t.slice(0, max);
      }
    } else if (type === 'd') {
      if (!Dates.estValide(v)) throw new Error('date incorrecte pour « ' + champ + ' »');
      propre[champ] = v;
    } else if (type === 'h') {
      if (!Dates.heureValide(v)) throw new Error('heure incorrecte pour « ' + champ + ' »');
      propre[champ] = v;
    } else if (type === 'n') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('nombre incorrect pour « ' + champ + ' »');
      const val = v === 0 ? 0 : v;
      if (magasin === 'pesees' && champ === 'grammes' && val <= 0) throw new Error('nombre incorrect pour « ' + champ + ' »');
      if (magasin === 'animaux' && (champ === 'poidsIdealMin' || champ === 'poidsIdealMax') && val <= 0) {
        throw new Error('nombre incorrect pour « ' + champ + ' »');
      }
      if (magasin === 'taches' && champ === 'recN' && (!Number.isInteger(val) || val < 1)) throw new Error('nombre incorrect pour « ' + champ + ' »');
      if (magasin === 'taches' && champ === 'recJour' && (!Number.isInteger(val) || val < 1 || val > 31)) throw new Error('nombre incorrect pour « ' + champ + ' »');
      if (magasin === 'traitements' && champ === 'prisesParJour' && (!Number.isInteger(val) || val < 1 || val > 48)) throw new Error('nombre incorrect pour « ' + champ + ' »');
      propre[champ] = val;
    } else if (type === 'b') {
      if (typeof v !== 'boolean') throw new Error('« ' + champ + ' » devrait valoir vrai ou faux');
      propre[champ] = v;
    } else if (type === 'photo') {
      if (!imageValide(v)) throw new Error('photo illisible');
      propre[champ] = v;
    } else if (type === 'photos') {
      // Liste de documents (photos d'ordonnance, de résultats…)
      if (!Array.isArray(v) || v.length > MAX_PIECES || !v.every(imageValide)) throw new Error('document joint illisible');
      if (v.length) propre[champ] = v.slice();
    } else if (type === 'prises') {
      // { 'AAAA-MM-JJ': ['08:10', '20:05'], … } : les heures des prises de chaque jour
      if (typeof v !== 'object' || Array.isArray(v)) throw new Error('prises illisibles');
      const protoPrises = Object.getPrototypeOf(v);
      if (protoPrises !== Object.prototype && protoPrises !== null) throw new Error('prises illisibles');
      const jours = Object.keys(v);
      if (jours.length > MAX_PRISES_JOURS) throw new Error('prises illisibles');
      const prises = {};
      for (const jour of jours) {
        const heures = v[jour];
        if (!Dates.estValide(jour) || !Array.isArray(heures) || heures.length > 48 || !heures.every((h) => Dates.heureValide(h))) {
          throw new Error('prises illisibles');
        }
        if (heures.length) prises[jour] = heures.slice();
      }
      if (Object.keys(prises).length) propre[champ] = prises;
    }
  }
  for (const champ of OBLIGATOIRES[magasin]) {
    if (propre[champ] === undefined) throw new Error('le champ obligatoire « ' + champ + ' » manque');
  }
  // Cohérence des dates entre champs
  if (magasin === 'traitements' && propre.debut && propre.fin && propre.fin < propre.debut) {
    throw new Error('la date de fin précède le début');
  }
  if (magasin === 'animaux') {
    if (propre.naissance && propre.naissance > Dates.aujourdhui()) {
      throw new Error('la date de naissance est dans le futur');
    }
    if (propre.naissance && propre.dateSterilisation && propre.dateSterilisation < propre.naissance) {
      throw new Error('la stérilisation précède la naissance');
    }
    if (propre.naissance && propre.dateArchive && propre.dateArchive < propre.naissance) {
      throw new Error('la date d’archivage précède la naissance');
    }
    if (propre.poidsIdealMin !== undefined && propre.poidsIdealMax !== undefined && propre.poidsIdealMax < propre.poidsIdealMin) {
      throw new Error('le poids idéal maximal doit être supérieur ou égal au minimal');
    }
  }
  if (magasin === 'vaccins' && propre.date && propre.rappel && propre.rappel <= propre.date) {
    throw new Error('la date de rappel doit suivre la vaccination');
  }
  if (magasin === 'antiparasitaires' && propre.date && propre.prochaine && propre.prochaine <= propre.date) {
    throw new Error('la prochaine prise doit suivre la prise actuelle');
  }
  return propre;
}

/* Nettoie et vérifie les informations du vétérinaire d'urgence.
   Renvoie null si toutes les informations sont vides, ou l'objet nettoyé. */
function nettoyerVetoUrgence(valeur) {
  if (valeur === undefined || valeur === null) return null;
  if (typeof valeur !== 'object' || Array.isArray(valeur)) {
    throw BD.erreur('Vétérinaire d’urgence illisible.');
  }
  const proto = Object.getPrototypeOf(valeur);
  if (proto !== Object.prototype && proto !== null) {
    throw BD.erreur('Vétérinaire d’urgence illisible.');
  }
  const limites = { nom: 120, clinique: 150, adresse: 500, notes: 5000 };
  const propre = {};
  for (const [champ, max] of Object.entries(limites)) {
    if (Object.prototype.hasOwnProperty.call(valeur, champ) && valeur[champ] !== undefined && valeur[champ] !== null) {
      if (typeof valeur[champ] !== 'string') {
        throw BD.erreur('Champ « ' + champ + ' » du vétérinaire d’urgence invalide.');
      }
      propre[champ] = valeur[champ].trim().slice(0, max);
    } else {
      propre[champ] = '';
    }
  }
  let telephone = '';
  if (Object.prototype.hasOwnProperty.call(valeur, 'telephone') && valeur.telephone !== undefined && valeur.telephone !== null) {
    if (typeof valeur.telephone !== 'string') {
      throw BD.erreur('Téléphone du vétérinaire d’urgence invalide.');
    }
    const telTrim = valeur.telephone.trim();
    if (telTrim && !/^[0-9+(). -]{3,30}$/.test(telTrim)) {
      throw BD.erreur('Numéro de téléphone du vétérinaire d’urgence invalide.');
    }
    telephone = telTrim;
  }
  propre.telephone = telephone;
  if (!propre.nom && !propre.clinique && !propre.telephone && !propre.adresse && !propre.notes) {
    return null;
  }
  return propre;
}


/* ---------- L'accès à la base ---------- */
const BD = {
  NOM: 'omni-animalia',
  VERSION: 1,
  base: null,
  _ouverturePromesse: null,

  /* Une erreur avec un message déjà compréhensible */
  erreur(message) {
    const e = new Error(message);
    e.lisible = true;
    return e;
  },

  /* Ouvre la base (et la crée à la toute première utilisation) */
  ouvrir() {
    if (this.base) return Promise.resolve(this.base);
    if (this._ouverturePromesse) return this._ouverturePromesse;
    let regle = false;
    const p = new Promise((ok, echec) => {
      if (!('indexedDB' in window)) {
        regle = true;
        return echec(this.erreur('Ce navigateur ne permet pas d’enregistrer des données. Essaie avec Chrome, à jour.'));
      }
      let demande;
      try {
        demande = indexedDB.open(this.NOM, this.VERSION);
      } catch (e) {
        regle = true;
        return echec(this.erreur('La base de données est inaccessible (navigation privée ?).'));
      }
      demande.onupgradeneeded = () => {
        const base = demande.result;
        for (const nom of MAGASINS_DONNEES) {
          if (!base.objectStoreNames.contains(nom)) {
            const magasin = base.createObjectStore(nom, { keyPath: 'id' });
            if (MAGASINS_LIES.includes(nom)) magasin.createIndex('animalId', 'animalId', { unique: false });
          }
        }
        if (!base.objectStoreNames.contains('reglages')) base.createObjectStore('reglages', { keyPath: 'cle' });
      };
      demande.onsuccess = () => {
        const db = demande.result;
        if (regle) {
          try { db.close(); } catch (e) {}
          return;
        }
        regle = true;
        if (this._ouverturePromesse === p) this._ouverturePromesse = null;
        this.base = db;
        db.onclose = () => {
          if (this.base === db) this.base = null;
        };
        // Si une autre fenêtre installe une nouvelle version de la base
        db.onversionchange = (ev) => {
          if (this.base === db) this.base = null;
          db.close();
          const formOuvert = typeof Formulaire !== 'undefined' && Boolean(Formulaire.courant);
          if (ev && ev.newVersion !== null && !formOuvert) {
            location.reload();
          } else if (typeof UI !== 'undefined') {
            const message = formOuvert
              ? 'Base de données modifiée dans un autre onglet. Recharge la page après avoir enregistré ton formulaire.'
              : (ev && ev.newVersion === null
                ? 'Base de données supprimée dans un autre onglet. Recharge la page si nécessaire.'
                : 'Base de données modifiée dans un autre onglet. Recharge la page si nécessaire.');
            UI.annoncer(message, 'erreur');
          }
        };
        ok(db);
      };
      demande.onerror = () => {
        if (regle) return;
        regle = true;
        if (this._ouverturePromesse === p) this._ouverturePromesse = null;
        echec(this.erreur('La base de données n’a pas pu s’ouvrir. Ferme puis rouvre l’application. Si le problème continue, vérifie qu’il reste de la place sur le téléphone.'));
      };
      demande.onblocked = () => {
        if (regle) return;
        regle = true;
        if (this._ouverturePromesse === p) this._ouverturePromesse = null;
        echec(this.erreur('L’application est ouverte dans un autre onglet. Ferme les autres onglets puis réessaie.'));
      };
    });
    if (!regle) this._ouverturePromesse = p;
    return p;
  },

  /* Garantit une connexion ouverte avant toute opération */
  async _garantirBase() {
    if (this.base) return this.base;
    return this.ouvrir();
  },

  /* Ouvre une transaction et réouvre la base une fois si la connexion s'est fermée */
  async _transaction(magasins, mode = 'readonly') {
    let base = await this._garantirBase();
    try {
      return base.transaction(magasins, mode);
    } catch (e) {
      if (e && (e.name === 'InvalidStateError' || /closing|closed/i.test(e.message || ''))) {
        if (this.base === base) this.base = null;
        base = await this._garantirBase();
        return base.transaction(magasins, mode);
      }
      throw e;
    }
  },

  /* Transforme une « demande » IndexedDB en promesse */
  attendre(demande) {
    return new Promise((ok, echec) => {
      demande.onsuccess = () => ok(demande.result);
      demande.onerror = () => echec(demande.error);
    });
  },

  /* Attend la fin d'une transaction (= un groupe d'écritures tout-ou-rien) */
  finTransaction(tx) {
    return new Promise((ok, echec) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => echec(tx.error);
      tx.onabort = () => echec(tx.error || this.erreur('L’enregistrement a été annulé.'));
    });
  },

  /* Un nouvel identifiant unique */
  nouvelId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const octets = crypto.getRandomValues(new Uint8Array(16));
    return [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');
  },

  /* Toutes les fiches d'un magasin */
  async tout(magasin) {
    const tx = await this._transaction(magasin);
    return this.attendre(tx.objectStore(magasin).getAll());
  },

  /* Les fiches d'un magasin qui appartiennent à un animal */
  async parAnimal(magasin, animalId) {
    if (typeof animalId !== 'string' || !animalId) return [];
    const tx = await this._transaction(magasin);
    const index = tx.objectStore(magasin).index('animalId');
    return this.attendre(index.getAll(animalId));
  },

  /* Une fiche précise (ou undefined) */
  async lire(magasin, id) {
    const tx = await this._transaction(magasin);
    return this.attendre(tx.objectStore(magasin).get(id));
  },

  /* Ajoute ou remplace une fiche. Lui donne un identifiant si elle n'en a pas. */
  async enregistrer(magasin, fiche) {
    if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) {
      throw this.erreur('une fiche n’est pas lisible');
    }
    const proto = Object.getPrototypeOf(fiche);
    if (proto !== Object.prototype && proto !== null) {
      throw this.erreur('une fiche n’est pas lisible');
    }
    let entree = fiche;
    if (magasin !== 'reglages' && (fiche.id === undefined || fiche.id === null || fiche.id === '')) {
      entree = { ...fiche, id: this.nouvelId() };
    }
    const propre = magasin === 'reglages' ? entree : nettoyerFiche(magasin, entree);
    const tx = await this._transaction(magasin, 'readwrite');
    tx.objectStore(magasin).put(propre);
    await this.finTransaction(tx);
    return propre;
  },

  /* Supprime une fiche */
  async supprimer(magasin, id) {
    const tx = await this._transaction(magasin, 'readwrite');
    tx.objectStore(magasin).delete(id);
    await this.finTransaction(tx);
  },

  /* Supprime un animal ET tout son historique, en une seule fois */
  async supprimerAnimal(animalId) {
    const tx = await this._transaction(['animaux', ...MAGASINS_LIES], 'readwrite');
    tx.objectStore('animaux').delete(animalId);
    for (const nom of MAGASINS_LIES) {
      const index = tx.objectStore(nom).index('animalId');
      index.openKeyCursor(IDBKeyRange.only(animalId)).onsuccess = (e) => {
        const curseur = e.target.result;
        if (curseur) { tx.objectStore(nom).delete(curseur.primaryKey); curseur.continue(); }
      };
    }
    await this.finTransaction(tx);
  },

  /* Lit un réglage (ou la valeur par défaut s'il n'existe pas) */
  async reglage(cle, defaut) {
    const tx = await this._transaction('reglages');
    const r = await this.attendre(tx.objectStore('reglages').get(cle));
    return r === undefined ? defaut : r.valeur;
  },

  /* Enregistre un réglage */
  async definirReglage(cle, valeur) {
    let v = valeur;
    if (cle === 'vetoUrgence' && v !== undefined && v !== null) {
      v = nettoyerVetoUrgence(v);
    }
    const tx = await this._transaction('reglages', 'readwrite');
    if (v === undefined || v === null) tx.objectStore('reglages').delete(cle);
    else tx.objectStore('reglages').put({ cle, valeur: v });
    await this.finTransaction(tx);
  },

  /* Lit d'un coup tous les magasins de données (pour les rappels, la sauvegarde…) */
  async toutLire() {
    const tx = await this._transaction(MAGASINS_DONNEES);
    const resultat = {};
    await Promise.all(MAGASINS_DONNEES.map(async (nom) => {
      resultat[nom] = await this.attendre(tx.objectStore(nom).getAll());
    }));
    return resultat;
  },

  /* Efface TOUTES les données (fiches et réglages) */
  async toutEffacer() {
    const tous = [...MAGASINS_DONNEES, 'reglages'];
    const tx = await this._transaction(tous, 'readwrite');
    for (const nom of tous) tx.objectStore(nom).clear();
    await this.finTransaction(tx);
  }
};
