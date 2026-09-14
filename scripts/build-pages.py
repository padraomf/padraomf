"""Generate static service and project pages, including crawler-readable sharing metadata."""
from pathlib import Path
from html import escape
from urllib.parse import urlencode, urljoin
import json
import argparse
import re
from xml.etree import ElementTree as ET
from urllib.parse import urlparse
from PIL import Image

root = Path(__file__).resolve().parents[1]
dist = root if (root / 'assets/data.js').is_file() else root / 'dist'
data = (dist / 'assets/data.js').read_text()
categories = json.loads(re.search(r'const CATEGORIES = (\[.*?\]);', data, re.S)[1])
projects = json.loads(re.search(r'const PROJECTS = (\[.*?\]);', data, re.S)[1])
assets = json.loads(re.search(r'/\* ASSETS_START \*/\s*(\{.*?\})', data, re.S)[1])
parser = argparse.ArgumentParser()
parser.add_argument('--site-url', default=None, help='Public domain for sharing metadata')
args = parser.parse_args()
origin = args.site_url if args.site_url is not None else re.search(r'siteUrl:\s*"([^"]*)"', data)[1]
if origin and (urlparse(origin).scheme not in ('https','http') or not urlparse(origin).netloc):
    parser.error('--site-url precisa ser um endereço público completo')
if origin and not origin.endswith('/'):
    origin += '/'
software = json.loads((dist / 'assets/software/catalog.json').read_text())
arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>'
instagram = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>'
youtube = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/></svg>'
logo = '<img data-logo src="assets/logo-oficial.png" alt="Padrão MF" width="234" height="88">'
project_path = lambda p: p['path']
category_for = lambda p: next(c for c in categories if c['id'] == p['category'])
image_for = lambda p: p.get('image') or assets[p['asset']]

def whatsapp(category=None, project=None):
    if project:
        message = f'Olá! Gostaria de um projeto de {category_for(project)["label"]} como “{project["title"]}”.' + (f'\nReferência: {urljoin(origin, project_path(project))}' if origin else '')
    elif category:
        message = f'Olá! Gostaria de conversar sobre {category["label"]}.' + (f'\nReferência: {urljoin(origin, category["path"])}' if origin else '')
    else:
        message = 'Olá! Vi o portfólio da Padrão MF e gostaria de conversar sobre um projeto.'
    url = 'https://wa.me/5574999204407?' + urlencode({'text':message})
    return f'href="{escape(url, quote=True)}" data-whatsapp target="_blank" rel="noopener noreferrer"'

# Preserve the original artwork; encode JPEG copies for sharing-client compatibility.
(dist / 'assets/share').mkdir(exist_ok=True)
share_images = {}
for p in projects:
    if image_for(p).startswith('https://'):
        share_images[p['id']] = (image_for(p), 480, 360)
        continue
    source = dist / image_for(p)
    path = f'assets/share/{p["id"]}.jpg'
    with Image.open(source) as im:
        im.convert('RGB').save(dist / path, quality=90, optimize=True)
        share_images[p['id']] = (path, im.width, im.height)

def metadata(title, description, path, records):
    url = urljoin(origin,'' if path=='index.html' else path)
    e = lambda value: escape(str(value), quote=True)
    tags = [f'<link rel="canonical" href="{e(url)}">',
            '<meta property="og:type" content="website">',
            '<meta property="og:locale" content="pt_BR">',
            '<meta property="og:site_name" content="Padrão MF">',
            f'<meta property="og:title" content="{e(title)}">',
            f'<meta property="og:description" content="{e(description)}">',
            f'<meta property="og:url" content="{e(url)}">',
            f'<meta name="twitter:card" content="{"summary_large_image" if records else "summary"}">',
            f'<meta name="twitter:title" content="{e(title)}">',
            f'<meta name="twitter:description" content="{e(description)}">']
    for i,p in enumerate(records):
        image,w,h = share_images[p['id']]
        image_url=urljoin(origin,image)
        tags += [f'<meta property="og:image" content="{e(image_url)}">',
                 '<meta property="og:image:type" content="image/jpeg">',
                 f'<meta property="og:image:width" content="{w}">',
                 f'<meta property="og:image:height" content="{h}">',
                 f'<meta property="og:image:alt" content="{e(p["title"])}">']
        if i==0:
            tags += [f'<meta name="twitter:image" content="{e(image_url)}">',
                     f'<meta name="twitter:image:alt" content="{e(p["title"])}">']
    return '\n  '.join(tags)

