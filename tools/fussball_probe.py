# Looks at the structure of the fussball.de pages (no names printed), to build the importer.
import re, sys, urllib.request, collections
UA = {'User-Agent': 'Mozilla/5.0 (TTSC Buchen team app; info@ttscbuchen.de)'}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
        return r.status, r.read().decode('utf-8', 'replace')
TEAM = 'https://www.fussball.de/mannschaft/ttsc-buchen-ttsc-buchen-baden/-/saison/2627/team-id/011MIDB1EO000000VTVG0001VTR8C1K7'
for name, url in [('team', TEAM), ('squad', 'https://www.fussball.de/mannschaft/-/team-id/011MIDB1EO000000VTVG0001VTR8C1K7/tab/squad/')]:
    st, h = get(url)
    print(f'== {name}: {st}, {len(h)} bytes')
    print('ajax urls:', sorted(set(re.findall(r'https?://www\.fussball\.de/ajax\.[a-z.\-]+[^"\'\s<>]*', h)))[:25])
    print('data-href ajax:', sorted(set(re.findall(r'data-[a-z-]*="(/ajax[^"]+|https://www\.fussball\.de/ajax[^"]+)"', h)))[:25])
    print('obfuscation ids:', len(set(re.findall(r'data-obfuscation="([^"]+)"', h))), '| font urls:', sorted(set(re.findall(r'export\.fontface[^"\')\s]+', h)))[:3])
    cls = collections.Counter(re.findall(r'class="([^"]+)"', h))
    print('classes:', [c for c, _ in cls.most_common(60) if re.search(r'score|table|squad|player|result|match|club|column|row|stat', c)][:40])
    i = h.find('data-obfuscation')
    if i > 0: print('score sample:', re.sub(r'[^\x20-\x7e]', '?', h[i-300:i+200]).replace('\n', ' '))
    for kw in ['fixtures-league-table', 'table-full', 'squad', 'player-wrapper']:
        j = h.find(kw); print(kw, '->', j)
