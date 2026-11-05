/* Omni-Animaux — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OUTIL-INTERFACE — les briques de l'écran, utilisées partout.

   SÉCURITÉ : tout ce que la personne a tapé est posé à l'écran avec
   « textContent » (du texte simple), JAMAIS avec « innerHTML ». Ainsi,
   même si quelqu'un tape du code dans le nom d'un animal, ce code
   s'affiche comme du texte et ne s'exécute jamais.

   On trouve ici :
   1. $ et $$ : chercher un élément de la page
   2. el()    : fabriquer un élément (bouton, paragraphe…)
   3. icone() : les petits dessins (patte, cloche…)
   4. UI      : messages, fenêtres de confirmation, copie…
   5. Formulaire : fabrique les formulaires et vérifie les saisies
   ============================================================ */
'use strict';

/* ---------- 1. Chercher dans la page ---------- */
const $ = (sel, racine) => (racine || document).querySelector(sel);
const $$ = (sel, racine) => [...(racine || document).querySelectorAll(sel)];


/* ---------- 2. Fabriquer un élément ----------
   el('button', { class: 'bouton', onclick: f }, 'Texte')
   - les textes passés en « enfants » deviennent du texte simple (sûr) ;
   - « text » remplit l'élément avec du texte simple ;
   - une clé qui commence par « on » branche une action (onclick…) ;
   - une valeur false / null / undefined est ignorée. */
function el(balise, attributs, ...enfants) {
  const e = document.createElement(balise);
  for (const [cle, val] of Object.entries(attributs || {})) {
    if (val === false || val === null || val === undefined) continue;
    if (cle === 'text') e.textContent = val;
    else if (cle === 'class') e.className = val;
    else if (cle.startsWith('on') && typeof val === 'function') e.addEventListener(cle.slice(2), val);
    else if (cle === 'value' || cle === 'checked' || cle === 'selected') e[cle] = val;
    else e.setAttribute(cle, val === true ? '' : String(val));
  }
  ajouterEnfants(e, enfants);
  return e;
}

/* Ajoute des enfants (éléments ou textes) à un élément */
function ajouterEnfants(parent, enfants) {
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    parent.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
}

/* Vide un élément de tout son contenu */
function vider(e) {
  while (e.firstChild) e.removeChild(e.firstChild);
  return e;
}


/* ---------- 3. Les icônes ----------
   Dessinées en SVG (traits simples, sans couleur propre : elles prennent
   la couleur du texte). Chaque icône : des tracés (p), des cercles (c)
   et des rectangles (r), dans un carré de 24 × 24. */
