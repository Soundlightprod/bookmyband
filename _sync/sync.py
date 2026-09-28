#!/usr/bin/env python3
"""Synchronise les nouveaux artistes du site SLP vers Book My Band.

Usage : python3 _sync/sync.py <dossier_repo_SLP> [dossier_repo_BMB]

Pour chaque artiste présent sur une page catégorie SLP (groupes de reprises,
tributes, cabaret, jazz soul funk, pop française, DJ) et absent de Book My
Band, le script :
  - génère la fiche <slug>.html à la charte BMB (en-tête, pied de page,
    couleurs, hero photo duotone rose, CTA « Demander un devis », sans e-mail),
  - copie les images utilisées par la fiche,
  - ajoute la carte « pass » sur artistes.html et index.html,
  - met à jour les compteurs de catégories, le JSON-LD et le sitemap.

Les fiches déjà présentes sur BMB ne sont jamais écrasées.
Pour exclure un artiste, ajouter son slug dans _sync/exclude.txt.
"""
import html as H, re, shutil, sys, datetime, pathlib

SLP = pathlib.Path(sys.argv[1]).resolve()
BMB = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parent.parent).resolve()
TEMPLATE = BMB / 'calo-2-0.html'          # fiche BMB servant de gabarit (en-tête, CSS BMB, pied de page)
CATS = {'groupes-de-reprises': 'reprises', 'tributes': 'tributes', 'cabaret': 'cabaret',
        'jazz-soul-funk': 'jazz', 'pop-francaise': 'pop', 'dj': 'dj'}
EXCLUDE = {l.strip() for l in (BMB / '_sync' / 'exclude.txt').read_text(encoding='utf-8').splitlines()
           if l.strip() and not l.startswith('#')} if (BMB / '_sync' / 'exclude.txt').exists() else set()


def read(p): return p.read_text(encoding='utf-8')
def write(p, s): p.write_text(s, encoding='utf-8')
def strip_tags(s): return H.unescape(re.sub(r'<[^>]+>', '', s)).strip()


def block_around(h, pos):
    starts = [m.start() for m in re.finditer(r'<div class="artist(?: reverse)?"', h[:pos])]
    start = starts[-1]
    depth = 0
    for m in re.finditer(r'<div\b|</div>', h[start:]):
        depth += 1 if m.group(0) == '<div' else -1
        if depth == 0:
            return h[start:start + m.end()]
    raise ValueError('bloc non fermé')


def between(h, a, b, start=0):
    i = h.index(a, start); j = h.index(b, i)
    return h[i:j]


# ---------- 1. Artistes SLP ----------
def slp_artists():
    home = read(SLP / 'index.html')
    out = []
    for page, cat in CATS.items():
        f = SLP / f'{page}.html'
        if not f.exists():
            continue
        h = read(f)
        for m in re.finditer(r'href="([a-z0-9\-]+)\.html" class="discover-btn"', h):
            slug = m.group(1)
            card = block_around(h, m.start())
            img = re.search(r'<img src="([^"]+)"', card).group(1)
            label = re.search(r'<span class="label">(.*?)</span>', card)
            name = strip_tags(re.search(r'<h3>(.*?)</h3>', card).group(1))
            desc = strip_tags(re.search(r'<p>(.*?)</p>', card, re.S).group(1))
            hm = re.search(rf'<a class="artist-card" href="{slug}\.html".*?<p>(.*?)</p>', home, re.S)
            short = strip_tags(hm.group(1)) if hm else desc
            out.append(dict(slug=slug, cat=cat, img=img, name=name, short=short, desc=desc,
                            label=strip_tags(label.group(1)) if label else name))
    return out


