/* Omni-Animalia — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   ECRAN-GARDE — la « fiche de garde » d'un animal.

   Une page à montrer (ou à imprimer) à la personne qui garde l'animal :
   qui appeler, quoi donner à manger et ce qu'il ne faut SURTOUT PAS
   donner, les allergies, les médicaments en cours, les consignes,
   et ce qui est prévu dans les 30 prochains jours.
   ============================================================ */
'use strict';

const EcranGarde = {
  animal: null,
  _tour: 0,

  /* Une partie de la fiche, avec son titre (rien si elle est vide) */
  partie(titre, ...contenu) {
    const enfants = contenu.flat(Infinity).filter(Boolean);
    if (!enfants.length) return null;
    return el('section', { class: 'garde-partie' }, el('h2', { text: titre }), enfants);
  },

  /* Fabrique le résumé en texte brut (pour le partage ou le presse-papiers) */
  texteResume(donnees = {}) {
    if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) return '';
    const {
      animal,
      traitements = [],
      notes = [],
      veto = null,
      contact = null,
      vetoUrgence = null,
      rappels = [],
      reference
    } = donnees;
    if (!animal || typeof animal !== 'object' || Array.isArray(animal)) return '';

    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const aujourdhui = Dates.estValide(reference) ? reference : Dates.aujourdhui();
    const sections = [];
    const ajouterSection = (titre, lignes) => {
      const propres = (Array.isArray(lignes) ? lignes : []).filter((l) => typeof l === 'string' && l.length > 0);
      if (!propres.length) return;
      sections.push((titre ? [titre, ...propres] : propres).join('\n'));
    };

    const nomAnimal = str(animal.nom) || 'Animal';
    const age = Dates.age(animal.naissance, animal.naissanceApprox);
    const sexe = Object.prototype.hasOwnProperty.call(NOMS_SEXE, animal.sexe) && animal.sexe !== 'inconnu' ? NOMS_SEXE[animal.sexe] : '';
    const sousTitre = [EcranAccueil.sousTitre(animal), age ? age : '', sexe].filter(Boolean).join(' · ');
    ajouterSection(null, ['Fiche de garde — ' + nomAnimal, sousTitre]);

    const lignesContact = [];
    if (contact && typeof contact === 'object' && !Array.isArray(contact)) {
      const cNom = str(contact.nom);
      const cTel = str(contact.telephone);
      if (cNom) lignesContact.push('Propriétaire : ' + cNom);
      if (cTel) lignesContact.push('Téléphone propriétaire : ' + cTel);
    }
    if (veto && typeof veto === 'object' && !Array.isArray(veto)) {
      const vNom = str(veto.nom);
      const vClin = str(veto.clinique);
      const vTel = str(veto.telephone);
      const vAdr = str(veto.adresse);
      const vNotes = str(veto.notes);
      if (vNom || vClin || vTel || vAdr || vNotes) {
        const libVeto = [vNom, vClin].filter(Boolean).join(' — ');
        if (libVeto) lignesContact.push('Vétérinaire : ' + libVeto);
        if (vTel) lignesContact.push('Téléphone : ' + vTel);
        if (vAdr) lignesContact.push('Adresse : ' + vAdr);
        if (vNotes) lignesContact.push('Infos : ' + vNotes);
      }
    }
    if (vetoUrgence && typeof vetoUrgence === 'object' && !Array.isArray(vetoUrgence)) {
      const uNom = str(vetoUrgence.nom);
      const uClin = str(vetoUrgence.clinique);
      const uTel = str(vetoUrgence.telephone);
      const uAdr = str(vetoUrgence.adresse);
      const uNotes = str(vetoUrgence.notes);
      if (uNom || uClin || uTel || uAdr || uNotes) {
        const libUrg = [uNom, uClin].filter(Boolean).join(' — ');
        lignesContact.push('Urgence vétérinaire 24h' + (libUrg ? ' : ' + libUrg : ''));
        if (uTel) lignesContact.push('Téléphone urgence : ' + uTel);
        if (uAdr) lignesContact.push('Adresse urgence : ' + uAdr);
        if (uNotes) lignesContact.push('Infos urgence : ' + uNotes);
      }
    }
    ajouterSection('À contacter', lignesContact);

    const alimEviter = str(animal.alimEviter);
    if (alimEviter) ajouterSection('À ne surtout pas donner', [alimEviter]);

    const allergies = (Array.isArray(notes) ? notes : []).filter((n) => n && n.categorie === 'allergie');
    if (allergies.length) {
      ajouterSection('Allergies connues', allergies.map((n) => {
        const txt = str(n.texte);
        if (txt) return '- ' + txt;
        const dFr = n.date && Dates.estValide(n.date) ? Dates.fr(n.date) : '';
        return '- ' + (dFr ? 'Allergie notée le ' + dFr : 'Allergie');
      }));
    }

    const lignesRepas = [];
    if (str(animal.alimMarque)) lignesRepas.push('Aliment : ' + str(animal.alimMarque));
    if (str(animal.alimQuantite)) lignesRepas.push('Quantité par jour : ' + str(animal.alimQuantite));
    if (typeof animal.alimRepas === 'number' && Number.isFinite(animal.alimRepas) && animal.alimRepas > 0) {
      lignesRepas.push('Nombre de repas : ' + String(animal.alimRepas));
    }
    if (str(animal.alimRemarques)) lignesRepas.push('Remarques : ' + str(animal.alimRemarques));
    ajouterSection('Repas', lignesRepas);

    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    const enCours = (Array.isArray(traitements) ? traitements : [])
      .filter((t) => t && t.statut !== 'termine')
      .sort((x, y) => {
        const fx = x.debut && Dates.estValide(x.debut) && x.debut > aujourdhui ? 1 : 0;
        const fy = y.debut && Dates.estValide(y.debut) && y.debut > aujourdhui ? 1 : 0;
        if (fx !== fy) return fx - fy;
        return cmp(x.debut || '', y.debut || '') || cmp(String((x && x.id) ?? ''), String((y && y.id) ?? ''));
      });
    if (enCours.length) {
      const lignesMeds = [];
      for (const t of enCours) {
        const estAVenir = !!(t.debut && Dates.estValide(t.debut) && t.debut > aujourdhui);
        const nomMed = str(t.nom) || 'Traitement';
        lignesMeds.push('- ' + nomMed + (estAVenir ? ' — À venir (à partir du ' + Dates.fr(t.debut) + ')' : ''));
        if (str(t.dose)) lignesMeds.push('  Dose : ' + str(t.dose));
        if (str(t.frequence)) lignesMeds.push('  Quand : ' + str(t.frequence));
        if (typeof t.prisesParJour === 'number' && Number.isFinite(t.prisesParJour) && t.prisesParJour > 0) {
          lignesMeds.push('  Prises par jour : ' + String(t.prisesParJour));
        }
        if (t.debut && Dates.estValide(t.debut) && !estAVenir) lignesMeds.push('  Depuis le : ' + Dates.fr(t.debut));
        if (t.fin && Dates.estValide(t.fin)) lignesMeds.push('  Jusqu’au : ' + Dates.fr(t.fin));
      }
      ajouterSection('Médicaments en cours', lignesMeds);
    }

    const consignes = str(animal.consignesGarde);
    if (consignes) ajouterSection('Consignes', [consignes]);

    const rappelsPrevus = (Array.isArray(rappels) ? rappels : []).filter((r) => (
      r && (!r.animalId || r.animalId === animal.id) &&
      typeof r.ecart === 'number' && Number.isFinite(r.ecart) && r.ecart >= 0 && r.ecart <= 30
    ));
    if (rappelsPrevus.length) {
      ajouterSection('Prévu dans les 30 prochains jours', rappelsPrevus.map((r) => {
        const dFr = r.date && Dates.estValide(r.date) ? Dates.fr(r.date) : '';
        const h = r.heure && Dates.heureValide(r.heure) ? ' à ' + r.heure.replace(':', ' h ') : '';
        const titre = str(r.titre);
        return '- ' + [dFr + h, titre].filter(Boolean).join(' : ');
      }));
    }

    const lignesId = [];
    if (str(animal.puce)) lignesId.push('Puce électronique : ' + str(animal.puce));
    if (str(animal.tatouage)) lignesId.push('Tatouage : ' + str(animal.tatouage));
    if (str(animal.couleur)) lignesId.push('Couleur, signes distinctifs : ' + str(animal.couleur));
    ajouterSection('Identification', lignesId);

    ajouterSection(null, ['Fiche éditée le ' + Dates.fr(aujourdhui) + ' avec Omni-Animalia.']);
    return sections.join('\n\n');
  },

  /* Fabrique le contenu de la fiche (le même à l'écran et sur papier) */
  async construire(a, pourImpression) {
    const [traitements, notes] = await Promise.all([BD.parAnimal('traitements', a.id), BD.parAnimal('notes', a.id)]);
    const veto = a.vetoId ? await BD.lire('veterinaires', a.vetoId) : null;
    const contact = await BD.reglage('contactGarde', null);
    let urgence = null;
    try {
      urgence = nettoyerVetoUrgence(await BD.reglage('vetoUrgence', null));
    } catch (_) {
      urgence = null;
    }
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const rappels = Rappels.calculer(await BD.toutLire()).filter((r) => r.animalId === a.id && typeof r.ecart === 'number' && r.ecart >= 0 && r.ecart <= 30);
    const ligne = (l, v) => EcranAnimal.ligne(l, v);
    // À l'écran, un numéro de téléphone devient un bouton « Appeler »
    const tel = (numero) => {
      const numeroPropre = str(numero);
      if (!numeroPropre) return null;
      if (pourImpression) return ligne('Téléphone', numeroPropre);
      const lien = EcranVeto.lienTelephone(numeroPropre);
      return lien ? el('p', { class: 'ligne' }, lien) : null;
    };

    const aujourdhui = Dates.aujourdhui();
    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    const enCours = traitements.filter((t) => t && t.statut !== 'termine').sort((x, y) => {
      const fx = x.debut && Dates.estValide(x.debut) && x.debut > aujourdhui ? 1 : 0;
      const fy = y.debut && Dates.estValide(y.debut) && y.debut > aujourdhui ? 1 : 0;
      if (fx !== fy) return fx - fy;
      return cmp(x.debut || '', y.debut || '') || cmp(String((x && x.id) ?? ''), String((y && y.id) ?? ''));
    });
    const allergies = notes.filter((n) => n && n.categorie === 'allergie');
    const photo = a.photo && imageValide(a.photo) ? el('img', { class: 'garde-photo', alt: '' }) : null;
    if (photo) photo.src = a.photo;
    const age = Dates.age(a.naissance, a.naissanceApprox);

    const contactObj = contact && typeof contact === 'object' && !Array.isArray(contact) ? contact : null;
    const cNom = contactObj ? str(contactObj.nom) : '';
    const cTel = contactObj ? str(contactObj.telephone) : '';
    const vetoObj = veto && typeof veto === 'object' && !Array.isArray(veto) ? veto : null;
    const vNom = vetoObj ? str(vetoObj.nom) : '';
    const vClin = vetoObj ? str(vetoObj.clinique) : '';
    const vTel = vetoObj ? str(vetoObj.telephone) : '';
    const vAdr = vetoObj ? str(vetoObj.adresse) : '';
    const vNotes = vetoObj ? str(vetoObj.notes) : '';
    const alimEviter = str(a.alimEviter);
    const consignes = str(a.consignesGarde);

    return el('div', { class: 'fiche-garde' },
      el('header', { class: 'garde-entete' },
        photo,
        el('div', {},
          el('p', { class: 'etiquette', text: 'Fiche de garde' }),
          el('p', { class: 'garde-nom', text: str(a.nom) }),
          el('p', { text: [EcranAccueil.sousTitre(a), age ? age : '', Object.prototype.hasOwnProperty.call(NOMS_SEXE, a.sexe) && a.sexe !== 'inconnu' ? NOMS_SEXE[a.sexe] : ''].filter(Boolean).join(' · ') }))),

      this.partie('À contacter',
        contactObj && (cNom || cTel) ? [
          el('p', { class: 'ligne' }, el('strong', { text: 'Propriétaire : ' }), cNom),
          tel(cTel)] : null,
        vetoObj && (vNom || vClin || vTel || vAdr || vNotes) ? [
          (vNom || vClin) ? el('p', { class: 'ligne' }, el('strong', { text: 'Vétérinaire : ' }), [vNom, vClin].filter(Boolean).join(' — ')) : null,
          tel(vTel),
          ligne('Adresse', vAdr),
          ligne('Infos', vNotes)] : null,
        urgence ? [
          el('p', { class: 'ligne' },
            el('strong', { text: 'Urgence vétérinaire 24h : ' }),
            [urgence.nom, urgence.clinique].filter(Boolean).join(' — ') || 'Clinique 24h'),
          tel(urgence.telephone),
          ligne('Adresse urgence', urgence.adresse),
          ligne('Infos urgence', urgence.notes)] : null),

      alimEviter ? el('section', { class: 'garde-partie garde-alerte' },
        el('h2', { text: 'À ne surtout pas donner' }),
        el('p', { class: 'texte-libre', text: alimEviter })) : null,

      this.partie('Allergies connues',
        allergies.length ? el('ul', {}, allergies.map((n) => {
          const txt = str(n.texte);
          const dFr = n.date && Dates.estValide(n.date) ? Dates.fr(n.date) : '';
          return el('li', { text: txt || (dFr ? 'Allergie notée le ' + dFr : 'Allergie') });
        })) : null),

      this.partie('Repas',
        ligne('Aliment', str(a.alimMarque)),
        ligne('Quantité par jour', str(a.alimQuantite)),
        ligne('Nombre de repas', typeof a.alimRepas === 'number' && Number.isFinite(a.alimRepas) && a.alimRepas > 0 ? String(a.alimRepas) : ''),
        ligne('Remarques', str(a.alimRemarques))),

      this.partie('Médicaments en cours',
        enCours.map((t) => {
          const estAVenir = !!(t.debut && Dates.estValide(t.debut) && t.debut > aujourdhui);
          return el('div', { class: 'garde-medicament' },
            el('p', { class: 'ligne' },
              el('strong', { text: str(t.nom) || 'Traitement' }),
              estAVenir ? el('span', { class: 'etat bientot', text: ' — À venir (à partir du ' + Dates.fr(t.debut) + ')' }) : null),
            ligne('Dose', str(t.dose)),
            ligne('Quand', str(t.frequence)),
            typeof t.prisesParJour === 'number' && Number.isFinite(t.prisesParJour) && t.prisesParJour > 0 ? ligne('Prises par jour', String(t.prisesParJour)) : null,
            t.debut && Dates.estValide(t.debut) && !estAVenir ? ligne('Depuis le', Dates.fr(t.debut)) : null,
            t.fin && Dates.estValide(t.fin) ? ligne('Jusqu’au', Dates.fr(t.fin)) : null);
        })),

      this.partie('Consignes', consignes ? el('p', { class: 'texte-libre', text: consignes }) : null),

      this.partie('Prévu dans les 30 prochains jours',
        rappels.length ? el('ul', {}, rappels.map((r) => el('li', { text: (r.date && Dates.estValide(r.date) ? Dates.fr(r.date) : '') + (r.heure && Dates.heureValide(r.heure) ? ' à ' + r.heure.replace(':', ' h ') : '') + ' : ' + str(r.titre) }))) : null),

      this.partie('Identification',
        ligne('Puce électronique', str(a.puce)),
        ligne('Tatouage', str(a.tatouage)),
        ligne('Couleur, signes distinctifs', str(a.couleur))),

      el('p', { class: 'garde-pied', text: 'Fiche éditée le ' + Dates.fr(Dates.aujourdhui()) + ' avec Omni-Animalia. Cette application sert à organiser les informations. Elle ne remplace pas l’avis d’un vétérinaire.' })
    );
  },

  /* L'écran « Fiche de garde » */
  async afficher(id) {
    const tour = ++this._tour;
    const a = await BD.lire('animaux', id);
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;
    if (!a) {
      UI.annoncer('Cet animal n’existe plus.', 'erreur');
      return Nav.remplacer({ vue: 'accueil' });
    }
    const fiche = await this.construire(a, false);
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;
    const contact = await BD.reglage('contactGarde', null);
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;

    this.animal = a;
    const nom = typeof a.nom === 'string' && a.nom.trim() ? a.nom.trim() : '';
    $('#garde-titre').textContent = nom ? 'Garde de ' + nom : 'Fiche de garde';
    const frag = document.createDocumentFragment();
    frag.append(
      el('p', { class: 'aide', text: 'À montrer ou à imprimer pour la personne qui garde ' + (nom || 'cet animal') + '. Les informations viennent de sa fiche : identité, alimentation, notes d’allergie, traitements en cours, vétérinaire habituel et rappels.' }),
      fiche,
      el('div', { class: 'pile-boutons' },
        bouton('Imprimer ou enregistrer en PDF', () => this.imprimer(a), { classe: 'principal large', icone: 'imprimer' }),
        bouton('Partager / Copier le texte', () => this.partager(a), { classe: 'secondaire large', icone: 'copier' }),
        a.archive ? null : bouton(a.consignesGarde ? 'Modifier les consignes' : 'Ajouter des consignes', () => this.formulaireConsignes(a), { classe: 'secondaire large', icone: 'crayon' }),
        bouton(contact ? 'Modifier mon contact' : 'Ajouter mon contact (propriétaire)', () => this.formulaireContact(contact), { classe: 'secondaire large', icone: 'telephone' })),
      el('p', { class: 'aide', text: 'Ton contact est commun à toutes les fiches de garde. Pour changer l’alimentation, les traitements ou le vétérinaire, modifie la fiche de l’animal.' })
    );
    vider($('#garde-contenu')).append(frag);
  },

  /* Partage la fiche de garde en texte brut (ou la copie dans le presse-papiers) */
  async partager(a) {
    const estVerrouille = () => ($('#verrou') && !$('#verrou').hidden);
    if (!a || estVerrouille()) return;
    try {
      const [animalLu, traitements, notes, contact, urgenceBrute, tout] = await Promise.all([
        BD.lire('animaux', a.id),
        BD.parAnimal('traitements', a.id),
        BD.parAnimal('notes', a.id),
        BD.reglage('contactGarde', null),
        BD.reglage('vetoUrgence', null),
        BD.toutLire()
      ]);
      if (estVerrouille()) return;
      const animal = animalLu || a;
      const veto = animal.vetoId ? await BD.lire('veterinaires', animal.vetoId) : null;
      if (estVerrouille()) return;
      let vetoUrgence = null;
      try {
        vetoUrgence = nettoyerVetoUrgence(urgenceBrute);
      } catch (_) {
        vetoUrgence = null;
      }
      const rappels = Rappels.calculer(tout);
      const texte = this.texteResume({ animal, traitements, notes, veto, contact, vetoUrgence, rappels });
      const nom = typeof animal.nom === 'string' && animal.nom.trim() ? animal.nom.trim() : '';
      const res = await Partage.texte(nom ? 'Fiche de garde — ' + nom : 'Fiche de garde', texte);
      if (res === 'partage') UI.annoncer('Fiche de garde partagée.');
    } catch (e) {
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  },

  formulaireConsignes(a) {
    const nom = typeof a.nom === 'string' && a.nom.trim() ? a.nom.trim() : '';
    Formulaire.ouvrir({
      titre: nom ? 'Consignes de garde — ' + nom : 'Consignes de garde',
      valeurs: a,
      champs: [
        { nom: 'consignesGarde', label: 'Consignes pour la personne qui garde', type: 'zone',
          aide: 'Sorties, habitudes, cachettes, ce qui le rassure, ce qui lui fait peur, où sont ses affaires…' }
      ],
      enregistrer: async (v) => {
        await BD.enregistrer('animaux', { ...a, consignesGarde: v.consignesGarde });
        return 'Consignes enregistrées.';
      }
    });
  },

  formulaireContact(contact) {
    Formulaire.ouvrir({
      titre: 'Mon contact',
      intro: 'Affiché en haut de toutes les fiches de garde, pour qu’on puisse te joindre.',
      valeurs: contact || {},
      champs: [
        { nom: 'nom', label: 'Nom ou prénom', type: 'texte', long: 120 },
        { nom: 'telephone', label: 'Téléphone', type: 'tel', long: 30 }
      ],
      valider: (v) => {
        const e = {};
        if (v.telephone && !/^[0-9+(). -]{3,30}$/.test(v.telephone)) {
          e.telephone = 'Ce numéro contient des caractères inattendus (seuls les chiffres, espaces simples, +, -, points et parenthèses sont acceptés).';
        }
        return e;
      },
      enregistrer: async (v) => {
        await BD.definirReglage('contactGarde', v.nom || v.telephone ? { nom: v.nom, telephone: v.telephone } : null);
        return 'Contact enregistré.';
      }
    });
  },

  /* Imprime la fiche (même mécanisme que le carnet de santé) */
  async imprimer(a) {
    const estVerrouille = () => (typeof Verrou !== 'undefined' && Verrou._promesse) || ($('#verrou') && !$('#verrou').hidden);
    if (estVerrouille()) return;
    try {
      const contenu = await this.construire(a, true);
      if (estVerrouille()) return;
      const carnet = vider($('#carnet'));
      carnet.append(contenu);
      const nom = typeof a.nom === 'string' && a.nom.trim() ? a.nom.trim() : '';
      Impression.lancer(nom ? 'Fiche de garde - ' + nom : 'Fiche de garde');
    } catch (e) {
      const carnet = $('#carnet');
      if (carnet) vider(carnet);
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};
