// A real photo or figure for a topic, from Wikipedia's public API (no key; CORS via origin=*).
// The search phrase comes from the model (TopicDetail.imageQuery) or the topic and subject.
// Results, including "no image", are cached in this browser.
export interface WikiImage {
  src: string;
  width: number;
  height: number;
  article: string; // Wikipedia article title, for the credit
  url: string; // article URL
}

const KEY = 'lessonlab.wikiImages.v1';
const memory = new Map<string, Promise<WikiImage | null>>();

function stored(): Record<string, WikiImage | null> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
function store(q: string, v: WikiImage | null) {
  try {
    const all = stored();
    all[q] = v;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 500))) delete all[k];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked */
  }
}

interface Page {
  index?: number;
  title: string;
  fullurl?: string;
  thumbnail?: { source: string; width: number; height: number };
}

export function wikiImage(query: string): Promise<WikiImage | null> {
  const q = query.trim().toLowerCase();
  if (!q) return Promise.resolve(null);
  const cached = stored();
  if (q in cached) return Promise.resolve(cached[q]);
  if (!memory.has(q)) {
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=4' +
      `&gsrsearch=${encodeURIComponent(query)}&prop=pageimages%7Cinfo&piprop=thumbnail&pithumbsize=640&inprop=url`;
    memory.set(
      q,
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const pages = Object.values((j?.query?.pages ?? {}) as Record<string, Page>).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
          const hit = pages.find((p) => p.thumbnail && p.thumbnail.width >= 120);
          const v: WikiImage | null = hit?.thumbnail
            ? { src: hit.thumbnail.source, width: hit.thumbnail.width, height: hit.thumbnail.height, article: hit.title, url: hit.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}` }
            : null;
          store(q, v);
          return v;
        })
        .catch(() => null), // offline: no image, not cached, try again next time
    );
  }
  return memory.get(q)!;
}
