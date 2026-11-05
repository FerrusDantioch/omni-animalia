/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   APP — le chef d'orchestre. Il démarre l'application :
   1. ouvre la base de données ;
   2. applique le thème ;
   3. demande le mot de passe s'il y en a un ;
   4. affiche le bon écran et gère la navigation (bouton retour) ;
   5. surveille l'arrivée d'une nouvelle version.
   ============================================================ */
'use strict';

/* ╔══════════════════════════════════════════════════════════╗
   ║  ✏️ À COMPLÉTER : l'adresse e-mail de contact d'Omni-Animaux ║
   ║  Écrivez-la entre les deux apostrophes, par exemple :     ║
   ║  const ADRESSE_CONTACT = 'omni-animaux@exemple.net';      ║
   ║  Tant qu'elle est vide, la page À propos affiche          ║
   ║  « Adresse de contact : bientôt disponible ».             ║
   ╚══════════════════════════════════════════════════════════╝ */
const ADRESSE_CONTACT = '';

/* Numéro de version affiché dans « À propos ».
   ⚠️ À changer en même temps que CACHE dans sw.js. */
const VERSION = '1.2.1';


/* ---------- 1. Le thème ---------- */
const Theme = {
  appliquer(theme) {
    const t = ['omni', 'sombre', 'clair'].includes(theme) ? theme : 'omni';
    document.documentElement.dataset.theme = t;
    // Copie dans le localStorage : lue par index.html AVANT l'affichage
    try { localStorage.setItem('omnianimaux_theme', t); } catch (e) { /* refusé : sans gravité */ }
    // La barre du haut d'Android prend la couleur du fond
    const fond = getComputedStyle(document.documentElement).getPropertyValue('--fond').trim();
    const meta = $('meta[name="theme-color"]');
    if (meta && fond) meta.setAttribute('content', fond);
  }
};


/* ---------- 1 bis. La taille du texte ----------
   « normal », « grand » ou « tresgrand ». Toute la mise en page suit,
   car les tailles de la feuille de style sont relatives (unités rem). */
const Taille = {
  appliquer(taille) {
    const t = ['normal', 'grand', 'tresgrand'].includes(taille) ? taille : 'normal';
    document.documentElement.dataset.taille = t;
    try { localStorage.setItem('omnianimaux_taille', t); } catch (e) { /* sans gravité */ }
  }
};


/* ---------- 2. La navigation ----------
   Chaque écran a une adresse (#accueil, #rappels, #animal/ID/poids…).
   On utilise l'historique du navigateur : le bouton (ou geste) « retour »
   du téléphone ramène à l'écran précédent, comme on s'y attend. */
