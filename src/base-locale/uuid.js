/* Un identifiant v4, sans dépendance. `crypto.randomUUID` n'existe que dans
   un contexte sûr (https, localhost) : servie sur une adresse de réseau
   local en http, la démo doit marcher quand même. */
export function uuid() {
  const c = globalThis.crypto;
  if (c && c.randomUUID) return c.randomUUID();
  const o = c.getRandomValues(new Uint8Array(16));
  o[6] = (o[6] & 0x0f) | 0x40; o[8] = (o[8] & 0x3f) | 0x80;
  const h = [...o].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
