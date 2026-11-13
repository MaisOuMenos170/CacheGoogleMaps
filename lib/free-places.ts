import { PlaceSearchResult, PlaceDetails } from "./types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PHOTON_BASE = "https://photon.komoot.io/api";
const WIKIMEDIA_BASE = "https://commons.wikimedia.org/w/api.php";

// Rate limiting: Nominatim allows 1 req/sec, Photon is more generous
let lastNominatimCall = 0;
const NOMINATIM_MIN_INTERVAL = 1100; // ms

async function nominatimRateLimit() {
  const now = Date.now();
  const wait = lastNominatimCall + NOMINATIM_MIN_INTERVAL - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimCall = Date.now();
}

function parseOsmTypes(osmType: string, osmClass: string, category?: string): string[] {
  const types = new Set<string>();
  if (osmType) types.add(osmType);
  if (osmClass) types.add(osmClass);
  if (category) {
    category.split(",").forEach(c => types.add(c.trim()));
  }
  return Array.from(types);
}

export async function searchFreePlaces(query: string): Promise<PlaceSearchResult[]> {
  await nominatimRateLimit();

  const trimmed = query.trim();
  if (!trimmed) return [];

  // Use Photon for better structured results, fallback to Nominatim
  try {
    const photonUrl = `${PHOTON_BASE}/?q=${encodeURIComponent(trimmed)}&limit=10&lang=en`;
    const res = await fetch(photonUrl, {
      headers: { "User-Agent": "PlaceCache/1.0 (https://github.com/your-repo)" }
    });
    
    if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
    
    const data = await res.json();
    
    if (data.features && data.features.length > 0) {
      return data.features.map((feature: any) => ({
        place_id: `osm:${feature.properties.osm_type}:${feature.properties.osm_id}`,
        name: feature.properties.name || "Sem nome",
        formatted_address: [
          feature.properties.housenumber,
          feature.properties.street,
          feature.properties.city || feature.properties.town || feature.properties.village,
          feature.properties.state,
          feature.properties.country
        ].filter(Boolean).join(", "),
        types: parseOsmTypes(
          feature.properties.osm_type,
          feature.properties.osm_class,
          feature.properties.category
        ),
        rating: undefined,
        user_ratings_total: undefined,
        geometry: {
          location: {
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0]
          }
        }
      }));
    }
  } catch (e) {
    console.warn("Photon search failed, trying Nominatim:", e);
  }

  // Fallback to Nominatim
  try {
    const nominatimUrl = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(trimmed)}&limit=10&addressdetails=1&extratags=1&namedetails=1&accept-language=pt-BR`;
    const res = await fetch(nominatimUrl, {
      headers: { "User-Agent": "PlaceCache/1.0 (https://github.com/your-repo)" }
    });
    
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    
    const data = await res.json();
    
    return data.map((item: any) => ({
      place_id: `osm:${item.osm_type}:${item.osm_id}`,
      name: item.display_name?.split(",")[0] || item.name || "Sem nome",
      formatted_address: item.display_name,
      types: parseOsmTypes(item.type, item.class, item.category),
      rating: undefined,
      user_ratings_total: undefined,
      geometry: {
        location: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }
      }
    }));
  } catch (e) {
    console.error("Nominatim search failed:", e);
    throw new Error("Falha ao buscar lugares (serviços gratuitos indisponíveis)");
  }
}

export async function getFreePlaceDetails(placeId: string): Promise<PlaceDetails> {
  // Extract OSM type and ID from place_id (format: osm:node:12345 or osm:N:12345)
  const match = placeId.match(/^osm:(node|way|relation|[NWR]):(\d+)$/i);
  if (!match) {
    throw new Error("ID de lugar inválido (formato esperado: osm:type:id)");
  }

  let [, osmTypeRaw, osmId] = match;
  // Normalize type to full name
  const typeMap: Record<string, string> = {
    'n': 'node', 'w': 'way', 'r': 'relation',
    'N': 'node', 'W': 'way', 'R': 'relation',
    'node': 'node', 'way': 'way', 'relation': 'relation'
  };
  const osmType = typeMap[osmTypeRaw.toLowerCase()] || osmTypeRaw;
  
  await nominatimRateLimit();

  // Nominatim lookup uses prefix: N for node, W for way, R for relation
  const osmPrefix = osmType === "node" ? "N" : osmType === "way" ? "W" : "R";
  const lookupId = `${osmPrefix}${osmId}`;

  try {
    // Get details from Nominatim lookup endpoint
    const detailsUrl = `${NOMINATIM_BASE}/lookup?format=json&osm_ids=${lookupId}&addressdetails=1&extratags=1&namedetails=1&accept-language=pt-BR`;
    const res = await fetch(detailsUrl, {
      headers: { "User-Agent": "PlaceCache/1.0 (https://github.com/your-repo)" }
    });
    
    if (!res.ok) throw new Error(`Nominatim lookup HTTP ${res.status}`);
    
    const data = await res.json();
    
    // Lookup returns an array, take the first result
    const place = data[0];
    if (!place) throw new Error("Lugar não encontrado no OpenStreetMap");
    
    // Try to get photos from Wikimedia Commons
    let photos: PlaceDetails["photos"] = [];
    try {
      const wikiPhotos = await fetchWikimediaPhotos(place.name, place.lat, place.lon);
      photos = wikiPhotos;
    } catch (e) {
      console.warn("Could not fetch photos:", e);
    }

    const openingHours = parseOpeningHours(place.extratags);

    return {
      place_id: placeId,
      name: place.name || place.namedetails?.name || "Sem nome",
      formatted_address: place.display_name,
      geometry: {
        location: {
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon)
        }
      },
      formatted_phone_number: place.extratags?.phone || place.extratags?.contact_phone,
      international_phone_number: place.extratags?.phone || place.extratags?.contact_phone,
      website: place.extratags?.website || place.extratags?.contact_website,
      url: `https://www.openstreetmap.org/${osmType}/${osmId}`,
      rating: undefined,
      user_ratings_total: undefined,
      price_level: undefined,
      business_status: undefined,
      types: parseOsmTypes(place.type, place.class, place.category),
      opening_hours: openingHours,
      photos,
      editorial_summary: place.extratags?.description ? { overview: place.extratags.description } : undefined,
      address_components: place.address ? Object.entries(place.address).map(([k, v]) => ({ 
        long_name: v as string, 
        short_name: v as string, 
        types: [k] 
      })) : undefined
    };
  } catch (e) {
    console.error("Nominatim details failed:", e);
    throw new Error("Falha ao obter detalhes do lugar");
  }
}

