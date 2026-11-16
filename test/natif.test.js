import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { CHEMINS_APP, associationAndroid, associationApple, lienDeLApp } from '../src/natif.js';
import { dureeEssai, paquetDe, prixDuMagasin, prixDuPaquet } from '../src/magasin.js';
import { atteints, htmlNatif } from '../tools/natif/web.js';

/* L'app des magasins (2026-11-16, docs/CAPACITOR.md) : ses règles pures,
   et l'accord des projets natifs avec elles — un identifiant, une
   permission ou une adresse qui dériverait d'un côté ne se verrait
   qu'une fois l'app publiée. */

const lire = f => readFileSync(f, 'utf8');                     // depuis la racine du dépôt, comme les autres tests

describe('les liens qui ouvrent l’app', () => {
  it('suit un lien de mirandola.fr vers l’app : invitations, partages, e-mails, écrans', () => {
    for (const u of ['https://mirandola.fr/?rejoindre=ABCDEFGH', 'https://mirandola.fr/#s=ABCDEFGHJK',
      'https://www.mirandola.fr/?defi=123456', 'https://mirandola.fr/app?club=K7M2P9QX', 'https://mirandola.fr/app',
      'https://mirandola.fr/eleve/paquets/12', 'https://mirandola.fr/connexion', 'https://mirandola.fr/mentions/cgv',
      'https://mirandola.fr/#access_token=x&type=recovery', 'https://mirandola.fr']) {
      expect(lienDeLApp(u), u).toBe(u === 'https://mirandola.fr' ? u + '/' : u);
    }
  });
  it('laisse au navigateur les pages du site, et ne suit jamais un autre domaine', () => {
    for (const u of ['https://mirandola.fr/tarifs', 'https://mirandola.fr/moteur', 'https://mirandola.fr/sitemap.xml',
      'http://mirandola.fr/?rejoindre=X', 'https://mirandola.fr.evil.com/?rejoindre=X', 'https://evil.com/mirandola.fr/',
      'javascript:alert(1)', 'capacitor://localhost/', '', null, 'pas une adresse']) {
      expect(lienDeLApp(u), String(u)).toBeNull();
    }
  });
  it('le fichier d’Apple dit les mêmes adresses, pour l’app de l’équipe', () => {
    const a = associationApple('ABCDE12345');
    expect(a.applinks.details[0].appIDs).toEqual(['ABCDE12345.fr.mirandola.app']);
    expect(a.webcredentials.apps).toEqual(['ABCDE12345.fr.mirandola.app']);
    expect(a.applinks.details[0].components.map(c => c['/'])).toEqual(CHEMINS_APP.map(c => c.exact || c.prefixe + '*'));
    expect(() => associationApple('<TEAM_ID>')).toThrow();
  });
  it('le fichier de Google : l’empreinte de la clé, en majuscules, refusée si elle est fausse', () => {
    const e = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join(':');
    const a = associationAndroid(e);
    expect(a[0].target).toEqual({ namespace: 'android_app', package_name: 'fr.mirandola.app', sha256_cert_fingerprints: [e.toUpperCase()] });
    expect(() => associationAndroid('AA:BB')).toThrow();
    expect(() => associationAndroid([])).toThrow();
  });
  it('le manifeste d’Android revendique exactement ces adresses, vérifiées (autoVerify)', () => {
    const m = lire('android/app/src/main/AndroidManifest.xml');
    const filtre = m.slice(m.indexOf('android:autoVerify="true"'), m.indexOf('</intent-filter>', m.indexOf('android:autoVerify="true"')));
    expect(filtre).toContain('android:host="mirandola.fr"');
    expect(filtre).toContain('android:scheme="https"');
    const dits = [...filtre.matchAll(/android:(path|pathPrefix)="([^"]+)"/g)].map(x => (x[1] === 'path' ? { exact: x[2] } : { prefixe: x[2] }));
    expect(dits).toEqual(CHEMINS_APP);
  });
});

