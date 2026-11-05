/* L'identité de l'entreprise qui édite Mirandola, ce que les mentions
   légales et les conditions de vente doivent dire (LCEN, code de la
   consommation). Sans dépendance, à part de src/editeur.js pour ne pas
   peser sur le démarrage : seuls ui/legal-textes.js (chargé à la demande)
   et les documents d'un établissement la lisent. Les ⟦crochets⟧ se
   remplissent le jour de l'immatriculation (extrait Kbis ou avis de
   situation SIRENE) et de l'adhésion à un médiateur de la consommation. */
export const ENTREPRISE = {
  forme: '⟦forme juridique et capital, par exemple « SASU au capital de 1 000 € »⟧',
  adresse: '⟦adresse du siège⟧',
  immatriculation: '⟦SIREN et ville du RCS, par exemple « 912 345 678 RCS Paris »⟧',
  tva: '⟦numéro de TVA intracommunautaire, ou « TVA non applicable, article 293 B du CGI »⟧',
  directeur: '⟦prénom et nom du directeur de la publication⟧',
  mediateur: '⟦nom, adresse postale et site du médiateur de la consommation⟧'
};

// l'adresse officielle, celle de ses conditions d'utilisation (vercel.com/legal/terms)
export const HEBERGEUR = 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com)';
