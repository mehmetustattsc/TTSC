#!/usr/bin/env python3
"""Puts the latest TTSC result (from the app's database, filled by the fussball.de import)
into the "AKTUELLE ERGEBNISSE" box on the front page of ttscbuchen.de.

Needs SUPABASE_TOKEN (Management API). To write to the website it also needs WP_USER and
WP_APP_PASSWORD (a WordPress application password); without them it only writes the box to
result-block.html. Prints no names, only what it did.
"""
import base64, html, json, os, re, sys, urllib.request

PROJECT = 'cmzukfpfzgugjatawwwj'
SITE = 'https://ttscbuchen.de'
TEMPLATE = '/wp-json/wp/v2/templates/fse-soccer//home'
TTSC_LOGO = 'https://ttscbuchen.de/wp-content/uploads/2025/05/ttsc_logo_spielplan.png'
DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
MARK = 'ttsc-last-result'


def sql(query):
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{PROJECT}/database/query', method='POST',
                                 data=json.dumps({'query': query}).encode(),
                                 headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_TOKEN'],
                                          'Content-Type': 'application/json', 'User-Agent': 'ttsc-team'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def latest():
    rows = sql("""select e.date::text as date, to_char(e.time, 'HH24:MI') as time, extract(isodow from e.date)::int as dow,
                         e.opponent, e.home, e.result_us, e.result_them, l.png
                  from public.events e left join public.club_logos l on l.name = e.opponent
                  where e.type = 'match' and e.result_us is not null and e.result_them is not null
                  order by e.date desc, e.time desc limit 1;""")
    return rows[0] if rows else None


def team(name, logo, side_label, logo_first):
    """One team box, same blocks as the theme's own layout."""
    name = html.escape(name)
    img = ''
    if logo:
        width = '181px' if logo_first else '130px'
        img = (f'<!-- wp:image {{"width":"{width}","height":"auto","sizeSlug":"full","linkDestination":"none"}} -->\n'
               f'<figure class="wp-block-image size-full is-resized"><img src="{logo}" alt="" style="width:{width};height:auto"/></figure>\n'
               '<!-- /wp:image -->')
    align = 'left' if logo_first else 'right'
    label = (f'<!-- wp:heading {{"textAlign":"{align}","level":4,"style":{{"typography":{{"textTransform":"uppercase"}},"spacing":{{"margin":{{"top":"10px"}}}}}},"textColor":"secondary","fontSize":"small"}} -->\n'
             f'<h4 class="wp-block-heading has-text-align-{align} has-secondary-color has-text-color has-small-font-size" style="margin-top:10px;text-transform:uppercase"><mark style="background-color:rgba(0, 0, 0, 0)" class="has-inline-color has-base-color"><em>{side_label}</em></mark></h4>\n'
             '<!-- /wp:heading -->')
    text = ('<!-- wp:group {"layout":{"type":"constrained"}} -->\n<div class="wp-block-group">'
            '<!-- wp:heading {"textAlign":"left","level":3,"style":{"typography":{"textTransform":"uppercase","fontStyle":"normal","fontWeight":"700","fontSize":"20px"}}} -->\n'
            f'<h3 class="wp-block-heading has-text-align-left" style="font-size:20px;font-style:normal;font-weight:700;text-transform:uppercase">{name}</h3>\n'
            '<!-- /wp:heading -->\n\n' + label + '</div>\n<!-- /wp:group -->')
    inner = (img + '\n\n' + text) if logo_first else (text + ('\n\n' + img if img else ''))
    return ('<!-- wp:group {"className":"skwed","style":{"spacing":{"padding":{"top":"25px","right":"25px","bottom":"25px","left":"25px"}}},"backgroundColor":"primary","layout":{"type":"constrained"}} -->\n'
            '<div class="wp-block-group skwed has-primary-background-color has-background" style="padding-top:25px;padding-right:25px;padding-bottom:25px;padding-left:25px">'
            '<!-- wp:group {"className":"skwed-reversed","layout":{"type":"constrained"}} -->\n<div class="wp-block-group skwed-reversed">'
            '<!-- wp:group {"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"center"}} -->\n<div class="wp-block-group">'
            + inner + '</div>\n<!-- /wp:group --></div>\n<!-- /wp:group --></div>\n<!-- /wp:group -->')


