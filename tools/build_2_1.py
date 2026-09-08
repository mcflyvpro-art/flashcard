#!/usr/bin/env python3
"""Decks du cours 2.1 — sections 2.1.1, 2.1.3, 2.1.4, 2.1.5 uniquement.
Face visible = français, face cachée = italien."""
import json, os, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 2.1.1 Il genere — esempi
MOTS = [
    ("garçon", "ragazzo"), ("fille", "ragazza"), ("italien", "italiano"), ("italienne", "italiana"),
    ("pizza", "pizza"), ("table", "tavolo"), ("salle", "aula"), ("ami", "amico"), ("amie", "amica"),
    ("vérité", "verità"), ("montre", "orologio"), ("matin", "mattina"),
    ("professeure", "professoressa"), ("école", "scuola"), ("exercice", "esercizio"),
    ("homme", "uomo"), ("femme", "donna"), ("euro", "euro"), ("livre", "libro"), ("lycée", "liceo"),
]
# 2.1.5 Interrogare — esempi
QUESTIONS = [
    ("Qu'est-ce que… ? / que… ?", "Che cosa?"),
    ("Où… ?", "Dove?"),
    ("Comment… ?", "Come?"),
]
# 2.1.3 Verbi al presente (io)
JE = [
    ("je suis", "sono"), ("j'ai", "ho"), ("je fais", "faccio"), ("je vais", "vado"), ("je vois", "vedo"),
    ("je regarde", "guardo"), ("je connais", "conosco"), ("je parle", "parlo"),
    ("je comprends", "capisco"), ("je mange", "mangio"), ("je veux", "voglio"), ("je dois", "devo"),
    ("j'habite", "abito"), ("je lis", "leggo"), ("je me réveille", "mi sveglio"),
    ("je m'appelle", "mi chiamo"), ("j'arrive", "arrivo"), ("je téléphone", "telefono"),
    ("je travaille", "studio"), ("je travaille", "lavoro"),
]
# 2.1.4 Verbi al presente (tu)
TU = [
    ("tu es", "sei"), ("tu as", "hai"), ("tu fais", "fai"), ("tu vas", "vai"), ("tu vois", "vedi"),
    ("tu regardes", "guardi"), ("tu connais", "conosci"), ("tu parles", "parli"),
    ("tu comprends", "capisci"), ("tu manges", "mangi"), ("tu veux", "vuoi"), ("tu dois", "devi"),
    ("tu habites", "abiti"), ("tu lis", "leggi"), ("tu te réveilles", "ti svegli"),
    ("tu t'appelles", "ti chiami"), ("tu arrives", "arrivi"), ("tu téléphones", "telefoni"),
    ("tu travailles", "studi"), ("tu travailles", "lavori"),
]

DECKS = [
    {"key": "verbes-je-tu", "name": "Verbes · je + tu", "subject": "italien",
     "cards": [list(c) for c in JE + TU]},
    {"key": "mots-questions", "name": "Mots · questions", "subject": "italien",
     "cards": [list(c) for c in MOTS + QUESTIONS]},
]

idx = []
for pack in DECKS:
    path = os.path.join(ROOT, 'decks', pack['key'] + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False, indent=1)
    rev = hashlib.sha1(json.dumps(pack, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:8]
    idx.append({"key": pack['key'], "file": pack['key'] + '.json',
                "name": pack['name'], "rev": rev, "n": len(pack['cards'])})
    print(f"{len(pack['cards']):3d} cartes -> decks/{pack['key']}.json")

with open(os.path.join(ROOT, 'decks', 'index.json'), 'w', encoding='utf-8') as f:
    json.dump(sorted(idx, key=lambda i: i['key']), f, ensure_ascii=False, indent=1)
