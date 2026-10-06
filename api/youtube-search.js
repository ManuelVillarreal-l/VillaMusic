// Función serverless (Vercel): busca en YouTube con la clave guardada en el servidor.
// La clave vive en la variable de entorno YOUTUBE_API_KEY y nunca llega al navegador.
const API = 'https://www.googleapis.com/youtube/v3';

function iso(d) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d || '');
  if (!m) return 0;
  const [dd, h, mi, s] = [m[1], m[2], m[3], m[4]].map((x) => Number(x || 0));
  return dd * 86400 + h * 3600 + mi * 60 + s;
}

export default async function handler(req, res) {
  const key = process.env.YOUTUBE_API_KEY;
  const q = String(req.query?.q ?? '').trim().slice(0, 100);
  if (!key) return res.status(500).json({ error: 'config' });
  if (q.length < 2) return res.status(400).json({ error: 'query' });

  try {
    const s = new URLSearchParams({
      part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true', maxResults: '25', q, key,
    });
    const found = await fetch(`${API}/search?${s}`);
    if (!found.ok) return res.status(found.status === 403 ? 503 : 502).json({ error: found.status === 403 ? 'quota' : 'upstream' });
    const items = ((await found.json()).items || []).filter((i) => i.id?.videoId && i.snippet?.title);

    let durations = new Map();
    if (items.length) {
      const v = new URLSearchParams({ part: 'contentDetails', id: items.map((i) => i.id.videoId).join(','), key });
      const det = await fetch(`${API}/videos?${v}`);
      if (det.ok) durations = new Map(((await det.json()).items || []).map((x) => [x.id, iso(x.contentDetails?.duration)]));
    }

    // Misma búsqueda = misma respuesta durante 24 h: ahorra cuota y responde al instante.
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      items: items.map((i) => ({
        videoId: i.id.videoId,
        title: i.snippet.title,
        channel: i.snippet.channelTitle,
        thumb: (i.snippet.thumbnails?.medium || i.snippet.thumbnails?.default || {}).url,
        duration: durations.get(i.id.videoId) || 0,
      })),
    });
  } catch {
    return res.status(502).json({ error: 'upstream' });
  }
}
