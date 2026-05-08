import type {
  CurrentWeather,
  RouteInsight,
  ShulConditionTarget,
  ShulConditionsResponse,
  TravelProvider,
  WeatherInsight,
} from "@/features/shuls/types/conditions";

const MAX_ROUTE_TARGETS = 8;
const MAPBOX_TIMEOUT_MS = 2500;
const WEATHER_TIMEOUT_MS = 3500;

interface ConditionsRequestBody {
  origin?: {
    lat?: number;
    lng?: number;
  };
  targetDate?: string;
  prayerLabel?: string;
  targets?: ShulConditionTarget[];
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time?: string[];
    apparent_temperature?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
    visibility?: number[];
  };
}

interface MapboxDirectionsResponse {
  routes?: Array<{
    duration?: number;
    distance?: number;
  }>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function clampTargets(targets: unknown): ShulConditionTarget[] {
  if (!Array.isArray(targets)) return [];

  return targets
    .filter((target): target is ShulConditionTarget => {
      if (!target || typeof target !== "object") return false;
      const candidate = target as Partial<ShulConditionTarget>;
      return (
        typeof candidate.shulId === "string" &&
        typeof candidate.shulName === "string" &&
        isFiniteNumber(candidate.lat) &&
        isFiniteNumber(candidate.lng) &&
        isFiniteNumber(candidate.distanceMiles) &&
        isTime(candidate.time) &&
        isFiniteNumber(candidate.minutesUntil)
      );
    })
    .slice(0, MAX_ROUTE_TARGETS);
}

function estimateDriveMinutes(distanceMiles: number): number {
  const minutes = Math.ceil((distanceMiles / 22) * 60 + 3);
  return Math.max(3, minutes);
}

function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

function formatHourLabel(hhmm: string): string {
  const [hourRaw, minuteRaw] = hhmm.split(":").map(Number);
  const hour = hourRaw ?? 0;
  const minute = minuteRaw ?? 0;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function nearestWeatherIndex(times: string[] | undefined, targetDate: string, targetTime: string): number {
  if (!times?.length) return -1;
  const target = `${targetDate}T${targetTime}`;
  const targetMs = new Date(target).getTime();
  if (!Number.isFinite(targetMs)) return -1;

  let bestIndex = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const delta = Math.abs(new Date(time).getTime() - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });

  return bestDelta <= 90 * 60 * 1000 ? bestIndex : -1;
}

function weatherCodeKind(code: number | undefined): WeatherInsight["kind"] | null {
  if (code === undefined) return null;
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code === 95 || code === 96 || code === 99) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return null;
}

function buildCurrentWeather(data: OpenMeteoResponse): CurrentWeather | null {
  const current = data.current;
  if (!current || !isFiniteNumber(current.temperature_2m)) return null;

  const temperature = Math.round(current.temperature_2m);
  const apparent = Math.round(current.apparent_temperature ?? current.temperature_2m);
  const humidity = Math.round(current.relative_humidity_2m ?? 0);
  const precipitation = current.precipitation ?? 0;
  const wind = Math.round(current.wind_speed_10m ?? 0);
  const precipLabel = precipitation > 0
    ? `${precipitation.toFixed(2)}" precip`
    : "dry";

  return {
    temperatureF: temperature,
    apparentTemperatureF: apparent,
    humidityPct: humidity,
    precipitationIn: precipitation,
    windMph: wind,
    label: `${temperature}°F · ${precipLabel} · ${humidity}% hum`,
  };
}

function buildWeatherInsight(
  data: OpenMeteoResponse,
  target: ShulConditionTarget,
  targetDate: string,
  prayerLabel: string,
): WeatherInsight | null {
  const hourly = data.hourly;
  const index = nearestWeatherIndex(hourly?.time, targetDate, target.time);
  if (index < 0) return null;

  const apparent = hourly?.apparent_temperature?.[index];
  const precipProbability = hourly?.precipitation_probability?.[index] ?? 0;
  const precipitation = hourly?.precipitation?.[index] ?? 0;
  const wind = hourly?.wind_speed_10m?.[index] ?? 0;
  const visibility = hourly?.visibility?.[index];
  const codeKind = weatherCodeKind(hourly?.weather_code?.[index]);
  const timeLabel = formatHourLabel(target.time);
  const context = `near ${prayerLabel || timeLabel}`;

  if (codeKind === "snow" || precipitation >= 0.08) {
    return {
      kind: codeKind === "snow" ? "snow" : "rain",
      tone: "alert",
      label: codeKind === "snow" ? `Snow likely ${context}` : `Heavy rain possible ${context}`,
      detail: `${precipProbability}% chance around ${timeLabel}`,
      timeLabel,
    };
  }

  if (codeKind === "rain" || precipProbability >= 45 || precipitation >= 0.01) {
    return {
      kind: "rain",
      tone: precipProbability >= 65 ? "alert" : "watch",
      label: `Rain likely ${context}`,
      detail: `${precipProbability}% chance around ${timeLabel}`,
      timeLabel,
    };
  }

  if (isFiniteNumber(apparent) && apparent <= 32) {
    return {
      kind: "cold",
      tone: apparent <= 20 ? "alert" : "watch",
      label: `Feels like ${Math.round(apparent)}°F ${context}`,
      detail: `Cold around ${timeLabel}`,
      timeLabel,
    };
  }

  if (isFiniteNumber(apparent) && apparent >= 88) {
    return {
      kind: "heat",
      tone: apparent >= 96 ? "alert" : "watch",
      label: `Feels like ${Math.round(apparent)}°F ${context}`,
      detail: `Hot around ${timeLabel}`,
      timeLabel,
    };
  }

  if (wind >= 22) {
    return {
      kind: "wind",
      tone: wind >= 32 ? "alert" : "watch",
      label: `Windy ${context}`,
      detail: `${Math.round(wind)} mph around ${timeLabel}`,
      timeLabel,
    };
  }

  if (codeKind === "fog" || (isFiniteNumber(visibility) && visibility < 1000)) {
    return {
      kind: "fog",
      tone: "watch",
      label: `Low visibility ${context}`,
      detail: `Check roads around ${timeLabel}`,
      timeLabel,
    };
  }

  return null;
}

