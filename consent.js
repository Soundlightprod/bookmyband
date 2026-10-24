/* SLP — mesure d'audience : choix du visiteur + identifiant de retour.
   Sans accord : aucune identification (seules les visites anonymes, par onglet, sont comptées).
   Avec accord : un identifiant aléatoire est gardé 13 mois max dans ce navigateur (localStorage,
   aucun cookie) pour compter les retours. Le choix est conservé 6 mois, modifiable à tout moment.
   Injecté en tête de chaque page publique par le Worker (withVideoTracking). */
(function () {
  if (window.__slpConsentLoaded) return; window.__slpConsentLoaded = true;
  var LS;
  try { LS = window.localStorage; LS.getItem('slp_consent'); } catch (e) { return; }
  // Navigateurs de l'admin ou de test : ni bandeau ni identifiant.
  try { if (LS.getItem('slp_admin_token') || LS.getItem('slp_notrack')) return; } catch (e) { return; }

  var KEY = 'slp_consent', VID = 'slp_vid', DAY = 24 * 3600 * 1000;
  var CHOICE_TTL = 182 * DAY, ID_TTL = 390 * DAY;

  function readChoice() {
    try {
      var c = JSON.parse(LS.getItem(KEY) || 'null');
      if (c && (c.v === 'yes' || c.v === 'no') && Date.now() - c.t < CHOICE_TTL) return c.v;
    } catch (e) {}
    return null;
  }
  function randomId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    var a = new Uint8Array(16), s = '';
    try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); }
    for (var j = 0; j < 16; j++) s += (a[j] < 16 ? '0' : '') + a[j].toString(16);
    return s;
  }
  function visitorId() {
    try {
      var o = JSON.parse(LS.getItem(VID) || 'null');
      if (o && o.id && Date.now() - o.t < ID_TTL) return o.id;
    } catch (e) {}
    var id = randomId();
    try { LS.setItem(VID, JSON.stringify({ id: id, t: Date.now() })); } catch (e) {}
    return id;
  }
  function setChoice(v) {
    try {
      LS.setItem(KEY, JSON.stringify({ v: v, t: Date.now() }));
      if (v === 'no') LS.removeItem(VID); else visitorId();
    } catch (e) {}
  }

  // Ajoute l'identifiant aux envois de visite, uniquement si le visiteur a accepté.
  var nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      try {
        var u = typeof input === 'string' ? input : (input && input.url) || '';
        if (u.indexOf('/api/track-visit') > -1 && init && typeof init.body === 'string' && readChoice() === 'yes') {
          var b = JSON.parse(init.body);
          b.visitor_id = visitorId();
          init = Object.assign({}, init, { body: JSON.stringify(b) });
        }
      } catch (e) {}
      return nativeFetch.call(this, input, init);
    };
  }

  var lang = (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2);
  if (['fr', 'en', 'es', 'it'].indexOf(lang) < 0) lang = 'fr';
  var T = {
    fr: { t: "Mesure d'audience", p: "Nous comptons les visites de façon anonyme. Avec votre accord, un identifiant aléatoire gardé 13 mois sur cet appareil nous permet de reconnaître vos retours. Aucun cookie publicitaire, aucun partage avec des tiers.", yes: 'Accepter', no: 'Refuser', more: 'En savoir plus', foot: "Mesure d'audience" },
    en: { t: 'Audience measurement', p: 'We count visits anonymously. With your consent, a random identifier kept for 13 months on this device lets us recognise when you come back. No advertising cookies, nothing shared with third parties.', yes: 'Accept', no: 'Decline', more: 'Learn more', foot: 'Audience measurement' },
    es: { t: 'Medición de audiencia', p: 'Contamos las visitas de forma anónima. Con su consentimiento, un identificador aleatorio guardado 13 meses en este dispositivo nos permite reconocer sus regresos. Sin cookies publicitarias ni datos compartidos con terceros.', yes: 'Aceptar', no: 'Rechazar', more: 'Más información', foot: 'Medición de audiencia' },
    it: { t: 'Misurazione del pubblico', p: 'Contiamo le visite in forma anonima. Con il tuo consenso, un identificativo casuale conservato per 13 mesi su questo dispositivo ci permette di riconoscere i tuoi ritorni. Nessun cookie pubblicitario, nulla condiviso con terzi.', yes: 'Accetta', no: 'Rifiuta', more: 'Scopri di più', foot: 'Misurazione del pubblico' }
  }[lang];
  // Page d'information : data-legal sur la balise <script> (sites sans mentions légales), sinon mentions légales de la langue.
  var cs = document.currentScript, legalAttr = cs && cs.getAttribute('data-legal');
  var legal = legalAttr || ((lang === 'fr' ? '' : '/' + lang) + '/mentions-legales');

  function closeBanner() {
    var b = document.getElementById('slp-consent');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }
  function showBanner() {
    closeBanner();
    var box = document.createElement('div');
    box.id = 'slp-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', T.t);
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;max-width:560px;margin:0 auto;z-index:2147483000;background:#17142A;color:#F7F5F0;border:1px solid rgba(247,245,240,.18);border-radius:14px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    var title = document.createElement('strong');
    title.textContent = T.t;
    title.style.cssText = 'display:block;margin-bottom:4px;font-size:15px';
    var txt = document.createElement('p');
    txt.style.cssText = 'margin:0 0 12px';
    txt.textContent = T.p + ' ';
    var more = document.createElement('a');
    more.href = legal; more.textContent = T.more;
    more.style.cssText = 'color:#FBC608;text-decoration:underline';
    txt.appendChild(more);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px';
    var btnCss = 'flex:1;padding:11px 14px;border-radius:10px;border:1px solid rgba(247,245,240,.35);background:#0C0A14;color:#F7F5F0;font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer';
    function mk(label, v) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.style.cssText = btnCss;
      b.addEventListener('click', function () { setChoice(v); closeBanner(); });
      return b;
    }
    // Mêmes taille, couleur et place pour « Accepter » et « Refuser ».
    row.appendChild(mk(T.no, 'no'));
    row.appendChild(mk(T.yes, 'yes'));
    box.appendChild(title); box.appendChild(txt); box.appendChild(row);
    (document.body || document.documentElement).appendChild(box);
  }

  function addFooterLink() {
    var f = document.querySelector('footer');
    if (!f) { f = document.createElement('div'); f.style.cssText = 'padding:14px 0 18px;text-align:center'; (document.body || document.documentElement).appendChild(f); }
    if (f.querySelector('[data-slp-consent]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('data-slp-consent', '1'); b.textContent = T.foot;
    b.style.cssText = 'display:block;margin:10px auto 0;background:none;border:0;padding:0;color:inherit;opacity:.65;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer';
    b.addEventListener('click', showBanner);
    f.appendChild(b);
  }

  function init() {
    addFooterLink();
    if (readChoice() === null) showBanner();
    else if (readChoice() === 'yes') visitorId();
  }
  window.slpConsent = { open: showBanner };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