const ICONES = {
  patte:     { p: ['M12 12c-3 0-5.5 3.6-5.5 5.6 0 1.7 1.5 2.5 3 2.2 1-.2 1.6-.6 2.5-.6s1.5.4 2.5.6c1.5.3 3-.5 3-2.2 0-2-2.5-5.6-5.5-5.6z'], c: [[6, 10.5, 1.8], [9.6, 6, 1.8], [14.4, 6, 1.8], [18, 10.5, 1.8]] },
  cloche:    { p: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z', 'M10 20.5a2 2 0 0 0 4 0'] },
  croix:     { p: ['M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z'] },
  reglages:  { p: ['M4 6h9', 'M17 6h3', 'M4 12h3', 'M11 12h9', 'M4 18h11', 'M19 18h1'], c: [[15, 6, 2], [9, 12, 2], [17, 18, 2]] },
  plus:      { p: ['M12 5v14', 'M5 12h14'] },
  retour:    { p: ['M15 5l-7 7 7 7'] },
  crayon:    { p: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'] },
  poubelle:  { p: ['M4 7h16', 'M9.5 7V4.5h5V7', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'] },
  copier:    { p: ['M5 15V5h10'], r: [[9, 9, 11, 11]] },
  imprimer:  { p: ['M7 9V3.5h10V9', 'M7 17H4v-8h16v8h-3'], r: [[7, 14, 10, 7]] },
  archive:   { p: ['M5 8v12h14V8', 'M10 12h4'], r: [[3, 4, 18, 4]] },
  restaurer: { p: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4.5 4v4h4'] },
  telephone: { p: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'] },
  cadenas:   { p: ['M8 11V7.5a4 4 0 0 1 8 0V11'], r: [[5, 11, 14, 10]] },
  coche:     { p: ['M5 12.5l4.5 4.5L19 7.5'] },
  photo:     { p: ['M4 8h3l2-3h6l2 3h3v11H4z'], c: [[12, 13, 3.5]] },
  info:      { p: ['M12 11v6', 'M12 7.5v.5'], c: [[12, 12, 9]] },
  sauver:    { p: ['M12 4v11', 'M7.5 10.5L12 15l4.5-4.5', 'M4 19.5h16'] }
};

function icone(nom, classe) {
  const ns = 'http://www.w3.org/2000/svg';
  const def = ICONES[nom];
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icone' + (classe ? ' ' + classe : ''));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (!def) return svg;
  for (const d of def.p || []) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  for (const [cx, cy, r] of def.c || []) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    svg.append(c);
  }
  for (const [x, y, w, h] of def.r || []) {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('rx', 1.5);
    svg.append(r);
  }
  return svg;
}

/* Un bouton avec une icône et un texte (le texte reste toujours visible :
   on ne devine jamais ce que fait un bouton). */
function bouton(texte, action, options) {
  const o = options || {};
  return el('button', {
    type: o.type || 'button',
    class: 'bouton' + (o.classe ? ' ' + o.classe : ''),
    onclick: action,
    'aria-label': o.aria,
    id: o.id
  }, o.icone ? icone(o.icone) : null, el('span', { text: texte }));
}


/* ---------- 4. Messages et fenêtres ---------- */
const UI = {

  /* Affiche un message court en bas de l'écran (sans bruit, sans
     clignotement). Les lecteurs d'écran le lisent à voix haute.
     type : 'info' (par défaut) ou 'erreur'. */
  annoncer(message, type) {
    const zone = $('#annonce');
    if (!zone) return;
    clearTimeout(this._minuteur);
    // La zone reste toujours dans la page (sinon les lecteurs d'écran
    // ne lisent pas le message) : elle est seulement vide quand on ne
    // l'utilise pas, et la feuille de style cache une zone vide.
    zone.className = 'annonce' + (type === 'erreur' ? ' erreur' : '');
    zone.textContent = message;
    // Une erreur reste plus longtemps, pour avoir le temps de la lire
    this._minuteur = setTimeout(() => { zone.textContent = ''; }, type === 'erreur' ? 9000 : 4500);
  },

  /* Transforme une erreur technique en phrase compréhensible */
  messageErreur(e) {
    const nom = (e && e.name) || '';
    const texte = (e && e.message) || '';
    if (nom === 'QuotaExceededError' || /quota/i.test(texte)) {
      return 'L’espace de stockage du téléphone est plein. Libérez de la place (photos, applications) puis réessayez.';
    }
    if (e && e.lisible) return texte;     // message déjà écrit pour la personne
    return 'Une erreur est survenue : l’opération n’a pas été faite. ' + (texte ? '(Détail : ' + texte + ')' : '');
  },

  /* Ouvre une fenêtre avec plusieurs choix.
     Renvoie (par une « promesse ») la valeur du choix, ou null si on ferme.
     options : { titre, message (texte ou liste de textes), choix: [{ valeur, texte, danger }],
                 saisie: 'MOT' (il faut taper ce mot pour pouvoir valider) } */
  choisir(options) {
    return new Promise((resoudre) => {
      const dlg = $('#dialogue');
      vider(dlg);
      const titreId = 'dialogue-titre';
      dlg.setAttribute('aria-labelledby', titreId);
      const messages = [].concat(options.message || []);
      const corps = el('div', { class: 'dialogue-corps' },
        el('h2', { id: titreId, text: options.titre || 'Confirmation' }),
        messages.map((m) => el('p', { text: m }))
      );
      let saisie = null;
      if (options.saisie) {
        saisie = el('input', { type: 'text', id: 'dialogue-saisie', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
        corps.append(
          el('label', { for: 'dialogue-saisie', text: 'Pour confirmer, tapez le mot ' + options.saisie + ' :' }),
          saisie
        );
      }
      const boutons = el('div', { class: 'dialogue-boutons' });
      let reponse = null;
      const boutonsValider = [];
      for (const c of options.choix) {
        const b = el('button', {
          type: 'button',
          class: 'bouton' + (c.danger ? ' danger' : '') + (c.principal ? ' principal' : ''),
          text: c.texte,
          onclick: () => { reponse = c.valeur; dlg.close(); }
        });
        if (c.valeur !== null && saisie) { b.disabled = true; boutonsValider.push(b); }
        boutons.append(b);
      }
      if (saisie) {
        saisie.addEventListener('input', () => {
          const ok = saisie.value.trim().toUpperCase() === options.saisie;
          boutonsValider.forEach((b) => { b.disabled = !ok; });
        });
      }
      corps.append(boutons);
      dlg.append(corps);
      const fermer = () => {
        dlg.removeEventListener('close', fermer);
        resoudre(reponse);
      };
      dlg.addEventListener('close', fermer);
      dlg.showModal();
      // Le focus va sur le bouton « Annuler » (le choix sans danger),
      // ou sur la case à remplir.
      const annuler = [...boutons.children].find((b, i) => options.choix[i].valeur === null);
      (saisie || annuler || boutons.firstChild).focus();
    });
  },

  /* Demande une confirmation oui / non. Renvoie true ou false. */
  async confirmer({ titre, message, oui, non, danger, saisie }) {
    const r = await this.choisir({
      titre, message, saisie,
      choix: [
        { valeur: null, texte: non || 'Annuler' },
        { valeur: true, texte: oui || 'Confirmer', danger: !!danger, principal: !danger }
      ]
    });
    return r === true;
  },

  /* Simple information avec un seul bouton */
  async informer({ titre, message, ok }) {
    await this.choisir({ titre, message, choix: [{ valeur: true, texte: ok || 'J’ai compris', principal: true }] });
  },

  /* Copie un texte (numéro de puce…) dans le presse-papiers */
  async copier(texte) {
    try {
      await navigator.clipboard.writeText(texte);
      this.annoncer('Copié : ' + texte);
    } catch (e) {
      // Ancienne méthode, si la nouvelle est refusée
      const zone = el('textarea', { class: 'invisible', 'aria-hidden': 'true' });
      zone.value = texte;
      document.body.append(zone);
      zone.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      zone.remove();
      this.annoncer(ok ? 'Copié : ' + texte : 'La copie n’a pas fonctionné. Vous pouvez recopier le numéro à la main.', ok ? 'info' : 'erreur');
    }
  },

  /* Nombre à la française : 4.5 → « 4,5 » */
  nombre(n, decimales) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return n.toLocaleString('fr-FR', { maximumFractionDigits: decimales === undefined ? 2 : decimales });
  },

  /* Somme d'argent : « 45,50 € » */
  euros(n) {
    if (typeof n !== 'number' || isNaN(n)) return '';
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
};


/* ---------- 5. Les formulaires ----------
   Chaque formulaire est décrit par une liste de champs :
   { nom, label, type, requis, aide, options, suggestions, visibleSi,
     positif, entier, min, max, pasDansFutur, long }
   Types : texte, zone, date, heure, nombre, choix, radios, case, tel,
   motdepasse, photo.
   Le formulaire s'ouvre dans l'écran « formulaire ». À l'enregistrement,
   chaque champ est vérifié, et un message clair s'affiche sous chaque
   champ mal rempli. */
const Formulaire = {
  courant: null,      // le formulaire ouvert en ce moment

  /* Ouvre un formulaire.
     def : { titre, intro, champs, valeurs, valider(v), enregistrer(v), texteBouton } */
  ouvrir(def) {
    this.courant = def;
    Nav.aller({ vue: 'formulaire' });
  },

  /* Dessine le formulaire courant (appelé par la navigation) */
  afficher() {
    const def = this.courant;
    const vue = $('[data-vue="formulaire"]');
    const zone = $('#formulaire-zone');
    vider(zone);
    if (!def) return false;
    $('h1', vue).textContent = def.titre;

    const form = el('form', { novalidate: true, class: 'formulaire' });
    if (def.intro) form.append(el('p', { class: 'discret', text: def.intro }));
    form.append(el('p', { class: 'discret petit', text: 'Les champs marqués d’une étoile (*) sont obligatoires.' }));
    const resume = el('div', { id: 'formulaire-erreurs', class: 'encart erreur', tabindex: '-1', hidden: true });
    form.append(resume);

    const valeurs = def.valeurs || {};
    for (const champ of def.champs) form.append(this.fabriquerChamp(champ, valeurs[champ.nom]));

    form.append(el('div', { class: 'formulaire-boutons' },
      bouton('Annuler', () => Nav.retour(), { classe: 'secondaire' }),
      bouton(def.texteBouton || 'Enregistrer', null, { type: 'submit', classe: 'principal', icone: 'coche' })
    ));

    form.addEventListener('input', () => this.majVisibilite(form));
    form.addEventListener('change', () => this.majVisibilite(form));
    form.addEventListener('submit', (e) => { e.preventDefault(); this.soumettre(form); });
    zone.append(form);
    this.majVisibilite(form);
    return true;
  },

  /* Fabrique un champ avec son étiquette, son aide et sa zone d'erreur */
  fabriquerChamp(champ, valeur) {
    const id = 'champ-' + champ.nom;
    const idAide = id + '-aide';
    const idErreur = id + '-erreur';
    const bloc = el('div', { class: 'champ champ-' + champ.type, 'data-champ': champ.nom });
    const etoile = champ.requis ? ' *' : '';
    const decrit = [champ.aide ? idAide : '', idErreur].filter(Boolean).join(' ');
    const v = valeur === undefined || valeur === null ? '' : valeur;
    let saisie;

    switch (champ.type) {
      case 'zone':
        bloc.append(el('label', { for: id, text: champ.label + etoile }));
        saisie = el('textarea', { id, name: champ.nom, rows: 4, maxlength: champ.long || 5000, 'aria-describedby': decrit });
        saisie.value = v;
        break;

      case 'choix':
        bloc.append(el('label', { for: id, text: champ.label + etoile }));
        saisie = el('select', { id, name: champ.nom, 'aria-describedby': decrit },
          champ.options.map((o) => el('option', { value: o.valeur, text: o.texte, selected: String(o.valeur) === String(v) })));
        break;

      case 'radios': {
        const groupe = el('fieldset', { class: 'groupe-radios', 'aria-describedby': decrit },
          el('legend', { text: champ.label + etoile }));
        champ.options.forEach((o, i) => {
          const idR = id + '-' + i;
          groupe.append(el('div', { class: 'radio' },
            el('input', { type: 'radio', id: idR, name: champ.nom, value: o.valeur, checked: String(o.valeur) === String(v) }),
            el('label', { for: idR, text: o.texte })));
        });
        bloc.append(groupe);
        break;
      }

      case 'case':
        saisie = el('input', { type: 'checkbox', id, name: champ.nom, checked: !!v, 'aria-describedby': decrit });
        bloc.append(el('div', { class: 'case' }, saisie, el('label', { for: id, text: champ.label })));
        saisie = null;      // déjà placé
        break;

      case 'photo':
        bloc.append(this.fabriquerPhoto(champ, v));
        break;

      default: {
        // texte, date, heure, nombre, tel
        bloc.append(el('label', { for: id, text: champ.label + etoile }));
        const types = { date: 'date', heure: 'time', tel: 'tel', nombre: 'text', texte: 'text', motdepasse: 'password' };
        const attrs = {
          id, name: champ.nom, type: types[champ.type] || 'text',
          'aria-describedby': decrit,
          autocomplete: champ.autocomplete || (champ.type === 'motdepasse' ? 'new-password' : 'off'),
          maxlength: ['texte', 'tel', 'motdepasse'].includes(champ.type) ? (champ.long || 200) : null,
          inputmode: champ.type === 'nombre' ? 'decimal' : null,
          placeholder: champ.placeholder
        };
        if (champ.suggestions && champ.suggestions.length) {
          const idListe = id + '-liste';
          attrs.list = idListe;
          bloc.append(el('datalist', { id: idListe }, champ.suggestions.map((s) => el('option', { value: s }))));
        }
        saisie = el('input', attrs);
        saisie.value = champ.type === 'nombre' && typeof v === 'number' ? String(v).replace('.', ',') : v;
        if (champ.unite) {
          bloc.append(el('div', { class: 'avec-unite' }, saisie, el('span', { class: 'unite', text: champ.unite })));
          saisie = null;
        }
      }
    }

    if (saisie) bloc.append(saisie);
    if (champ.requis) {
      const cible = $('input, select, textarea', bloc);
      if (cible && champ.type !== 'radios') cible.setAttribute('aria-required', 'true');
    }
    if (champ.aide) bloc.append(el('p', { id: idAide, class: 'aide', text: champ.aide }));
    bloc.append(el('p', { id: idErreur, class: 'message-erreur', hidden: true }));
    return bloc;
  },

  /* Le champ photo : aperçu + « Prendre une photo » + « Galerie » + « Retirer » */
  fabriquerPhoto(champ, valeur) {
    const conteneur = el('div', { class: 'champ-photo-zone' });
    const cache = el('input', { type: 'hidden', name: champ.nom });
    cache.value = valeur || '';
    const apercu = el('img', { class: 'apercu-photo', alt: 'Aperçu de la photo', hidden: !valeur });
    if (valeur) apercu.src = valeur;
    const etat = el('p', { class: 'aide', 'aria-live': 'polite', text: valeur ? '' : 'Aucune photo pour le moment.' });

    const traiter = async (fichier) => {
      if (!fichier) return;
      etat.textContent = 'Préparation de la photo…';
      try {
        const donnees = await Photo.reduire(fichier);
        cache.value = donnees;
        apercu.src = donnees;
        apercu.hidden = false;
        retirer.hidden = false;
        etat.textContent = 'Photo prête. Elle sera enregistrée avec le reste.';
      } catch (e) {
        etat.textContent = e.message || 'Cette image n’a pas pu être lue.';
      }
    };
    const fichierCamera = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'invisible', tabindex: '-1', 'aria-hidden': 'true' });
    const fichierGalerie = el('input', { type: 'file', accept: 'image/*', class: 'invisible', tabindex: '-1', 'aria-hidden': 'true' });
    fichierCamera.addEventListener('change', () => { traiter(fichierCamera.files[0]); fichierCamera.value = ''; });
    fichierGalerie.addEventListener('change', () => { traiter(fichierGalerie.files[0]); fichierGalerie.value = ''; });
    const retirer = bouton('Retirer la photo', () => {
      cache.value = '';
      apercu.hidden = true;
      apercu.removeAttribute('src');
      retirer.hidden = true;
      etat.textContent = 'Photo retirée (elle disparaîtra à l’enregistrement).';
    }, { classe: 'secondaire', icone: 'poubelle' });
    retirer.hidden = !valeur;

    conteneur.append(
      el('p', { class: 'etiquette', text: champ.label }),
      apercu, cache, fichierCamera, fichierGalerie,
      el('div', { class: 'rangee-boutons' },
        bouton('Prendre une photo', () => fichierCamera.click(), { classe: 'secondaire', icone: 'photo' }),
        bouton('Choisir dans la galerie', () => fichierGalerie.click(), { classe: 'secondaire' }),
        retirer),
      etat
    );
    return conteneur;
  },

  /* Lit toutes les valeurs du formulaire (les champs cachés comptent pour vides) */
  lire(form) {
    const v = {};
    for (const champ of this.courant.champs) {
      const bloc = $('[data-champ="' + champ.nom + '"]', form);
      const visible = bloc && !bloc.hidden;
      if (champ.type === 'case') {
        v[champ.nom] = visible ? $('input', bloc).checked : false;
      } else if (champ.type === 'radios') {
        const coche = $('input:checked', bloc);
        v[champ.nom] = visible && coche ? coche.value : '';
      } else {
        const saisie = $('[name="' + champ.nom + '"]', bloc);
        // Un mot de passe est gardé tel quel (une espace peut en faire partie)
        const brut = visible && saisie ? saisie.value : '';
        v[champ.nom] = champ.type === 'motdepasse' ? brut : brut.trim();
      }
    }
    return v;
  },

  /* Montre ou cache les champs qui dépendent d'autres (« visibleSi ») */
  majVisibilite(form) {
    if (!this.courant) return;
    const v = this.lire(form);
    for (const champ of this.courant.champs) {
      if (!champ.visibleSi) continue;
      const bloc = $('[data-champ="' + champ.nom + '"]', form);
      if (bloc) bloc.hidden = !champ.visibleSi(v);
    }
  },

  /* Transforme « 3,5 » en 3.5. Renvoie NaN si ce n'est pas un nombre. */
  lireNombre(texte) {
    const t = String(texte).replace(/\s/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
    return Number(t);
  },

  /* Vérifie chaque champ. Renvoie { valeurs (converties), erreurs } */
  verifier(form) {
    const brut = this.lire(form);
    const valeurs = { ...brut };
    const erreurs = {};
    const aujourdhui = Dates.aujourdhui();

    for (const champ of this.courant.champs) {
      const bloc = $('[data-champ="' + champ.nom + '"]', form);
      if (bloc && bloc.hidden) continue;
      const t = brut[champ.nom];
      const vide = t === '' || t === false;

      if (champ.requis && vide && champ.type !== 'case') {
        erreurs[champ.nom] = champ.type === 'radios' || champ.type === 'choix'
          ? 'Choisissez une réponse.' : 'Ce champ est obligatoire.';
        continue;
      }
      if (vide) { if (champ.type === 'nombre') valeurs[champ.nom] = null; continue; }

      if (champ.type === 'date') {
        if (!Dates.estValide(t)) erreurs[champ.nom] = 'Cette date n’est pas valide.';
        else if (champ.pasDansFutur && t > aujourdhui) erreurs[champ.nom] = 'Cette date ne peut pas être dans le futur.';
      } else if (champ.type === 'heure') {
        if (!Dates.heureValide(t)) erreurs[champ.nom] = 'Cette heure n’est pas valide (exemple : 14:30).';
      } else if (champ.type === 'nombre') {
        const n = this.lireNombre(t);
        if (isNaN(n)) erreurs[champ.nom] = 'Tapez un nombre (exemple : 4,5).';
        else if (champ.positif && n <= 0) erreurs[champ.nom] = 'Le nombre doit être plus grand que zéro.';
        else if (n < 0) erreurs[champ.nom] = 'Le nombre ne peut pas être négatif.';
        else if (champ.entier && !Number.isInteger(n)) erreurs[champ.nom] = 'Tapez un nombre entier (sans virgule).';
        else if (champ.max !== undefined && n > champ.max) erreurs[champ.nom] = 'Le nombre est trop grand (maximum : ' + UI.nombre(champ.max) + ').';
        else valeurs[champ.nom] = n;
      } else if (champ.type === 'tel') {
        if (!/^[0-9+().\s-]{3,30}$/.test(t)) erreurs[champ.nom] = 'Ce numéro contient des caractères inattendus (seuls les chiffres, espaces, +, -, points et parenthèses sont acceptés).';
      }
    }

    // Vérifications propres à ce formulaire (dates dans le bon ordre…)
    if (this.courant.valider) {
      const autres = this.courant.valider(valeurs) || {};
      for (const [cle, msg] of Object.entries(autres)) if (!erreurs[cle]) erreurs[cle] = msg;
    }
    return { valeurs, erreurs };
  },

  /* Affiche les erreurs sous les champs concernés, plus un résumé en haut */
  montrerErreurs(form, erreurs) {
    const resume = $('#formulaire-erreurs', form);
    $$('.message-erreur', form).forEach((p) => { p.hidden = true; p.textContent = ''; });
    $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
    const noms = Object.keys(erreurs);
    if (!noms.length) { resume.hidden = true; return; }

    vider(resume);
    resume.append(el('p', { text: noms.length === 1 ? 'Un champ est à corriger :' : noms.length + ' champs sont à corriger :' }));
    const liste = el('ul');
    for (const nom of noms) {
      const champ = this.courant.champs.find((c) => c.nom === nom);
      const bloc = $('[data-champ="' + nom + '"]', form);
      if (bloc) {
        const p = $('.message-erreur', bloc);
        p.textContent = erreurs[nom];
        p.hidden = false;
        const saisie = $('input:not([type=hidden]), select, textarea', bloc);
        if (saisie) saisie.setAttribute('aria-invalid', 'true');
      }
      liste.append(el('li', { text: (champ ? champ.label : nom) + ' : ' + erreurs[nom] }));
    }
    resume.append(liste);
    resume.hidden = false;
    resume.focus();
  },

  /* Clic sur « Enregistrer » */
  async soumettre(form) {
    if (this._enCours) return;           // évite un double enregistrement
    const { valeurs, erreurs } = this.verifier(form);
    this.montrerErreurs(form, erreurs);
    if (Object.keys(erreurs).length) return;
    this._enCours = true;
    try {
      const message = await this.courant.enregistrer(valeurs);
      this.courant = null;
      Nav.retour();
      UI.annoncer(message || 'Enregistré.');
    } catch (e) {
      console.warn(e);
      UI.annoncer(UI.messageErreur(e), 'erreur');
    } finally {
      this._enCours = false;
    }
  }
};
