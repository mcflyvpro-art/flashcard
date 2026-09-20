import { I } from '../icones.js';
import { auth, groups, menu, setAnimate, setGroups, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { api } from './coeur-sync.js';
import { toast } from '../ui/import-cartes.js';
import { closeMenu, paintMenu } from '../ui/menus-a.js';

/* ══════════ communauté ══════════
   Un centre unique : qui tu es, qui tu connais, les groupes, les défis,
   l'étagère commune et le classement. Le reste de l'app n'a plus à parler
   de « groupe » ici et là — tout ce qui concerne les autres vit ici. */
export async function groupsPull() {
  try {
    const rows = await api('/rest/v1/group_members?select=group_id,groups(id,name,code,owner)');
    setGroups((rows || []).map(r => r.groups).filter(Boolean));
  } catch (e) { setGroups(groups || []); }
  if (view.name === 'commu' || view.name === 'groups') { setAnimate(false); render(); }
  if (menu) paintMenu();
}

export async function makeGroup(name) {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(5)),
    b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
  try {
    const [g] = await api('/rest/v1/groups', 'POST',
      [{ name: (name || '').trim() || 'Mon club', code, owner: auth.uid }],
      { Prefer: 'return=representation' }) || [];
    if (g) await api('/rest/v1/group_members', 'POST', [{ group_id: g.id, user_id: auth.uid }],
      { Prefer: 'return=minimal' });
    closeMenu(); setGroups(null); groupsPull();
    toast(I.check, 'Club créé · code ' + code);
  } catch (e) { toast(I.x, 'Création impossible'); }
}

export async function joinGroup(code) {
  try {
    const [g] = await api('/rest/v1/rpc/join_group', 'POST', { join_code: code }) || [];
    closeMenu(); setGroups(null); groupsPull();
    toast(I.check, g ? 'Bienvenue dans ' + g.name : 'Club rejoint');
  } catch (e) { toast(I.x, 'Code inconnu'); }
}

export async function leaveGroup(id) {
  try {
    await api(`/rest/v1/group_members?group_id=eq.${id}&user_id=eq.${auth.uid}`, 'DELETE',
      null, { Prefer: 'return=minimal' });
  } catch (e) { /* échec réseau : groupsPull() qui suit rétablira l'état exact */ }
  closeMenu(); setGroups(null); groupsPull();
}
