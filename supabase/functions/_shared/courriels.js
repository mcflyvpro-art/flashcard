/* ══════════ les e-mails d'une demande de démo (2026-11-02) ══════════
   Partagé par la fonction `prevenir` et testé par vitest
   (test/courriels.test.js) : rien ici ne touche au réseau. Deux e-mails :
   l'alerte à l'éditeur (tout ce que la demande dit, et la console en un
   lien), l'accusé de réception au demandeur (ce qui va se passer). Un
   texte brut accompagne chaque HTML (les messageries qui ne lisent pas le
   HTML, et les filtres anti-spam qui le préfèrent). */

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// la mise en page commune : sobre, lisible partout (tableaux, styles en ligne)
export function gabarit(titre, corps, pied = 'Mirandola · mirandola.fr') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(titre)}</title></head>
<body style="margin:0;padding:0;background:#F6F5F1;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1D1C19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E4E0D7;border-radius:18px">
<tr><td style="padding:28px 30px 8px"><img src="https://mirandola.fr/icons/icon-192.png" width="44" height="44" alt="Mirandola" style="border-radius:11px;display:block"></td></tr>
<tr><td style="padding:8px 30px 30px;font-size:15px;line-height:1.55">
<h1 style="margin:0 0 14px;font-family:Charter,'Bitstream Charter','Sitka Text',Cambria,Georgia,serif;font-size:24px;line-height:1.2;color:#1D1C19">${esc(titre)}</h1>
${corps}
</td></tr></table>
<p style="margin:18px 0 0;font-size:12px;color:#8D887E">${esc(pied)}</p>
</td></tr></table></body></html>`;
}

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
<p style="margin:14px 0 0;font-size:13px;color:#6B675F">Répondre à cet e-mail écrit directement au contact.</p>`);
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
<p style="margin:18px 0 0">L’équipe Mirandola</p>`);
  const texte = [`Bonjour${prenom ? ' ' + prenom : ''},`, '',
    `Merci pour votre demande de démo de Mirandola Campus pour ${d.etab}. Nous revenons vers vous très vite pour l’ouvrir : 30 jours, 60 élèves, sans engagement.`,
    '', 'Une question d’ici là ? Répondez simplement à cet e-mail.', '', 'L’équipe Mirandola'].join('\n');
  return { sujet: 'Votre demande de démo Mirandola Campus', html, texte };
}

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
