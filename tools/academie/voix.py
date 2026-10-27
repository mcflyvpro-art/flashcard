"""La voix off de la Folio Academy (2026-10-27).

Chaque réplique est synthétisée une fois et gardée en cache, par moteur et
par voix. Trois moteurs, du meilleur au repli :

  gemini  — Gemini TTS (Google AI Studio). Une clé gratuite suffit :
            GEMINI_API_KEY. Le meilleur modèle TTS accessible est choisi
            seul (FOLIO_TTS_MODELE pour l'imposer).
  google  — Google Cloud Text-to-Speech, voix Chirp 3 HD : GOOGLE_TTS_API_KEY.
  kokoro  — Kokoro (Apache 2.0), hors ligne : correct, mais on l'entend.

FOLIO_VOIX_MOTEUR impose un moteur, FOLIO_VOIX une voix, FOLIO_VOIX_STYLE
la consigne de jeu donnée à Gemini.

Usage :
  voix.py repliques.json durees.json      (une entrée {cle, texte} par réplique)
  voix.py --echantillons dossier [voix…]  (la même phrase dans plusieurs voix, pour choisir)

Le texte affiché à l'écran reste tel quel : seule la version prononcée
passe par PRONONCE (abréviations de classes, adresses, noms en capitales)."""
import base64, io, json, os, re, sys, time, urllib.error, urllib.request
import numpy as np
import soundfile as sf

ICI = os.path.dirname(os.path.abspath(__file__))
TRAVAIL = os.environ.get('ACADEMIE_DIR') or os.path.join(ICI, '..', '..', '.academie')
API = 'https://generativelanguage.googleapis.com/v1beta'
VOIX_DEFAUT = {'gemini': 'Sulafat', 'google': 'fr-FR-Chirp3-HD-Sulafat', 'kokoro': 'ff_siwis'}
ECHANTILLONS = {'gemini': ['Sulafat', 'Achernar', 'Aoede', 'Kore', 'Leda', 'Charon', 'Schedar', 'Iapetus'],
                'google': ['fr-FR-Chirp3-HD-Sulafat', 'fr-FR-Chirp3-HD-Achernar', 'fr-FR-Chirp3-HD-Aoede',
                           'fr-FR-Chirp3-HD-Kore', 'fr-FR-Chirp3-HD-Charon', 'fr-FR-Chirp3-HD-Schedar'],
                'kokoro': ['ff_siwis']}
STYLE = os.environ.get('FOLIO_VOIX_STYLE',
                       'Lis ce texte en français, comme une formatrice bienveillante qui guide pas à pas : '
                       'voix chaleureuse et souriante, débit posé et naturel, articulation nette')
PHRASE_TEST = ('Bienvenue dans la Folio Academy. En trois minutes, tu vas apprendre l’essentiel : '
               'entrer dans ta classe, faire tes devoirs, et réviser un peu chaque jour.')

SIGLES = {'QCM', 'QR', 'PDF', 'RGPD', 'ENT', 'UAI', 'SIRET', 'CGV', 'TVA', 'HT', 'TTC', 'PP', 'IA', 'URL'}
COMMUN = [
    (r'\b2nde\b', 'seconde'), (r'\b1re\b', 'première'), (r'\bTle\b', 'terminale'),
    (r'www\.folioflashcard\.online', 'folioflashcard point online'),
    (r'→', ','), (r'«\s*|\s*»', ''), (r'\s—\s', ', '), (r'…', '.'),
]
KOKORO = [   # ce qu'espeak, derrière Kokoro, lit à l'anglaise ou épelle mal
    (r'\bSpé maths\b', 'spé mathématiques'), (r'\bmaths\b', 'mathématiques'),
    (r'\be-mails?\b', 'mèl'), (r'\badresse mail\b', 'adresse mèl'), (r'\bmail\b', 'mèl'),
    (r'\bQCM\b', 'Q.C.M.'), (r'\bQR code\b', 'Q.R. code'), (r'\bQR\b', 'Q.R.'), (r'\bPDF\b', 'P.D.F.'),
    (r'\bFolio Academy\b', 'Académie Folio'),
]


def capitales(t):
    """Un nom en capitales (« MARTIN ») se dit comme un nom, pas lettre à lettre ; un sigle reste un sigle."""
    return re.sub(r'\b[A-ZÀ-ÖØ-Þ]{3,}\b', lambda m: m.group(0) if m.group(0) in SIGLES else m.group(0).capitalize(), t)


