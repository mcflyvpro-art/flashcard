# Folio Academy — les vidéos de formation

Trois vidéos courtes, filmées dans la vraie app (la démo sans compte, le
Lycée Démo Folio : rien ne part vers la base), avec voix off, sous-titres,
curseur, surlignages, zoom de caméra et sommaire minuté en tête :

| Vidéo | Pour | Les étapes (l'essentiel seulement) |
|---|---|---|
| `Folio-Academy-1-Eleve.mp4` | élèves, au téléphone | entrer dans sa classe, faire un devoir, réviser chaque jour |
| `Folio-Academy-2-Professeur.mp4` | professeurs, sur ordinateur | choisir ses classes, faire entrer ses élèves, donner un devoir, suivre |
| `Folio-Academy-3-Referent.mp4` | référent, sur ordinateur | activer sa console, créer les classes, distribuer les codes, corriger un compte |

Le reste (créer ses livres, journal, Cercle, groupes, défis en direct,
licence…) n'y est pas exprès : chaque vidéo finit par une carte « À
découvrir » qui le nomme.

## La voix

`voix.py` choisit le meilleur moteur disponible :

1. **Gemini TTS** (Google AI Studio) si `GEMINI_API_KEY` existe : une clé
   gratuite, sans carte bancaire, sur <https://aistudio.google.com/apikey>.
   Le meilleur modèle TTS accessible avec la clé est pris seul.
2. **Google Cloud Text-to-Speech** (voix Chirp 3 HD) si `GOOGLE_TTS_API_KEY`
   existe (projet Google Cloud avec facturation activée ; quelques centimes).
3. **Kokoro** sinon : hors ligne, gratuit, mais la voix s'entend synthétique.

Dans une session Claude Code dans le cloud, la clé se range dans les
réglages de l'environnement (menu de l'environnement, puis Edit) comme
variable d'environnement `GEMINI_API_KEY` ; une **nouvelle** session la
lit. Le domaine `generativelanguage.googleapis.com` est déjà autorisé.
Jamais de clé dans le dépôt ni dans une conversation.

Réglages : `FOLIO_VOIX` (la voix, `Sulafat` par défaut pour Gemini,
`fr-FR-Chirp3-HD-Sulafat` pour Google Cloud), `FOLIO_VOIX_STYLE` (la
consigne de jeu donnée à Gemini), `FOLIO_TTS_MODELE`, `FOLIO_VOIX_MOTEUR`.
Chaque réplique est gardée en cache (`.academie/voix/<moteur>-<voix>/`) :
relancer ne refait que ce qui a changé, et un quota gratuit épuisé se
reprend le lendemain là où il s'est arrêté.

## Tourner

```sh
bash tools/academie/installer.sh                 # une fois : Python à part, voix de repli si pas de clé
node tools/academie/tourner.js echantillons      # la même phrase dans plusieurs voix : .academie/echantillons/
node tools/academie/tourner.js eleve --rep       # répétition rapide, une capture par réplique (.academie/tournage/eleve/rep/)
node tools/academie/tourner.js tout              # les trois vidéos, puis le sommaire : .academie/sortie/
```

Sans serveur sur `ACADEMIE_URL` (`http://localhost:4190` par défaut),
`tourner.js` construit l'app et la sert le temps du tournage. Il faut
ffmpeg et le Chromium de Playwright (`PW_CHROMIUM`, sinon
`/opt/pw-browsers/chromium`). Compter le temps réel de chaque vidéo, plus
l'encodage.

## Comment c'est fait

- `formations/*.js` : un scénario par vidéo. Il ne parle à l'app que par
  `t` (`t.dire(texte, geste)`, `t.toucher`, `t.montrer`, `t.zoom`,
  `t.chapitre`…). Changer un texte ou un geste, c'est là.
- `moteur.js` : joue le scénario deux fois, à vide (pour connaître les
  répliques et synthétiser la voix) puis pour de vrai, dans `cadre.html`
  (1920×1080 : téléphone ou fenêtre de navigateur, panneau des étapes,
  sous-titres). Capture par le screencast de Chromium, montage ffmpeg
  (H.264, voix à -16 LUFS), chapitres inscrits dans le MP4.
- L'élève entre **pour de vrai** dans sa classe avec le code : avant de
  filmer, le référent de la démo le retire de l'établissement (dans la
  même page, cachée par la carte de titre).
- Les sélecteurs suivent l'app : si un écran change, `--rep` montre où le
  scénario casse (`echec.png` dans le dossier de tournage).