describe('les produits des magasins', () => {
  const produit = (id, prix, extra = {}) => ({ identifier: id, product: { identifier: id, priceString: prix, ...extra } });
  const offre = {
    annual: produit('$rc_annual', '44,99 €'), monthly: produit('$rc_monthly', '5,99 €'),
    availablePackages: [
      produit('$rc_annual', '44,99 €', { identifier: 'mirandola_plus_annuel', pricePerMonthString: '3,75 €',
        introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1 } }),
      produit('$rc_monthly', '5,99 €', { identifier: 'mirandola_plus_mensuel' }),
      produit('infini_annuel', '79,99 €', { identifier: 'mirandola_infini_annuel', pricePerMonthString: '6,67 €' }),
      produit('infini_mensuel', '9,99 €', { identifier: 'mirandola_infini_mensuel' })
    ]
  };
  it('chaque formule a son paquet, et Infini n’achète jamais Mirandola+ (ni l’inverse)', () => {
    expect(paquetDe(offre, 'annuel').product.identifier).toBe('mirandola_plus_annuel');
    expect(paquetDe(offre, 'mensuel').product.identifier).toBe('mirandola_plus_mensuel');
    expect(paquetDe(offre, 'infini_annuel').product.identifier).toBe('mirandola_infini_annuel');
    expect(paquetDe(offre, 'infini_mensuel').product.identifier).toBe('mirandola_infini_mensuel');
    const sansInfini = { ...offre, availablePackages: offre.availablePackages.slice(0, 2) };
    expect(paquetDe(sansInfini, 'infini_annuel')).toBeNull();
    expect(paquetDe(offre, 'trimestriel')).toBeNull();
    expect(paquetDe(null, 'annuel')).toBeNull();
  });
  it('une offre aux seuls paquets standard vend Mirandola+', () => {
    const standard = { annual: produit('$rc_annual', '44,99 €'), monthly: produit('$rc_monthly', '5,99 €'), availablePackages: [] };
    expect(paquetDe(standard, 'annuel').identifier).toBe('$rc_annual');
    expect(paquetDe(standard, 'mensuel').identifier).toBe('$rc_monthly');
    expect(paquetDe(standard, 'infini_mensuel')).toBeNull();
  });
  it('le prix que dit le magasin, et son essai gratuit s’il en a un', () => {
    expect(prixDuPaquet(paquetDe(offre, 'annuel'))).toEqual({ prix: '44,99 €', parMois: '3,75 €', essai: { n: 7, unite: 'DAY' } });
    expect(prixDuPaquet(paquetDe(offre, 'infini_mensuel'))).toEqual({ prix: '9,99 €', parMois: null, essai: null });
    // une remise payante n'est pas un essai gratuit
    expect(prixDuPaquet(produit('x', '1 €', { introPrice: { price: 0.99, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 3 } })).essai).toBeNull();
    expect(prixDuPaquet(null)).toBeNull();
    expect(prixDuPaquet({ product: { priceString: '' } })).toBeNull();
    const tout = prixDuMagasin(offre);
    expect(Object.keys(tout)).toEqual(['annuel', 'mensuel', 'infini_annuel', 'infini_mensuel']);
    expect(prixDuMagasin(undefined)).toEqual({ annuel: null, mensuel: null, infini_annuel: null, infini_mensuel: null });
  });
  it('la durée d’un essai se lit en français', () => {
    expect(dureeEssai({ n: 7, unite: 'DAY' })).toBe('7 jours');
    expect(dureeEssai({ n: 1, unite: 'WEEK' })).toBe('1 semaine');
    expect(dureeEssai({ n: 1, unite: 'MONTH' })).toBe('1 mois');
    expect(dureeEssai(null)).toBe('');
  });
});

describe('le dossier web de l’app native', () => {
  it('ne garde que ce que l’app atteint, de fichier en fichier', () => {
    const fichiers = { 'app-1.js': 'import "./b-2.js"; x("assets/c-3.css")', 'b-2.js': '', 'c-3.css': 'url(d-4.woff2)',
      'd-4.woff2': '', 'site-5.js': 'import "./b-2.js"' };
    const vus = atteints('<script src="/assets/app-1.js">', Object.keys(fichiers), f => fichiers[f]);
    expect([...vus].sort()).toEqual(['app-1.js', 'b-2.js', 'c-3.css', 'd-4.woff2']);
  });
  it('l’app y devient la racine, sans lien de manifeste d’installation', () => {
    const app = lire('app.html');
    const n = htmlNatif(app);
    expect(app).toContain('rel="manifest"');
    expect(n).not.toContain('rel="manifest"');
    expect(n).toContain('<main id="app">');
  });
});

