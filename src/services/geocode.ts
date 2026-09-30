/**
 * Busca de endereços via OpenStreetMap Nominatim (sem chave de API).
 * Política de uso: no máx. 1 requisição/s — por isso a busca só roda ao tocar em "Buscar",
 * e a geocodificação reversa é espaçada pelo chamador.
 */
export interface ResultadoBusca {
  titulo: string;
  endereco: string;
  latitude: number;
  longitude: number;
}

async function pedir<T>(url: URL, ms = 12_000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Serviço de endereços indisponível (${r.status})`);
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('A busca demorou demais. Tente de novo.');
    if (e instanceof TypeError) throw new Error('Sem conexão com a internet.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function buscarEndereco(consulta: string): Promise<ResultadoBusca[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: consulta, format: 'jsonv2', limit: '6', 'accept-language': 'pt-BR' }).toString();
  const dados = await pedir<{ display_name: string; name?: string; lat: string; lon: string }[]>(url);
  return dados.map((d) => ({
    titulo: d.name || d.display_name.split(',')[0]!.trim(),
    endereco: d.display_name,
    latitude: Number(d.lat),
    longitude: Number(d.lon),
  }));
}

export async function enderecoDe(latitude: number, longitude: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({
    lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '18', 'accept-language': 'pt-BR',
  }).toString();
  const d = await pedir<{ display_name?: string }>(url);
  return d.display_name ?? null;
}
