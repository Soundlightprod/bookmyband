/* Book My Band — comportements « Live Booking Experience ». Configuration : bmb-config.json */
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s,r){return (r||document).querySelector(s)}
  function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function slugOf(a){var h=(a.getAttribute('href')||'').split('#')[0].split('?')[0].replace(/\.html$/,'').replace(/^\.?\//,''); return h}
  function esc(s){var d=document.createElement('div'); d.textContent=s; return d.innerHTML}
  function contactUrl(name,extra){var q='artiste='+encodeURIComponent(name); if(extra) q+='&'+extra; return 'contact?'+q}

  /* Diaporama du hero */
  var slides=$$('.hero2 .slides img');
  if(slides.length>1 && !reduce){var i=0; setInterval(function(){slides[i].classList.remove('on'); i=(i+1)%slides.length; slides[i].classList.add('on');},6500);}

  fetch('bmb-config.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():{}}).catch(function(){return {}}).then(function(cfg){
    cfg=cfg||{}; var excl=cfg.exclusivites||{};
    /* Badges exclusivité sur les cartes */
    $$('.pass').forEach(function(c){var s=slugOf(c); if(excl[s] && !$('.excl',c)){var b=document.createElement('span'); b.className='excl'; b.textContent=excl[s]; c.appendChild(b);}});
    /* … et sur les fiches */
    var here=location.pathname.replace(/\.html$/,'').split('/').pop(), hi=$('.page-hero-inner');
    if(hi && excl[here] && !$('.excl',hi)){var b=document.createElement('span'); b.className='excl'; b.textContent=excl[here]; hi.insertBefore(b,hi.firstChild);}

    /* Artistes à l'affiche (administrable : bmb-config.json) */
    var fg=$('#featured-grid');
    if(fg){
      var cards={}; $$('.pass').forEach(function(c){cards[slugOf(c)]=c});
      (cfg.a_laffiche||[]).forEach(function(s){
        var c=cards[s]; if(!c) return;
        var name=$('h3',c).textContent, img=$('.ph img',c), tag=$('.tag',c), p=$('.stub p',c), ex=excl[s];
        var el=document.createElement('article');
        el.innerHTML='<div class="fp"><img src="'+esc(img?img.getAttribute('src'):'')+'" alt="'+esc(name)+'" loading="lazy" style="'+(img&&img.getAttribute('style')||'')+'">'+(ex?'<span class="excl">'+esc(ex)+'</span>':'')+'</div>'+
          '<div class="fb"><span class="ft">'+esc(tag?tag.textContent:'')+'</span><h3>'+esc(name)+'</h3><p>'+esc(p?p.textContent:'')+'</p>'+
          '<div class="fa"><a class="btn btn-ghost" href="'+s+'" aria-label="Découvrir '+esc(name)+'">Découvrir</a><a class="btn btn-grad" href="'+contactUrl(name)+'" aria-label="Demander une disponibilité pour '+esc(name)+'">Demander une disponibilité</a></div></div>';
        fg.appendChild(el);
      });
    }

    /* Trouvez votre spectacle */
    var ff=$('#finder');
    if(ff){
      var amb=$('#fi-amb'); var ambs=cfg.ambiances||{};
      Object.keys(ambs).forEach(function(k){if($('.pass[data-cat="'+k+'"]')){var o=document.createElement('option'); o.value=k; o.textContent=ambs[k]; amb.appendChild(o);}});
      ff.addEventListener('submit',function(e){
        e.preventDefault();
        var cat=amb.value, res=$('#finder-res'), sel=$$('.pass').filter(function(c){return !cat || c.getAttribute('data-cat')===cat});
        var qs=[['type',$('#fi-type').value],['jauge',$('#fi-jauge').value],['lieu',$('#fi-lieu').value],['date',$('#fi-date').value],['budget',$('#fi-budget').value]].filter(function(x){return x[1]}).map(function(x){return x[0]+'='+encodeURIComponent(x[1])}).join('&');
        var html='<p class="lead">'+(sel.length? 'Spectacles du catalogue correspondant à l’ambiance choisie :' : 'Aucun spectacle dans cette catégorie pour le moment.')+' Notre équipe affine ensuite la sélection selon votre événement.</p><div class="grid"></div>';
        res.innerHTML=html; var g=$('.grid',res);
        sel.slice(0,6).forEach(function(c){var n=c.cloneNode(true); n.classList.remove('hide','nomatch'); $$('.excl',n).forEach(function(x){x.remove()}); g.appendChild(n);});
        res.innerHTML+='<div class="res-cta"><a class="btn btn-grad" href="contact'+(qs?'?'+qs:'')+'">Demander une proposition</a><a class="btn btn-ghost" href="artistes">Voir tout le catalogue</a></div>';
        res.scrollIntoView({behavior:reduce?'auto':'smooth',block:'nearest'});
      });
    }
  });

  /* Catalogue : recherche + tri (cumulables avec les filtres de catégorie) */
  var q=$('#q'), so=$('#sort'), grid=$('.grid');
  if(q && grid){
    var cs=$$('.pass',grid); cs.forEach(function(c,i){c.__i=i});
    var none=document.createElement('p'); none.className='no-res'; none.hidden=true; none.textContent='Aucun artiste ne correspond à votre recherche.'; grid.parentNode.insertBefore(none,grid.nextSibling);
    function norm(s){return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
    function run(){
      var v=norm(q.value.trim()), n=0;
      cs.forEach(function(c){var ok=!v||norm(c.textContent).indexOf(v)>-1; c.classList.toggle('nomatch',!ok); if(ok&&!c.classList.contains('hide')) n++;});
      none.hidden=n>0;
    }
    function sortNow(){
      var arr=cs.slice(); if(so.value==='az') arr.sort(function(a,b){return $('h3',a).textContent.localeCompare($('h3',b).textContent,'fr')}); else arr.sort(function(a,b){return a.__i-b.__i});
      arr.forEach(function(c){grid.appendChild(c)});
    }
    q.addEventListener('input',run); so.addEventListener('change',sortNow);
    $$('.filters button').forEach(function(b){b.addEventListener('click',function(){setTimeout(run,0)})});
    setTimeout(run,0);
  }

  /* Fiches : teaser vidéo/audio en tête + barre d'action mobile */
  var hero=$('.page-hero');
  if(hero){
    var secs=$$('section'), media=secs.filter(function(s){return s!==hero && ($('iframe',s)||$('audio',s))})[0], bio=$('.bio-wrap'), bioSec=bio&&bio.closest('section');
    if(media && bioSec && media!==bioSec && bioSec.compareDocumentPosition(media)&Node.DOCUMENT_POSITION_FOLLOWING){bioSec.parentNode.insertBefore(media,bioSec);}
    var cta=$('.cta-band a.btn-primary');
    if(cta){
      var bar=document.createElement('div'); bar.className='mbar';
      bar.innerHTML='<a class="p" href="'+cta.getAttribute('href')+'">Demander une disponibilité</a><a href="tel:+33631949653" aria-label="Appeler">Appeler</a>';
      document.body.appendChild(bar); document.body.classList.add('has-mbar');
    }
  }
})();