share_icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8"/></svg>'
def share_button(project=None,category=None):
    record=project or category
    attr='data-share-project' if project else 'data-share-service'
    return f'<button type="button" class="share-button" {attr}="{record["id"]}" aria-label="Compartilhar {escape(record.get("title") or record["name"],quote=True)}">{share_icon}<span>Compartilhar</span></button>'

def service_links(current=''):
    return ''.join(f'<a href="{c["path"]}"'+(' aria-current="page"' if c['id']==current else '')+f'>{escape(c["name"])}</a>' for c in categories)

def card_markup(p,eager=False):
    video=bool(p.get('video'))
    art=f'<span class="card-art"><img src="{image_for(p)}" alt="" width="600" height="800" loading="{"eager" if eager else "lazy"}" decoding="async"><span class="card-open">'+('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 10 7-10 7Z" fill="currentColor"/></svg>' if video else arrow)+'</span>'
    label=f'<span class="card-label">{escape(p["title"])}</span>'
    art+=('</span>'+label if p['category']=='design' else label+'</span>')
    return f'<a class="card {"video-card" if video else "static-card"}{" youtube-card" if p.get("youtubeId") else ""}" href="{p["path"]}" data-project="{p["id"]}" aria-label="Abrir projeto: {escape(p["title"],quote=True)}">{art}<span class="card-meta">{escape(p["type"])}</span></a>'

def shelf_markup(c,index):
    cards=''.join(card_markup(p) for p in projects if p['category']==c['id'])
    more=f'<a class="card more-card {"video-card" if c["shape"]=="portrait" else ""}" href="{c["path"]}" aria-label="Ver todos os projetos de {escape(c["name"],quote=True)}"><span class="card-art"><span class="more-arrow">{arrow}</span><strong>Veja mais</strong><small>{escape(c["name"])}</small></span></a>'
    controls=''.join(f'<button type="button" class="shelf-control {side}" aria-label="{label} de {escape(c["name"],quote=True)}" aria-controls="track-{c["id"]}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="{path}"/></svg></button>' for side,label,path in [('prev','Projetos anteriores','m15 6-6 6 6 6'),('next','Próximos projetos','m9 6 6 6-6 6')])
    html=f'<section class="shelf {c["shape"]}" id="{c["id"]}" aria-labelledby="title-{c["id"]}"><div class="shelf-heading"><div class="section-name"><span class="category-index">{index:02d}</span><h2 id="title-{c["id"]}">{escape(c["name"])}</h2></div><div class="shelf-heading-actions">{share_button(category=c)}<a class="view-all" href="{c["path"]}">Ver mais {arrow}</a></div></div><div class="shelf-body"><div class="track" id="track-{c["id"]}" role="group" aria-label="{escape(c["name"],quote=True)}">{cards}{more}</div>{controls}</div></section>'
    if c['id']=='design':
        html+='''<section class="ideas-banner" aria-labelledby="ideas-title">
          <h2 id="ideas-title"><span>Ideias que</span> <span>ganham vida.</span></h2>
          <p><span>Design, vídeo, motion</span> <span>e IA para colocar sua</span> <span>marca em outro padrão.</span></p>
        </section>'''
    return html

def structured_data(title,description,path,category,project,about):
    # Unknown addresses, awards, ratings and publication dates are deliberately omitted.
    url=urljoin(origin,'' if path=='index.html' else path)
    org_id=urljoin(origin,'#organizacao');site_id=urljoin(origin,'#site')
    org={'@type':'Organization','@id':org_id,'name':'Padrão MF','url':urljoin(origin,''),'logo':urljoin(origin,'assets/logo-oficial.png'),'description':'Design gráfico e produção audiovisual, com mais de 10 anos de experiência.','telephone':'+55-74-99920-4407','sameAs':['https://www.instagram.com/padraomf/','https://www.youtube.com/@Padr%C3%A3oMF']}
    webpage={'@type':'AboutPage' if about else 'CollectionPage' if category and not project else 'WebPage','@id':url+'#pagina','url':url,'name':title,'description':description,'inLanguage':'pt-BR','isPartOf':{'@id':site_id},'about':{'@id':org_id}}
    graph=[org,{'@type':'WebSite','@id':site_id,'url':urljoin(origin,''),'name':'Padrão MF','inLanguage':'pt-BR','publisher':{'@id':org_id}},webpage]
    crumbs=[{'@type':'ListItem','position':1,'name':'Padrão MF','item':urljoin(origin,'')}]
    if category:
        crumbs.append({'@type':'ListItem','position':2,'name':category['name'],'item':urljoin(origin,category['path'])})
        if not project:
            service={'@type':'Service','@id':url+'#servico','name':category['name'],'serviceType':category['label'],'description':description,'provider':{'@id':org_id},'url':url}
            graph.append(service);webpage['mainEntity']={'@id':service['@id']}
    if project:
        crumbs.append({'@type':'ListItem','position':3,'name':project['title'],'item':url})
        graph.append({'@type':'CreativeWork','@id':url+'#trabalho','name':project['title'],'description':description,'url':url,'image':urljoin(origin,image_for(project)),'creator':{'@id':org_id},'inLanguage':'pt-BR'})
        webpage['mainEntity']={'@id':url+'#trabalho'}
    elif about:crumbs.append({'@type':'ListItem','position':2,'name':'Sobre','item':url})
    if len(crumbs)>1:graph.append({'@type':'BreadcrumbList','itemListElement':crumbs})
    return '<script type="application/ld+json">'+json.dumps({'@context':'https://schema.org','@graph':graph},ensure_ascii=False).replace('<','\\u003c')+'</script>'

