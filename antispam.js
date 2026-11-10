/* SLP — protection anti-robots des formulaires et du chat.
   - dt() : temps écoulé depuis le chargement de la page (le serveur refuse les envois faits en moins de 3 s).
   - captcha() : réponse à la question de vérification (petit calcul) affichée dans le formulaire.
   - token() : jeton Cloudflare Turnstile. Le widget n'est affiché que si une clé de site est renseignée ci-dessous ;
     il reste invisible tant que Cloudflare n'a pas besoin d'une interaction. Aucun cookie. */
(function () {
  if (window.slpAS) return;
  var SITEKEY = '0x4AAAAAAF7KJId7PfS600oy'; // clé de site Turnstile (publique)
  var t0 = Date.now(), token = '', wid = null, capId = '', capInput = null, capLabel = null, capQ = '';
  var path = location.pathname, L = (path.match(/^\/(en|es|it)(\/|$)/) || [, 'fr'])[1];
  var TXT = {
    fr: ['Vérification anti-robot : combien font ', ' ? *', 'Réponse (un nombre)'],
    en: ['Anti-spam check: what is ', '? *', 'Answer (a number)'],
    es: ['Verificación anti-robot: ¿cuánto es ', '? *', 'Respuesta (un número)'],
    it: ['Verifica anti-robot: quanto fa ', '? *', 'Risposta (un numero)']
  }[L];

  function loadCaptcha() {
    if (!capLabel) return;
    capId = ''; if (capInput) capInput.value = '';
    fetch('https://soundlightprod.fr/api/captcha', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { capId = j.id; capQ = j.q; capLabel.textContent = TXT[0] + j.q + TXT[1]; } })
      .catch(function () {});
  }
  function mountCaptcha() {
    var form = document.getElementById('devis-form') || document.getElementById('f');
    if (!form || document.getElementById('slp-cq')) return;
    var btn = form.querySelector('button[type="submit"], button:not([type])');
    if (!btn) return;
    var inp = document.createElement('input');
    inp.id = 'slp-cq'; inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off'; inp.maxLength = 3; inp.placeholder = TXT[2]; inp.setAttribute('aria-required', 'true');
    var lab = document.createElement('span'); lab.id = 'slp-cq-label'; lab.textContent = '…';
    var box;
    if (form.classList.contains('form')) { // Book My Band : le libellé enveloppe le champ
      box = document.createElement('label'); box.append(lab, inp);
    } else {
      box = document.createElement('div'); box.className = 'field';
      var l = document.createElement('label'); l.htmlFor = 'slp-cq'; l.append(lab); box.append(l, inp);
    }
    btn.parentNode.insertBefore(box, btn);
    capInput = inp; capLabel = lab;
    loadCaptcha();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountCaptcha); else mountCaptcha();

  window.slpAS = {
    dt: function () { return Math.max(0, Date.now() - t0); },
    token: function () { return token; },
    captcha: function () { return { captcha_id: capId, captcha_answer: capInput ? capInput.value.trim() : '' }; },
    reset: function () { token = ''; try { if (wid !== null && window.turnstile) window.turnstile.reset(wid); } catch (e) {} },
    captchaReset: function () { loadCaptcha(); window.slpAS.reset(); }, // un jeton Turnstile ne sert qu'une fois : on le renouvelle aussi
    captchaFocus: function () { if (capInput) capInput.focus(); }
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