const Nav = {
  etat: null,
  _tour: 0,          // évite qu'un ancien affichage lent écrase le nouveau

  adresse(etat) {
    if (etat.vue === 'animal') return '#animal/' + etat.id + '/' + (etat.section || 'identite');
    if (etat.vue === 'garde') return '#garde/' + etat.id;
    return '#' + etat.vue;
  },

  depuisAdresse() {
    const h = decodeURIComponent(location.hash.slice(1));
    const morceaux = h.split('/');
    if (morceaux[0] === 'animal' && morceaux[1]) return { vue: 'animal', id: morceaux[1], section: morceaux[2] || 'identite' };
    if (morceaux[0] === 'garde' && morceaux[1]) return { vue: 'garde', id: morceaux[1] };
    if (['accueil', 'archives', 'rappels', 'veterinaires', 'reglages', 'apropos'].includes(morceaux[0])) return { vue: morceaux[0] };
    return { vue: 'accueil' };
  },

  profondeur() {
    return (history.state && history.state.omni && history.state.profondeur) || 0;
  },

  /* Ouvre un écran (on pourra revenir en arrière) */
  aller(etat) {
    const e = { ...etat, omni: true, profondeur: this.profondeur() + 1 };
    history.pushState(e, '', this.adresse(e));
    return this.afficher(e);
  },

  /* Change d'écran sans ajouter d'étape dans l'historique */
  remplacer(etat) {
    const e = { ...etat, omni: true, profondeur: this.profondeur() };
    history.replaceState(e, '', this.adresse(e));
    return this.afficher(e);
  },

  /* Revient à l'écran précédent, ou à l'accueil s'il n'y en a pas */
  retour() {
    if (this.profondeur() > 0) history.back();
    else this.remplacer({ vue: 'accueil' });
  },

  /* Affiche un écran et le remplit */
  async afficher(etat) {
    const tour = ++this._tour;
    if (etat.vue === 'formulaire' && !Formulaire.courant) {
      // Formulaire déjà fermé (bouton « avancer » du navigateur…) : retour à l'accueil
      return this.remplacer({ vue: 'accueil' });
    }
    this.etat = etat;
    for (const v of $$('.vue')) v.hidden = v.dataset.vue !== etat.vue;

    // L'onglet du bas correspondant est mis en évidence
    const onglets = { accueil: 'accueil', archives: 'accueil', animal: 'accueil', garde: 'accueil', rappels: 'rappels', veterinaires: 'veterinaires', reglages: 'reglages', apropos: 'reglages' };
    if (etat.vue !== 'formulaire') {
      for (const b of $$('#barre-nav button')) {
        if (b.dataset.onglet === onglets[etat.vue]) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      }
    }
    MiseAJour.majBandeau();

    try {
      switch (etat.vue) {
        case 'accueil':      await EcranAccueil.afficher(); break;
        case 'archives':     await EcranAccueil.afficherArchives(); break;
        case 'animal':       await EcranAnimal.afficher(etat.id, etat.section || 'identite'); break;
        case 'garde':        await EcranGarde.afficher(etat.id); break;
        case 'rappels':      await EcranAgenda.afficherRappels(); break;
        case 'veterinaires': await EcranVeto.afficher(); break;
        case 'reglages':     await EcranReglages.afficher(); break;
        case 'apropos':      EcranReglages.afficherApropos(); break;
        case 'formulaire':   Formulaire.afficher(); break;
      }
    } catch (e) {
      console.warn(e);
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
    if (tour !== this._tour) return;      // un autre écran a été demandé entre-temps

    window.scrollTo(0, 0);
    // Le titre reçoit le focus : un lecteur d'écran annonce le nouvel écran
    const titre = $('.vue[data-vue="' + etat.vue + '"] h1');
    if (titre) titre.focus({ preventScroll: true });
    this.majPastille();
  },

  /* La petite pastille sur l'onglet « Rappels » : nombre de rappels en
     retard ou pour aujourd'hui. */
  async majPastille() {
    try {
      const liste = Rappels.calculer(await BD.toutLire());
      const n = liste.filter((r) => r.ecart <= 0).length;
      const p = $('#nav-pastille');
      p.textContent = n > 99 ? '99+' : String(n);
      p.hidden = n === 0;
      const bouton = p.closest('button');
      bouton.setAttribute('aria-label', n ? 'Rappels (' + n + ' en retard ou pour aujourd’hui)' : 'Rappels');
    } catch (e) { /* sans gravité */ }
  }
};

window.addEventListener('popstate', (e) => {
  if (!App.pret) return;
  Nav.afficher(e.state && e.state.omni ? e.state : Nav.depuisAdresse());
});


/* ---------- 3. Le verrou par mot de passe ----------
   Le mot de passe n'est JAMAIS enregistré. On garde seulement son
   « empreinte » : le résultat d'un calcul (PBKDF2, 210 000 tours) à
   partir du mot de passe et d'un « sel » (des octets tirés au hasard).
   On ne peut pas retrouver le mot de passe à partir de l'empreinte.
   ⚠️ Ce verrou cache l'application à un regard indiscret, mais les
   données elles-mêmes ne sont PAS chiffrées sur le téléphone. */
const Verrou = {
  ITERATIONS: 210000,
  DELAI_ARRIERE_PLAN: 5 * 60 * 1000,   // reverrouillage après 5 min en arrière-plan

  enHex(octets) {
    return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');
  },
  depuisHex(hex) {
    return new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
  },

  async empreinte(motDePasse, selHex, iterations) {
    const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: this.depuisHex(selHex), iterations },
      cle, 256);
    return this.enHex(bits);
  },

  /* Crée l'empreinte d'un nouveau mot de passe et l'enregistre */
  async definir(motDePasse) {
    if (!crypto.subtle) throw BD.erreur('Ce navigateur ne permet pas de protéger par mot de passe (il faut une adresse https).');
    const sel = this.enHex(crypto.getRandomValues(new Uint8Array(16)));
    const empreinte = await this.empreinte(motDePasse, sel, this.ITERATIONS);
    await BD.definirReglage('motDePasse', { algo: 'PBKDF2-SHA256', sel, iterations: this.ITERATIONS, empreinte });
  },

  async verifier(motDePasse) {
    const r = await BD.reglage('motDePasse', null);
    if (!r) return true;
    const calcul = await this.empreinte(motDePasse, r.sel, r.iterations);
    // Comparaison caractère par caractère, toujours jusqu'au bout
    let difference = calcul.length ^ r.empreinte.length;
    for (let i = 0; i < calcul.length; i++) difference |= calcul.charCodeAt(i) ^ (r.empreinte.charCodeAt(i) || 0);
    return difference === 0;
  },

  async actif() {
    return !!(await BD.reglage('motDePasse', null));
  },

  /* Affiche l'écran de verrouillage et attend le bon mot de passe */
  demander() {
    return new Promise((ok) => {
      $('#principal').hidden = true;
      $('#barre-nav').hidden = true;
      $('#bandeau-mise-a-jour').hidden = true;
      if ($('#dialogue').open) $('#dialogue').close();
      if ($('#visionneuse').open) $('#visionneuse').close();
      const ecran = $('#verrou');
      const form = $('#verrou-form');
      const champ = $('#verrou-mdp');
      const erreur = $('#verrou-erreur');
      ecran.hidden = false;
      champ.value = '';
      erreur.hidden = true;
      champ.focus();
      const soumettre = async (e) => {
        e.preventDefault();
        if (!champ.value) { erreur.textContent = 'Tape ton mot de passe.'; erreur.hidden = false; return; }
        if (await this.verifier(champ.value)) {
          form.removeEventListener('submit', soumettre);
          champ.value = '';
          ecran.hidden = true;
          ok();
        } else {
          erreur.textContent = 'Mot de passe incorrect. Vérifie les majuscules et réessaie.';
          erreur.hidden = false;
          champ.select();
        }
      };
      form.addEventListener('submit', soumettre);
    });
  }
};

