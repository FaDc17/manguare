import type { CommunityListing } from './community';
import {
  type Post,
  type SocialState,
  type SyncPatch,
} from './social';

const API = '/api/social';

function headers(phone: string): HeadersInit {
  return { 'content-type': 'application/json', 'x-manguare-phone': phone };
}

/** 2xx = listo. 404/400/403 = el servidor jamás lo aceptará: se da por resuelto para no reintentar siempre. */
function settled(status: number): boolean {
  return (status >= 200 && status < 300) || status === 400 || status === 403 || status === 404;
}

async function call(phone: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, { ...init, headers: headers(phone), signal: AbortSignal.timeout(10_000) });
}

export interface SocialSyncResult {
  patches: SyncPatch[];
  /** null si algún envío falló o no se pudo leer el muro. */
  serverPosts: Post[] | null;
}

/** Envía lo pendiente (en orden) y luego descarga el muro. Nunca lanza: sin red devuelve lo que alcanzó. */
export async function syncPosts(phone: string, state: SocialState): Promise<SocialSyncResult> {
  const patches: SyncPatch[] = [];
  let allSent = true;
  try {
    for (const id of state.pendingDeletes) {
      const res = await call(phone, `/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (settled(res.status)) patches.push({ type: 'deleted', id });
      else allSent = false;
    }
    for (const post of state.posts) {
      if (post.synced === false) {
        const res = await call(phone, '/posts', {
          method: 'POST',
          body: JSON.stringify({
            id: post.id,
            author: post.author,
            community: post.community,
            text: post.text,
            photo: post.photo,
          }),
        });
        if (settled(res.status)) patches.push({ type: 'posted', id: post.id });
        else {
          allSent = false;
          continue;
        }
      }
      for (const comment of post.comments) {
        if (comment.synced !== false || post.synced === undefined) continue;
        const res = await call(phone, `/posts/${encodeURIComponent(post.id)}/comments`, {
          method: 'POST',
          body: JSON.stringify({ id: comment.id, author: comment.author, text: comment.text }),
        });
        if (settled(res.status)) patches.push({ type: 'commented', postId: post.id, commentId: comment.id });
        else allSent = false;
      }
      if (post.likeDirty) {
        const res = await call(phone, `/posts/${encodeURIComponent(post.id)}/like`, {
          method: 'POST',
          body: JSON.stringify({ on: post.likedByMe }),
        });
        if (settled(res.status)) patches.push({ type: 'liked', id: post.id, on: post.likedByMe });
        else allSent = false;
      }
    }
    if (!allSent) return { patches, serverPosts: null };
    const res = await call(phone, '/posts');
    if (!res.ok) return { patches, serverPosts: null };
    const data = (await res.json()) as { posts?: Post[] };
    return { patches, serverPosts: Array.isArray(data.posts) ? data.posts : null };
  } catch {
    return { patches, serverPosts: null };
  }
}

/** Envía mis publicaciones pendientes del mercado y trae las del servidor. null = sin conexión. */
export async function syncListings(
  phone: string,
  local: CommunityListing[],
): Promise<{ sent: string[]; server: CommunityListing[] | null }> {
  const sent: string[] = [];
  try {
    for (const listing of local) {
      if (listing.synced !== false) continue;
      const { synced: _synced, mine: _mine, ...body } = listing;
      const res = await call(phone, '/listings', { method: 'POST', body: JSON.stringify(body) });
      if (settled(res.status)) sent.push(listing.id);
      else return { sent, server: null };
    }
    const res = await call(phone, '/listings');
    if (!res.ok) return { sent, server: null };
    const data = (await res.json()) as { listings?: CommunityListing[] };
    return { sent, server: Array.isArray(data.listings) ? data.listings : null };
  } catch {
    return { sent, server: null };
  }
}

export async function deleteRemoteListing(phone: string, id: string): Promise<void> {
  try {
    await call(phone, `/listings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    /* sin conexión: reaparecerá al sincronizar; se podrá borrar de nuevo */
  }
}
