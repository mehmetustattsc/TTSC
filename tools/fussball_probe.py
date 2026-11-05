# Looks at the structure of the fussball.de pages; letters in names are masked, so nobody's name is printed.
import re, urllib.request
UA = {'User-Agent': 'Mozilla/5.0 (TTSC Buchen team app; info@ttscbuchen.de)'}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
        return r.read().decode('utf-8', 'replace')
mask = lambda s: re.sub(r'>([^<]*[A-Za-zÄÖÜäöüß][^<]*)<', lambda m: '>' + re.sub(r'[A-Za-zÄÖÜäöüßÇçĞğİıŞş]', 'x', m.group(1)) + '<', s)
flat = lambda s: re.sub(r'\s+', ' ', re.sub(r'[^\x20-\x7e]', '?', s))
T = '011MIDB1EO000000VTVG0001VTR8C1K7'
for name, url in [
    ('squad', f'https://www.fussball.de/ajax.team.squad/-/mode/PAGE/order-by/1/saison/2627/show-filter/true/team-id/{T}'),
    ('prev', f'https://www.fussball.de/ajax.team.prev.games/-/mode/PAGE/team-id/{T}'),
    ('plan', f'https://www.fussball.de/ajax.team.matchplan/-/mode/PAGE/team-id/{T}'),
    ('team', f'https://www.fussball.de/mannschaft/ttsc-buchen-ttsc-buchen-baden/-/saison/2627/team-id/{T}'),
]:
    h = get(url)
    print(f'== {name}: {len(h)} bytes, rows: {h.count("<tr")}, obfusc: {sorted(set(re.findall(r"data-obfuscation=\"([^\"]+)\"", h)))[:3]}')
    if name == 'team':
        i = h.find('fixtures-league-table'); seg = h[i:i+6000]; j = seg.find('<tbody'); print('TABLE:', flat(mask(seg[j:j+2500])))
        continue
    j = h.find('<tbody'); print('HTML:', flat(mask(h[j:j+3000] if j >= 0 else h[:3000])))
    if name == 'prev':
        k = h.find('data-obfuscation'); print('SCORE:', flat(h[k-200:k+400]))
oid = None
h = get(f'https://www.fussball.de/ajax.team.prev.games/-/mode/PAGE/team-id/{T}')
m = re.search(r'data-obfuscation="([^"]+)"', h)
if m:
    css = get(f'https://www.fussball.de/export.fontface/-/id/{m.group(1)}/type/css'); print('FONT CSS:', flat(css[:600]))
