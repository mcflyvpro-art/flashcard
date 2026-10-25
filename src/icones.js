/* Les glyphes SVG de l'app, et le peu qui les accompagne (`svg`,
   `SWIPE`) : un module à part, sans aucune dépendance, précisément pour
   que rien d'autre ne puisse créer de cycle d'import à travers lui — une
   variable qui dépend en boucle de I au moment même où I s'initialise
   plante (« Cannot access before initialization »), constaté une fois
   avec app.js unique avant M06.T3, gardé ici en tête pour ne pas le
   refaire. */
/* ---------- icônes ----------
   Les emblèmes des classes et des clubs (et donc trophée, couronne, étoile,
   éclair…) viennent de Lucide (lucide.dev, v0.460.0), copiés ici tels quels
   — aucune dépendance à l'exécution. Licence ISC : Copyright (c) for
   portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather
   (MIT). All other copyright (c) for Lucide are held by Lucide Contributors
   2022. Permission to use, copy, modify, and/or distribute this software for
   any purpose with or without fee is hereby granted. */
export const I = {
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M8.5 5.6l10 6.4-10 6.4z" fill="currentColor" stroke-linejoin="round"/>',
  pen: '<path d="M4.5 19.5h3.6L19 8.6a1.9 1.9 0 0 0-2.7-2.7L5.2 16.5v3z"/><path d="M14.5 7.7l2.8 2.8"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5.2h5V7M6.5 7l.9 12.3h9.2L17.5 7"/><path d="M10.4 10.5v5.6M13.6 10.5v5.6"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M4.5 12.8l4.8 4.7L19.5 6.8"/>',
  down: '<path d="M12 4v11m0 0l-4.4-4.4M12 15l4.4-4.4M4.5 19.5h15"/>',
  share: '<path d="M12 3.5v12M12 3.5L7.8 7.7M12 3.5l4.2 4.2M5 14v6.5h14V14"/>',
  redo: '<path d="M4.2 11.6a7.8 7.8 0 1 1 2.4 6M4.2 11.6V6.4m0 5.2h5.2"/>',
  shuffle: '<path d="M3.5 6.5h3.8l9.4 11h3.8M3.5 17.5h3.8l2.9-3.4M20.5 17.5l-2.6-2.6M20.5 6.5l-2.6 2.6M14.4 8.9L16.9 6.5h3.6"/>',
  layers: '<path d="M12 3.4l8.6 4.7-8.6 4.7-8.6-4.7z"/><path d="M3.4 12.6l8.6 4.7 8.6-4.7"/><path d="M3.4 16.9l8.6 4.7 8.6-4.7"/>',
  eye: '<path d="M2.4 12S6 5.9 12 5.9 21.6 12 21.6 12 18 18.1 12 18.1 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="2.7"/>',
  eyeoff: '<path d="M3.2 3.2l17.6 17.6"/><path d="M10.7 6.1A10.5 10.5 0 0 1 12 6c6 0 9.6 6 9.6 6a17.3 17.3 0 0 1-3.2 3.7M6.6 7.7A16.7 16.7 0 0 0 2.4 12s3.6 6 9.6 6a10 10 0 0 0 3.4-.6"/><path d="M9.9 10.1a2.8 2.8 0 0 0 4 4"/>',
  arrow: '<path d="M4.5 12h14m0 0l-5.2-5.2M18.5 12l-5.2 5.2"/>',
  out: '<path d="M14 4.5h4.2a1.3 1.3 0 0 1 1.3 1.3v12.4a1.3 1.3 0 0 1-1.3 1.3H14"/><path d="M9.6 8.2 5.4 12l4.2 3.8M5.8 12H15"/>',
  more: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  card: '<rect x="3" y="5.2" width="18" height="13.6" rx="3"/><path d="M7.2 10h6M7.2 13.4h9"/>',
  tag: '<path d="M11.4 3.6H20v8.6l-8.8 8.8a1.6 1.6 0 0 1-2.3 0l-6.3-6.3a1.6 1.6 0 0 1 0-2.3z"/><circle cx="16.3" cy="7.7" r="1.3"/>',
  book: '<path d="M12 7v14"/> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/> <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/> <path d="M4 22h16"/> <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/> <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/> <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  target: '<circle cx="12" cy="12" r="10"/> <circle cx="12" cy="12" r="6"/> <circle cx="12" cy="12" r="2"/>',
  swipe: '<path d="M22 6l-5 6 5 6M17 12h13M50 6l5 6-5 6M55 12H42"/>',
  cloud: '<path d="M7.2 18.4a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6-1.1 3.8 3.8 0 0 1-.4 9.1"/><path d="M12 20.4v-8.6m0 0L9.3 14.5M12 11.8l2.7 2.7"/>',
  cloudok: '<path d="M7.2 18.4a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6-1.1 3.8 3.8 0 0 1-.4 9.1"/><path d="M9.6 14.2l1.9 1.9 3.2-3.6"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  user: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0"/>',
  mail: '<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="3"/><path d="M3.4 7.6l8.6 5.6 8.6-5.6"/>',
  lock: '<rect x="4.6" y="10.4" width="14.8" height="9.4" rx="3"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
  swap: '<path d="M4 8.6h13.5m0 0l-3.6-3.6M17.5 8.6l-3.6 3.6"/><path d="M20 15.4H6.5m0 0l3.6-3.6M6.5 15.4l3.6 3.6"/>',
  key: '<circle cx="8.2" cy="15.8" r="3.5"/><path d="M10.7 13.3L19.4 4.6M16.4 7.6l2.1 2.1M14 10l2.1 2.1"/>',
  exit: '<path d="M9.5 4.5H6a1.9 1.9 0 0 0-1.9 1.9v11.2A1.9 1.9 0 0 0 6 19.5h3.5"/><path d="M13.5 8.2l3.8 3.8-3.8 3.8M17 12H9.5"/>',
  spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/> <path d="M20 3v4"/> <path d="M22 5h-4"/> <path d="M4 17v2"/> <path d="M5 18H3"/>',
  sound: '<path d="M4.5 9.4h3L12 5.8v12.4L7.5 14.6h-3z"/><path d="M15.9 9.4a3.6 3.6 0 0 1 0 5.2M18.3 7a7 7 0 0 1 0 10"/>',
  mute: '<path d="M4.5 9.4h3L12 5.8v12.4L7.5 14.6h-3z"/><path d="M16 9.6l4.4 4.8M20.4 9.6L16 14.4"/>',
  mic: '<rect x="9" y="3.2" width="6" height="11" rx="3"/><path d="M5.5 11.4a6.5 6.5 0 0 0 13 0M12 18v2.8"/>',
  file: '<path d="M13.4 3.6H7.4a2 2 0 0 0-2 2v12.8a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.8z"/><path d="M13.4 3.6v5.2h5.2"/><path d="M8.8 13.4h6.4M8.8 16.6h4.2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="3.2"/><circle cx="8.6" cy="10" r="1.5"/><path d="M4.2 17.4l4.6-4.3 3.4 3 3-2.6 4.6 4"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/> <path d="M9 18h6"/> <path d="M10 22h4"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="2"/><rect x="13.4" y="3.6" width="7" height="7" rx="2"/><rect x="3.6" y="13.4" width="7" height="7" rx="2"/><rect x="13.4" y="13.4" width="7" height="7" rx="2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.4 6.9"/><path d="M14 10a4 4 0 0 0-5.7 0L5.5 12.8a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
  grip: '<path d="M9.4 6.4h.02M9.4 12h.02M9.4 17.6h.02M14.6 6.4h.02M14.6 12h.02M14.6 17.6h.02" stroke-width="2.9" stroke-linecap="round"/>',
  pick: '<path d="M5.4 9.2V6.6a1.2 1.2 0 0 1 1.2-1.2h2.6M14.8 5.4h2.6a1.2 1.2 0 0 1 1.2 1.2v2.6"/><path d="M18.6 14.8v2.6a1.2 1.2 0 0 1-1.2 1.2h-2.6M9.2 18.6H6.6a1.2 1.2 0 0 1-1.2-1.2v-2.6"/><path d="m9.3 12.1 2 2 3.4-3.9"/>',
  warn: '<path d="M12 4.6 3.2 19.4h17.6z"/><path d="M12 10.2v4.2M12 17.1h.02" stroke-width="2.4"/>',
  pin: '<path d="M9.4 3.8h5.2l-.6 5.2 3 3.2H7l3-3.2z"/><path d="M12 12.2v7.4"/>',
  sort: '<path d="M4.6 7h9.8M4.6 12h6.6M4.6 17h3.4"/><path d="M17.4 6.6v10.8m0 0 2.4-2.6m-2.4 2.6-2.4-2.6"/>',
  rows: '<rect x="3.6" y="5" width="16.8" height="4.4" rx="1.6"/><rect x="3.6" y="14.6" width="16.8" height="4.4" rx="1.6"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.4" y="12" width="3" height="5" rx="1"/><rect x="12.4" y="8.4" width="3" height="8.6" rx="1"/><rect x="17.4" y="5.6" width="3" height="11.4" rx="1"/>',
  quote: '<rect x="3.6" y="4.4" width="16.8" height="12.2" rx="3.4"/><path d="M8.8 16.6v3.3l4.2-3.3"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="M15.5 15.5 20 20"/>',
  copy: '<rect x="8.6" y="8.6" width="11.8" height="11.8" rx="3"/><path d="M15.4 5.6a2 2 0 0 0-2-2H6.6a3 3 0 0 0-3 3v6.8a2 2 0 0 0 2 2"/>',
  split: '<path d="M12 3.6v6.8"/><path d="M12 10.4 6.6 15v5.4M12 10.4 17.4 15v5.4"/><circle cx="12" cy="3.6" r="0"/>',
  type: '<path d="M4.5 7.5V5.5h15v2M12 5.5v13M8.8 18.5h6.4"/>',
  skip: '<path d="M6 5.6l9 6.4-9 6.4z"/><path d="M18 5.6v12.8"/>',
  brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/> <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/> <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/> <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/> <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/> <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/> <path d="M19.938 10.5a4 4 0 0 1 .585.396"/> <path d="M6 18a4 4 0 0 1-1.967-.516"/> <path d="M19.967 17.484A4 4 0 0 1 18 18"/>',
  school: '<path d="M12 4 2.8 8.4 12 12.8l9.2-4.4z"/><path d="M6.6 10.6v5.2c0 1.6 2.4 3 5.4 3s5.4-1.4 5.4-3v-5.2"/><path d="M21.2 8.4v5.4"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/> <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/> <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/> <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/> <path d="M5 21h14"/>',
  bolt: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  owl: '<path d="M16 7h.01"/> <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/> <path d="m20 7 2 .5-2 .5"/> <path d="M10 18v3"/> <path d="M14 17.75V21"/> <path d="M7 18a6 6 0 0 0 3.84-10.61"/>',
  globe: '<circle cx="12" cy="12" r="10"/> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/> <path d="M2 12h20"/>',
  flask: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/> <path d="M8.5 2h7"/> <path d="M7 16h10"/>',
  music: '<path d="M9 18V5l12-2v13"/> <circle cx="6" cy="18" r="3"/> <circle cx="18" cy="16" r="3"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/> <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/> <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  atom: '<circle cx="12" cy="12" r="1"/> <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/> <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
  sigma: '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
  hash: '<path d="M9.6 4.4L8 19.6M16 4.4l-1.6 15.2M5 9h14.6M4.4 15h14.6"/>',
  /* une médaille : ruban et disque (le disque prend la couleur du métal, `color`) */
  medaille: '<path d="M8.3 2.6L11 9.2M15.7 2.6L13 9.2" stroke="#B9473C" stroke-width="2.4"/><circle cx="12" cy="14.6" r="6.6" fill="currentColor" stroke="rgba(0,0,0,.12)" stroke-width="1"/>',
  podium: '<path d="M9 9.4h6v10.2H9zM3.6 13.4H9v6.2H3.6zM15 15.4h5.4v4.2H15z"/><path d="M12 3.6l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
  users: '<circle cx="9.4" cy="8.6" r="3.4"/><path d="M3.4 19.4a6 6 0 0 1 12 0"/><path d="M16.2 5.6a3.4 3.4 0 0 1 0 6.6M17.6 14.4a5.6 5.6 0 0 1 3.4 5"/>',
  build: '<path d="M4 20.4V9.6l7-4.2 7 4.2v10.8"/><path d="M2.4 20.4h19.2"/><rect x="8.2" y="12.4" width="5.6" height="8"/>',
  mail2: '<rect x="3" y="5.4" width="18" height="13.2" rx="2.6"/><path d="m3.8 7 8.2 5.6L20.2 7"/>',
  refresh: '<path d="M20 11.2a8 8 0 0 0-13.8-4.8L3.6 9"/><path d="M4 12.8a8 8 0 0 0 13.8 4.8L20.4 15"/><path d="M3.6 4.4V9h4.6M20.4 19.6V15h-4.6"/>',
  cal: '<rect x="3.4" y="5" width="17.2" height="15.4" rx="3"/><path d="M3.4 9.6h17.2M8.2 3.4v3.4M15.8 3.4v3.4"/>',
  money: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7v10M14.6 9.4a2.8 2.8 0 0 0-2.6-1.4c-1.6 0-2.6.9-2.6 2s.9 1.8 2.6 2.1c1.7.3 2.6 1 2.6 2.1s-1 2-2.6 2a2.8 2.8 0 0 1-2.6-1.4"/>'
};

export const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;

export const SWIPE = `<svg viewBox="0 0 72 24">${I.swipe}</svg>`;
