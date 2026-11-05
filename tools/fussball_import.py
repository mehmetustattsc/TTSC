"""Reads TTSC Buchen's pages on fussball.de and stores them in the Supabase database.

- league table   -> app_config 'league' (JSON, same shape as data/league.json)
- matches        -> public.events (results, new matches, changed dates/times; matched by fussball.de id)
- squad stats    -> public.season_stats (name, appearances, minutes, goals)

fussball.de hides scores and player names behind a per-request web font: each character is a
private-use code point, and the font maps it to a glyph whose name is the real character
("zero", "seven", "a", "Odieresis", ...). We read the font's cmap and turn glyph names back into text.

Needs SUPABASE_TOKEN (Management API). Prints counts only, never names.
Run with --dry to parse everything and print the counts without writing.
"""
import html, io, json, os, re, sys, urllib.request
from datetime import date
from fontTools.ttLib import TTFont
from fontTools import agl

TEAM_ID = '011MIDB1EO000000VTVG0001VTR8C1K7'
SEASON, SEASON_KEY = '2026/27', '2627'
TEAM_URL = f'https://www.fussball.de/mannschaft/ttsc-buchen-ttsc-buchen-baden/-/saison/{SEASON_KEY}/team-id/{TEAM_ID}'
SQUAD_URL = f'https://www.fussball.de/ajax.team.squad/-/mode/PAGE/order-by/1/saison/{SEASON_KEY}/show-filter/true/team-id/{TEAM_ID}'
GAMES_URLS = [f'https://www.fussball.de/ajax.team.prev.games/-/mode/PAGE/team-id/{TEAM_ID}',
              f'https://www.fussball.de/ajax.team.matchplan/-/mode/PAGE/team-id/{TEAM_ID}']
SQUAD_PAGE = f'https://www.fussball.de/mannschaft/-/team-id/{TEAM_ID}/tab/squad/'
US = 'TTSC Buchen'
UA = {'User-Agent': 'Mozilla/5.0 (TTSC Buchen team app; info@ttscbuchen.de)'}
PROJECT = os.environ.get('PROJECT_REF', 'cmzukfpfzgugjatawwwj')
DRY = '--dry' in sys.argv


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


_fonts = {}
def font_map(oid):
    """private-use code point -> real character, for one obfuscation id"""
    if oid not in _fonts:
        f = TTFont(io.BytesIO(get(f'https://www.fussball.de/export.fontface/-/format/woff/id/{oid}/type/font')))
        _fonts[oid] = {cp: (agl.toUnicode(name) if name != 'space' else ' ') for cp, name in f.getBestCmap().items()}
    return _fonts[oid]


def decode(span_html, oid):
    text = html.unescape(re.sub(r'<[^>]+>', '', span_html))
    m = font_map(oid) if oid else {}
    return re.sub(r'\s+', ' ', ''.join(m.get(ord(c), c) for c in text)).strip()


def clean(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s)).replace('\u200b', '')).strip()