# ---------- 2. Fiche BMB ----------
def build_page(a):
    src = read(SLP / f"{a['slug']}.html")
    tpl = read(TEMPLATE)
    name = a['name']

    # <head> : balises SEO du gabarit, adaptées
    title = f"{name} — artiste à réserver | Book My Band"
    meta = re.search(r'<meta name="description" content="([^"]*)"', src)
    desc = (meta.group(1) if meta else a['desc']).replace('SLP', 'Book My Band')
    url = f"https://bookmyband.fr/{a['slug']}"
    img_abs = f"https://bookmyband.fr/{a['img']}"
    head_tpl = tpl[:tpl.index('<style>')]
    head_tpl = re.sub(r'<title>.*?</title>', f'<title>{H.escape(title)}</title>', head_tpl)
    head_tpl = re.sub(r'(<meta (?:name|property)="(?:description|og:description)" content=")[^"]*', lambda m: m.group(1) + H.escape(desc, quote=True), head_tpl)
    head_tpl = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + H.escape(title, quote=True), head_tpl)
    head_tpl = re.sub(r'https://bookmyband\.fr/calo-2-0', url, head_tpl)
    head_tpl = head_tpl.replace('https://bookmyband.fr/calo2-0-affiche.jpg', img_abs)
    head_tpl = re.sub(r'<script type="application/ld\+json">.*?</script>', lambda _: '<script type="application/ld+json">' + (
        '{"@context": "https://schema.org", "@graph": [{"@type": "MusicGroup", "name": %s, "description": %s, "url": "%s", "image": "%s"}, '
        '{"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://bookmyband.fr/"}, '
        '{"@type": "ListItem", "position": 2, "name": "Nos artistes", "item": "https://bookmyband.fr/artistes"}, '
        '{"@type": "ListItem", "position": 3, "name": %s, "item": "%s"}]}]}' % (
            json_str(name), json_str(desc), url, img_abs, json_str(name), url)) + '</script>', head_tpl, flags=re.S)

    # CSS : styles de la fiche SLP + surcouche BMB du gabarit
    slp_css = between(src, '<style>', '</style>')[len('<style>'):]
    tpl_css = between(tpl, '<style>', '</style>')
    bmb_css = tpl_css[tpl_css.index('  .page-hero{position:relative; overflow:hidden;}'):]
    style = '<style>' + slp_css + bmb_css + '</style>\n</head>\n<body>\n'

    header = between(tpl, '<header class="bmb-head">', '<section class="page-hero">')

    # Contenu : du hero jusqu'au bandeau CTA, rebrandé
    content = between(src, '<section class="page-hero">', '<section class="cta-band">')
    content = re.sub(r'<div class="hero-art".*?</div>\s*', '', content, count=1, flags=re.S)
    content = content.replace('<div class="page-hero-inner">',
        f'<div class="bmb-hero-img" aria-hidden="true"><img src="{a["img"]}" alt="" style="object-position:center 30%"></div>\n  <div class="page-hero-inner">', 1)
    content = re.sub(r'href="(?:tributes|groupes-de-reprises|cabaret|jazz-soul-funk|pop-francaise|dj)\.html"',
                     f'href="artistes.html#{a["cat"]}"', content)
    content = content.replace('Exclusivité SLP', 'Exclusivité Book My Band')
    content = re.sub(r'<img src="logo\.png"[^>]*>', '', content)
    content = re.sub(r'\bSLP\b', 'Book My Band', content)
    content = re.sub(r'<a [^>]*href="mailto:[^"]*"[^>]*>.*?</a>', '', content, flags=re.S)
    content = re.sub(r'[\w.+-]+@soundlightprod\.fr', '', content)

    cta = between(tpl, '<section class="cta-band">', '<footer class="bmb-foot">')
    cta = cta.replace('Tribute%20Calogero', H.escape(name).replace(' ', '%20')).replace('Tribute Calogero', name)

    footer = between(tpl, '<footer class="bmb-foot">', '</footer>') + '</footer>\n'

    # Scripts de la fiche SLP (actus, galerie…) sauf le suivi de visites SLP
    scripts = [s for s in re.findall(r'<script>.*?</script>', src[src.index('<section class="cta-band">'):], re.S)
               if 'track-visit' not in s]
    track = ('<script>\n(function(){\n  try{ var sid=sessionStorage.getItem(\'bmb_visit_sid\'); if(!sid){ sid=Date.now().toString(36)+Math.random().toString(36).slice(2); sessionStorage.setItem(\'bmb_visit_sid\',sid); } }catch(e){ var sid=null; }\n'
             '  fetch("https://slp-api.raspy-silence-d4c7.workers.dev/api/track-visit",{method:"POST",headers:{"Content-Type":"application/json"},'
             f'body:JSON.stringify({{artist_slug:"{a["slug"]}",session_id:sid,site:"bmb",ref:document.referrer}})}}).catch(function(){{}});\n}})();\n</script>')

    page = head_tpl + style + header + content + cta + footer + '\n'.join(scripts) + '\n' + track + '\n</body>\n</html>\n'
    write(BMB / f"{a['slug']}.html", page)

    # Images locales référencées
    for ref in set(re.findall(r'(?:src|href)="/?([^"/:?#]+\.(?:jpe?g|png|webp|gif|svg|pdf|mp4))"', content + ''.join(scripts))) | {a['img']}:
        s, d = SLP / ref, BMB / ref
        if s.exists() and not d.exists():
            shutil.copy2(s, d)