async function fetchWeatherContext(
  origin: { lat: number; lng: number },
  target: ShulConditionTarget | undefined,
  targetDate: string,
  prayerLabel: string,
): Promise<{ currentWeather: CurrentWeather | null; insight: WeatherInsight | null }> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(origin.lat));
    url.searchParams.set("longitude", String(origin.lng));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("hourly", "apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,visibility");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "7");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
      next: { revalidate: 900 },
    });
    if (!response.ok) return { currentWeather: null, insight: null };
    const data = await response.json() as OpenMeteoResponse;
    return {
      currentWeather: buildCurrentWeather(data),
      insight: target ? buildWeatherInsight(data, target, targetDate, prayerLabel) : null,
    };
  } catch {
    return { currentWeather: null, insight: null };
  }
}

async function fetchMapboxRoute(
  origin: { lat: number; lng: number },
  target: ShulConditionTarget,
  token: string,
): Promise<RouteInsight | null> {
  try {
    const coords = `${origin.lng},${origin.lat};${target.lng},${target.lat}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("overview", "false");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(MAPBOX_TIMEOUT_MS),
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    const data = await response.json() as MapboxDirectionsResponse;
    const route = data.routes?.[0];
    if (!isFiniteNumber(route?.duration)) return null;

    return {
      shulId: target.shulId,
      durationMinutes: Math.max(1, Math.ceil(route.duration / 60)),
      distanceMiles: isFiniteNumber(route.distance) ? metersToMiles(route.distance) : target.distanceMiles,
      provider: "traffic",
    };
  } catch {
    return null;
  }
}

async function fetchRouteInsights(
  origin: { lat: number; lng: number },
  targets: ShulConditionTarget[],
): Promise<{ routes: Record<string, RouteInsight>; provider: TravelProvider }> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  const routes: Record<string, RouteInsight> = {};

  if (token) {
    const results = await Promise.all(targets.map((target) => fetchMapboxRoute(origin, target, token)));
    for (const result of results) {
      if (result) routes[result.shulId] = result;
    }
  }

  for (const target of targets) {
    if (routes[target.shulId]) continue;
    routes[target.shulId] = {
      shulId: target.shulId,
      durationMinutes: estimateDriveMinutes(target.distanceMiles),
      distanceMiles: target.distanceMiles,
      provider: "estimate",
    };
  }

  return {
    routes,
    provider: Object.values(routes).some((route) => route.provider === "traffic") ? "traffic" : "estimate",
  };
}

export async function POST(request: Request) {
  let body: ConditionsRequestBody;
  try {
    body = await request.json() as ConditionsRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const origin = body.origin;
  if (!isFiniteNumber(origin?.lat) || !isFiniteNumber(origin?.lng)) {
    return Response.json({ error: "origin.lat and origin.lng required" }, { status: 400 });
  }

  const targetDate = isIsoDate(body.targetDate) ? body.targetDate : new Date().toISOString().slice(0, 10);
  const targets = clampTargets(body.targets).filter((target) => target.minutesUntil >= 0);
  if (targets.length === 0) {
    const weatherContext = await fetchWeatherContext(
      { lat: origin.lat, lng: origin.lng },
      undefined,
      targetDate,
      typeof body.prayerLabel === "string" ? body.prayerLabel : "minyan",
    );
    const empty: ShulConditionsResponse = {
      currentWeather: weatherContext.currentWeather,
      weather: null,
      routes: {},
      _meta: { routeProvider: "estimate", weatherProvider: weatherContext.currentWeather ? "open-meteo" : "none" },
    };
    return Response.json(empty);
  }

  const weatherTarget = [...targets].sort((a, b) => a.minutesUntil - b.minutesUntil)[0];
  const [routeResult, weatherContext] = await Promise.all([
    fetchRouteInsights({ lat: origin.lat, lng: origin.lng }, targets),
    fetchWeatherContext(
      { lat: origin.lat, lng: origin.lng },
      weatherTarget,
      targetDate,
      typeof body.prayerLabel === "string" ? body.prayerLabel : "minyan",
    ),
  ]);

  const response: ShulConditionsResponse = {
    currentWeather: weatherContext.currentWeather,
    weather: weatherContext.insight,
    routes: routeResult.routes,
    _meta: {
      routeProvider: routeResult.provider,
      weatherProvider: weatherContext.currentWeather || weatherContext.insight ? "open-meteo" : "none",
    },
  };

  return Response.json(response);
}
