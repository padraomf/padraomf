"""Validate generated public metadata before publishing the portfolio."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, unquote, parse_qs
from collections import Counter, deque
from html import unescape
from xml.etree import ElementTree as ET
import json
import hashlib
import re

root = Path(__file__).resolve().parents[1]
data = (root / 'assets/data.js').read_text(encoding='utf-8')
origin = re.search(r'siteUrl:\s*"([^"]*)"', data)[1]
verification = re.search(r'googleSiteVerification:\s*"([^"]*)"', data)[1]
categories = json.loads(re.search(r'const CATEGORIES = (\[.*?\]);', data, re.S)[1])
projects = json.loads(re.search(r'/\* PROJECTS_START \*/\s*(\[.*?\])\s*/\* PROJECTS_END \*/', data, re.S)[1])
pages = ['index.html', 'sobre.html'] + [c['path'] for c in categories] + [p['path'] for p in projects]
assert origin.startswith('https://') and origin.endswith('/'), 'Configure o domínio HTTPS com barra final.'
assert verification, 'Preserve o código de verificação do Search Console.'
assert len(pages) == len(set(pages)), 'Há endereços de página duplicados.'

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.canonicals = []
        self.links = []
        self.images = []
        self.ids = []
        self.h1_count = 0
        self.resources = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'): self.ids.append(attrs['id'])
        if tag == 'h1': self.h1_count += 1
        if tag == 'a': self.links.append(attrs.get('href',''))
        if tag == 'img': self.images.append(attrs)
        if tag == 'script' and attrs.get('src'): self.resources.append(attrs['src'])
        if tag == 'link' and attrs.get('rel')=='stylesheet': self.resources.append(attrs.get('href',''))
        if tag == 'meta':
            key = attrs.get('name') or attrs.get('property')
            self.meta.setdefault(key, []).append(attrs.get('content', ''))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href', ''))

def validate_schema(value, page):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ('@id', 'url', 'logo', 'image', 'item') and isinstance(item, str):
                assert urlparse(item).scheme == 'https' and urlparse(item).netloc, (page, key, item)
            validate_schema(item, page)
    elif isinstance(value, list):
        for item in value:
            validate_schema(item, page)

expected_urls = set()
titles = set()
link_graph = {}
expected_title_count = len(pages)
for page in pages:
    html = (root / page).read_text(encoding='utf-8')
    parsed = Metadata()
    parsed.feed(html)
    url = urljoin(origin, '' if page == 'index.html' else page)
    expected_urls.add(url)
    assert parsed.canonicals == [url], (page, parsed.canonicals)
    assert parsed.meta.get('og:url') == [url], (page, 'og:url')
    assert parsed.meta.get('google-site-verification') == [verification], (page, 'verification')
    assert parsed.meta.get('description', [''])[0].strip(), (page, 'description')
    assert 'noindex' not in parsed.meta.get('robots', [''])[0], (page, 'robots')
    for key in ('og:image', 'twitter:image'):
        assert parsed.meta.get(key), (page, key)
        assert all(urlparse(image).scheme == 'https' and urlparse(image).netloc for image in parsed.meta[key]), (page, key)
    for record in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        validate_schema(json.loads(record), page)
    title = unescape(re.search(r'<title>(.*?)</title>',html,re.S)[1])
    assert title not in titles, (page, 'título repetido', title)
    titles.add(title)
    assert parsed.h1_count == 1, (page,'h1',parsed.h1_count)
    assert len(parsed.ids)==len(set(parsed.ids)), (page,'ids repetidos')
    targets=[]
    for href in parsed.links:
        address=urlparse(href)
        if address.scheme or address.netloc: continue
        path=unquote(address.path)
        target='index.html' if path in ('./','/','index.html') else path if path else page
        assert (root/target).is_file(), (page,'link quebrado',href)
        if address.fragment:
            destination=(root/target).read_text(encoding='utf-8')
            assert re.search(r'id=[\"\']'+re.escape(unquote(address.fragment))+r'[\"\']',destination), (page,'âncora ausente',href)
        if target in pages: targets.append(target)
    link_graph[page]=targets
    for resource in parsed.resources:
        address=urlparse(resource)
        if address.scheme or address.netloc: continue
        source=root/unquote(address.path)
        assert source.is_file(), (page,'recurso ausente',resource)
        expected_version=hashlib.sha256(source.read_text(encoding='utf-8').encode('utf-8')).hexdigest()[:12]
        assert parse_qs(address.query).get('v')==[expected_version], (page,'versão de arquivo incorreta',resource)
    for image in parsed.images:
        assert 'alt' in image, (page,'imagem sem alt')
        address=urlparse(image.get('src',''))
        if address.scheme: continue
        assert (root/unquote(address.path)).is_file(), (page,'imagem ausente',address.path)


sitemap = ET.parse(root / 'sitemap.xml')
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
sitemap_urls = [node.text for node in sitemap.findall('s:url/s:loc', ns)]
assert len(sitemap_urls) == len(expected_urls), 'O sitemap tem páginas extras ou repetidas.'
assert set(sitemap_urls) == expected_urls, 'O sitemap não corresponde às páginas atuais.'
assert not any('/_/view/prefs' in url or '/projeto-' in url for url in sitemap_urls)
robots = (root / 'robots.txt').read_text(encoding='utf-8')
assert f'Sitemap: {origin}sitemap.xml' in robots
assert 'Disallow: /\n' not in robots
print(f'OK: {len(pages)} páginas, endereços absolutos, verificação Google, imagens sociais, JSON-LD e sitemap coerentes.')

# Every public page is reachable through ordinary HTML links, without JavaScript.
visited=set()
queue=deque(['index.html'])
while queue:
    page=queue.popleft()
    if page in visited: continue
    visited.add(page)
    queue.extend(target for target in link_graph[page] if target not in visited)
assert visited==set(pages), ('páginas sem caminho pela página inicial',set(pages)-visited)

# Hosting configuration must match current content and use a real HTTP redirect.
routing=json.loads((root/'vercel.json').read_text(encoding='utf-8'))
redirects=[r for r in routing['routes'] if r.get('status')==301]
for project in projects:
    alias='/projeto-'+project['id']+'.html'
    matches=[r for r in redirects if re.fullmatch(r['src'],alias)]
    assert len(matches)==1 and matches[0]['headers']['Location']==urljoin(origin,project['path']), ('redirecionamento',alias)
assert len(redirects)==len(projects)+1, 'Redirecionamentos fora de sincronia.'
assert any(r.get('status')==404 and r.get('dest')=='/404.html' for r in routing['routes']), 'Preserve a resposta HTTP 404.'
error=Metadata();error.feed((root/'404.html').read_text(encoding='utf-8'))
assert 'noindex' in error.meta.get('robots',[''])[0] and origin+'404.html' not in expected_urls
image_ns={'image':'http://www.google.com/schemas/sitemap-image/1.1'}
assert sitemap.findall('.//image:loc',image_ns), 'Preserve as imagens no sitemap.'
print(f'OK: {len(titles)} títulos únicos; {len(visited)} páginas acessíveis sem JavaScript; {len(redirects)} redirecionamentos HTTP; imagens, links e 404 válidos.')

for private in ['/painel/server.mjs','/scripts/build-pages.py','/ABRIR-PAINEL.bat','/INICIAR-SITE.bat','/INDEXACAO.txt']:
    assert any(r.get('status')==404 and 'src' in r and re.fullmatch(r['src'],private) and not r.get('dest') for r in routing['routes']), ('arquivo interno exposto',private)
print('OK: estilos e scripts versionados por conteúdo; arquivos internos protegidos.')
