import { fetchJson, getFetch } from "./http";

type ProviderName = "nominatim" | "mapbox" | "google";

type GeocodeResult = {
  label: string;
  source: ProviderName;
};

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  const provider = (process.env.REVERSE_GEOCODE_PROVIDER as ProviderName | undefined) ?? "nominatim";
  const fetcher = await getFetch();

  switch (provider) {
    case "mapbox":
      return reverseGeocodeMapbox(fetcher, latitude, longitude);
    case "google":
      return reverseGeocodeGoogle(fetcher, latitude, longitude);
    case "nominatim":
    default:
      return reverseGeocodeNominatim(fetcher, latitude, longitude);
  }
}

async function reverseGeocodeNominatim(
  fetcher: typeof fetch,
  latitude: number,
  longitude: number
): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
  const userAgent = process.env.REVERSE_GEOCODE_USER_AGENT ?? "attendance-app";
  try {
    const data = (await fetchJson(fetcher, url, {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": process.env.REVERSE_GEOCODE_LANGUAGE ?? "en"
      }
    })) as { display_name?: string };
    if (!data?.display_name) {
      return null;
    }
    return { label: data.display_name, source: "nominatim" };
  } catch {
    return null;
  }
}

async function reverseGeocodeMapbox(
  fetcher: typeof fetch,
  latitude: number,
  longitude: number
): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return null;
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}`;
  try {
    const data = (await fetchJson(fetcher, url)) as { features?: Array<{ place_name?: string }> };
    const label = data?.features?.[0]?.place_name;
    if (!label) {
      return null;
    }
    return { label, source: "mapbox" };
  } catch {
    return null;
  }
}

async function reverseGeocodeGoogle(
  fetcher: typeof fetch,
  latitude: number,
  longitude: number
): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) {
    return null;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}`;
  try {
    const data = (await fetchJson(fetcher, url)) as {
      results?: Array<{ formatted_address?: string }>;
      status?: string;
    };
    if (data?.status && data.status !== "OK") {
      return null;
    }
    const label = data?.results?.[0]?.formatted_address;
    if (!label) {
      return null;
    }
    return { label, source: "google" };
  } catch {
    return null;
  }
}