def json_str(s):
    import json
    return json.dumps(s, ensure_ascii=False)


# ---------- 3. Cartes et index ----------
def pass_card(a):
    return (f'<a class="pass" href="{a["slug"]}.html" data-cat="{a["cat"]}"><div class="ph"><img src="{a["img"]}" alt="{H.escape(a["name"])}" loading="lazy" style="object-position:center 30%"></div>'
            f'<span class="tag">{H.escape(a["label"])}</span><span class="num">00</span><div class="stub"><h3>{H.escape(a["name"])}</h3>'
            f'<p>{H.escape(a["short"])}</p><div class="row"><span class="cta"><b>Voir la fiche</b> <i>→</i></span><span class="bar"></span></div></div></a>')


def add_card(file, a):
    h = read(file)
    if f'href="{a["slug"]}.html" data-cat' in h:
        return
    passes = list(re.finditer(r'[ \t]*<a class="pass"[^\n]*</a>\n', h))
    if not passes:
        return
    same = [m for m in passes if f'data-cat="{a["cat"]}"' in m.group(0)]
    last = (same or passes)[-1]
    indent = re.match(r'[ \t]*', last.group(0)).group(0)
    h = h[:last.end()] + indent + pass_card(a) + '\n' + h[last.end():]
    n = iter(range(1, 999))
    h = re.sub(r'<span class="num">\d+</span>', lambda _: f'<span class="num">{next(n):02d}</span>', h)
    write(file, h)


def update_home(a):
    f = BMB / 'index.html'; h = read(f)
    cnt = len(re.findall(rf'<a class="pass"[^>]*data-cat="{a["cat"]}"', h))
    def fix(m):
        s = m.group(0)
        s = re.sub(r'<span class="cnt">\d+</span>', f'<span class="cnt">{cnt:02d}</span>', s)
        s = re.sub(r'<span class="lbl">\d+ artistes? →</span>', f'<span class="lbl">{cnt} artiste{"s" if cnt > 1 else ""} →</span>', s)
        return s
    h = re.sub(rf'<a class="cat" href="artistes\.html#{a["cat"]}">.*?</a>', fix, h, count=1, flags=re.S)
    if f'bookmyband.fr/{a["slug"]}"' not in h:
        m = re.search(r'("@type": "ItemList".*?"itemListElement": \[)(.*?)(\]\})', h, re.S)
        if m:
            pos = len(re.findall(r'"ListItem"', m.group(2))) + 1
            item = f', {{"@type": "ListItem", "position": {pos}, "url": "https://bookmyband.fr/{a["slug"]}", "name": {json_str(a["name"])}}}'
            h = h[:m.end(2)] + item + h[m.end(2):]
    write(f, h)


def update_sitemap(a):
    f = BMB / 'sitemap.xml'
    if not f.exists():
        return
    h = read(f)
    if f'bookmyband.fr/{a["slug"]}<' in h:
        return
    line = f'  <url><loc>https://bookmyband.fr/{a["slug"]}</loc><lastmod>{datetime.date.today().isoformat()}</lastmod></url>\n'
    write(f, h.replace('</urlset>', line + '</urlset>'))


def main():
    added = []
    for a in slp_artists():
        if a['slug'] in EXCLUDE or (BMB / f"{a['slug']}.html").exists():
            continue
        build_page(a)
        add_card(BMB / 'artistes.html', a)
        add_card(BMB / 'index.html', a)
        update_home(a)
        update_sitemap(a)
        added.append(a['name'])
    print('Ajoutés :', ', '.join(added) if added else 'aucun')


if __name__ == '__main__':
    main()
