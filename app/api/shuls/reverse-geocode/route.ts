interface NominatimReverseResponse {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
  display_name?: string;
}

function shortStateName(state: string | undefined): string | undefined {
  const states: Record<string, string> = {
    "New Jersey": "NJ",
    "New York": "NY",
    Pennsylvania: "PA",
    Connecticut: "CT",
    Maryland: "MD",
    Florida: "FL",
    California: "CA",
    Illinois: "IL",
  };
  return state ? states[state] ?? state : undefined;
}

function buildLocationLabel(data: NominatimReverseResponse): string | null {
  const address = data.address;
  if (!address) return data.display_name?.split(",").slice(0, 3).join(",").trim() ?? null;

  const locality = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
  const state = shortStateName(address.state);
  const zip = address.postcode;
  const parts = [
    locality,
    [state, zip].filter(Boolean).join(" "),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : data.display_name?.split(",").slice(0, 3).join(",").trim() ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "14");

    const response = await fetch(url, {
      headers: { "User-Agent": "Beseder/1.0" },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return Response.json({ label: null });

    const data = await response.json() as NominatimReverseResponse;
    return Response.json({ label: buildLocationLabel(data) });
  } catch {
    return Response.json({ label: null });
  }
}
