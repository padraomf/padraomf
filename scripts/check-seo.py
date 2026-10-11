"""Validate generated public metadata before publishing the portfolio."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET
import json
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
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
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
    assert re.search(r'<h1\b', html), (page, 'h1')

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