// Reverrouillage après un long moment en arrière-plan
let cacheDepuis = 0;
document.addEventListener('visibilitychange', async () => {
  if (!App.pret) return;
  if (document.visibilityState === 'hidden') { cacheDepuis = Date.now(); return; }
  if (cacheDepuis && Date.now() - cacheDepuis > Verrou.DELAI_ARRIERE_PLAN && await Verrou.actif() && $('#verrou').hidden) {
    await Verrou.demander();
    App.montrer();
  }
  // Au retour, les rappels sont recalculés (la date a pu changer)
  if (Nav.etat && Nav.etat.vue !== 'formulaire') Nav.afficher(Nav.etat);
});


/* ---------- 4. Les nouvelles versions ----------
   Le service worker (sw.js) prépare la nouvelle version en silence.
   Rien ne change par surprise : un bandeau propose « Mettre à jour »
   ou « Plus tard ». Il n'apparaît jamais pendant qu'on remplit un
   formulaire (on perdrait sa saisie). */
const MiseAJour = {
  enAttente: null,
  plusTard: false,
  demandee: false,

  async demarrer() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) this.proposer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nouveau = reg.installing;
        if (!nouveau) return;
        nouveau.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) this.proposer(nouveau);
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.demandee) location.reload();
      });
    } catch (e) {
      console.warn('Service worker non installé :', e);
    }
  },

  proposer(sw) {
    this.enAttente = sw;
    this.majBandeau();
  },

  majBandeau() {
    const bandeau = $('#bandeau-mise-a-jour');
    const visible = !!this.enAttente && !this.plusTard && App.pret && $('#verrou').hidden &&
      !(Nav.etat && Nav.etat.vue === 'formulaire');
    bandeau.hidden = !visible;
  },

  installer() {
    if (!this.enAttente) return;
    this.demandee = true;
    this.enAttente.postMessage({ type: 'activer' });
  }
};