# ---------- league table ----------
def league():
    h = get(TEAM_URL).decode('utf-8', 'replace')
    i = h.find('fixtures-league-table')
    body = h[i:h.find('</tbody>', i)]
    rows = []
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', body, re.S):
        rank = re.search(r'column-rank">\s*(\d+)\.', tr)
        team = re.search(r'<img[^>]+alt="([^"]+)"', tr) or re.search(r'club-name">(.*?)</div>', tr, re.S)
        tds = [clean(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
        if not (rank and team): continue
        nums = [t for t in tds if re.fullmatch(r'-?\d+|\d+ : \d+', t)]
        # games, won, drawn, lost, goals, diff, points
        if len(nums) < 7: continue
        games, w, d, l, goals, _diff, pts = nums[-7:]
        rows.append([int(rank.group(1)), clean(html.unescape(team.group(1))), int(games), int(w), int(d), int(l), goals.replace(' : ', ':'), int(pts)])
    league_name = 'Kreisklasse A Buchen ' + SEASON
    return {'league': league_name, 'source': TEAM_URL, 'asOf': date.today().isoformat(), 'us': US, 'rows': rows}


# ---------- matches ----------
def games():
    out = {}
    for url in GAMES_URLS:
        h = get(url).decode('utf-8', 'replace')
        # every match = a "row-competition" row (date, competition) followed by the teams/score row
        for comp, row in re.findall(r'<tr class="[^"]*row-competition[^"]*">(.*?)</tr>\s*<tr[^>]*>(.*?)</tr>', h, re.S):
            d = re.search(r'(\d\d)\.(\d\d)\.(\d\d)', comp); t = re.search(r'(\d\d:\d\d)', clean(comp))
            mid = re.search(r'/spiel/(\w+)"', row)
            teams = re.findall(r'class="column-club[^"]*">.*?data-alt="([^"]+)"', row, re.S)
            if not (d and mid and len(teams) == 2): continue
            comp_name = clean(re.search(r'column-team">(.*?)</td>', comp, re.S).group(1)) if 'column-team' in comp else ''
            scores = [decode(s, o) for o, s in re.findall(r'data-obfuscation="([^"]+)" class="score-(?:left|right)">(.*?)</span>(?=<span class="colon"|</a>|<span class="icon)', row, re.S)]
            if len(scores) < 2:
                scores = [decode(s, o) for o, s in re.findall(r'data-obfuscation="([^"]+)"[^>]*class="score-(?:left|right)"[^>]*>(.*?)</span>', row, re.S)]
            home, away = html.unescape(teams[0]), html.unescape(teams[1])
            if US not in (home, away): continue
            is_home = home == US
            res = None
            if len(scores) >= 2 and all(re.fullmatch(r'\d+', x) for x in scores[:2]):
                l, r = int(scores[0]), int(scores[1])
                res = (l, r) if is_home else (r, l)
            out[mid.group(1)] = {'fb_id': mid.group(1), 'date': f'20{d.group(3)}-{d.group(2)}-{d.group(1)}', 'time': t.group(1) if t else '15:00',
                                 'opponent': away if is_home else home, 'home': is_home, 'competition': comp_name, 'result': res}
    return list(out.values())


# ---------- squad statistics ----------
def squad():
    h = get(SQUAD_URL).decode('utf-8', 'replace')
    rows = []
    for tr in re.findall(r'<tr>(.*?)</tr>', h, re.S):
        nm = re.search(r'class="player-name"><span data-obfuscation="([^"]+)">(.*?)</span>', tr, re.S)
        if not nm: continue
        nums = [clean(x) for x in re.findall(r'<td[^>]*>(\d+)</td>', tr)]
        if len(nums) < 3: continue
        rows.append([decode(nm.group(2), nm.group(1)), int(nums[0]), int(nums[1]), int(nums[2])])
    return rows


# ---------- database ----------
q = lambda v: 'null' if v is None else ("'" + str(v).replace("'", "''") + "'")

def sql(query):
    if DRY: print(f'(dry run: would run {len(query)} characters of SQL)'); return []
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{PROJECT}/database/query', method='POST',
                                 data=json.dumps({'query': query}).encode(),
                                 headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_TOKEN'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b'[]')


def main():
    report = []
    lg = league()
    if len(lg['rows']) >= 8 and any(r[1] == US for r in lg['rows']):
        sql(f"insert into public.app_config values ('league', {q(json.dumps(lg, ensure_ascii=False))}) on conflict (key) do update set value = excluded.value;")
        us = next(r for r in lg['rows'] if r[1] == US)
        report.append(f'table: {len(lg["rows"])} teams, TTSC {us[0]}. with {us[7]} points')
    else:
        report.append(f'table: not recognised ({len(lg["rows"])} rows) – kept the old one')

    gs = games()
    if gs:
        values = ',\n'.join(f"({q(g['fb_id'])}, {q(g['date'])}::date, {q(g['time'])}::time, {q(g['opponent'])}, {str(g['home']).lower()}, {q(g['competition'])}, "
                            f"{g['result'][0] if g['result'] else 'null'}, {g['result'][1] if g['result'] else 'null'})" for g in gs)
        res = sql(f"""
with src(fb_id, date, time, opponent, home, competition, us, them) as (values {values}),
-- first time: attach fussball.de ids to matches that were added by hand or from the fixture list
linked as (
  update public.events e set fb_id = s.fb_id from src s
  where e.fb_id is null and e.type = 'match' and e.opponent = s.opponent and e.home = s.home
    and abs(e.date - s.date) <= 7 and not exists (select 1 from public.events x where x.fb_id = s.fb_id)
  returning e.id),
upd as (
  update public.events e set date = s.date, time = s.time, home = s.home,
    result_us = coalesce(s.us, e.result_us), result_them = coalesce(s.them, e.result_them),
    note = case when coalesce(e.note, '') = '' then s.competition else e.note end
  from src s where e.fb_id = s.fb_id
    and (e.date, e.time, e.home, e.result_us, e.result_them) is distinct from (s.date, s.time, s.home, coalesce(s.us, e.result_us), coalesce(s.them, e.result_them))
  returning e.id),
ins as (
  insert into public.events (type, opponent, home, date, time, note, fb_id, result_us, result_them)
  select 'match', s.opponent, s.home, s.date, s.time, s.competition, s.fb_id, s.us, s.them from src s
  where not exists (select 1 from public.events e where e.fb_id = s.fb_id)
    and not exists (select 1 from public.events e where e.fb_id is null and e.type = 'match' and e.opponent = s.opponent and e.home = s.home and abs(e.date - s.date) <= 7)
  returning id)
select (select count(*) from linked) as linked, (select count(*) from upd) as updated, (select count(*) from ins) as added;""")
        played = sum(1 for g in gs if g['result'])
        report.append(f'matches: {len(gs)} found, {played} with result' + (f', db: {res[0]}' if res else ''))
    else:
        report.append('matches: none recognised')

    sq = squad()
    if sq and sum(1 for r in sq if re.search(r'[A-Za-zÀ-ÿ]', r[0])) == len(sq):
        values = ',\n'.join(f"({q(SEASON)}, {q(n)}, {a}, {m}, {g}, {q(SQUAD_PAGE)})" for n, a, m, g in sq)
        sql(f"""insert into public.season_stats (season, name, apps, minutes, goals, source) values {values}
on conflict (season, name) do update set apps = excluded.apps, minutes = excluded.minutes, goals = excluded.goals, source = excluded.source, updated_on = current_date;""")
        report.append(f'squad: {len(sq)} players, {sum(r[3] for r in sq)} goals')
    else:
        report.append(f'squad: not recognised ({len(sq)} rows) – kept the old one')

    print('\n'.join(report))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f: f.write('### fussball.de import\n' + '\n'.join('- ' + r for r in report) + '\n')


if __name__ == '__main__':
    main()