def software_strip():
    items = ''.join(f'<div class="software-item {item["slug"]}"><img src="{item["path"]}" alt="" width="44" height="44" loading="lazy"><span>{escape(item["name"])}</span></div>' for item in software)
    return f'<section class="software-section" aria-labelledby="software-title"><div class="software-heading"><h2 id="software-title">Softwares que dominamos</h2><button id="software-toggle" class="carousel-toggle" aria-controls="software-track" aria-pressed="false">Pausar</button></div><div class="software-window"><div id="software-track" class="software-track"><div class="software-group">{items}</div><div class="software-group" aria-hidden="true">{items}</div></div></div></section>'

def youtube_markup(p, hover=False):
    embed='https://www.youtube-nocookie.com/embed/'+p['youtubeId']+'?enablejsapi=1&autoplay=0&mute=1&playsinline=1&rel=0&hl=pt-BR&controls=1'
    if origin:embed+='&origin='+urlencode({'x':origin.rstrip('/')})[2:]
    return f'<div class="youtube-shell" data-youtube="{p["youtubeId"]}" data-title="{escape(p["title"],quote=True)}" data-hover="{str(hover).lower()}"><iframe src="{escape(embed,quote=True)}" title="{escape(p["title"],quote=True)}" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>'

def page(main, service='', project=None, about=False):
    category = next((c for c in categories if c['id'] == service), None)
    title = f'{project["title"]} — Padrão MF' if project else f'{category["name"]} — Padrão MF' if category else 'Padrão MF — Sua ideia, nosso Padrão'
    description = project['description'] if project else category['description'] if category else 'Design, motion, inteligência artificial, audiovisual, drone e pocket video. Conheça os trabalhos da Padrão MF.'
    path = project_path(project) if project else category['path'] if category else 'index.html'
    if about:
        title='Sobre a Padrão MF'
        description='Conheça a Padrão MF: mais de 10 anos de experiência em design gráfico, produção audiovisual e soluções visuais criativas.'
        path='sobre.html'
    records = [project] if project else [p for p in projects if p['category']==service][:3] if category else []
    contact = whatsapp(category, project)
    return f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#020303">
  <meta name="description" content="{escape(description, quote=True)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>{escape(title)}</title>
  {metadata(title, description, path, records)}
  {structured_data(title, description, path, category, project, about)}
  <link rel="icon" href="assets/favicon-mf.svg?v=8.4" type="image/svg+xml">
  <link rel="alternate icon" href="favicon.ico?v=8.4" sizes="16x16 32x32 48x48">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v=8.4">
  <link rel="preload" href="assets/fonts/new-science-regular-extended.woff" as="font" type="font/woff" crossorigin>
  <link rel="stylesheet" href="assets/vendor/lenis-1.3.26.css">
  <link rel="stylesheet" href="assets/site.css?v=8.4">
  <link rel="stylesheet" href="assets/scroll-effects.css?v=8.4">
  <link rel="stylesheet" href="assets/reel-player.css?v=8.4">
  <link rel="stylesheet" href="assets/typography.css?v=8.4">
  <script src="assets/data.js?v=8.4" defer></script>
  <script src="assets/media-touch.js?v=8.4" defer></script>
  <script src="assets/youtube-player.js?v=8.4" defer></script>
  <script src="assets/app.js?v=8.4" defer></script>
  <script src="assets/vendor/lenis-1.3.26.min.js" defer></script>
  <script src="assets/scroll-effects.js?v=8.4" defer></script>
  <script src="assets/reel-player.js?v=8.4" defer></script>
  <script src="assets/share.js?v=8.4" defer></script>
