import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_POSTS = 500;
const MAX_LISTINGS = 300;
/** Tope por teléfono para que una sola cuenta no llene el muro. */
const MAX_POSTS_PER_PHONE = 40;
const MAX_LISTINGS_PER_PHONE = 20;

/** Publicaciones de demostración con las que arranca un servidor vacío. */
function seedPosts(now) {
  const ago = (minutes) => new Date(Date.parse(now) - minutes * 60_000).toISOString();
  return [
    {
      id: 'seed-miel',
      authorPhone: 'demo',
      author: 'María Tsamajain',
      community: 'Awajún · Imaza',
      text: 'Hoy cosechamos 40 frascos de miel. Quedan 12 para esta semana. Pasen por Chiriaco o coordinen por aquí.',
      createdAt: ago(35),
      likedBy: [],
      comments: [],
    },
    {
      id: 'seed-salud',
      authorPhone: 'demo',
      author: 'José Sánchez',
      community: 'Promotor de salud',
      text: 'Recordatorio: si hay una emergencia y no tienes señal, guarda la alerta en Manguaré. Se envía sola cuando vuelva la conexión.',
      createdAt: ago(180),
      likedBy: [],
      comments: [],
    },
  ];
}

/**
 * Muro y mercado compartidos. JSON atómico igual que los demás almacenes.
 * La identidad es el teléfono del acceso de demostración: sirve para "es mío" y
 * para no contar dos veces un «me gusta», pero NO es autenticación real.
 */
export class SocialStore {
  constructor(file, { now = () => new Date().toISOString() } = {}) {
    this.file = file;
    this.now = now;
    this.posts = new Map();
    this.listings = new Map();
    this.writeChain = Promise.resolve();
    this.ready = this.#load();
  }

  async #load() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      for (const post of parsed.posts ?? []) {
        if (post && typeof post.id === 'string') this.posts.set(post.id, post);
      }
      for (const listing of parsed.listings ?? []) {
        if (listing && typeof listing.id === 'string') this.listings.set(listing.id, listing);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        for (const post of seedPosts(this.now())) this.posts.set(post.id, post);
        return;
      }
      if (error instanceof SyntaxError) {
        const backup = `${this.file}.corrupt-${Date.now()}`;
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.rename(this.file, backup).catch(() => {});
        console.error(`[manguare] Red social corrupta movida a ${backup}`);
        return;
      }
      throw error;
    }
  }

  /** Vista pública: nunca expone teléfonos ni la lista de quién dio «me gusta». */
  static publicPost(post, me) {
    return {
      id: post.id,
      author: post.author,
      community: post.community,
      text: post.text,
      photo: post.photo,
      at: post.createdAt,
      likes: post.likedBy.length,
      likedByMe: Boolean(me) && post.likedBy.includes(me),
      mine: Boolean(me) && post.authorPhone === me,
      comments: post.comments.map((comment) => ({
        id: comment.id,
        author: comment.author,
        text: comment.text,
        at: comment.createdAt,
      })),
    };
  }

  static publicListing(listing, me) {
    const { ownerPhone, ...rest } = listing;
    return { ...rest, mine: Boolean(me) && ownerPhone === me };
  }

  async listPosts(me) {
    await this.ready;
    return [...this.posts.values()]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 200)
      .map((post) => SocialStore.publicPost(post, me));
  }

  async addPost(post, me) {
    await this.ready;
    const existing = this.posts.get(post.id);
    if (existing) return { post: SocialStore.publicPost(existing, me), created: false };
    const owned = [...this.posts.values()].filter((item) => item.authorPhone === post.authorPhone).length;
    if (owned >= MAX_POSTS_PER_PHONE) return { post: null, created: false, quota: true };
    this.posts.set(post.id, post);
    this.#trim(this.posts, MAX_POSTS);
    await this.#persist();
    return { post: SocialStore.publicPost(post, me), created: true };
  }

  /** Devuelve 'ok' | 'missing' | 'forbidden'. `isAdmin` es la sesión del panel. */
  async deletePost(id, me, isAdmin) {
    await this.ready;
    const post = this.posts.get(id);
    if (!post) return 'missing';
    if (!isAdmin && post.authorPhone !== me) return 'forbidden';
    this.posts.delete(id);
    await this.#persist();
    return 'ok';
  }

  async setLike(id, me, on) {
    await this.ready;
    const post = this.posts.get(id);
    if (!post) return null;
    const has = post.likedBy.includes(me);
    if (on && !has) post.likedBy.push(me);
    if (!on && has) post.likedBy = post.likedBy.filter((phone) => phone !== me);
    if (on !== has) await this.#persist();
    return SocialStore.publicPost(post, me);
  }

  async addComment(id, comment, me) {
    await this.ready;
    const post = this.posts.get(id);
    if (!post) return null;
    if (!post.comments.some((item) => item.id === comment.id)) {
      post.comments.push(comment);
      if (post.comments.length > 200) post.comments.shift();
      await this.#persist();
    }
    return SocialStore.publicPost(post, me);
  }

  async listListings(me) {
    await this.ready;
    return [...this.listings.values()]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((listing) => SocialStore.publicListing(listing, me));
  }

  async addListing(listing, me) {
    await this.ready;
    const existing = this.listings.get(listing.id);
    if (existing) return { listing: SocialStore.publicListing(existing, me), created: false };
    const owned = [...this.listings.values()].filter((item) => item.ownerPhone === listing.ownerPhone).length;
    if (owned >= MAX_LISTINGS_PER_PHONE) return { listing: null, created: false, quota: true };
    this.listings.set(listing.id, listing);
    this.#trim(this.listings, MAX_LISTINGS);
    await this.#persist();
    return { listing: SocialStore.publicListing(listing, me), created: true };
  }

  async deleteListing(id, me, isAdmin) {
    await this.ready;
    const listing = this.listings.get(id);
    if (!listing) return 'missing';
    if (!isAdmin && listing.ownerPhone !== me) return 'forbidden';
    this.listings.delete(id);
    await this.#persist();
    return 'ok';
  }

  #trim(map, max) {
    while (map.size > max) {
      const oldest = [...map.values()].sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt)),
      )[0];
      map.delete(oldest.id);
    }
  }

  async #persist() {
    const snapshot = JSON.stringify(
      { version: 1, posts: [...this.posts.values()], listings: [...this.listings.values()] },
      null,
      2,
    );
    const run = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, snapshot, 'utf8');
      await fs.rename(temp, this.file);
    });
    this.writeChain = run.catch(() => {});
    return run;
  }
}
