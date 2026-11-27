/* Omni-Animalia — © 2026 Ferrus Dantioch
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

/* L'adresse e-mail de contact (la même que celle du portfolio de
   l'Omni-système). Pour la changer, écrire la nouvelle entre les deux
   apostrophes. Vide = la page À propos affiche « bientôt disponible ». */
const ADRESSE_CONTACT = 'omni-systeme.choking513@passmail.net';

/* Numéro de version affiché dans « À propos ».
   ⚠️ À changer en même temps que CACHE dans sw.js. */
const VERSION = '1.3.0';


/* ---------- 1. Le thème ---------- */
const Theme = {
  appliquer(theme) {
    const t = ['omni', 'sombre', 'clair'].includes(theme) ? theme : 'omni';
    document.documentElement.dataset.theme = t;
    // Copie dans le localStorage : lue par init-theme.js AVANT l'affichage
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
    if (etat.vue === 'animal') return '#animal/' + encodeURIComponent(etat.id) + '/' + encodeURIComponent(etat.section || 'identite');
    if (etat.vue === 'garde') return '#garde/' + encodeURIComponent(etat.id);
    return '#' + etat.vue;
  },

  depuisAdresse() {
    let morceaux;
    try {
      morceaux = location.hash.slice(1).split('/').map((m) => decodeURIComponent(m));
    } catch (e) {
      return { vue: 'accueil' };
    }
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
    if ($('#dialogue') && $('#dialogue').open) $('#dialogue').close();
    if ($('#visionneuse') && $('#visionneuse').open) $('#visionneuse').close();
    if (etat.vue === 'formulaire' && !Formulaire.courant) {
      // Formulaire déjà fermé (bouton « avancer » du navigateur…) : retour à l'accueil
      return this.remplacer({ vue: 'accueil' });
    }
    if (etat.vue !== 'formulaire' && typeof Formulaire !== 'undefined' &&
        (Formulaire.courant || (this.etat && this.etat.vue === 'formulaire'))) {
      if (typeof Formulaire.reinitialiser === 'function') Formulaire.reinitialiser();
      else Formulaire.courant = null;
    }
    this.etat = etat;
    for (const v of $$('.vue')) v.hidden = v.dataset.vue !== etat.vue;

    // L'onglet du bas correspondant est mis en évidence
    const onglets = { accueil: 'accueil', archives: 'accueil', animal: 'accueil', garde: 'accueil', rappels: 'rappels', veterinaires: 'veterinaires', reglages: 'reglages', apropos: 'reglages' };
    for (const b of $$('#barre-nav button')) {
      if (etat.vue !== 'formulaire' && b.dataset.onglet === onglets[etat.vue]) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
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
    if (tour !== this._tour || ($('#verrou') && !$('#verrou').hidden)) return;      // un autre écran a été demandé ou le verrou est actif

    window.scrollTo(0, 0);
    // Le titre reçoit le focus : un lecteur d'écran annonce le nouvel écran
    const titre = $('.vue[data-vue="' + etat.vue + '"] h1');
    if (titre) titre.focus({ preventScroll: true });
    this.majPastille();
  },

  /* La petite pastille sur l'onglet « Rappels » : nombre de rappels en
     retard ou pour aujourd'hui. */
  _tourPastille: 0,

  async majPastille() {
    const tour = ++this._tourPastille;
    try {
      const liste = Rappels.calculer(await BD.toutLire());
      if (tour !== this._tourPastille) return;
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
  if ($('#verrou') && !$('#verrou').hidden) return;
  if ($('#dialogue') && $('#dialogue').open) $('#dialogue').close();
  if ($('#visionneuse') && $('#visionneuse').open) $('#visionneuse').close();
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
  _promesse: null,
  _enCours: false,
  _echecs: 0,
  _bloqueJusqua: 0,

  enHex(octets) {
    return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');
  },
  depuisHex(hex) {
    if (typeof hex !== 'string' || !hex.length || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
      throw BD.erreur('Les données du mot de passe sont illisibles.');
    }
    return new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
  },

  async empreinte(motDePasse, selHex, iterations) {
    if (typeof window === 'undefined' || !window.crypto || !crypto.subtle) {
      throw BD.erreur('Ce navigateur ne permet pas de vérifier le mot de passe (il faut une adresse https).');
    }
    if (typeof motDePasse !== 'string') throw BD.erreur('Mot de passe invalide.');
    const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: this.depuisHex(selHex), iterations },
      cle, 256);
    return this.enHex(bits);
  },

  /* Crée l'empreinte d'un nouveau mot de passe et l'enregistre */
  async definir(motDePasse) {
    if (typeof window === 'undefined' || !window.crypto || !crypto.subtle) {
      throw BD.erreur('Ce navigateur ne permet pas de protéger par mot de passe (il faut une adresse https).');
    }
    const sel = this.enHex(crypto.getRandomValues(new Uint8Array(16)));
    const empreinte = await this.empreinte(motDePasse, sel, this.ITERATIONS);
    await BD.definirReglage('motDePasse', { algo: 'PBKDF2-SHA256', sel, iterations: this.ITERATIONS, empreinte });
    this.reinitialiserEchecs();
  },

  reinitialiserEchecs() {
    this._echecs = 0;
    this._bloqueJusqua = 0;
  },

  verifierDelai() {
    const maintenant = Date.now();
    if (this._bloqueJusqua > maintenant) {
      const sec = Math.ceil((this._bloqueJusqua - maintenant) / 1000);
      return 'Trop d’essais incorrects. Réessaie dans ' + sec + ' s.';
    }
    return '';
  },

  async verifierAvecDelai(motDePasse) {
    const blocage = this.verifierDelai();
    if (blocage) throw BD.erreur(blocage);
    const ok = await this.verifier(motDePasse);
    if (ok) {
      this.reinitialiserEchecs();
      return true;
    }
    this._echecs++;
    if (this._echecs >= 3) {
      this._bloqueJusqua = Date.now() + Math.min(30000, 1000 * (2 ** (this._echecs - 3)));
    }
    return false;
  },

  async verifier(motDePasse) {
    const r = await BD.reglage('motDePasse', null);
    if (!r) return true;
    if (typeof r !== 'object' || (r.algo && r.algo !== 'PBKDF2-SHA256') ||
        typeof r.sel !== 'string' || !/^[0-9a-f]{16,128}$/i.test(r.sel) ||
        !Number.isInteger(r.iterations) || r.iterations < 10000 || r.iterations > 2000000 ||
        typeof r.empreinte !== 'string' || !/^[0-9a-f]{64}$/i.test(r.empreinte)) {
      throw BD.erreur('Les données du mot de passe sont corrompues.');
    }
    const calcul = await this.empreinte(motDePasse, r.sel, r.iterations);
    const attendu = r.empreinte.toLowerCase();
    // Comparaison caractère par caractère, toujours jusqu'au bout
    let difference = calcul.length ^ attendu.length;
    for (let i = 0; i < calcul.length; i++) difference |= calcul.charCodeAt(i) ^ (attendu.charCodeAt(i) || 0);
    return difference === 0;
  },

  async actif() {
    return !!(await BD.reglage('motDePasse', null));
  },

  /* Affiche l'écran de verrouillage et attend le bon mot de passe */
  demander() {
    if (this._promesse) return this._promesse;
    this._promesse = new Promise((ok) => {
      $('#principal').hidden = true;
      $('#barre-nav').hidden = true;
      $('#bandeau-mise-a-jour').hidden = true;
      if ($('#dialogue') && $('#dialogue').open) $('#dialogue').close();
      if ($('#visionneuse') && $('#visionneuse').open) $('#visionneuse').close();
      if (typeof Impression !== 'undefined' && typeof Impression._nettoyer === 'function') {
        Impression._nettoyer(true);
      }
      const carnet = $('#carnet');
      if (carnet) vider(carnet);
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
        if (this._enCours) return;
        if (!champ.value) { erreur.textContent = 'Tape ton mot de passe.'; erreur.hidden = false; return; }
        const blocage = this.verifierDelai();
        if (blocage) {
          erreur.textContent = blocage;
          erreur.hidden = false;
          return;
        }
        this._enCours = true;
        try {
          if (await this.verifierAvecDelai(champ.value)) {
            form.removeEventListener('submit', soumettre);
            champ.value = '';
            erreur.hidden = true;
            ecran.hidden = true;
            this._promesse = null;
            ok();
          } else {
            erreur.textContent = 'Mot de passe incorrect. Vérifie les majuscules et réessaie.';
            erreur.hidden = false;
            champ.select();
          }
        } catch (err) {
          erreur.textContent = UI.messageErreur(err);
          erreur.hidden = false;
        } finally {
          this._enCours = false;
        }
      };
      form.addEventListener('submit', soumettre);
    });
    return this._promesse;
  }
};

