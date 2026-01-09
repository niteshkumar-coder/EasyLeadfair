
export interface User {
  name: string;
  email: string;
}

export interface BusinessLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string;
  lat: number;
  lng: number;
  distance: number | null;
  owner: string | null;
  source: 'Google Maps' | 'Web Scraped' | 'Manual' | 'Google Search';
  mapsUrl?: string;
  lastUpdated: string;
  rating?: number;
  userRatingsTotal?: number;
}

export interface SearchQuery {
  city: string;
  categories: string[];
  radius: number;
}

export interface SearchHistory {
  id: string;
  query: SearchQuery;
  timestamp: string;
  resultCount: number;
}

export enum DistanceUnit {
  KM = 'km',
  MILES = 'miles'
}