describe('les projets natifs, d’accord entre eux', () => {
  const config = JSON.parse(lire('capacitor.config.json'));
  const paquet = JSON.parse(lire('package.json'));
  it('un seul identifiant d’app, partout', () => {
    expect(config.appId).toBe('fr.mirandola.app');
    expect(config.webDir).toBe('dist-natif');
    expect(lire('android/app/build.gradle')).toMatch(/applicationId "fr\.mirandola\.app"/);
    const pbx = lire('ios/App/App.xcodeproj/project.pbxproj');
    expect(pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = ([\w.]+);/g)).toEqual(Array(2).fill('PRODUCT_BUNDLE_IDENTIFIER = fr.mirandola.app;'));
    expect(pbx.match(/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g)).toHaveLength(2);
    expect(pbx).toContain('PrivacyInfo.xcprivacy in Resources');
  });
  it('chaque greffon installé est dans le paquet Swift d’iOS, à la version de Capacitor', () => {
    const swift = lire('ios/App/CapApp-SPM/Package.swift');
    const greffons = Object.keys(paquet.dependencies).filter(d => d.startsWith('@capacitor/') && !['@capacitor/core', '@capacitor/ios', '@capacitor/android'].includes(d))
      .concat('@revenuecat/purchases-capacitor');
    for (const g of greffons) expect(swift, g).toContain(`node_modules/${g}"`);
    expect(swift).toContain(`exact: "${paquet.dependencies['@capacitor/ios']}"`);
    expect(paquet.dependencies['@capacitor/ios']).toBe(paquet.dependencies['@capacitor/core']);
    expect(paquet.dependencies['@capacitor/android']).toBe(paquet.dependencies['@capacitor/core']);
    expect(paquet.devDependencies['@capacitor/cli']).toBe(paquet.dependencies['@capacitor/core']);
  });
  it('iOS : chaque accès à l’appareil dit pourquoi, en français ; pas de chiffrement à déclarer ; toujours clair', () => {
    const p = lire('ios/App/App/Info.plist');
    for (const k of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription',
      'NSPhotoLibraryAddUsageDescription', 'NSSpeechRecognitionUsageDescription']) {
      expect(p, k).toMatch(new RegExp(`<key>${k}</key>\\s*<string>Mirandola [^<]{20,}</string>`));
    }
    expect(p).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
    expect(p).toMatch(/<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/);
    expect(p).toMatch(/<key>CFBundleDevelopmentRegion<\/key>\s*<string>fr<\/string>/);
    expect(lire('ios/App/App/App.entitlements')).toContain('applinks:mirandola.fr');
  });
  it('iOS : aucun pistage déclaré, et ce qui est recueilli correspond à la politique de l’app', () => {
    const p = lire('ios/App/App/PrivacyInfo.xcprivacy');
    expect(p).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    expect(p).not.toMatch(/NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/);
    for (const t of ['EmailAddress', 'Name', 'UserID', 'PurchaseHistory', 'CrashData']) expect(p).toContain('NSPrivacyCollectedDataType' + t);
    expect(p).not.toContain('NSPrivacyCollectedDataTypeAdvertisingData');
    expect(p).not.toContain('PreciseLocation');
  });
  it('Android : seulement les permissions qui servent, jamais la caméra en direct (l’appareil photo du système suffit)', () => {
    const m = lire('android/app/src/main/AndroidManifest.xml');
    const perms = [...m.matchAll(/uses-permission android:name="android\.permission\.(\w+)"/g)].map(x => x[1]).sort();
    expect(perms).toEqual(['INTERNET', 'MODIFY_AUDIO_SETTINGS', 'RECORD_AUDIO']);
    expect(m).toContain('android.media.action.IMAGE_CAPTURE');
    expect(m).toContain('android:allowBackup="false"');
    expect(m).toContain('android:usesCleartextTraffic="false"');
  });
  it('les icônes viennent de la marque, et le lancement n’a pas d’image', () => {
    expect(existsSync('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')).toBe(true);
    expect(existsSync('ios/App/App/Assets.xcassets/Splash.imageset')).toBe(false);
    expect(lire('ios/App/App/Base.lproj/LaunchScreen.storyboard')).not.toContain('<imageView');
    const res = 'android/app/src/main/res/';
    expect(readdirSync(res).filter(d => /^drawable/.test(d)).flatMap(d => readdirSync(res + d)).filter(f => f.endsWith('.png'))).toEqual([]);
  });
});
