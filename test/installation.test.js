// La porte d'installation (src/installation.js) : le bon geste pour chaque
// navigateur de téléphone, dans ses mots, et l'endroit où se trouve son bouton.
import { describe, expect, it } from 'vitest';
import { MOTS, enGras, guide, langueEcran, lienChrome, navigateur } from '../src/installation.js';

const UA = {
  iphone18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  // Safari 26 garde « iPhone OS 18_6 » : seule Version/26 dit la vraie
  iphone26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1',
  firefoxIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/141.0 Mobile/15E148 Safari/605.1.15',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 385.0.0.47.74 (iPhone15,2; iOS 18_5; fr_FR)',
  ent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  chrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  tabletteAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (Android 14; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0',
  edge: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 EdgA/138.0.0.0',
  vue: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36',
  tiktok: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 trill_380001 musical_ly_2023800010',
  miui: 'Mozilla/5.0 (Linux; U; Android 13; fr-fr; 2201117TY) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/18.1'
};
const os = k => (/iPhone|iPad|Macintosh/.test(UA[k]) ? 'ios' : 'android');
const g = (k, o) => guide(os(k), navigateur(UA[k]), o);

describe('le navigateur', () => {
  it('reconnaît Safari et sa vraie version, l’iPad qui se dit Mac', () => {
    expect(navigateur(UA.iphone18)).toEqual({ nom: 'safari', version: 18, tablette: false });
    expect(navigateur(UA.iphone26)).toEqual({ nom: 'safari', version: 26, tablette: false });
    expect(navigateur(UA.ipad)).toMatchObject({ nom: 'safari', tablette: true });
  });
  it('reconnaît les autres navigateurs d’iOS et d’Android', () => {
    expect(navigateur(UA.chromeIos).nom).toBe('chrome');
    expect(navigateur(UA.firefoxIos).nom).toBe('firefox');
    expect(navigateur(UA.chrome)).toMatchObject({ nom: 'chrome', tablette: false });
    expect(navigateur(UA.tabletteAndroid)).toMatchObject({ nom: 'chrome', tablette: true });
    expect(navigateur(UA.samsung).nom).toBe('samsung');
    expect(navigateur(UA.firefox).nom).toBe('firefox');
    expect(navigateur(UA.edge).nom).toBe('edge');
    expect(navigateur(UA.miui).nom).toBe('autre');
  });
  it('le navigateur enfermé dans une autre app : Instagram, TikTok, une vue web, l’app d’un ENT', () => {
    for (const k of ['instagram', 'ent', 'vue', 'tiktok']) expect(navigateur(UA[k]).nom, k).toBe('integre');
    expect(navigateur('').nom).toBe('autre');
  });
});

describe('le guide de chaque téléphone', () => {
  it('iPhone, Safari jusqu’à 18 : Partager en bas, Sur l’écran d’accueil, Ajouter, puis l’icône et la connexion', () => {
    const r = g('iphone18');
    expect(r).toMatchObject({ cas: 'ios', titre: 'Installe Mirandola', fleche: 'bas', bouton: null, secours: 'safari' });
    expect(r.etapes.map(e => e.ic)).toEqual(['partager', 'ajouter', 'ok', 'folio']);
    expect(r.etapes[1].texte).toContain('**Sur l’écran d’accueil**');
    expect(r.etapes.map(e => e.s)).toEqual(['barre', 'liste', 'ajout', 'accueil']);
    expect(r.etapes.at(-1).texte).toContain('connecte-toi');
    expect(r.ligne).toBe('Sur l’écran d’accueil');
  });
  it('iPhone, Safari 26 : Partager est dans le menu ••• en bas à droite', () => {
    const r = g('iphone26');
    expect(r).toMatchObject({ cas: 'ios26', fleche: 'bas-droite', ios26: true });
    expect(r.etapes[0].texte).toBe('Touche **•••** en bas à droite, puis **Partager**');
  });
  it('iOS 26 : la feuille de partage cache ses actions derrière « En voir plus »', () => {
    const r = g('iphone26');
    expect(r.etapes.map(e => e.s)).toEqual(['barre', 'feuille', 'liste', 'ajout', 'accueil']);
    expect(r.etapes[1].texte).toBe('Touche **En voir plus**, au bout de la rangée');
    expect(r.etapes[2].texte).toBe('Touche **Sur l’écran d’accueil**');
  });
  it('Chrome d’un iPhone sous iOS 26 (sa signature dit 18_6) : l’écran le devine, le guide suit', () => {
    const avant = g('chromeIos');
    expect(avant.etapes.map(e => e.s)).toEqual(['barre', 'liste', 'ajout', 'accueil']);
    const r = g('chromeIos', { ios26: true });
    expect(r).toMatchObject({ cas: 'ios-chrome', fleche: 'haut-droite', ios26: true });
    expect(r.etapes[0].texte).toBe('Touche **Partager**, en haut à droite');
    expect(r.etapes.map(e => e.ic)).toEqual(['partager', 'plus', 'ajouter', 'ok', 'folio']);
  });
  it('un iPhone réglé en anglais : les mots de SON écran, la phrase en français', () => {
    expect(langueEcran(['en-US', 'fr-FR'])).toBe('en');
    expect(langueEcran(['fr-CA'])).toBe('fr');
    expect(langueEcran([])).toBe('fr');
    expect(langueEcran(['es-ES'])).toBe('en');
    const r = g('chromeIos', { ios26: true, langue: 'en' });
    expect(r.etapes.map(e => e.texte)).toEqual(['Touche **Share**, en haut à droite', 'Touche **View More**, au bout de la rangée',
      'Touche **Add to Home Screen**', 'Touche **Add**, en haut à droite', 'Ouvre **Mirandola** par son icône et connecte-toi']);
    expect(r.mots).toBe(MOTS.en);
    expect(g('chrome', { langue: 'en' }).etapes[1].texte).toBe('Choisis **Install app**');
  });
  it('les deux langues ont les mêmes libellés', () => {
    expect(Object.keys(MOTS.en).sort()).toEqual(Object.keys(MOTS.fr).sort());
  });
  it('iPad : Partager en haut à droite', () => {
    expect(g('ipad')).toMatchObject({ cas: 'ipad', fleche: 'haut-droite' });
  });
  it('Chrome et Firefox sur iPhone : leur bouton Partager, et Safari en secours', () => {
    expect(g('chromeIos')).toMatchObject({ cas: 'ios-chrome', fleche: 'haut-droite', secours: 'safari' });
    expect(g('firefoxIos')).toMatchObject({ cas: 'ios-firefox', fleche: 'bas-droite', secours: 'safari' });
  });
  it('dans une autre app : sortir d’abord, vers Safari (copier le lien) ou Chrome (un geste)', () => {
    expect(g('instagram')).toMatchObject({ cas: 'integre', titre: 'Continue dans Safari', bouton: 'copier', secours: null });
    expect(g('tiktok')).toMatchObject({ cas: 'integre', titre: 'Continue dans Chrome', bouton: 'chrome', secours: 'copier' });
  });
  it('Android : l’invite du navigateur installe en un geste', () => {
    const r = g('chrome', { invite: true });
    expect(r).toMatchObject({ cas: 'invite', bouton: 'installer', fleche: null });
    expect(r.etapes.map(e => e.ic)).toEqual(['installer', 'ok', 'folio']);
  });
  it('Android sans invite : le menu de chaque navigateur, avec ses mots', () => {
    expect(g('chrome')).toMatchObject({ cas: 'android', fleche: 'haut-droite', ligne: 'Installer l’application' });
    expect(g('samsung').etapes[1].texte).toContain('**Ajouter la page à**');
    expect(g('edge').etapes[1].texte).toContain('**Ajouter au téléphone**');
    expect(g('firefox').etapes[1].texte).toContain('**Ajouter à l’écran d’accueil**');
    expect(g('miui')).toMatchObject({ cas: 'android-autre', secours: 'chrome' });
  });
  it('une session ouverte suit sur Android (stockage partagé), pas sur iPhone', () => {
    expect(g('chrome', { session: true }).etapes.at(-1).texte).toContain('ton compte t’y attend');
    expect(g('iphone18', { session: true }).etapes.at(-1).texte).toContain('connecte-toi');
  });
  it('chaque guide : des étapes courtes, dans l’ordre de l’animation, qui finissent sur l’icône', () => {
    for (const k of Object.keys(UA)) {
      for (const invite of [false, true]) {
        for (const ios26 of [false, true]) for (const langue of ['fr', 'en']) {
        const r = g(k, { invite, ios26, langue });
        expect(r.etapes.length, k).toBeGreaterThanOrEqual(3);
        expect(r.etapes.length, k).toBeLessThanOrEqual(5);
        const scenes = r.etapes.map(e => e.s);
        expect(new Set(scenes).size, k).toBe(scenes.length);          // une scène par étape
        expect(['barre', 'page'], k).toContain(scenes[0]);
        expect(['accueil', 'nav'], k).toContain(scenes.at(-1));
        expect(r.etapes.at(-1).ic, k).toBe('folio');
        for (const e of r.etapes) {
          expect(e.texte.length, e.texte).toBeLessThanOrEqual(70);
          expect(e.texte.split('**').length % 2, e.texte).toBe(1);   // chaque gras se ferme
          expect(e.texte).not.toMatch(/[—–]/);
        }
        expect(r.titre.length).toBeLessThanOrEqual(26);
        }
      }
    }
  });
});

describe('les outils de la porte', () => {
  it('lienChrome : un lien intent vers Chrome, la même adresse en repli', () => {
    const l = lienChrome('https://mirandola.fr/inscription?x=1');
    expect(l).toBe('intent://mirandola.fr/inscription?x=1#Intent;scheme=https;package=com.android.chrome;'
      + 'S.browser_fallback_url=https%3A%2F%2Fmirandola.fr%2Finscription%3Fx%3D1;end');
  });
  it('enGras : les mots de l’écran en gras, le reste échappé', () => {
    const esc = t => t.replace(/</g, '&lt;');
    expect(enGras('Touche **Partager** <ici>', esc)).toBe('Touche <b>Partager</b> &lt;ici>');
    expect(enGras('Sans gras')).toBe('Sans gras');
  });
});
