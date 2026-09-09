#!/usr/bin/env python3
"""Paquets supplémentaires : droit (CPC) et anglais (36 words).
Fusionne dans decks/index.json sans toucher aux entrées existantes."""
import json, os, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CPC = [
    ["Article 42",
     "La juridiction territorialement compétente est, sauf disposition contraire, "
     "celle du lieu où demeure le défendeur.\n"
     "S'il y a plusieurs défendeurs, le demandeur saisit, à son choix, "
     "la juridiction du lieu où demeure l'un d'eux."],
    ["Article 43",
     "Le lieu où demeure le défendeur s'entend, s'il s'agit d'une personne physique, "
     "du lieu de son domicile ou de sa résidence ; s'il s'agit d'une personne morale, "
     "du lieu où elle est établie."],
    ["Article 46",
     "Le demandeur peut saisir à son choix, outre la juridiction du domicile du défendeur : "
     "en matière contractuelle, la juridiction du lieu de la livraison de la chose "
     "ou d'exécution de la prestation ; en matière délictuelle, la juridiction du lieu "
     "du fait dommageable ou du lieu où le dommage a été subi."],
]

WORDS = [
    ["qualité", "asset, quality"],
    ["défaut", "defect, flaw"],
    ["fiable", "reliable"],
    ["avoir la tête froide", "be cool-headed"],
    ["avoir confiance en soi", "be self-confident"],
    ["ennuyeux", "boring"],
    ["joyeux, enjoué, heureux", "upbeat, cheerful, joyful"],
    ["perspicace", "insightful"],
    ["intelligent, vif", "witty, clever"],
    ["maladroit", "clumsy, awkward"],
    ["sage, raisonnable", "wise, sensible"],
    ["radin", "stingy"],
    ["économe", "thrifty"],
    ["peureux", "fearful"],
    ["confiant, courageux, téméraire", "fearless, brave"],
    ["audacieux", "bold, daring"],
    ["têtu, borné", "obstinate, stubborn"],
    ["attentionné, prévenant", "thoughtful"],
    ["fou, drôle", "silly"],
    ["étroit d'esprit", "narrow-minded"],
    ["ouvert d'esprit", "open-minded"],
    ["gentil, sympathique, aimable", "kind"],
    ["rangé, ordonné, en ordre", "tidy, organised"],
    ["mal rangé, désorganisé, négligé, peu soigné", "untidy, messy"],
    ["crâneur, qui a la grosse tête", "big-headed"],
    ["facile à vivre, décontracté", "easy going"],
    ["ouvert, sociable, extraverti", "sociable, extrovert, outgoing"],
    ["étourdi, distrait", "absent-minded"],
    ["grincheux", "grumpy"],
    ["timide", "shy"],
    ["paresseux, fainéant", "lazy"],
    ["prévenant, attentionné, plein d'égards", "thoughtful"],
    ["qui a bon caractère", "good-tempered"],
    ["qui a mauvais caractère, irascible, colérique", "bad-tempered"],
    ["serviable, obligeant, utile", "helpful"],
    ["bavard", "talkative"],
]

DECKS = [
    {"key": "art-42-43-46-cpc", "name": "Art 42, 43, 46 CPC", "subject": "droit", "cards": CPC},
    {"key": "36-words", "name": "36 words", "subject": "anglais", "cards": WORDS},
]

ipath = os.path.join(ROOT, 'decks', 'index.json')
idx = json.load(open(ipath, encoding='utf-8')) if os.path.exists(ipath) else []

for pack in DECKS:
    path = os.path.join(ROOT, 'decks', pack['key'] + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False, indent=1)
    rev = hashlib.sha1(json.dumps(pack, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:8]
    idx = [i for i in idx if i.get('key') != pack['key']]
    idx.append({"key": pack['key'], "file": pack['key'] + '.json',
                "name": pack['name'], "rev": rev, "n": len(pack['cards'])})
    print(f"{len(pack['cards']):3d} cartes -> decks/{pack['key']}.json")

idx.sort(key=lambda i: i['key'])
with open(ipath, 'w', encoding='utf-8') as f:
    json.dump(idx, f, ensure_ascii=False, indent=1)
