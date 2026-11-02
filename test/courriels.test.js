// Les e-mails d'une demande de démo (supabase/functions/_shared/courriels.js,
// fonction `prevenir`) : tout ce que la demande dit, rien d'injecté, un
// texte brut avec le HTML, et jamais deux fois la même demande.
import { describe, expect, it } from 'vitest';
import { accuseDemande, alerteDemande, aPrevenir, envoiBrevo } from '../supabase/functions/_shared/courriels.js';

const d = { source: 'demande', etab: 'Lycée Victor Hugo', ville: 'Lyon', contact_nom: 'Claire Martin', contact_fonction: 'Proviseure adjointe',
  contact_email: 'claire@exemple.fr', contact_tel: '', eleves_estimes: 450, message: 'Pour la rentrée <b>2027</b>', cree: '2026-11-02T10:00:00Z', prevenu_le: null };

describe('l’alerte à l’éditeur', () => {
  it('dit tout ce que la demande dit, et mène à la console', () => {
    const c = alerteDemande(d);
    expect(c.sujet).toBe('Demande de démo : Lycée Victor Hugo (Lyon)');
    for (const t of ['Lycée Victor Hugo', 'Claire Martin', 'Proviseure adjointe', 'claire@exemple.fr', '450']) expect(c.html).toContain(t);
    expect(c.html).toContain('https://mirandola.fr/admin');
    expect(c.texte).toContain('Élèves : 450');
    expect(c.html).not.toContain('Téléphone');                       // un champ vide ne s'affiche pas
  });
  it('rien de ce qu’a tapé le visiteur n’entre dans le HTML tel quel', () => {
    const c = alerteDemande(d);
    expect(c.html).toContain('&lt;b&gt;2027&lt;/b&gt;');
    expect(c.html).not.toContain('<b>2027</b>');
  });
});

describe('l’accusé de réception', () => {
  it('salue par le prénom, nomme l’établissement, dit la suite', () => {
    const c = accuseDemande(d);
    expect(c.html).toContain('Bonjour Claire');
    expect(c.texte).toContain('Lycée Victor Hugo');
    expect(c.texte).toContain('30 jours, 60 élèves');
    expect(c.texte).not.toMatch(/—/);
  });
});

describe('l’envoi', () => {
  it('ce que reçoit Brevo : l’expéditeur, le destinataire, la réponse, les deux versions', () => {
    const e = envoiBrevo({ de: 'noreply@mirandola.fr', a: 'editeur@exemple.fr', repondreA: 'claire@exemple.fr', courriel: alerteDemande(d) });
    expect(e).toMatchObject({ sender: { email: 'noreply@mirandola.fr', name: 'Mirandola' }, to: [{ email: 'editeur@exemple.fr' }],
      replyTo: { email: 'claire@exemple.fr' } });
    expect(e.htmlContent).toContain('<!doctype html>');
    expect(e.textContent).toContain('Lycée Victor Hugo');
  });
  it('une demande se prévient une fois, et seulement fraîche', () => {
    const t = Date.parse('2026-11-02T10:30:00Z');
    expect(aPrevenir(d, t)).toBe(true);
    expect(aPrevenir({ ...d, prevenu_le: '2026-11-02T10:00:05Z' }, t)).toBe(false);
    expect(aPrevenir({ ...d, source: 'editeur' }, t)).toBe(false);
    expect(aPrevenir(d, Date.parse('2026-11-02T13:00:00Z'))).toBe(false);
    expect(aPrevenir(null, t)).toBe(false);
  });
});