/* ---------- 5. Le démarrage ---------- */
const App = {
  pret: false,
  stockageProtege: null,     // réponse de navigator.storage.persist()

  erreurFatale(message) {
    $('#chargement').hidden = true;
    $('#principal').hidden = true;
    $('#barre-nav').hidden = true;
    $('#erreur-fatale-texte').textContent = message;
    $('#erreur-fatale').hidden = false;
  },

  montrer() {
    $('#principal').hidden = false;
    $('#barre-nav').hidden = false;
    MiseAJour.majBandeau();
  },

  /* Prépare les éléments fixes de la page (icônes, boutons retour…) */
  preparerPage() {
    for (const span of $$('.nav-icone')) span.append(icone(span.dataset.icone));
    for (const b of $$('[data-action="retour"]')) {
      b.append(icone('retour'), el('span', { text: 'Retour' }));
      b.addEventListener('click', () => Nav.retour());
    }
    for (const b of $$('#barre-nav button')) {
      b.addEventListener('click', () => {
        if (Nav.etat && Nav.etat.vue === b.dataset.onglet) return;   // déjà sur cet écran
        Nav.aller({ vue: b.dataset.onglet });
      });
    }
    $('#maj-oui').addEventListener('click', () => MiseAJour.installer());
    $('#maj-plus-tard').addEventListener('click', () => { MiseAJour.plusTard = true; MiseAJour.majBandeau(); });
    $('#erreur-recharger').addEventListener('click', () => location.reload());
    $('#numero-version').textContent = 'Version ' + VERSION;

    // Adresse de contact (voir ADRESSE_CONTACT tout en haut de ce fichier)
    const contact = $('#apropos-contact');
    if (ADRESSE_CONTACT) {
      contact.append(
        el('p', {}, 'Une idée, une gêne, quelque chose qui manque ? Tes retours sont les bienvenus. Écris à : ',
          el('span', { class: 'adresse-mail', text: ADRESSE_CONTACT })),
        el('a', { class: 'bouton large', href: 'mailto:' + ADRESSE_CONTACT + '?subject=' + encodeURIComponent('Retour sur Omni-Animaux'), text: 'Envoyer un retour par e-mail' })
      );
    } else {
      contact.append(el('p', { class: 'encart', text: 'Adresse de contact : bientôt disponible.' }));
    }
  },

  /* Demande au navigateur de ne pas effacer nos données quand la place
     manque (« stockage persistant »). Chrome l'accorde en général à une
     application installée sur l'écran d'accueil. */
  async proteger() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        this.stockageProtege = (await navigator.storage.persisted()) || (await navigator.storage.persist());
      }
    } catch (e) { this.stockageProtege = null; }
  },

  async demarrer() {
    this.preparerPage();
    MiseAJour.demarrer();          // le hors ligne s'installe même si l'appli est verrouillée

    try {
      await BD.ouvrir();
    } catch (e) {
      return this.erreurFatale(UI.messageErreur(e));
    }

    try {
      Theme.appliquer(await BD.reglage('theme', 'omni'));
      Taille.appliquer(await BD.reglage('taille', 'normal'));
      if (!(await BD.reglage('debutSuivi', null))) await BD.definirReglage('debutSuivi', Dates.aujourdhui());
    } catch (e) {
      return this.erreurFatale(UI.messageErreur(e));
    }

    $('#chargement').hidden = true;
    if (await Verrou.actif()) await Verrou.demander();

    this.pret = true;
    this.montrer();
    // État de départ : l'écran demandé par l'adresse (ou l'accueil)
    await Nav.remplacer({ ...Nav.depuisAdresse(), profondeur: 0 });
    this.proteger();

    // Première ouverture : avertissement et explication sur les données
    if (!(await BD.reglage('avertissementVu', false))) {
      await UI.informer({
        titre: 'Bienvenue dans Omni-Animaux',
        message: [
          'Cette application sert à organiser tes informations. Elle ne remplace pas l’avis d’un vétérinaire.',
          'Tes données restent uniquement sur cet appareil : rien n’est envoyé sur internet. Pense à faire des sauvegardes régulières (Réglages → Sauvegarder) pour ne pas les perdre.',
          'Les rappels s’affichent quand tu ouvres l’application : elle n’envoie pas de notification. Pour être prévenu à l’heure, utilise « Ajouter à Google Agenda ».'
        ]
      });
      await BD.definirReglage('avertissementVu', true);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.demarrer());
