#!/usr/bin/env python3
"""Injecte un deck dans l'app.

  python3 tools/inject.py "Nom du deck" < cartes.txt
  python3 tools/inject.py "Nom du deck" -t "chat = cat
chien = dog"

- écrit decks/<slug>.json et met à jour decks/index.json  (deck livré avec l'app)
- affiche le lien d'import #i=... (injection instantanée sur iPhone)
"""
import sys, os, json, re, base64, argparse, unicodedata, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEPS = [r'\t+', r'\s*::\s*', r'\s*=>?\s*', r'\s*\|\s*', r'\s+[–—]\s+', r'\s+-\s+', r'\s*:\s*', r'\s*;\s*', r'\s*,\s*']

def parse(txt):
    cards = []
    for line in txt.splitlines():
        line = re.sub(r'^\s*(?:[-*•·–—]|\d+[.)])\s+', '', line).strip()
        if not line:
            continue
        for s in SEPS:
            parts = re.split(s, line)
            if len(parts) >= 2 and parts[0].strip() and ' '.join(parts[1:]).strip():
                cards.append([parts[0].strip(), ' '.join(p.strip() for p in parts[1:]).strip()])
                break
    return cards

def slug(name):
    n = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    n = re.sub(r'[^a-zA-Z0-9]+', '-', n).strip('-').lower()
    return n or 'deck'

def b64(obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name')
    ap.add_argument('-t', '--text', help='texte brut (sinon stdin)')
    ap.add_argument('-b', '--base', default=os.environ.get('CARTES_URL', ''), help='URL de l app pour le lien')
    ap.add_argument('-s', '--subject', default='',
                    help='italien | anglais | philo | eco | management | lettres')
    ap.add_argument('--append', action='store_true', help='ajoute aux cartes existantes du deck')
    a = ap.parse_args()

    txt = a.text if a.text is not None else sys.stdin.read()
    cards = parse(txt)
    if not cards:
        sys.exit('aucune carte détectée')

    key = slug(a.name)
    path = os.path.join(ROOT, 'decks', key + '.json')
    if a.append and os.path.exists(path):
        old = json.load(open(path, encoding='utf-8')).get('cards', [])
        seen = {tuple(c) for c in cards}
        cards = [c for c in old if tuple(c) not in seen] + cards

    pack = {'key': key, 'name': a.name, 'subject': a.subject, 'cards': cards}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False, indent=1)

    rev = hashlib.sha1(json.dumps(pack, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:8]
    ipath = os.path.join(ROOT, 'decks', 'index.json')
    idx = json.load(open(ipath, encoding='utf-8')) if os.path.exists(ipath) else []
    idx = [i for i in idx if i.get('key') != key]
    idx.append({'key': key, 'file': key + '.json', 'name': a.name, 'rev': rev, 'n': len(cards)})
    idx.sort(key=lambda i: i['key'])
    with open(ipath, 'w', encoding='utf-8') as f:
        json.dump(idx, f, ensure_ascii=False, indent=1)

    print(f'{len(cards)} cartes -> decks/{key}.json')
    link = (a.base.rstrip('/') + '/' if a.base else '') + '#i=' + b64(pack)
    print(link)

if __name__ == '__main__':
    main()
