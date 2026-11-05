import { describe, expect, it } from 'vitest';
import { CODE_EMAIL, CODE_TOTP, adresseValide, attente, chiffres, groupes, messageSecurite, suggestion } from '../src/securite.js';

/* La sécurité du compte (2026-11-02, src/securite.js) : ce que dit un refus de
   Supabase Auth, la forme d'un code, une adresse sans doute mal tapée. */

describe('les codes', () => {
  it('8 chiffres par e-mail, 6 dans une application d’authentification', () => {
    expect([CODE_EMAIL, CODE_TOTP]).toEqual([8, 6]);
  });
  it('le champ ne garde que des chiffres, pas plus qu’il n’en faut', () => {
    expect(chiffres('12 34-56 78 9', 8)).toBe('12345678');
    expect(chiffres('', 6)).toBe('');
    expect(chiffres(null, 6)).toBe('');
  });
  it('la clé secrète se lit par groupes de quatre', () => {
    expect(groupes('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupes('ABCDEF')).toBe('ABCD EF');
  });
});

describe('ce que dit un refus', () => {
  const r = (code, message = '') => messageSecurite({ code, message });
  it('par son code d’erreur d’abord', () => {
    expect(r('otp_expired')).toMatch(/Code faux ou expiré/);
    expect(r('mfa_verification_failed')).toMatch(/30 secondes/);
    expect(r('same_password')).toMatch(/déjà ton mot de passe/);
    expect(r('weak_password')).toMatch(/trop faible/);
    expect(r('email_exists')).toMatch(/déjà un compte/);
    expect(r('reauthentication_not_valid')).toMatch(/Code faux/);
    expect(r('insufficient_aal')).toMatch(/application d’authentification/);
  });
  it('par son message sinon (les versions anciennes de Supabase Auth)', () => {
    expect(r('', 'Token has expired or is invalid')).toMatch(/Code faux ou expiré/);
    expect(r('', 'Invalid TOTP code entered')).toMatch(/30 secondes/);
    expect(r('', 'Failed to fetch')).toMatch(/Pas de réseau/);
  });
  it('le temps à attendre, quand Supabase le dit', () => {
    const e = { code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 47 seconds.' };
    expect(attente(e)).toBe(47);
    expect(messageSecurite(e)).toBe('Patiente encore 47 s avant d’en redemander un.');
    expect(attente({ message: 'autre' })).toBe(0);
  });
  it('un refus inconnu : une phrase générique, jamais l’anglais de Supabase', () => {
    expect(r('xyz', 'Something odd')).toBe('Impossible pour l’instant : réessaie dans un moment.');
    expect(messageSecurite(null)).toMatch(/Impossible/);
  });
});

describe('une adresse sans doute mal tapée', () => {
  it('propose la bonne orthographe d’une messagerie courante', () => {
    expect(suggestion('zoe@gmial.com')).toBe('zoe@gmail.com');
    expect(suggestion('zoe@gmail.fr')).toBe('zoe@gmail.com');
    expect(suggestion('zoe@hotmial.fr')).toBe('zoe@hotmail.fr');
    expect(suggestion('Zoe@Outlok.fr')).toBe('zoe@outlook.fr');
    expect(suggestion('zoe@ornage.fr')).toBe('zoe@orange.fr');
    expect(suggestion('zoe@yahooo.fr')).toBe('zoe@yahoo.fr');
  });
  it('ne touche jamais une vraie adresse', () => {
    for (const a of ['zoe@gmail.com', 'zoe@mail.com', 'zoe@free.fr', 'zoe@sfr.fr', 'zoe@ac-lyon.fr',
      'zoe@monlycee.net', 'zoe@laposte.net', 'zoe@ymail.com', 'zoe@pm.me', 'zoe@me.com']) {
      expect(suggestion(a), a).toBe('');
    }
  });
  it('rien pour ce qui n’est pas encore une adresse', () => {
    expect(suggestion('')).toBe('');
    expect(suggestion('zoe')).toBe('');
    expect(suggestion('@gmial.com')).toBe('');
  });
  it('la forme d’une adresse', () => {
    expect(adresseValide('zoe@exemple.fr')).toBe(true);
    expect(adresseValide(' zoe@exemple.fr ')).toBe(true);
    expect(adresseValide('zoe@exemple')).toBe(false);
    expect(adresseValide('zoe exemple.fr')).toBe(false);
  });
});
