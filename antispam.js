/* SLP — protection anti-robots des formulaires et du chat.
   - dt() : temps écoulé depuis le chargement de la page (le serveur refuse les envois faits en moins de 3 s).
   - token() : jeton Cloudflare Turnstile. Le widget n'est affiché que si une clé de site est renseignée ci-dessous ;
     il reste invisible tant que Cloudflare n'a pas besoin d'une interaction. Aucun cookie. */
(function () {
  if (window.slpAS) return;
  var SITEKEY = ''; // clé de site Turnstile (publique) — à renseigner une fois le widget créé dans Cloudflare
  var t0 = Date.now(), token = '', wid = null;
  window.slpAS = {
    dt: function () { return Math.max(0, Date.now() - t0); },
    token: function () { return token; },
    reset: function () { token = ''; try { if (wid !== null && window.turnstile) window.turnstile.reset(wid); } catch (e) {} }
  };
  if (!SITEKEY) return;

  function mount() {
    var host = document.createElement('div');
    host.id = 'slp-turnstile';
    var form = document.getElementById('devis-form') || document.getElementById('f');
    if (form) { host.style.cssText = 'margin:10px 0'; form.appendChild(host); }
    else { host.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000'; document.body.appendChild(host); }
    wid = window.turnstile.render(host, {
      sitekey: SITEKEY, appearance: 'interaction-only', language: 'auto',
      callback: function (t) { token = t; },
      'expired-callback': function () { token = ''; },
      'error-callback': function () { token = ''; }
    });
  }
  window.__slpTsReady = function () { if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount); };
  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__slpTsReady';
  s.async = true; s.defer = true;
  document.head.appendChild(s);
})();