</head>
<body id="inicio" data-service="{service}" data-project="{project['id'] if project else ''}" data-page="{'sobre' if about else ''}">
  <a href="#portfolio" class="skip">Pular para os projetos</a>
  <header class="header">
    <button class="menu-button" id="open-menu" aria-label="Abrir menu de serviços" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M3 12h18M3 19h18"/></svg><span>Portfólio</span></button>
    <a class="logo" href="index.html" aria-label="Padrão MF — início">{logo}</a>
    <div class="header-right"><span class="tagline">Sua ideia.<br>Nosso padrão.</span><a class="contact-button" {contact} aria-label="Conversar com a Padrão MF no WhatsApp"><span>WhatsApp</span>{arrow}</a></div>
  </header>
  {main}
  {software_strip()}
  <footer class="footer">
    <div class="footer-main"><a class="logo" href="index.html" aria-label="Padrão MF — início">{logo}</a><span class="footer-tagline">Sua ideia. Nosso padrão.</span><div class="footer-links"><a id="instagram-footer" href="https://www.instagram.com/padraomf/" target="_blank" rel="noopener noreferrer">{instagram}<span>Instagram</span></a><a id="youtube-footer" href="https://www.youtube.com/@Padr%C3%A3oMF" target="_blank" rel="noopener noreferrer" title="Canal oficial da Padrão MF">{youtube}<span>YouTube</span></a><a {contact}>WhatsApp ↗</a></div></div>
    <div class="footer-bottom"><span>© <span id="year">2026</span> Padrão MF · Design, audiovisual e criatividade em um só padrão.</span><a class="back-top" href="#inicio">Voltar ao topo {arrow}</a></div>
  </footer>
  <dialog class="nav-dialog" id="menu-dialog" aria-label="Menu de serviços"><button class="dialog-close" data-close aria-label="Fechar menu">✕</button><div class="menu-scroll"><div class="menu-content"><div class="menu-brand"><a class="logo" href="index.html">{logo}</a><div class="eyebrow">Explore a Padrão MF</div></div><nav id="category-nav" aria-label="Navegação"><a href="index.html">Início <span>00</span></a><a href="sobre.html" id="about-nav">Sobre</a>{service_links(service)}</nav><a class="contact-button" {contact}>Vamos criar juntos ↗</a></div></div></dialog>
  <dialog class="project-dialog" id="project-dialog" data-format="portrait" aria-labelledby="project-title">
    <div class="reel-stage">
      <div class="project-media" id="project-media"></div>
      <div class="reel-toolbar">
        <button type="button" class="dialog-close" data-close autofocus aria-label="Fechar projeto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        <div class="project-pagination"><button type="button" class="icon-button" id="previous-project" aria-label="Projeto anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><button type="button" class="icon-button" id="next-project" aria-label="Próximo projeto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button></div>
        <button type="button" id="player-mini" aria-label="Minimizar vídeo" title="Mini player"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 12h7v6h-7z"/></svg></button>
      </div>
      <div class="project-info" data-expanded="false">
        <span class="project-tag" id="project-category"></span>
        <h2 id="project-title"></h2><span class="sample" id="project-sample" hidden>Projeto demonstrativo</span>
        <div class="reel-description" id="project-caption" tabindex="0"><p id="project-description"></p><a id="project-permalink" class="work-detail" hidden>Abrir página do projeto ↗</a></div>
        <button type="button" class="reel-more" id="description-toggle" aria-expanded="false" aria-controls="project-caption">mais</button>
      </div>
      <div class="reel-side-actions" aria-label="Contato e compartilhamento">
        <a id="project-whatsapp" class="reel-action" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Conversar no WhatsApp sobre este trabalho"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a9 9 0 0 1-13.3 7.9L3 21l1.5-4.2a9 9 0 1 1 16-5.3Z"/><path d="M8 7.5c-.8 1.1-.5 3.3 1.4 5.2s4.1 2.2 5.2 1.4l.8-1.4-2.1-1-1 1c-1.3-.5-2.3-1.5-2.8-2.8l1-1-1-2.1Z"/></svg><span class="sr-only">WhatsApp</span></a>
        <button type="button" id="project-share" class="reel-action" title="Compartilhar" aria-label="Compartilhar este trabalho">{share_icon}<span class="sr-only">Compartilhar</span></button>
      </div>
    </div>
  </dialog>
  <aside id="share-feedback" class="share-feedback" hidden><button type="button" aria-label="Fechar aviso">✕</button><p role="status" aria-live="polite"></p><label hidden>Copie o link<input type="url" readonly aria-label="Link para compartilhar"></label></aside>
