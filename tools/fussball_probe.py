# Which logo sizes does fussball.de offer? (club logos, no personal data)
import io, re, urllib.request
from PIL import Image
UA = {'User-Agent': 'Mozilla/5.0 (TTSC Buchen team app; info@ttscbuchen.de)'}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
h = get('https://www.fussball.de/mannschaft/ttsc-buchen-ttsc-buchen-baden/-/saison/2627/team-id/011MIDB1EO000000VTVG0001VTR8C1K7').decode('utf-8', 'replace')
ids = sorted(set(re.findall(r'getLogo/format/\d+/id/([0-9A-Z]+)', h)))
print('logo ids on page:', len(ids))
for fmt in range(0, 6):
    try:
        b = get(f'https://www.fussball.de/export.media/-/action/getLogo/format/{fmt}/id/{ids[0]}')
        im = Image.open(io.BytesIO(b)); print('format', fmt, im.format, im.size, im.mode, len(b), 'bytes')
    except Exception as e: print('format', fmt, 'error', e)
