/**
 * Geocodificação de endereço → coordenada, via Nominatim (OpenStreetMap).
 *
 * Por que existe: o mapa só sabia se localizar pela ENTRADA do cemitério. Só que
 * a entrada é marcada CLICANDO no mapa — ou seja, era preciso já ter a entrada
 * para conseguir enxergar onde marcá-la. Cemitério novo abria no centro do
 * Brasil, e a ortofoto recém-enviada ia parar lá, longe de tudo.
 *
 * Com isto a ordem natural funciona: o operador envia a ortofoto, o mapa já
 * abre na cidade do cemitério (endereço que ele mesmo cadastrou), ele posiciona
 * a foto e só então marca a entrada.
 *
 * Usa o mesmo serviço que já provê os tiles do mapa. É só para ENQUADRAR a
 * visão — nada é gravado no banco a partir daqui; a coordenada oficial continua
 * sendo a que o operador marca clicando.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * @param {string} query endereço livre ("Rua X, 100, Itaberaba, BA")
 * @returns {Promise<[number, number] | null>} [lat, lng] ou null
 */
export async function geocodeAddress(query, { signal } = {}) {
  const q = String(query || "").trim();
  if (!q) return null;

  const url = `${NOMINATIM}?${new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    countrycodes: "br",
  })}`;

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const list = await res.json();
    const hit = Array.isArray(list) ? list[0] : null;
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  } catch {
    // offline, bloqueado ou sem resultado: o mapa segue com o fallback padrão
    return null;
  }
}

/**
 * Consultas do cadastro do cemitério, da MAIS específica para a mais genérica.
 *
 * Endereço completo costuma falhar no Nominatim em cidades pequenas (a rua pode
 * nem estar mapeada), enquanto "cidade, UF" quase sempre resolve. Tentar em
 * cascata dá o melhor enquadramento disponível em vez de tudo ou nada.
 *
 * Sem cidade não tentamos: "Rua das Flores" sozinho cai em qualquer lugar do
 * país, e um enquadramento errado é pior que nenhum.
 */
export function cemeteryAddressQueries(raw) {
  if (!raw) return [];
  const city = (raw.addressCity || "").trim();
  const uf = (raw.addressState || "").trim();
  if (!city) return [];

  const base = [city, uf, "Brasil"].filter(Boolean);
  const street = [raw.addressStreet, raw.addressNumber].filter(Boolean).join(", ");
  const district = (raw.addressDistrict || "").trim();

  const queries = [];
  if (street) queries.push([street, district, ...base].filter(Boolean).join(", "));
  if (district) queries.push([district, ...base].filter(Boolean).join(", "));
  queries.push(base.join(", "));
  return queries;
}

/** Tenta as consultas em ordem e devolve o primeiro acerto. */
export async function geocodeCemetery(raw, { signal } = {}) {
  for (const q of cemeteryAddressQueries(raw)) {
    // eslint-disable-next-line no-await-in-loop
    const coord = await geocodeAddress(q, { signal });
    if (coord) return coord;
  }
  return null;
}
