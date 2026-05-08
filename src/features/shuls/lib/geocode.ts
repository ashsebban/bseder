export interface GeocodedLocation {
  lat: number;
  lng: number;
  label: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

function shortLabel(displayName: string, parts: number): string {
  return displayName.split(",").slice(0, parts).join(",").trim();
}

export async function geocodeAddress(query: string): Promise<GeocodedLocation | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Beseder/1.0" } });
    const data: NominatimResult[] = await res.json();
    if (!data[0]) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      label: shortLabel(data[0].display_name, 2),
    };
  } catch {
    return null;
  }
}

export async function autocompleteAddress(query: string): Promise<GeocodedLocation[]> {
  if (query.trim().length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, { headers: { "User-Agent": "Beseder/1.0" } });
    const data: NominatimResult[] = await res.json();
    return data.map((result) => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      label: shortLabel(result.display_name, 3),
    }));
  } catch {
    return [];
  }
}
