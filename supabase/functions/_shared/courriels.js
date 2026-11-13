/* ══════════ les e-mails d'une demande de démo (2026-11-02) ══════════
   Partagé par la fonction `prevenir` et testé par vitest
   (test/courriels.test.js) : rien ici ne touche au réseau. Deux e-mails :
   l'alerte à l'éditeur (tout ce que la demande dit, et la console en un
   lien), l'accusé de réception au demandeur (ce qui va se passer). Un
   texte brut accompagne chaque HTML (les messageries qui ne lisent pas le
   HTML, et les filtres anti-spam qui le préfèrent). */

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ---------- la mise en page (2026-11-02, refaite pour les modèles de Supabase Auth) ----------
   Ce que toutes les messageries savent lire : des tableaux, des styles en
   ligne et en propriétés longues (Outlook ignore `font:`), aucune police à
   télécharger, aucune image indispensable (le logo a son texte à côté). La
   marque de l'app : le papier #F6F5F1, l'encre #1D1C19, la serif des
   titres, le filet bleu-violet-rose en tête de la carte (une couleur pleine
   pour qui ne lit pas les dégradés), un bouton plein à l'encre. Un aperçu
   caché (`apercu`) donne la ligne qu'on lit dans la liste des e-mails. */
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Charter,'Bitstream Charter','Sitka Text',Cambria,Georgia,serif";
const texte = (taille, couleur, extra = '') =>
  `font-family:${SANS};font-size:${taille}px;line-height:1.6;color:${couleur};${extra}`;

