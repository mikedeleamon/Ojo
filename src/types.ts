export interface ArticleFormData {
  name:             string;
  clothingType:     string;
  topOrBottom:      string;
  clothingCategory: string;
  fabricType:       string;
  color:            string;
  isAccessory:      boolean;
  isWristWear:      boolean;
  isAnkleWear:      boolean;
  merchant:         string;
  imageUrl:         string;
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
}

export interface Forecast {
  IconPhrase: string;
  Temperature: { Value: number; Unit: string };
  DateTime: string;
  IsDaylight: boolean;
}

export interface Settings {
  clothingStyle: string;
  location: string;
  temperatureScale: string;
  hiTempThreshold: number;
  lowTempThreshold: number;
  humidityPreference: number;
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
  isWristWear?:     boolean;
  isAnkleWear?:     boolean;
  merchant?:        string;
  imageUrl?:        string;
  createdAt?:       string;
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