async function fetchWikimediaPhotos(name: string, lat: string, lng: string): Promise<PlaceDetails["photos"]> {
  try {
    // Search for images near the location
    const url = `${WIKIMEDIA_BASE}?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=1000&gslimit=5&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.query?.geosearch?.length) return [];

    // Get image info for the first few results
    const pageIds = data.query.geosearch.slice(0, 3).map((p: any) => p.pageid).join("|");
    const infoUrl = `${WIKIMEDIA_BASE}?action=query&pageids=${pageIds}&prop=imageinfo&iiprop=url|size&iiurlwidth=800&format=json`;
    const infoRes = await fetch(infoUrl);
    const infoData = await infoRes.json();

    const photos: PlaceDetails["photos"] = [];
    for (const pageId of pageIds.split("|")) {
      const page = infoData.query?.pages?.[pageId];
      if (page?.imageinfo?.[0]) {
        const img = page.imageinfo[0];
        photos.push({
          photo_reference: `wiki:${pageId}`,
          height: img.height || 600,
          width: img.width || 800,
          proxy_url: `/api/places/photo?ref=${encodeURIComponent(`wiki:${pageId}`)}&url=${encodeURIComponent(img.url)}`
        });
      }
    }
    return photos;
  } catch {
    return [];
  }
}

function parseOpeningHours(extratags: Record<string, string> | undefined) {
  if (!extratags?.opening_hours) return undefined;
  
  const days = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
  const weekday_text: string[] = [];
  
  // Simple parsing - OSM opening_hours format is complex
  // This is a basic implementation
  const oh = extratags.opening_hours;
  if (oh === "24/7") {
    return { open_now: true, weekday_text: days.map(d => `${d}: Aberto 24 horas`) };
  }
  
  // Try to parse simple formats like "Mo-Fr 09:00-18:00; Sa 09:00-12:00"
  // For now, just return the raw string
  return {
    open_now: undefined,
    weekday_text: [`Horário: ${oh}`]
  };
}

// Proxy photos through our API to avoid CORS
export async function proxyPhoto(photoRef: string, url?: string): Promise<Response> {
  if (photoRef.startsWith("wiki:") && url) {
    // Wikimedia images - direct proxy
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch Wikimedia image");
    return res;
  }
  
  // For OSM, we don't have direct photos - return a placeholder or try to find one
  // Could integrate with Mapillary, Wikimedia, or other free sources
  throw new Error("Fotos não disponíveis para este provedor gratuito");
}