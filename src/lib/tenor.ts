export interface TenorItem {
  id: string;
  preview: string;
  url: string;
}

const KEY = import.meta.env.VITE_TENOR_API_KEY as string | undefined;
export const tenorEnabled = Boolean(KEY);

interface TenorResponse {
  results?: { id: string; media_formats: { gif?: { url: string }; tinygif?: { url: string } } }[];
}

async function tenorFetch(path: string, params: Record<string, string>): Promise<TenorItem[]> {
  if (!KEY) throw new Error('Tenor is not configured (set VITE_TENOR_API_KEY)');
  const qs = new URLSearchParams({ key: KEY, client_key: 'kirxcord', limit: '24', media_filter: 'gif,tinygif', ...params });
  const res = await fetch(`https://tenor.googleapis.com/v2/${path}?${qs}`);
  if (!res.ok) throw new Error(`Tenor request failed (${res.status})`);
  const json = (await res.json()) as TenorResponse;
  return (json.results ?? []).flatMap((r) => {
    const gif = r.media_formats.gif?.url;
    const tiny = r.media_formats.tinygif?.url ?? gif;
    return gif && tiny ? [{ id: r.id, preview: tiny, url: gif }] : [];
  });
}

/** Trending GIFs when the query is empty, otherwise search results. */
export const searchGifs = (q: string) =>
  q.trim() ? tenorFetch('search', { q: q.trim() }) : tenorFetch('featured', {});
