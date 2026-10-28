"""Le sommaire de la Mirandola Academy : les minutages des formations tournées,
et pour chacune une description prête à coller sous une vidéo YouTube (qui
transforme d'elle-même les minutages en chapitres)."""
import json, os

ICI = os.path.dirname(os.path.abspath(__file__))
TRAVAIL = os.environ.get('ACADEMIE_DIR') or os.path.join(ICI, '..', '..', '.academie')
F = [
    ('eleve', 'Formation Élève', 'Pour les élèves : entrer dans sa classe, faire un devoir, réviser chaque jour.'),
    ('prof', 'Formation Professeur', 'Pour les professeurs : choisir ses classes, faire entrer ses élèves, donner un devoir, suivre la classe.'),
    ('referent', 'Formation Référent', 'Pour le référent : activer sa console, créer les classes, distribuer les codes, corriger un compte.'),
]


def mmss(s):
    s = int(round(s))
    return f'{s // 60}:{s % 60:02d}'


lignes = ['# Mirandola Academy — sommaire', '',
          'Chaque vidéo commence par son sommaire minuté ; les chapitres sont aussi inscrits dans le fichier '
          '(VLC, QuickTime et la plupart des lecteurs les proposent).', '']
youtube = []
for cle, module, resume in F:
    j = os.path.join(TRAVAIL, 'tournage', cle, 'chapitres.json')
    if not os.path.exists(j):
        continue
    d = json.load(open(j))
    lignes += [f'## {module}', '', f'`{d["fichier"]}` · {mmss(d["total"])}', '', resume, '',
               '| Minutage | Chapitre |', '|---|---|', *[f'| {c["t"]} | {c["titre"]} |' for c in d['chapitres']], '']
    youtube += [f'---- {module} ----', f'Mirandola Academy — {module}. {resume}', '',
                *[f'{c["t"]} {c["titre"]}' for c in d['chapitres']], '',
                'Essayer Mirandola sans compte : https://mirandola.fr/essayer', '']

lignes += ['## Descriptions prêtes pour YouTube', '', 'À coller telles quelles : YouTube en tire des chapitres cliquables.', '',
           '```', *youtube, '```', '']
os.makedirs(os.path.join(TRAVAIL, 'sortie'), exist_ok=True)
open(os.path.join(TRAVAIL, 'sortie', 'Mirandola-Academy-Sommaire.md'), 'w').write('\n'.join(lignes))
print('\n'.join(lignes[:40]))
