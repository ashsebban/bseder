export type TravelProvider = "traffic" | "estimate";
export type WeatherTone = "info" | "watch" | "alert";
export type WeatherKind = "rain" | "snow" | "cold" | "heat" | "wind" | "fog";

export interface ShulConditionTarget {
  shulId: string;
  shulName: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  time: string;
  minutesUntil: number;
}

export interface RouteInsight {
  shulId: string;
  durationMinutes: number;
  distanceMiles: number;
  provider: TravelProvider;
}

export interface WeatherInsight {
  kind: WeatherKind;
  tone: WeatherTone;
  label: string;
  detail?: string;
  timeLabel?: string;
}

export interface CurrentWeather {
  temperatureF: number;
  apparentTemperatureF: number;
  humidityPct: number;
  precipitationIn: number;
  windMph: number;
  label: string;
}

export interface ShulConditionsResponse {
  currentWeather: CurrentWeather | null;
  weather: WeatherInsight | null;
  routes: Record<string, RouteInsight>;
  _meta?: {
    routeProvider: TravelProvider;
    weatherProvider: "open-meteo" | "none";
  };
}
