"""Pose chaque réplique à son heure sur une piste unique, à 48 kHz."""
import json, sys
import numpy as np
import soundfile as sf

SR = 48000


def lire(f):
    s, sr = sf.read(f, dtype='float32')
    if s.ndim > 1:
        s = s.mean(axis=1)
    if sr != SR:
        x = np.arange(0, len(s) * SR / sr) * sr / SR
        s = np.interp(x, np.arange(len(s)), s).astype(np.float32)
    return s


def main():
    info = json.load(open(sys.argv[1]))
    piste = np.zeros(int((info['duree'] + 1) * SR), dtype=np.float32)
    for p in info['pistes']:
        s = lire(p['f'])
        a = max(0, int(p['t'] * SR))
        b = min(len(piste), a + len(s))
        piste[a:b] += s[: b - a]
    crete = np.max(np.abs(piste)) or 1.0
    piste = piste * (0.89 / crete)
    sf.write(sys.argv[2], piste[: int(info['duree'] * SR)], SR)


if __name__ == '__main__':
    main()