// Reverrouillage après un long moment en arrière-plan
let cacheDepuis = 0;
let dernierJour = '';
document.addEventListener('visibilitychange', async () => {
  if (!App.pret) return;
  if (document.visibilityState === 'hidden') { cacheDepuis = Date.now(); return; }
  const depuis = cacheDepuis;
  cacheDepuis = 0;
  MiseAJour.verifier();
  try {
    let aReverrouille = false;
    if (depuis && Date.now() - depuis > Verrou.DELAI_ARRIERE_PLAN &&
        $('#verrou') && $('#verrou').hidden && !Verrou._promesse && await Verrou.actif()) {
      aReverrouille = true;
      await Verrou.demander();
      App.montrer();
    }
    const auj = Dates.aujourdhui();
    const jourChange = !!dernierJour && auj !== dernierJour;
    dernierJour = auj;
    const dialogueOuvert = ($('#dialogue') && $('#dialogue').open) || ($('#visionneuse') && $('#visionneuse').open);
    if (jourChange && Nav.etat && Nav.etat.vue !== 'formulaire' && !dialogueOuvert && $('#verrou').hidden) {
      await Nav.afficher(Nav.etat);
    } else {
      Nav.majPastille();
      if (aReverrouille && Nav.etat && !dialogueOuvert) {
        const titre = $('.vue[data-vue="' + Nav.etat.vue + '"] h1');
        if (titre) titre.focus({ preventScroll: true });
      }
    }
  } catch (e) {
    console.warn(e);
  }
});

