/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OUTIL-PARTAGE — envoyer un fichier ailleurs, et l'agenda.

   1. Partage : ouvre le menu « Partager » d'Android (Drive, e-mail,
      messagerie…) avec un fichier. Si le téléphone ne sait pas le faire,
      le fichier est simplement téléchargé.

   2. Agenda : fabrique un « fichier d'agenda » (format .ics, compris par
      presque tous les agendas) ou un lien vers Google Agenda. C'est alors
      l'AGENDA du téléphone qui prévient à l'heure : Omni-Animaux, elle,
      ne peut pas envoyer de notification.
   ============================================================ */
'use strict';

const Partage = {

  /* Le téléphone sait-il partager ce fichier ? */
  possible(fichier) {
    try {
      return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [fichier] }));
    } catch (e) {
      return false;
    }
  },

  /* Télécharge le fichier (il arrive en général dans « Téléchargements ») */
  telecharger(fichier) {
    const url = URL.createObjectURL(fichier);
    const lien = el('a', { href: url, download: fichier.name, class: 'invisible' });
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  /* Ouvre le menu « Partager ».
     Renvoie 'partage' (c'est parti), 'annule' (menu fermé sans choisir)
     ou 'telecharge' (partage impossible : fichier téléchargé à la place). */
  async envoyer(fichier, titre) {
    if (this.possible(fichier)) {
      try {
        await navigator.share({ files: [fichier], title: titre || fichier.name });
        return 'partage';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'annule';
        // Autre problème (partage refusé…) : on télécharge à la place
      }
    }
    this.telecharger(fichier);
    return 'telecharge';
  },

  /* Un nom de fichier sans accents ni caractères gênants :
     « Rappel : Rage (Biscuit) » → « rappel-rage-biscuit » */
  nomFichier(texte) {
    return String(texte).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'omni-animaux';
  }
};


