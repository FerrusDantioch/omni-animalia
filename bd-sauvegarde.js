/* Omni-Animaux — © 2026 Ferrus Dantioch
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

  /* ---------- Exporter ---------- */

  /* Prépare le contenu du fichier de sauvegarde */
  async preparer() {
    const donnees = await BD.toutLire();
    return {
      format: this.FORMAT,
      versionFormat: this.VERSION_FORMAT,
      application: 'Omni-Animaux ' + VERSION,
      exporteLe: new Date().toISOString(),
      reglages: {
        theme: await BD.reglage('theme', 'omni'),
        taille: await BD.reglage('taille', 'normal'),
        unitePoids: await BD.reglage('unitePoids', 'kg'),
        contactGarde: await BD.reglage('contactGarde', null)
      },
      donnees
    };
  },

  /* Fabrique le fichier de sauvegarde (sans l'envoyer nulle part).
     « pourPartage » : Chrome sur Android refuse de partager un fichier
     .json ; on l'envoie donc comme un simple fichier texte (.txt). Le
     contenu est exactement le même, et « Restaurer » accepte les deux. */
  async fichier(pourPartage) {
    const contenu = await this.preparer();
    const nom = 'omni-animaux-sauvegarde-' + Dates.aujourdhui() + (pourPartage ? '.txt' : '.json');
    return new File([JSON.stringify(contenu)], nom, { type: pourPartage ? 'text/plain' : 'application/json' });
  },

  /* Fabrique le fichier, puis le partage (mode « partager » : Drive,
     e-mail…) ou le télécharge (mode « telecharger »).
     Renvoie { nom, taille, resultat } ; resultat vaut 'partage',
     'telecharge' ou 'annule' (menu de partage fermé sans choisir). */
  async exporter(mode) {
    const f = await this.fichier(mode === 'partager');
    let resultat;
    if (mode === 'partager') {
      resultat = await Partage.envoyer(f, 'Sauvegarde Omni-Animaux');
    } else {
      Partage.telecharger(f);
      resultat = 'telecharge';
    }
    if (resultat !== 'annule') await BD.definirReglage('derniereSauvegarde', Dates.aujourdhui());
    return { nom: f.name, taille: f.size, resultat };
  },

  /* ---------- Importer ---------- */

  /* Lit le fichier choisi et vérifie qu'il est bien une sauvegarde valable.
     Renvoie { donnees, reglages, resume } ou lance une erreur lisible. */
  async lireFichier(fichier) {
    if (!fichier) throw BD.erreur('Aucun fichier choisi.');
    if (fichier.size > 300 * 1024 * 1024) throw BD.erreur('Ce fichier est beaucoup trop gros pour être une sauvegarde d’Omni-Animaux.');
    let texte;
    try {
      texte = await fichier.text();
    } catch (e) {
      throw BD.erreur('Le fichier n’a pas pu être lu.');
    }
    let objet;
    try {
      objet = JSON.parse(texte);
    } catch (e) {
      throw BD.erreur('Ce fichier n’est pas une sauvegarde d’Omni-Animaux (il n’est pas au format JSON).');
    }
    return this.valider(objet);
  },

  /* Vérifie le contenu, fiche par fiche */
  valider(objet) {
    if (!objet || objet.format !== this.FORMAT) {
      throw BD.erreur('Ce fichier n’est pas une sauvegarde d’Omni-Animaux.');
    }
    if (typeof objet.versionFormat !== 'number' || objet.versionFormat > this.VERSION_FORMAT) {
      throw BD.erreur('Cette sauvegarde vient d’une version plus récente d’Omni-Animaux. Mets l’application à jour, puis réessaie.');
    }
    if (!objet.donnees || typeof objet.donnees !== 'object') throw BD.erreur('Cette sauvegarde est vide ou abîmée.');

    const donnees = {};
    for (const magasin of MAGASINS_DONNEES) {
      const liste = objet.donnees[magasin] === undefined ? [] : objet.donnees[magasin];
      if (!Array.isArray(liste)) throw BD.erreur('Cette sauvegarde est abîmée (partie « ' + magasin + ' »).');
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

    const reglages = {};
    const r = objet.reglages || {};
    if (['omni', 'sombre', 'clair'].includes(r.theme)) reglages.theme = r.theme;
    if (['kg', 'g'].includes(r.unitePoids)) reglages.unitePoids = r.unitePoids;
    if (['normal', 'grand', 'tresgrand'].includes(r.taille)) reglages.taille = r.taille;
    const c = r.contactGarde;
    if (c && typeof c === 'object' && typeof (c.nom || '') === 'string' && typeof (c.telephone || '') === 'string') {
      reglages.contactGarde = { nom: (c.nom || '').slice(0, 120), telephone: (c.telephone || '').slice(0, 30) };
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
    const tx = BD.base.transaction(tous, 'readwrite');
    if (mode === 'remplacer') {
      for (const nom of MAGASINS_DONNEES) tx.objectStore(nom).clear();
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
    const reg = tx.objectStore('reglages');
    for (const [cle, valeur] of Object.entries(reglages)) reg.put({ cle, valeur });
    await BD.finTransaction(tx);
    return { ajoutees, ecartees };
  },

  /* ---------- Exemple de démonstration ----------
     Un chien et un chat inventés, pour essayer l'application sans rien
     taper. Toutes leurs fiches portent « exemple: true » : on peut donc
     les retirer en un clic, sans toucher aux vraies données. */

  async exemplePresent() {
    const animaux = await BD.tout('animaux');
    return animaux.some((a) => a.exemple);
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
        { animalId: chien.id, titre: 'Brosser le pelage (exemple)', echeance: j(-2), recN: 1, recUnite: 'semaines', recJour: 0, fait: false },
        { animalId: chat.id, titre: 'Couper les griffes (exemple)', echeance: j(3), recN: 1, recUnite: 'mois', recJour: Dates.lire(j(3)).getDate(), fait: false },
        { animalId: chat.id, titre: 'Acheter un griffoir (exemple)', echeance: j(25), fait: false }
      ]
    };
    const tous = Object.keys(fiches);
    const tx = BD.base.transaction(tous, 'readwrite');
    for (const nom of tous) {
      for (const fiche of fiches[nom]) {
        if (!fiche.id) fiche.id = id();
        fiche.exemple = true;
        tx.objectStore(nom).put(nettoyerFiche(nom, fiche));
      }
    }
    await BD.finTransaction(tx);
  },

  /* Retire tout ce qui vient de l'exemple (et uniquement cela) */
  async supprimerExemple() {
    const tx = BD.base.transaction(MAGASINS_DONNEES, 'readwrite');
    for (const nom of MAGASINS_DONNEES) {
      const magasin = tx.objectStore(nom);
      magasin.openCursor().onsuccess = (e) => {
        const curseur = e.target.result;
        if (!curseur) return;
        if (curseur.value.exemple) curseur.delete();
        curseur.continue();
      };
    }
    await BD.finTransaction(tx);
    // Un vrai animal qui avait choisi le vétérinaire d'exemple : on retire ce lien
    const vetos = new Set((await BD.tout('veterinaires')).map((v) => v.id));
    for (const a of await BD.tout('animaux')) {
      if (a.vetoId && !vetos.has(a.vetoId)) { delete a.vetoId; await BD.enregistrer('animaux', a); }
    }
  }
};