window.addEventListener('online', () => {
  if (App.pret) MiseAJour.verifier();
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
  _reg: null,
  _rechargement: false,

  async demarrer() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      this._reg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) this.proposer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nouveau = reg.installing;
        if (!nouveau) return;
        nouveau.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) this.proposer(nouveau);
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.demandee && !this._rechargement) {
          this._rechargement = true;
          location.reload();
        } else if (!this.demandee) {
          this.enAttente = null;
          this.majBandeau();
        }
      });
    } catch (e) {
      console.warn('Service worker non installé :', e);
    }
  },

  async verifier() {
    if (!this._reg || navigator.onLine === false) return;
    try {
      await this._reg.update();
    } catch (e) { /* hors ligne ou erreur réseau : sans gravité */ }
  },

  proposer(sw) {
    if (this.enAttente !== sw) {
      this.plusTard = false;
      const oui = $('#maj-oui');
      const tard = $('#maj-plus-tard');
      if (oui) oui.disabled = false;
      if (tard) tard.disabled = false;
    }
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
    if (!this.enAttente || this.demandee) return;
    this.demandee = true;
    const oui = $('#maj-oui');
    const tard = $('#maj-plus-tard');
    if (oui) oui.disabled = true;
    if (tard) tard.disabled = true;
    try {
      if (this.enAttente.state === 'activated') {
        if (!this._rechargement) { this._rechargement = true; location.reload(); }
        return;
      }
      this.enAttente.postMessage({ type: 'activer' });
    } catch (e) {
      this.demandee = false;
      if (oui) oui.disabled = false;
      if (tard) tard.disabled = false;
      console.warn(e);
    }
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
        el('a', { class: 'bouton principal large', href: 'mailto:' + ADRESSE_CONTACT + '?subject=' + encodeURIComponent('Retour sur Omni-Animalia'), text: 'Envoyer un retour par e-mail' }),
        bouton('Copier l’adresse', () => UI.copier(ADRESSE_CONTACT), { classe: 'secondaire large', icone: 'copier', id: 'copier-contact' })
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
        const deja = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        this.stockageProtege = deja || (await navigator.storage.persist());
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
    try {
      if (await Verrou.actif()) await Verrou.demander();
      await this.proteger();
      this.pret = true;
      this.montrer();
      dernierJour = Dates.aujourdhui();
      // État de départ : l'écran demandé par l'adresse (ou l'accueil)
      await Nav.remplacer({ ...Nav.depuisAdresse(), profondeur: 0 });
    } catch (e) {
      this.pret = false;
      return this.erreurFatale(UI.messageErreur(e));
    }

    // Première ouverture : avertissement et explication sur les données
    try {
      if (!(await BD.reglage('avertissementVu', false))) {
        await UI.informer({
          titre: 'Bienvenue dans Omni-Animalia',
          message: [
            'Cette application sert à organiser tes informations. Elle ne remplace pas l’avis d’un vétérinaire.',
            'Tes données restent uniquement sur cet appareil : rien n’est envoyé sur internet. Pense à faire des sauvegardes régulières (Réglages → Sauvegarder) pour ne pas les perdre.',
            'Les rappels s’affichent quand tu ouvres l’application : elle n’envoie pas de notification. Pour être prévenu à l’heure, utilise « Ajouter à Google Agenda ».'
          ]
        });
        await BD.definirReglage('avertissementVu', true);
      }
    } catch (e) {
      console.warn(e);
      UI.annoncer(UI.messageErreur(e), 'erreur');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.demarrer());