const Agenda = {

  /* Transforme un rappel (voir outil-rappels.js) en « événement » d'agenda :
     { uid, titre, description, lieu, date, heure } (heure vide = toute la journée) */
  depuisRappel(r, lieu) {
    return {
      uid: r.id + '-' + r.date,
      titre: r.animalNom + ' : ' + r.titre,
      description: 'Ajouté depuis Omni-Animaux.',
      lieu: lieu || '',
      date: r.date,
      heure: r.type === 'rdv' ? (r.heure || '') : ''
    };
  },

  /* Protège les caractères spéciaux du format .ics */
  echapper(texte) {
    return String(texte || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  },

  /* Le format .ics demande des lignes de 75 octets au plus : les plus
     longues sont coupées, et la suite commence par une espace. */
  plier(ligne) {
    const encodeur = new TextEncoder();
    const morceaux = [];
    let courant = '';
    let taille = 0;
    for (const car of ligne) {
      const t = encodeur.encode(car).length;
      if (taille + t > (morceaux.length ? 74 : 75)) {
        morceaux.push(courant);
        courant = '';
        taille = 0;
      }
      courant += car;
      taille += t;
    }
    morceaux.push(courant);
    return morceaux.join('\r\n ');
  },

  /* « 2026-11-25 » + « 17:00 » → « 20261125T170000 » (heure locale du téléphone) */
  dateIcs(date, heure) {
    const d = date.replace(/-/g, '');
    return heure ? d + 'T' + heure.replace(':', '') + '00' : d;
  },

  /* Heure de fin d'un rendez-vous : une heure après le début */
  finRdv(date, heure) {
    const [h, m] = heure.split(':').map(Number);
    if (h >= 23) return { date: Dates.ajouterJours(date, 1), heure: '00:' + String(m).padStart(2, '0') };
    return { date, heure: String(h + 1).padStart(2, '0') + ':' + String(m).padStart(2, '0') };
  },

  /* Fabrique le texte du fichier .ics pour une liste d'événements */
  ics(evenements) {
    const maintenant = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Omni-Animaux//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const ev of evenements) {
      lignes.push('BEGIN:VEVENT', 'UID:' + ev.uid + '@omni-animalia', 'DTSTAMP:' + maintenant);
      if (ev.heure) {
        // Heure « flottante » (sans fuseau) : l'heure locale du téléphone
        const fin = this.finRdv(ev.date, ev.heure);
        lignes.push('DTSTART:' + this.dateIcs(ev.date, ev.heure), 'DTEND:' + this.dateIcs(fin.date, fin.heure));
      } else {
        lignes.push('DTSTART;VALUE=DATE:' + this.dateIcs(ev.date), 'DTEND;VALUE=DATE:' + this.dateIcs(Dates.ajouterJours(ev.date, 1)));
      }
      lignes.push('SUMMARY:' + this.echapper(ev.titre));
      if (ev.description) lignes.push('DESCRIPTION:' + this.echapper(ev.description));
      if (ev.lieu) lignes.push('LOCATION:' + this.echapper(ev.lieu));
      // Une alerte la veille (que la plupart des agendas reprennent)
      lignes.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + this.echapper(ev.titre), 'TRIGGER:-P1D', 'END:VALARM');
      if (ev.heure) lignes.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + this.echapper(ev.titre), 'TRIGGER:-PT1H', 'END:VALARM');
      lignes.push('END:VEVENT');
    }
    lignes.push('END:VCALENDAR');
    return lignes.map((l) => this.plier(l)).join('\r\n') + '\r\n';
  },

  /* Lien qui ouvre Google Agenda avec l'événement prérempli (internet nécessaire) */
  lienGoogle(ev) {
    let dates;
    if (ev.heure) {
      const fin = this.finRdv(ev.date, ev.heure);
      dates = this.dateIcs(ev.date, ev.heure) + '/' + this.dateIcs(fin.date, fin.heure);
    } else {
      dates = this.dateIcs(ev.date) + '/' + this.dateIcs(Dates.ajouterJours(ev.date, 1));
    }
    const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.titre, dates, details: ev.description || '' });
    if (ev.lieu) p.set('location', ev.lieu);
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  },

  /* Propose d'ajouter UN événement à l'agenda : fichier ou Google Agenda */
  async proposer(ev) {
    const choix = await UI.choisir({
      titre: 'Ajouter à l’agenda',
      message: [
        '« ' + ev.titre + ' », ' + (ev.heure ? Dates.frHeure(ev.date, ev.heure) : 'le ' + Dates.fr(ev.date)) + '.',
        'Ton agenda pourra alors te prévenir à l’avance (la veille, et une heure avant un rendez-vous), même quand Omni-Animaux est fermée.',
        'Fichier d’agenda : s’ouvre avec l’agenda du téléphone qui accepte ce type de fichier (Samsung Agenda, par exemple).',
        'Google Agenda : ouvre Google Agenda avec l’événement déjà rempli. Il faut une connexion internet.'
      ],
      choix: [
        { valeur: null, texte: 'Annuler' },
        { valeur: 'google', texte: 'Google Agenda' },
        { valeur: 'fichier', texte: 'Fichier d’agenda', principal: true }
      ]
    });
    if (choix === 'google') {
      window.open(this.lienGoogle(ev), '_blank', 'noopener');
    } else if (choix === 'fichier') {
      await this.envoyerFichier([ev], Partage.nomFichier(ev.titre + '-' + ev.date));
    }
  },

  /* Partage (ou télécharge) un fichier .ics contenant ces événements */
  async envoyerFichier(evenements, nom) {
    const fichier = new File([this.ics(evenements)], nom + '.ics', { type: 'text/calendar' });
    const r = await Partage.envoyer(fichier, 'Agenda');
    if (r === 'telecharge') UI.annoncer('Fichier d’agenda téléchargé. Ouvre-le depuis « Téléchargements » pour l’ajouter à ton agenda.');
    else if (r === 'partage') UI.annoncer('Fichier d’agenda envoyé.');
  }
};
