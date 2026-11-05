/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OUTIL-DATES — tout ce qui touche aux dates.

   Règle d'or : une date est toujours rangée sous la forme d'un texte
   « AAAA-MM-JJ » (par exemple « 2026-11-05 »), et lue à l'heure LOCALE
   du téléphone. On n'utilise jamais l'heure « universelle » (UTC) pour
   afficher une date : sinon, selon le fuseau horaire, un rendez-vous
   pourrait glisser d'un jour.

   L'affichage, lui, est toujours au format français : jj/mm/aaaa.
   ============================================================ */
'use strict';

const Dates = {

  /* Complète un nombre avec un zéro devant : 5 → « 05 » */
  deuxChiffres(n) {
    return String(n).padStart(2, '0');
  },

  /* Transforme un objet Date en texte « AAAA-MM-JJ » (heure locale) */
  versTexte(d) {
    return d.getFullYear() + '-' + this.deuxChiffres(d.getMonth() + 1) + '-' + this.deuxChiffres(d.getDate());
  },

  /* La date du jour, en « AAAA-MM-JJ » */
  aujourdhui() {
    return this.versTexte(new Date());
  },

  /* Vérifie qu'un texte est une vraie date « AAAA-MM-JJ »
     (refuse par exemple le 31/02 ou le 2026-13-01). */
  estValide(texte) {
    if (typeof texte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
    const [a, m, j] = texte.split('-').map(Number);
    if (a < 1900 || a > 2200 || m < 1 || m > 12 || j < 1) return false;
    return j <= this.joursDansMois(a, m);
  },

  /* Vérifie une heure « HH:MM » */
  heureValide(texte) {
    if (typeof texte !== 'string' || !/^\d{2}:\d{2}$/.test(texte)) return false;
    const [h, m] = texte.split(':').map(Number);
    return h <= 23 && m <= 59;
  },

  /* Lit « AAAA-MM-JJ » et renvoie un objet Date à minuit, heure locale */
  lire(texte) {
    if (!this.estValide(texte)) return null;
    const [a, m, j] = texte.split('-').map(Number);
    return new Date(a, m - 1, j);
  },

  /* Nombre de jours dans un mois (m de 1 à 12) */
  joursDansMois(a, m) {
    return new Date(a, m, 0).getDate();
  },

  /* « 2026-11-05 » → « 05/11/2026 ». Renvoie « — » si la date est vide. */
  fr(texte) {
    if (!this.estValide(texte)) return '—';
    const [a, m, j] = texte.split('-');
    return j + '/' + m + '/' + a;
  },

  /* Date + heure : « 05/11/2026 à 14 h 30 » */
  frHeure(date, heure) {
    const d = this.fr(date);
    if (!this.heureValide(heure)) return d;
    const [h, m] = heure.split(':');
    return d + ' à ' + Number(h) + ' h ' + m;
  },

  /* Nombre de jours entre deux dates (b − a). Positif si b est après a.
     Le calcul passe par Date.UTC uniquement pour COMPTER les jours :
     ainsi, les changements d'heure été/hiver ne faussent rien. */
  ecartJours(a, b) {
    const da = this.lire(a);
    const db = this.lire(b);
    if (!da || !db) return NaN;
    const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
    const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
    return Math.round((ub - ua) / 86400000);
  },

  /* Ajoute (ou retire) des jours à une date */
  ajouterJours(texte, n) {
    const d = this.lire(texte);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return this.versTexte(d);
  },

  /* Ajoute des mois. « jourAncre » est le jour du mois voulu à l'origine :
     une tâche prévue le 31 janvier tombe le 28 (ou 29) février, puis
     revient au 31 mars, au lieu de rester bloquée au 28. */
  ajouterMois(texte, n, jourAncre) {
    const d = this.lire(texte);
    if (!d) return '';
    const jour = jourAncre || d.getDate();
    let a = d.getFullYear();
    let m = d.getMonth() + n;            // mois de 0 à 11, peut déborder
    a += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const j = Math.min(jour, this.joursDansMois(a, m + 1));
    return this.versTexte(new Date(a, m, j));
  },

  /* Avance d'un intervalle : n jours, semaines, mois ou ans */
  ajouterIntervalle(texte, n, unite, jourAncre) {
    switch (unite) {
      case 'jours':    return this.ajouterJours(texte, n);
      case 'semaines': return this.ajouterJours(texte, n * 7);
      case 'mois':     return this.ajouterMois(texte, n, jourAncre);
      case 'ans':      return this.ajouterMois(texte, n * 12, jourAncre);
      default:         return '';
    }
  },

  /* Prochaine échéance d'une tâche répétée.
     On suit le rythme prévu à partir de l'ancienne échéance, et on avance
     jusqu'à dépasser « apres » (en général : aujourd'hui). Ainsi, une tâche
     cochée avec du retard ne crée pas une pile de tâches déjà en retard. */
  prochaineEcheance(echeance, n, unite, jourAncre, apres) {
    let suivante = this.ajouterIntervalle(echeance, n, unite, jourAncre);
    let securite = 0;                       // évite toute boucle sans fin
    while (suivante && apres && suivante <= apres && securite < 5000) {
      suivante = this.ajouterIntervalle(suivante, n, unite, jourAncre);
      securite++;
    }
    return suivante;
  },

  /* Âge détaillé entre la naissance et une date de référence.
     Renvoie { ans, mois, totalMois, totalJours } ou null. */
  ageDetail(naissance, reference) {
    const ref = reference || this.aujourdhui();
    const totalJours = this.ecartJours(naissance, ref);
    if (isNaN(totalJours) || totalJours < 0) return null;
    const [a1, m1, j1] = naissance.split('-').map(Number);
    const [a2, m2, j2] = ref.split('-').map(Number);
    let totalMois = (a2 - a1) * 12 + (m2 - m1);
    // Le « jour anniversaire » de ce mois-ci (un 31 devient le 30 ou le 28)
    const anniversaire = Math.min(j1, this.joursDansMois(a2, m2));
    if (j2 < anniversaire) totalMois--;
    return { ans: Math.floor(totalMois / 12), mois: totalMois % 12, totalMois, totalJours };
  },

  /* Âge en toutes lettres : « 3 ans et 2 mois », « 8 semaines », « 5 jours »…
     « approx » ajoute « environ » devant. Renvoie '' si l'âge est inconnu. */
  age(naissance, approx, reference) {
    if (!this.estValide(naissance)) return '';
    const d = this.ageDetail(naissance, reference);
    if (!d) return '';
    const pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);
    let texte;
    if (d.totalJours < 1) {
      texte = 'moins d’un jour';
    } else if (d.totalJours < 14) {
      texte = pluriel(d.totalJours, 'jour', 'jours');
    } else if (d.totalMois < 3) {
      texte = pluriel(Math.floor(d.totalJours / 7), 'semaine', 'semaines');
    } else if (d.ans < 1) {
      texte = d.totalMois + ' mois';
    } else {
      texte = pluriel(d.ans, 'an', 'ans');
      if (d.mois > 0) texte += ' et ' + d.mois + ' mois';
    }
    return approx ? 'environ ' + texte : texte;
  },

  /* Distance d'une date par rapport à aujourd'hui, en toutes lettres :
     « aujourd'hui », « demain », « dans 5 jours », « en retard de 3 jours » */
  relatif(texte, reference) {
    const n = this.ecartJours(reference || this.aujourdhui(), texte);
    if (isNaN(n)) return '';
    if (n === 0) return 'aujourd’hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'en retard d’un jour';
    if (n > 1) return 'dans ' + n + ' jours';
    return 'en retard de ' + (-n) + ' jours';
  },

  /* Texte lisible d'une répétition : « tous les 3 mois », « chaque semaine » */
  texteRecurrence(n, unite) {
    if (!n || !unite) return '';
    const noms = {
      jours:    ['chaque jour', 'jours'],
      semaines: ['chaque semaine', 'semaines'],
      mois:     ['chaque mois', 'mois'],
      ans:      ['chaque année', 'ans']
    };
    const nom = noms[unite];
    if (!nom) return '';
    return n === 1 ? nom[0] : 'tous les ' + n + ' ' + nom[1];
  }
};
