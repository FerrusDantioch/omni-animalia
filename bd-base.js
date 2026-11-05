/* Omni-Animaux — © 2026 Ferrus Dantioch
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
           b = oui/non, photo = image, ou une liste de valeurs permises. */
const SCHEMAS = {
  animaux: {
    id: 't', nom: 't', espece: 't', race: 't', sexe: ['', 'male', 'femelle', 'inconnu'],
    couleur: 't', naissance: 'd', naissanceApprox: 'b', puce: 't', tatouage: 't',
    sterilise: 'b', dateSterilisation: 'd', photo: 'photo', notes: 't',
    unitePoids: ['kg', 'g'], vetoId: 't',
    archive: 'b', motifArchive: 't', dateArchive: 'd',
    alimMarque: 't', alimQuantite: 't', alimRepas: 'n', alimRemarques: 't', alimEviter: 't',
    exemple: 'b', creeLe: 'd'
  },
  pesees:           { id: 't', animalId: 't', date: 'd', grammes: 'n', note: 't', exemple: 'b' },
  vaccins:          { id: 't', animalId: 't', nom: 't', date: 'd', rappel: 'd', veterinaire: 't', lot: 't', note: 't', exemple: 'b' },
  antiparasitaires: { id: 't', animalId: 't', type: ['vermifuge', 'anti-puces', 'anti-tiques', 'autre'], produit: 't', date: 'd', prochaine: 'd', dose: 't', note: 't', exemple: 'b' },
  traitements:      { id: 't', animalId: 't', nom: 't', dose: 't', frequence: 't', debut: 'd', fin: 'd', statut: ['en-cours', 'termine'], note: 't', exemple: 'b' },
  rdv:              { id: 't', animalId: 't', date: 'd', heure: 'h', motif: 't', veterinaire: 't', compteRendu: 't', cout: 'n', exemple: 'b' },
  notes:            { id: 't', animalId: 't', date: 'd', categorie: ['symptome', 'observation', 'examen', 'allergie', 'antecedent', 'autre'], texte: 't', exemple: 'b' },
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
  notes: ['id', 'animalId', 'date', 'texte'],
  taches: ['id', 'animalId', 'titre'],
  veterinaires: ['id', 'nom']
};

/* Les magasins dont chaque fiche appartient à un animal */
const MAGASINS_LIES = ['pesees', 'vaccins', 'antiparasitaires', 'traitements', 'rdv', 'notes', 'taches'];
const MAGASINS_DONNEES = ['animaux', 'veterinaires', ...MAGASINS_LIES];

/* Nettoie une fiche selon son schéma.
   Renvoie la fiche propre, ou lance une erreur expliquant le problème. */
function nettoyerFiche(magasin, fiche) {
  const schema = SCHEMAS[magasin];
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) throw new Error('une fiche n’est pas lisible');
  const propre = {};
  for (const [champ, type] of Object.entries(schema)) {
    const v = fiche[champ];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(type)) {
      if (!type.includes(v)) throw new Error('valeur inattendue pour « ' + champ + ' »');
      propre[champ] = v;
    } else if (type === 't') {
      if (typeof v !== 'string') throw new Error('« ' + champ + ' » devrait être un texte');
      propre[champ] = v.slice(0, 10000);
    } else if (type === 'd') {
      if (!Dates.estValide(v)) throw new Error('date incorrecte pour « ' + champ + ' »');
      propre[champ] = v;
    } else if (type === 'h') {
      if (!Dates.heureValide(v)) throw new Error('heure incorrecte pour « ' + champ + ' »');
      propre[champ] = v;
    } else if (type === 'n') {
      if (typeof v !== 'number' || !isFinite(v) || v < 0) throw new Error('nombre incorrect pour « ' + champ + ' »');
      propre[champ] = v;
    } else if (type === 'b') {
      if (typeof v !== 'boolean') throw new Error('« ' + champ + ' » devrait valoir vrai ou faux');
      propre[champ] = v;
    } else if (type === 'photo') {
      // Seules les vraies images encodées sont acceptées (jamais une adresse internet)
      if (typeof v !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > 8000000) {
        throw new Error('photo illisible');
      }
      propre[champ] = v;
    }
  }
  for (const champ of OBLIGATOIRES[magasin]) {
    if (propre[champ] === undefined) throw new Error('le champ obligatoire « ' + champ + ' » manque');
  }
  return propre;
}