def prononce(t, moteur):
    for a, b in COMMUN + (KOKORO if moteur == 'kokoro' else []):
        t = re.sub(a, b, t)
    return capitales(t)


def moteur_choisi():
    m = os.environ.get('FOLIO_VOIX_MOTEUR')
    if m:
        return m
    if os.environ.get('GEMINI_API_KEY'):
        return 'gemini'
    if os.environ.get('GOOGLE_TTS_API_KEY'):
        return 'google'
    return 'kokoro'


class QuotaDuJour(Exception):
    """Le quota quotidien gratuit est épuisé : relancer demain reprend où l'on s'est arrêté (cache)."""


def http_json(url, corps=None, entetes=None):
    """Un appel JSON, avec les reprises qu'un service gratuit impose (429 : on attend ce qu'il demande)."""
    donnees = json.dumps(corps).encode() if corps is not None else None
    req = urllib.request.Request(url, data=donnees, method='POST' if corps is not None else 'GET',
                                 headers={'Content-Type': 'application/json', **(entetes or {})})
    for essai in range(8):
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            txt = e.read().decode('utf-8', 'replace')
            if e.code == 429 and re.search(r'PerDay|per day|daily', txt, re.I):
                raise QuotaDuJour(txt[:400]) from e
            if e.code in (429, 500, 502, 503, 504) and essai < 7:
                m = re.search(r'"retryDelay":\s*"(\d+(?:\.\d+)?)s"', txt)
                attente = float(m.group(1)) + 1 if m else min(60, 4 * 2 ** essai)
                print(f'  {e.code} : nouvel essai dans {attente:.0f} s', flush=True)
                time.sleep(attente)
                continue
            raise RuntimeError(f'{e.code} {txt[:600]}') from e
    raise RuntimeError('trop d’essais : ' + url)


# ---------- Gemini ----------
def modeles_gemini(cle):
    """Les modèles TTS accessibles avec cette clé, le meilleur d'abord (pro avant flash, le plus récent d'abord)."""
    if os.environ.get('FOLIO_TTS_MODELE'):
        return [os.environ['FOLIO_TTS_MODELE']]
    d = http_json(f'{API}/models?pageSize=1000', entetes={'x-goog-api-key': cle})
    noms = sorted((m['name'] for m in d.get('models', [])
                   if 'tts' in m['name'] and 'generateContent' in m.get('supportedGenerationMethods', [])), reverse=True)
    noms.sort(key=lambda n: 0 if 'pro' in n else 1)
    if not noms:
        raise RuntimeError('aucun modèle TTS pour cette clé Gemini')
    return noms


class Gemini:
    def __init__(self, voix):
        self.cle, self.voix = os.environ['GEMINI_API_KEY'], voix
        self.modeles = modeles_gemini(self.cle)

    def appel(self, texte):
        corps = {'contents': [{'parts': [{'text': texte}]}],
                 'generationConfig': {'responseModalities': ['AUDIO'],
                                      'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': self.voix}}}}}
        while True:
            modele = self.modeles[0]
            try:
                d = http_json(f'{API}/{modele}:generateContent', corps, {'x-goog-api-key': self.cle})
                break
            except (RuntimeError, QuotaDuJour) as e:
                # un modèle hors de portée de cette clé (offre gratuite : « limit: 0 », 403, 404) : le suivant
                hors = re.search(r'limit: 0|^40[34] ', str(e)) or (isinstance(e, QuotaDuJour) and len(self.modeles) > 1)
                if hors and len(self.modeles) > 1:
                    print(f'  {modele} indisponible avec cette clé, on passe à {self.modeles[1]}', flush=True)
                    self.modeles.pop(0)
                    continue
                raise
        part = d['candidates'][0]['content']['parts'][0]['inlineData']
        m = re.search(r'rate=(\d+)', part.get('mimeType', ''))
        pcm = np.frombuffer(base64.b64decode(part['data']), dtype='<i2').astype(np.float32) / 32768
        return pcm, int(m.group(1)) if m else 24000

    def dire(self, texte):
        # la consigne de jeu précède le texte ; si le modèle l'a lue à voix haute (réplique bien trop longue
        # pour son texte), on recommence sans elle
        s, sr = self.appel(f'{STYLE} :\n\n{texte}')
        attendu = len(texte) / 14.0
        if len(s) / sr > attendu * 1.8 + 2.5:
            print('  consigne lue à voix haute ? on recommence sans elle', flush=True)
            s, sr = self.appel(texte)
        return s, sr


