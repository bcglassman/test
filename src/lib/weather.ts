/**
 * Historical weather lookup for a session's time and place.
 *
 * Uses Open-Meteo, which needs no API key and no billing. The reading is
 * fetched once and stored on the session rather than looked up on every
 * render: the weather at a past moment doesn't change, and a stored value
 * keeps the record honest even if the API later goes away.
 *
 * Every failure path returns undefined — weather is a nice-to-have and must
 * never block saving a session.
 */

export interface WeatherReading {
  temperatureC?: number;
  humidityPercent?: number;
  description?: string;
  fetchedAt?: string;
}

export interface NamedLocation {
  name: string;
  latitude: number;
  longitude: number;
}

/** A few common locations, so the usual case needs no geocoding round-trip. */
export const LOCATION_PRESETS: NamedLocation[] = [
  { name: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { name: "Kuala Lumpur", latitude: 3.139, longitude: 101.6869 },
  { name: "Hong Kong", latitude: 22.3193, longitude: 114.1694 },
  { name: "Sydney", latitude: -33.8688, longitude: 151.2093 },
  { name: "London", latitude: 51.5072, longitude: -0.1276 },
  { name: "New York", latitude: 40.7128, longitude: -74.006 },
];

export const DEFAULT_LOCATION = LOCATION_PRESETS[0];

/** Open-Meteo's WMO weather codes, condensed to a readable phrase. */
function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mostly clear";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

/** Looks up a place name's coordinates, for locations outside the presets. */
export async function geocodeLocation(
  name: string,
): Promise<NamedLocation | undefined> {
  const preset = LOCATION_PRESETS.find(
    (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (preset) return preset;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        name.trim(),
      )}&count=1`,
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      results?: { name: string; latitude: number; longitude: number }[];
    };
    const hit = data.results?.[0];
    return hit
      ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude }
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Conditions at `when` for the given coordinates. Open-Meteo serves recent
 * dates from its forecast endpoint and older ones from the archive, so pick
 * whichever covers the date rather than guessing.
 */
export async function fetchWeatherAt(
  latitude: number,
  longitude: number,
  when: string,
): Promise<WeatherReading | undefined> {
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) return undefined;

  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  // The archive lags a few days behind; anything recent comes from forecast.
  const host =
    ageDays > 5 ? "https://archive-api.open-meteo.com" : "https://api.open-meteo.com";

  const url =
    `${host}/v1/${ageDays > 5 ? "archive" : "forecast"}` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&start_date=${day}&end_date=${day}` +
    `&hourly=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      hourly?: {
        time?: string[];
        temperature_2m?: (number | null)[];
        relative_humidity_2m?: (number | null)[];
        weather_code?: (number | null)[];
      };
    };
    const times = data.hourly?.time;
    if (!times?.length) return undefined;

    // Nearest hour to the session, not just the first reading of the day.
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i < times.length; i++) {
      const gap = Math.abs(new Date(times[i]).getTime() - date.getTime());
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }

    const temp = data.hourly?.temperature_2m?.[best];
    const humidity = data.hourly?.relative_humidity_2m?.[best];
    const code = data.hourly?.weather_code?.[best];
    if (temp == null && humidity == null && code == null) return undefined;

    return {
      temperatureC: temp ?? undefined,
      humidityPercent: humidity ?? undefined,
      description: code == null ? undefined : describeWeatherCode(code),
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

/** "28°C · 74% humidity · Rain showers" */
export function formatWeather(w?: WeatherReading): string | undefined {
  if (!w) return undefined;
  const parts: string[] = [];
  if (w.temperatureC != null) parts.push(`${Math.round(w.temperatureC)}°C`);
  if (w.humidityPercent != null) {
    parts.push(`${Math.round(w.humidityPercent)}% humidity`);
  }
  if (w.description) parts.push(w.description);
  return parts.length ? parts.join(" · ") : undefined;
}