/* ---------- L'accès à la base ---------- */
const BD = {
  NOM: 'omni-animalia',
  VERSION: 1,
  base: null,

  /* Une erreur avec un message déjà compréhensible */
  erreur(message) {
    const e = new Error(message);
    e.lisible = true;
    return e;
  },

  /* Ouvre la base (et la crée à la toute première utilisation) */
  ouvrir() {
    return new Promise((ok, echec) => {
      if (!('indexedDB' in window)) {
        return echec(this.erreur('Ce navigateur ne permet pas d’enregistrer des données. Essayez avec Chrome, à jour.'));
      }
      let demande;
      try {
        demande = indexedDB.open(this.NOM, this.VERSION);
      } catch (e) {
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
        this.base = demande.result;
        // Si une autre fenêtre installe une nouvelle version de la base
        this.base.onversionchange = () => { this.base.close(); location.reload(); };
        ok(this.base);
      };
      demande.onerror = () => echec(this.erreur('La base de données n’a pas pu s’ouvrir. Fermez puis rouvrez l’application. Si le problème continue, vérifiez qu’il reste de la place sur le téléphone.'));
      demande.onblocked = () => echec(this.erreur('L’application est ouverte dans un autre onglet. Fermez les autres onglets puis réessayez.'));
    });
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
  tout(magasin) {
    return this.attendre(this.base.transaction(magasin).objectStore(magasin).getAll());
  },

  /* Les fiches d'un magasin qui appartiennent à un animal */
  parAnimal(magasin, animalId) {
    const index = this.base.transaction(magasin).objectStore(magasin).index('animalId');
    return this.attendre(index.getAll(animalId));
  },

  /* Une fiche précise (ou undefined) */
  lire(magasin, id) {
    return this.attendre(this.base.transaction(magasin).objectStore(magasin).get(id));
  },

  /* Ajoute ou remplace une fiche. Lui donne un identifiant si elle n'en a pas. */
  async enregistrer(magasin, fiche) {
    if (!fiche.id) fiche.id = this.nouvelId();
    const propre = magasin === 'reglages' ? fiche : nettoyerFiche(magasin, fiche);
    const tx = this.base.transaction(magasin, 'readwrite');
    tx.objectStore(magasin).put(propre);
    await this.finTransaction(tx);
    return propre;
  },

  /* Supprime une fiche */
  async supprimer(magasin, id) {
    const tx = this.base.transaction(magasin, 'readwrite');
    tx.objectStore(magasin).delete(id);
    await this.finTransaction(tx);
  },

  /* Supprime un animal ET tout son historique, en une seule fois */
  async supprimerAnimal(animalId) {
    const tx = this.base.transaction(['animaux', ...MAGASINS_LIES], 'readwrite');
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
    const r = await this.attendre(this.base.transaction('reglages').objectStore('reglages').get(cle));
    return r === undefined ? defaut : r.valeur;
  },

  /* Enregistre un réglage */
  async definirReglage(cle, valeur) {
    const tx = this.base.transaction('reglages', 'readwrite');
    if (valeur === undefined || valeur === null) tx.objectStore('reglages').delete(cle);
    else tx.objectStore('reglages').put({ cle, valeur });
    await this.finTransaction(tx);
  },

  /* Lit d'un coup tous les magasins de données (pour les rappels, la sauvegarde…) */
  async toutLire() {
    const tx = this.base.transaction(MAGASINS_DONNEES);
    const resultat = {};
    await Promise.all(MAGASINS_DONNEES.map(async (nom) => {
      resultat[nom] = await this.attendre(tx.objectStore(nom).getAll());
    }));
    return resultat;
  },

  /* Efface TOUTES les données (fiches et réglages) */
  async toutEffacer() {
    const tous = [...MAGASINS_DONNEES, 'reglages'];
    const tx = this.base.transaction(tous, 'readwrite');
    for (const nom of tous) tx.objectStore(nom).clear();
    await this.finTransaction(tx);
  }
};
