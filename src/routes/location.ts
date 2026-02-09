import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { fetchJson, getFetch } from "../utils/http";

const router = Router();

router.get("/ip", requireAuth, async (_req, res) => {
  try {
    const result = await getNetworkLocation();
    if (!result) {
      res.status(502).json({ error: "Unable to fetch network location" });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to fetch network location" });
  }
});

export default router;

type NetworkLocation = {
  label: string;
  latitude?: number;
  longitude?: number;
  source: string;
};

async function getNetworkLocation(): Promise<NetworkLocation | null> {
  const fetcher = await getFetch();

  const providers = [
    {
      name: "ipapi",
      url: "https://ipapi.co/json/",
      parse: (data: any) => ({
        city: data?.city,
        region: data?.region,
        country: data?.country_name,
        latitude: data?.latitude,
        longitude: data?.longitude
      })
    },
    {
      name: "ipwhois",
      url: "https://ipwho.is/",
      parse: (data: any) => ({
        city: data?.city,
        region: data?.region,
        country: data?.country,
        latitude: data?.latitude,
        longitude: data?.longitude,
        ok: data?.success !== false
      })
    },
    {
      name: "ipapi-com",
      url: "http://ip-api.com/json/",
      parse: (data: any) => ({
        city: data?.city,
        region: data?.regionName,
        country: data?.country,
        latitude: data?.lat,
        longitude: data?.lon,
        ok: data?.status === "success"
      })
    }
  ];

  for (const provider of providers) {
    try {
      const data = await fetchJson(fetcher, provider.url, {
        headers: {
          "User-Agent": "attendance-app"
        }
      });
      const parsed = provider.parse(data);
      if (parsed.ok === false) {
        continue;
      }
      const labelParts = [parsed.city, parsed.region, parsed.country].filter(Boolean);
      const label = labelParts.length ? `IP ${labelParts.join(", ")}` : "IP location";
      return {
        label,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        source: provider.name
      };
    } catch (err) {
      continue;
    }
  }

  return null;
}
