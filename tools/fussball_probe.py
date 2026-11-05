# How does the fussball.de font map private-use characters? (digits only from the score font)
import re, io, urllib.request
from fontTools.ttLib import TTFont
UA = {'User-Agent': 'Mozilla/5.0 (TTSC Buchen team app; info@ttscbuchen.de)'}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
T = '011MIDB1EO000000VTVG0001VTR8C1K7'
h = get(f'https://www.fussball.de/ajax.team.prev.games/-/mode/PAGE/team-id/{T}').decode()
oid = re.search(r'data-obfuscation="([^"]+)"', h).group(1)
f = TTFont(io.BytesIO(get(f'https://www.fussball.de/export.fontface/-/format/woff/id/{oid}/type/font')))
cmap = f.getBestCmap()
print('glyphs:', len(f.getGlyphOrder()), 'cmap entries:', len(cmap))
print('first entries:', [(hex(k), v) for k, v in list(sorted(cmap.items()))[:15]])
print('tables:', sorted(f.keys()))
if 'post' in f: print('post format:', f['post'].formatType)
used = sorted(set(re.findall(r'&#x([0-9A-F]+);', h)))[:12]
print('used in scores:', [(u, cmap.get(int(u, 16))) for u in used])