</body>
</html>
'''

home = '''<main>
    <section class="showcase" id="showcase" aria-labelledby="showcase-title">
      <div class="showcase-window">
        <div class="showcase-track" id="showcase-track" aria-hidden="true"></div>
        <div class="showcase-title-layer"><h1 class="showcase-caption" id="showcase-title"><span class="title-intro">Sua ideia.</span> <strong class="title-main">Nosso Padrão</strong></h1></div>
      </div>
      <div class="showcase-bottom"><button class="carousel-toggle" id="carousel-toggle" aria-controls="showcase-track" aria-pressed="false" aria-label="Pausar apresentação dos trabalhos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><span>Pausar</span></button></div>
    </section>
    <div class="catalog" id="portfolio" aria-label="Portfólio por serviço"><div id="shelves"></div></div>
    <noscript>Abra um trabalho para assistir ao vídeo completo. <a href="https://wa.me/5574999204407">Fale conosco no WhatsApp.</a></noscript>
  </main>'''
home=home.replace('<div id="shelves"></div>','<div id="shelves">'+''.join(shelf_markup(c,i) for i,c in enumerate(categories,1))+'</div>')
(dist / 'index.html').write_text(page(home))
for index, category in enumerate(categories, 1):
    count = sum(p['category'] == category['id'] for p in projects)
    contact = whatsapp(category)
    grid_content=''.join(f'<article class="work-item">{card_markup(work,i<2)}<p class="work-description">{escape(work["description"])}</p><div class="work-actions"><a class="work-detail" data-open-project="{work["id"]}" href="{work["path"]}">Ver projeto</a><a class="work-whatsapp" {whatsapp(project=work)} data-contact-project="{work["id"]}">WhatsApp ↗</a>{share_button(project=work)}</div></article>' for i,work in enumerate(p for p in projects if p['category']==category['id']))
    if category['id']=='audiovisual':
        grid_content=''
        for work in [p for p in projects if p['category']=='audiovisual']:
            grid_content += f'<article class="work-item audiovisual-item">{youtube_markup(work,True)}<h2 class="work-title">{escape(work["title"])}</h2><span class="detail-type">{escape(work["type"])}</span><p class="work-description">{escape(work["description"])}</p><div class="work-actions"><a class="work-detail" data-open-project="{work["id"]}" href="{project_path(work)}">Ver projeto</a><a class="work-whatsapp" {whatsapp(project=work)} data-contact-project="{work["id"]}">WhatsApp ↗</a>{share_button(project=work)}</div></article>'
    main = f'''<main id="portfolio">
    <section class="service-heading" aria-labelledby="service-title">
      <a class="breadcrumb" href="index.html"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18"/></svg>Voltar ao portfólio</a>
      <div class="eyebrow">Serviço {index:02d} · Padrão MF</div>
      <h1 id="service-title">{escape(category['name'])}</h1>
      <p>{escape(category['description'])}</p>
      <div class="service-summary"><span class="service-count"><strong>{count:02d}</strong> trabalhos</span><a class="button button-green" {contact}>Vamos criar seu projeto {arrow}</a>{share_button(category=category)}</div>
    </section>
    <nav class="service-nav" id="service-nav" aria-label="Outros serviços">{service_links(category['id'])}</nav>
    <section class="service-grid {category['shape']}" id="service-grid" aria-label="Todos os trabalhos de {escape(category['name'], quote=True)}">{grid_content}</section>
    <noscript>Abra um trabalho para ver todos os detalhes. <a href="https://wa.me/5574999204407">Fale conosco no WhatsApp.</a></noscript>
  </main>'''
    (dist / category['path']).write_text(page(main, category['id']))

for p in projects:
    category=category_for(p)
    if p.get('youtubeId'):
        media=youtube_markup(p)
    elif p.get('video'):
        media=f'<video src="{p["video"]}" poster="{image_for(p)}" controls playsinline preload="none" aria-label="{escape(p["title"],quote=True)}"></video>'
    else:
        media=f'<img src="{image_for(p)}" alt="{escape(p["title"],quote=True)}">'
    main=f'''<main id="portfolio" class="detail-page">
      <a class="breadcrumb" href="{category['path']}">← Voltar para {escape(category['name'])}</a>
      <article class="detail-layout">
        <div class="project-media detail-media">{media}</div>
        <div class="detail-info"><div class="eyebrow">{escape(category['label'])}</div><h1>{escape(p['title'])}</h1><span class="detail-type">{escape(p['type'])}</span><p>{escape(p['description'])}</p><div class="detail-actions"><a class="button button-green" {whatsapp(project=p)}>Quero um projeto assim · WhatsApp {arrow}</a>{share_button(project=p)}</div><a class="work-detail" href="{category['path']}">Ver mais trabalhos deste serviço</a></div>
      </article>
      <nav class="service-nav" id="service-nav" aria-label="Outros serviços">{service_links(category['id'])}</nav>
    </main>'''
    (dist / project_path(p)).write_text(page(main, category['id'], p))
about_main='''<main id="portfolio" class="about-page"><a class="breadcrumb" href="index.html">← Voltar ao portfólio</a><section class="about-intro"><div class="eyebrow">Design + Audiovisual</div><h1>Sobre a<br><strong>Padrão MF.</strong></h1><span class="about-experience">Mais de 10 anos transformando ideias.</span></section><div class="about-copy"><p>A Padrão MF é uma empresa especializada em design gráfico e produção audiovisual, com mais de 10 anos de experiência no mercado. Trabalhamos com criação de artes, motion design, edição de vídeos, inteligência artificial e soluções visuais para empresas, marcas, artistas e eventos.</p><p>Realizamos gravação e produção de vídeos promocionais, vídeos institucionais e corporativos, cobertura audiovisual de eventos, produção de EPs visuais e conteúdos para redes sociais. Também desenvolvemos projetos criativos utilizando inteligência artificial para potencializar a qualidade, inovação e impacto de cada produção.</p><p>Na Padrão MF, transformamos ideias em conteúdos visuais profissionais, criativos e estratégicos, ajudando marcas, empresas e artistas a se destacarem através do design e do audiovisual.</p></div><a class="button button-green" ''' + whatsapp() + '''>Vamos conversar sobre seu projeto ↗</a></main>'''
(dist / 'sobre.html').write_text(page(about_main,about=True))
# Preserve previously issued addresses while linking new pages by their subjects.
for p in projects:
    old=dist / ('projeto-'+p['id']+'.html')
    old.write_text(f'<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url={p["path"]}"><title>{escape(p["title"])}</title></head><body><a href="{p["path"]}">Abrir {escape(p["title"])}</a></body></html>')
print(f'Generated home, About, {len(categories)} service pages and {len(projects)} project pages with individual sharing metadata.')

# Only real public origins belong in XML sitemaps. Rebuild after changing domains.
robots='User-agent: *\nAllow: /\n'
if origin:
    ns='http://www.sitemaps.org/schemas/sitemap/0.9';vn='http://www.google.com/schemas/sitemap-video/1.1'
    ET.register_namespace('',ns);ET.register_namespace('video',vn)
    tree=ET.Element('{'+ns+'}urlset')
    paths=['index.html','sobre.html']+[c['path'] for c in categories]+[p['path'] for p in projects]
    for path in paths:
        node=ET.SubElement(tree,'{'+ns+'}url');ET.SubElement(node,'{'+ns+'}loc').text=urljoin(origin,'' if path=='index.html' else path)
        work=next((p for p in projects if p['path']==path),None)
        if work and work.get('video'):
            video=ET.SubElement(node,'{'+vn+'}video')
            for key,value in [('thumbnail_loc',urljoin(origin,share_images[work['id']][0])),('title',work['title']),('description',work['description'])]:ET.SubElement(video,'{'+vn+'}'+key).text=value
            if work.get('youtubeId'):ET.SubElement(video,'{'+vn+'}player_loc').text='https://www.youtube.com/embed/'+work['youtubeId']
            else:ET.SubElement(video,'{'+vn+'}content_loc').text=urljoin(origin,work['video'])
    ET.ElementTree(tree).write(dist/'sitemap.xml',encoding='utf-8',xml_declaration=True)
    robots+='\nSitemap: '+urljoin(origin,'sitemap.xml')+'\n'
else:
    (dist/'sitemap.xml').unlink(missing_ok=True)
(dist/'robots.txt').write_text(robots)
