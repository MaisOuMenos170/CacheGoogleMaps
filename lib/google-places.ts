import { PlaceDetails, PlaceSearchResult } from "./types";

function getApiKey(customKey?: string | null): string {
  const key = customKey?.trim() || process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Chave do Google Places API não configurada. Defina GOOGLE_PLACES_API_KEY no arquivo .env.local ou informe na interface."
    );
  }
  return key;
}

export async function searchGooglePlaces(query: string, customApiKey?: string | null): Promise<PlaceSearchResult[]> {
  const apiKey = getApiKey(customApiKey);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    trimmed
  )}&key=${apiKey}&language=pt-BR`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Erro na Places API (HTTP ${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API retornou erro: ${data.status} - ${data.error_message || ""}`);
  }

  const results = (data.results || []).map((item: Record<string, unknown>) => ({
    place_id: item.place_id as string,
    name: item.name as string,
    formatted_address: item.formatted_address as string,
    types: item.types as string[],
    rating: item.rating as number,
    user_ratings_total: item.user_ratings_total as number,
    geometry: item.geometry as PlaceSearchResult["geometry"],
  }));

  return results;
}

export async function getGooglePlaceDetails(placeId: string, customApiKey?: string | null): Promise<PlaceDetails> {
  const apiKey = getApiKey(customApiKey);
  if (!placeId) {
    throw new Error("place_id é obrigatório para buscar detalhes.");
  }

  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "geometry",
    "formatted_phone_number",
    "international_phone_number",
    "website",
    "url",
    "rating",
    "user_ratings_total",
    "price_level",
    "business_status",
    "types",
    "opening_hours",
    "photos",
    "editorial_summary",
    "address_components",
  ].join(",");

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=${fields}&key=${apiKey}&language=pt-BR`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Erro na Places Details API (HTTP ${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  if (data.status !== "OK") {
    throw new Error(`Google Place Details retornou status ${data.status}: ${data.error_message || ""}`);
  }

  const result = data.result || {};

  // Formatar fotos e criar URLs de proxy seguras
  const photos = (result.photos || []).map((p: Record<string, unknown>) => ({
    photo_reference: p.photo_reference as string,
    height: p.height as number,
    width: p.width as number,
    proxy_url: `/api/places/photo?ref=${encodeURIComponent(p.photo_reference as string)}`,
  }));

  return {
    ...result,
    photos,
  };
}
