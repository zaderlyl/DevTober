#!/usr/bin/env python3
"""Fait une VRAIE dérive sur Wikipédia, avec exactement la règle de la page (drift.js), et l'enregistre dans drift-run.json.

    python3 fetch_run.py [article] [dériveurs] [sauts] [langue]     (par défaut : Pizza 4 8 fr)

Pour chaque branche : on liste les pages différentes liées dans le texte de l'article (sans bandeaux de navigation,
références, fichiers ni catégories), on tire un numéro au hasard, on suit ce lien. Au premier saut, chaque branche prend
un lien différent. Une requête à la fois, avec une pause, et un User-Agent qui dit qui on est (règle de Wikimedia).
Seuls des TITRES et des NOMBRES sont enregistrés : aucune image ni aucun texte d'article.
"""
import datetime, json, os, random, re, ssl, sys, time, urllib.parse, urllib.request
from html.parser import HTMLParser

UA = {'User-Agent': 'DevTober-Drift-promo/1.0 (https://zaderlyl.github.io/DevTober)'}
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl.create_default_context()
PAUSE = 0.3
HERE = os.path.dirname(os.path.abspath(__file__))

def api(lang, **p):
    q = urllib.parse.urlencode({'format': 'json', 'formatversion': '2', **p})
    time.sleep(PAUSE)
    return json.load(urllib.request.urlopen(urllib.request.Request(f'https://{lang}.wikipedia.org/w/api.php?{q}', headers=UA), timeout=30, context=CTX))

SKIP_CLASSES = {'navbox', 'reflist', 'references', 'reference', 'mw-editsection', 'hatnote', 'noprint', 'mw-references-wrap'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class Links(HTMLParser):
    """les liens /wiki/… du texte, en ignorant ce qui est dans un bandeau de navigation, une note ou une référence"""
    def __init__(self):
        super().__init__(); self.stack = []; self.skip = 0; self.hrefs = []
    def handle_starttag(self, tag, attrs):
        if tag in VOID: return
        a = dict(attrs); skip = bool(set((a.get('class') or '').split()) & SKIP_CLASSES) or tag in ('style', 'script')
        self.stack.append((tag, skip)); self.skip += skip
        if tag == 'a' and not self.skip and (a.get('href') or '').startswith('/wiki/'): self.hrefs.append(a['href'])
    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                self.skip -= sum(1 for _, s in self.stack[i:] if s); del self.stack[i:]; break

_ns = {}
def namespaces(lang):
    if lang not in _ns:
        j = api(lang, action='query', meta='siteinfo', siprop='namespaces|namespacealiases')
        names = set()
        for i, ns in j['query']['namespaces'].items():
            if int(i) != 0:
                names.update(x for x in (ns.get('name'), ns.get('canonical')) if x)
        names.update(a['alias'] for a in j['query'].get('namespacealiases', []))
        _ns[lang] = re.compile('^(' + '|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True)) + '):', re.I)
    return _ns[lang]

def get_page(title, lang):
    j = api(lang, action='parse', page=title, prop='text', redirects='1', disableeditsection='1', disabletoc='1')
    if 'error' in j: raise LookupError(j['error'].get('code', 'erreur'))
    p = Links(); p.feed(j['parse']['text'])
    own, seen, ns = j['parse']['title'], [], namespaces(lang)
    for h in p.hrefs:
        name = urllib.parse.unquote(h[6:].split('#')[0]).replace('_', ' ')
        if name and not ns.match(name) and name != own and name not in seen: seen.append(name)
    return {'title': own, 'links': seen}

def main():
    start = sys.argv[1] if len(sys.argv) > 1 else 'Pizza'
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    hops = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    lang = sys.argv[4] if len(sys.argv) > 4 else 'fr'
    rnd = random.SystemRandom()   # du vrai hasard, pas une suite connue d'avance
    root = get_page(start, lang)
    print(f"départ : {root['title']} ({len(root['links'])} pages liées)")
    first = rnd.sample(range(len(root['links'])), n)
    branches = []
    for b in range(n):
        cur, steps = root, []
        for i in range(hops):
            nxt = None
            for _ in range(3):
                pick = first[b] if i == 0 else rnd.randrange(len(cur['links']))
                try: nxt = get_page(cur['links'][pick], lang); break
                except LookupError: continue
            if not nxt: print(f'branche {b + 1} : arrêt au saut {i + 1}'); break
            steps.append({'from': cur['title'], 'n': len(cur['links']), 'pick': pick + 1, 'to': nxt['title']})
            cur = nxt
        branches.append({'steps': steps}); print(f"branche {b + 1} : " + ' → '.join([root['title']] + [s['to'] for s in steps]))
    out = {'lang': lang, 'start': root['title'], 'startLinks': len(root['links']), 'drifters': n, 'hops': hops,
           'when': datetime.datetime.now().astimezone().isoformat(timespec='seconds'), 'branches': branches}
    with open(os.path.join(HERE, 'drift-run.json'), 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, indent=1)
    print('enregistré : drift-run.json')

if __name__ == '__main__':
    main()