export function gabarit(titre, corps, { pied = 'Mirandola · mirandola.fr', apercu = '' } = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(titre)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F6F5F1;-webkit-text-size-adjust:100%">
${apercu ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${apercu}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>\n` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6F5F1">
<tr><td align="center" style="padding:36px 14px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="https://mirandola.fr/icons/icon-192.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${SERIF};font-size:21px;font-weight:700;letter-spacing:-0.3px;color:#1D1C19">Mirandola</td>
</tr></table>
</td></tr>
<tr><td style="background-color:#FFFFFF;border:1px solid #E9E5DC;border-radius:20px">
<div style="height:4px;line-height:4px;font-size:0;border-radius:20px 20px 0 0;background-color:#80439C;background-image:linear-gradient(90deg,#3E4FA0,#80439C,#B33F6C)">&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:30px 26px 32px;${texte(15.5, '#3B3A36')}">
<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.4px;color:#1D1C19">${esc(titre)}</h1>
${corps}
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 18px 0;${texte(12.5, '#8D887E')}">${pied}<br>
<a href="https://mirandola.fr" style="color:#8D887E;text-decoration:underline">mirandola.fr</a> &middot; <a href="https://mirandola.fr/mentions/confidentialite" style="color:#8D887E;text-decoration:underline">Confidentialité</a> &middot; <a href="mailto:contact@mirandola.fr" style="color:#8D887E;text-decoration:underline">contact@mirandola.fr</a></td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

// les pièces d'un e-mail, les mêmes partout
export const para = (html, haut = 12) => `<p style="margin:${haut}px 0 0">${html}</p>`;
export const bouton = (lien, libelle) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px"><tr>
<td align="center" bgcolor="#1D1C19" style="border-radius:999px"><a href="${lien}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:999px">${libelle}&nbsp;&rarr;</a></td>
</tr></table>`;
export const secours = lien => `<p style="margin:18px 0 0;${texte(12.5, '#8D887E')}">Le bouton ne s’ouvre pas&#8239;? Copie ce lien dans ton navigateur&#8239;:<br><a href="${lien}" style="color:#3E4FA0;word-break:break-all">${lien}</a></p>`;
export const encadre = html => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr>
<td style="padding:14px 16px;background-color:#F6F5F1;border-radius:14px;${texte(13.5, '#5B574F', 'line-height:1.55;')}">${html}</td>
</tr></table>`;
export const code = valeur => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px"><tr>
<td align="center" style="padding:20px 12px;background-color:#F6F5F1;border:1px dashed #D9D3C7;border-radius:14px;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#1D1C19">${valeur}</td>
</tr></table>`;
// une liste courte, chaque ligne marquée d'un point à la couleur de la marque
export const liste = lignes => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">${lignes.map(l => `<tr>
<td style="vertical-align:top;padding:2px 10px 6px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:#80439C">&#9679;</td>
<td style="vertical-align:top;padding:2px 0 6px;${texte(14.5, '#3B3A36', 'line-height:1.5;')}">${l}</td></tr>`).join('')}</table>`;

const ligne = (k, v) => (v || v === 0 ? `<tr><td style="padding:6px 12px 6px 0;color:#6B675F;white-space:nowrap;vertical-align:top">${esc(k)}</td>`
  + `<td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>` : '');

/* La demande, telle que la fonction la relit (org_suivi et son établissement). */
export function champsDemande(d) {
  return [
    ['Établissement', d.etab], ['Ville', d.ville], ['Contact', d.contact_nom], ['Fonction', d.contact_fonction],
    ['E-mail', d.contact_email], ['Téléphone', d.contact_tel],
    ['Élèves', d.eleves_estimes != null ? String(d.eleves_estimes) : '']
  ].filter(([, v]) => v);
}

export function alerteDemande(d, site = 'https://mirandola.fr') {
  const champs = champsDemande(d);
  const message = d.message ? `<p style="margin:16px 0 0;padding:14px 16px;background:#F6F5F1;border-radius:12px;white-space:pre-wrap">${esc(d.message)}</p>` : '';
  const html = gabarit(`Demande de démo : ${d.etab}`,
    `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px">${champs.map(([k, v]) => ligne(k, v)).join('')}</table>
${message}
<p style="margin:22px 0 0"><a href="${esc(site)}/admin" style="display:inline-block;padding:12px 20px;border-radius:99px;background:#1D1C19;color:#FFFFFF;text-decoration:none;font-weight:700">Ouvrir la console</a></p>
<p style="margin:14px 0 0;font-size:13px;color:#6B675F">Répondre à cet e-mail écrit directement au contact.</p>`,
    { apercu: esc(`${d.contact_nom || 'Un contact'}${d.contact_fonction ? ', ' + d.contact_fonction : ''}${d.eleves_estimes != null ? ' · ' + d.eleves_estimes + ' élèves' : ''}`) });
  const texte = [`Demande de démo : ${d.etab}`, '', ...champs.map(([k, v]) => `${k} : ${v}`),
    ...(d.message ? ['', d.message] : []), '', `Console : ${site}/admin`].join('\n');
  return { sujet: `Demande de démo : ${d.etab}${d.ville ? ' (' + d.ville + ')' : ''}`, html, texte };
}

export function accuseDemande(d) {
  const prenom = String(d.contact_nom || '').trim().split(/\s+/)[0] || '';
  const html = gabarit('Votre demande est bien arrivée',
    `<p style="margin:0">Bonjour${prenom ? ' ' + esc(prenom) : ''},</p>
<p style="margin:12px 0 0">Merci pour votre demande de démo de Mirandola Campus pour <b>${esc(d.etab)}</b>. Nous revenons vers vous très vite pour l’ouvrir&#8239;: 30 jours, 60 élèves, sans engagement.</p>
<p style="margin:12px 0 0">Une question d’ici là&#8239;? Répondez simplement à cet e-mail.</p>
<p style="margin:18px 0 0">L’équipe Mirandola</p>`, { apercu: 'Nous revenons vers vous très vite pour ouvrir votre démo.' });
  const texte = [`Bonjour${prenom ? ' ' + prenom : ''},`, '',
    `Merci pour votre demande de démo de Mirandola Campus pour ${d.etab}. Nous revenons vers vous très vite pour l’ouvrir : 30 jours, 60 élèves, sans engagement.`,
    '', 'Une question d’ici là ? Répondez simplement à cet e-mail.', '', 'L’équipe Mirandola'].join('\n');
  return { sujet: 'Votre demande de démo Mirandola Campus', html, texte };
}

/* La demande d'un professeur particulier (2026-11-13) : à part de tout
   établissement — rien de Campus, ni dans l'alerte, ni dans l'accusé. */
export const champsDemandeProf = d => [
  ['Professeur', d.nom], ['E-mail', d.email], ['Téléphone', d.tel],
  ['Élèves', d.eleves != null ? String(d.eleves) : '']
].filter(([, v]) => v);

export function alerteDemandeProf(d, site = 'https://mirandola.fr') {
  const champs = champsDemandeProf(d);
  const message = d.message ? `<p style="margin:16px 0 0;padding:14px 16px;background:#F6F5F1;border-radius:12px;white-space:pre-wrap">${esc(d.message)}</p>` : '';
  const html = gabarit(`Professeur particulier : ${d.nom}`,
    `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px">${champs.map(([k, v]) => ligne(k, v)).join('')}</table>
${message}
<p style="margin:22px 0 0"><a href="${esc(site)}/admin/comptes" style="display:inline-block;padding:12px 20px;border-radius:99px;background:#1D1C19;color:#FFFFFF;text-decoration:none;font-weight:700">Ouvrir son compte</a></p>
<p style="margin:14px 0 0;font-size:13px;color:#6B675F">Répondre à cet e-mail écrit directement au professeur.</p>`,
    { apercu: esc(`${d.nom}${d.eleves != null ? ' · ' + d.eleves + ' élèves' : ''}`) });
  const texte = [`Professeur particulier : ${d.nom}`, '', ...champs.map(([k, v]) => `${k} : ${v}`),
    ...(d.message ? ['', d.message] : []), '', `Console : ${site}/admin/comptes`].join('\n');
  return { sujet: `Professeur particulier : ${d.nom}`, html, texte };
}

export function accuseDemandeProf(d) {
  const prenom = String(d.nom || '').trim().split(/\s+/)[0] || '';
  const html = gabarit('Votre demande est bien arrivée',
    `<p style="margin:0">Bonjour${prenom ? ' ' + esc(prenom) : ''},</p>
<p style="margin:12px 0 0">Merci pour votre demande d’espace professeur sur Mirandola. Nous ouvrons votre compte très vite&#8239;: votre code, vos classes, vos élèves qui vous rejoignent.</p>
<p style="margin:12px 0 0">Une question d’ici là&#8239;? Répondez simplement à cet e-mail.</p>
<p style="margin:18px 0 0">L’équipe Mirandola</p>`, { apercu: 'Nous ouvrons votre espace professeur très vite.' });
  const texte = [`Bonjour${prenom ? ' ' + prenom : ''},`, '',
    'Merci pour votre demande d’espace professeur sur Mirandola. Nous ouvrons votre compte très vite : votre code, vos classes, vos élèves qui vous rejoignent.',
    '', 'Une question d’ici là ? Répondez simplement à cet e-mail.', '', 'L’équipe Mirandola'].join('\n');
  return { sujet: 'Votre espace professeur Mirandola', html, texte };
}

// une demande de professeur à prévenir : la même règle, sans source (la table ne reçoit que des demandes)
export const aPrevenirProf = (d, maintenant = Date.now()) => !!d && !d.prevenu_le && maintenant - Date.parse(d.cree) < 2 * 3600 * 1000;

/* Ce qu'on envoie à Brevo (API transactionnelle, POST /v3/smtp/email). */
export function envoiBrevo({ de, nom = 'Mirandola', a, repondreA, courriel }) {
  const e = { sender: { name: nom, email: de }, to: [{ email: a }], subject: courriel.sujet,
    htmlContent: courriel.html, textContent: courriel.texte };
  if (repondreA) e.replyTo = { email: repondreA };
  return e;
}

// une demande à prévenir : jamais deux fois, jamais une ancienne (deux heures au plus)
export const aPrevenir = (d, maintenant = Date.now()) => !!d && d.source === 'demande' && !d.prevenu_le
  && maintenant - Date.parse(d.cree) < 2 * 3600 * 1000;
