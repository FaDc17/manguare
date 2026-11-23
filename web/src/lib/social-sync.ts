import type { CommunityListing } from './community';
import { fetchWithTimeout } from './fetch-timeout';
import { apiUrl } from './api-url';
import {
  type Post,
  type SocialState,
  type SyncPatch,
} from './social';


function headers(phone: string): HeadersInit {
  return { 'content-type': 'application/json', 'x-manguare-phone': phone };
}

/** Solo un 2xx confirma que el servidor guardó el cambio. */
function settled(status: number): boolean {
  return status >= 200 && status < 300;
}

async function call(phone: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetchWithTimeout(apiUrl(`/api/social${path}`), { ...init, headers: headers(phone) }, 10_000);
}

export interface SocialSyncResult {
  patches: SyncPatch[];
  /** null si algún envío falló o no se pudo leer el muro. */
  serverPosts: Post[] | null;
}

/** Lectura pura del mercado para el agente; no envía publicaciones pendientes. */
export async function readRemoteListings(phone: string, signal?: AbortSignal): Promise<CommunityListing[] | null> {
  try {
    const response = await call(phone, '/listings', { cache: 'no-store', signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { listings?: CommunityListing[] };
    return Array.isArray(data.listings) ? data.listings : null;
  } catch {
    return null;
  }
}

/** Consulta el muro sin enviar acciones pendientes del dispositivo. */
export async function readRemotePosts(phone: string, signal?: AbortSignal): Promise<Post[] | null> {
  try {
    const response = await call(phone, '/posts', { cache: 'no-store', signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { posts?: Post[] };
    return Array.isArray(data.posts) ? data.posts : null;
  } catch {
    return null;
  }
}

/** Envía lo pendiente (en orden) y luego descarga el muro. Nunca lanza: sin red devuelve lo que alcanzó. */
export async function syncPosts(phone: string, state: SocialState): Promise<SocialSyncResult> {
  const patches: SyncPatch[] = [];
  let allSent = true;
  try {
    for (const id of state.pendingDeletes) {
      const res = await call(phone, `/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (settled(res.status) || res.status === 404) patches.push({ type: 'deleted', id });
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
