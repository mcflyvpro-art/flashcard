import {
  auth, mateProf, mateProfSeq, me, menu, prefs, setMateProf, setMateProfSeq
} from '../data/etat.js';
import { api } from './coeur-sync.js';
import { paintMenu } from '../ui/menus-a.js';

export async function mateProfPull(id) {
  const seq = setMateProfSeq(mateProfSeq + 1), range = mateProf.range;
  mateProf.load = 1;
  if (mateProf.id !== id) setMateProf({ id, range, row: null, lib: null, load: 1 });
  let row = null, lib = null;
  try {
    const rows = await api('/rest/v1/rpc/leaderboard', 'POST', { days: range }) || [];
    row = rows.find(x => x.uid === id) || { n: 0, ok: 0, jours: 0 };
  } catch (e) {}
  try {
    lib = await api('/rest/v1/library?select=deck_id,name,subject,n,updated_at'
      + `&user_id=eq.${id}&order=updated_at.desc&limit=20`) || [];
  } catch (e) {}
  if (seq !== mateProfSeq) return;        // une demande plus récente est déjà en vol
  if (row) mateProf.row = row;
  if (lib) mateProf.lib = lib;
  mateProf.load = 0;
  if (menu === 'mateprof') paintMenu();
}

/* Un mot d'un professeur à un élève : une entrée de courrier sans pièce
   jointe, juste un message. */
export function sendMotProf(eleveId, texte) {
  return api('/rest/v1/mail', 'POST', [{
    from_user: auth.uid, to_user: eleveId,
    from_name: prefs.name || (me && me.handle) || 'Compte', deck_name: '', message: texte.slice(0, 600), cards: []
  }], { Prefer: 'return=minimal' });
}

export function deleteAssignment(id) {
  return api('/rest/v1/assignments?id=eq.' + encodeURIComponent(id), 'DELETE', null,
    { Prefer: 'return=minimal' });
}

export function changePassword(pw) {
  return api('/auth/v1/user', 'PUT', { password: pw });
}

export function deleteAccount() {
  return api('/rest/v1/rpc/delete_me', 'POST', {});
}
