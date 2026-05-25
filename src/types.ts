import { GarmentType, DetectedColor, FabricGuess } from './services/clothingIdentifier.types';
export type { GarmentType, DetectedColor, FabricGuess };

export type BodyZone = 'Head' | 'Neck' | 'Wrist' | 'Hand' | 'Waist' | 'Ankle' | 'Carried';

export interface ArticleFormData {
  name:             string;
  clothingType:     string;
  topOrBottom:      string;
  clothingCategory: string;
  fabricType:       string;
  color:            string;
  isAccessory:      boolean;
  bodyZone?:        BodyZone;
  merchant:         string;
  imageUrl:         string;
  detectedGarmentType?:      GarmentType;
  detectedColors?:           DetectedColor[];
  detectedFabric?:           FabricGuess;
  identificationConfidence?: number;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuthState {
  user: AuthUser;
  token: string;
}

export interface CityData {
  Key: string;
  LocalizedName: string;
}

export interface CurrentWeather {
  WeatherText: string;
  HasPrecipitation: boolean;
  PrecipitationType?: string | null;   // "Rain", "Snow", "Ice", "Mixed", or null
  Precip1hr?: { Imperial?: { Value: number }; Metric?: { Value: number } };  // last-hour amount
  IsDayTime: boolean;
  Temperature: {
    Imperial: { Value: number; Unit: string };
    Metric: { Value: number; Unit: string };
  };
  RealFeelTemperature: {
    Imperial: { Value: number; Unit: string };
    Metric: { Value: number; Unit: string };
  };
  Wind: { Speed: { Imperial: { Value: number }; Metric: { Value: number } } };
  RelativeHumidity: number;
  UVIndexText: string;
  // Parsed from AccuWeather AirAndPollen (details: true)
  AirQualityText?:  string;   // e.g. "Good", "Moderate", "Unhealthy"
  AirQualityIndex?: number;   // 0–500 AQI numeric value
  PollenCategory?:  string;   // worst of Tree/Grass/Ragweed e.g. "Low", "High", "Very High"
}

export interface Forecast {
  IconPhrase: string;
  Temperature: { Value: number; Unit: string };
  DateTime: string;
  IsDaylight: boolean;
}

/** One day from the AccuWeather 5-day daily forecast, normalised for Ojo. */
export interface DailyForecast {
  date:             string;   // ISO date string e.g. "2026-05-26"
  minTempF:         number;
  maxTempF:         number;
  dayPhrase:        string;   // e.g. "Partly cloudy"
  hasPrecipitation: boolean;
}

export type OutfitOccasion = 'everyday' | 'work' | 'weekend' | 'date' | 'outdoor' | 'athletic';

export interface Settings {
  clothingStyle: string;
  location: string;
  temperatureScale: string;
  hiTempThreshold: number;
  lowTempThreshold: number;
  humidityPreference: number;
  occasion?:       OutfitOccasion;  // optional — defaults to 'everyday' if not set
  sensitivities?:  { allergies?: boolean; asthma?: boolean };
}

export interface ClothingArticle {
  _id:              string;
  clothingType:     string;
  name?:            string;
  topOrBottom?:     string;
  clothingCategory?:string;
  fabricType?:      string;
  color?:           string;
  isAccessory?:     boolean;
  bodyZone?:        BodyZone;
  merchant?:        string;
  imageUrl?:        string;
  createdAt?:       string;
  detectedGarmentType?:      GarmentType;
  detectedColors?:           DetectedColor[];
  detectedFabric?:           FabricGuess;
  identificationConfidence?: number;
}

export interface NotificationSettings {
  morningBriefEnabled:    boolean;
  morningBriefHourUTC:    number;   // 0–23 in UTC
  weatherChangeEnabled:   boolean;
  tempSwingEnabled:       boolean;
  tempSwingThresholdF:    number;   // degrees F, default 20
  closetGapEnabled:       boolean;
  weeklyRecapEnabled:     boolean;
  weeklyRecapDay:         number;   // 0=Sun … 6=Sat
}

export interface OutfitHistoryEntry {
  id:        string;
  wornAt:    string;
  closetId:  string;
  closetName:string;
  articleIds:string[];
  articleSummary: string;
}

export interface Closet {
  _id:         string;
  name:        string;
  userId:      string;
  articles:    ClothingArticle[];
  isPreferred: boolean;
  createdAt?:  string;
}