# ---------- Google Cloud (Chirp 3 HD) ----------
class Google:
    def __init__(self, voix):
        self.cle, self.voix = os.environ['GOOGLE_TTS_API_KEY'], voix

    def dire(self, texte):
        corps = {'input': {'text': texte}, 'voice': {'languageCode': 'fr-FR', 'name': self.voix},
                 'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000}}
        d = http_json('https://texttospeech.googleapis.com/v1/text:synthesize', corps, {'x-goog-api-key': self.cle})
        s, sr = sf.read(io.BytesIO(base64.b64decode(d['audioContent'])), dtype='float32')
        return s, sr


# ---------- Kokoro, hors ligne ----------
class Kokoro:
    def __init__(self, voix):
        from kokoro_onnx import Kokoro as K
        k = os.path.join(TRAVAIL, 'kokoro')
        self.k, self.voix = K(os.path.join(k, 'kokoro-v1.0.onnx'), os.path.join(k, 'voices-v1.0.bin')), voix

    def dire(self, texte):
        s, sr = self.k.create(texte, voice=self.voix, speed=1.0, lang='fr-fr')
        return np.asarray(s, dtype=np.float32), sr


MOTEURS = {'gemini': Gemini, 'google': Google, 'kokoro': Kokoro}


def nettoyer(s, sr):
    """Rogne le silence de tête et de fin, et ramène chaque réplique au même niveau (-20 dBFS efficaces)."""
    if s.ndim > 1:
        s = s.mean(axis=1)
    idx = np.where(np.abs(s) > 0.01)[0]
    if len(idx):
        s = s[max(0, idx[0] - int(0.04 * sr)): idx[-1] + int(0.15 * sr)]
    rms = float(np.sqrt(np.mean(s ** 2))) or 1.0
    s = s * min(0.1 / rms, 0.97 / (float(np.max(np.abs(s))) or 1.0))
    return s.astype(np.float32)


def synthetiser(lignes, moteur, voix):
    cache = os.path.join(TRAVAIL, 'voix', f'{moteur}-{voix}')
    os.makedirs(cache, exist_ok=True)
    m, durees = None, {}
    for l in lignes:
        f = os.path.join(cache, l['cle'] + '.wav')
        if not os.path.exists(f):
            m = m or MOTEURS[moteur](voix)
            s, sr = m.dire(prononce(l['texte'], moteur))
            s = nettoyer(s, sr)
            sf.write(f, s, sr)
            print(f'voix {l["cle"]} {len(s) / sr:5.1f} s  {l["texte"][:70]}', flush=True)
        info = sf.info(f)
        durees[l['cle']] = info.frames / info.samplerate
    return cache, durees


def echantillons(dossier, voix):
    moteur = moteur_choisi()
    voix = voix or ECHANTILLONS[moteur]
    os.makedirs(dossier, exist_ok=True)
    morceaux, sr0 = [], None
    for v in voix:
        s, sr = MOTEURS[moteur](v).dire(prononce(PHRASE_TEST, moteur))
        s = nettoyer(s, sr)
        sf.write(os.path.join(dossier, f'{moteur}-{v}.wav'), s, sr)
        sr0 = sr0 or sr
        morceaux += [s if sr == sr0 else np.interp(np.arange(0, len(s) * sr0 / sr) * sr / sr0, np.arange(len(s)), s),
                     np.zeros(int(sr0 * 1.2), dtype=np.float32)]
        print(f'{moteur} {v}', flush=True)
    sf.write(os.path.join(dossier, f'{moteur}-toutes.wav'), np.concatenate(morceaux), sr0)
    print('dans l’ordre :', ', '.join(voix))


def main():
    if sys.argv[1] == '--echantillons':
        return echantillons(sys.argv[2], sys.argv[3:])
    moteur = moteur_choisi()
    voix = os.environ.get('FOLIO_VOIX') or VOIX_DEFAUT[moteur]
    try:
        cache, durees = synthetiser(json.load(open(sys.argv[1], encoding='utf-8')), moteur, voix)
    except QuotaDuJour as e:
        sys.exit(f'Quota gratuit du jour épuisé ({e}). Relancer demain : le travail déjà fait est gardé.')
    json.dump({'dossier': cache, 'moteur': moteur, 'voix': voix, 'durees': durees}, open(sys.argv[2], 'w'), indent=0)


if __name__ == '__main__':
    main()
