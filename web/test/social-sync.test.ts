import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applySync, type SocialState } from '../src/lib/social';
import { syncListings, syncPosts } from '../src/lib/social-sync';

const phone = '992066275';
const pendingPost: SocialState = {
  posts: [{ id: 'post-regression', author: 'Ana', community: 'Prueba', text: 'Mensaje',
    at: new Date().toISOString(), likes: 0, likedByMe: false, comments: [], synced: false }],
  swiped: {}, matches: [], chats: {}, pendingDeletes: [],
};

test('una publicación rechazada permanece pendiente y visible', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'invalid_post' }), { status: 400 });
  try {
    const result = await syncPosts(phone, pendingPost);
    assert.equal(result.serverPosts, null);
    assert.equal(result.patches.length, 0);
    const next = applySync(pendingPost, result.patches, result.serverPosts);
    assert.equal(next.posts[0].synced, false);
    assert.equal(next.posts[0].id, 'post-regression');
  } finally {
    globalThis.fetch = original;
  }
});

test('un anuncio rechazado no se marca como sincronizado', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 403 });
  try {
    const result = await syncListings(phone, [{
      id: 'mine-regression', title: 'Producto', category: 'alimentos', description: '',
      photo: undefined, location: '', rating: 0, priceRange: '', author: 'Ana',
      department: '', province: '', district: '', community: '', reviews: [], synced: false,
    }]);
    assert.deepEqual(result.sent, []);
    assert.equal(result.server, null);
  } finally {
    globalThis.fetch = original;
  }
});