def column(width, body):
    return (f'<!-- wp:column {{"verticalAlignment":"center","width":"{width}"}} -->\n'
            f'<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:{width}">{body}</div>\n<!-- /wp:column -->')


def block(m):
    y, mo, d = m['date'].split('-')
    if m['home']:
        home, away = ('TTSC Buchen', TTSC_LOGO), (m['opponent'], m['png'])
        score = (m['result_us'], m['result_them'])
    else:
        home, away = (m['opponent'], m['png']), ('TTSC Buchen', TTSC_LOGO)
        score = (m['result_them'], m['result_us'])
    middle = ('<!-- wp:group {"className":"skwed","style":{"spacing":{"padding":{"top":"25px","right":"25px","bottom":"25px","left":"25px"}}},"backgroundColor":"black","layout":{"type":"constrained"}} -->\n'
              '<div class="wp-block-group skwed has-black-background-color has-background" style="padding-top:25px;padding-right:25px;padding-bottom:25px;padding-left:25px">'
              '<!-- wp:group {"className":"skwed-reversed","layout":{"type":"constrained"}} -->\n<div class="wp-block-group skwed-reversed">'
              '<!-- wp:heading {"textAlign":"center","style":{"typography":{"lineHeight":"1.2"}},"fontSize":"gigantic"} -->\n'
              f'<h2 class="wp-block-heading has-text-align-center has-gigantic-font-size" style="line-height:1.2">{score[0]} - {score[1]}</h2>\n<!-- /wp:heading -->\n\n'
              '<!-- wp:paragraph {"align":"center","style":{"spacing":{"margin":{"top":"15px"}}},"fontSize":"small"} -->\n'
              f'<p class="has-text-align-center has-small-font-size" style="margin-top:15px">{d}.{mo}.{y}</p>\n<!-- /wp:paragraph -->\n\n'
              '<!-- wp:paragraph {"align":"center","style":{"spacing":{"margin":{"top":"5px"}}},"fontSize":"small"} -->\n'
              f'<p class="has-text-align-center has-small-font-size" style="margin-top:5px">{DAYS[m["dow"] - 1]}, {m["time"]}</p>\n<!-- /wp:paragraph -->'
              '</div>\n<!-- /wp:group --></div>\n<!-- /wp:group -->')
    return (f'<!-- wp:columns {{"verticalAlignment":"center","className":"{MARK}","style":{{"spacing":{{"blockGap":{{"top":"0","left":"0"}}}}}}}} -->\n'
            f'<div class="wp-block-columns are-vertically-aligned-center {MARK}">'
            + column('35%', team(home[0], home[1], 'Heim', False)) + '\n\n'
            + column('30%', middle) + '\n\n'
            + column('35%', team(away[0], away[1], 'Auswärts', True))
            + '</div>\n<!-- /wp:columns -->')


# the result box: our marked columns block, or (first run) the columns block right after the heading
BOX = re.compile(r'<!-- wp:columns \{[^\n]*' + MARK + r'.*?<!-- /wp:columns -->', re.S)
FIRST = re.compile(r'(AKTUELLE ERGEBNISSE.*?)(<!-- wp:columns \{"verticalAlignment":"center","style":\{"spacing":\{"blockGap":\{"top":"0","left":"0"\}\}\}\} -->.*?<!-- /wp:columns -->)', re.S)


def put_in(content, new):
    if BOX.search(content):
        return BOX.sub(lambda _: new, content, count=1)
    if FIRST.search(content):
        return FIRST.sub(lambda m: m.group(1) + new, content, count=1)
    return None


def wp(method, body=None):
    auth = base64.b64encode(f"{os.environ['WP_USER']}:{os.environ['WP_APP_PASSWORD']}".encode()).decode()
    req = urllib.request.Request(SITE + TEMPLATE + ('?context=edit' if method == 'GET' else ''), method=method,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json', 'User-Agent': 'ttsc-team'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def main():
    m = latest()
    if not m:
        print('no result yet'); return
    new = block(m)
    open('result-block.html', 'w').write(new)
    if not os.environ.get('WP_APP_PASSWORD'):
        print('no website password: box written to result-block.html only'); return
    content = wp('GET')['content']['raw']
    changed = put_in(content, new)
    if changed is None:
        print('result box not found on the front page'); sys.exit(1)
    if changed == content:
        print('website already up to date'); return
    wp('POST', {'content': changed})
    print('website updated')


if __name__ == '__main__':
    main()
