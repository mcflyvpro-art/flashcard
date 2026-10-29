import { describe, expect, it } from 'vitest';
import { messageConnexion } from '../src/connexion-erreurs.js';

const err = (message, code) => Object.assign(new Error(message), code ? { code } : {});

describe('ce que dit l’écran de connexion quand Supabase Auth refuse', () => {
  it('une adresse pas encore confirmée : le dire, et proposer de renvoyer l’e-mail', () => {
    const r = messageConnexion(err('Email not confirmed', 'email_not_confirmed'), false);
    expect(r.texte).toMatch(/pas encore confirmée/);
    expect(r.renvoyer).toBe(true);
    // une version plus ancienne de Supabase Auth ne renvoie que le message
    expect(messageConnexion(err('Email not confirmed'), false).renvoyer).toBe(true);
  });
  it('la limite d’e-mails du projet (le SMTP intégré : 2 par heure, l’équipe seulement)', () => {
    expect(messageConnexion(err('email rate limit exceeded', 'over_email_send_rate_limit'), true).texte)
      .toMatch(/ne peut pas partir/);
    expect(messageConnexion(err('Email address not authorized'), true).texte).toMatch(/ne peut pas partir/);
  });
  it('trop d’essais d’affilée', () => {
    expect(messageConnexion(err('For security purposes, you can only request this after 13 seconds.'), false).texte)
      .toMatch(/patiente/);
  });
  it('une adresse mal écrite n’est pas un mauvais mot de passe', () => {
    expect(messageConnexion(err('Unable to validate email address: invalid format', 'validation_failed'), true).texte)
      .toMatch(/n’est pas valide/);
    expect(messageConnexion(err('Invalid login credentials', 'invalid_credentials'), false).texte)
      .toMatch(/incorrect/);
    expect(messageConnexion(err('Invalid login credentials'), false).texte).toMatch(/incorrect/);
  });
  it('déjà un compte, mot de passe trop faible, inscriptions fermées, pas de réseau', () => {
    expect(messageConnexion(err('User already registered'), true).texte).toMatch(/déjà un compte/);
    expect(messageConnexion(err('Password should be at least 6 characters.', 'weak_password'), true).texte).toMatch(/trop faible/);
    expect(messageConnexion(err('Signups not allowed for this instance', 'signup_disabled'), true).texte).toMatch(/fermées/);
    expect(messageConnexion(err('Failed to fetch'), false).texte).toMatch(/réseau/);
  });
  it('le reste : un message sûr, selon le geste', () => {
    expect(messageConnexion(err('???'), true)).toEqual({ texte: 'Inscription impossible pour l’instant.', renvoyer: false });
    expect(messageConnexion(null, false).texte).toBe('Connexion impossible pour l’instant.');
  });
});
